import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  AssetRow,
  CategoryRow,
  Channel,
  ClusterRow,
  ComplexRow,
  ParkRow,
  ReportPhotoRow,
  ReportRow,
} from "../db-types";
import { assertPermission, validateStatusTransition } from "../permissions";
import { assetUnreportableReason } from "../scopes";
import { enqueueReportStatusEmail } from "../email";
import { nextTicketNumber } from "../numbering";
import { transitionReport } from "../report-transition";
import { assertSafeUploadUrls } from "../url-safety";
import type { SessionUser } from "../auth";

export const MAX_DAILY_REPORTS_PER_USER = 5;

/**
 * 1. Pengiriman Laporan Kerusakan oleh Pengguna (lewat QR atau Dashboard).
 * Memeriksa:
 * - Hanya role PENGGUNA (matriks §4, CREATE_REPORT).
 * - Minimal 1 foto dan deskripsi wajib ada.
 * - Aset wajib aktif.
 * - Batas jumlah laporan per akun per hari (MAX_DAILY_REPORTS_PER_USER).
 * - Penandaan otomatis jika aset masih dalam masa garansi vendor dari pekerjaan selesai sebelumnya.
 * - Email "laporan diterima" (outbox) & notifikasi web ke Pengelola cluster — dalam satu transaksi
 *   bersama penomoran tiket dan pembuatan laporan.
 */
export async function submitCitizenReport(
  actor: SessionUser,
  input: {
    assetCode: string;
    channel: Channel;
    description: string;
    photoUrls: string[];
  }
) {
  assertPermission(actor.role, "CREATE_REPORT");

  const description = input.description.trim();
  const rawPhotos = input.photoUrls.filter((u) => u && u.trim().length > 0);

  if (rawPhotos.length === 0) {
    throw new Error("Wajib melampirkan minimal satu foto bukti kerusakan.");
  }
  const cleanPhotos = assertSafeUploadUrls(rawPhotos, "Foto bukti kerusakan");
  if (description.length < 5) {
    throw new Error(
      "Deskripsi singkat kerusakan wajib diisi (minimal 5 karakter)."
    );
  }

  // Periksa status blokir pengguna (re-verified dengan lock di dalam transaksi)
  const dbUser = await queryOne<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    isBlocked: boolean;
  }>(
    `SELECT "id", "name", "email", "isActive", "isBlocked"
     FROM "User"
     WHERE "id" = $1`,
    [actor.id]
  );
  if (!dbUser || !dbUser.isActive || dbUser.isBlocked) {
    throw new Error("Akun Anda tidak dapat mengirim laporan saat ini.");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const assetRow = await queryOne<
    AssetRow & {
      categoryActive: boolean;
      parkName: string;
      parkActive: boolean;
      clusterId: string;
      clusterActive: boolean;
      complexActive: boolean;
    }
  >(
    `SELECT
       a.*,
       cat."isActive" AS "categoryActive",
       p."name" AS "parkName",
       p."isActive" AS "parkActive",
       p."clusterId" AS "clusterId",
       cl."isActive" AS "clusterActive",
       cmp."isActive" AS "complexActive"
     FROM "Asset" a
     JOIN "Category" cat ON cat."id" = a."categoryId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     JOIN "Complex" cmp ON cmp."id" = cl."complexId"
     WHERE a."code" = $1`,
    [input.assetCode.trim().toUpperCase()]
  );

  if (!assetRow) {
    throw new Error("Aset tidak ditemukan.");
  }

  const reportableAsset = {
    isActive: assetRow.isActive,
    category: { isActive: assetRow.categoryActive } as Pick<CategoryRow, "isActive">,
    park: {
      isActive: assetRow.parkActive,
      cluster: {
        isActive: assetRow.clusterActive,
        complex: { isActive: assetRow.complexActive } as Pick<ComplexRow, "isActive">,
      } as Pick<ClusterRow, "isActive"> & { complex: Pick<ComplexRow, "isActive"> },
    } as Pick<ParkRow, "isActive"> & {
      cluster: Pick<ClusterRow, "isActive"> & { complex: Pick<ComplexRow, "isActive"> };
    },
  };

  const unreportableReason = assetUnreportableReason(reportableAsset);
  if (unreportableReason) {
    throw new Error(
      `Aset ${assetRow.code} tidak dapat dilaporkan saat ini. ${unreportableReason}`
    );
  }

  // Cek apakah aset ini baru selesai diperbaiki dan masih dalam masa garansi vendor (PRD Fase 6 / Bagian 8)
  let underWarrantyOfVendorId: string | null = null;
  const lastCompleted = await queryOne<{
    completedAt: Date | null;
    vendorId: string;
    warrantyDays: number;
  }>(
    `SELECT wo."completedAt", wo."vendorId", v."warrantyDays"
     FROM "Report" r
     JOIN "WorkOrder" wo ON wo."reportId" = r."id"
     JOIN "Vendor" v ON v."id" = wo."vendorId"
     WHERE r."assetId" = $1
       AND r."status" = 'SELESAI'::"ReportStatus"
       AND r."archivedAt" IS NULL
     ORDER BY r."updatedAt" DESC
     LIMIT 1`,
    [assetRow.id]
  );

  if (lastCompleted?.completedAt) {
    const completedAt = new Date(lastCompleted.completedAt);
    const warrantyDays = lastCompleted.warrantyDays || 30;
    const warrantyExpiresAt = new Date(
      completedAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000
    );
    if (new Date() <= warrantyExpiresAt) {
      underWarrantyOfVendorId = lastCompleted.vendorId;
    }
  }

  const clusterStaffList = await query<{ id: string }>(
    `SELECT "id"
     FROM "User"
     WHERE "companyId" = $1
       AND "role" = 'PENGELOLA'::"Role"
       AND "staffClusterId" = $2
       AND "isActive" = true`,
    [assetRow.companyId, assetRow.clusterId]
  );

  const assetLabel = `${assetRow.name} (${assetRow.code})`;

  return withTransaction(async (tx) => {
    // Kunci baris user untuk serialisasi pemeriksaan kuota harian & status blokir
    const lockedUser = await queryOne<{
      id: string;
      isActive: boolean;
      isBlocked: boolean;
    }>(
      `SELECT "id", "isActive", "isBlocked"
       FROM "User"
       WHERE "id" = $1
       FOR UPDATE`,
      [actor.id],
      tx
    );
    if (!lockedUser || !lockedUser.isActive || lockedUser.isBlocked) {
      throw new Error("Akun Anda tidak dapat mengirim laporan saat ini.");
    }

    const reportsToday = await queryCount(
      `SELECT COUNT(*)::int AS count
       FROM "Report"
       WHERE "reporterId" = $1 AND "createdAt" >= $2 AND "archivedAt" IS NULL`,
      [actor.id, startOfToday],
      tx
    );
    if (reportsToday >= MAX_DAILY_REPORTS_PER_USER) {
      throw new Error(
        `Batas pengiriman laporan harian tercapai (maksimal ${MAX_DAILY_REPORTS_PER_USER} laporan per hari per akun).`
      );
    }

    const ticketNo = await nextTicketNumber(tx);

    const createdReport = await queryOne<ReportRow>(
      `INSERT INTO "Report" (
         "companyId", "ticketNo", "assetId", "reporterId", "channel",
         "description", "status", "underWarrantyOfVendorId", "stageEnteredAt"
       )
       VALUES ($1, $2, $3, $4, $5::"Channel", $6, 'BARU'::"ReportStatus", $7, NOW())
       RETURNING *`,
      [
        assetRow.companyId,
        ticketNo,
        assetRow.id,
        actor.id,
        input.channel,
        description,
        underWarrantyOfVendorId,
      ],
      tx
    );

    if (!createdReport) {
      throw new Error("Gagal membuat laporan.");
    }

    const photos = await query<ReportPhotoRow>(
      `INSERT INTO "ReportPhoto" ("reportId", "url")
       SELECT $1, u FROM unnest($2::text[]) AS u
       RETURNING *`,
      [createdReport.id, cleanPhotos],
      tx
    );

    await execute(
      `INSERT INTO "ReportStatusLog" ("reportId", "fromStatus", "toStatus", "changedById", "note")
       VALUES ($1, NULL, 'BARU'::"ReportStatus", $2, $3)`,
      [
        createdReport.id,
        actor.id,
        `Laporan dikirim melalui saluran ${input.channel}`,
      ],
      tx
    );

    // Email Laporan Diterima ke Pelapor (§10.1) — outbox, ikut rollback bila transaksi gagal
    await enqueueReportStatusEmail(tx, {
      companyId: assetRow.companyId,
      toEmail: dbUser.email,
      reporterName: dbUser.name,
      ticketNo: createdReport.ticketNo,
      statusToken: createdReport.statusToken,
      assetName: assetLabel,
      triggerType: "LAPORAN_TERKIRIM",
    });

    // Notifikasi Web ke semua Pengelola di Cluster terkait (Bagian 9 PRD)
    if (clusterStaffList.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, uid, $2, $3, $4 FROM unnest($5::text[]) AS uid`,
        [
          assetRow.companyId,
          `Laporan Baru Masuk (${createdReport.ticketNo})`,
          `Laporan baru untuk aset ${assetLabel} di ${assetRow.parkName} menunggu verifikasi Anda.`,
          "/dashboard/laporan",
          clusterStaffList.map((s) => s.id),
        ],
        tx
      );
    }

    return { ...createdReport, photos };
  });
}

/**
 * 2. Pembatalan Laporan oleh Pengguna (Hanya bisa saat status masih BARU).
 * Transisi dengan guard status (dua klik bersamaan → hanya satu lolos),
 * email konfirmasi pembatalan masuk outbox dalam transaksi yang sama.
 */
export async function cancelOwnReportByUser(
  actor: SessionUser,
  reportId: string
) {
  assertPermission(actor.role, "CREATE_REPORT");
  if (actor.role !== "PENGGUNA") {
    throw new Error("Akses ditolak: Hanya Pelapor yang dapat membatalkan laporannya sendiri.");
  }

  const report = await queryOne<
    ReportRow & {
      assetName: string;
      assetCode: string;
      reporterName: string;
      reporterEmail: string;
      reporterActive: boolean;
      reporterBlocked: boolean;
    }
  >(
    `SELECT
       r.*,
       a."name" AS "assetName",
       a."code" AS "assetCode",
       u."name" AS "reporterName",
       u."email" AS "reporterEmail",
       u."isActive" AS "reporterActive",
       u."isBlocked" AS "reporterBlocked"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "User" u ON u."id" = r."reporterId"
     WHERE r."id" = $1 AND r."reporterId" = $2 AND r."archivedAt" IS NULL`,
    [reportId, actor.id]
  );

  if (!report) {
    throw new Error("Laporan tidak ditemukan atau bukan milik Anda.");
  }
  if (!report.reporterActive || report.reporterBlocked) {
    throw new Error("Akun Anda tidak aktif atau diblokir.");
  }

  const transitionCheck = validateStatusTransition(
    report.status,
    "DIBATALKAN",
    "PENGGUNA"
  );
  if (!transitionCheck.valid) {
    throw new Error(
      "Laporan hanya dapat dibatalkan selama statusnya masih BARU (belum diverifikasi pengelola)."
    );
  }

  return withTransaction(async (tx) => {
    await transitionReport(tx, {
      reportId: report.id,
      from: report.status,
      to: "DIBATALKAN",
      actor: { id: actor.id, role: "PENGGUNA" },
      note: "Dibatalkan sendiri oleh pelapor",
    });

    await enqueueReportStatusEmail(tx, {
      companyId: report.companyId,
      toEmail: report.reporterEmail,
      reporterName: report.reporterName,
      ticketNo: report.ticketNo,
      statusToken: report.statusToken,
      assetName: `${report.assetName} (${report.assetCode})`,
      triggerType: "DIBATALKAN",
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
