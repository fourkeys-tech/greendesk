import crypto from "crypto";
import { execute, queryCount, queryOne, withTransaction } from "../db";
import type { OtpCodeRow } from "../db-types";
import { enqueueEmail, escapeHtml } from "../email";

/**
 * Layanan OTP email untuk verifikasi pendaftaran warga.
 *
 * Keamanan (P0-2):
 * - Kode dibuat dengan `crypto.randomInt`, disimpan sebagai sha256(email:kode) — bukan plaintext.
 * - Setiap permintaan baru menghanguskan kode lama yang belum terpakai.
 * - Maksimal OTP_MAX_ATTEMPTS percobaan per kode; lewat itu kode hangus.
 * - Throttle per email: 1 permintaan / 60 detik dan 5 permintaan / jam.
 * - Respons tetap generik (anti-enumerasi §8.1).
 * - Data pendaftaran disimpan di `OtpCode.payload`; user baru dibuat setelah verifikasi sukses.
 */

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MIN_INTERVAL_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;

export const OTP_GENERIC_INVALID_MESSAGE =
  "Kode OTP tidak valid atau sudah kedaluwarsa.";

export interface OtpRegistrationPayload {
  name: string;
  reporterStatus: "WARGA" | "PENGUNJUNG";
  blockHouseNo: string | null;
  dataConsent: true;
  companyId: string | null;
}

export function hashOtpCode(email: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export type OtpIssueResult =
  | { issued: true; code: string }
  | { issued: false; reason: "THROTTLED" | "NOT_ELIGIBLE" };

/**
 * Menerbitkan OTP untuk email. Mengembalikan kode mentah HANYA untuk dipakai pemanggil
 * (debug hint di non-production). Pemanggil WAJIB memastikan alamat email belum terdaftar
 * dan mengirimkan payload pendaftaran yang akan diverifikasi.
 */
export async function issueOtp(params: {
  email: string;
  companyId?: string | null;
  payload?: OtpRegistrationPayload | null;
  subject: string;
  bodyHtml: (code: string) => string;
}): Promise<OtpIssueResult> {
  const email = params.email.trim().toLowerCase();
  const now = new Date();

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [lastIssued, issuedLastHour] = await Promise.all([
    queryOne<{ createdAt: Date }>(
      `SELECT "createdAt" FROM "OtpCode"
       WHERE "email" = $1
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [email]
    ),
    queryCount(
      `SELECT COUNT(*)::int AS count FROM "OtpCode"
       WHERE "email" = $1 AND "createdAt" >= $2`,
      [email, oneHourAgo]
    ),
  ]);

  if (
    (lastIssued &&
      now.getTime() - lastIssued.createdAt.getTime() <
        OTP_MIN_INTERVAL_SECONDS * 1000) ||
    issuedLastHour >= OTP_MAX_PER_HOUR
  ) {
    return { issued: false, reason: "THROTTLED" };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

  await withTransaction(async (tx) => {
    // Kode lama yang belum terpakai dihanguskan
    await execute(
      `UPDATE "OtpCode" SET "usedAt" = $2 WHERE "email" = $1 AND "usedAt" IS NULL`,
      [email, now],
      tx
    );

    await execute(
      `INSERT INTO "OtpCode" ("email", "code", "expiresAt", "payload")
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        email,
        hashOtpCode(email, code),
        expiresAt,
        params.payload ? JSON.stringify(params.payload) : null,
      ],
      tx
    );

    await enqueueEmail(tx, {
      companyId: params.companyId ?? null,
      toEmail: email,
      subject: params.subject,
      bodyHtml: params.bodyHtml(code),
      triggerType: "OTP_REGISTRATION",
    });
  });

  return { issued: true, code };
}

export type OtpVerifyResult =
  | { ok: true; otpId: string; payload: OtpRegistrationPayload | null }
  | { ok: false };

/**
 * Memverifikasi kode untuk email. Satu kali sukses → kode ditandai terpakai.
 * Setiap kegagalan menaikkan `attempts`; setelah OTP_MAX_ATTEMPTS kode hangus.
 * Operasi dilakukan atomik agar dua verifikasi bersamaan tidak sama-sama lolos.
 */
export async function verifyOtp(params: {
  email: string;
  code: string;
}): Promise<OtpVerifyResult> {
  const email = params.email.trim().toLowerCase();
  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false };

  const now = new Date();
  const hashed = hashOtpCode(email, code);

  return withTransaction(async (tx) => {
    const current = await queryOne<OtpCodeRow>(
      `SELECT * FROM "OtpCode"
       WHERE "email" = $1 AND "usedAt" IS NULL AND "expiresAt" >= $2
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [email, now],
      tx
    );

    if (!current) return { ok: false };

    if (current.attempts >= OTP_MAX_ATTEMPTS) {
      await execute(
        `UPDATE "OtpCode" SET "usedAt" = $2 WHERE "id" = $1`,
        [current.id, now],
        tx
      );
      return { ok: false };
    }

    if (current.code !== hashed) {
      const nextAttempts = current.attempts + 1;
      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        await execute(
          `UPDATE "OtpCode" SET "attempts" = $2, "usedAt" = $3 WHERE "id" = $1`,
          [current.id, nextAttempts, now],
          tx
        );
      } else {
        await execute(
          `UPDATE "OtpCode" SET "attempts" = $2 WHERE "id" = $1`,
          [current.id, nextAttempts],
          tx
        );
      }
      return { ok: false };
    }

    // Guard atomik: hanya satu request yang berhasil menandai usedAt
    const claimed = await execute(
      `UPDATE "OtpCode" SET "usedAt" = $2 WHERE "id" = $1 AND "usedAt" IS NULL`,
      [current.id, now],
      tx
    );
    if (claimed !== 1) return { ok: false };

    const payload = (current.payload as OtpRegistrationPayload | null) ?? null;
    return { ok: true, otpId: current.id, payload };
  });
}

/** Registration-only email template. */
export function otpRegistrationEmail(name: string, code: string) {
  return {
    subject: "Kode verifikasi pendaftaran GreenPark",
    bodyHtml: `<p>Halo ${escapeHtml(name)}, kode OTP untuk verifikasi pendaftaran akun Anda adalah: <strong style="font-size:18px;letter-spacing:2px;">${code}</strong> (berlaku ${OTP_TTL_MINUTES} menit).</p><p style="color:#64748b;font-size:12px;">Abaikan email ini bila Anda tidak meminta kode.</p>`,
  };
}
