import { describe, expect, it } from "vitest";
import { query, queryOne } from "../db";
import type {
  AssetRow,
  TechnicianRow,
  UserRow,
  VendorRow,
} from "../db-types";
import { submitCitizenReport } from "../services/phase3-reporting";
import { verifyReportAsValid } from "../services/phase4-verification";
import {
  decideManagerReport,
  getPendingManagerReports,
} from "../services/phase5-decision";
import {
  assignTechnicianToWorkOrder,
  confirmWorkResultByManager,
  replaceTechnicianForWorkOrder,
  submitWorkResultByTechnician,
} from "../services/phase6-execution";
import {
  decideVendorReplacementByManager,
  forwardVendorReplacementByAdmin,
  getVendorReportCard,
  markVendorReplacementViewedByOwner,
  submitVendorReplacementRequest,
} from "../services/vendor-replacement";
import type { SessionUser } from "../auth";

async function mustOne<T extends object>(
  sql: string,
  params: unknown[],
  label: string
): Promise<T> {
  const row = await queryOne<T>(sql, params);
  if (!row) throw new Error(`Record tidak ditemukan: ${label}`);
  return row;
}

describe("Fase 5, 6 & Bagian 7 PRD v0.2 – Keputusan Manager, SPK, Konfirmasi Hasil & Pengajuan Ganti Vendor", () => {
  it(
    "menjalankan siklus lengkap Keputusan Manager (Tolak & Setuju+SPK), Eksekusi Teknisi, Revisi, Selesai, serta Rapor Vendor",
    async () => {
    const [pengelolaUser, managerUser, picUser, teknisiUser, adminUser] =
      await Promise.all([
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["pengelola.bgv@greenpark.id"],
          "pengelolaUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["manager@greenpark.id"],
          "managerUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["pic@vendorjaya.id"],
          "picUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["teknisi.budi@vendorjaya.id"],
          "teknisiUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["admin@greenpark.id"],
          "adminUser"
        ),
      ]);

    const assetBgv = await mustOne<AssetRow>(
      `SELECT * FROM "Asset" WHERE "code" = $1`,
      ["AST-BGV-001"],
      "assetBgv"
    );

    const vendorJaya = await mustOne<VendorRow>(
      `SELECT * FROM "Vendor" WHERE "picUserId" = $1 LIMIT 1`,
      [picUser.id],
      "vendorJaya"
    );

    const techProfile = await mustOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "userId" = $1`,
      [teknisiUser.id],
      "techProfile"
    );

    const pengelolaActor: SessionUser = {
      id: pengelolaUser.id,
      name: pengelolaUser.name,
      email: pengelolaUser.email,
      role: "PENGELOLA",
      companyId: pengelolaUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: pengelolaUser.staffClusterId,
    };

    const managerActor: SessionUser = {
      id: managerUser.id,
      name: managerUser.name,
      email: managerUser.email,
      role: "MANAGER",
      companyId: managerUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    const picActor: SessionUser = {
      id: picUser.id,
      name: picUser.name,
      email: picUser.email,
      role: "PIC_VENDOR",
      companyId: picUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    const teknisiActor: SessionUser = {
      id: teknisiUser.id,
      name: teknisiUser.name,
      email: teknisiUser.email,
      role: "TEKNISI",
      companyId: teknisiUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    const suffix = Date.now();

    const pelapor = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
       RETURNING *`,
      [adminUser.companyId, "Warga Penguji Fase 5", `warga.f5.${suffix}@greenpark.id`],
      "pelapor"
    );

    const pelaporActor: SessionUser = {
      id: pelapor.id,
      name: pelapor.name,
      email: pelapor.email,
      role: "PENGGUNA",
      companyId: pelapor.companyId,
      companyName: null,
      staffClusterId: null,
    };

    // 1. Buat 2 laporan baru dari warga pada AST-BGV-001
    const rep1 = await submitCitizenReport(pelaporActor, {
      assetCode: assetBgv.code,
      channel: "QR",
      description: `Kerusakan tiang lampu #1 (${suffix})`,
      photoUrls: ["/uploads/f5-1.jpg"],
    });

    const rep2 = await submitCitizenReport(pelaporActor, {
      assetCode: assetBgv.code,
      channel: "QR",
      description: `Kerusakan kabel lampu #2 (${suffix})`,
      photoUrls: ["/uploads/f5-2.jpg"],
    });

    // 2. Pengelola memverifikasi keduanya Valid (rep1: RENDAH, rep2: TINGGI)
    await verifyReportAsValid(pengelolaActor, {
      reportId: rep1.id,
      priority: "RENDAH",
    });

    await verifyReportAsValid(pengelolaActor, {
      reportId: rep2.id,
      priority: "TINGGI",
    });

    // 3. Antrean Manager harus mengurutkan prioritas TINGGI (rep2) di atas RENDAH (rep1)
    const queue = await getPendingManagerReports(managerActor);
    const idxRep2 = queue.findIndex((q) => q.id === rep2.id);
    const idxRep1 = queue.findIndex((q) => q.id === rep1.id);
    expect(idxRep2).toBeGreaterThanOrEqual(0);
    expect(idxRep1).toBeGreaterThan(idxRep2);

    // 4. Manager menolak rep1: tanpa alasan harus gagal, dengan alasan harus berhasil -> DITOLAK
    await expect(
      decideManagerReport(managerActor, {
        reportId: rep1.id,
        decision: "TOLAK",
        rejectionReason: "   ",
      })
    ).rejects.toThrow(/wajib mencantumkan alasan/i);

    const rejectedRes = await decideManagerReport(managerActor, {
      reportId: rep1.id,
      decision: "TOLAK",
      rejectionReason: "Menunggu anggaran kuartal depan.",
    });
    expect(rejectedRes.status).toBe("DITOLAK");

    // 5. Manager menyetujui rep2 & menerbitkan SPK ke Vendor Jaya (Wajib lampiran file SPK per Keputusan 14)
    await expect(
      decideManagerReport(managerActor, {
        reportId: rep2.id,
        decision: "SETUJU",
        spkInput: {
          vendorId: vendorJaya.id,
          notes: "Tanpa file SPK harus ditolak.",
        },
      })
    ).rejects.toThrow(/File Surat Perintah Kerja \(SPK\) wajib dilampirkan/i);

    const approvedRes = await decideManagerReport(managerActor, {
      reportId: rep2.id,
      decision: "SETUJU",
      spkInput: {
        vendorId: vendorJaya.id,
        notes: "Ganti rangkaian LED utama.",
        spkFileUrl: "/uploads/spk/sample-spk.pdf",
        spkFileName: "Surat_Perintah_Kerja_001.pdf",
      },
    });
    expect(approvedRes.status).toBe("DISETUJUI");
    expect(approvedRes.spkNo).toMatch(/^SPK-\d{6}-\d{4}$/);
    expect(approvedRes.workOrder?.technicianId).toBeNull();
    expect(approvedRes.workOrder?.spkFileUrl).toBe("/uploads/spk/sample-spk.pdf");

    const woId = approvedRes.workOrder!.id;

    // 6. PIC Vendor menugaskan Teknisi Budi -> status menjadi DIKERJAKAN
    const assignRes = await assignTechnicianToWorkOrder(picActor, {
      workOrderId: woId,
      technicianId: techProfile.id,
    });
    expect(assignRes.report.status).toBe("DIKERJAKAN");

    // 7. Teknisi mengunggah foto sebelum & sesudah -> status menjadi MENUNGGU_KONFIRMASI
    const submitRes1 = await submitWorkResultByTechnician(teknisiActor, {
      workOrderId: woId,
      beforePhotoUrls: ["/uploads/before-1.jpg"],
      afterPhotoUrls: ["/uploads/after-1.jpg"],
      notes: "Sudah diperbaiki tahap pertama.",
    });
    expect(submitRes1.report.status).toBe("MENUNGGU_KONFIRMASI");

    // 8. Manager mengecek hasil: Belum Sesuai tanpa catatan ditolak; dengan catatan -> kembali ke DIKERJAKAN
    await expect(
      confirmWorkResultByManager(managerActor, {
        workOrderId: woId,
        decision: "BELUM_SESUAI",
        revisionNote: "",
      })
    ).rejects.toThrow(/wajib menyertakan catatan perbaikan ulang/i);

    const revRes = await confirmWorkResultByManager(managerActor, {
      workOrderId: woId,
      decision: "BELUM_SESUAI",
      revisionNote: "Tutup pelindung lampu belum rapat.",
    });
    expect(revRes.report.status).toBe("DIKERJAKAN");

    // 8b. PIC Vendor mengganti teknisi pelaksana saat SPK berjalan (Keputusan 4 & 5)
    const suffix2 = Date.now().toString().slice(-4);
    const userTech2 = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "updatedAt")
       VALUES ($1, $2, $3, 'TEKNISI'::"Role", NOW())
       RETURNING *`,
      [
        adminUser.companyId!,
        `Teknisi Pengganti ${suffix2}`,
        `pengganti.${suffix2}@vendorjaya.id`,
      ],
      "userTech2"
    );
    const tech2 = await mustOne<TechnicianRow>(
      `INSERT INTO "Technician" (
         "companyId", "vendorId", "userId", "fullName", "whatsapp", "email",
         "skills", "status", "approvalStatus", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], 'ACTIVE'::"TechnicianStatus", 'APPROVED'::"ApprovalStatus", NOW())
       RETURNING *`,
      [
        adminUser.companyId!,
        vendorJaya.id,
        userTech2.id,
        `Teknisi Pengganti ${suffix2}`,
        "081233445566",
        `pengganti.${suffix2}@vendorjaya.id`,
        ["Lampu", "Kelistrikan"],
      ],
      "tech2"
    );

    const replaceRes = await replaceTechnicianForWorkOrder(picActor, {
      workOrderId: woId,
      newTechnicianId: tech2.id,
      reason: "Teknisi Budi dialihkan ke pekerjaan darurat.",
    });
    expect(replaceRes.workOrder.technicianId).toBe(tech2.id);

    const tech2Actor: SessionUser = {
      id: userTech2.id,
      name: userTech2.name,
      email: userTech2.email,
      role: "TEKNISI",
      companyId: userTech2.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    // 9. Teknisi baru melanjutkan pengerjaan: Foto sebelum yang lama tetap melekat, unggah foto sesudah baru -> MENUNGGU_KONFIRMASI
    await submitWorkResultByTechnician(tech2Actor, {
      workOrderId: woId,
      beforePhotoUrls: [], // Foto sebelum lama tetap tersimpan dan dipakai
      afterPhotoUrls: ["/uploads/after-2.jpg"],
      notes: "Tutup pelindung sudah dirapatkan oleh teknisi pengganti.",
    });

    // 10. Manager mengonfirmasi SESUAI -> status SELESAI & SPK ditutup
    const finalConfirm = await confirmWorkResultByManager(managerActor, {
      workOrderId: woId,
      decision: "SESUAI",
    });
    expect(finalConfirm.report.status).toBe("SELESAI");
    expect(finalConfirm.workOrder?.completedAt).not.toBeNull();

    // 11. Cek Rapor Vendor (MGR-M7)
    const scorecard = await getVendorReportCard(
      adminUser.companyId!,
      vendorJaya.id
    );
    expect(scorecard.metrics.totalJobs).toBeGreaterThanOrEqual(1);
    expect(scorecard.metrics.revisionCount).toBeGreaterThanOrEqual(1);
  }, 30000);

  it(
    "menjalankan alur Pengajuan Ganti Vendor (Bagian 7 PRD v0.2): Pengelola -> Manager -> Admin -> Owner",
    async () => {
    const [pengelolaUser, managerUser, adminUser, ownerUser, picUser] =
      await Promise.all([
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["pengelola.bgv@greenpark.id"],
          "pengelolaUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["manager@greenpark.id"],
          "managerUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["admin@greenpark.id"],
          "adminUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["owner@greenpark.id"],
          "ownerUser"
        ),
        mustOne<UserRow>(
          `SELECT * FROM "User" WHERE "email" = $1`,
          ["pic@vendorjaya.id"],
          "picUser"
        ),
      ]);

    const assetBgv = await mustOne<AssetRow>(
      `SELECT * FROM "Asset" WHERE "code" = $1`,
      ["AST-BGV-001"],
      "assetBgv"
    );

    const vendorJaya = await mustOne<VendorRow>(
      `SELECT * FROM "Vendor" WHERE "picUserId" = $1 LIMIT 1`,
      [picUser.id],
      "vendorJaya"
    );

    const pengelolaActor: SessionUser = {
      id: pengelolaUser.id,
      name: pengelolaUser.name,
      email: pengelolaUser.email,
      role: "PENGELOLA",
      companyId: pengelolaUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: pengelolaUser.staffClusterId,
    };

    const managerActor: SessionUser = {
      id: managerUser.id,
      name: managerUser.name,
      email: managerUser.email,
      role: "MANAGER",
      companyId: managerUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    const adminActor: SessionUser = {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: "ADMIN",
      companyId: adminUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    const ownerActor: SessionUser = {
      id: ownerUser.id,
      name: ownerUser.name,
      email: ownerUser.email,
      role: "OWNER",
      companyId: ownerUser.companyId,
      companyName: "PT GreenPark",
      staffClusterId: null,
    };

    // Ambil 2 laporan pada AST-BGV-001 sebagai bukti kerusakan berulang
    const assetReports = await query<{ id: string }>(
      `SELECT "id" FROM "Report"
       WHERE "assetId" = $1
         AND "archivedAt" IS NULL
         AND "status" NOT IN ('DIBATALKAN', 'TIDAK_VALID', 'DIGABUNG')
       LIMIT 2`,
      [assetBgv.id]
    );
    expect(assetReports.length).toBeGreaterThanOrEqual(2);

    // 1. Menolak jika kurang dari 2 laporan bukti
    await expect(
      submitVendorReplacementRequest(pengelolaActor, {
        assetId: assetBgv.id,
        vendorId: vendorJaya.id,
        basisReportIds: [assetReports[0].id],
        reason: "Rusak terus",
      })
    ).rejects.toThrow(/minimal 2 laporan berulang/i);

    // 2. Pengelola mengajukan pergantian vendor dengan 2 laporan bukti -> DIAJUKAN
    const submitReq = await submitVendorReplacementRequest(pengelolaActor, {
      assetId: assetBgv.id,
      vendorId: vendorJaya.id,
      basisReportIds: assetReports.map((r) => r.id),
      reason: "Unit lampu rusak kembali 2x setelah diperbaiki vendor yang sama.",
    });
    expect(submitReq.request.status).toBe("DIAJUKAN");
    expect(submitReq.request.requestNo).toMatch(/^PGV-\d{6}-\d{4}$/);

    // 3. Manager menyetujui pengajuan -> DISETUJUI (menunggu Admin)
    const mgrDecide = await decideVendorReplacementByManager(managerActor, {
      requestId: submitReq.request.id,
      decision: "SETUJU",
      decisionNote: "Disetujui untuk dievaluasi ganti vendor.",
    });
    expect(mgrDecide.request.status).toBe("DISETUJUI");

    // 4. Admin meneruskan ke Owner -> DITERUSKAN_KE_OWNER
    const admForward = await forwardVendorReplacementByAdmin(adminActor, {
      requestId: submitReq.request.id,
      forwardNote: "Diteruskan kepada Direksi untuk peninjauan kontrak vendor.",
    });
    expect(admForward.request.status).toBe("DITERUSKAN_KE_OWNER");

    // 5. Owner melihat eskalasi -> ownerViewedAt terisi
    const ownerViewed = await markVendorReplacementViewedByOwner(
      ownerActor,
      submitReq.request.id
    );
    expect(ownerViewed.ownerViewedAt).not.toBeNull();
  }, 30000);
});
