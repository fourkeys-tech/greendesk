import { execute, query, queryOne, withTransaction } from "../db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  ComplexRow,
  ParkRow,
  ReportPhotoRow,
  ReportRow,
  ReportStatus,
  RevisionNoteRow,
  TechnicianRow,
  VendorRow,
  WorkOrderRow,
  WorkPhotoRow,
} from "../db-types";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import { activeAssignmentSql } from "../scopes";
import type { SessionUser } from "../auth";

export type ScopedTechnicianReport = {
  id: string;
  ticketNo: string;
  channel: ReportRow["channel"];
  description: string;
  status: ReportRow["status"];
  priority: ReportRow["priority"];
  reason: string | null;
  stageEnteredAt: Date;
  createdAt: Date;
  archivedAt: Date | null;
  photos: ReportPhotoRow[];
  asset: {
    code: string;
    name: string;
    locationNote: string | null;
    park: {
      name: string;
      cluster: { name: string };
    };
  };
  workOrder: {
    id: string;
    spkNo: string;
    assignedAt: Date;
    completedAt: Date | null;
    vendor: { name: string };
    technician: { id: string; fullName: string } | null;
    photos: WorkPhotoRow[];
    revisionNotes: RevisionNoteRow[];
  } | null;
  reporter?: undefined;
};

export type ScopedFullReport = ReportRow & {
  asset: AssetRow & {
    park: ParkRow & {
      cluster: ClusterRow & {
        complex: ComplexRow;
      };
    };
    category: CategoryRow;
  };
  reporter: {
    id: string;
    name: string;
    email: string;
    reporterStatus: string | null;
    blockHouseNo: string | null;
  };
  workOrder:
    | (WorkOrderRow & {
        vendor: VendorRow;
        technician: TechnicianRow | null;
        photos: WorkPhotoRow[];
        revisionNotes: RevisionNoteRow[];
      })
    | null;
  photos: ReportPhotoRow[];
  parentReport: { id: string; ticketNo: string; status: ReportStatus } | null;
  mergedChildReports: { id: string; ticketNo: string }[];
  underWarrantyOfVendor: { id: string; name: string } | null;
};

async function hydrateFullScopedReports(
  reports: ReportRow[],
  anonymizeReporter: boolean
): Promise<ScopedFullReport[]> {
  if (reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);
  const assetIds = Array.from(new Set(reports.map((r) => r.assetId)));
  const reporterIds = anonymizeReporter
    ? []
    : Array.from(new Set(reports.map((r) => r.reporterId)));
  const parentIds = Array.from(
    new Set(
      reports
        .map((r) => r.parentReportId)
        .filter((v): v is string => Boolean(v))
    )
  );
  const warrantyVendorIds = Array.from(
    new Set(
      reports
        .map((r) => r.underWarrantyOfVendorId)
        .filter((v): v is string => Boolean(v))
    )
  );

  const [
    assets,
    reporters,
    reportPhotos,
    workOrders,
    parentReports,
    mergedChildren,
    warrantyVendors,
  ] = await Promise.all([
    query<AssetRow>(
      `SELECT * FROM "Asset" WHERE "id" = ANY($1::text[])`,
      [assetIds]
    ),
    reporterIds.length > 0
      ? query<{
          id: string;
          name: string;
          email: string;
          reporterStatus: string | null;
          blockHouseNo: string | null;
        }>(
          `SELECT "id", "name", "email", "reporterStatus", "blockHouseNo"
           FROM "User"
           WHERE "id" = ANY($1::text[])`,
          [reporterIds]
        )
      : Promise.resolve([]),
    query<ReportPhotoRow>(
      `SELECT * FROM "ReportPhoto" WHERE "reportId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
      [reportIds]
    ),
    query<WorkOrderRow>(
      `SELECT * FROM "WorkOrder" WHERE "reportId" = ANY($1::text[])`,
      [reportIds]
    ),
    parentIds.length > 0
      ? query<{ id: string; ticketNo: string; status: ReportStatus }>(
          `SELECT "id", "ticketNo", "status" FROM "Report" WHERE "id" = ANY($1::text[])`,
          [parentIds]
        )
      : Promise.resolve([]),
    query<{ id: string; ticketNo: string; parentReportId: string }>(
      `SELECT "id", "ticketNo", "parentReportId"
       FROM "Report"
       WHERE "parentReportId" = ANY($1::text[]) AND "archivedAt" IS NULL`,
      [reportIds]
    ),
    warrantyVendorIds.length > 0
      ? query<{ id: string; name: string }>(
          `SELECT "id", "name" FROM "Vendor" WHERE "id" = ANY($1::text[])`,
          [warrantyVendorIds]
        )
      : Promise.resolve([]),
  ]);

  const parkIds = Array.from(new Set(assets.map((a) => a.parkId)));
  const categoryIds = Array.from(new Set(assets.map((a) => a.categoryId)));
  const woIds = workOrders.map((wo) => wo.id);
  const woVendorIds = Array.from(new Set(workOrders.map((wo) => wo.vendorId)));
  const woTechIds = Array.from(
    new Set(
      workOrders
        .map((wo) => wo.technicianId)
        .filter((v): v is string => Boolean(v))
    )
  );

  const [parks, categories, woVendors, woTechs, workPhotos, revisionNotes] =
    await Promise.all([
      parkIds.length > 0
        ? query<ParkRow>(`SELECT * FROM "Park" WHERE "id" = ANY($1::text[])`, [parkIds])
        : Promise.resolve([]),
      categoryIds.length > 0
        ? query<CategoryRow>(`SELECT * FROM "Category" WHERE "id" = ANY($1::text[])`, [categoryIds])
        : Promise.resolve([]),
      woVendorIds.length > 0
        ? query<VendorRow>(`SELECT * FROM "Vendor" WHERE "id" = ANY($1::text[])`, [woVendorIds])
        : Promise.resolve([]),
      woTechIds.length > 0
        ? query<TechnicianRow>(`SELECT * FROM "Technician" WHERE "id" = ANY($1::text[])`, [woTechIds])
        : Promise.resolve([]),
      woIds.length > 0
        ? query<WorkPhotoRow>(
            `SELECT * FROM "WorkPhoto" WHERE "workOrderId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
            [woIds]
          )
        : Promise.resolve([]),
      woIds.length > 0
        ? query<RevisionNoteRow>(
            `SELECT * FROM "RevisionNote" WHERE "workOrderId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
            [woIds]
          )
        : Promise.resolve([]),
    ]);

  const clusterIds = Array.from(new Set(parks.map((p) => p.clusterId)));
  const clusters =
    clusterIds.length > 0
      ? await query<ClusterRow>(
          `SELECT * FROM "Cluster" WHERE "id" = ANY($1::text[])`,
          [clusterIds]
        )
      : [];

  const complexIds = Array.from(new Set(clusters.map((c) => c.complexId)));
  const complexes =
    complexIds.length > 0
      ? await query<ComplexRow>(
          `SELECT * FROM "Complex" WHERE "id" = ANY($1::text[])`,
          [complexIds]
        )
      : [];

  const complexMap = new Map(complexes.map((c) => [c.id, c]));
  const clusterMap = new Map(
    clusters.map((cl) => [
      cl.id,
      { ...cl, complex: complexMap.get(cl.complexId)! },
    ])
  );
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
  const parentMap = new Map(parentReports.map((p) => [p.id, p]));
  const warrantyVendorMap = new Map(warrantyVendors.map((v) => [v.id, v]));
  const woVendorMap = new Map(woVendors.map((v) => [v.id, v]));
  const woTechMap = new Map(woTechs.map((t) => [t.id, t]));

  const reportPhotosMap = new Map<string, ReportPhotoRow[]>();
  for (const p of reportPhotos) {
    const arr = reportPhotosMap.get(p.reportId) ?? [];
    arr.push(p);
    reportPhotosMap.set(p.reportId, arr);
  }

  const mergedMap = new Map<string, { id: string; ticketNo: string }[]>();
  for (const m of mergedChildren) {
    const arr = mergedMap.get(m.parentReportId) ?? [];
    arr.push({ id: m.id, ticketNo: m.ticketNo });
    mergedMap.set(m.parentReportId, arr);
  }

  const workPhotosMap = new Map<string, WorkPhotoRow[]>();
  for (const wp of workPhotos) {
    const arr = workPhotosMap.get(wp.workOrderId) ?? [];
    arr.push(wp);
    workPhotosMap.set(wp.workOrderId, arr);
  }

  const revNotesMap = new Map<string, RevisionNoteRow[]>();
  for (const rn of revisionNotes) {
    const arr = revNotesMap.get(rn.workOrderId) ?? [];
    arr.push(rn);
    revNotesMap.set(rn.workOrderId, arr);
  }

  const woByReportMap = new Map(
    workOrders.map((wo) => [
      wo.reportId,
      {
        ...wo,
        vendor: woVendorMap.get(wo.vendorId)!,
        technician: wo.technicianId ? woTechMap.get(wo.technicianId) ?? null : null,
        photos: workPhotosMap.get(wo.id) ?? [],
        revisionNotes: revNotesMap.get(wo.id) ?? [],
      },
    ])
  );

  const anonymousReporter = {
    id: "ANONYMOUS",
    name: "Warga / Pelapor",
    email: "rahasia@greenpark.internal",
    reporterStatus: null,
    blockHouseNo: null,
  };

  return reports.map((r) => ({
    ...r,
    asset: assetMap.get(r.assetId)!,
    reporter: anonymizeReporter
      ? anonymousReporter
      : reporterMap.get(r.reporterId)!,
    workOrder: woByReportMap.get(r.id) ?? null,
    photos: reportPhotosMap.get(r.id) ?? [],
    parentReport: r.parentReportId ? parentMap.get(r.parentReportId) ?? null : null,
    mergedChildReports: mergedMap.get(r.id) ?? [],
    underWarrantyOfVendor: r.underWarrantyOfVendorId
      ? warrantyVendorMap.get(r.underWarrantyOfVendorId) ?? null
      : null,
  }));
}

/**
 * Mengambil daftar laporan sesuai cakupan role & multi-perusahaan (Bagian 4 & 14.2 PRD).
 * Khusus Teknisi: TIDAK meng-select identitas pelapor (nama/email) sama sekali demi privasi.
 */
export async function getScopedReportsForUser(
  user: SessionUser,
  options?: { includeArchived?: boolean; throwOnError?: boolean }
): Promise<(ScopedTechnicianReport | ScopedFullReport)[]> {
  try {
    const archivedCond = options?.includeArchived
      ? 'r."archivedAt" IS NOT NULL'
      : 'r."archivedAt" IS NULL';

    if (user.role === "TEKNISI") {
      const tech = await queryOne<{ id: string; companyId: string }>(
        `SELECT "id", "companyId" FROM "Technician" WHERE "userId" = $1`,
        [user.id]
      );
      if (!tech) return [];

      // Teknisi TIDAK BOLEH meng-select field reporter sama sekali (PRD 14.5)
      const rows = await query<{
        id: string;
        ticketNo: string;
        channel: ReportRow["channel"];
        description: string;
        status: ReportRow["status"];
        priority: ReportRow["priority"];
        reason: string | null;
        stageEnteredAt: Date;
        createdAt: Date;
        archivedAt: Date | null;
        assetCode: string;
        assetName: string;
        assetLocationNote: string | null;
        parkName: string;
        clusterName: string;
        woId: string;
        woSpkNo: string;
        woAssignedAt: Date;
        woCompletedAt: Date | null;
        vendorName: string;
        techId: string | null;
        techFullName: string | null;
      }>(
        `SELECT
           r."id", r."ticketNo", r."channel", r."description", r."status",
           r."priority", r."reason", r."stageEnteredAt", r."createdAt", r."archivedAt",
           a."code" AS "assetCode", a."name" AS "assetName", a."locationNote" AS "assetLocationNote",
           p."name" AS "parkName", cl."name" AS "clusterName",
           wo."id" AS "woId", wo."spkNo" AS "woSpkNo", wo."assignedAt" AS "woAssignedAt", wo."completedAt" AS "woCompletedAt",
           v."name" AS "vendorName",
           t."id" AS "techId", t."fullName" AS "techFullName"
         FROM "Report" r
         JOIN "Asset" a ON a."id" = r."assetId"
         JOIN "Park" p ON p."id" = a."parkId"
         JOIN "Cluster" cl ON cl."id" = p."clusterId"
         JOIN "WorkOrder" wo ON wo."reportId" = r."id"
         JOIN "Vendor" v ON v."id" = wo."vendorId"
         LEFT JOIN "Technician" t ON t."id" = wo."technicianId"
         WHERE r."companyId" = $1
           AND wo."technicianId" = $2
           AND ${archivedCond}
         ORDER BY r."createdAt" DESC`,
        [tech.companyId, tech.id]
      );

      if (rows.length === 0) return [];

      const reportIds = rows.map((r) => r.id);
      const woIds = rows.map((r) => r.woId);

      const [photos, workPhotos, revisionNotes] = await Promise.all([
        query<ReportPhotoRow>(
          `SELECT * FROM "ReportPhoto" WHERE "reportId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
          [reportIds]
        ),
        query<WorkPhotoRow>(
          `SELECT * FROM "WorkPhoto" WHERE "workOrderId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
          [woIds]
        ),
        query<RevisionNoteRow>(
          `SELECT * FROM "RevisionNote" WHERE "workOrderId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
          [woIds]
        ),
      ]);

      const photoMap = new Map<string, ReportPhotoRow[]>();
      for (const ph of photos) {
        const arr = photoMap.get(ph.reportId) ?? [];
        arr.push(ph);
        photoMap.set(ph.reportId, arr);
      }
      const wpMap = new Map<string, WorkPhotoRow[]>();
      for (const wp of workPhotos) {
        const arr = wpMap.get(wp.workOrderId) ?? [];
        arr.push(wp);
        wpMap.set(wp.workOrderId, arr);
      }
      const rnMap = new Map<string, RevisionNoteRow[]>();
      for (const rn of revisionNotes) {
        const arr = rnMap.get(rn.workOrderId) ?? [];
        arr.push(rn);
        rnMap.set(rn.workOrderId, arr);
      }

      return rows.map((r) => ({
        id: r.id,
        ticketNo: r.ticketNo,
        channel: r.channel,
        description: r.description,
        status: r.status,
        priority: r.priority,
        reason: r.reason,
        stageEnteredAt: r.stageEnteredAt,
        createdAt: r.createdAt,
        archivedAt: r.archivedAt,
        photos: photoMap.get(r.id) ?? [],
        asset: {
          code: r.assetCode,
          name: r.assetName,
          locationNote: r.assetLocationNote,
          park: {
            name: r.parkName,
            cluster: { name: r.clusterName },
          },
        },
        workOrder: {
          id: r.woId,
          spkNo: r.woSpkNo,
          assignedAt: r.woAssignedAt,
          completedAt: r.woCompletedAt,
          vendor: { name: r.vendorName },
          technician: r.techId
            ? { id: r.techId, fullName: r.techFullName! }
            : null,
          photos: wpMap.get(r.woId) ?? [],
          revisionNotes: rnMap.get(r.woId) ?? [],
        },
      }));
    }

    if (user.role === "PENGGUNA") {
      const rows = await query<ReportRow>(
        `SELECT r.*
         FROM "Report" r
         WHERE r."reporterId" = $1 AND ${archivedCond}
         ORDER BY r."createdAt" DESC`,
        [user.id]
      );
      return hydrateFullScopedReports(rows, false);
    }

    if (!user.companyId) return [];

    if (user.role === "PENGELOLA") {
      if (!user.staffClusterId) return [];
      const rows = await query<ReportRow>(
        `SELECT r.*
         FROM "Report" r
         JOIN "Asset" a ON a."id" = r."assetId"
         JOIN "Park" p ON p."id" = a."parkId"
         WHERE r."companyId" = $1 AND p."clusterId" = $2 AND ${archivedCond}
         ORDER BY r."createdAt" DESC`,
        [user.companyId, user.staffClusterId]
      );
      return hydrateFullScopedReports(rows, false);
    }

    if (user.role === "MANAGER") {
      const now = new Date();
      const assignments = await query<{ clusterId: string }>(
        `SELECT "clusterId"
         FROM "ClusterManagerAssignment" cma
         WHERE cma."userId" = $1 AND ${activeAssignmentSql("cma", "$2")}`,
        [user.id, now]
      );
      const clusterIds = assignments.map((a) => a.clusterId);
      if (clusterIds.length === 0) return [];

      const rows = await query<ReportRow>(
        `SELECT r.*
         FROM "Report" r
         JOIN "Asset" a ON a."id" = r."assetId"
         JOIN "Park" p ON p."id" = a."parkId"
         WHERE r."companyId" = $1
           AND p."clusterId" = ANY($2::text[])
           AND ${archivedCond}
         ORDER BY r."createdAt" DESC`,
        [user.companyId, clusterIds]
      );
      return hydrateFullScopedReports(rows, false);
    }

    if (user.role === "PIC_VENDOR") {
      const vendor = await queryOne<{ id: string }>(
        `SELECT "id" FROM "Vendor" WHERE "picUserId" = $1`,
        [user.id]
      );
      if (!vendor) return [];

      const rows = await query<ReportRow>(
        `SELECT r.*
         FROM "Report" r
         JOIN "WorkOrder" wo ON wo."reportId" = r."id"
         WHERE r."companyId" = $1 AND wo."vendorId" = $2 AND ${archivedCond}
         ORDER BY r."createdAt" DESC`,
        [user.companyId, vendor.id]
      );
      // PRD v0.2 Keputusan 11 & Bagian 3.5: PIC tidak melihat identitas pelapor
      return hydrateFullScopedReports(rows, true);
    }

    // ADMIN dan OWNER: melihat semua laporan di perusahaannya (companyId)
    const rows = await query<ReportRow>(
      `SELECT r.*
       FROM "Report" r
       WHERE r."companyId" = $1 AND ${archivedCond}
       ORDER BY r."createdAt" DESC`,
      [user.companyId]
    );
    return hydrateFullScopedReports(rows, false);
  } catch (error) {
    console.error("[getScopedReportsForUser] Database query error:", error);
    if (options?.throwOnError) throw error;
    return [];
  }
}

/**
 * Mengubah data master Aset (Hanya ADMIN) dan otomatis mencatat nilai lama & baru ke AuditLog.
 */
export async function updateAssetMasterData(
  actor: SessionUser,
  assetId: string,
  updates: {
    name?: string;
    locationNote?: string;
    isActive?: boolean;
    photoUrl?: string;
  }
) {
  assertPermission(actor.role, "MANAGE_MASTER_DATA");

  if (!actor.companyId) {
    throw new Error("Akun Admin harus terhubung ke perusahaan.");
  }
  const companyId = actor.companyId;

  const existing = await queryOne<AssetRow>(
    `SELECT * FROM "Asset" WHERE "id" = $1 AND "companyId" = $2`,
    [assetId, companyId]
  );

  if (!existing) {
    throw new Error("Aset tidak ditemukan di perusahaan Anda.");
  }

  return withTransaction(async (tx) => {
    const nextName = updates.name ?? existing.name;
    const nextLocationNote = updates.locationNote ?? existing.locationNote;
    const nextIsActive =
      typeof updates.isActive === "boolean"
        ? updates.isActive
        : existing.isActive;
    const nextPhotoUrl = updates.photoUrl ?? existing.photoUrl;

    const updated = await queryOne<AssetRow>(
      `UPDATE "Asset"
       SET "name" = $2,
           "locationNote" = $3,
           "isActive" = $4,
           "photoUrl" = $5,
           "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, nextName, nextLocationNote, nextIsActive, nextPhotoUrl],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui aset.");

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "Asset",
        entityId: existing.id,
        action: "UPDATE",
        summary: `Memperbarui data master aset ${existing.code} (${updated.name})`,
        oldValues: {
          name: existing.name,
          locationNote: existing.locationNote,
          isActive: existing.isActive,
          photoUrl: existing.photoUrl,
        },
        newValues: {
          name: updated.name,
          locationNote: updated.locationNote,
          isActive: updated.isActive,
          photoUrl: updated.photoUrl,
        },
      },
      tx
    );

    return updated;
  });
}

/**
 * Cakupan arsip per role (P0-5):
 * - PENGELOLA: hanya laporan di cluster tugasnya (staffClusterId).
 * - MANAGER: hanya laporan di cluster yang sedang ditautkan kepadanya.
 * - Role lain tidak punya ARCHIVE_REPORT (Admin dicabut), ditolak di assertPermission.
 */
async function assertArchiveScope(
  actor: SessionUser,
  clusterId: string,
  clusterName: string
) {
  if (actor.role === "PENGELOLA") {
    if (!actor.staffClusterId || actor.staffClusterId !== clusterId) {
      throw new Error(
        `Akses ditolak: Laporan ini berada di ${clusterName}, di luar cluster tugas Anda.`
      );
    }
    return;
  }

  if (actor.role === "MANAGER") {
    const assignment = await queryOne<{ id: string }>(
      `SELECT "id"
       FROM "ClusterManagerAssignment" cma
       WHERE cma."userId" = $1
         AND cma."clusterId" = $2
         AND ${activeAssignmentSql("cma", "$3")}
       LIMIT 1`,
      [actor.id, clusterId, new Date()]
    );
    if (!assignment) {
      throw new Error(
        `Akses ditolak: Anda tidak memiliki penugasan manajer untuk ${clusterName}.`
      );
    }
    return;
  }

  throw new Error("Akses ditolak: Role Anda tidak dapat mengarsipkan laporan.");
}

/**
 * Mengarsipkan laporan (tidak ada hapus permanen sesuai PRD Fase 0).
 */
export async function archiveReportById(actor: SessionUser, reportId: string) {
  assertPermission(actor.role, "ARCHIVE_REPORT");

  if (!actor.companyId) {
    throw new Error("Akun tidak terhubung ke perusahaan.");
  }
  const companyId = actor.companyId;

  const existing = await queryOne<
    ReportRow & { clusterId: string; clusterName: string }
  >(
    `SELECT r.*, p."clusterId" AS "clusterId", cl."name" AS "clusterName"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     WHERE r."id" = $1 AND r."companyId" = $2 AND r."archivedAt" IS NULL`,
    [reportId, companyId]
  );

  if (!existing) {
    throw new Error("Laporan tidak ditemukan atau sudah diarsipkan.");
  }

  await assertArchiveScope(actor, existing.clusterId, existing.clusterName);

  return withTransaction(async (tx) => {
    const now = new Date();
    const count = await execute(
      `UPDATE "Report"
       SET "archivedAt" = $2, "updatedAt" = $2
       WHERE "id" = $1 AND "archivedAt" IS NULL`,
      [existing.id, now],
      tx
    );
    if (count !== 1) {
      throw new Error("Laporan sudah diarsipkan oleh pengguna lain.");
    }

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "Report",
        entityId: existing.id,
        action: "ARCHIVE",
        summary: `Mengarsipkan laporan tiket ${existing.ticketNo}`,
        oldValues: { archivedAt: null },
        newValues: { archivedAt: now.toISOString() },
      },
      tx
    );

    const updated = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [existing.id],
      tx
    );
    if (!updated) throw new Error("Laporan tidak ditemukan.");
    return updated;
  });
}

/**
 * Memulihkan laporan dari arsip. Dibatasi perusahaan aktor & tercatat di AuditLog.
 */
export async function restoreArchivedReportById(
  actor: SessionUser,
  reportId: string
) {
  assertPermission(actor.role, "ARCHIVE_REPORT");

  if (!actor.companyId) {
    throw new Error("Akun tidak terhubung ke perusahaan.");
  }
  const companyId = actor.companyId;

  const existing = await queryOne<
    ReportRow & { clusterId: string; clusterName: string }
  >(
    `SELECT r.*, p."clusterId" AS "clusterId", cl."name" AS "clusterName"
     FROM "Report" r
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     WHERE r."id" = $1 AND r."companyId" = $2 AND r."archivedAt" IS NOT NULL`,
    [reportId, companyId]
  );

  if (!existing) {
    throw new Error("Laporan arsip tidak ditemukan di perusahaan Anda.");
  }

  await assertArchiveScope(actor, existing.clusterId, existing.clusterName);

  return withTransaction(async (tx) => {
    const count = await execute(
      `UPDATE "Report"
       SET "archivedAt" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "archivedAt" IS NOT NULL`,
      [existing.id],
      tx
    );
    if (count !== 1) {
      throw new Error("Laporan sudah dipulihkan oleh pengguna lain.");
    }

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "Report",
        entityId: existing.id,
        action: "UPDATE",
        summary: `Memulihkan laporan tiket ${existing.ticketNo} dari arsip`,
        oldValues: { archivedAt: existing.archivedAt?.toISOString() ?? null },
        newValues: { archivedAt: null },
      },
      tx
    );

    const updated = await queryOne<ReportRow>(
      `SELECT * FROM "Report" WHERE "id" = $1`,
      [existing.id],
      tx
    );
    if (!updated) throw new Error("Laporan tidak ditemukan.");
    return updated;
  });
}

