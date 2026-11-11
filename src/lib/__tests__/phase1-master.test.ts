import { describe, expect, it } from "vitest";
import { query, queryCount, queryOne } from "../db";
import type {
  AssetRow,
  AuditLogRow,
  CategoryRow,
  ClusterManagerAssignmentRow,
  ClusterRow,
  ParkRow,
  UserRow,
} from "../db-types";
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

async function mustOne<T extends object>(
  sql: string,
  params: unknown[],
  label: string
): Promise<T> {
  const row = await queryOne<T>(sql, params);
  if (!row) throw new Error(`Record tidak ditemukan: ${label}`);
  return row;
}

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
    const adminB = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@griyaasri.id"],
      "adminB"
    );
    const parkCompanyA = await mustOne<ParkRow>(
      `SELECT * FROM "Park" WHERE "name" = $1 LIMIT 1`,
      ["Taman Utama Bougenville"],
      "parkCompanyA"
    );
    const catCompanyA = await mustOne<CategoryRow>(
      `SELECT * FROM "Category" WHERE "name" = $1 LIMIT 1`,
      ["Penerangan & Lampu Taman"],
      "catCompanyA"
    );

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
    const admin = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "admin"
    );
    const clusters = await query<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "companyId" = $1 ORDER BY "createdAt" ASC, "id" ASC`,
      [admin.companyId!]
    );
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

    const primaryManager = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager@greenpark.id"],
      "primaryManager"
    );
    const primaryPerm = await mustOne<ClusterManagerAssignmentRow>(
      `SELECT * FROM "ClusterManagerAssignment" WHERE "userId" = $1 AND "isTemporary" = false LIMIT 1`,
      [primaryManager.id],
      "primaryPerm"
    );
    const targetClusterId = primaryPerm.clusterId;
    const otherCluster = clusters.find((c) => c.id !== targetClusterId)!;
    expect(otherCluster).toBeDefined();

    // Bersihkan delegasi sementara aktif sisa run sebelumnya yang gagal di tengah jalan,
    // agar pemeriksaan tumpang-tindih tidak menolak skenario ini.
    await query(
      `UPDATE "ClusterManagerAssignment"
       SET "cancelledAt" = NOW(), "cancelledById" = $3, "validUntil" = NOW()
       WHERE "clusterId" = $1
         AND "isTemporary" = true
         AND "cancelledAt" IS NULL
         AND "replacedManagerId" = $2`,
      [targetClusterId, primaryManager.id, admin.id]
    );

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
      const historyRows = await query<ClusterManagerAssignmentRow>(
        `SELECT * FROM "ClusterManagerAssignment"
         WHERE "userId" = $1 AND "clusterId" = $2 AND "isTemporary" = true
         ORDER BY "createdAt" ASC`,
        [secondManager.id, targetClusterId]
      );
      expect(historyRows.length).toBe(2);
      expect(historyRows[0].cancelledAt).not.toBeNull();
      expect(historyRows[1].cancelledAt).toBeNull();
    } finally {
      await cancelTemporaryManagerAssignment(actor, assignment2.id);
    }

    // Pastikan kategori baru tercatat di AuditLog
    const catCountBefore = await queryCount(
      `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "companyId" = $1 AND "entityName" = 'Category'`,
      [admin.companyId!]
    );
    const uniqueCatName = `Fasilitas Olahraga Taman (${Date.now().toString().slice(-4)})`;
    await createCategory(actor, {
      name: uniqueCatName,
      damageTypes: ["Alat macet", "Besi patah"],
    });
    const catCountAfter = await queryCount(
      `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "companyId" = $1 AND "entityName" = 'Category'`,
      [admin.companyId!]
    );
    expect(catCountAfter).toBe(catCountBefore + 1);
  });

  it("mengizinkan Admin memblokir dan membuka blokir pelapor dengan catatan audit", async () => {
    const admin = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "admin"
    );
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
    const citizen = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "loginMethod", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'GOOGLE', NOW())
       RETURNING *`,
      [admin.companyId!, `Warga Uji Blokir ${suffix}`, `warga.blokir.${suffix}@greenpark.id`],
      "citizen"
    );

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

    const blockLog = await queryOne<AuditLogRow>(
      `SELECT * FROM "AuditLog"
       WHERE "companyId" = $1 AND "entityName" = 'User' AND "entityId" = $2 AND "action" = 'BLOCK'::"AuditAction"
       LIMIT 1`,
      [admin.companyId!, citizen.id]
    );
    expect(blockLog).not.toBeNull();

    const unblocked = await setUserBlockStatus(actor, citizen.id, false);
    expect(unblocked.isBlocked).toBe(false);
    expect(unblocked.blockedReason).toBeNull();

    const unblockLog = await queryOne<AuditLogRow>(
      `SELECT * FROM "AuditLog"
       WHERE "companyId" = $1 AND "entityName" = 'User' AND "entityId" = $2 AND "action" = 'UNBLOCK'::"AuditAction"
       LIMIT 1`,
      [admin.companyId!, citizen.id]
    );
    expect(unblockLog).not.toBeNull();
  });

  it("menolak pelaporan aset jika induk wilayah (Taman) sedang dinonaktifkan", async () => {
    const admin = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "admin"
    );
    const actor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const asset = await mustOne<AssetRow & { parkId: string }>(
      `SELECT * FROM "Asset" WHERE "companyId" = $1 AND "code" = $2 LIMIT 1`,
      [admin.companyId!, "AST-BGV-001"],
      "asset"
    );

    const suffix = Date.now().toString().slice(-6);
    const citizen = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "loginMethod", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'GOOGLE', NOW())
       RETURNING *`,
      [admin.companyId!, `Warga Uji Wilayah ${suffix}`, `warga.wilayah.${suffix}@greenpark.id`],
      "citizen wilayah"
    );
    const citizenActor = {
      id: citizen.id,
      name: citizen.name,
      email: citizen.email,
      role: citizen.role,
      companyId: citizen.companyId,
      companyName: null,
      staffClusterId: null,
    };

    await updatePark(actor, asset.parkId, { isActive: false });
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
      await updatePark(actor, asset.parkId, { isActive: true });
    }
  });

  it("menghasilkan kode aset otomatis (5 tingkat) dan nomor urut sekuensial jika input code tidak diisi", async () => {
    const admin = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "admin"
    );
    const park = await mustOne<{
      id: string;
      name: string;
      clusterName: string;
      complexName: string;
    }>(
      `SELECT p."id", p."name", cl."name" AS "clusterName", cx."name" AS "complexName"
       FROM "Park" p
       INNER JOIN "Cluster" cl ON cl."id" = p."clusterId"
       INNER JOIN "Complex" cx ON cx."id" = cl."complexId"
       WHERE p."name" = $1
       LIMIT 1`,
      ["Taman Utama Bougenville"],
      "park"
    );
    const category = await mustOne<CategoryRow>(
      `SELECT * FROM "Category" WHERE "name" = $1 LIMIT 1`,
      ["Penerangan & Lampu Taman"],
      "category"
    );

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
      park.complexName,
      park.clusterName,
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
