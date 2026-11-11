import { execute, pool, query, queryOne, withTransaction, type DbClient } from "../db";
import type { Priority, ReportRow, ReportStatus } from "../db-types";
import {
  assertPermission,
  TERMINAL_REPORT_STATUSES,
  validateStatusTransition,
} from "../permissions";
import {
  enqueueReportStatusEmail,
  enqueueReportStatusEmailWithMergedChildren,
} from "../email";
import { transitionReport } from "../report-transition";
import { activeAssignmentSql } from "../scopes";
import type { SessionUser } from "../auth";

interface AuthorizedStaffReport extends ReportRow {
  assetName: string;
  assetCode: string;
  clusterId: string;
  clusterName: string;
  reporterEmail: string;
  reporterName: string;
}

/**
 * Memastikan hanya Pengelola dari cluster tempat aset berada yang dapat memverifikasi laporan.
 */
async function getAndAuthorizeClusterReportForStaff(
  actor: SessionUser,
  reportId: string,
  db: DbClient = pool
): Promise<AuthorizedStaffReport> {
  assertPermission(actor.role, "VERIFY_AND_PRIORITIZE");

  if (!actor.companyId || !actor.staffClusterId) {
    throw new Error(
      "Akun Pengelola Anda belum ditautkan ke cluster mana pun."
    );
  }

  const report = await queryOne<AuthorizedStaffReport>(
    `SELECT
       r.*,
       a."name" AS "assetName",
       a."code" AS "assetCode",
       p."clusterId" AS "clusterId",
       cl."name" AS "clusterName",
       u."email" AS "reporterEmail",
       u."name" AS "reporterName"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     JOIN "User" u ON u."id" = r."reporterId"
     WHERE r."id" = $1 AND r."companyId" = $2 AND r."archivedAt" IS NULL`,
    [reportId, actor.companyId],
    db
  );

  if (!report) {
    throw new Error("Laporan tidak ditemukan.");
  }

  // Kriteria Penerimaan Fase 4: Hanya pengelola cluster terkait yang dapat memverifikasi
  if (report.clusterId !== actor.staffClusterId) {
    throw new Error(
      `Akses ditolak: Laporan ini berada di ${report.clusterName}, sedangkan Anda hanya bertugas di cluster Anda sendiri.`
    );
  }

  return report;
}

/**
 * 1. Pengelola menyatakan laporan VALID, menetapkan Prioritas (TINGGI / NORMAL / RENDAH),
 * lalu meneruskan ke Manager (status -> MENUNGGU_KEPUTUSAN).
 * Dalam satu transaksi:
 * - Transisi berguard status (dua pengelola bersamaan → satu lolos).
 * - validReportCount pelapor +1.
 * - Email VALID_MENUNGGU_KEPUTUSAN ke pelapor induk + semua pelapor anak yang digabung (outbox).
 * - Notifikasi Web ke Manager yang membawahi cluster tersebut.
 */
export async function verifyReportAsValid(
  actor: SessionUser,
  input: {
    reportId: string;
    priority: Priority;
    note?: string;
  }
) {
  const report = await getAndAuthorizeClusterReportForStaff(
    actor,
    input.reportId
  );

  const check = validateStatusTransition(
    report.status,
    "MENUNGGU_KEPUTUSAN",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const now = new Date();
  const managerRows = await query<{ userId: string }>(
    `SELECT DISTINCT cma."userId"
     FROM "ClusterManagerAssignment" cma
     JOIN "User" u ON u."id" = cma."userId"
     WHERE cma."clusterId" = $1
       AND ${activeAssignmentSql("cma", "$2")}
       AND u."isActive" = true`,
    [report.clusterId, now]
  );
  const uniqueManagerIds = managerRows.map((m) => m.userId);

  return withTransaction(async (tx) => {
    await transitionReport(tx, {
      reportId: report.id,
      from: report.status,
      to: "MENUNGGU_KEPUTUSAN",
      actor: { id: actor.id, role: actor.role },
      data: { priority: input.priority },
      note:
        input.note?.trim() ||
        `Diverifikasi Valid oleh Pengelola dengan prioritas ${input.priority}`,
    });

    // Tambah rekam jejak laporan valid pada akun pelapor (Kriteria Penerimaan Fase 4)
    await execute(
      `UPDATE "User" SET "validReportCount" = "validReportCount" + 1, "updatedAt" = NOW() WHERE "id" = $1`,
      [report.reporterId],
      tx
    );

    // Email ke pelapor induk + fan-out ke pelapor anak yang digabung (§7 Verifikasi 4)
    await enqueueReportStatusEmailWithMergedChildren(tx, {
      reportId: report.id,
      triggerType: "VALID_MENUNGGU_KEPUTUSAN",
    });

    // Beri tahu Manager yang ditautkan ke cluster ini via Notifikasi Web (Bagian 9 PRD)
    if (uniqueManagerIds.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, uid, $2, $3, $4 FROM unnest($5::text[]) AS uid`,
        [
          report.companyId,
          `Laporan Valid Menunggu Keputusan (${report.ticketNo})`,
          `Pengelola meneruskan laporan ${report.ticketNo} (${report.assetName}) dengan prioritas ${input.priority}.`,
          "/dashboard/laporan",
          uniqueManagerIds,
        ],
        tx
      );
    }

    const updated = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [report.id],
      tx
    );
    if (!updated) throw new Error("Laporan tidak ditemukan.");
    return updated;
  });
}

/**
 * 2. Pengelola menandai laporan TIDAK_VALID dengan alasan wajib.
 * - Status akhir: TIDAK_VALID.
 * - invalidReportCount pelapor +1.
 * - Email TIDAK_VALID beserta alasan ke pelapor induk + pelapor anak yang digabung.
 */
export async function markReportAsInvalid(
  actor: SessionUser,
  input: {
    reportId: string;
    reason: string;
  }
) {
  const report = await getAndAuthorizeClusterReportForStaff(
    actor,
    input.reportId
  );

  const reason = input.reason.trim();
  const check = validateStatusTransition(
    report.status,
    "TIDAK_VALID",
    actor.role,
    reason
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  return withTransaction(async (tx) => {
    await transitionReport(tx, {
      reportId: report.id,
      from: report.status,
      to: "TIDAK_VALID",
      actor: { id: actor.id, role: actor.role },
      data: { reason },
      reason,
      note: `Dinyatakan Tidak Valid: ${reason}`,
    });

    // Tambah rekam jejak laporan tidak valid pada akun pelapor (Kriteria Penerimaan Fase 4)
    await execute(
      `UPDATE "User" SET "invalidReportCount" = "invalidReportCount" + 1, "updatedAt" = NOW() WHERE "id" = $1`,
      [report.reporterId],
      tx
    );

    await enqueueReportStatusEmailWithMergedChildren(tx, {
      reportId: report.id,
      triggerType: "TIDAK_VALID",
      reason,
    });

    const updated = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [report.id],
      tx
    );
    if (!updated) throw new Error("Laporan tidak ditemukan.");
    return updated;
  });
}

/**
 * 3. Pengelola menggabungkan laporan ganda untuk aset yang sama ke laporan induk (status -> DIGABUNG).
 * - Induk: aset sama, perusahaan sama, bukan dirinya sendiri, belum diarsip, dan status NON-terminal.
 * - Cucu (laporan yang sebelumnya digabung ke anak) ikut dipindah ke induk baru — tidak ada yang yatim.
 * - validReportCount pelapor anak +1 (laporan nyata, hanya duplikat).
 * - Email DIGABUNG ke pelapor anak dengan tautan status tiket anak + nomor tiket induk.
 */
export async function mergeDuplicateReport(
  actor: SessionUser,
  input: {
    childReportId: string;
    parentReportId: string;
  }
) {
  if (input.childReportId === input.parentReportId) {
    throw new Error("Laporan tidak dapat digabung ke dirinya sendiri.");
  }

  const childReport = await getAndAuthorizeClusterReportForStaff(
    actor,
    input.childReportId
  );

  const check = validateStatusTransition(
    childReport.status,
    "DIGABUNG",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const parentReport = await queryOne<{
    id: string;
    ticketNo: string;
    status: ReportStatus;
    parentReportId: string | null;
  }>(
    `SELECT "id", "ticketNo", "status", "parentReportId"
     FROM "Report"
     WHERE "id" = $1
       AND "companyId" = $2
       AND "assetId" = $3
       AND "archivedAt" IS NULL`,
    [input.parentReportId, childReport.companyId, childReport.assetId]
  );

  if (!parentReport) {
    throw new Error(
      "Laporan induk harus berasal dari aset yang sama di perusahaan ini."
    );
  }

  if (
    TERMINAL_REPORT_STATUSES.includes(parentReport.status) ||
    parentReport.parentReportId
  ) {
    throw new Error(
      "Laporan induk yang dipilih tidak aktif untuk penggabungan (sudah selesai/ditolak/dibatalkan/digabung)."
    );
  }

  return withTransaction(async (tx) => {
    await transitionReport(tx, {
      reportId: childReport.id,
      from: childReport.status,
      to: "DIGABUNG",
      actor: { id: actor.id, role: actor.role },
      data: {
        parentReportId: parentReport.id,
        reason: `Digabung ke laporan induk ${parentReport.ticketNo}`,
      },
      note: `Digabungkan oleh Pengelola ke laporan induk ${parentReport.ticketNo}`,
    });

    // Cucu ikut pindah ke induk baru (P1-D)
    await execute(
      `UPDATE "Report"
       SET "parentReportId" = $2, "updatedAt" = NOW()
       WHERE "parentReportId" = $1 AND "archivedAt" IS NULL`,
      [childReport.id, parentReport.id],
      tx
    );

    // Tambah rekam jejak valid karena laporan memang nyata (hanya duplikat)
    await execute(
      `UPDATE "User" SET "validReportCount" = "validReportCount" + 1, "updatedAt" = NOW() WHERE "id" = $1`,
      [childReport.reporterId],
      tx
    );

    await enqueueReportStatusEmail(tx, {
      companyId: childReport.companyId,
      toEmail: childReport.reporterEmail,
      reporterName: childReport.reporterName,
      ticketNo: childReport.ticketNo,
      statusToken: childReport.statusToken,
      assetName: `${childReport.assetName} (${childReport.assetCode})`,
      triggerType: "DIGABUNG",
      parentTicketNo: parentReport.ticketNo,
    });

    const updated = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [childReport.id],
      tx
    );
    if (!updated) throw new Error("Laporan tidak ditemukan.");
    return updated;
  });
}
