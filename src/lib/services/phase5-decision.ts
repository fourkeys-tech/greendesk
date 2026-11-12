import { execute, query, queryOne, withTransaction } from "../db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  ParkRow,
  ReportPhotoRow,
  ReportRow,
  VendorRow,
  VendorType,
  WorkOrderRow,
} from "../db-types";
import { assertPermission, validateStatusTransition } from "../permissions";
import { enqueueReportStatusEmailWithMergedChildren } from "../email";
import { recordAuditLog } from "../audit";
import { nextSpkNumber } from "../numbering";
import { transitionReport } from "../report-transition";
import { activeAssignmentSql } from "../scopes";
import { assertSafeUploadUrl } from "../url-safety";
import type { SessionUser } from "../auth";

/**
 * Mendapatkan daftar ID cluster yang ditugaskan kepada seorang Manager
 * (termasuk penugasan manajer pengganti sementara yang masih berlaku).
 */
export async function getManagerAssignedClusterIds(
  managerUserId: string
): Promise<string[]> {
  const now = new Date();
  const assignments = await query<{ clusterId: string }>(
    `SELECT "clusterId"
     FROM "ClusterManagerAssignment" cma
     WHERE cma."userId" = $1 AND ${activeAssignmentSql("cma", "$2")}`,
    [managerUserId, now]
  );
  return assignments.map((a) => a.clusterId);
}

/**
 * MGR-M2: Antrean Laporan Menunggu Keputusan Manager
 * Diurutkan berdasarkan:
 * 1. Prioritas (TINGGI -> NORMAL -> RENDAH)
 * 2. Waktu terlama di tahap ini (stageEnteredAt / createdAt asc)
 */
export async function getPendingManagerReports(actor: SessionUser) {
  assertPermission(actor.role, "DECIDE_REPAIR");
  if (!actor.companyId) return [];

  const clusterIds = await getManagerAssignedClusterIds(actor.id);
  if (clusterIds.length === 0) {
    return [];
  }

  const rows = await query<ReportRow>(
    `SELECT r.*
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     WHERE r."companyId" = $1
       AND r."status" = 'MENUNGGU_KEPUTUSAN'::"ReportStatus"
       AND r."archivedAt" IS NULL
       AND p."clusterId" = ANY($2::text[])`,
    [actor.companyId, clusterIds]
  );

  if (rows.length === 0) return [];

  const reportIds = rows.map((r) => r.id);
  const assetIds = Array.from(new Set(rows.map((r) => r.assetId)));
  const reporterIds = Array.from(new Set(rows.map((r) => r.reporterId)));
  const warrantyVendorIds = Array.from(
    new Set(
      rows
        .map((r) => r.underWarrantyOfVendorId)
        .filter((v): v is string => Boolean(v))
    )
  );

  const [assets, reporters, photoRows, warrantyVendors, mergedChildRows] =
    await Promise.all([
      query<AssetRow>(
        `SELECT * FROM "Asset" WHERE "id" = ANY($1::text[])`,
        [assetIds]
      ),
      query<{
        id: string;
        name: string;
        email: string;
        reporterStatus: string | null;
        validReportCount: number;
        invalidReportCount: number;
      }>(
        `SELECT "id", "name", "email", "reporterStatus", "validReportCount", "invalidReportCount"
         FROM "User"
         WHERE "id" = ANY($1::text[])`,
        [reporterIds]
      ),
      query<ReportPhotoRow>(
        `SELECT * FROM "ReportPhoto" WHERE "reportId" = ANY($1::text[])`,
        [reportIds]
      ),
      warrantyVendorIds.length > 0
        ? query<{ id: string; name: string; warrantyDays: number }>(
            `SELECT "id", "name", "warrantyDays" FROM "Vendor" WHERE "id" = ANY($1::text[])`,
            [warrantyVendorIds]
          )
        : Promise.resolve([]),
      query<{ id: string; ticketNo: string; createdAt: Date; parentReportId: string }>(
        `SELECT "id", "ticketNo", "createdAt", "parentReportId"
         FROM "Report"
         WHERE "parentReportId" = ANY($1::text[]) AND "archivedAt" IS NULL`,
        [reportIds]
      ),
    ]);

  const parkIds = Array.from(new Set(assets.map((a) => a.parkId)));
  const categoryIds = Array.from(new Set(assets.map((a) => a.categoryId)));
  const [parks, categories] = await Promise.all([
    parkIds.length > 0
      ? query<ParkRow>(`SELECT * FROM "Park" WHERE "id" = ANY($1::text[])`, [parkIds])
      : Promise.resolve([]),
    categoryIds.length > 0
      ? query<CategoryRow>(`SELECT * FROM "Category" WHERE "id" = ANY($1::text[])`, [categoryIds])
      : Promise.resolve([]),
  ]);
  const clusterIdsFromParks = Array.from(new Set(parks.map((p) => p.clusterId)));
  const clusters =
    clusterIdsFromParks.length > 0
      ? await query<ClusterRow>(
          `SELECT * FROM "Cluster" WHERE "id" = ANY($1::text[])`,
          [clusterIdsFromParks]
        )
      : [];

  const clusterMap = new Map(clusters.map((c) => [c.id, c]));
  const parkMap = new Map(
    parks.map((p) => [p.id, { ...p, cluster: clusterMap.get(p.clusterId)! }])
  );
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const assetMap = new Map(
    assets.map((a) => [
      a.id,
      {
        ...a,
        park: parkMap.get(a.parkId)!,
        category: categoryMap.get(a.categoryId)!,
      },
    ])
  );
  const reporterMap = new Map(reporters.map((u) => [u.id, u]));
  const vendorMap = new Map(warrantyVendors.map((v) => [v.id, v]));
  const photosMap = new Map<string, ReportPhotoRow[]>();
  for (const p of photoRows) {
    const arr = photosMap.get(p.reportId) ?? [];
    arr.push(p);
    photosMap.set(p.reportId, arr);
  }
  const mergedMap = new Map<
    string,
    { id: string; ticketNo: string; createdAt: Date }[]
  >();
  for (const m of mergedChildRows) {
    const arr = mergedMap.get(m.parentReportId) ?? [];
    arr.push({ id: m.id, ticketNo: m.ticketNo, createdAt: m.createdAt });
    mergedMap.set(m.parentReportId, arr);
  }

  // Urutkan prioritas TINGGI (1) -> NORMAL (2) -> RENDAH (3), lalu tanggal terlama di tahap ini (stageEnteredAt / createdAt tertua duluan)
  const priorityRank: Record<string, number> = {
    TINGGI: 1,
    NORMAL: 2,
    RENDAH: 3,
  };

  const now = new Date();

  return rows
    .map((r) => {
      const stageDate = r.stageEnteredAt || r.createdAt;
      const diffMs = now.getTime() - stageDate.getTime();
      const daysInStage = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      return {
        ...r,
        asset: assetMap.get(r.assetId)!,
        reporter: reporterMap.get(r.reporterId)!,
        photos: photosMap.get(r.id) ?? [],
        underWarrantyOfVendor: r.underWarrantyOfVendorId
          ? vendorMap.get(r.underWarrantyOfVendorId) ?? null
          : null,
        mergedChildReports: mergedMap.get(r.id) ?? [],
        daysInStage,
      };
    })
    .sort((a, b) => {
      const pA = priorityRank[a.priority || "NORMAL"] || 99;
      const pB = priorityRank[b.priority || "NORMAL"] || 99;
      if (pA !== pB) return pA - pB;

      const dateA = (a.stageEnteredAt || a.createdAt).getTime();
      const dateB = (b.stageEnteredAt || b.createdAt).getTime();
      return dateA - dateB;
    });
}

/**
 * Mengambil daftar Vendor yang berhak melayani cluster laporan tertentu.
 * Aturan Bisnis 5.8: Pilihan vendor pada form SPK hanya memuat vendor yang area layanannya
 * mencakup cluster laporan.
 */
export async function getEligibleVendorsForCluster(
  companyId: string,
  clusterId: string
) {
  return query<{
    id: string;
    name: string;
    type: VendorType;
    skills: string[];
    warrantyDays: number;
    picUserId: string | null;
  }>(
    `SELECT v."id", v."name", v."type", v."skills", v."warrantyDays", v."picUserId"
     FROM "Vendor" v
     WHERE v."companyId" = $1
       AND v."isActive" = true
       AND EXISTS (
         SELECT 1 FROM "VendorServiceArea" vsa
         WHERE vsa."vendorId" = v."id" AND vsa."clusterId" = $2
       )
     ORDER BY v."name" ASC`,
    [companyId, clusterId]
  );
}

/**
 * MGR-M2a: Eksekusi Keputusan Manager (Tolak atau Setuju + Buat SPK)
 */
export async function decideManagerReport(
  actor: SessionUser,
  input: {
    reportId: string;
    decision: "SETUJU" | "TOLAK";
    rejectionReason?: string;
    spkInput?: {
      vendorId: string;
      assignedDate?: Date;
      notes?: string;
      spkFileUrl?: string;
      spkFileName?: string;
      spkFileSize?: number;
      spkFileMime?: string;
    };
  }
) {
  assertPermission(actor.role, "DECIDE_REPAIR");

  if (!actor.companyId) {
    throw new Error("Akun Anda tidak memiliki tautan Perusahaan.");
  }

  // 1. Validasi keberadaan laporan dan cluster tertaut
  const clusterIds = await getManagerAssignedClusterIds(actor.id);
  const report = await queryOne<
    ReportRow & {
      assetName: string;
      clusterId: string;
      clusterName: string;
    }
  >(
    `SELECT
       r.*,
       a."name" AS "assetName",
       p."clusterId" AS "clusterId",
       cl."name" AS "clusterName"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     WHERE r."id" = $1 AND r."companyId" = $2 AND r."archivedAt" IS NULL`,
    [input.reportId, actor.companyId]
  );

  if (!report) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const reportClusterId = report.clusterId;
  if (!clusterIds.includes(reportClusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki penugasan manajer untuk ${report.clusterName}.`
    );
  }

  if (report.status !== "MENUNGGU_KEPUTUSAN") {
    throw new Error(
      `Laporan berstatus ${report.status}. Hanya laporan Menunggu Keputusan yang dapat diputuskan oleh Manager.`
    );
  }

  // 2. Cabang Aksi: TOLAK
  if (input.decision === "TOLAK") {
    const reason = input.rejectionReason?.trim();
    if (!reason) {
      throw new Error(
        "Penolakan perbaikan wajib mencantumkan alasan (misal: menunggu anggaran atau siklus peremajaan)."
      );
    }

    const check = validateStatusTransition(
      report.status,
      "DITOLAK",
      actor.role,
      reason
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const companyId = actor.companyId;
    const updated = await withTransaction(async (tx) => {
      await transitionReport(tx, {
        reportId: report.id,
        from: report.status,
        to: "DITOLAK",
        actor: { id: actor.id, role: actor.role },
        data: { reason },
        reason,
        note: reason,
      });

      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "Report",
          entityId: report.id,
          action: "UPDATE",
          summary: `Manager ${actor.name} menolak perbaikan laporan ${report.ticketNo}. Alasan: ${reason}`,
          oldValues: { status: report.status },
          newValues: { status: "DITOLAK", reason },
        },
        tx
      );

      // Email penolakan ke pelapor utama dan pelapor anak yang digabung (outbox)
      await enqueueReportStatusEmailWithMergedChildren(tx, {
        reportId: report.id,
        triggerType: "DITOLAK_MANAGER",
        reason,
      });

      const rep = await queryOne<ReportRow>(
        `SELECT * FROM "Report" WHERE "id" = $1`,
        [report.id],
        tx
      );
      if (!rep) throw new Error("Laporan tidak ditemukan.");
      return rep;
    });

    return { success: true, status: "DITOLAK", report: updated };
  }

  // 3. Cabang Aksi: SETUJU (Membuat SPK ke Vendor)
  if (input.decision === "SETUJU") {
    assertPermission(actor.role, "CREATE_SPK");
    if (!input.spkInput?.vendorId) {
      throw new Error("Pilihan vendor wajib diisi saat menyetujui perbaikan.");
    }
    if (!input.spkInput?.spkFileUrl) {
      throw new Error(
        "File Surat Perintah Kerja (SPK) wajib dilampirkan sebelum menerbitkan SPK (PRD v0.2 Keputusan 14)."
      );
    }

    const { vendorId, assignedDate, notes, spkFileName, spkFileSize, spkFileMime } =
      input.spkInput;
    const spkFileUrl = assertSafeUploadUrl(input.spkInput.spkFileUrl, "File SPK");

    // Verifikasi vendor melayani cluster laporan ini
    const vendor = await queryOne<VendorRow>(
      `SELECT v.*
       FROM "Vendor" v
       WHERE v."id" = $1
         AND v."companyId" = $2
         AND v."isActive" = true
         AND EXISTS (
           SELECT 1 FROM "VendorServiceArea" vsa
           WHERE vsa."vendorId" = v."id" AND vsa."clusterId" = $3
         )`,
      [vendorId, actor.companyId, reportClusterId]
    );

    if (!vendor) {
      throw new Error(
        "Vendor tidak ditemukan atau tidak melayani cluster tempat aset ini berada."
      );
    }

    const check = validateStatusTransition(
      report.status,
      "DISETUJUI",
      actor.role
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const companyId = actor.companyId;
    const result = await withTransaction(async (tx) => {
      // 1. Transisi status laporan ke DISETUJUI (guard: dua approve bersamaan → satu lolos)
      //    Dilakukan SEBELUM nomor SPK diambil agar counter tidak naik untuk request yang kalah.
      await transitionReport(tx, {
        reportId: report.id,
        from: report.status,
        to: "DISETUJUI",
        actor: { id: actor.id, role: actor.role },
        note: `Perbaikan disetujui oleh Manager. SPK diterbitkan kepada vendor ${vendor.name}.${
          notes ? ` Catatan: ${notes}` : ""
        }`,
      });

      // 2. Nomor SPK atomik per perusahaan per bulan
      const spkNo = await nextSpkNumber(tx, companyId);

      // 3. Buat WorkOrder (SPK) dengan teknisi kosong
      const now = new Date();
      const workOrder = await queryOne<WorkOrderRow>(
        `INSERT INTO "WorkOrder" (
           "companyId", "spkNo", "reportId", "vendorId", "technicianId",
           "assignedAt", "spkFileUrl", "spkFileName", "spkFileSize", "spkFileMime",
           "spkFileUploadedAt", "spkFileUploadedById"
         )
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          companyId,
          spkNo,
          report.id,
          vendor.id,
          assignedDate || now,
          spkFileUrl,
          spkFileName || `${spkNo}.pdf`,
          spkFileSize || null,
          spkFileMime || "application/pdf",
          now,
          actor.id,
        ],
        tx
      );
      if (!workOrder) throw new Error("Gagal membuat SPK.");

      // 4. Notifikasi Web ke PIC Vendor
      if (vendor.picUserId) {
        await execute(
          `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            companyId,
            vendor.picUserId,
            `SPK Baru Diterbitkan (${spkNo})`,
            `Manager ${actor.name} telah menerbitkan ${spkNo} untuk perbaikan aset ${report.assetName}. Silakan tunjuk teknisi pelaksana.`,
            "/dashboard/laporan",
          ],
          tx
        );
      }

      // 5. AuditLog ikut transaksi
      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "WorkOrder",
          entityId: workOrder.id,
          action: "CREATE",
          summary: `Manager ${actor.name} menyetujui perbaikan laporan ${report.ticketNo} dan menerbitkan ${spkNo} ke ${vendor.name}`,
          oldValues: { reportStatus: report.status },
          newValues: {
            reportStatus: "DISETUJUI",
            spkNo,
            vendorId: vendor.id,
            vendorName: vendor.name,
          },
        },
        tx
      );

      // 6. Email konfirmasi ke pelapor utama & pelapor gabungan (outbox)
      await enqueueReportStatusEmailWithMergedChildren(tx, {
        reportId: report.id,
        triggerType: "DISETUJUI",
      });

      const rep = await queryOne<ReportRow>(
        `SELECT * FROM "Report" WHERE "id" = $1`,
        [report.id],
        tx
      );
      if (!rep) throw new Error("Laporan tidak ditemukan.");
      return { workOrder, report: rep };
    });

    return {
      success: true,
      status: "DISETUJUI",
      spkNo: result.workOrder.spkNo,
      workOrder: result.workOrder,
      report: result.report,
    };
  }

  throw new Error("Keputusan tidak valid. Pilih SETUJU atau TOLAK.");
}
