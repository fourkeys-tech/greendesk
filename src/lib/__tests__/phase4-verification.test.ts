import { describe, expect, it } from "vitest";
import { queryOne } from "../db";
import type { UserRow } from "../db-types";
import { submitCitizenReport } from "../services/phase3-reporting";
import {
  markReportAsInvalid,
  mergeDuplicateReport,
  verifyReportAsValid,
} from "../services/phase4-verification";

describe("Fase 4 – Verifikasi Pengelola (Valid & Prioritas, Tidak Valid, Gabung Laporan)", () => {
  it("memastikan hanya Pengelola dari cluster terkait yang dapat memverifikasi laporan", async () => {
    const pengelolaBgv = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["pengelola.bgv@greenpark.id"]
    );
    const company = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Company" WHERE "code" = $1`,
      ["THN"]
    );
    if (!pengelolaBgv || !company) throw new Error("Seed Fase 4 tidak ditemukan");

    // Buat pelapor baru untuk mengirim laporan di Cluster Edelweiss (AST-EDW-001)
    const pelapor = await queryOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
       RETURNING *`,
      [company.id, "Pelapor Edelweiss", `pelapor.edw.${Date.now()}@greenpark.id`]
    );
    if (!pelapor) throw new Error("Gagal membuat pelapor Edelweiss");

    const reportEdelweiss = await submitCitizenReport(
      {
        id: pelapor.id,
        name: pelapor.name,
        email: pelapor.email,
        role: pelapor.role,
        companyId: pelapor.companyId,
        companyName: null,
        staffClusterId: null,
      },
      {
        assetCode: "AST-EDW-001",
        channel: "QR",
        description: "Tiang lampu jalur jogging Edelweiss goyang.",
        photoUrls: ["/uploads/reports/edw.jpg"],
      }
    );

    // Pengelola Bougenville TIDAK boleh memverifikasi laporan di Cluster Edelweiss
    await expect(
      verifyReportAsValid(
        {
          id: pengelolaBgv.id,
          name: pengelolaBgv.name,
          email: pengelolaBgv.email,
          role: pengelolaBgv.role,
          companyId: pengelolaBgv.companyId,
          companyName: null,
          staffClusterId: pengelolaBgv.staffClusterId,
        },
        {
          reportId: reportEdelweiss.id,
          priority: "TINGGI",
        }
      )
    ).rejects.toThrow(/Akses ditolak: Laporan ini berada di Cluster Edelweiss/);
  });

  it("memproses laporan Valid (+Prioritas), Tidak Valid (wajib alasan), dan Gabung Laporan Ganda beserta rekam jejak pelapor", async () => {
    const pengelolaBgv = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["pengelola.bgv@greenpark.id"]
    );
    const company = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Company" WHERE "code" = $1`,
      ["THN"]
    );
    if (!pengelolaBgv || !company) throw new Error("Seed Fase 4 tidak ditemukan");

    const pelapor = await queryOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
       RETURNING *`,
      [company.id, "Pelapor Uji Fase 4", `pelapor.fase4.${Date.now()}@greenpark.id`]
    );
    if (!pelapor) throw new Error("Gagal membuat pelapor fase 4");

    const pelaporActor = {
      id: pelapor.id,
      name: pelapor.name,
      email: pelapor.email,
      role: pelapor.role,
      companyId: pelapor.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const pengelolaActor = {
      id: pengelolaBgv.id,
      name: pengelolaBgv.name,
      email: pengelolaBgv.email,
      role: pengelolaBgv.role,
      companyId: pengelolaBgv.companyId,
      companyName: null,
      staffClusterId: pengelolaBgv.staffClusterId,
    };

    // Buat 3 laporan BARU di Cluster Bougenville (AST-BGV-001)
    const repInduk = await submitCitizenReport(pelaporActor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: "Lampu solar taman Bougenville pecah kacanya.",
      photoUrls: ["/uploads/reports/induk.jpg"],
    });

    const repDuplikat = await submitCitizenReport(pelaporActor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: "Kaca lampu solar pecah di sudut utara.",
      photoUrls: ["/uploads/reports/duplikat.jpg"],
    });

    const repTidakValid = await submitCitizenReport(pelaporActor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: "Foto gelap tidak terlihat apa-apa.",
      photoUrls: ["/uploads/reports/gelap.jpg"],
    });

    // 1. Verifikasi Valid + Prioritas TINGGI pada repInduk
    const validResult = await verifyReportAsValid(pengelolaActor, {
      reportId: repInduk.id,
      priority: "TINGGI",
      note: "Segera ganti kaca lampu",
    });
    expect(validResult.status).toBe("MENUNGGU_KEPUTUSAN");
    expect(validResult.priority).toBe("TINGGI");

    // 2. Gabungkan repDuplikat ke repInduk
    const mergedResult = await mergeDuplicateReport(pengelolaActor, {
      childReportId: repDuplikat.id,
      parentReportId: repInduk.id,
    });
    expect(mergedResult.status).toBe("DIGABUNG");
    expect(mergedResult.parentReportId).toBe(repInduk.id);

    // 3. Tandai repTidakValid tanpa alasan -> harus ditolak
    await expect(
      markReportAsInvalid(pengelolaActor, {
        reportId: repTidakValid.id,
        reason: "   ",
      })
    ).rejects.toThrow(/Alasan wajib diisi/);

    // Tandai repTidakValid dengan alasan
    const invalidResult = await markReportAsInvalid(pengelolaActor, {
      reportId: repTidakValid.id,
      reason: "Foto tidak menampilkan aset taman yang dimaksud.",
    });
    expect(invalidResult.status).toBe("TIDAK_VALID");

    // Cek rekam jejak laporan valid (2: 1 valid + 1 digabung) & tidak valid (1) pada akun pelapor
    const updatedPelapor = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1`,
      [pelapor.id]
    );
    expect(updatedPelapor?.validReportCount).toBe(2);
    expect(updatedPelapor?.invalidReportCount).toBe(1);
  });
});
