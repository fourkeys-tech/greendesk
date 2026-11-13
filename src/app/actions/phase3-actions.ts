"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Channel, Role } from "@/lib/db-types";
import {
  getCurrentSession,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { queryOne, withTransaction } from "@/lib/db";
import { detectImageFormat, persistUpload, saveUploadedPhoto } from "@/lib/storage";
import { flushEmailOutboxSafely } from "@/lib/email";
import {
  issueOtp,
  OTP_GENERIC_INVALID_MESSAGE,
  otpRegistrationEmail,
  type OtpRegistrationPayload,
  verifyOtp,
} from "@/lib/services/otp";
import { sanitizeInternalHref } from "@/lib/url-safety";
import {
  cancelOwnReportByUser,
  submitCitizenReport,
} from "@/lib/services/phase3-reporting";

/** Save a restored draft DataURL into public report uploads. */
async function saveBase64PhotoToUploads(dataUrl: string): Promise<string> {
  const matches = dataUrl.match(
    /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );
  if (!matches) {
    throw new Error("Format foto draft tidak valid. Hanya JPG, PNG, WebP, atau GIF yang diizinkan.");
  }

  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("Ukuran foto harus antara 1 byte hingga 5 MB.");
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error("Isi foto draft tidak valid atau tidak sesuai format JPG, PNG, WebP, atau GIF.");
  }

  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${detected.ext}`;
  return persistUpload("reports", fileName, buffer, detected.mime);
}

/** Submit an authenticated report from QR or dashboard. */
export async function submitReportAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return {
      requiresAuth: true,
      error: "Silakan masuk atau daftar untuk menyelesaikan pengiriman laporan.",
    };
  }

  try {
    const assetCode = ((formData.get("assetCode") as string) ?? "").trim().toUpperCase();
    const channel = ((formData.get("channel") as string) || "QR") as Channel;
    const description = ((formData.get("description") as string) ?? "").trim();
    const draftPhotoDataUrl = (formData.get("draftPhotoDataUrl") as string | null) ?? null;
    const photoFile = formData.get("photo") as File | null;
    const photoUrls: string[] = [];

    if (photoFile && photoFile.size > 0) {
      const saved = await saveUploadedPhoto(photoFile, "reports");
      photoUrls.push(saved.url);
    } else if (draftPhotoDataUrl?.startsWith("data:image/")) {
      photoUrls.push(await saveBase64PhotoToUploads(draftPhotoDataUrl));
    }

    const report = await submitCitizenReport(session, {
      assetCode,
      channel,
      description,
      photoUrls,
    });

    after(() => flushEmailOutboxSafely());
    revalidatePath(`/r/${assetCode}`);
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/lapor");
    revalidatePath("/dashboard");
    revalidatePath("/beranda/laporan");
    revalidatePath("/beranda/lapor");
    revalidatePath("/beranda");

    return {
      success: true,
      ticketNo: report.ticketNo,
      message: `Laporan berhasil dikirim! Nomor Tiket Anda: ${report.ticketNo}. Email konfirmasi telah dikirim ke ${session.email}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengirimkan laporan." };
  }
}

/** Cancel an authenticated user's own report while it is still new. */
export async function cancelOwnReportAction(reportId: string) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const cancelled = await cancelOwnReportByUser(session, reportId);
    after(() => flushEmailOutboxSafely());
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard");
    revalidatePath("/beranda/laporan");
    revalidatePath("/beranda");
    return {
      success: true,
      message: `Laporan ${cancelled.ticketNo} berhasil dibatalkan dan email konfirmasi telah dikirim.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan laporan." };
  }
}

/** Issue OTP only for a new citizen registration; existing accounts never receive login OTPs. */
export async function requestRegistrationOtpAction(input: {
  name: string;
  email: string;
  reporterStatus: "WARGA" | "PENGUNJUNG";
  blockHouseNo?: string;
  dataConsent: boolean;
  assetCode?: string | null;
}) {
  if (!input.dataConsent) {
    return { error: "Anda wajib menyetujui penggunaan data pribadi saat mendaftar." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 160 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Nama lengkap dan alamat email yang valid wajib diisi." };
  }
  if (input.reporterStatus !== "WARGA" && input.reporterStatus !== "PENGUNJUNG") {
    return { error: "Status pelapor hanya boleh WARGA atau PENGUNJUNG." };
  }

  const existing = await queryOne<{ id: string }>(
    `SELECT "id" FROM "User" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
    [email]
  );
  if (existing) {
    // Generic response prevents account enumeration; no OTP is issued for existing users.
    return {
      success: true,
      message: "Jika alamat email dapat didaftarkan, kode verifikasi akan dikirimkan.",
    };
  }

  const normalizedAssetCode = input.assetCode?.trim().toUpperCase();
  const asset = normalizedAssetCode
    ? await queryOne<{ companyId: string }>(
        `SELECT "companyId" FROM "Asset" WHERE "code" = $1`,
        [normalizedAssetCode]
      )
    : null;
  const payload: OtpRegistrationPayload = {
    name,
    reporterStatus: input.reporterStatus,
    blockHouseNo: input.reporterStatus === "WARGA" ? input.blockHouseNo?.trim().slice(0, 120) || null : null,
    dataConsent: true,
    companyId: asset?.companyId ?? null,
  };
  const result = await issueOtp({
    email,
    companyId: asset?.companyId ?? null,
    payload,
    subject: "Kode verifikasi pendaftaran GreenPark",
    bodyHtml: (code) => otpRegistrationEmail(name, code).bodyHtml,
  });

  if (result.issued) {
    after(() => flushEmailOutboxSafely());
  }
  const debugOtpHint = result.issued && process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP_HINT === "true"
    ? result.code
    : undefined;
  return {
    success: true,
    debugOtpHint,
    message: "Jika alamat email dapat didaftarkan, kode verifikasi akan dikirimkan.",
  };
}

/** Verify a registration OTP, create a new citizen account, and start its session. */
export async function verifyRegistrationOtpAction(input: {
  email: string;
  code: string;
  returnTo?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const verified = await verifyOtp({ email, code: input.code });
  if (!verified.ok || !verified.payload) return { error: OTP_GENERIC_INVALID_MESSAGE };

  const now = new Date();
  try {
    const user = await withTransaction(async (tx) => {
      const existing = await queryOne<{ id: string }>(
        `SELECT "id" FROM "User" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
        [email],
        tx
      );
      if (existing) return null;

      const payload = verified.payload!;
      const created = await queryOne<{
        id: string;
        name: string;
        email: string;
        role: Role;
        companyId: string | null;
        staffClusterId: string | null;
      }>(
        `INSERT INTO "User" (
           "companyId", "name", "email", "role", "loginMethod",
           "reporterStatus", "blockHouseNo", "dataConsentAt", "lastLoginAt", "isActive"
         )
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'EMAIL_OTP', $4, $5, $6, $6, true)
         RETURNING "id", "name", "email", "role", "companyId", "staffClusterId"`,
        [
          payload.companyId,
          payload.name,
          email,
          payload.reporterStatus,
          payload.blockHouseNo,
          now,
        ],
        tx
      );
      if (!created) return null;

      const company = created.companyId
        ? await queryOne<{ name: string }>(
            `SELECT "name" FROM "Company" WHERE "id" = $1`,
            [created.companyId],
            tx
          )
        : null;
      return { ...created, companyName: company?.name ?? null };
    });

    if (!user) return { error: OTP_GENERIC_INVALID_MESSAGE };
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      staffClusterId: user.staffClusterId,
    };
    await setSessionCookie(sessionUser);
    return {
      success: true,
      user: sessionUser,
      returnTo: sanitizeInternalHref(input.returnTo) ?? "/beranda",
    };
  } catch {
    return { error: OTP_GENERIC_INVALID_MESSAGE };
  }
}
