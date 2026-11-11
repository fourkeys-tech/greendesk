"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Channel, Role } from "@/lib/db-types";
import {
  getCurrentSession,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { execute, queryOne, withTransaction } from "@/lib/db";
import { saveUploadedPhoto } from "@/lib/storage";
import { flushEmailOutboxSafely } from "@/lib/email";
import {
  issueOtp,
  OTP_GENERIC_INVALID_MESSAGE,
  otpReportEmail,
  type OtpRegistrationPayload,
  verifyOtp,
} from "@/lib/services/otp";
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

    after(() => flushEmailOutboxSafely());
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
    after(() => flushEmailOutboxSafely());
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
 *
 * TODO(pre-prod) P0-1 — Wajib sebelum production:
 * - Ganti dengan verifikasi token Google OAuth asli, atau sembunyikan tombol Google.
 */
export async function continueWithGoogleInlineAction(input: {
  name?: string;
  email?: string;
  dataConsent: boolean;
  assetCode?: string | null;
}) {
  if (!input.dataConsent) {
    return {
      error:
        "Anda wajib menyetujui penggunaan data pribadi sesuai ketentuan privasi untuk melanjutkan.",
    };
  }

  const email = (input.email?.trim() || "warga@greenpark.id").toLowerCase();
  const name = input.name?.trim() || "Rina Kartika (Google)";
  const normalizedAssetCode = input.assetCode?.trim().toUpperCase();
  const asset = normalizedAssetCode
    ? await queryOne<{ companyId: string }>(
        `SELECT "companyId" FROM "Asset" WHERE "code" = $1`,
        [normalizedAssetCode]
      )
    : null;
  const derivedCompanyId = asset?.companyId ?? null;

  interface InlineUserLookup {
    id: string;
    name: string;
    email: string;
    role: Role;
    companyId: string | null;
    staffClusterId: string | null;
    isActive: boolean;
    isBlocked: boolean;
    dataConsentAt: Date | null;
    companyName: string | null;
    techApprovalStatus: string | null;
    techStatus: string | null;
  }

  const existing = await queryOne<InlineUserLookup>(
    `SELECT u."id", u."name", u."email", u."role", u."companyId", u."staffClusterId",
            u."isActive", u."isBlocked", u."dataConsentAt",
            c."name" AS "companyName",
            t."approvalStatus" AS "techApprovalStatus",
            t."status" AS "techStatus"
     FROM "User" u
     LEFT JOIN "Company" c ON c."id" = u."companyId"
     LEFT JOIN "Technician" t ON t."userId" = u."id"
     WHERE u."email" = $1`,
    [email]
  );

  if (existing) {
    if (!existing.isActive || existing.isBlocked) {
      return { error: "Akun Anda sedang dinonaktifkan atau diblokir." };
    }
    if (
      existing.role === "TEKNISI" &&
      (existing.techApprovalStatus !== "APPROVED" ||
        existing.techStatus === "INACTIVE")
    ) {
      return { error: "Akun Anda sedang dinonaktifkan atau belum disetujui." };
    }
  }

  const now = new Date();
  const user = await withTransaction(async (tx) => {
    if (!existing) {
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
           "reporterStatus", "dataConsentAt", "lastLoginAt", "isActive"
         )
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'GOOGLE', 'WARGA', $4, $4, true)
         RETURNING "id", "name", "email", "role", "companyId", "staffClusterId"`,
        [derivedCompanyId, name, email, now],
        tx
      );
      if (!created) throw new Error("Gagal membuat akun Google.");
      const comp = created.companyId
        ? await queryOne<{ name: string }>(
            `SELECT "name" FROM "Company" WHERE "id" = $1`,
            [created.companyId],
            tx
          )
        : null;
      return { ...created, companyName: comp?.name ?? null };
    }

    await execute(
      `UPDATE "User"
       SET "lastLoginAt" = $2,
           "dataConsentAt" = COALESCE("dataConsentAt", $2),
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      [existing.id, now],
      tx
    );

    if (existing.role === "TEKNISI" && existing.techApprovalStatus !== null) {
      await execute(
        `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
        [existing.id, now],
        tx
      );
    }

    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      role: existing.role,
      companyId: existing.companyId,
      staffClusterId: existing.staffClusterId,
      companyName: existing.companyName,
    };
  });

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName ?? null,
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

  const user = await queryOne<{
    id: string;
    name: string;
    email: string;
    passwordHash: string | null;
    role: Role;
    companyId: string | null;
    staffClusterId: string | null;
    isActive: boolean;
    isBlocked: boolean;
    companyName: string | null;
    techApprovalStatus: string | null;
    techStatus: string | null;
  }>(
    `SELECT u."id", u."name", u."email", u."passwordHash", u."role",
            u."companyId", u."staffClusterId", u."isActive", u."isBlocked",
            c."name" AS "companyName",
            t."approvalStatus" AS "techApprovalStatus",
            t."status" AS "techStatus"
     FROM "User" u
     LEFT JOIN "Company" c ON c."id" = u."companyId"
     LEFT JOIN "Technician" t ON t."userId" = u."id"
     WHERE u."email" = $1`,
    [email]
  );

  if (!user || !user.passwordHash || !user.isActive || user.isBlocked) {
    return { error: genericError };
  }

  if (
    user.role === "TEKNISI" &&
    (user.techApprovalStatus !== "APPROVED" || user.techStatus === "INACTIVE")
  ) {
    return { error: genericError };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { error: genericError };
  }

  const now = new Date();
  await withTransaction(async (tx) => {
    await execute(
      `UPDATE "User" SET "lastLoginAt" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
      [user.id, now],
      tx
    );
    if (user.role === "TEKNISI" && user.techApprovalStatus !== null) {
      await execute(
        `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
        [user.id, now],
        tx
      );
    }
  });

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName ?? null,
    staffClusterId: user.staffClusterId,
  };

  await setSessionCookie(sessionUser);
  return { success: true, user: sessionUser };
}

/**
 * 3C. Pilihan 3 pada Form QR: Daftar / Masuk dengan OTP Email + Persetujuan Data Pribadi
 * - User baru TIDAK dibuat sebelum OTP terverifikasi (data disimpan di `OtpCode.payload`).
 * - `companyId` diturunkan dari `assetCode` di server, bukan dari input klien.
 * - Menerapkan Anti-Enumerasi Email & throttling OTP.
 */
export async function requestInlineOtpAction(input: {
  name: string;
  email: string;
  reporterStatus: "WARGA" | "PENGUNJUNG";
  blockHouseNo?: string;
  dataConsent: boolean;
  assetCode?: string | null;
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

  const normalizedAssetCode = input.assetCode?.trim().toUpperCase();
  const asset = normalizedAssetCode
    ? await queryOne<{ companyId: string }>(
        `SELECT "companyId" FROM "Asset" WHERE "code" = $1`,
        [normalizedAssetCode]
      )
    : null;
  const derivedCompanyId = asset?.companyId ?? null;

  const existing = await queryOne<{
    id: string;
    name: string;
    companyId: string | null;
    role: Role;
    isActive: boolean;
    isBlocked: boolean;
    techApprovalStatus: string | null;
    techStatus: string | null;
  }>(
    `SELECT u."id", u."name", u."companyId", u."role", u."isActive", u."isBlocked",
            t."approvalStatus" AS "techApprovalStatus",
            t."status" AS "techStatus"
     FROM "User" u
     LEFT JOIN "Technician" t ON t."userId" = u."id"
     WHERE u."email" = $1`,
    [email]
  );

  const isExistingEligible =
    !existing ||
    (existing.isActive &&
      !existing.isBlocked &&
      (existing.role !== "TEKNISI" ||
        (existing.techApprovalStatus === "APPROVED" &&
          existing.techStatus !== "INACTIVE")));

  let debugOtpCode: string | undefined;

  if (isExistingEligible) {
    const payload: OtpRegistrationPayload | null = existing
      ? null
      : {
          name,
          reporterStatus: input.reporterStatus,
          blockHouseNo: input.blockHouseNo?.trim() || null,
          dataConsent: true,
          companyId: derivedCompanyId,
        };
    const templateName = existing?.name ?? name;

    const res = await issueOtp({
      email,
      companyId: existing?.companyId ?? derivedCompanyId,
      payload,
      subject: otpReportEmail(templateName, "000000").subject,
      bodyHtml: (code) => otpReportEmail(templateName, code).bodyHtml,
    });

    if (res.issued) {
      after(() => flushEmailOutboxSafely());
      if (process.env.NODE_ENV !== "production") {
        debugOtpCode = res.code;
      }
    }
  }

  // Pesan respons identik baik email baru maupun sudah terdaftar (Anti-Enumerasi PRD Fase 3)
  return {
    success: true,
    debugOtpHint: debugOtpCode,
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

  const verified = await verifyOtp({ email, code });
  if (!verified.ok) {
    return { error: OTP_GENERIC_INVALID_MESSAGE };
  }

  const now = new Date();
  const user = await withTransaction(async (tx) => {
    const target = await queryOne<{
      id: string;
      name: string;
      email: string;
      role: Role;
      companyId: string | null;
      staffClusterId: string | null;
      isActive: boolean;
      isBlocked: boolean;
      companyName: string | null;
      techApprovalStatus: string | null;
      techStatus: string | null;
    }>(
      `SELECT u."id", u."name", u."email", u."role", u."companyId", u."staffClusterId",
              u."isActive", u."isBlocked",
              c."name" AS "companyName",
              t."approvalStatus" AS "techApprovalStatus",
              t."status" AS "techStatus"
       FROM "User" u
       LEFT JOIN "Company" c ON c."id" = u."companyId"
       LEFT JOIN "Technician" t ON t."userId" = u."id"
       WHERE u."email" = $1`,
      [email],
      tx
    );

    if (!target) {
      if (!verified.payload) return null;
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
          verified.payload.companyId,
          verified.payload.name,
          email,
          verified.payload.reporterStatus,
          verified.payload.blockHouseNo,
          now,
        ],
        tx
      );
      if (!created) return null;
      const comp = created.companyId
        ? await queryOne<{ name: string }>(
            `SELECT "name" FROM "Company" WHERE "id" = $1`,
            [created.companyId],
            tx
          )
        : null;
      return { ...created, companyName: comp?.name ?? null };
    }

    if (
      !target.isActive ||
      target.isBlocked ||
      (target.role === "TEKNISI" &&
        (target.techApprovalStatus !== "APPROVED" ||
          target.techStatus === "INACTIVE"))
    ) {
      return null;
    }

    await execute(
      `UPDATE "User" SET "lastLoginAt" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
      [target.id, now],
      tx
    );
    if (target.role === "TEKNISI" && target.techApprovalStatus !== null) {
      await execute(
        `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
        [target.id, now],
        tx
      );
    }

    return {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      companyId: target.companyId,
      staffClusterId: target.staffClusterId,
      companyName: target.companyName,
    };
  });

  if (!user) {
    return { error: OTP_GENERIC_INVALID_MESSAGE };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName ?? null,
    staffClusterId: user.staffClusterId,
  };

  await setSessionCookie(sessionUser);
  return { success: true, user: sessionUser };
}

