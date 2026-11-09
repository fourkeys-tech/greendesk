import { describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import { generateAssetQrDataUrl } from "../qr";
import { buildAssetPrefix, abbreviateEntity } from "../asset-code";
import {
  assignTemporaryManager,
  createAsset,
  createCategory,
  createInternalStaffAccount,
} from "../services/phase1-master";

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

  it("memastikan akun Pengelola hanya bisa ditautkan tepat ke 1 cluster, sedangkan Manager bisa multi-cluster & menunjuk pengganti sementara", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const clusters = await prisma.cluster.findMany({
      where: { companyId: admin.companyId! },
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

    // Buat Manager ke-2 untuk menguji penunjukan Manager Pengganti Sementara
    const secondManagerEmail = "manager.pengganti@greenpark.id";
    let secondManager = await prisma.user.findUnique({
      where: { email: secondManagerEmail },
    });
    if (!secondManager) {
      secondManager = await createInternalStaffAccount(actor, {
        name: "Rizky Pratama (Manager Cadangan)",
        email: secondManagerEmail,
        role: "MANAGER",
        clusterIds: [clusters[1].id],
      });
    }

    const primaryManager = await prisma.user.findUniqueOrThrow({
      where: { email: "manager@greenpark.id" },
    });

    const assignment = await assignTemporaryManager(actor, {
      substituteManagerId: secondManager.id,
      replacedManagerId: primaryManager.id,
      clusterId: clusters[0].id,
      validFrom: new Date("2026-11-08"),
      validUntil: new Date("2026-11-20"),
    });

    expect(assignment.isTemporary).toBe(true);
    expect(assignment.replacedManagerId).toBe(primaryManager.id);

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

