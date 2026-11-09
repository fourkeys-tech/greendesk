"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";

/**
 * Login menggunakan email dan password.
 * Menerapkan prinsip Anti-Enumerasi Email (PRD 14.5):
 * Pesan kesalahan sama baik email terdaftar maupun tidak.
 */
export async function loginWithPasswordAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  const genericError =
    "Kredensial tidak valid atau akun belum dapat digunakan. Silakan periksa kembali.";

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      company: { select: { name: true } },
      technicianProfile: { select: { approvalStatus: true } },
    },
  });

  if (!user || !user.passwordHash || !user.isActive || user.isBlocked) {
    return { error: genericError };
  }

  // Teknisi belum disetujui tidak bisa login
  if (
    user.role === "TEKNISI" &&
    user.technicianProfile &&
    user.technicianProfile.approvalStatus !== "APPROVED"
  ) {
    return { error: genericError };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: genericError };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
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
  redirect("/dashboard");
}

/**
 * Meminta kode OTP ke email (Anti-enumerasi: pesan respons selalu sama).
 */
export async function requestOtpAction(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email) {
    return { error: "Masukkan alamat email yang valid." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user && user.isActive && !user.isBlocked) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    await prisma.otpCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    await sendTransactionalEmail({
      companyId: user.companyId,
      toEmail: email,
      subject: `Kode OTP Masuk GreenPark: ${code}`,
      bodyHtml: `<p>Kode verifikasi satu kali (OTP) Anda adalah: <strong style="font-size:18px;">${code}</strong> (berlaku 10 menit).</p>`,
      triggerType: "OTP_LOGIN",
    });
  }

  // Respons identik baik email terdaftar maupun belum (Anti-enumerasi PRD 14.5)
  return {
    success: true,
    message:
      "Jika alamat email terdaftar dan aktif, kode OTP telah dikirimkan ke email tersebut (cek juga log Email Outbox di dev).",
  };
}

/**
 * Verifikasi kode OTP untuk login.
 */
export async function verifyOtpAction(emailInput: string, codeInput: string) {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim();

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

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await setSessionCookie({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    staffClusterId: user.staffClusterId,
  });

  redirect("/dashboard");
}

const FALLBACK_DEMO_PROFILES: Record<string, SessionUser> = {
  "admin@greenpark.id": {
    id: "usr-admin-demo",
    name: "Arfin Mardiyanto",
    email: "admin@greenpark.id",
    role: "ADMIN",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  ADMIN: {
    id: "usr-admin-demo",
    name: "Arfin Mardiyanto",
    email: "admin@greenpark.id",
    role: "ADMIN",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "owner@greenpark.id": {
    id: "usr-owner-demo",
    name: "Ir. Surya Darmawan",
    email: "owner@greenpark.id",
    role: "OWNER",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  OWNER: {
    id: "usr-owner-demo",
    name: "Ir. Surya Darmawan",
    email: "owner@greenpark.id",
    role: "OWNER",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "manager@greenpark.id": {
    id: "usr-manager-demo",
    name: "Diana Kusuma",
    email: "manager@greenpark.id",
    role: "MANAGER",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  MANAGER: {
    id: "usr-manager-demo",
    name: "Diana Kusuma",
    email: "manager@greenpark.id",
    role: "MANAGER",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "pengelola.bgv@greenpark.id": {
    id: "usr-pengelola-demo",
    name: "Hendro Wibowo",
    email: "pengelola.bgv@greenpark.id",
    role: "PENGELOLA",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  PENGELOLA: {
    id: "usr-pengelola-demo",
    name: "Hendro Wibowo",
    email: "pengelola.bgv@greenpark.id",
    role: "PENGELOLA",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "pic@vendorjaya.id": {
    id: "usr-pic-demo",
    name: "Agus Pratama",
    email: "pic@vendorjaya.id",
    role: "PIC_VENDOR",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  PIC_VENDOR: {
    id: "usr-pic-demo",
    name: "Agus Pratama",
    email: "pic@vendorjaya.id",
    role: "PIC_VENDOR",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "teknisi.budi@vendorjaya.id": {
    id: "usr-teknisi-demo",
    name: "Budi Santoso",
    email: "teknisi.budi@vendorjaya.id",
    role: "TEKNISI",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  TEKNISI: {
    id: "usr-teknisi-demo",
    name: "Budi Santoso",
    email: "teknisi.budi@vendorjaya.id",
    role: "TEKNISI",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  "warga@greenpark.id": {
    id: "usr-warga-demo",
    name: "Rina Kartika",
    email: "warga@greenpark.id",
    role: "PENGGUNA",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
  PENGGUNA: {
    id: "usr-warga-demo",
    name: "Rina Kartika",
    email: "warga@greenpark.id",
    role: "PENGGUNA",
    companyId: "seed-company-thn",
    companyName: "PT Taman Hijau Nusantara",
    staffClusterId: null,
  },
};

/**
 * Fitur khusus pengujian: Pindah cepat antar 7 role dengan 1 klik (Mendukung mode DB & offline statis).
 */
export async function quickSwitchRoleAction(roleOrEmail: string) {
  let sessionUser: SessionUser | null = null;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: roleOrEmail },
          { role: roleOrEmail as any },
        ],
      },
      include: { company: { select: { name: true } } },
    });

    if (user) {
      sessionUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company?.name ?? null,
        staffClusterId: user.staffClusterId,
      };
    }
  } catch {
    // Database offline / dev fallback
  }

  if (!sessionUser) {
    sessionUser = FALLBACK_DEMO_PROFILES[roleOrEmail] || {
      id: "usr-admin-demo",
      name: "Arfin Mardiyanto",
      email: "admin@greenpark.id",
      role: "ADMIN",
      companyId: "seed-company-thn",
      companyName: "PT Taman Hijau Nusantara",
      staffClusterId: null,
    };
  }

  await setSessionCookie(sessionUser);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

