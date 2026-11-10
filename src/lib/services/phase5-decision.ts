import { prisma } from "../prisma";
import { assertPermission, validateStatusTransition } from "../permissions";
import { sendReportStatusEmailWithMergedChildren } from "../email";
import { recordAuditLog } from "../audit";
import type { SessionUser } from "../auth";

/**
 * Mendapatkan daftar ID cluster yang ditugaskan kepada seorang Manager
 * (termasuk penugasan manajer pengganti sementara yang masih berlaku).
 */
export async function getManagerAssignedClusterIds(
  managerUserId: string
): Promise<string[]> {
  const now = new Date();
  const assignments = await prisma.clusterManagerAssignment.findMany({
    where: {
      userId: managerUserId,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    select: { clusterId: true },
  });
  return assignments.map((a) => a.clusterId);
}

/**
 * Menghasilkan nomor SPK urut sekuensial dengan format SPK-YYYYMM-XXXX
 * (Contoh: SPK-202611-0001)
 */
export async function generateNextSpkNumber(companyId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SPK-${year}${month}-`;

  const lastOrder = await prisma.workOrder.findFirst({
    where: {
      companyId,
      spkNo: { startsWith: prefix },
    },
    orderBy: { spkNo: "desc" },
    select: { spkNo: true },
  });

  let nextSeq = 1;
  if (lastOrder) {
    const parts = lastOrder.spkNo.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) {
      nextSeq = num + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * MGR-M2: Antrean Laporan Menunggu Keputusan Manager
 * Diurutkan berdasarkan:
 * 1. Prioritas (TINGGI -> NORMAL -> RENDAH)
 * 2. Waktu terlama di tahap ini (stageEnteredAt / createdAt asc)
 */
export async function getPendingManagerReports(actor: SessionUser) {
  assertPermission(actor.role, "DECIDE_REPAIR");

  const clusterIds = await getManagerAssignedClusterIds(actor.id);
  if (clusterIds.length === 0) {
    return [];
  }

  const reports = await prisma.report.findMany({
    where: {
      companyId: actor.companyId || undefined,
      status: "MENUNGGU_KEPUTUSAN",
      archivedAt: null,
      asset: {
        park: {
          clusterId: { in: clusterIds },
        },
      },
    },
    include: {
      asset: {
        include: {
          park: {
            include: { cluster: true },
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
          validReportCount: true,
          invalidReportCount: true,
        },
      },
      photos: true,
      underWarrantyOfVendor: {
        select: { id: true, name: true, warrantyDays: true },
      },
      mergedChildReports: {
        select: { id: true, ticketNo: true, createdAt: true },
      },
    },
  });

  // Urutkan prioritas TINGGI (1) -> NORMAL (2) -> RENDAH (3), lalu tanggal terlama di tahap ini (stageEnteredAt / createdAt tertua duluan)
  const priorityRank: Record<string, number> = {
    TINGGI: 1,
    NORMAL: 2,
    RENDAH: 3,
  };

  const now = new Date();

  return reports
    .map((r) => {
      const stageDate = r.stageEnteredAt || r.createdAt;
      const diffMs = now.getTime() - stageDate.getTime();
      const daysInStage = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      return {
        ...r,
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
  return prisma.vendor.findMany({
    where: {
      companyId,
      isActive: true,
      serviceAreas: {
        some: { clusterId },
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      skills: true,
      warrantyDays: true,
      picUserId: true,
    },
    orderBy: { name: "asc" },
  });
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
  const report = await prisma.report.findFirst({
    where: {
      id: input.reportId,
      companyId: actor.companyId,
      archivedAt: null,
    },
    include: {
      asset: {
        include: {
          park: {
            include: { cluster: true },
          },
        },
      },
      reporter: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!report) {
    throw new Error("Laporan tidak ditemukan.");
  }

  const reportClusterId = report.asset.park.clusterId;
  if (!clusterIds.includes(reportClusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki penugasan manajer untuk ${report.asset.park.cluster.name}.`
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

    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "DITOLAK",
        reason,
        stageEnteredAt: new Date(),
        statusLogs: {
          create: {
            fromStatus: report.status,
            toStatus: "DITOLAK",
            changedById: actor.id,
            note: reason,
          },
        },
      },
    });

    await recordAuditLog({
      companyId: actor.companyId!,
      actor,
      entityName: "Report",
      entityId: report.id,
      action: "UPDATE",
      summary: `Manager ${actor.name} menolak perbaikan laporan ${report.ticketNo}. Alasan: ${reason}`,
      oldValues: { status: report.status },
      newValues: { status: "DITOLAK", reason },
    });

    // Kirim email penolakan ke pelapor utama dan anak laporan yang digabung
    await sendReportStatusEmailWithMergedChildren({
      reportId: report.id,
      triggerType: "DITOLAK_MANAGER",
      reason,
    });

    return { success: true, status: "DITOLAK", report: updated };
  }

  // 3. Cabang Aksi: SETUJU (Membuat SPK ke Vendor)
  if (input.decision === "SETUJU") {
    if (!input.spkInput?.vendorId) {
      throw new Error("Pilihan vendor wajib diisi saat menyetujui perbaikan.");
    }
    if (!input.spkInput?.spkFileUrl) {
      throw new Error(
        "File Surat Perintah Kerja (SPK) wajib dilampirkan sebelum menerbitkan SPK (PRD v0.2 Keputusan 14)."
      );
    }

    const { vendorId, assignedDate, notes, spkFileUrl, spkFileName, spkFileSize, spkFileMime } = input.spkInput;

    // Verifikasi vendor melayani cluster laporan ini
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        companyId: actor.companyId,
        isActive: true,
        serviceAreas: {
          some: { clusterId: reportClusterId },
        },
      },
      include: {
        picUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

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

    const spkNo = await generateNextSpkNumber(actor.companyId);

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Buat WorkOrder (SPK) dengan teknisi kosong
        const workOrder = await tx.workOrder.create({
          data: {
            companyId: actor.companyId!,
            spkNo,
            reportId: report.id,
            vendorId: vendor.id,
            technicianId: null, // Dikosongkan sesuai PRD v0.2 untuk ditunjuk PIC Vendor
            assignedAt: assignedDate || new Date(),
            spkFileUrl,
            spkFileName: spkFileName || `${spkNo}.pdf`,
            spkFileSize: spkFileSize || null,
            spkFileMime: spkFileMime || "application/pdf",
            spkFileUploadedAt: new Date(),
            spkFileUploadedById: actor.id,
          },
        });

        // 2. Perbarui status laporan ke DISETUJUI
        const rep = await tx.report.update({
          where: { id: report.id },
          data: {
            status: "DISETUJUI",
            stageEnteredAt: new Date(),
            statusLogs: {
              create: {
                fromStatus: report.status,
                toStatus: "DISETUJUI",
                changedById: actor.id,
                note: `Perbaikan disetujui oleh Manager. Diterbitkan ${spkNo} kepada vendor ${vendor.name}.${
                  notes ? ` Catatan: ${notes}` : ""
                }`,
              },
            },
          },
        });

        // 3. Notifikasi Web ke PIC Vendor
        if (vendor.picUserId) {
          await tx.notification.create({
            data: {
              companyId: actor.companyId,
              recipientId: vendor.picUserId,
              title: `SPK Baru Diterbitkan (${spkNo})`,
              message: `Manager ${actor.name} telah menerbitkan ${spkNo} untuk perbaikan aset ${report.asset.name}. Silakan tunjuk teknisi pelaksana.`,
              linkUrl: `/dashboard/laporan`,
            },
          });
        }

        return { workOrder, report: rep };
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // 4. Catat AuditLog
    await recordAuditLog({
      companyId: actor.companyId!,
      actor,
      entityName: "WorkOrder",
      entityId: result.workOrder.id,
      action: "CREATE",
      summary: `Manager ${actor.name} menyetujui perbaikan laporan ${report.ticketNo} dan menerbitkan ${spkNo} ke ${vendor.name}`,
      oldValues: { reportStatus: report.status },
      newValues: {
        reportStatus: "DISETUJUI",
        spkNo,
        vendorId: vendor.id,
        vendorName: vendor.name,
      },
    });

    // Kirim email konfirmasi ke pelapor utama & pelapor gabungan
    await sendReportStatusEmailWithMergedChildren({
      reportId: report.id,
      triggerType: "DISETUJUI",
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
