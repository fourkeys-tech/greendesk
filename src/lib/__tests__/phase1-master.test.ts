import { describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import { generateAssetQrDataUrl } from "../qr";
import { buildAssetPrefix } from "../asset-code";
import {
  assignTemporaryManager,
  cancelTemporaryManagerAssignment,
  createAsset,
  createCategory,
  createInternalStaffAccount,
  setUserBlockStatus,
  updatePark,
} from "../services/phase1-master";
import { submitCitizenReport } from "../services/phase3-reporting";

describe("Fase 1 – Data Master, Hierarki 5 Tingkat, QR & Akun Internal", () => {
  it("menghasilkan QR Code otomatis dengan tautan pendek /r/{kodeAset}", async () => {
    const qr = await generateAssetQrDataUrl(
      "AST-BGV-001",
      "https://greenpark.id"
    );
    expect(qr.shortUrl).toBe("https://greenpark.id/r/AST-BGV-001");
    expect(qr.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("menjaga hierarki 5 tingkat (menolak pembuatan aset jika taman milik perusahaan lain)", async () => {
    const adminB = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@griyaasri.id" },
    });
    const parkCompanyA = await prisma.park.findFirstOrThrow({
      where: { name: "Taman Utama Bougenville" },
    });
    const catCompanyA = await prisma.category.findFirstOrThrow({
      where: { name: "Penerangan & Lampu Taman" },
    });

    await expect(
      createAsset(
        {
          id: adminB.id,
          name: adminB.name,
          email: adminB.email,
          role: adminB.role,
          companyId: adminB.companyId,
          companyName: null,
          staffClusterId: null,
        },
        {
          code: "AST-ILLEGAL-99",
          name: "Aset Lintas Perusahaan",
          parkId: parkCompanyA.id,
          categoryId: catCompanyA.id,
        }
      )
    ).rejects.toThrow(/Hierarki tidak valid/);
  });

  it("memastikan akun Pengelola hanya bisa ditautkan tepat ke 1 cluster, sedangkan Manager bisa multi-cluster & menunjuk/membatalkan pengganti sementara dengan riwayat tersimpan", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const clusters = await prisma.cluster.findMany({
      where: { companyId: admin.companyId! },
      orderBy: { code: "asc" },
    });
    expect(clusters.length).toBeGreaterThanOrEqual(2);

    const actor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    // Pengelola ditolak jika ditautkan ke >1 cluster
    await expect(
      createInternalStaffAccount(actor, {
        name: "Pengelola Ganda",
        email: `pengelola.ganda.${Date.now()}@greenpark.id`,
        role: "PENGELOLA",
        clusterIds: [clusters[0].id, clusters[1].id],
      })
    ).rejects.toThrow(/wajib ditautkan tepat ke satu cluster/);

    const primaryManager = await prisma.user.findUniqueOrThrow({
      where: { email: "manager@greenpark.id" },
    });
    const primaryPerm = await prisma.clusterManagerAssignment.findFirstOrThrow({
      where: { userId: primaryManager.id, isTemporary: false },
    });
    const targetClusterId = primaryPerm.clusterId;
    const otherCluster = clusters.find((c) => c.id !== targetClusterId)!;
    expect(otherCluster).toBeDefined();

    // Buat Manager pengganti baru agar tidak bertabrakan antar-run test
    const uniqueSuffix = Date.now().toString().slice(-6);
    const secondManager = await createInternalStaffAccount(actor, {
      name: `Manager Cadangan ${uniqueSuffix}`,
      email: `manager.cadangan.${uniqueSuffix}@greenpark.id`,
      role: "MANAGER",
      clusterIds: [otherCluster.id],
    });

    const nowMs = Date.now();
    const validFrom1 = new Date(nowMs + 24 * 60 * 60 * 1000);
    const validUntil1 = new Date(nowMs + 10 * 24 * 60 * 60 * 1000);

    const assignment1 = await assignTemporaryManager(actor, {
      substituteManagerId: secondManager.id,
      replacedManagerId: primaryManager.id,
      clusterId: targetClusterId,
      validFrom: validFrom1,
      validUntil: validUntil1,
    });

    expect(assignment1.isTemporary).toBe(true);
    expect(assignment1.replacedManagerId).toBe(primaryManager.id);

    // Batalkan delegasi pertama
    const cancelled = await cancelTemporaryManagerAssignment(actor, assignment1.id);
    expect(cancelled.cancelledAt).not.toBeNull();

    // Buat delegasi kedua pada periode berikutnya — riwayat pertama harus tetap tersimpan
    const validFrom2 = new Date(nowMs + 2 * 24 * 60 * 60 * 1000);
    const validUntil2 = new Date(nowMs + 12 * 24 * 60 * 60 * 1000);
    const assignment2 = await assignTemporaryManager(actor, {
      substituteManagerId: secondManager.id,
      replacedManagerId: primaryManager.id,
      clusterId: targetClusterId,
      validFrom: validFrom2,
      validUntil: validUntil2,
    });

    try {
      const historyRows = await prisma.clusterManagerAssignment.findMany({
        where: {
          userId: secondManager.id,
          clusterId: targetClusterId,
          isTemporary: true,
        },
        orderBy: { createdAt: "asc" },
      });
      expect(historyRows.length).toBe(2);
      expect(historyRows[0].cancelledAt).not.toBeNull();
      expect(historyRows[1].cancelledAt).toBeNull();
    } finally {
      await cancelTemporaryManagerAssignment(actor, assignment2.id);
    }

    // Pastikan kategori baru tercatat di AuditLog
    const catCountBefore = await prisma.auditLog.count({
      where: { companyId: admin.companyId!, entityName: "Category" },
    });
    const uniqueCatName = `Fasilitas Olahraga Taman (${Date.now().toString().slice(-4)})`;
    await createCategory(actor, {
      name: uniqueCatName,
      damageTypes: ["Alat macet", "Besi patah"],
    });
    const catCountAfter = await prisma.auditLog.count({
      where: { companyId: admin.companyId!, entityName: "Category" },
    });
    expect(catCountAfter).toBe(catCountBefore + 1);
  });

  it("mengizinkan Admin memblokir dan membuka blokir pelapor dengan catatan audit", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const actor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const suffix = Date.now().toString().slice(-6);
    const citizen = await prisma.user.create({
      data: {
        companyId: admin.companyId!,
        name: `Warga Uji Blokir ${suffix}`,
        email: `warga.blokir.${suffix}@greenpark.id`,
        role: "PENGGUNA",
        loginMethod: "GOOGLE",
      },
    });

    // Tolak blokir tanpa alasan
    await expect(
      setUserBlockStatus(actor, citizen.id, true, "")
    ).rejects.toThrow(/Alasan pemblokiran wajib diisi/);

    const blocked = await setUserBlockStatus(
      actor,
      citizen.id,
      true,
      "Mengirim laporan palsu berulang"
    );
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.blockedReason).toBe("Mengirim laporan palsu berulang");

    const blockLog = await prisma.auditLog.findFirst({
      where: {
        companyId: admin.companyId!,
        entityName: "User",
        entityId: citizen.id,
        action: "BLOCK",
      },
    });
    expect(blockLog).not.toBeNull();

    const unblocked = await setUserBlockStatus(actor, citizen.id, false);
    expect(unblocked.isBlocked).toBe(false);
    expect(unblocked.blockedReason).toBeNull();

    const unblockLog = await prisma.auditLog.findFirst({
      where: {
        companyId: admin.companyId!,
        entityName: "User",
        entityId: citizen.id,
        action: "UNBLOCK",
      },
    });
    expect(unblockLog).not.toBeNull();
  });

  it("menolak pelaporan aset jika induk wilayah (Taman) sedang dinonaktifkan", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const actor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const asset = await prisma.asset.findFirstOrThrow({
      where: { companyId: admin.companyId!, code: "AST-BGV-001" },
      include: { park: true },
    });

    const suffix = Date.now().toString().slice(-6);
    const citizen = await prisma.user.create({
      data: {
        companyId: admin.companyId!,
        name: `Warga Uji Wilayah ${suffix}`,
        email: `warga.wilayah.${suffix}@greenpark.id`,
        role: "PENGGUNA",
        loginMethod: "GOOGLE",
      },
    });
    const citizenActor = {
      id: citizen.id,
      name: citizen.name,
      email: citizen.email,
      role: citizen.role,
      companyId: citizen.companyId,
      companyName: null,
      staffClusterId: null,
    };

    await updatePark(actor, asset.park.id, { isActive: false });
    try {
      await expect(
        submitCitizenReport(citizenActor, {
          assetCode: asset.code,
          channel: "QR",
          description: "Uji pelaporan saat taman nonaktif",
          photoUrls: ["/uploads/reports/test-inactive-park.jpg"],
        })
      ).rejects.toThrow(/tidak dapat dilaporkan|tidak aktif/i);
    } finally {
      await updatePark(actor, asset.park.id, { isActive: true });
    }
  });

  it("menghasilkan kode aset otomatis (5 tingkat) dan nomor urut sekuensial jika input code tidak diisi", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const park = await prisma.park.findFirstOrThrow({
      where: { name: "Taman Utama Bougenville" },
      include: { cluster: { include: { complex: true } } },
    });
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Penerangan & Lampu Taman" },
    });

    const actor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const timestamp = Date.now().toString().slice(-4);
    const asset1 = await createAsset(actor, {
      name: `Lampu Sorot LED Otomatis 1 (${timestamp})`,
      parkId: park.id,
      categoryId: category.id,
    });

    // Kode harus berformat: [Kompleks]-[Cluster]-[Taman]-[Kategori]-[Seq]
    const expectedPrefix = buildAssetPrefix(
      park.cluster.complex.name,
      park.cluster.name,
      park.name,
      category.name
    );
    expect(asset1.code).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d{3}$/);
    expect(asset1.code.startsWith(`${expectedPrefix}-`)).toBe(true);

    const asset2 = await createAsset(actor, {
      name: `Lampu Sorot LED Otomatis 2 (${timestamp})`,
      parkId: park.id,
      categoryId: category.id,
    });

    const seq1 = parseInt(asset1.code.split("-").pop()!, 10);
    const seq2 = parseInt(asset2.code.split("-").pop()!, 10);
    expect(seq2).toBe(seq1 + 1);
  });
});
