import { describe, expect, it } from "vitest";
import { queryOne } from "../db";
import type { EmailLogRow, UserRow } from "../db-types";
import {
  cancelOwnReportByUser,
  submitCitizenReport,
} from "../services/phase3-reporting";

describe("Fase 3 – Autentikasi Pengguna & Pelaporan Kerusakan (MVP Inti)", () => {
  it("menolak laporan tanpa foto atau tanpa deskripsi", async () => {
    const warga = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["warga@greenpark.id"]
    );
    if (!warga) throw new Error("Warga seed tidak ditemukan");
    const actor = {
      id: warga.id,
      name: warga.name,
      email: warga.email,
      role: warga.role,
      companyId: warga.companyId,
      companyName: null,
      staffClusterId: null,
    };

    await expect(
      submitCitizenReport(actor, {
        assetCode: "AST-BGV-001",
        channel: "QR",
        description: "Lampu taman pecah",
        photoUrls: [],
      })
    ).rejects.toThrow(/minimal satu foto/);

    await expect(
      submitCitizenReport(actor, {
        assetCode: "AST-BGV-001",
        channel: "QR",
        description: "abc",
        photoUrls: ["/uploads/reports/sample.jpg"],
      })
    ).rejects.toThrow(/Deskripsi singkat/);
  });

  it("membuat laporan berstatus BARU, nomor tiket unik, mengirim email diterima, serta mengizinkan pembatalan saat BARU", async () => {
    // Buat pengguna baru agar kuota harian segar
    const uniqueEmail = `pelapor.fase3.${Date.now()}@greenpark.id`;
    const company = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Company" WHERE "code" = $1`,
      ["THN"]
    );
    if (!company) throw new Error("Company THN tidak ditemukan");

    const pelapor = await queryOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "loginMethod", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'GOOGLE', NOW(), NOW())
       RETURNING *`,
      [company.id, "Pelapor Uji Fase 3", uniqueEmail]
    );
    if (!pelapor) throw new Error("Gagal membuat pelapor uji fase 3");

    const actor = {
      id: pelapor.id,
      name: pelapor.name,
      email: pelapor.email,
      role: pelapor.role,
      companyId: pelapor.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const report = await submitCitizenReport(actor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: "Tiang lampu taman miring setelah hujan deras.",
      photoUrls: ["/uploads/reports/test-qr.jpg"],
    });

    expect(report.status).toBe("BARU");
    expect(report.ticketNo).toMatch(/^TKT-\d{6}-\d{4}/);

    // Pastikan email LAPORAN_TERKIRIM tercatat
    const receivedEmail = await queryOne<EmailLogRow>(
      `SELECT * FROM "EmailLog"
       WHERE "toEmail" = $1 AND "ticketNo" = $2 AND "triggerType" = 'LAPORAN_TERKIRIM'
       LIMIT 1`,
      [uniqueEmail, report.ticketNo]
    );
    expect(receivedEmail).not.toBeNull();

    // Batalkan laporan saat masih BARU
    const cancelled = await cancelOwnReportByUser(actor, report.id);
    expect(cancelled.status).toBe("DIBATALKAN");

    // Pastikan email DIBATALKAN tercatat
    const cancelEmail = await queryOne<EmailLogRow>(
      `SELECT * FROM "EmailLog"
       WHERE "toEmail" = $1 AND "ticketNo" = $2 AND "triggerType" = 'DIBATALKAN'
       LIMIT 1`,
      [uniqueEmail, report.ticketNo]
    );
    expect(cancelEmail).not.toBeNull();

    // Tidak bisa membatalkan lagi karena sudah bukan BARU
    await expect(cancelOwnReportByUser(actor, report.id)).rejects.toThrow(
      /hanya dapat dibatalkan selama statusnya masih BARU/
    );
  });
});

