"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
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
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import { quickSwitchRoleAction } from "@/app/actions/auth-actions";

type AuthMode = "login" | "register" | "developer";

const inputClass =
  "w-full h-12 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20";

const primaryBtn =
  "w-full h-12 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[13px] font-bold tracking-wide shadow-lg shadow-[#1b5e45]/20 flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer";

const secondaryBtn =
  "w-full h-12 rounded-2xl bg-white border border-[#1b5e45] text-[#1b5e45] hover:bg-[#1b5e45]/5 text-[13px] font-bold tracking-wide flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer";

const DEMO_ROLES = [
  {
    role: "ADMIN",
    label: "Admin Perusahaan",
    email: "admin@greenpark.id",
    desc: "Master data, QR, staf, & persetujuan teknisi",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    icon: ShieldCheck,
  },
  {
    role: "OWNER",
    label: "Owner / Direksi",
    email: "owner@greenpark.id",
    desc: "KPI eksekutif, SLA, vendor, & transparansi audit",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    icon: Crown,
  },
  {
    role: "MANAGER",
    label: "Manager Lapangan",
    email: "manager@greenpark.id",
    desc: "Persetujuan perbaikan, SPK, & konfirmasi hasil",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: Briefcase,
  },
  {
    role: "PENGELOLA",
    label: "Pengelola Cluster",
    email: "pengelola.bgv@greenpark.id",
    desc: "Verifikasi awal laporan & penentuan prioritas",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    icon: Building2,
  },
  {
    role: "PIC_VENDOR",
    label: "PIC Vendor",
    email: "pic@vendorjaya.id",
    desc: "Terima SPK, kelola & tugaskan teknisi",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Truck,
  },
  {
    role: "TEKNISI",
    label: "Teknisi Rekanan",
    email: "teknisi.budi@vendorjaya.id",
    desc: "Perbaikan fisik, foto bukti sebelum/sesudah",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Wrench,
  },
  {
    role: "PENGGUNA",
    label: "Warga / Pelapor",
    email: "warga@greenpark.id",
    desc: "Lapor fasilitas rusak & pantau tiket",
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

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState("ADMIN");
  const [isPending, startTransition] = useTransition();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCluster, setRegCluster] = useState("");

  const switchMode = (mode: AuthMode) => {
    setShowPassword(false);
    setAuthMode(mode);
  };

  const handleRoleSwitch = (target: string) => {
    startTransition(async () => {
      await quickSwitchRoleAction(target);
    });
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    handleRoleSwitch(loginEmail || "warga@greenpark.id");
  };

  const handleDeveloperLogin = (e: React.FormEvent) => {
    e.preventDefault();
    handleRoleSwitch(devEmail || "admin@greenpark.id");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    handleRoleSwitch("warga@greenpark.id");
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
    authMode === "register"
      ? "Registrasi Akun"
      : authMode === "developer"
        ? "Developer Portal"
        : null;

  const subtitle =
    authMode === "register"
      ? "Lengkapi data diri untuk pendaftaran warga"
      : authMode === "developer"
        ? "Akses pengujian instan menuju panel admin"
        : null;

  return (
    <MobileContainer className="bg-[#f6f4ee] overflow-hidden">
      <main className="flex-1 overflow-y-auto px-7 pt-10 pb-8 flex flex-col">
        {/* Logo */}
        <h1 className="text-center text-[30px] tracking-tight leading-none">
          <span className="font-extrabold text-[#1b5e45]">Green</span>
          <span className="font-semibold text-[#1b5e45]">Desk</span>
        </h1>

        {/* Ilustrasi */}
        {authMode !== "register" && (
          <div className="flex items-center justify-center py-5">
            <img
              src="/images/Kursi%20Taman.png"
              alt="Ilustrasi Fasilitas Taman"
              className="w-full max-w-[280px] h-auto object-contain select-none pointer-events-none"
            />
          </div>
        )}

        {title && (
          <div className={`text-center ${authMode === "register" ? "mt-6" : ""} mb-4`}>
            <h2 className="text-[20px] font-bold text-[#1b5e45] leading-tight">
              {title}
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>
          </div>
        )}

        {/* LOGIN */}
        {authMode === "login" && (
          <form onSubmit={handleUserLogin} className="space-y-4 mt-2">
            <Field label="Email" icon={<Mail className="w-4 h-4" />}>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="nama@email.com (contoh: admin@greenpark.id)"
                className={inputClass}
              />
            </Field>

            <Field label="Password" icon={<Lock className="w-4 h-4" />}>
              <input
                type={showPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
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
                    <span>MEMPROSES...</span>
                  </span>
                ) : (
                  "LOGIN KE DASHBOARD"
                )}
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={secondaryBtn}
              >
                REGISTER
              </button>
            </div>
          </form>
        )}

        {/* DEVELOPER */}
        {authMode === "developer" && (
          <form onSubmit={handleDeveloperLogin} className="space-y-4">
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
        )}

        {/* REGISTER */}
        {authMode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Nama Lengkap" icon={<UserIcon className="w-4 h-4" />}>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Nama Lengkap Sesuai KTP"
                className={inputClass}
                required
              />
            </Field>

            <Field label="No. Telepon" icon={<Phone className="w-4 h-4" />}>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className={inputClass}
                required
              />
            </Field>

            <Field label="Email" icon={<Mail className="w-4 h-4" />}>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="nama@email.com"
                className={inputClass}
                required
              />
            </Field>

            <Field label="Pilih Cluster" icon={<Building className="w-4 h-4" />}>
              <select
                value={regCluster}
                onChange={(e) => setRegCluster(e.target.value)}
                className={`${inputClass} appearance-none pr-10 ${
                  regCluster ? "" : "text-slate-400"
                }`}
                required
              >
                <option value="" disabled>
                  Pilih Cluster Hunian
                </option>
                <option value="Cluster Taman Eden">Cluster Taman Eden</option>
                <option value="Cluster Bougenville">Cluster Bougenville</option>
                <option value="Cluster Edelweiss">Cluster Edelweiss</option>
                <option value="Cluster Lavender">Cluster Lavender</option>
                <option value="Cluster Jasmine">Cluster Jasmine</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </Field>

            <div className="pt-3 space-y-2.5">
              <button type="submit" disabled={isPending} className={primaryBtn}>
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>MENDAFTAR...</span>
                  </span>
                ) : (
                  "DAFTAR & MASUK"
                )}
              </button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={secondaryBtn}
              >
                SUDAH PUNYA AKUN? LOGIN
              </button>
            </div>
          </form>
        )}

        {/* Panel Switcher Uji Coba 7 Role Statis */}
        <div className="mt-6 pt-5 border-t border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1b5e45]" />
              <span>Uji Cepat Role (Testing Statis)</span>
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-[#1b5e45] border border-emerald-300">
              7 Role
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Pilih role untuk langsung menguji tampilan dashboard dan hak akses tanpa perlu mengetik kredensial:
          </p>

          {/* Dropdown Selector + Tombol Masuk */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedDemoRole}
                onChange={(e) => setSelectedDemoRole(e.target.value)}
                disabled={isPending}
                className="w-full h-11 rounded-xl bg-white border border-slate-200 pl-3 pr-8 text-[12px] font-semibold text-slate-800 shadow-xs outline-none focus:border-[#1b5e45] appearance-none"
              >
                {DEMO_ROLES.map((d) => (
                  <option key={d.role} value={d.role}>
                    {d.role} – {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRoleSwitch(selectedDemoRole)}
              className="h-11 px-4 rounded-xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[12px] font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* 1-Click Role Chips */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {DEMO_ROLES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.role}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRoleSwitch(d.role)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition cursor-pointer ${d.badgeColor}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold truncate leading-tight">
                      {d.role}
                    </div>
                    <div className="text-[9px] opacity-80 truncate">
                      {d.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Shortcut ke Developer Portal Tab jika sedang di mode login */}
          {authMode === "login" && (
            <div className="text-center pt-2">
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
      </main>
    </MobileContainer>
  );
}
