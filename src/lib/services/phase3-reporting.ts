import crypto from "crypto";
import type { Channel } from "@prisma/client";
import { prisma } from "../prisma";
import { validateStatusTransition } from "../permissions";
import { assetUnreportableReason } from "../scopes";
import { sendReportStatusEmail } from "../email";
import type { SessionUser } from "../auth";

export const MAX_DAILY_REPORTS_PER_USER = 5;

/**
 * Menghasilkan nomor tiket unik berformat TKT-YYYYMM-XXXX
 */
async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const count = await prisma.report.count();
  const seq = String(count + 1).padStart(4, "0");
  const candidate = `TKT-${ym}-${seq}`;

  const exists = await prisma.report.findUnique({
    where: { ticketNo: candidate },
  });
  if (!exists) return candidate;

  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `TKT-${ym}-${seq}-${rand}`;
}

/**
 * 1. Pengiriman Laporan Kerusakan oleh Pengguna (lewat QR atau Dashboard).
 * Memeriksa:
 * - Minimal 1 foto dan deskripsi wajib ada.
 * - Aset wajib aktif.
 * - Batas jumlah laporan per akun per hari (MAX_DAILY_REPORTS_PER_USER).
 * - Penandaan otomatis jika aset masih dalam masa garansi vendor dari pekerjaan selesai sebelumnya.
 * - Pengiriman email laporan diterima ke pelapor & notifikasi web ke Pengelola cluster.
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
  const description = input.description.trim();
  const cleanPhotos = input.photoUrls.filter((u) => u && u.trim().length > 0);

  if (cleanPhotos.length === 0) {
    throw new Error("Wajib melampirkan minimal satu foto bukti kerusakan.");
  }
  if (description.length < 5) {
    throw new Error(
      "Deskripsi singkat kerusakan wajib diisi (minimal 5 karakter)."
    );
  }

  // Periksa status blokir pengguna
  const dbUser = await prisma.user.findUnique({
    where: { id: actor.id },
  });
  if (!dbUser || !dbUser.isActive || dbUser.isBlocked) {
    throw new Error("Akun Anda tidak dapat mengirim laporan saat ini.");
  }

  // Periksa batas laporan per akun per hari (Anti-spam PRD Bagian 6 Fase 3 & Bagian 8)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const reportsToday = await prisma.report.count({
    where: {
      reporterId: actor.id,
      createdAt: { gte: startOfToday },
    },
  });

  if (reportsToday >= MAX_DAILY_REPORTS_PER_USER) {
    throw new Error(
      `Batas pengiriman laporan harian tercapai (maksimal ${MAX_DAILY_REPORTS_PER_USER} laporan per hari per akun).`
    );
  }

  const asset = await prisma.asset.findUnique({
    where: { code: input.assetCode.trim().toUpperCase() },
    include: {
      category: true,
      park: {
        include: {
          cluster: { include: { complex: true } },
        },
      },
    },
  });

  if (!asset) {
    throw new Error("Aset tidak ditemukan.");
  }
  const unreportableReason = assetUnreportableReason(asset);
  if (unreportableReason) {
    throw new Error(
      `Aset ${asset.code} tidak dapat dilaporkan saat ini. ${unreportableReason}`
    );
  }

  // Cek apakah aset ini baru selesai diperbaiki dan masih dalam masa garansi vendor (PRD Fase 6 / Bagian 8)
  let underWarrantyOfVendorId: string | null = null;
  const lastCompletedReport = await prisma.report.findFirst({
    where: {
      assetId: asset.id,
      status: "SELESAI",
      workOrder: {
        isNot: null,
      },
    },
    include: {
      workOrder: {
        include: { vendor: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (
    lastCompletedReport?.workOrder?.completedAt &&
    lastCompletedReport.workOrder.vendor
  ) {
    const completedAt = new Date(lastCompletedReport.workOrder.completedAt);
    const warrantyDays = lastCompletedReport.workOrder.vendor.warrantyDays || 30;
    const warrantyExpiresAt = new Date(
      completedAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000
    );
    if (new Date() <= warrantyExpiresAt) {
      underWarrantyOfVendorId = lastCompletedReport.workOrder.vendorId;
    }
  }

  const ticketNo = await generateTicketNumber();

  const createdReport = await prisma.report.create({
    data: {
      companyId: asset.companyId,
      ticketNo,
      assetId: asset.id,
      reporterId: actor.id,
      channel: input.channel,
      description,
      status: "BARU",
      underWarrantyOfVendorId,
      stageEnteredAt: new Date(),
      photos: {
        create: cleanPhotos.map((url) => ({ url })),
      },
      statusLogs: {
        create: {
          fromStatus: null,
          toStatus: "BARU",
          changedById: actor.id,
          note: `Laporan dikirim melalui saluran ${input.channel}`,
        },
      },
    },
    include: {
      photos: true,
    },
  });

  // Kirim Email Laporan Diterima ke Pelapor (Bagian 9 PRD)
  await sendReportStatusEmail({
    companyId: asset.companyId,
    toEmail: actor.email,
    reporterName: actor.name,
    ticketNo: createdReport.ticketNo,
    assetName: `${asset.name} (${asset.code})`,
    triggerType: "LAPORAN_TERKIRIM",
  });

  // Buat Notifikasi Web ke semua Pengelola di Cluster terkait (Bagian 9 PRD)
  const clusterStaffList = await prisma.user.findMany({
    where: {
      companyId: asset.companyId,
      role: "PENGELOLA",
      staffClusterId: asset.park.clusterId,
      isActive: true,
    },
    select: { id: true },
  });

  if (clusterStaffList.length > 0) {
    await prisma.notification.createMany({
      data: clusterStaffList.map((staff) => ({
        companyId: asset.companyId,
        recipientId: staff.id,
        title: `Laporan Baru Masuk (${createdReport.ticketNo})`,
        message: `Laporan baru untuk aset ${asset.name} (${asset.code}) di ${asset.park.name} menunggu verifikasi Anda.`,
        linkUrl: "/dashboard/laporan",
      })),
    });
  }

  return createdReport;
}

/**
 * 2. Pembatalan Laporan oleh Pengguna (Hanya bisa saat status masih BARU).
 * Mengirim email konfirmasi pembatalan ke pelapor.
 */
export async function cancelOwnReportByUser(
  actor: SessionUser,
  reportId: string
) {
  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      reporterId: actor.id,
    },
    include: {
      asset: true,
    },
  });

  if (!report) {
    throw new Error("Laporan tidak ditemukan atau bukan milik Anda.");
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

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: "DIBATALKAN",
      stageEnteredAt: new Date(),
      statusLogs: {
        create: {
          fromStatus: report.status,
          toStatus: "DIBATALKAN",
          changedById: actor.id,
          note: "Dibatalkan sendiri oleh pelapor",
        },
      },
    },
  });

  await sendReportStatusEmail({
    companyId: report.companyId,
    toEmail: actor.email,
    reporterName: actor.name,
    ticketNo: report.ticketNo,
    assetName: `${report.asset.name} (${report.asset.code})`,
    triggerType: "DIBATALKAN",
  });

  return updated;
}

