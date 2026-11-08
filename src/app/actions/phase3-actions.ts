"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Channel } from "@prisma/client";
import {
  getCurrentSession,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedPhoto } from "@/lib/storage";
import { sendTransactionalEmail } from "@/lib/email";
import {
  cancelOwnReportByUser,
  submitCitizenReport,
} from "@/lib/services/phase3-reporting";

/**
 * Menyimpan foto dari DataURL Base64 (ketika dipulihkan dari draft IndexedDB) ke public/uploads/reports
 */
async function saveBase64PhotoToUploads(
  dataUrl: string,
  originalName = "draft-photo.jpg"
): Promise<string> {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Format foto draft tidak valid.");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("Ukuran foto melebihi batas maksimum 5 MB.");
  }

  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
      ? "webp"
      : "jpg";
  const fileName = `${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "")}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  return `/uploads/reports/${fileName}`;
}

/**
 * 1. Kirim Laporan Kerusakan (via QR maupun Dashboard).
 * Menerima file foto langsung atau DataURL foto hasil pemulihan draft IndexedDB.
 */
export async function submitReportAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return {
      requiresAuth: true,
      error: "Silakan masuk atau daftar untuk menyelesaikan pengiriman laporan.",
    };
  }

  try {
    const assetCode = ((formData.get("assetCode") as string) ?? "")
      .trim()
      .toUpperCase();
    const channel = ((formData.get("channel") as string) || "QR") as Channel;
    const description = ((formData.get("description") as string) ?? "").trim();
    const draftPhotoDataUrl =
      (formData.get("draftPhotoDataUrl") as string | null) ?? null;
    const photoFile = formData.get("photo") as File | null;

    const photoUrls: string[] = [];

    if (photoFile && photoFile.size > 0) {
      const saved = await saveUploadedPhoto(photoFile, "reports");
      photoUrls.push(saved.url);
    } else if (draftPhotoDataUrl && draftPhotoDataUrl.startsWith("data:image/")) {
      const savedUrl = await saveBase64PhotoToUploads(draftPhotoDataUrl);
      photoUrls.push(savedUrl);
    }

    const report = await submitCitizenReport(session, {
      assetCode,
      channel,
      description,
      photoUrls,
    });

    revalidatePath(`/r/${assetCode}`);
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/lapor");
    revalidatePath("/dashboard");

    return {
      success: true,
      ticketNo: report.ticketNo,
      message: `Laporan berhasil dikirim! Nomor Tiket Anda: ${report.ticketNo}. Email konfirmasi telah dikirim ke ${session.email}.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal mengirimkan laporan.",
    };
  }
}

/**
 * 2. Batalkan Laporan Milik Sendiri (Hanya saat status BARU)
 */
export async function cancelOwnReportAction(reportId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Silakan login terlebih dahulu." };
  }

  try {
    const cancelled = await cancelOwnReportByUser(session, reportId);
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: `Laporan ${cancelled.ticketNo} berhasil dibatalkan dan email konfirmasi telah dikirim.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal membatalkan laporan.",
    };
  }
}

/**
 * 3A. Pilihan 1 pada Form QR: Lanjut dengan Google (Sesi 30 Hari + Persetujuan Data Pribadi)
 */
export async function continueWithGoogleInlineAction(input: {
  name?: string;
  email?: string;
  dataConsent: boolean;
  companyId?: string | null;
}) {
  if (!input.dataConsent) {
    return {
      error:
        "Anda wajib menyetujui penggunaan data pribadi sesuai ketentuan privasi untuk melanjutkan.",
    };
  }

  const email = (input.email?.trim() || "warga@greenpark.id").toLowerCase();
  const name = input.name?.trim() || "Rina Kartika (Google)";

  let user = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { name: true } } },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        companyId: input.companyId ?? null,
        name,
        email,
        role: "PENGGUNA",
        loginMethod: "GOOGLE",
        reporterStatus: "WARGA",
        dataConsentAt: new Date(),
        isActive: true,
      },
      include: { company: { select: { name: true } } },
    });
  } else if (!user.dataConsentAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { dataConsentAt: new Date(), lastLoginAt: new Date() },
    });
  }

  if (!user.isActive || user.isBlocked) {
    return { error: "Akun Anda sedang dinonaktifkan atau diblokir." };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    staffClusterId: user.staffClusterId,
  };

  await setSessionCookie(sessionUser);
  return { success: true, user: sessionUser };
}

/**
 * 3B. Pilihan 2 pada Form QR: Masuk (Email + Kata Sandi, Anti-Enumerasi Email)
 */
export async function loginInlineOnQrAction(input: {
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const genericError =
    "Kredensial tidak valid atau akun belum dapat digunakan.";

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { name: true } } },
  });

  if (!user || !user.passwordHash || !user.isActive || user.isBlocked) {
    return { error: genericError };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { error: genericError };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    staffClusterId: user.staffClusterId,
  };

  await setSessionCookie(sessionUser);
  return { success: true, user: sessionUser };
}

/**
 * 3C. Pilihan 3 pada Form QR: Daftar / Masuk dengan OTP Email + Persetujuan Data Pribadi
 * Menerapkan Anti-Enumerasi Email (PRD Fase 3: Sistem tidak memperlihatkan apakah suatu email sudah terdaftar).
 */
export async function requestInlineOtpAction(input: {
  name: string;
  email: string;
  reporterStatus: "WARGA" | "PENGUNJUNG";
  blockHouseNo?: string;
  dataConsent: boolean;
  companyId?: string | null;
}) {
  if (!input.dataConsent) {
    return {
      error: "Anda wajib menyetujui penggunaan data pribadi saat mendaftar.",
    };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name || !email) {
    return { error: "Nama lengkap dan alamat email wajib diisi." };
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        companyId: input.companyId ?? null,
        name,
        email,
        role: "PENGGUNA",
        loginMethod: "EMAIL_OTP",
        reporterStatus: input.reporterStatus,
        blockHouseNo: input.blockHouseNo?.trim() || null,
        dataConsentAt: new Date(),
        isActive: true,
      },
    });
  }

  let debugOtpCode: string | null = null;

  if (user.isActive && !user.isBlocked) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    debugOtpCode = code;
    await prisma.otpCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendTransactionalEmail({
      companyId: user.companyId,
      toEmail: email,
      subject: `Kode OTP Verifikasi Laporan GreenPark: ${code}`,
      bodyHtml: `<p>Halo ${user.name}, kode OTP untuk mengirim laporan Anda adalah: <strong style="font-size:18px;">${code}</strong> (berlaku 10 menit).</p>`,
      triggerType: "OTP_LOGIN",
    });
  }

  // Pesan respons identik baik email baru maupun sudah terdaftar (Anti-Enumerasi PRD Fase 3)
  return {
    success: true,
    debugOtpHint:
      process.env.NODE_ENV !== "production" ? debugOtpCode : undefined,
    message:
      "Jika alamat email valid, kode OTP 6 digit telah dikirimkan ke email Anda.",
  };
}

export async function verifyInlineOtpAction(input: {
  email: string;
  code: string;
}) {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();

  const otp = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { error: "Kode OTP tidak valid atau sudah kedaluwarsa." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { name: true } } },
  });

  if (!user || !user.isActive || user.isBlocked) {
    return { error: "Kode OTP tidak valid atau sudah kedaluwarsa." };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    staffClusterId: user.staffClusterId,
  };

  await setSessionCookie(sessionUser);
  return { success: true, user: sessionUser };
}

