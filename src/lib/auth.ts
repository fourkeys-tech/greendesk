import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { ApprovalStatus, Role, TechnicianStatus } from "./db-types";
import { queryOne } from "./db";

export const SESSION_COOKIE_NAME = "greenpark_session";
const SESSION_DURATION_DAYS = 30; // Sesuai PRD Bagian 6 Fase 3: Sesi login panjang (usulan 30 hari)

function getJwtSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Konfigurasi AUTH_SECRET belum diatur di file .env. Lihat .env.example."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  companyName: string | null;
  staffClusterId: string | null;
  technicianApprovalStatus?: string | null;
  isDualRolePic?: boolean;
}

export type SessionPayload = SessionUser;

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (!payload || typeof payload.id !== "string") {
      return null;
    }
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
      companyId: (payload.companyId as string | null) ?? null,
      companyName: (payload.companyName as string | null) ?? null,
      staffClusterId: (payload.staffClusterId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

/**
 * Dilempar saat database tidak bisa dihubungi ketika memvalidasi sesi.
 * Sesi TIDAK boleh jatuh ke payload JWT (fail-open): user yang sudah diblokir/dihapus
 * akan tetap "login" selama DB mati. Error boundary dashboard menampilkan halaman gangguan.
 */
export class SessionUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Layanan sedang gangguan: sesi tidak dapat divalidasi.");
    this.name = "SessionUnavailableError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Mengambil sesi pengguna saat ini dan memvalidasi status aktif/blokir dari database.
 * Di-memoize per-request menggunakan React cache() untuk mencegah duplikasi query dalam satu siklus render.
 */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  let dbUser: {
    id: string;
    name: string;
    email: string;
    role: Role;
    companyId: string | null;
    staffClusterId: string | null;
    isActive: boolean;
    isBlocked: boolean;
    companyName: string | null;
    techApprovalStatus: ApprovalStatus | null;
    techStatus: TechnicianStatus | null;
    managedVendorId: string | null;
  } | null;

  try {
    dbUser = await queryOne(
      `SELECT
         u."id",
         u."name",
         u."email",
         u."role",
         u."companyId",
         u."staffClusterId",
         u."isActive",
         u."isBlocked",
         c."name" AS "companyName",
         t."approvalStatus" AS "techApprovalStatus",
         t."status" AS "techStatus",
         v."id" AS "managedVendorId"
       FROM "User" u
       LEFT JOIN "Company" c ON c."id" = u."companyId"
       LEFT JOIN "Technician" t ON t."userId" = u."id"
       LEFT JOIN "Vendor" v ON v."picUserId" = u."id"
       WHERE u."id" = $1
       LIMIT 1`,
      [decoded.id]
    );
  } catch (err) {
    // Fail-closed (P0-3): tanpa DB, sesi tidak bisa dipercaya.
    throw new SessionUnavailableError(err);
  }

  // User sudah dihapus / id fiktif (mis. profil demo tanpa baris DB) → tidak ada sesi.
  if (!dbUser) return null;

  if (!dbUser.isActive || dbUser.isBlocked) {
    return null;
  }

  if (dbUser.role === "TEKNISI" && dbUser.techApprovalStatus) {
    // Teknisi belum disetujui Admin tidak bisa login (PRD Fase 2)
    if (dbUser.techApprovalStatus !== "APPROVED") {
      return null;
    }
    // Teknisi nonaktif (manual/otomatis 60 hari, §8.3.7) tidak bisa login; cuti tetap boleh.
    if (dbUser.techStatus === "INACTIVE") {
      return null;
    }
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    companyId: dbUser.companyId,
    companyName: dbUser.companyName ?? null,
    staffClusterId: dbUser.staffClusterId,
    technicianApprovalStatus: dbUser.techApprovalStatus ?? null,
    isDualRolePic: Boolean(dbUser.managedVendorId),
  };
});

