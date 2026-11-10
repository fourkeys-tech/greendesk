import { prisma } from "../prisma";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import { getManagerAssignedClusterIds } from "./phase5-decision";
import { activeAssignmentWhere } from "../scopes";
import type { SessionUser } from "../auth";

/**
 * Menghasilkan nomor pengajuan ganti vendor sekuensial (format: PGV-YYYYMM-XXXX)
 */
export async function generateNextReplacementRequestNo(
  companyId: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PGV-${year}${month}-`;

  const lastReq = await prisma.vendorReplacementRequest.findFirst({
    where: {
      companyId,
      requestNo: { startsWith: prefix },
    },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  });

  let nextSeq = 1;
  if (lastReq) {
    const parts = lastReq.requestNo.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) {
      nextSeq = num + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

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
  const asset = await prisma.asset.findFirst({
    where: {
      id: input.assetId,
      companyId: actor.companyId,
    },
    include: {
      park: {
        include: { cluster: true },
      },
    },
  });

  if (!asset) {
    throw new Error("Aset tidak ditemukan.");
  }

  if (asset.park.clusterId !== actor.staffClusterId) {
    throw new Error(
      `Akses ditolak: Aset ini berada di ${asset.park.cluster.name}, di luar cluster tanggung jawab Anda.`
    );
  }

  // Verifikasi vendor terdaftar di perusahaan
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: input.vendorId,
      companyId: actor.companyId,
    },
  });

  if (!vendor) {
    throw new Error("Vendor yang dipersoalkan tidak ditemukan.");
  }

  // Verifikasi semua basis laporan adalah untuk aset ini dan merupakan laporan valid
  const reports = await prisma.report.findMany({
    where: {
      id: { in: input.basisReportIds },
      assetId: asset.id,
      companyId: actor.companyId,
      status: { notIn: ["DIBATALKAN", "TIDAK_VALID"] },
    },
    select: { id: true, ticketNo: true },
  });

  if (reports.length < 2) {
    throw new Error(
      "Semua laporan pembuktian harus terdaftar pada aset yang sama dan minimal 2 laporan valid (bukan laporan dibatalkan/tidak valid)."
    );
  }

  const requestNo = await generateNextReplacementRequestNo(actor.companyId);

  const request = await prisma.$transaction(
    async (tx) => {
      const created = await tx.vendorReplacementRequest.create({
        data: {
          companyId: actor.companyId!,
          requestNo,
          clusterId: asset.park.clusterId,
          assetId: asset.id,
          vendorId: vendor.id,
          basisReportIds: input.basisReportIds,
          reason,
          status: "DIAJUKAN",
          submittedById: actor.id,
        },
      });

      // Kirim notifikasi web ke seluruh Manager yang bertugas di cluster ini
      const now = new Date();
      const managerAssignments = await tx.clusterManagerAssignment.findMany({
        where: {
          clusterId: asset.park.clusterId,
          ...activeAssignmentWhere(now),
          user: { isActive: true },
        },
        select: { userId: true },
      });

      for (const ma of managerAssignments) {
        await tx.notification.create({
          data: {
            companyId: actor.companyId,
            recipientId: ma.userId,
            title: `Pengajuan Ganti Vendor (${requestNo})`,
            message: `Pengelola ${actor.name} mengajukan pergantian vendor ${vendor.name} untuk aset ${asset.name}. Silakan tinjau dan putuskan.`,
            linkUrl: `/dashboard/pengajuan-ganti-vendor`,
          },
        });
      }

      return created;
    },
    { maxWait: 10000, timeout: 30000 }
  );

  // Catat AuditLog
  await recordAuditLog({
    companyId: actor.companyId!,
    actor,
    entityName: "VendorReplacementRequest",
    entityId: request.id,
    action: "CREATE",
    summary: `Pengelola ${actor.name} mengajukan pergantian vendor ${vendor.name} (${requestNo}) untuk aset ${asset.name}`,
    newValues: {
      requestNo,
      assetName: asset.name,
      vendorName: vendor.name,
      reason,
      basisReportsCount: input.basisReportIds.length,
    },
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

  const request = await prisma.vendorReplacementRequest.findFirst({
    where: {
      id: input.requestId,
      companyId: actor.companyId,
    },
    include: {
      asset: true,
      vendor: true,
      cluster: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!request) {
    throw new Error("Pengajuan pergantian vendor tidak ditemukan.");
  }

  if (!clusterIds.includes(request.clusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki wewenang pada cluster ${request.cluster.name}.`
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

    const updated = await prisma.$transaction(
      async (tx) => {
        const res = await tx.vendorReplacementRequest.update({
          where: { id: request.id },
          data: {
            status: "DITOLAK",
            managerDecisionNote: note,
            managerDecidedById: actor.id,
            managerDecidedAt: now,
          },
        });

        // Notifikasi Web ke Pengelola pengaju
        await tx.notification.create({
          data: {
            companyId: actor.companyId,
            recipientId: request.submittedById,
            title: `Pengajuan Ganti Vendor Ditolak (${request.requestNo})`,
            message: `Manager ${actor.name} menolak pengajuan ganti vendor untuk aset ${request.asset.name}. Alasan: ${note}`,
            linkUrl: `/dashboard/pengajuan-ganti-vendor`,
          },
        });

        return res;
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // Catat AuditLog
    await recordAuditLog({
      companyId: actor.companyId!,
      actor,
      entityName: "VendorReplacementRequest",
      entityId: request.id,
      action: "UPDATE",
      summary: `Manager ${actor.name} menolak pengajuan ganti vendor ${request.requestNo}. Alasan: ${note}`,
      oldValues: { status: "DIAJUKAN" },
      newValues: { status: "DITOLAK", managerDecisionNote: note },
    });

    return { success: true, decision: "DITOLAK", request: updated };
  }

  // 2. Cabang SETUJU
  if (input.decision === "SETUJU") {
    const note = input.decisionNote?.trim() || null;

    const updated = await prisma.$transaction(
      async (tx) => {
        const res = await tx.vendorReplacementRequest.update({
          where: { id: request.id },
          data: {
            status: "DISETUJUI",
            managerDecisionNote: note,
            managerDecidedById: actor.id,
            managerDecidedAt: now,
          },
        });

        // Kirim Notifikasi Web ke Admin Perusahaan (untuk diteruskan ke Owner)
        const admins = await tx.user.findMany({
          where: {
            companyId: actor.companyId,
            role: "ADMIN",
            isActive: true,
          },
          select: { id: true },
        });

        for (const adm of admins) {
          await tx.notification.create({
            data: {
              companyId: actor.companyId,
              recipientId: adm.id,
              title: `Pengajuan Ganti Vendor Disetujui (${request.requestNo})`,
              message: `Manager ${actor.name} menyetujui pergantian vendor ${request.vendor.name} untuk aset ${request.asset.name}. Silakan teruskan ke Owner.`,
              linkUrl: `/dashboard/pengajuan-ganti-vendor`,
            },
          });
        }

        return res;
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // Catat AuditLog
    await recordAuditLog({
      companyId: actor.companyId!,
      actor,
      entityName: "VendorReplacementRequest",
      entityId: request.id,
      action: "UPDATE",
      summary: `Manager ${actor.name} menyetujui pengajuan ganti vendor ${request.requestNo}`,
      oldValues: { status: "DIAJUKAN" },
      newValues: { status: "DISETUJUI", managerDecisionNote: note },
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

  const request = await prisma.vendorReplacementRequest.findFirst({
    where: {
      id: input.requestId,
      companyId: actor.companyId,
    },
    include: {
      asset: true,
      vendor: true,
    },
  });

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

  const updated = await prisma.$transaction(
    async (tx) => {
      const res = await tx.vendorReplacementRequest.update({
        where: { id: request.id },
        data: {
          status: "DITERUSKAN_KE_OWNER",
          adminForwardedById: actor.id,
          adminForwardedAt: now,
          adminForwardedNote: forwardNote,
        },
      });

      // Notifikasi Web ke Owner / Direksi
      const owners = await tx.user.findMany({
        where: {
          companyId: actor.companyId,
          role: "OWNER",
          isActive: true,
        },
        select: { id: true },
      });

      for (const own of owners) {
        await tx.notification.create({
          data: {
            companyId: actor.companyId,
            recipientId: own.id,
            title: `Eskalasi Pergantian Vendor Diterima (${request.requestNo})`,
            message: `Admin ${actor.name} meneruskan pengajuan pergantian vendor ${request.vendor.name} untuk aset ${request.asset.name}.`,
            linkUrl: `/dashboard/pengajuan-ganti-vendor`,
          },
        });
      }

      return res;
    },
    { maxWait: 10000, timeout: 30000 }
  );

  // Catat AuditLog
  await recordAuditLog({
    companyId: actor.companyId!,
    actor,
    entityName: "VendorReplacementRequest",
    entityId: request.id,
    action: "UPDATE",
    summary: `Admin ${actor.name} meneruskan pengajuan ganti vendor ${request.requestNo} ke Owner`,
    oldValues: { status: "DISETUJUI" },
    newValues: { status: "DITERUSKAN_KE_OWNER", adminForwardedNote: forwardNote },
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

  const request = await prisma.vendorReplacementRequest.findFirst({
    where: {
      id: requestId,
      companyId: actor.companyId,
      status: "DITERUSKAN_KE_OWNER",
    },
  });
  if (!request) {
    throw new Error("Eskalasi pergantian vendor tidak ditemukan.");
  }
  if (request.ownerViewedAt) return request;

  return prisma.vendorReplacementRequest.update({
    where: { id: request.id },
    data: { ownerViewedAt: new Date() },
  });
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
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
    include: {
      technicians: {
        select: {
          id: true,
          fullName: true,
          status: true,
          approvalStatus: true,
          skills: true,
        },
      },
      serviceAreas: {
        include: { cluster: true },
      },
    },
  });

  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const workOrders = await prisma.workOrder.findMany({
    where: {
      vendorId: vendor.id,
      companyId,
    },
    include: {
      revisionNotes: true,
      report: {
        select: { id: true, ticketNo: true, status: true },
      },
    },
  });

  const totalJobs = workOrders.length;
  let totalDurationHours = 0;
  let completedCount = 0;
  let revisionCount = 0;

  for (const wo of workOrders) {
    revisionCount += wo.revisionNotes.length;
    if (wo.assignedAt && wo.completedAt) {
      const diffMs = wo.completedAt.getTime() - wo.assignedAt.getTime();
      const hours = diffMs / (1000 * 60 * 60);
      totalDurationHours += hours;
      completedCount++;
    }
  }

  const avgDurationHours =
    completedCount > 0 ? Math.round((totalDurationHours / completedCount) * 10) / 10 : 0;

  // Hitung laporan kerusakan ulang dalam masa garansi vendor ini (yang terbukti valid)
  const warrantyDefectsCount = await prisma.report.count({
    where: {
      companyId,
      underWarrantyOfVendorId: vendor.id,
      archivedAt: null,
      status: { notIn: ["DIBATALKAN", "TIDAK_VALID", "DIGABUNG"] },
    },
  });

  return {
    vendor,
    metrics: {
      totalJobs,
      completedJobs: completedCount,
      avgDurationHours,
      revisionCount,
      warrantyDefectsCount,
    },
  };
}
