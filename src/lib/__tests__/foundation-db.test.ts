import { describe, expect, it } from "vitest";
import { execute, queryCount, queryOne } from "../db";
import type { UserRow } from "../db-types";
import {
  getScopedReportsForUser,
  updateAssetMasterData,
} from "../services/foundation";

describe("Fase 0 – Pengujian Integrasi Database & Layanan Fondasi", () => {
  it("menolak penghapusan permanen laporan (Report) via trigger imutabilitas PostgreSQL", async () => {
    const existingReport = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Report" WHERE "archivedAt" IS NULL LIMIT 1`
    );
    if (!existingReport) throw new Error("Report seed tidak ditemukan");

    await expect(
      execute(`DELETE FROM "Report" WHERE "id" = $1`, [existingReport.id])
    ).rejects.toThrow(/Report tidak boleh dihapus permanen/);
  });

  it("menolak perubahan atau penghapusan Riwayat Perubahan Data (AuditLog) via trigger imutabilitas PostgreSQL", async () => {
    const existingAudit = await queryOne<{ id: string }>(
      `SELECT "id" FROM "AuditLog" LIMIT 1`
    );
    if (!existingAudit) throw new Error("AuditLog seed tidak ditemukan");

    await expect(
      execute(`DELETE FROM "AuditLog" WHERE "id" = $1`, [existingAudit.id])
    ).rejects.toThrow(/AuditLog bersifat immutable/);
    await expect(
      execute(
        `UPDATE "AuditLog" SET "summary" = 'Manipulasi' WHERE "id" = $1`,
        [existingAudit.id]
      )
    ).rejects.toThrow(/AuditLog bersifat immutable/);
  });

  it("mencatat nilai lama & baru ke AuditLog saat Admin mengubah data master aset", async () => {
    const admin = await queryOne<UserRow & { companyName: string | null }>(
      `SELECT u.*, c."name" AS "companyName"
       FROM "User" u
       LEFT JOIN "Company" c ON c."id" = u."companyId"
       WHERE u."email" = $1`,
      ["admin@greenpark.id"]
    );
    if (!admin) throw new Error("Admin seed tidak ditemukan");

    const asset = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Asset" WHERE "code" = $1`,
      ["AST-BGV-001"]
    );
    if (!asset) throw new Error("Asset AST-BGV-001 tidak ditemukan");

    const beforeCount = await queryCount(
      `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "entityName" = 'Asset' AND "entityId" = $1`,
      [asset.id]
    );

    await updateAssetMasterData(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId,
        companyName: admin.companyName,
        staffClusterId: admin.staffClusterId,
      },
      asset.id,
      {
        locationNote: "Sudut Utara Gazebo Bougenville (Terverifikasi Fase 0)",
      }
    );

    const afterCount = await queryCount(
      `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "entityName" = 'Asset' AND "entityId" = $1`,
      [asset.id]
    );

    expect(afterCount).toBe(beforeCount + 1);
  });

  it("menyembunyikan identitas pelapor dari query Teknisi & memisahkan data antar Cluster/Perusahaan", async () => {
    const teknisi = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["teknisi.budi@vendorjaya.id"]
    );
    if (!teknisi) throw new Error("Teknisi seed tidak ditemukan");

    const techReports = await getScopedReportsForUser({
      id: teknisi.id,
      name: teknisi.name,
      email: teknisi.email,
      role: teknisi.role,
      companyId: teknisi.companyId,
      companyName: null,
      staffClusterId: null,
    });

    expect(techReports.length).toBeGreaterThan(0);
    // Pastikan field reporter tidak pernah ada di objek hasil query Teknisi
    expect("reporter" in techReports[0]).toBe(false);

    // Pengelola Bougenville hanya melihat laporan di Cluster Bougenville (bukan Edelweiss)
    const pengelola = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["pengelola.bgv@greenpark.id"]
    );
    if (!pengelola) throw new Error("Pengelola seed tidak ditemukan");

    const pengelolaReports = await getScopedReportsForUser({
      id: pengelola.id,
      name: pengelola.name,
      email: pengelola.email,
      role: pengelola.role,
      companyId: pengelola.companyId,
      companyName: null,
      staffClusterId: pengelola.staffClusterId,
    });
    expect(
      pengelolaReports.every(
        (r) => r.asset.park.cluster.name === "Cluster Bougenville"
      )
    ).toBe(true);

    // Admin Perusahaan B tidak boleh melihat laporan Perusahaan A
    const adminB = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@griyaasri.id"]
    );
    if (!adminB) throw new Error("Admin Perusahaan B tidak ditemukan");

    const companyBReports = await getScopedReportsForUser({
      id: adminB.id,
      name: adminB.name,
      email: adminB.email,
      role: adminB.role,
      companyId: adminB.companyId,
      companyName: null,
      staffClusterId: null,
    });
    // Test lain (hardening-p0-p1) membuat laporan Perusahaan B; invarian yang diuji adalah
    // TIDAK ADA laporan Perusahaan A (lintas perusahaan) yang bocor ke Admin B.
    const companyBReportIds = companyBReports.map((r) => r.id);
    const leakedCount =
      companyBReportIds.length === 0
        ? 0
        : await queryCount(
            `SELECT COUNT(*)::int AS count FROM "Report"
             WHERE "id" = ANY($1::text[]) AND "companyId" <> $2`,
            [companyBReportIds, adminB.companyId]
          );
    expect(leakedCount).toBe(0);
  });
});

