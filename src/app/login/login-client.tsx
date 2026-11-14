"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  Building,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Crown,
  Briefcase,
  Building2,
  Truck,
  Wrench,
  UserCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  FileText,
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import {
  quickSwitchRoleAction,
  loginWithPasswordAction,
} from "@/app/actions/auth-actions";

type AuthMode = "login" | "developer";

const inputClass =
  "w-full h-12 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20";

const primaryBtn =
  "w-full h-12 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[13px] font-bold tracking-wide shadow-lg shadow-[#1b5e45]/20 flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer";

const secondaryBtn =
  "w-full h-12 rounded-2xl bg-white border border-[#1b5e45] text-[#1b5e45] hover:bg-[#1b5e45]/5 text-[13px] font-bold tracking-wide flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer";

export const DEMO_ACCOUNTS = [
  {
    role: "ADMIN",
    label: "Admin Perusahaan",
    email: "admin@greenpark.id",
    name: "Arfin Mardiyanto",
    companyNote: "PT Taman Hijau Nusantara (Semua Cluster)",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    icon: ShieldCheck,
  },
  {
    role: "OWNER",
    label: "Owner / Direksi",
    email: "owner@greenpark.id",
    name: "Ir. Surya Darmawan",
    companyNote: "Direksi PT Taman Hijau Nusantara",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    icon: Crown,
  },
  {
    role: "MANAGER",
    label: "Manager Lapangan",
    email: "manager@greenpark.id",
    name: "Diana Kusuma",
    companyNote: "Cluster Bougenville & Edelweiss",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: Briefcase,
  },
  {
    role: "PENGELOLA",
    label: "Pengelola Cluster",
    email: "pengelola.bgv@greenpark.id",
    name: "Hendro Wibowo",
    companyNote: "Cluster Bougenville",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    icon: Building2,
  },
  {
    role: "PIC_VENDOR",
    label: "PIC Vendor",
    email: "pic@vendorjaya.id",
    name: "Agus Pratama",
    companyNote: "Vendor: PT Teknik Taman Jaya",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Truck,
  },
  {
    role: "TEKNISI",
    label: "Teknisi Rekanan",
    email: "teknisi.budi@vendorjaya.id",
    name: "Budi Santoso",
    companyNote: "Teknisi Lapangan Disetujui",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Wrench,
  },
  {
    role: "PENGGUNA",
    label: "Warga / Pelapor",
    email: "warga@greenpark.id",
    name: "Rina Kartika",
    companyNote: "Warga Bougenville A2/15",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: UserCheck,
  },
];

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-bold text-slate-900 mb-1.5">
        {label}
      </span>
      <span className="relative block">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Login Google belum dikonfigurasi pada server.",
  consent_required: "Persetujuan data pribadi wajib dicentang terlebih dahulu.",
  access_denied: "Autentikasi Google dibatalkan.",
  invalid_state: "Sesi autentikasi Google tidak valid. Silakan coba lagi.",
  expired_state: "Sesi autentikasi Google kedaluwarsa. Silakan coba lagi.",
  account_blocked: "Akun Anda sedang dinonaktifkan atau diblokir.",
  internal_role_password_required:
    "Akun staf/internal harus masuk menggunakan email dan kata sandi.",
  oauth_failed: "Gagal memverifikasi akun Google. Silakan coba lagi.",
};

export function LoginClient({
  allowDevQuickSwitch = false,
  googleOAuthEnabled = false,
  googleStartUrl = "/api/auth/google/start",
  oauthError = null,
  returnTo,
}: {
  allowDevQuickSwitch?: boolean;
  googleOAuthEnabled?: boolean;
  googleStartUrl?: string;
  oauthError?: string | null;
  returnTo?: string;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState(
    DEMO_ACCOUNTS[0].email
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    oauthError ? OAUTH_ERROR_MESSAGES[oauthError] ?? "Login Google gagal." : null
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  const switchMode = (mode: AuthMode) => {
    setShowPassword(false);
    setErrorMessage(null);
    setInfoMessage(null);
    setAuthMode(mode);
  };

  const handleRoleSwitch = (target: string) => {
    if (!allowDevQuickSwitch) {
      setErrorMessage("Fitur pindah akun cepat tidak diaktifkan.");
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await quickSwitchRoleAction(target);
        if (res?.error) {
          setErrorMessage(res.error);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Gagal berganti akun."
        );
      }
    });
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage("Email dan kata sandi wajib diisi.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", loginEmail);
      formData.set("password", loginPassword);
      const res = await loginWithPasswordAction(formData, returnTo);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  const handleDeveloperLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowDevQuickSwitch) {
      setErrorMessage("Developer Portal tidak diaktifkan.");
      return;
    }
    handleRoleSwitch(devEmail || "admin@greenpark.id");
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 z-10 cursor-pointer"
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  const title =
    authMode === "developer" ? "Developer Portal" : null;

  const subtitle =
    authMode === "developer" ? "Akses pengujian instan menuju panel admin" : null;

  const errorBanner = (
    <>
      {errorMessage && (
        <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMessage}
        </div>
      )}
      {infoMessage && (
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {infoMessage}
        </div>
      )}
    </>
  );

  // Blok form & panel demo dipakai ulang oleh layout mobile dan desktop (hanya satu yang tampil via CSS).
  const loginForm = (
    <form onSubmit={handleUserLogin} className="space-y-3.5 mt-1">
      <Field label="Alamat Email" icon={<Mail className="w-4 h-4" />}>
        <input
          type="email"
          required
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          placeholder="nama@email.com"
          className={inputClass}
        />
      </Field>

      <Field label="Kata Sandi" icon={<Lock className="w-4 h-4" />}>
        <input
          type={showPassword ? "text" : "password"}
          required
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          placeholder="Masukkan kata sandi"
          className={`${inputClass} pr-10`}
        />
        {passwordToggle}
      </Field>

      <div className="pt-2 space-y-2.5">
        <button type="submit" disabled={isPending} className={primaryBtn}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>MEMPROSES...</span>
            </span>
          ) : (
            "LOGIN KE DASHBOARD"
          )}
        </button>
        {googleOAuthEnabled && (
          <a
            href={
              returnTo
                ? `${googleStartUrl}?returnTo=${encodeURIComponent(returnTo)}&consent=1`
                : `${googleStartUrl}?consent=1`
            }
            className="w-full h-12 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[13px] font-bold tracking-wide flex items-center justify-center gap-2 transition"
          >
            <span>MASUK DENGAN GOOGLE</span>
          </a>
        )}
        <p className="text-[11px] text-center text-slate-500 pt-1">
          Warga baru?{" "}
          <Link
            href={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : "/register"}
            className="font-bold text-[#1b5e45] hover:underline"
          >
            Daftar akun warga dengan verifikasi email →
          </Link>
        </p>
      </div>
    </form>
  );

  const developerForm = (
    <form onSubmit={handleDeveloperLogin} className="space-y-3.5">
      <Field label="Email Developer / Admin" icon={<Mail className="w-4 h-4" />}>
        <input
          type="email"
          value={devEmail}
          onChange={(e) => setDevEmail(e.target.value)}
          placeholder="admin@greenpark.id"
          className={inputClass}
        />
      </Field>

      <Field label="Password (Opsional saat Dev)" icon={<Lock className="w-4 h-4" />}>
        <input
          type={showPassword ? "text" : "password"}
          value={devPassword}
          onChange={(e) => setDevPassword(e.target.value)}
          placeholder="••••••••"
          className={`${inputClass} pr-10`}
        />
        {passwordToggle}
      </Field>

      <div className="pt-2 space-y-2.5">
        <button type="submit" disabled={isPending} className={primaryBtn}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>MEMBUKA DASHBOARD...</span>
            </span>
          ) : (
            "MASUK KE DASHBOARD ADMIN"
          )}
        </button>
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={secondaryBtn}
        >
          KEMBALI KE LOGIN
        </button>
      </div>
    </form>
  );

  const activeForm =
    authMode === "developer" && allowDevQuickSwitch
      ? developerForm
      : loginForm;

  const demoPanel = allowDevQuickSwitch ? (
    <div className="mt-5 pt-4 border-t border-slate-200/90 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#1b5e45]" />
          <span>Masuk Cepat 1-Klik (Uji 7 Role)</span>
        </span>
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-[#1b5e45] border border-emerald-300">
          PRD v0.2
        </span>
      </div>

      <p className="text-[11px] text-slate-500 leading-tight">
        Pilih role akun demo untuk langsung masuk ke <code>/dashboard</code>:
      </p>

      {/* Dropdown Selector + Tombol Masuk */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            value={selectedDemoRole}
            onChange={(e) => setSelectedDemoRole(e.target.value)}
            disabled={isPending}
            className="w-full h-10 rounded-xl bg-white border border-slate-200 pl-3 pr-8 text-[11px] font-semibold text-slate-800 shadow-xs outline-none focus:border-[#1b5e45] appearance-none"
          >
            {DEMO_ACCOUNTS.map((d) => (
              <option key={d.role} value={d.email}>
                {d.role} – {d.name} ({d.email})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => handleRoleSwitch(selectedDemoRole)}
          className="h-10 px-3.5 rounded-xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[11px] font-bold shadow-xs flex items-center gap-1 transition disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <span>Masuk</span>
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* 1-Click Role Chips */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        {DEMO_ACCOUNTS.map((d) => {
          const Icon = d.icon;
          return (
            <button
              key={d.role}
              type="button"
              disabled={isPending}
              onClick={() => handleRoleSwitch(d.email)}
              className={`p-2 rounded-xl border text-left flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition cursor-pointer ${d.badgeColor}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold truncate leading-tight">
                  {d.role}
                </div>
                <div className="text-[9px] opacity-80 truncate">
                  {d.name}
                </div>
              </div>
            </button>
          );
        })}

        {/* Tombol Uji Isolasi Multi-Perusahaan (Perusahaan B) */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleRoleSwitch("admin@griyaasri.id")}
          className="col-span-2 p-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/70 text-left flex items-center justify-between gap-2 hover:bg-indigo-100/70 transition cursor-pointer text-indigo-950"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold truncate">
                Uji Isolasi Multi-Perusahaan (Perusahaan B)
              </div>
              <div className="text-[9px] text-indigo-700 truncate">
                Admin PT Griya Asri (admin@griyaasri.id)
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-700 shrink-0">
            Uji →
          </span>
        </button>
      </div>

      {/* Shortcut ke Developer Portal Tab jika sedang di mode login */}
      {authMode === "login" && (
        <div className="text-center pt-1.5">
          <button
            type="button"
            onClick={() => switchMode("developer")}
            className="text-[11px] font-semibold text-slate-500 hover:text-[#1b5e45] transition inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Akses Khusus Developer Portal</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {/* ===== MOBILE ===== */}
      <MobileContainer className="bg-[#f6f4ee] overflow-hidden">
        <main className="flex-1 overflow-y-auto px-7 pt-8 pb-8 flex flex-col">
          {/* Header Bar: Link cepat Lapor Warga */}
          <div className="flex items-center justify-between pb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              GreenDesk v0.2
            </span>
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#1b5e45] text-[11px] font-bold transition border border-emerald-300"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lapor Kerusakan</span>
            </Link>
          </div>

          {/* Logo GreenDesk */}
          <h1 className="text-center text-[30px] tracking-tight leading-none pt-2">
            <span className="font-extrabold text-[#1b5e45]">Green</span>
            <span className="font-semibold text-[#1b5e45]">Desk</span>
          </h1>

          {/* Ilustrasi Fasilitas Taman */}
          {authMode === "login" && (
            <div className="flex items-center justify-center py-4">
              <img
                src="/images/Kursi%20Taman.png"
                alt="Ilustrasi Fasilitas Taman"
                className="w-full max-w-[240px] h-auto object-contain select-none pointer-events-none"
              />
            </div>
          )}

          {title && (
            <div className={`text-center ${authMode === "login" ? "" : "mt-4"} mb-3`}>
              <h2 className="text-[18px] font-bold text-[#1b5e45] leading-tight">
                {title}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>
            </div>
          )}

          {errorBanner}
          {activeForm}
          {demoPanel}
        </main>
      </MobileContainer>

      {/* ===== DESKTOP / TABLET ===== */}
      <div className="hidden md:flex min-h-screen bg-[#F6F5F0] items-center justify-center p-6">
        <div className="w-full max-w-4xl lg:max-w-5xl grid grid-cols-12 rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Kiri: panel branding */}
          <div className="col-span-5 bg-gradient-to-br from-[#1b5e45] to-[#113d2d] p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs text-white/80 mt-1">Platform Manajemen Fasilitas Taman</p>
              <div className="mt-8 space-y-4">
                <h2 className="text-2xl font-bold text-white leading-tight">
                  Mari Bersama Merawat Fasilitas Taman
                </h2>
                <p className="text-xs text-white/80 leading-relaxed">
                  Laporkan kerusakan secara instan melalui pemindaian QR code dan pantau
                  perbaikan secara langsung hingga selesai.
                </p>
              </div>
            </div>
            <div className="relative z-10 my-4 flex items-center justify-center">
              <div className="relative w-48 h-48 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg">
                <img
                  src="/assets/KursiTaman.svg"
                  alt="Ilustrasi Kursi Taman"
                  className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-md"
                />
              </div>
            </div>
            <div className="relative z-10 space-y-2 pt-2 border-t border-white/15 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <span className="text-[#8be294]">✓</span>
                <span>Akses Cepat QR Code</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8be294]">✓</span>
                <span>Status Pengerjaan Terbuka &amp; Realtime</span>
              </div>
            </div>
          </div>

          {/* Kanan: form autentikasi */}
          <div className="col-span-7 p-8 lg:p-10 flex flex-col justify-center bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <img
                src="/assets/GreenDesk.svg"
                alt="GreenDesk Logo"
                className="h-9 w-auto object-contain"
              />
              <Link
                href="/scan"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#1b5e45] text-[11px] font-bold transition border border-emerald-300"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Lapor Kerusakan</span>
              </Link>
            </div>

            <div className="mt-2 mb-5">
              {title && (
                <h3 className="text-lg font-bold text-[#1b5e45] leading-tight">{title}</h3>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {authMode === "login"
                  ? "Masuk dengan akun terdaftar untuk membuat dan memantau laporan"
                  : subtitle}
              </p>
            </div>

            {errorBanner}
            {activeForm}
            {demoPanel}
          </div>
        </div>
      </div>
    </>
  );
}
