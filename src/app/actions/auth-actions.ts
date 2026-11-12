"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { execute, queryOne, withTransaction } from "@/lib/db";
import type { Role, UserRow } from "@/lib/db-types";
import {
  clearSessionCookie,
  getCurrentSession,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { flushEmailOutboxSafely } from "@/lib/email";
import { sanitizeInternalHref } from "@/lib/url-safety";

interface AuthUserLookupRow {
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
}

/**
 * Login menggunakan email dan password.
 * Menerapkan prinsip Anti-Enumerasi Email (PRD 14.5):
 * Pesan kesalahan sama baik email terdaftar maupun tidak.
 */
export async function loginWithPasswordAction(
  formData: FormData,
  returnTo?: string
) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  const genericError =
    "Kredensial tidak valid atau akun belum dapat digunakan. Silakan periksa kembali.";

  const user = await queryOne<AuthUserLookupRow>(
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

  // Teknisi belum disetujui atau berstatus INACTIVE tidak bisa login (§8.3.7)
  if (
    user.role === "TEKNISI" &&
    (user.techApprovalStatus !== "APPROVED" || user.techStatus === "INACTIVE")
  ) {
    return { error: genericError };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
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
  redirect(
    sanitizeInternalHref(returnTo) ??
      (sessionUser.role === "PENGGUNA" ? "/beranda" : "/dashboard")
  );
}

/**
 * Meminta kode OTP ke email (Anti-enumerasi: pesan respons selalu sama).
 */
/**
 * Fitur khusus pengujian: Pindah cepat antar 7 role & multi-perusahaan dengan 1 klik.
 *
 * TODO(pre-prod) P0-1 — Wajib sebelum production:
 * 1. Guard dengan `process.env.NODE_ENV !== "production"` + env flag eksplisit, atau hapus action ini.
 * 2. Blokir fallback `quickSwitchRoleAction` ketika kata sandi login dikosongkan.
 * 3. Ganti pendaftaran cepat tanpa verifikasi dengan alur OTP terverifikasi.
 * 4. Integrasikan Google OAuth asli untuk tombol Google atau sembunyikan tombolnya.
 */
export async function quickSwitchRoleAction(roleOrEmail: string) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEV_QUICK_SWITCH !== "true"
  ) {
    return {
      error: "Fitur pindah akun cepat tidak diaktifkan.",
    };
  }

  const target = roleOrEmail?.trim();
  if (!target) {
    return { error: "Identitas akun tidak boleh kosong." };
  }

  let user: AuthUserLookupRow | null = null;

  try {
    user = await queryOne<AuthUserLookupRow>(
      `SELECT u."id", u."name", u."email", u."passwordHash", u."role",
              u."companyId", u."staffClusterId", u."isActive", u."isBlocked",
              c."name" AS "companyName",
              t."approvalStatus" AS "techApprovalStatus",
              t."status" AS "techStatus"
       FROM "User" u
       LEFT JOIN "Company" c ON c."id" = u."companyId"
       LEFT JOIN "Technician" t ON t."userId" = u."id"
       WHERE LOWER(u."email") = LOWER($1) OR u."role"::text = $1
       ORDER BY CASE WHEN LOWER(u."email") = LOWER($1) THEN 0 ELSE 1 END, u."createdAt" ASC
       LIMIT 1`,
      [target]
    );

    if (!user) {
      return { error: `Akun "${target}" tidak ditemukan di database.` };
    }

    if (!user.isActive || user.isBlocked) {
      return {
        error: `Akun ${user.email} sedang tidak aktif atau diblokir.`,
      };
    }

    if (
      user.role === "TEKNISI" &&
      (user.techApprovalStatus !== "APPROVED" || user.techStatus === "INACTIVE")
    ) {
      return {
        error: `Akun teknisi ${user.email} belum disetujui atau berstatus nonaktif.`,
      };
    }

    const now = new Date();
    await withTransaction(async (tx) => {
      await execute(
        `UPDATE "User" SET "lastLoginAt" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
        [user!.id, now],
        tx
      );
      if (user!.role === "TEKNISI" && user!.techApprovalStatus !== null) {
        await execute(
          `UPDATE "Technician" SET "lastActiveAt" = $2, "updatedAt" = NOW() WHERE "userId" = $1`,
          [user!.id, now],
          tx
        );
      }
    });
  } catch (err) {
    console.error("[quickSwitchRoleAction] Database error:", err);
    return {
      error: "Gagal mengakses database saat berganti akun. Pastikan PostgreSQL aktif.",
    };
  }

  await setSessionCookie({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.companyName ?? null,
    staffClusterId: user.staffClusterId,
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function updateUserProfileAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string)?.trim();
    const reporterStatus = (formData.get("reporterStatus") as string)?.trim();
    const blockHouseNo = (formData.get("blockHouseNo") as string)?.trim() || null;
    const dataConsent = formData.get("dataConsent") === "on";

    if (!name) {
      return { error: "Nama lengkap tidak boleh kosong." };
    }

    const existing = await queryOne<{
      id: string;
      companyId: string | null;
      name: string;
      reporterStatus: string | null;
      blockHouseNo: string | null;
      dataConsentAt: Date | null;
    }>(
      `SELECT "id", "companyId", "name", "reporterStatus", "blockHouseNo", "dataConsentAt"
       FROM "User"
       WHERE "id" = $1`,
      [session.id]
    );
    if (!existing) {
      return { error: "Akun tidak ditemukan." };
    }

    const nextReporterStatus = reporterStatus ? reporterStatus : null;
    if (
      nextReporterStatus !== null &&
      nextReporterStatus !== "WARGA" &&
      nextReporterStatus !== "PENGUNJUNG"
    ) {
      return { error: "Status pelapor hanya boleh WARGA atau PENGUNJUNG." };
    }
    const nextConsentAt = dataConsent ? new Date() : existing.dataConsentAt;

    const updated = await withTransaction(async (tx) => {
      const saved = await queryOne<UserRow>(
        `UPDATE "User"
         SET "name" = $2,
             "reporterStatus" = $3,
             "blockHouseNo" = $4,
             "dataConsentAt" = $5,
             "updatedAt" = NOW()
         WHERE "id" = $1
         RETURNING *`,
        [session.id, name, nextReporterStatus, blockHouseNo, nextConsentAt],
        tx
      );
      if (!saved) throw new Error("Gagal memperbarui profil.");

      if (existing.companyId) {
        await recordAuditLog(
          {
            companyId: existing.companyId,
            actor: session,
            entityName: "User",
            entityId: saved.id,
            action: "UPDATE",
            summary: `${session.name} memperbarui profil akun sendiri`,
            oldValues: {
              name: existing.name,
              reporterStatus: existing.reporterStatus,
              blockHouseNo: existing.blockHouseNo,
              dataConsentAt: existing.dataConsentAt,
            },
            newValues: {
              name: saved.name,
              reporterStatus: saved.reporterStatus,
              blockHouseNo: saved.blockHouseNo,
              dataConsentAt: saved.dataConsentAt,
            },
          },
          tx
        );
      }

      return saved;
    });

    // Perbarui session cookie jika nama berubah
    if (session.name !== updated.name) {
      await setSessionCookie({
        ...session,
        name: updated.name,
      });
    }

    revalidatePath("/dashboard/profil");
    revalidatePath("/dashboard");
    revalidatePath("/beranda/profil");
    revalidatePath("/beranda");

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui profil." };
  }
}

