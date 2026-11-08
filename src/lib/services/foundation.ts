import { prisma } from "../prisma";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import type { SessionUser } from "../auth";

/**
 * Mengambil daftar laporan sesuai cakupan role & multi-perusahaan (Bagian 4 & 14.2 PRD).
 * Khusus Teknisi: TIDAK meng-select identitas pelapor (nama/email) sama sekali demi privasi.
 */
export async function getScopedReportsForUser(
  user: SessionUser,
  options?: { includeArchived?: boolean }
) {
  const archivedFilter = options?.includeArchived
    ? { not: null }
    : null;

  if (user.role === "TEKNISI") {
    const tech = await prisma.technician.findUnique({
      where: { userId: user.id },
    });
    if (!tech) return [];

    // Teknisi TIDAK BOLEH meng-select field reporter sama sekali (PRD 14.5)
    return prisma.report.findMany({
      where: {
        companyId: tech.companyId,
        archivedAt: archivedFilter,
        workOrder: {
          technicianId: tech.id,
        },
      },
      select: {
        id: true,
        ticketNo: true,
        channel: true,
        description: true,
        status: true,
        priority: true,
        reason: true,
        stageEnteredAt: true,
        createdAt: true,
        archivedAt: true,
        photos: true,
        asset: {
          select: {
            code: true,
            name: true,
            locationNote: true,
            park: {
              select: {
                name: true,
                cluster: { select: { name: true } },
              },
            },
          },
        },
        workOrder: {
          select: {
            id: true,
            spkNo: true,
            assignedAt: true,
            completedAt: true,
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Untuk role selain Teknisi
  const commonInclude = {
    asset: {
      include: {
        park: {
          include: {
            cluster: {
              include: { complex: true },
            },
          },
        },
        category: true,
      },
    },
    reporter: {
      select: {
        id: true,
        name: true,
        email: true,
        reporterStatus: true,
        blockHouseNo: true,
      },
    },
    workOrder: {
      include: {
        vendor: true,
        technician: true,
      },
    },
    photos: true,
    underWarrantyOfVendor: {
      select: { id: true, name: true },
    },
  };

  if (user.role === "PENGGUNA") {
    return prisma.report.findMany({
      where: {
        reporterId: user.id,
        archivedAt: archivedFilter,
      },
      include: commonInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  if (!user.companyId) return [];

  if (user.role === "PENGELOLA") {
    if (!user.staffClusterId) return [];
    return prisma.report.findMany({
      where: {
        companyId: user.companyId,
        archivedAt: archivedFilter,
        asset: {
          park: {
            clusterId: user.staffClusterId,
          },
        },
      },
      include: commonInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  if (user.role === "MANAGER") {
    const now = new Date();
    const assignments = await prisma.clusterManagerAssignment.findMany({
      where: {
        userId: user.id,
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { clusterId: true },
    });
    const clusterIds = assignments.map((a) => a.clusterId);
    if (clusterIds.length === 0) return [];

    return prisma.report.findMany({
      where: {
        companyId: user.companyId,
        archivedAt: archivedFilter,
        asset: {
          park: {
            clusterId: { in: clusterIds },
          },
        },
      },
      include: commonInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  if (user.role === "PIC_VENDOR") {
    const vendor = await prisma.vendor.findUnique({
      where: { picUserId: user.id },
    });
    if (!vendor) return [];

    return prisma.report.findMany({
      where: {
        companyId: user.companyId,
        archivedAt: archivedFilter,
        workOrder: {
          vendorId: vendor.id,
        },
      },
      include: commonInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // ADMIN dan OWNER: melihat semua laporan di perusahaannya (companyId)
  return prisma.report.findMany({
    where: {
      companyId: user.companyId,
      archivedAt: archivedFilter,
    },
    include: commonInclude,
    orderBy: { createdAt: "desc" },
  });
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

  const existing = await prisma.asset.findFirst({
    where: {
      id: assetId,
      companyId: actor.companyId,
    },
  });

  if (!existing) {
    throw new Error("Aset tidak ditemukan di perusahaan Anda.");
  }

  const updated = await prisma.asset.update({
    where: { id: existing.id },
    data: {
      name: updates.name ?? existing.name,
      locationNote: updates.locationNote ?? existing.locationNote,
      isActive:
        typeof updates.isActive === "boolean"
          ? updates.isActive
          : existing.isActive,
      photoUrl: updates.photoUrl ?? existing.photoUrl,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId: actor.companyId,
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
  });

  return updated;
}

/**
 * Mengarsipkan laporan (tidak ada hapus permanen sesuai PRD Fase 0).
 */
export async function archiveReportById(actor: SessionUser, reportId: string) {
  assertPermission(actor.role, "ARCHIVE_REPORT");

  if (!actor.companyId) {
    throw new Error("Akun tidak terhubung ke perusahaan.");
  }

  const existing = await prisma.report.findFirst({
    where: {
      id: reportId,
      companyId: actor.companyId,
    },
  });

  if (!existing) {
    throw new Error("Laporan tidak ditemukan atau sudah diarsipkan.");
  }

  const archived = await prisma.report.update({
    where: { id: existing.id },
    data: {
      archivedAt: new Date(),
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId: actor.companyId,
    },
    entityName: "Report",
    entityId: existing.id,
    action: "ARCHIVE",
    summary: `Mengarsipkan laporan tiket ${existing.ticketNo}`,
    oldValues: { archivedAt: null },
    newValues: { archivedAt: archived.archivedAt?.toISOString() },
  });

  return archived;
}

