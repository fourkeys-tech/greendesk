import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  ReportRow,
  ReportStatus,
  TechnicianRow,
  VendorRow,
  WorkOrderRow,
  WorkPhotoRow,
} from "../db-types";
import { assertPermission, validateStatusTransition } from "../permissions";
import { enqueueReportStatusEmailWithMergedChildren } from "../email";
import { recordAuditLog } from "../audit";
import { transitionReport } from "../report-transition";
import { activeAssignmentSql } from "../scopes";
import { getManagerAssignedClusterIds } from "./phase5-decision";
import type { SessionUser } from "../auth";

/**
 * 1. PIC Vendor menugaskan Teknisi pelaksana pada SPK yang berstatus DISETUJUI.
 * - Mengubah status laporan: DISETUJUI -> DIKERJAKAN (guard status, atomik)
 * - Email DIKERJAKAN ke pelapor induk + pelapor anak yang digabung (outbox, dalam transaksi)
 */
export async function assignTechnicianToWorkOrder(
  actor: SessionUser,
  input: {
    workOrderId: string;
    technicianId: string;
  }
) {
  assertPermission(actor.role, "ASSIGN_TECHNICIAN");

  // Cari vendor milik PIC
  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1 AND "isActive" = true`,
    [actor.id]
  );

  if (!vendor) {
    throw new Error("Akun Anda tidak terdaftar sebagai PIC Vendor aktif.");
  }

  const workOrder = await queryOne<
    WorkOrderRow & {
      reportStatus: ReportStatus;
      assetName: string;
    }
  >(
    `SELECT
       wo.*,
       r."status" AS "reportStatus",
       a."name" AS "assetName"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     JOIN "Asset" a ON a."id" = r."assetId"
     WHERE wo."id" = $1 AND wo."vendorId" = $2 AND r."archivedAt" IS NULL`,
    [input.workOrderId, vendor.id]
  );

  if (!workOrder) {
    throw new Error("Surat Perintah Kerja (SPK) tidak ditemukan untuk vendor Anda.");
  }

  // Teknisi harus milik vendor ini, berstatus ACTIVE dan disetujui (APPROVED)
  const technician = await queryOne<TechnicianRow>(
    `SELECT *
     FROM "Technician"
     WHERE "id" = $1
       AND "vendorId" = $2
       AND "status" = 'ACTIVE'::"TechnicianStatus"
       AND "approvalStatus" = 'APPROVED'::"ApprovalStatus"`,
    [input.technicianId, vendor.id]
  );

  if (!technician) {
    throw new Error(
      "Teknisi tidak valid, tidak aktif, atau belum disetujui oleh Admin."
    );
  }

  const check = validateStatusTransition(
    workOrder.reportStatus,
    "DIKERJAKAN",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const now = new Date();
  const result = await withTransaction(async (tx) => {
    // 1. Transisi status Laporan ke DIKERJAKAN (guard status)
    await transitionReport(tx, {
      reportId: workOrder.reportId,
      from: workOrder.reportStatus,
      to: "DIKERJAKAN",
      actor: { id: actor.id, role: actor.role },
      note: `Teknisi ${technician.fullName} ditugaskan oleh PIC Vendor ${vendor.name}`,
    });

    // 2. Update WorkOrder
    const updatedWo = await queryOne<WorkOrderRow>(
      `UPDATE "WorkOrder"
       SET "technicianId" = $2, "assignedAt" = $3, "updatedAt" = $3
       WHERE "id" = $1
       RETURNING *`,
      [workOrder.id, technician.id, now],
      tx
    );
    if (!updatedWo) throw new Error("SPK tidak ditemukan.");

    await execute(
      `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = $2 WHERE "id" = $1`,
      [technician.id, now],
      tx
    );

    // 3. Notifikasi Web ke Teknisi
    await execute(
      `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actor.companyId ?? vendor.companyId,
        technician.userId,
        `Tugas Baru: ${workOrder.spkNo}`,
        `Anda ditugaskan oleh PIC untuk perbaikan aset ${workOrder.assetName}.`,
        "/dashboard/laporan",
      ],
      tx
    );

    // 4. Riwayat audit
    await recordAuditLog(
      {
        companyId: actor.companyId,
        actor,
        entityName: "WorkOrder",
        entityId: workOrder.id,
        action: "UPDATE",
        summary: `PIC ${actor.name} menunjuk teknisi ${technician.fullName} untuk ${workOrder.spkNo}`,
        oldValues: {
          reportStatus: workOrder.reportStatus,
          technicianId: workOrder.technicianId,
        },
        newValues: {
          reportStatus: "DIKERJAKAN",
          technicianId: technician.id,
          technicianName: technician.fullName,
        },
      },
      tx
    );

    // 5. Email ke pelapor (identitas teknisi tidak dibagikan demi privasi)
    await enqueueReportStatusEmailWithMergedChildren(tx, {
      reportId: workOrder.reportId,
      triggerType: "DIKERJAKAN",
    });

    const updatedRep = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [workOrder.reportId],
      tx
    );
    if (!updatedRep) throw new Error("Laporan tidak ditemukan.");
    return { workOrder: updatedWo, report: updatedRep };
  });

  return { success: true, workOrder: result.workOrder, report: result.report };
}

/**
 * 1b. PIC Vendor mengganti teknisi pelaksana pada SPK yang sedang berjalan (DIKERJAKAN atau revisi).
 * - Foto sebelum yang sudah diunggah tetap melekat pada SPK (PRD v0.2 Keputusan 4 & 5).
 * - Tidak ada email ke pelapor (PRD Bagian 7.2).
 * - Notifikasi web dikirim ke teknisi baru.
 */
export async function replaceTechnicianForWorkOrder(
  actor: SessionUser,
  input: {
    workOrderId: string;
    newTechnicianId: string;
    reason?: string;
  }
) {
  assertPermission(actor.role, "ASSIGN_TECHNICIAN");

  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1 AND "isActive" = true`,
    [actor.id]
  );

  if (!vendor) {
    throw new Error("Akun Anda tidak terdaftar sebagai PIC Vendor aktif.");
  }

  const workOrder = await queryOne<
    WorkOrderRow & {
      oldTechFullName: string | null;
      reportStatus: ReportStatus;
      assetName: string;
    }
  >(
    `SELECT
       wo.*,
       t."fullName" AS "oldTechFullName",
       r."status" AS "reportStatus",
       a."name" AS "assetName"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     JOIN "Asset" a ON a."id" = r."assetId"
     LEFT JOIN "Technician" t ON t."id" = wo."technicianId"
     WHERE wo."id" = $1 AND wo."vendorId" = $2 AND r."archivedAt" IS NULL`,
    [input.workOrderId, vendor.id]
  );

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan untuk vendor Anda.");
  }

  // Pergantian hanya masuk akal saat SPK masih berjalan
  if (!["DISETUJUI", "DIKERJAKAN", "MENUNGGU_KONFIRMASI"].includes(workOrder.reportStatus)) {
    throw new Error(
      `SPK berstatus ${workOrder.reportStatus} tidak dapat diganti teknisinya.`
    );
  }

  // Teknisi baru harus aktif dan disetujui Admin (PRD 3.3)
  const newTechnician = await queryOne<TechnicianRow>(
    `SELECT *
     FROM "Technician"
     WHERE "id" = $1
       AND "vendorId" = $2
       AND "status" = 'ACTIVE'::"TechnicianStatus"
       AND "approvalStatus" = 'APPROVED'::"ApprovalStatus"`,
    [input.newTechnicianId, vendor.id]
  );

  if (!newTechnician) {
    throw new Error(
      "Teknisi pengganti tidak valid, tidak aktif, atau belum disetujui oleh Admin."
    );
  }

  if (workOrder.technicianId === newTechnician.id) {
    throw new Error("Teknisi yang dipilih sama dengan teknisi yang saat ini ditugaskan.");
  }

  const oldTechName = workOrder.oldTechFullName || "Belum ada teknisi";
  const now = new Date();

  const result = await withTransaction(async (tx) => {
    // 1. Update WorkOrder ke teknisi baru — guard: teknisi lama masih sama (anti double-replace)
    const updatedCount = await execute(
      `UPDATE "WorkOrder"
       SET "technicianId" = $3, "assignedAt" = $4, "updatedAt" = $4
       WHERE "id" = $1 AND "technicianId" IS NOT DISTINCT FROM $2`,
      [workOrder.id, workOrder.technicianId, newTechnician.id, now],
      tx
    );
    if (updatedCount !== 1) {
      throw new Error("Penugasan teknisi sudah berubah, muat ulang halaman.");
    }

    await execute(
      `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = $2 WHERE "id" = $1`,
      [newTechnician.id, now],
      tx
    );

    // 2. Tambah catatan log pergantian teknisi
    await execute(
      `INSERT INTO "ReportStatusLog" ("reportId", "fromStatus", "toStatus", "changedById", "note")
       VALUES ($1, $2::"ReportStatus", $2::"ReportStatus", $3, $4)`,
      [
        workOrder.reportId,
        workOrder.reportStatus,
        actor.id,
        `PIC Vendor mengganti teknisi dari ${oldTechName} ke ${newTechnician.fullName}.${
          input.reason ? ` Alasan: ${input.reason}` : ""
        } Foto sebelum yang ada tetap melekat pada SPK.`,
      ],
      tx
    );

    // 3. Notifikasi Web ke Teknisi baru
    await execute(
      `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actor.companyId ?? vendor.companyId,
        newTechnician.userId,
        `Penugasan SPK Pengganti (${workOrder.spkNo})`,
        `Anda ditugaskan oleh PIC menggantikan ${oldTechName} untuk perbaikan aset ${workOrder.assetName}.`,
        "/dashboard/laporan",
      ],
      tx
    );

    // 4. AuditLog
    await recordAuditLog(
      {
        companyId: actor.companyId,
        actor,
        entityName: "WorkOrder",
        entityId: workOrder.id,
        action: "UPDATE",
        summary: `PIC ${actor.name} mengganti teknisi ${oldTechName} ke ${newTechnician.fullName} untuk ${workOrder.spkNo}`,
        oldValues: { technicianId: workOrder.technicianId, technicianName: oldTechName },
        newValues: {
          technicianId: newTechnician.id,
          technicianName: newTechnician.fullName,
          reason: input.reason || null,
        },
      },
      tx
    );

    const updatedWo = await queryOne<WorkOrderRow>(
      `SELECT * FROM "WorkOrder" WHERE "id" = $1`,
      [workOrder.id],
      tx
    );
    if (!updatedWo) throw new Error("SPK tidak ditemukan.");
    return updatedWo;
  });

  return { success: true, workOrder: result };
}

/**
 * 2. Teknisi menyelesaikan pekerjaan dan mengunggah foto SEBELUM & SESUDAH perbaikan.
 * - Mengubah status laporan: DIKERJAKAN -> MENUNGGU_KONFIRMASI (guard status)
 * - Mencatat `WorkOrder.submittedAt` (dasar durasi di rapor vendor)
 * - Mengirim Notifikasi Web ke Manager cluster
 */
export async function submitWorkResultByTechnician(
  actor: SessionUser,
  input: {
    workOrderId: string;
    beforePhotoUrls: string[];
    afterPhotoUrls: string[];
    notes?: string;
  }
) {
  assertPermission(actor.role, "SUBMIT_WORK_RESULT");

  const technician = await queryOne<TechnicianRow>(
    `SELECT * FROM "Technician" WHERE "userId" = $1`,
    [actor.id]
  );

  if (!technician) {
    throw new Error("Profil teknisi Anda tidak ditemukan.");
  }

  const workOrder = await queryOne<
    WorkOrderRow & {
      reportStatus: ReportStatus;
      assetName: string;
      clusterId: string;
    }
  >(
    `SELECT
       wo.*,
       r."status" AS "reportStatus",
       a."name" AS "assetName",
       p."clusterId" AS "clusterId"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     WHERE wo."id" = $1 AND wo."technicianId" = $2 AND r."archivedAt" IS NULL`,
    [input.workOrderId, technician.id]
  );

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan atau bukan ditugaskan kepada Anda.");
  }

  const check = validateStatusTransition(
    workOrder.reportStatus,
    "MENUNGGU_KONFIRMASI",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const beforeUrls = (input.beforePhotoUrls || []).filter((u) => u && u.trim());
  const afterUrls = (input.afterPhotoUrls || []).filter((u) => u && u.trim());
  const clusterId = workOrder.clusterId;
  const now = new Date();

  const result = await withTransaction(async (tx) => {
    // PRD 4.3 & Keputusan 6: Foto sebelum dan sesudah wajib ada sebelum Lapor Selesai.
    // Bila perbaikan ulang atau sudah ada foto sebelum yang tersimpan, foto sebelum sebelumnya tetap dipertahankan.
    const existingBeforeCount = await queryCount(
      `SELECT COUNT(*)::int AS count
       FROM "WorkPhoto"
       WHERE "workOrderId" = $1 AND "type" = 'BEFORE'::"WorkPhotoType"`,
      [workOrder.id],
      tx
    );
    const totalBefore = existingBeforeCount + beforeUrls.length;
    const totalAfter = afterUrls.length;

    if (totalBefore === 0 || totalAfter === 0) {
      throw new Error(
        "Foto sebelum (before) dan foto sesudah (after) perbaikan wajib dilampirkan sebelum lapor selesai."
      );
    }

    // 1. Transisi status laporan ke MENUNGGU_KONFIRMASI (guard status)
    await transitionReport(tx, {
      reportId: workOrder.reportId,
      from: workOrder.reportStatus,
      to: "MENUNGGU_KONFIRMASI",
      actor: { id: actor.id, role: actor.role },
      note:
        input.notes?.trim() ||
        `Teknisi ${technician.fullName} telah merampungkan perbaikan dan mengunggah foto sebelum/sesudah.`,
    });

    // 2. Update lastActiveAt teknisi & submittedAt SPK
    await execute(
      `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = $2 WHERE "id" = $1`,
      [technician.id, now],
      tx
    );
    await execute(
      `UPDATE "WorkOrder" SET "submittedAt" = $2, "updatedAt" = $2 WHERE "id" = $1`,
      [workOrder.id, now],
      tx
    );

    // 3. Simpan foto-foto pekerjaan (batch insert)
    if (beforeUrls.length > 0) {
      await execute(
        `INSERT INTO "WorkPhoto" ("workOrderId", "type", "url", "uploadedById")
         SELECT $1, 'BEFORE'::"WorkPhotoType", u, $2 FROM unnest($3::text[]) AS u`,
        [workOrder.id, actor.id, beforeUrls],
        tx
      );
    }
    if (afterUrls.length > 0) {
      await execute(
        `INSERT INTO "WorkPhoto" ("workOrderId", "type", "url", "uploadedById")
         SELECT $1, 'AFTER'::"WorkPhotoType", u, $2 FROM unnest($3::text[]) AS u`,
        [workOrder.id, actor.id, afterUrls],
        tx
      );
    }

    // 4. Notifikasi Web ke seluruh Manager yang bertugas di cluster ini
    const managerRows = await query<{ userId: string }>(
      `SELECT DISTINCT cma."userId"
       FROM "ClusterManagerAssignment" cma
       JOIN "User" u ON u."id" = cma."userId"
       WHERE cma."clusterId" = $1
         AND ${activeAssignmentSql("cma", "$2")}
         AND u."isActive" = true`,
      [clusterId, now],
      tx
    );
    const uniqueManagerIds = managerRows.map((ma) => ma.userId);

    if (uniqueManagerIds.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, uid, $2, $3, $4 FROM unnest($5::text[]) AS uid`,
        [
          actor.companyId!,
          `Hasil Perbaikan Menunggu Konfirmasi (${workOrder.spkNo})`,
          `Teknisi ${technician.fullName} telah menyelesaikan perbaikan pada aset ${workOrder.assetName}. Silakan tinjau foto sebelum dan sesudah.`,
          "/dashboard/laporan",
          uniqueManagerIds,
        ],
        tx
      );
    }

    // 5. Riwayat audit
    await recordAuditLog(
      {
        companyId: actor.companyId,
        actor,
        entityName: "WorkOrder",
        entityId: workOrder.id,
        action: "UPDATE",
        summary: `Teknisi ${technician.fullName} mengunggah hasil kerja untuk ${workOrder.spkNo}`,
        oldValues: { reportStatus: workOrder.reportStatus },
        newValues: {
          reportStatus: "MENUNGGU_KONFIRMASI",
          beforeCount: beforeUrls.length,
          afterCount: afterUrls.length,
        },
      },
      tx
    );

    const updatedRep = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [workOrder.reportId],
      tx
    );
    if (!updatedRep) throw new Error("Laporan tidak ditemukan.");
    return { report: updatedRep };
  });

  return { success: true, report: result.report };
}

/**
 * 3. MGR-M4: Konfirmasi Hasil Perbaikan oleh Manager
 * Memeriksa foto sebelum dan sesudah berdampingan.
 * - Jika SESUAI:
 *   - Status laporan -> SELESAI
 *   - SPK ditutup (completedAt, confirmedAt terisi)
 *   - Email dikirim ke pelapor dengan melampirkan foto hasil akhir
 * - Jika BELUM SESUAI:
 *   - Wajib menyertakan catatan perbaikan ulang (RevisionNote)
 *   - Status laporan kembali ke DIKERJAKAN
 *   - Notifikasi web dikirim ke Teknisi pelaksana
 */
export async function confirmWorkResultByManager(
  actor: SessionUser,
  input: {
    workOrderId: string;
    decision: "SESUAI" | "BELUM_SESUAI";
    revisionNote?: string;
  }
) {
  assertPermission(actor.role, "CONFIRM_COMPLETION");
  if (!actor.companyId) {
    throw new Error("Akun Manager harus terhubung ke perusahaan.");
  }
  const companyId = actor.companyId;

  const clusterIds = await getManagerAssignedClusterIds(actor.id);

  const workOrder = await queryOne<
    WorkOrderRow & {
      reportStatus: ReportStatus;
      reportTicketNo: string;
      assetName: string;
      clusterId: string;
      clusterName: string;
      technicianUserId: string | null;
    }
  >(
    `SELECT
       wo.*,
       r."status" AS "reportStatus",
       r."ticketNo" AS "reportTicketNo",
       a."name" AS "assetName",
       p."clusterId" AS "clusterId",
       cl."name" AS "clusterName",
       t."userId" AS "technicianUserId"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     LEFT JOIN "Technician" t ON t."id" = wo."technicianId"
     WHERE wo."id" = $1 AND wo."companyId" = $2 AND r."archivedAt" IS NULL`,
    [input.workOrderId, companyId]
  );

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan.");
  }

  if (!clusterIds.includes(workOrder.clusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki wewenang pada cluster ${workOrder.clusterName}.`
    );
  }

  if (workOrder.reportStatus !== "MENUNGGU_KONFIRMASI") {
    throw new Error(
      `Laporan berstatus ${workOrder.reportStatus}. Hanya laporan Menunggu Konfirmasi yang dapat ditinjau hasil kerjanya.`
    );
  }

  const photos = await query<WorkPhotoRow>(
    `SELECT * FROM "WorkPhoto" WHERE "workOrderId" = $1`,
    [workOrder.id]
  );

  // Aturan Bisnis 5.7 no 3: Foto sebelum dan sesudah wajib ada sebelum konfirmasi
  const beforePhotos = photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = photos.filter((p) => p.type === "AFTER");
  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    throw new Error(
      "Pemeriksaan foto tidak lengkap: Foto sebelum dan sesudah wajib ada sebelum konfirmasi."
    );
  }

  // 1. Cabang BELUM SESUAI (Revisi Pekerjaan)
  if (input.decision === "BELUM_SESUAI") {
    const revisionNote = input.revisionNote?.trim();
    if (!revisionNote) {
      throw new Error(
        "Konfirmasi Belum Sesuai wajib menyertakan catatan perbaikan ulang."
      );
    }

    const check = validateStatusTransition(
      workOrder.reportStatus,
      "DIKERJAKAN",
      actor.role,
      revisionNote
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const result = await withTransaction(async (tx) => {
      // 1. Kembalikan status ke DIKERJAKAN (guard status)
      await transitionReport(tx, {
        reportId: workOrder.reportId,
        from: "MENUNGGU_KONFIRMASI",
        to: "DIKERJAKAN",
        actor: { id: actor.id, role: actor.role },
        reason: revisionNote,
        note: `Manager menyatakan hasil belum sesuai. Catatan perbaikan: ${revisionNote}`,
      });

      // 2. Tambah RevisionNote & reset submittedAt (pekerjaan dibuka kembali)
      await execute(
        `INSERT INTO "RevisionNote" ("workOrderId", "note", "createdById")
         VALUES ($1, $2, $3)`,
        [workOrder.id, revisionNote, actor.id],
        tx
      );
      await execute(
        `UPDATE "WorkOrder" SET "submittedAt" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
        [workOrder.id],
        tx
      );

      // 3. Notifikasi Web ke Teknisi
      if (workOrder.technicianUserId) {
        await execute(
          `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            companyId,
            workOrder.technicianUserId,
            `Perbaikan Perlu Revisi (${workOrder.spkNo})`,
            `Manager ${actor.name} meminta perbaikan ulang untuk ${workOrder.assetName}. Catatan: ${revisionNote}`,
            "/dashboard/laporan",
          ],
          tx
        );
      }

      // 4. AuditLog
      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "WorkOrder",
          entityId: workOrder.id,
          action: "UPDATE",
          summary: `Manager ${actor.name} mengembalikan ${workOrder.spkNo} untuk perbaikan ulang. Catatan: ${revisionNote}`,
          oldValues: { status: "MENUNGGU_KONFIRMASI" },
          newValues: { status: "DIKERJAKAN", revisionNote },
        },
        tx
      );

      const updatedRep = await queryOne<ReportRow>(
        `SELECT * FROM "Report" WHERE "id" = $1`,
        [workOrder.reportId],
        tx
      );
      if (!updatedRep) throw new Error("Laporan tidak ditemukan.");
      return updatedRep;
    });

    return {
      success: true,
      decision: "BELUM_SESUAI",
      report: result,
    };
  }

  // 2. Cabang SESUAI (Selesai Akhir)
  if (input.decision === "SESUAI") {
    const check = validateStatusTransition(
      workOrder.reportStatus,
      "SELESAI",
      actor.role
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const now = new Date();
    const afterPhotoUrls = afterPhotos.map((p) => p.url);

    const result = await withTransaction(async (tx) => {
      // 1. Ubah status laporan ke SELESAI (guard status)
      await transitionReport(tx, {
        reportId: workOrder.reportId,
        from: "MENUNGGU_KONFIRMASI",
        to: "SELESAI",
        actor: { id: actor.id, role: actor.role },
        note: `Manager ${actor.name} telah mengonfirmasi bahwa hasil perbaikan telah sesuai.`,
      });

      // 2. Tutup WorkOrder
      const updatedWo = await queryOne<WorkOrderRow>(
        `UPDATE "WorkOrder"
         SET "completedAt" = $2,
             "confirmedAt" = $2,
             "submittedAt" = COALESCE("submittedAt", $2),
             "updatedAt" = $2
         WHERE "id" = $1
         RETURNING *`,
        [workOrder.id, now],
        tx
      );
      if (!updatedWo) throw new Error("SPK tidak ditemukan.");

      // 3. Riwayat audit
      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "Report",
          entityId: workOrder.reportId,
          action: "UPDATE",
          summary: `Manager ${actor.name} mengonfirmasi penyelesaian perbaikan tiket ${workOrder.reportTicketNo} (${workOrder.spkNo})`,
          oldValues: { status: "MENUNGGU_KONFIRMASI" },
          newValues: { status: "SELESAI" },
        },
        tx
      );

      // 4. Email SELESAI ke pelapor utama & semua pelapor yang laporannya digabung,
      //    lengkap dengan foto hasil (AFTER) — outbox
      await enqueueReportStatusEmailWithMergedChildren(tx, {
        reportId: workOrder.reportId,
        triggerType: "SELESAI",
        afterPhotoUrls,
      });

      const updatedRep = await queryOne<ReportRow>(
        `SELECT * FROM "Report" WHERE "id" = $1`,
        [workOrder.reportId],
        tx
      );
      if (!updatedRep) throw new Error("Laporan tidak ditemukan.");
      return { workOrder: updatedWo, report: updatedRep };
    });

    return {
      success: true,
      decision: "SESUAI",
      workOrder: result.workOrder,
      report: result.report,
    };
  }

  throw new Error("Keputusan tidak valid. Pilih SESUAI atau BELUM_SESUAI.");
}
