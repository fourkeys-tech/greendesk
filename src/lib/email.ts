import { prisma } from "./prisma";

export type EmailTriggerType =
  | "OTP_LOGIN"
  | "VENDOR_INVITE"
  | "LAPORAN_TERKIRIM"
  | "TIDAK_VALID"
  | "DIGABUNG"
  | "VALID_MENUNGGU_KEPUTUSAN"
  | "DITOLAK_MANAGER"
  | "DISETUJUI"
  | "DIKERJAKAN"
  | "SELESAI"
  | "DIBATALKAN";

export interface SendEmailParams {
  companyId?: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  triggerType: EmailTriggerType;
  ticketNo?: string;
}

/**
 * Layanan pengiriman email transaksional (Fase 0).
 * Di mode pengembangan: mencatat email ke tabel EmailLog dan menampilkan di console
 * sehingga tim pengembang / penguji dapat melihat isi email & OTP langsung dari dashboard.
 */
export async function sendTransactionalEmail(params: SendEmailParams) {
  const { companyId, toEmail, subject, bodyHtml, triggerType, ticketNo } =
    params;

  console.info(
    `\n📧 [EMAIL OUTBOX - ${triggerType}] To: ${toEmail} | Subject: ${subject}${
      ticketNo ? ` | Tiket: ${ticketNo}` : ""
    }`
  );

  const log = await prisma.emailLog.create({
    data: {
      companyId: companyId ?? null,
      toEmail,
      subject,
      bodyHtml,
      triggerType,
      ticketNo: ticketNo ?? null,
      status: "SENT",
      retryCount: 0,
    },
  });

  return log;
}

/**
 * Helper pembentuk email status laporan ke pelapor sesuai Bagian 9 PRD
 * (selalu memuat nomor tiket dan tautan cek status).
 */
export async function sendReportStatusEmail(params: {
  companyId: string;
  toEmail: string;
  reporterName: string;
  ticketNo: string;
  assetName: string;
  triggerType: Exclude<EmailTriggerType, "OTP_LOGIN" | "VENDOR_INVITE">;
  reason?: string | null;
  parentTicketNo?: string | null;
  afterPhotoUrls?: string[];
}) {
  const {
    companyId,
    toEmail,
    reporterName,
    ticketNo,
    assetName,
    triggerType,
    reason,
    parentTicketNo,
    afterPhotoUrls,
  } = params;

  const statusUrl = `/dashboard/laporan?tiket=${encodeURIComponent(ticketNo)}`;

  const templates: Record<
    Exclude<EmailTriggerType, "OTP_LOGIN" | "VENDOR_INVITE">,
    { subject: string; message: string }
  > = {
    LAPORAN_TERKIRIM: {
      subject: `[${ticketNo}] Laporan Kerusakan Diterima - ${assetName}`,
      message: `Terima kasih ${reporterName}, laporan Anda untuk aset <strong>${assetName}</strong> telah kami terima dengan nomor tiket <strong>${ticketNo}</strong> dan sedang menunggu verifikasi pengelola.`,
    },
    TIDAK_VALID: {
      subject: `[${ticketNo}] Laporan Tidak Dapat Dilanjutkan - ${assetName}`,
      message: `Halo ${reporterName}, laporan Anda (<strong>${ticketNo}</strong>) untuk aset <strong>${assetName}</strong> tidak dapat dilanjutkan oleh pengelola.<br/><strong>Alasan:</strong> ${
        reason || "-"
      }`,
    },
    DIGABUNG: {
      subject: `[${ticketNo}] Laporan Digabung ke Tiket ${parentTicketNo || "Induk"}`,
      message: `Halo ${reporterName}, laporan Anda (<strong>${ticketNo}</strong>) untuk aset <strong>${assetName}</strong> digabung dengan laporan aktif sebelumnya (<strong>${
        parentTicketNo || "-"
      }</strong>). Kabar perkembangan berikutnya akan mengikuti laporan induk tersebut.`,
    },
    VALID_MENUNGGU_KEPUTUSAN: {
      subject: `[${ticketNo}] Laporan Terverifikasi - ${assetName}`,
      message: `Halo ${reporterName}, laporan Anda (<strong>${ticketNo}</strong>) untuk aset <strong>${assetName}</strong> telah diverifikasi oleh pengelola dan diteruskan ke Manager untuk segera ditindaklanjuti.`,
    },
    DITOLAK_MANAGER: {
      subject: `[${ticketNo}] Perbaikan Belum Dapat Dilanjutkan - ${assetName}`,
      message: `Halo ${reporterName}, perbaikan untuk laporan <strong>${ticketNo}</strong> (${assetName}) belum dapat dilanjutkan saat ini.<br/><strong>Alasan Manager:</strong> ${
        reason || "-"
      }`,
    },
    DISETUJUI: {
      subject: `[${ticketNo}] Perbaikan Disetujui & Dijadwalkan - ${assetName}`,
      message: `Halo ${reporterName}, perbaikan untuk laporan <strong>${ticketNo}</strong> (${assetName}) telah disetujui oleh Manager dan SPK telah diterbitkan ke vendor.`,
    },
    DIKERJAKAN: {
      subject: `[${ticketNo}] Teknisi Sedang Menangani Perbaikan - ${assetName}`,
      message: `Halo ${reporterName}, teknisi telah ditunjuk dan sedang menangani perbaikan untuk aset <strong>${assetName}</strong> (Tiket: <strong>${ticketNo}</strong>).`,
    },
    SELESAI: {
      subject: `[${ticketNo}] Perbaikan Selesai - ${assetName}`,
      message: `Halo ${reporterName}, kabar baik! Perbaikan aset <strong>${assetName}</strong> (Tiket: <strong>${ticketNo}</strong>) telah selesai dan dikonfirmasi oleh Manager.${
        afterPhotoUrls && afterPhotoUrls.length > 0
          ? `<br/>Foto hasil perbaikan terlampir: ${afterPhotoUrls.join(", ")}`
          : ""
      }`,
    },
    DIBATALKAN: {
      subject: `[${ticketNo}] Konfirmasi Pembatalan Laporan - ${assetName}`,
      message: `Halo ${reporterName}, laporan Anda dengan nomor tiket <strong>${ticketNo}</strong> (${assetName}) telah berhasil dibatalkan sesuai permintaan Anda.`,
    },
  };

  const selected = templates[triggerType];
  const bodyHtml = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
      <p>${selected.message}</p>
      <p style="margin-top: 12px;">
        <strong>Nomor Tiket:</strong> ${ticketNo}<br/>
        <strong>Cek Status Laporan:</strong> <a href="${statusUrl}">${statusUrl}</a>
      </p>
    </div>
  `.trim();

  return sendTransactionalEmail({
    companyId,
    toEmail,
    subject: selected.subject,
    bodyHtml,
    triggerType,
    ticketNo,
  });
}

/**
 * Mengirim email status laporan ke pelapor utama SEKALIGUS ke seluruh pelapor
 * yang laporannya digabung (DIGABUNG) ke laporan induk ini (PRD Bagian 6 Fase 4 & Bagian 8).
 */
export async function sendReportStatusEmailWithMergedChildren(params: {
  reportId: string;
  triggerType: Exclude<EmailTriggerType, "OTP_LOGIN" | "VENDOR_INVITE">;
  reason?: string | null;
  afterPhotoUrls?: string[];
}) {
  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: {
      asset: true,
      reporter: { select: { name: true, email: true } },
      mergedChildReports: {
        include: {
          reporter: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!report) return;

  const assetLabel = `${report.asset.name} (${report.asset.code})`;

  // 1. Kirim ke pelapor laporan induk
  await sendReportStatusEmail({
    companyId: report.companyId,
    toEmail: report.reporter.email,
    reporterName: report.reporter.name,
    ticketNo: report.ticketNo,
    assetName: assetLabel,
    triggerType: params.triggerType,
    reason: params.reason,
    afterPhotoUrls: params.afterPhotoUrls,
  });

  // 2. Kirim ke seluruh pelapor dari laporan anak yang digabung (DIGABUNG)
  for (const child of report.mergedChildReports) {
    await sendReportStatusEmail({
      companyId: report.companyId,
      toEmail: child.reporter.email,
      reporterName: child.reporter.name,
      ticketNo: `${child.ticketNo} (Induk: ${report.ticketNo})`,
      assetName: assetLabel,
      triggerType: params.triggerType,
      reason: params.reason,
      afterPhotoUrls: params.afterPhotoUrls,
    });
  }
}

