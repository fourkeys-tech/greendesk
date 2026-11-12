import { pool, execute, query, queryOne, type DbClient } from "./db";
import type { EmailLogRow } from "./db-types";
import { getMailer } from "./mailer";
import { isSafeLocalUploadUrl } from "./url-safety";
import { getPublicAppBaseUrl } from "./app-url";

export type EmailTriggerType =
  | "OTP_LOGIN"
  | "OTP_REGISTRATION"
  | "VENDOR_INVITE"
  | "ACCOUNT_INVITE"
  | "LAPORAN_TERKIRIM"
  | "TIDAK_VALID"
  | "DIGABUNG"
  | "VALID_MENUNGGU_KEPUTUSAN"
  | "DITOLAK_MANAGER"
  | "DISETUJUI"
  | "DIKERJAKAN"
  | "SELESAI"
  | "DIBATALKAN";

export type ReportEmailTriggerType = Exclude<
  EmailTriggerType,
  "OTP_LOGIN" | "OTP_REGISTRATION" | "VENDOR_INVITE" | "ACCOUNT_INVITE"
>;

export interface EnqueueEmailParams {
  companyId?: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  triggerType: EmailTriggerType;
  ticketNo?: string | null;
}

/** Status baris outbox EmailLog. */
export const EMAIL_STATUS = {
  QUEUED: "QUEUED",
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  DEAD: "DEAD",
} as const;

export const EMAIL_MAX_RETRIES = 5;
/** Backoff percobaan ulang (menit) untuk retryCount ke-1..n. */
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 60];

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getAppBaseUrl(): string {
  return getPublicAppBaseUrl();
}

export function buildStatusUrl(ticketNo: string, statusToken: string): string {
  return `${getAppBaseUrl()}/status/${encodeURIComponent(ticketNo)}?k=${encodeURIComponent(statusToken)}`;
}

function toAbsoluteUrl(url: string): string | null {
  if (!isSafeLocalUploadUrl(url)) return null;
  return `${getAppBaseUrl()}${url.trim()}`;
}

/**
 * Menulis email ke outbox (EmailLog berstatus QUEUED).
 * Teruskan `tx` saat dipanggil di dalam transaksi: bila transaksi di-rollback, email ikut batal
 * — pelapor tidak pernah menerima kabar untuk transisi yang gagal.
 * Pengiriman nyata dilakukan `processEmailOutbox()`.
 */
export async function enqueueEmail(
  db: DbClient,
  params: EnqueueEmailParams
): Promise<EmailLogRow> {
  const { companyId, toEmail, subject, bodyHtml, triggerType, ticketNo } = params;
  const row = await queryOne<EmailLogRow>(
    `INSERT INTO "EmailLog" (
       "companyId", "toEmail", "subject", "bodyHtml", "triggerType",
       "ticketNo", "status", "retryCount", "nextAttemptAt"
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NOW())
     RETURNING *`,
    [
      companyId ?? null,
      toEmail,
      subject,
      bodyHtml,
      triggerType,
      ticketNo ?? null,
      EMAIL_STATUS.QUEUED,
    ],
    db
  );
  if (!row) {
    throw new Error("Gagal memasukkan email ke outbox.");
  }
  return row;
}

export interface ReportStatusEmailInput {
  reporterName: string;
  /** Nomor tiket milik PENERIMA email (untuk laporan anak: tiket anak, bukan induk). */
  ticketNo: string;
  statusToken: string;
  assetName: string;
  triggerType: ReportEmailTriggerType;
  reason?: string | null;
  /** Nomor tiket induk (bila penerima adalah pelapor laporan yang digabung). */
  parentTicketNo?: string | null;
  afterPhotoUrls?: string[];
}

/**
 * Template email status laporan ke pelapor (§10.1).
 * Semua nilai dari pengguna di-escape; tautan cek status absolut dan membawa token.
 */
export function buildReportStatusEmail(input: ReportStatusEmailInput): {
  subject: string;
  bodyHtml: string;
} {
  const name = escapeHtml(input.reporterName);
  const ticket = escapeHtml(input.ticketNo);
  const asset = escapeHtml(input.assetName);
  const reason = escapeHtml(input.reason) || "-";
  const parent = escapeHtml(input.parentTicketNo);
  const statusUrl = buildStatusUrl(input.ticketNo, input.statusToken);

  const templates: Record<ReportEmailTriggerType, { subject: string; message: string }> = {
    LAPORAN_TERKIRIM: {
      subject: `[${input.ticketNo}] Laporan Kerusakan Diterima - ${input.assetName}`,
      message: `Terima kasih ${name}, laporan Anda untuk aset <strong>${asset}</strong> telah kami terima dengan nomor tiket <strong>${ticket}</strong> dan sedang menunggu verifikasi pengelola.`,
    },
    TIDAK_VALID: {
      subject: `[${input.ticketNo}] Laporan Tidak Dapat Dilanjutkan - ${input.assetName}`,
      message: `Halo ${name}, laporan Anda (<strong>${ticket}</strong>) untuk aset <strong>${asset}</strong> tidak dapat dilanjutkan oleh pengelola.<br/><strong>Alasan:</strong> ${reason}`,
    },
    DIGABUNG: {
      subject: `[${input.ticketNo}] Laporan Digabung ke Tiket ${input.parentTicketNo || "Induk"}`,
      message: `Halo ${name}, laporan Anda (<strong>${ticket}</strong>) untuk aset <strong>${asset}</strong> digabung dengan laporan aktif sebelumnya (<strong>${parent || "-"}</strong>). Kabar perkembangan berikutnya akan mengikuti laporan induk tersebut.`,
    },
    VALID_MENUNGGU_KEPUTUSAN: {
      subject: `[${input.ticketNo}] Laporan Terverifikasi - ${input.assetName}`,
      message: `Halo ${name}, laporan Anda (<strong>${ticket}</strong>) untuk aset <strong>${asset}</strong> telah diverifikasi oleh pengelola dan diteruskan ke Manager untuk segera ditindaklanjuti.`,
    },
    DITOLAK_MANAGER: {
      subject: `[${input.ticketNo}] Perbaikan Belum Dapat Dilanjutkan - ${input.assetName}`,
      message: `Halo ${name}, perbaikan untuk laporan <strong>${ticket}</strong> (${asset}) belum dapat dilanjutkan saat ini.<br/><strong>Alasan Manager:</strong> ${reason}`,
    },
    DISETUJUI: {
      subject: `[${input.ticketNo}] Perbaikan Disetujui & Dijadwalkan - ${input.assetName}`,
      message: `Halo ${name}, perbaikan untuk laporan <strong>${ticket}</strong> (${asset}) telah disetujui oleh Manager dan SPK telah diterbitkan ke vendor.`,
    },
    DIKERJAKAN: {
      subject: `[${input.ticketNo}] Teknisi Sedang Menangani Perbaikan - ${input.assetName}`,
      message: `Halo ${name}, teknisi telah ditunjuk dan sedang menangani perbaikan untuk aset <strong>${asset}</strong> (Tiket: <strong>${ticket}</strong>).`,
    },
    SELESAI: {
      subject: `[${input.ticketNo}] Perbaikan Selesai - ${input.assetName}`,
      message: `Halo ${name}, kabar baik! Perbaikan aset <strong>${asset}</strong> (Tiket: <strong>${ticket}</strong>) telah selesai dan dikonfirmasi oleh Manager.${
        input.afterPhotoUrls && input.afterPhotoUrls.length > 0
          ? (() => {
              const safeLinks = input.afterPhotoUrls
                .map((u) => toAbsoluteUrl(u))
                .filter((u): u is string => Boolean(u))
                .map((absUrl) => {
                  const abs = escapeHtml(absUrl);
                  return `<a href="${abs}">${abs}</a>`;
                });
              return safeLinks.length > 0
                ? `<br/>Foto hasil perbaikan:<br/>${safeLinks.join("<br/>")}`
                : "";
            })()
          : ""
      }`,
    },
    DIBATALKAN: {
      subject: `[${input.ticketNo}] Konfirmasi Pembatalan Laporan - ${input.assetName}`,
      message: `Halo ${name}, laporan Anda dengan nomor tiket <strong>${ticket}</strong> (${asset}) telah berhasil dibatalkan sesuai permintaan Anda.`,
    },
  };

  const selected = templates[input.triggerType];
  const parentLine = parent
    ? `<br/><strong>Laporan Induk:</strong> ${parent}`
    : "";
  const bodyHtml = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
      <p>${selected.message}</p>
      <p style="margin-top: 12px;">
        <strong>Nomor Tiket:</strong> ${ticket}${parentLine}<br/>
        <strong>Cek Status Laporan:</strong> <a href="${escapeHtml(statusUrl)}">${escapeHtml(statusUrl)}</a>
      </p>
    </div>
  `.trim();

  return { subject: selected.subject, bodyHtml };
}

/**
 * Enqueue email status laporan untuk satu pelapor (§10.1: selalu memuat nomor tiket + tautan cek status).
 */
export async function enqueueReportStatusEmail(
  db: DbClient,
  params: ReportStatusEmailInput & { companyId: string; toEmail: string }
) {
  const { subject, bodyHtml } = buildReportStatusEmail(params);
  return enqueueEmail(db, {
    companyId: params.companyId,
    toEmail: params.toEmail,
    subject,
    bodyHtml,
    triggerType: params.triggerType,
    ticketNo: params.ticketNo,
  });
}

/**
 * Enqueue email status laporan ke pelapor induk SEKALIGUS ke seluruh pelapor anak
 * yang laporannya digabung (DIGABUNG) ke induk ini dan belum diarsip (§7 Verifikasi 4).
 * Setiap anak menerima tautan status miliknya sendiri (tiket + token anak).
 */
export async function enqueueReportStatusEmailWithMergedChildren(
  db: DbClient,
  params: {
    reportId: string;
    triggerType: ReportEmailTriggerType;
    reason?: string | null;
    afterPhotoUrls?: string[];
  }
) {
  const report = await queryOne<{
    id: string;
    companyId: string;
    ticketNo: string;
    statusToken: string;
    assetName: string;
    assetCode: string;
    reporterName: string;
    reporterEmail: string;
  }>(
    `SELECT
       r."id",
       r."companyId",
       r."ticketNo",
       r."statusToken",
       a."name" AS "assetName",
       a."code" AS "assetCode",
       u."name" AS "reporterName",
       u."email" AS "reporterEmail"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "User" u ON u."id" = r."reporterId"
     WHERE r."id" = $1
     LIMIT 1`,
    [params.reportId],
    db
  );

  if (!report) return;

  const mergedChildren = await query<{
    ticketNo: string;
    statusToken: string;
    reporterName: string;
    reporterEmail: string;
  }>(
    `SELECT
       c."ticketNo",
       c."statusToken",
       u."name" AS "reporterName",
       u."email" AS "reporterEmail"
     FROM "Report" c
     JOIN "User" u ON u."id" = c."reporterId"
     WHERE c."parentReportId" = $1 AND c."archivedAt" IS NULL`,
    [report.id],
    db
  );

  const assetLabel = `${report.assetName} (${report.assetCode})`;

  await enqueueReportStatusEmail(db, {
    companyId: report.companyId,
    toEmail: report.reporterEmail,
    reporterName: report.reporterName,
    ticketNo: report.ticketNo,
    statusToken: report.statusToken,
    assetName: assetLabel,
    triggerType: params.triggerType,
    reason: params.reason,
    afterPhotoUrls: params.afterPhotoUrls,
  });

  for (const child of mergedChildren) {
    await enqueueReportStatusEmail(db, {
      companyId: report.companyId,
      toEmail: child.reporterEmail,
      reporterName: child.reporterName,
      ticketNo: child.ticketNo,
      statusToken: child.statusToken,
      parentTicketNo: report.ticketNo,
      assetName: assetLabel,
      triggerType: params.triggerType,
      reason: params.reason,
      afterPhotoUrls: params.afterPhotoUrls,
    });
  }
}

function computeNextAttempt(retryCount: number, now: Date): Date {
  const idx = Math.min(Math.max(retryCount - 1, 0), RETRY_BACKOFF_MINUTES.length - 1);
  return new Date(now.getTime() + RETRY_BACKOFF_MINUTES[idx] * 60 * 1000);
}

export interface OutboxRunResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
}

/**
 * Memproses outbox: mengklaim baris QUEUED yang sudah jatuh tempo (→ SENDING), mengirim lewat mailer,
 * lalu menandai SENT / FAILED (retry dengan backoff) / DEAD (setelah EMAIL_MAX_RETRIES).
 * Aman dipanggil bersamaan dari beberapa proses: klaim per baris memakai `updateMany` berguard status.
 */
export async function processEmailOutbox(limit = 20): Promise<OutboxRunResult> {
  const result: OutboxRunResult = { claimed: 0, sent: 0, failed: 0, dead: 0 };

  // Bandingkan dengan NOW() di sisi DB (bukan `new Date()` JS): `enqueueEmail` menulis
  // "nextAttemptAt" = NOW() berpresisi mikrodetik, sedangkan Date JS dipotong ke milidetik
  // sehingga baris yang baru masuk bisa dianggap "belum jatuh tempo" dan tidak terklaim.
  const candidates = await query<{ id: string }>(
    `SELECT "id"
     FROM "EmailLog"
     WHERE "status" IN ($1, $2) AND "nextAttemptAt" <= NOW()
     ORDER BY "nextAttemptAt" ASC
     LIMIT $3`,
    [EMAIL_STATUS.QUEUED, EMAIL_STATUS.FAILED, limit],
    pool
  );

  if (candidates.length === 0) return result;

  const mailer = getMailer();

  for (const { id } of candidates) {
    const row = await queryOne<EmailLogRow>(
      `UPDATE "EmailLog"
       SET "status" = $1
       WHERE "id" = $2 AND "status" IN ($3, $4)
       RETURNING *`,
      [EMAIL_STATUS.SENDING, id, EMAIL_STATUS.QUEUED, EMAIL_STATUS.FAILED],
      pool
    );
    if (!row) continue; // sudah diklaim proses lain
    result.claimed++;

    try {
      await mailer.send({ to: row.toEmail, subject: row.subject, html: row.bodyHtml });
      await execute(
        `UPDATE "EmailLog"
         SET "status" = $1, "sentAt" = NOW(), "errorMessage" = NULL
         WHERE "id" = $2`,
        [EMAIL_STATUS.SENT, id],
        pool
      );
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryCount = row.retryCount + 1;
      const dead = retryCount >= EMAIL_MAX_RETRIES;
      await execute(
        `UPDATE "EmailLog"
         SET "status" = $1, "retryCount" = $2, "errorMessage" = $3, "nextAttemptAt" = $4
         WHERE "id" = $5`,
        [
          dead ? EMAIL_STATUS.DEAD : EMAIL_STATUS.FAILED,
          retryCount,
          message.slice(0, 1000),
          computeNextAttempt(retryCount, new Date()),
          id,
        ],
        pool
      );
      if (dead) result.dead++;
      else result.failed++;
      console.error(`[email-outbox] gagal mengirim ${id} ke ${row.toEmail}: ${message}`);
    }
  }

  return result;
}

/**
 * Pemicu "best effort" dari server action (dipanggil via `after()` dari next/server).
 * Kegagalan di sini tidak boleh menggagalkan action; cron /api/cron/outbox menjadi jaring pengaman.
 */
export async function flushEmailOutboxSafely(limit = 20): Promise<void> {
  try {
    await processEmailOutbox(limit);
  } catch (err) {
    console.error("[email-outbox] flush gagal:", err);
  }
}
