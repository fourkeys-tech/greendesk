import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  ApprovalStatus,
  ClusterRow,
  RevisionNoteRow,
  TechnicianStatus,
  VendorReplacementRequestRow,
  VendorRow,
  WorkOrderRow,
} from "../db-types";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import { nextReplacementRequestNumber } from "../numbering";
import { getManagerAssignedClusterIds } from "./phase5-decision";
import { activeAssignmentSql } from "../scopes";
import type { SessionUser } from "../auth";

/**
 * PGL-M4: Pengelola mengajukan pergantian vendor untuk aset yang rusak berulang
 * Aturan PRD Bagian 7:
 * - Pengelola mengisi: aset, vendor yang dipersoalkan, laporan berulang (minimal 2 laporan), alasan
 * - Status awal: DIAJUKAN
 * - Notifikasi web dikirim ke Manager cluster
 */
export async function submitVendorReplacementRequest(
  actor: SessionUser,
  input: {
    assetId: string;
    vendorId: string;
    basisReportIds: string[];
    reason: string;
  }
) {
  assertPermission(actor.role, "VIEW_REPORTS");

  if (actor.role !== "PENGELOLA") {
    throw new Error(
      "Akses ditolak: Hanya Pengelola yang dapat mengajukan pergantian vendor."
    );
  }

  if (!actor.companyId || !actor.staffClusterId) {
    throw new Error("Akun Pengelola Anda belum ditautkan ke cluster mana pun.");
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new Error("Alasan pengajuan pergantian vendor wajib diisi.");
  }

  if (!input.basisReportIds || input.basisReportIds.length < 2) {
    throw new Error(
      "Pengajuan pergantian vendor memerlukan minimal 2 laporan berulang sebagai bukti kerusakan berulang."
    );
  }

  // Verifikasi aset berada di cluster Pengelola
  const asset = await queryOne<{
    id: string;
    name: string;
    companyId: string;
    clusterId: string;
    clusterName: string;
  }>(
    `SELECT a."id", a."name", a."companyId", p."clusterId", cl."name" AS "clusterName"
     FROM "Asset" a
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Cluster" cl ON cl."id" = p."clusterId"
     WHERE a."id" = $1 AND a."companyId" = $2`,
    [input.assetId, actor.companyId]
  );

  if (!asset) {
    throw new Error("Aset tidak ditemukan.");
  }

  if (asset.clusterId !== actor.staffClusterId) {
    throw new Error(
      `Akses ditolak: Aset ini berada di ${asset.clusterName}, di luar cluster tanggung jawab Anda.`
    );
  }

  // Verifikasi vendor terdaftar di perusahaan
  const vendor = await queryOne<{ id: string; name: string }>(
    `SELECT "id", "name" FROM "Vendor" WHERE "id" = $1 AND "companyId" = $2`,
    [input.vendorId, actor.companyId]
  );

  if (!vendor) {
    throw new Error("Vendor yang dipersoalkan tidak ditemukan.");
  }

  // Verifikasi semua basis laporan adalah untuk aset ini dan merupakan laporan valid
  const reports = await query<{ id: string; ticketNo: string }>(
    `SELECT "id", "ticketNo"
     FROM "Report"
     WHERE "id" = ANY($1::text[])
       AND "assetId" = $2
       AND "companyId" = $3
       AND "archivedAt" IS NULL
       AND "status" NOT IN ('DIBATALKAN', 'TIDAK_VALID')`,
    [input.basisReportIds, asset.id, actor.companyId]
  );

  if (reports.length < 2) {
    throw new Error(
      "Semua laporan pembuktian harus terdaftar pada aset yang sama dan minimal 2 laporan valid (bukan laporan dibatalkan/tidak valid)."
    );
  }

  const companyId = actor.companyId;
  const basisReportIds = reports.map((r) => r.id);

  const request = await withTransaction(async (tx) => {
    const requestNo = await nextReplacementRequestNumber(tx, companyId);

    const created = await queryOne<VendorReplacementRequestRow>(
      `INSERT INTO "VendorReplacementRequest" (
         "companyId", "requestNo", "clusterId", "assetId", "vendorId",
         "basisReportIds", "reason", "status", "submittedById"
       )
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, 'DIAJUKAN'::"VendorReplacementStatus", $8)
       RETURNING *`,
      [
        companyId,
        requestNo,
        asset.clusterId,
        asset.id,
        vendor.id,
        basisReportIds,
        reason,
        actor.id,
      ],
      tx
    );
    if (!created) throw new Error("Gagal membuat pengajuan ganti vendor.");

    // Kirim notifikasi web ke seluruh Manager yang bertugas di cluster ini
    const now = new Date();
    const managerAssignments = await query<{ userId: string }>(
      `SELECT DISTINCT cma."userId"
       FROM "ClusterManagerAssignment" cma
       JOIN "User" u ON u."id" = cma."userId"
       WHERE cma."clusterId" = $1
         AND ${activeAssignmentSql("cma", "$2")}
         AND u."isActive" = true`,
      [asset.clusterId, now],
      tx
    );
    const managerIds = managerAssignments.map((ma) => ma.userId);

    if (managerIds.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, unnest($2::text[]), $3, $4, $5`,
        [
          companyId,
          managerIds,
          `Pengajuan Ganti Vendor (${requestNo})`,
          `Pengelola ${actor.name} mengajukan pergantian vendor ${vendor.name} untuk aset ${asset.name}. Silakan tinjau dan putuskan.`,
          `/dashboard/pengajuan-ganti-vendor`,
        ],
        tx
      );
    }

    await recordAuditLog(
      {
        companyId,
        actor,
        entityName: "VendorReplacementRequest",
        entityId: created.id,
        action: "CREATE",
        summary: `Pengelola ${actor.name} mengajukan pergantian vendor ${vendor.name} (${requestNo}) untuk aset ${asset.name}`,
        newValues: {
          requestNo,
          assetName: asset.name,
          vendorName: vendor.name,
          reason,
          basisReportsCount: basisReportIds.length,
        },
      },
      tx
    );

    return created;
  });

  return { success: true, request };
}

/**
 * MGR-M5: Manager memutuskan Pengajuan Ganti Vendor (Setuju atau Tolak)
 * - Jika TOLAK: Wajib beralasan; status -> DITOLAK; notifikasi web kembali ke Pengelola
 * - Jika SETUJU: Catatan opsional; status -> DISETUJUI; notifikasi web ke Admin untuk diteruskan ke Owner
 */
export async function decideVendorReplacementByManager(
  actor: SessionUser,
  input: {
    requestId: string;
    decision: "SETUJU" | "TOLAK";
    decisionNote?: string;
  }
) {
  assertPermission(actor.role, "DECIDE_REPAIR");

  if (actor.role !== "MANAGER") {
    throw new Error(
      "Akses ditolak: Hanya Manager yang dapat memutuskan pengajuan pergantian vendor."
    );
  }

  if (!actor.companyId) {
    throw new Error("Akun Manager tidak terhubung ke perusahaan.");
  }

  const clusterIds = await getManagerAssignedClusterIds(actor.id);

  const request = await queryOne<
    VendorReplacementRequestRow & {
      assetName: string;
      vendorName: string;
      clusterName: string;
    }
  >(
    `SELECT vrr.*, a."name" AS "assetName", v."name" AS "vendorName", cl."name" AS "clusterName"
     FROM "VendorReplacementRequest" vrr
     JOIN "Asset" a ON a."id" = vrr."assetId"
     JOIN "Vendor" v ON v."id" = vrr."vendorId"
     JOIN "Cluster" cl ON cl."id" = vrr."clusterId"
     WHERE vrr."id" = $1 AND vrr."companyId" = $2`,
    [input.requestId, actor.companyId]
  );

  if (!request) {
    throw new Error("Pengajuan pergantian vendor tidak ditemukan.");
  }

  if (!clusterIds.includes(request.clusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki wewenang pada cluster ${request.clusterName}.`
    );
  }

  if (request.status !== "DIAJUKAN") {
    throw new Error(
      `Pengajuan ini sudah berstatus ${request.status} dan tidak dapat diubah lagi.`
    );
  }

  const now = new Date();

  // 1. Cabang TOLAK
  if (input.decision === "TOLAK") {
    const note = input.decisionNote?.trim();
    if (!note) {
      throw new Error(
        "Penolakan pengajuan ganti vendor wajib mencantumkan alasan."
      );
    }

    const companyId = actor.companyId;
    const updated = await withTransaction(async (tx) => {
      // Guard status: dua keputusan bersamaan → hanya satu lolos
      const count = await execute(
        `UPDATE "VendorReplacementRequest"
         SET "status" = 'DITOLAK'::"VendorReplacementStatus",
             "managerDecisionNote" = $2,
             "managerDecidedById" = $3,
             "managerDecidedAt" = $4,
             "updatedAt" = NOW()
         WHERE "id" = $1 AND "status" = 'DIAJUKAN'::"VendorReplacementStatus"`,
        [request.id, note, actor.id, now],
        tx
      );
      if (count !== 1) {
        throw new Error("Status pengajuan sudah berubah, muat ulang halaman.");
      }

      // Notifikasi Web ke Pengelola pengaju
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          request.submittedById,
          `Pengajuan Ganti Vendor Ditolak (${request.requestNo})`,
          `Manager ${actor.name} menolak pengajuan ganti vendor untuk aset ${request.assetName}. Alasan: ${note}`,
          `/dashboard/pengajuan-ganti-vendor`,
        ],
        tx
      );

      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "VendorReplacementRequest",
          entityId: request.id,
          action: "UPDATE",
          summary: `Manager ${actor.name} menolak pengajuan ganti vendor ${request.requestNo}. Alasan: ${note}`,
          oldValues: { status: "DIAJUKAN" },
          newValues: { status: "DITOLAK", managerDecisionNote: note },
        },
        tx
      );

      const saved = await queryOne<VendorReplacementRequestRow>(
        `SELECT * FROM "VendorReplacementRequest" WHERE "id" = $1`,
        [request.id],
        tx
      );
      if (!saved) throw new Error("Pengajuan tidak ditemukan.");
      return saved;
    });

    return { success: true, decision: "DITOLAK", request: updated };
  }

  // 2. Cabang SETUJU
  if (input.decision === "SETUJU") {
    const note = input.decisionNote?.trim() || null;
    const companyId = actor.companyId;

    const updated = await withTransaction(async (tx) => {
      const count = await execute(
        `UPDATE "VendorReplacementRequest"
         SET "status" = 'DISETUJUI'::"VendorReplacementStatus",
             "managerDecisionNote" = $2,
             "managerDecidedById" = $3,
             "managerDecidedAt" = $4,
             "updatedAt" = NOW()
         WHERE "id" = $1 AND "status" = 'DIAJUKAN'::"VendorReplacementStatus"`,
        [request.id, note, actor.id, now],
        tx
      );
      if (count !== 1) {
        throw new Error("Status pengajuan sudah berubah, muat ulang halaman.");
      }

      // Kirim Notifikasi Web ke Admin Perusahaan (untuk diteruskan ke Owner)
      const admins = await query<{ id: string }>(
        `SELECT "id" FROM "User" WHERE "companyId" = $1 AND "role" = 'ADMIN'::"Role" AND "isActive" = true`,
        [companyId],
        tx
      );

      if (admins.length > 0) {
        await execute(
          `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
           SELECT $1, unnest($2::text[]), $3, $4, $5`,
          [
            companyId,
            admins.map((a) => a.id),
            `Pengajuan Ganti Vendor Disetujui (${request.requestNo})`,
            `Manager ${actor.name} menyetujui pergantian vendor ${request.vendorName} untuk aset ${request.assetName}. Silakan teruskan ke Owner.`,
            `/dashboard/pengajuan-ganti-vendor`,
          ],
          tx
        );
      }

      await recordAuditLog(
        {
          companyId,
          actor,
          entityName: "VendorReplacementRequest",
          entityId: request.id,
          action: "UPDATE",
          summary: `Manager ${actor.name} menyetujui pengajuan ganti vendor ${request.requestNo}`,
          oldValues: { status: "DIAJUKAN" },
          newValues: { status: "DISETUJUI", managerDecisionNote: note },
        },
        tx
      );

      const saved = await queryOne<VendorReplacementRequestRow>(
        `SELECT * FROM "VendorReplacementRequest" WHERE "id" = $1`,
        [request.id],
        tx
      );
      if (!saved) throw new Error("Pengajuan tidak ditemukan.");
      return saved;
    });

    return { success: true, decision: "DISETUJUI", request: updated };
  }

  throw new Error("Keputusan tidak valid. Pilih SETUJU atau TOLAK.");
}

/**
 * Admin meneruskan pengajuan ganti vendor yang telah disetujui Manager ke Owner.
 * Status -> DITERUSKAN_KE_OWNER
 */
export async function forwardVendorReplacementByAdmin(
  actor: SessionUser,
  input: {
    requestId: string;
    forwardNote?: string;
  }
) {
  assertPermission(actor.role, "MANAGE_VENDORS");
  if (actor.role !== "ADMIN") {
    throw new Error(
      "Akses ditolak: Hanya Admin yang dapat meneruskan eskalasi ke Owner."
    );
  }
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }

  const request = await queryOne<
    VendorReplacementRequestRow & { assetName: string; vendorName: string }
  >(
    `SELECT vrr.*, a."name" AS "assetName", v."name" AS "vendorName"
     FROM "VendorReplacementRequest" vrr
     JOIN "Asset" a ON a."id" = vrr."assetId"
     JOIN "Vendor" v ON v."id" = vrr."vendorId"
     WHERE vrr."id" = $1 AND vrr."companyId" = $2`,
    [input.requestId, actor.companyId]
  );

  if (!request) {
    throw new Error("Pengajuan pergantian vendor tidak ditemukan.");
  }

  if (request.status !== "DISETUJUI") {
    throw new Error(
      `Pengajuan ini berstatus ${request.status}. Hanya pengajuan berstatus Disetujui yang dapat diteruskan ke Owner.`
    );
  }

  const now = new Date();
  const forwardNote = input.forwardNote?.trim() || null;
  const companyId = actor.companyId;

  const updated = await withTransaction(async (tx) => {
    const count = await execute(
      `UPDATE "VendorReplacementRequest"
       SET "status" = 'DITERUSKAN_KE_OWNER'::"VendorReplacementStatus",
           "adminForwardedById" = $2,
           "adminForwardedAt" = $3,
           "adminForwardedNote" = $4,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'DISETUJUI'::"VendorReplacementStatus"`,
      [request.id, actor.id, now, forwardNote],
      tx
    );
    if (count !== 1) {
      throw new Error("Status pengajuan sudah berubah, muat ulang halaman.");
    }

    // Notifikasi Web ke Owner / Direksi
    const owners = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "companyId" = $1 AND "role" = 'OWNER'::"Role" AND "isActive" = true`,
      [companyId],
      tx
    );

    if (owners.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, unnest($2::text[]), $3, $4, $5`,
        [
          companyId,
          owners.map((o) => o.id),
          `Eskalasi Pergantian Vendor Diterima (${request.requestNo})`,
          `Admin ${actor.name} meneruskan pengajuan pergantian vendor ${request.vendorName} untuk aset ${request.assetName}.`,
          `/dashboard/pengajuan-ganti-vendor`,
        ],
        tx
      );
    }

    await recordAuditLog(
      {
        companyId,
        actor,
        entityName: "VendorReplacementRequest",
        entityId: request.id,
        action: "UPDATE",
        summary: `Admin ${actor.name} meneruskan pengajuan ganti vendor ${request.requestNo} ke Owner`,
        oldValues: { status: "DISETUJUI" },
        newValues: { status: "DITERUSKAN_KE_OWNER", adminForwardedNote: forwardNote },
      },
      tx
    );

    const saved = await queryOne<VendorReplacementRequestRow>(
      `SELECT * FROM "VendorReplacementRequest" WHERE "id" = $1`,
      [request.id],
      tx
    );
    if (!saved) throw new Error("Pengajuan tidak ditemukan.");
    return saved;
  });

  return { success: true, request: updated };
}

/**
 * Owner menandai bahwa eskalasi telah ditinjau (ownerViewedAt)
 */
export async function markVendorReplacementViewedByOwner(
  actor: SessionUser,
  requestId: string
) {
  if (actor.role !== "OWNER") {
    throw new Error("Akses ditolak: Hanya Owner yang dapat mengakses fitur ini.");
  }
  if (!actor.companyId) {
    throw new Error("Akun Owner tidak terhubung ke perusahaan.");
  }

  const request = await queryOne<VendorReplacementRequestRow>(
    `SELECT *
     FROM "VendorReplacementRequest"
     WHERE "id" = $1
       AND "companyId" = $2
       AND "status" = 'DITERUSKAN_KE_OWNER'::"VendorReplacementStatus"`,
    [requestId, actor.companyId]
  );
  if (!request) {
    throw new Error("Eskalasi pergantian vendor tidak ditemukan.");
  }
  if (request.ownerViewedAt) return request;

  const updated = await queryOne<VendorReplacementRequestRow>(
    `UPDATE "VendorReplacementRequest"
     SET "ownerViewedAt" = NOW(), "updatedAt" = NOW()
     WHERE "id" = $1
     RETURNING *`,
    [request.id]
  );
  return updated ?? request;
}

/**
 * MGR-M7: Mengambil Rapor Kinerja Vendor Ringkas & Mendalam
 * Dihitung otomatis dari riwayat SPK (WorkOrder):
 * 1. Jumlah total pekerjaan (totalJobs)
 * 2. Rata-rata lama pengerjaan (avgDurationHours)
 * 3. Jumlah perbaikan ulang (revisionCount dari RevisionNote)
 * 4. Pekerjaan rusak lagi dalam garansi (warrantyDefectsCount)
 */
export async function getVendorReportCard(
  companyId: string,
  vendorId: string
) {
  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "id" = $1 AND "companyId" = $2`,
    [vendorId, companyId]
  );

  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const [technicians, serviceAreaRows, workOrders, warrantyDefectsCount] =
    await Promise.all([
      query<{
        id: string;
        fullName: string;
        status: TechnicianStatus;
        approvalStatus: ApprovalStatus;
        skills: string[];
      }>(
        `SELECT "id", "fullName", "status", "approvalStatus", "skills"
         FROM "Technician"
         WHERE "vendorId" = $1`,
        [vendor.id]
      ),
      query<{
        id: string;
        vendorId: string;
        clusterId: string;
        cId: string;
        cCompanyId: string;
        cComplexId: string;
        cName: string;
        cIsActive: boolean;
        cCreatedAt: Date;
        cUpdatedAt: Date;
      }>(
        `SELECT vsa."id", vsa."vendorId", vsa."clusterId",
                cl."id" AS "cId", cl."companyId" AS "cCompanyId", cl."complexId" AS "cComplexId",
                cl."name" AS "cName", cl."isActive" AS "cIsActive",
                cl."createdAt" AS "cCreatedAt", cl."updatedAt" AS "cUpdatedAt"
         FROM "VendorServiceArea" vsa
         JOIN "Cluster" cl ON cl."id" = vsa."clusterId"
         WHERE vsa."vendorId" = $1`,
        [vendor.id]
      ),
      query<WorkOrderRow>(
        `SELECT wo.*
         FROM "WorkOrder" wo
         JOIN "Report" r ON r."id" = wo."reportId"
         WHERE wo."vendorId" = $1
           AND wo."companyId" = $2
           AND r."archivedAt" IS NULL`,
        [vendor.id, companyId]
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count
         FROM "Report"
         WHERE "companyId" = $1
           AND "underWarrantyOfVendorId" = $2
           AND "archivedAt" IS NULL
           AND "status" NOT IN ('DIBATALKAN', 'TIDAK_VALID', 'DIGABUNG')`,
        [companyId, vendor.id]
      ),
    ]);

  const woIds = workOrders.map((w) => w.id);
  const revisionNotes =
    woIds.length > 0
      ? await query<RevisionNoteRow>(
          `SELECT * FROM "RevisionNote" WHERE "workOrderId" = ANY($1::text[])`,
          [woIds]
        )
      : [];
  const revByWo = new Map<string, RevisionNoteRow[]>();
  for (const rn of revisionNotes) {
    const arr = revByWo.get(rn.workOrderId) ?? [];
    arr.push(rn);
    revByWo.set(rn.workOrderId, arr);
  }

  const totalJobs = workOrders.length;
  let totalDurationHours = 0;
  let completedCount = 0;
  let revisionCount = 0;

  for (const wo of workOrders) {
    revisionCount += (revByWo.get(wo.id) ?? []).length;
    // Durasi pengerjaan = sejak ditugaskan sampai teknisi melapor selesai (submittedAt);
    // fallback completedAt untuk SPK lama yang dibuat sebelum kolom submittedAt ada.
    const finishedAt = wo.submittedAt ?? wo.completedAt;
    if (wo.assignedAt && finishedAt && wo.completedAt) {
      const diffMs = finishedAt.getTime() - wo.assignedAt.getTime();
      const hours = Math.max(0, diffMs / (1000 * 60 * 60));
      totalDurationHours += hours;
      completedCount++;
    }
  }

  const avgDurationHours =
    completedCount > 0 ? Math.round((totalDurationHours / completedCount) * 10) / 10 : 0;

  const serviceAreas: Array<{
    id: string;
    vendorId: string;
    clusterId: string;
    cluster: ClusterRow;
  }> = serviceAreaRows.map((sa) => ({
    id: sa.id,
    vendorId: sa.vendorId,
    clusterId: sa.clusterId,
    cluster: {
      id: sa.cId,
      companyId: sa.cCompanyId,
      complexId: sa.cComplexId,
      name: sa.cName,
      isActive: sa.cIsActive,
      createdAt: sa.cCreatedAt,
      updatedAt: sa.cUpdatedAt,
    },
  }));

  return {
    vendor: {
      ...vendor,
      technicians,
      serviceAreas,
    },
    metrics: {
      totalJobs,
      completedJobs: completedCount,
      avgDurationHours,
      revisionCount,
      warrantyDefectsCount,
    },
  };
}
