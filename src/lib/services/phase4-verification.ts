import type { Priority } from "@prisma/client";
import { prisma } from "../prisma";
import { assertPermission, validateStatusTransition } from "../permissions";
import { sendReportStatusEmail } from "../email";
import { activeAssignmentWhere } from "../scopes";
import type { SessionUser } from "../auth";

/**
 * Memastikan hanya Pengelola dari cluster tempat aset berada yang dapat memverifikasi laporan.
 */
async function getAndAuthorizeClusterReportForStaff(
  actor: SessionUser,
  reportId: string
) {
  assertPermission(actor.role, "VERIFY_AND_PRIORITIZE");

  if (!actor.companyId || !actor.staffClusterId) {
    throw new Error(
      "Akun Pengelola Anda belum ditautkan ke cluster mana pun."
    );
  }

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      companyId: actor.companyId,
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

  // Kriteria Penerimaan Fase 4: Hanya pengelola cluster terkait yang dapat memverifikasi
  if (report.asset.park.clusterId !== actor.staffClusterId) {
    throw new Error(
      `Akses ditolak: Laporan ini berada di ${report.asset.park.cluster.name}, sedangkan Anda hanya bertugas di cluster Anda sendiri.`
    );
  }

  return report;
}

/**
 * 1. Pengelola menyatakan laporan VALID, menetapkan Prioritas (TINGGI / NORMAL / RENDAH),
 * lalu meneruskan ke Manager (status -> MENUNGGU_KEPUTUSAN).
 * - Menambah validReportCount pada akun pelapor (+1).
 * - Mengirim email VALID_MENUNGGU_KEPUTUSAN ke pelapor (dan pelapor anak bila ada laporan digabung).
 * - Mengirim Notifikasi Web ke Manager yang membawahi cluster tersebut.
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

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: "MENUNGGU_KEPUTUSAN",
      priority: input.priority,
      stageEnteredAt: new Date(),
      statusLogs: {
        create: {
          fromStatus: report.status,
          toStatus: "MENUNGGU_KEPUTUSAN",
          changedById: actor.id,
          note:
            input.note?.trim() ||
            `Diverifikasi Valid oleh Pengelola dengan prioritas ${input.priority}`,
        },
      },
    },
  });

  // Tambah rekam jejak laporan valid pada akun pelapor (Kriteria Penerimaan Fase 4)
  await prisma.user.update({
    where: { id: report.reporterId },
    data: {
      validReportCount: { increment: 1 },
    },
  });

  // Kirim email ke pelapor utama
  await sendReportStatusEmail({
    companyId: report.companyId,
    toEmail: report.reporter.email,
    reporterName: report.reporter.name,
    ticketNo: report.ticketNo,
    assetName: `${report.asset.name} (${report.asset.code})`,
    triggerType: "VALID_MENUNGGU_KEPUTUSAN",
  });

  // Beri tahu Manager yang ditautkan ke cluster ini via Notifikasi Web (Bagian 9 PRD)
  const managerAssignments = await prisma.clusterManagerAssignment.findMany({
    where: {
      clusterId: report.asset.park.clusterId,
      ...activeAssignmentWhere(new Date()),
      user: { isActive: true },
    },
    select: { userId: true },
  });

  const uniqueManagerIds = Array.from(
    new Set(managerAssignments.map((m) => m.userId))
  );

  if (uniqueManagerIds.length > 0) {
    await prisma.notification.createMany({
      data: uniqueManagerIds.map((managerId) => ({
        companyId: report.companyId,
        recipientId: managerId,
        title: `Laporan Valid Menunggu Keputusan (${report.ticketNo})`,
        message: `Pengelola meneruskan laporan ${report.ticketNo} (${report.asset.name}) dengan prioritas ${input.priority}.`,
        linkUrl: "/dashboard/laporan",
      })),
    });
  }

  return updated;
}

/**
 * 2. Pengelola menandai laporan TIDAK_VALID dengan alasan wajib.
 * - Status akhir: TIDAK_VALID.
 * - Menambah invalidReportCount pada akun pelapor (+1).
 * - Mengirim email TIDAK_VALID beserta alasan ke pelapor.
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

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: "TIDAK_VALID",
      reason,
      stageEnteredAt: new Date(),
      statusLogs: {
        create: {
          fromStatus: report.status,
          toStatus: "TIDAK_VALID",
          changedById: actor.id,
          note: `Dinyatakan Tidak Valid: ${reason}`,
        },
      },
    },
  });

  // Tambah rekam jejak laporan tidak valid pada akun pelapor (Kriteria Penerimaan Fase 4)
  await prisma.user.update({
    where: { id: report.reporterId },
    data: {
      invalidReportCount: { increment: 1 },
    },
  });

  await sendReportStatusEmail({
    companyId: report.companyId,
    toEmail: report.reporter.email,
    reporterName: report.reporter.name,
    ticketNo: report.ticketNo,
    assetName: `${report.asset.name} (${report.asset.code})`,
    triggerType: "TIDAK_VALID",
    reason,
  });

  return updated;
}

/**
 * 3. Pengelola menggabungkan laporan ganda untuk aset yang sama ke laporan induk (status -> DIGABUNG).
 * - Memastikan laporan induk berada pada aset yang sama dan bukan dirinya sendiri.
 * - Menambah validReportCount pada akun pelapor (+1).
 * - Mengirim email DIGABUNG ke pelapor bahwa perkembangan berikutnya mengikuti laporan induk.
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

  const parentReport = await prisma.report.findFirst({
    where: {
      id: input.parentReportId,
      companyId: childReport.companyId,
      assetId: childReport.assetId,
    },
  });

  if (!parentReport) {
    throw new Error(
      "Laporan induk harus berasal dari aset yang sama di perusahaan ini."
    );
  }

  if (parentReport.status === "DIGABUNG" || parentReport.status === "TIDAK_VALID" || parentReport.status === "DIBATALKAN") {
    throw new Error(
      "Laporan induk yang dipilih tidak aktif untuk penggabungan."
    );
  }

  const updated = await prisma.report.update({
    where: { id: childReport.id },
    data: {
      status: "DIGABUNG",
      parentReportId: parentReport.id,
      reason: `Digabung ke laporan induk ${parentReport.ticketNo}`,
      stageEnteredAt: new Date(),
      statusLogs: {
        create: {
          fromStatus: childReport.status,
          toStatus: "DIGABUNG",
          changedById: actor.id,
          note: `Digabungkan oleh Pengelola ke laporan induk ${parentReport.ticketNo}`,
        },
      },
    },
  });

  // Tambah rekam jejak valid karena laporan memang nyata (hanya duplikat)
  await prisma.user.update({
    where: { id: childReport.reporterId },
    data: {
      validReportCount: { increment: 1 },
    },
  });

  await sendReportStatusEmail({
    companyId: childReport.companyId,
    toEmail: childReport.reporter.email,
    reporterName: childReport.reporter.name,
    ticketNo: childReport.ticketNo,
    assetName: `${childReport.asset.name} (${childReport.asset.code})`,
    triggerType: "DIGABUNG",
    parentTicketNo: parentReport.ticketNo,
  });

  return updated;
}
