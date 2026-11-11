"use client";

import { useState, type ReactNode } from "react";
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
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

type AuthMode = "login" | "register" | "developer";

const AVATAR_URL =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";

const inputClass =
  "w-full h-12 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20";

const primaryBtn =
  "w-full h-12 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[13px] font-bold tracking-wide shadow-lg shadow-[#1b5e45]/20 flex items-center justify-center transition-transform active:scale-[0.98]";

const secondaryBtn =
  "w-full h-12 rounded-2xl bg-white border border-[#1b5e45] text-[#1b5e45] hover:bg-[#1b5e45]/5 text-[13px] font-bold tracking-wide flex items-center justify-center transition-transform active:scale-[0.98]";

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

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const activeUser = {
      id: "usr-01",
      name: "Budi Santoso",
      email: loginEmail || "pelapor@gmail.com",
      phone: "0812-9876-5432",
      cluster: "Cluster Taman Eden",
      avatarUrl: AVATAR_URL,
    };
    try {
      localStorage.setItem("greendesk_user", JSON.stringify(activeUser));
    } catch { }
    router.push("/profile");
  };

  const handleDeveloperLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/admin");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const registeredUser = {
      id: "usr-" + Date.now(),
      name: regName || "Warga Baru",
      email: regEmail,
      phone: regPhone,
      cluster: regCluster || "Cluster Taman Eden",
      avatarUrl: AVATAR_URL,
    };
    try {
      localStorage.setItem("greendesk_user", JSON.stringify(registeredUser));
    } catch { }
    router.push("/profile");
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 z-10"
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
        ? "Akses khusus developer menuju panel admin"
        : null;

  return (
    <>
      {/* ===== MOBILE (unchanged) ===== */}
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
                  placeholder="nama@email.com"
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                  required
                />
                {passwordToggle}
              </Field>

              <div className="pt-3 space-y-2.5">
                <button type="submit" className={primaryBtn}>
                  LOGIN
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
              <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder="developer@greendesk.id"
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                  required
                />
                {passwordToggle}
              </Field>

              <div className="pt-3 space-y-2.5">
                <button type="submit" className={primaryBtn}>
                  MASUK KE DASHBOARD ADMIN
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
                  className={`${inputClass} appearance-none pr-10 ${regCluster ? "" : "text-slate-400"
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
                <button type="submit" className={primaryBtn}>
                  DAFTAR
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
        </main>
      </MobileContainer>

      {/* ===== DESKTOP / TABLET ===== */}
      <div className="hidden md:flex min-h-screen bg-[#F6F5F0] items-center justify-center p-6">
        <div className="w-full max-w-4xl lg:max-w-5xl grid grid-cols-12 rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Left: branding panel */}
          <div className="col-span-5 bg-gradient-to-br from-[#1b5e45] to-[#113d2d] p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              {/* <div className="flex items-center gap-2">
                <img
                  src="/assets/GreenDesk.svg"
                  alt="GreenDesk Logo"
                  className="h-9 w-auto object-contain"
                />
              </div> */}
              <p className="text-xs text-white/80 mt-1">Platform Manajemen Fasilitas Taman</p>
              <div className="mt-8 space-y-4">
                <h2 className="text-2xl font-bold text-white leading-tight">Mari Bersama Merawat Fasilitas Taman</h2>
                <p className="text-xs text-white/80 leading-relaxed">Laporkan kerusakan secara instan melalui pemindaian QR code dan pantau perbaikan secara langsung hingga selesai.</p>
              </div>
            </div>
            <div className="relative z-10 my-4 flex items-center justify-center">
              <div className="relative w-48 h-48 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg">
                <img src="/assets/KursiTaman.svg" alt="Ilustrasi Kursi Taman" className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-md" />
              </div>
            </div>
            <div className="relative z-10 space-y-2 pt-2 border-t border-white/15 text-xs text-white/90">
              <div className="flex items-center gap-2"><span className="text-[#8be294]">✓</span><span>Akses Cepat QR Code</span></div>
              <div className="flex items-center gap-2"><span className="text-[#8be294]">✓</span><span>Status Pengerjaan Terbuka & Realtime</span></div>
            </div>
          </div>

          {/* Right: auth forms */}
          <div className="col-span-7 p-8 lg:p-10 flex flex-col justify-center bg-white">

            <div className="flex items-center gap-2">
              <img
                src="/assets/GreenDesk.svg"
                alt="GreenDesk Logo"
                className="h-9 w-auto object-contain"
              />
            </div>

            <div className="mb-6">
              {/* <h3 className="text-xl font-bold text-slate-900">
                {authMode === "login" ? "Selamat Datang Kembali" : authMode === "register" ? "Registrasi Akun Warga" : "Portal Khusus Developer & Admin"}
              </h3> */}
              <p className="text-xs text-slate-500 mt-1">
                {authMode === "login" ? "Masuk dengan akun terdaftar untuk membuat dan memantau laporan" : authMode === "register" ? "Lengkapi formulir pendaftaran untuk menjadi bagian komunitas" : "Masuk untuk mengakses dashboard manajemen pengelolaan aset"}
              </p>
            </div>

            {authMode === "login" && (
              <form onSubmit={handleUserLogin} className="space-y-4">
                <Field label="Email Pengguna" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="nama@email.com" className={inputClass} required />
                </Field>
                <Field label="Kata Sandi" icon={<Lock className="w-4 h-4" />}>
                  <input type={showPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} pr-10`} required />
                  {passwordToggle}
                </Field>
                <div className="pt-2 space-y-3">
                  <button type="submit" className={primaryBtn}>MASUK SEKARANG</button>
                  <button type="button" onClick={() => switchMode("register")} className={secondaryBtn}>BELUM PUNYA AKUN? DAFTAR</button>
                </div>
              </form>
            )}

            {authMode === "developer" && (
              <form onSubmit={handleDeveloperLogin} className="space-y-4">
                <Field label="Email Developer / Admin" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="developer@greendesk.id" className={inputClass} required />
                </Field>
                <Field label="Kata Sandi" icon={<Lock className="w-4 h-4" />}>
                  <input type={showPassword ? "text" : "password"} value={devPassword} onChange={(e) => setDevPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} pr-10`} required />
                  {passwordToggle}
                </Field>
                <div className="pt-2 space-y-3">
                  <button type="submit" className={primaryBtn}>MASUK KE DASHBOARD ADMIN</button>
                  <button type="button" onClick={() => switchMode("login")} className={secondaryBtn}>KEMBALI KE LOGIN WARGA</button>
                </div>
              </form>
            )}

            {authMode === "register" && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <Field label="Nama Lengkap" icon={<UserIcon className="w-4 h-4" />}>
                  <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nama Lengkap Sesuai KTP" className={inputClass} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No. Telepon" icon={<Phone className="w-4 h-4" />}>
                    <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="0812-xxxx-xxxx" className={inputClass} required />
                  </Field>
                  <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                    <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="nama@email.com" className={inputClass} required />
                  </Field>
                </div>
                <Field label="Pilih Cluster Hunian" icon={<Building className="w-4 h-4" />}>
                  <select value={regCluster} onChange={(e) => setRegCluster(e.target.value)} className={`${inputClass} appearance-none pr-10 ${regCluster ? "" : "text-slate-400"}`} required>
                    <option value="" disabled>Pilih Cluster Hunian</option>
                    <option value="Cluster Taman Eden">Cluster Taman Eden</option>
                    <option value="Cluster Bougenville">Cluster Bougenville</option>
                    <option value="Cluster Edelweiss">Cluster Edelweiss</option>
                    <option value="Cluster Lavender">Cluster Lavender</option>
                    <option value="Cluster Jasmine">Cluster Jasmine</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </Field>
                <div className="pt-2 space-y-3">
                  <button type="submit" className={primaryBtn}>DAFTAR SEKARANG</button>
                  <button type="button" onClick={() => switchMode("login")} className={secondaryBtn}>SUDAH PUNYA AKUN? LOGIN</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}