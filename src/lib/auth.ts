import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

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
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Mengambil sesi pengguna saat ini dan memvalidasi status aktif/blokir dari database.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: {
      company: { select: { name: true } },
      technicianProfile: { select: { approvalStatus: true, status: true } },
    },
  });

  if (!dbUser || !dbUser.isActive || dbUser.isBlocked) {
    return null;
  }

  // Teknisi belum disetujui Admin tidak bisa login (PRD Fase 2)
  if (
    dbUser.role === "TEKNISI" &&
    dbUser.technicianProfile &&
    dbUser.technicianProfile.approvalStatus !== "APPROVED"
  ) {
    return null;
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    companyId: dbUser.companyId,
    companyName: dbUser.company?.name ?? null,
    staffClusterId: dbUser.staffClusterId,
  };
}

