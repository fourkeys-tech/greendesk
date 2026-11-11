import type { Priority, ReportStatus, Role } from "./db-types";
import { execute, type TxClient } from "./db";
import { validateStatusTransition } from "./permissions";

export const STALE_REPORT_STATUS_MESSAGE =
  "Status laporan sudah berubah, muat ulang halaman.";

export interface TransitionReportExtraData {
  priority?: Priority | null;
  reason?: string | null;
  parentReportId?: string | null;
  underWarrantyOfVendorId?: string | null;
}

/**
 * Transisi status laporan dengan optimistic guard.
 *
 * 1. Validasi aturan transisi (role + alasan wajib) — `validateStatusTransition`.
 * 2. UPDATE dengan `WHERE "id" = $1 AND "status" = $2 AND "archivedAt" IS NULL`.
 *    Bila baris sudah berubah status oleh request lain, rowCount = 0 dan transisi dibatalkan.
 * 3. Menulis ReportStatusLog.
 *
 * WAJIB dipanggil di dalam `withTransaction(async (tx) => ...)`, bersama efek samping
 * lain (counter pelapor, audit, outbox email, notifikasi) agar semuanya atomik.
 */
export async function transitionReport(
  tx: TxClient,
  params: {
    reportId: string;
    from: ReportStatus;
    to: ReportStatus;
    actor: { id: string; role: Role };
    /** Kolom tambahan yang ikut diubah (priority, reason, parentReportId, ...). */
    data?: TransitionReportExtraData;
    note?: string | null;
    reason?: string | null;
  }
) {
  const { reportId, from, to, actor, data, note, reason } = params;

  const check = validateStatusTransition(from, to, actor.role, reason);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const now = new Date();
  const paramsList: unknown[] = [reportId, from, to, now];
  const sets: string[] = [
    `"status" = $3::"ReportStatus"`,
    `"stageEnteredAt" = $4`,
    `"updatedAt" = $4`,
  ];

  if (data) {
    if (data.priority !== undefined) {
      paramsList.push(data.priority);
      sets.push(`"priority" = $${paramsList.length}::"Priority"`);
    }
    if (data.reason !== undefined) {
      paramsList.push(data.reason);
      sets.push(`"reason" = $${paramsList.length}`);
    }
    if (data.parentReportId !== undefined) {
      paramsList.push(data.parentReportId);
      sets.push(`"parentReportId" = $${paramsList.length}`);
    }
    if (data.underWarrantyOfVendorId !== undefined) {
      paramsList.push(data.underWarrantyOfVendorId);
      sets.push(`"underWarrantyOfVendorId" = $${paramsList.length}`);
    }
  }

  const updatedRows = await execute(
    `UPDATE "Report"
     SET ${sets.join(", ")}
     WHERE "id" = $1 AND "status" = $2::"ReportStatus" AND "archivedAt" IS NULL`,
    paramsList,
    tx
  );

  if (updatedRows !== 1) {
    throw new Error(STALE_REPORT_STATUS_MESSAGE);
  }

  await execute(
    `INSERT INTO "ReportStatusLog" ("reportId", "fromStatus", "toStatus", "changedById", "note")
     VALUES ($1, $2::"ReportStatus", $3::"ReportStatus", $4, $5)`,
    [reportId, from, to, actor.id, note ?? null],
    tx
  );

  return { reportId, from, to, changedAt: now };
}
