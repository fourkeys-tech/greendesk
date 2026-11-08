import { describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import {
  cancelOwnReportByUser,
  submitCitizenReport,
} from "../services/phase3-reporting";

describe("Fase 3 – Autentikasi Pengguna & Pelaporan Kerusakan (MVP Inti)", () => {
  it("menolak laporan tanpa foto atau tanpa deskripsi", async () => {
    const warga = await prisma.user.findUniqueOrThrow({
      where: { email: "warga@greenpark.id" },
    });
    const actor = {
      id: warga.id,
      name: warga.name,
      email: warga.email,
      role: warga.role,
      companyId: warga.companyId,
      companyName: null,
      staffClusterId: null,
    };

    await expect(
      submitCitizenReport(actor, {
        assetCode: "AST-BGV-001",
        channel: "QR",
        description: "Lampu taman pecah",
        photoUrls: [],
      })
    ).rejects.toThrow(/minimal satu foto/);

    await expect(
      submitCitizenReport(actor, {
        assetCode: "AST-BGV-001",
        channel: "QR",
        description: "abc",
        photoUrls: ["/uploads/reports/sample.jpg"],
      })
    ).rejects.toThrow(/Deskripsi singkat/);
  });

  it("membuat laporan berstatus BARU, nomor tiket unik, mengirim email diterima, serta mengizinkan pembatalan saat BARU", async () => {
    // Buat pengguna baru agar kuota harian segar
    const uniqueEmail = `pelapor.fase3.${Date.now()}@greenpark.id`;
    const company = await prisma.company.findUniqueOrThrow({
      where: { code: "THN" },
    });
    const pelapor = await prisma.user.create({
      data: {
        companyId: company.id,
        name: "Pelapor Uji Fase 3",
        email: uniqueEmail,
        role: "PENGGUNA",
        loginMethod: "GOOGLE",
        dataConsentAt: new Date(),
      },
    });

    const actor = {
      id: pelapor.id,
      name: pelapor.name,
      email: pelapor.email,
      role: pelapor.role,
      companyId: pelapor.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const report = await submitCitizenReport(actor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: "Tiang lampu taman miring setelah hujan deras.",
      photoUrls: ["/uploads/reports/test-qr.jpg"],
    });

    expect(report.status).toBe("BARU");
    expect(report.ticketNo).toMatch(/^TKT-\d{6}-\d{4}/);

    // Pastikan email LAPORAN_TERKIRIM tercatat
    const receivedEmail = await prisma.emailLog.findFirst({
      where: {
        toEmail: uniqueEmail,
        ticketNo: report.ticketNo,
        triggerType: "LAPORAN_TERKIRIM",
      },
    });
    expect(receivedEmail).not.toBeNull();

    // Batalkan laporan saat masih BARU
    const cancelled = await cancelOwnReportByUser(actor, report.id);
    expect(cancelled.status).toBe("DIBATALKAN");

    // Pastikan email DIBATALKAN tercatat
    const cancelEmail = await prisma.emailLog.findFirst({
      where: {
        toEmail: uniqueEmail,
        ticketNo: report.ticketNo,
        triggerType: "DIBATALKAN",
      },
    });
    expect(cancelEmail).not.toBeNull();

    // Tidak bisa membatalkan lagi karena sudah bukan BARU
    await expect(cancelOwnReportByUser(actor, report.id)).rejects.toThrow(
      /hanya dapat dibatalkan selama statusnya masih BARU/
    );
  });
});

