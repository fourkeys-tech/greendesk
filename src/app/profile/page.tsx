"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  ChevronRight,
  LogOut,
  ArrowLeft,
  HelpCircle,
  Lock,
  Code2,
  Building,
  LogIn,
  UserPlus
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { mockCurrentUser, mockReports } from "@/data/mock-park-data";

export default function ProfilePage() {
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "developer">("login");

  const [user, setUser] = useState({
    id: mockCurrentUser.id,
    name: mockCurrentUser.name,
    email: mockCurrentUser.email,
    phone: "0812-9876-5432",
    cluster: "Cluster Taman Eden",
    avatarUrl: mockCurrentUser.avatarUrl,
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCluster, setRegCluster] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("greendesk_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          setUser(parsed);
          setIsAuthenticated(true);
        }
      }
    } catch { }
  }, []);

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const activeUser = {
      id: "usr-01",
      name: "Budi Santoso",
      email: loginEmail || "pelapor@gmail.com",
      phone: "0812-9876-5432",
      cluster: "Cluster Taman Eden",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    };
    setUser(activeUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem("greendesk_user", JSON.stringify(activeUser));
    } catch { }
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
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    };
    setUser(registeredUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem("greendesk_user", JSON.stringify(registeredUser));
    } catch { }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("greendesk_user");
    } catch { }
    setIsAuthenticated(false);
    setAuthMode("login");
    setLoginEmail("");
    setLoginPassword("");
  };

  const userReports = mockReports.filter((r) => r.reporter.id === user.id);

  return (
    <MobileContainer className="bg-slate-50">
      <header className="p-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Link
            href="/beranda"
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            {isAuthenticated
              ? "Profil Pengguna"
              : authMode === "register"
                ? "Registrasi Akun"
                : authMode === "developer"
                  ? "Developer Login"
                  : "Masuk ke Akun"}
          </h1>
        </div>
      </header>

      {!isAuthenticated ? (
        <main className="p-4 space-y-4 flex-1">
          {authMode === "login" && (
            <div className="space-y-4">
              <section className="card bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#283330]/10 text-[#283330] flex items-center justify-center mx-auto mb-2">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Masuk Akun</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Masukkan kredensial Anda untuk mengakses layanan
                  </p>
                </div>

                <form onSubmit={handleUserLogin} className="space-y-3.5">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Email</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Password</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="btn w-full bg-[#283330] hover:bg-[#1e2725] text-white font-bold py-3 rounded-2xl shadow-md text-xs"
                    >
                      Masuk
                    </button>
                  </div>
                </form>

                <div className="divider text-[11px] text-slate-400 my-4">atau</div>

                <button
                  type="button"
                  onClick={() => setAuthMode("developer")}
                  className="btn btn-outline border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  <Code2 className="w-4 h-4 text-[#283330]" />
                  <span>Masuk sebagai Pengelola</span>
                </button>

                <div className="text-center pt-4">
                  <p className="text-xs text-slate-500">
                    Belum memiliki akun?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("register")}
                      className="text-[#283330] font-bold hover:underline"
                    >
                      Daftar Sekarang
                    </button>
                  </p>
                </div>
              </section>
            </div>
          )}

          {authMode === "developer" && (
            <div className="space-y-4">
              <section className="card bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto mb-2">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Developer Portal</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Akses khusus developer menuju panel admin
                  </p>
                </div>

                <form onSubmit={handleDeveloperLogin} className="space-y-3.5">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Email</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        value={devEmail}
                        onChange={(e) => setDevEmail(e.target.value)}
                        placeholder="developer@greendesk.id"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Password</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="password"
                        value={devPassword}
                        onChange={(e) => setDevPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="btn w-full bg-[#283330] hover:bg-[#1e2725] text-white font-bold py-3 rounded-2xl shadow-md text-xs"
                    >
                      Masuk ke Dashboard Admin
                    </button>
                  </div>
                </form>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    ← Kembali ke Login Pengguna
                  </button>
                </div>
              </section>
            </div>
          )}

          {authMode === "register" && (
            <div className="space-y-4">
              <section className="card bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#283330]/10 text-[#283330] flex items-center justify-center mx-auto mb-2">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Registrasi Akun</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lengkapi data diri untuk pendaftaran warga
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Nama Lengkap</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nama Lengkap Sesuai KTP"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">No. Telepon</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0812-xxxx-xxxx"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Email</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="input input-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="text-xs font-semibold text-slate-700">Pilih Cluster</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 z-10" />
                      <select
                        value={regCluster}
                        onChange={(e) => setRegCluster(e.target.value)}
                        className="select select-bordered w-full pl-9 text-xs font-medium text-slate-800"
                        required
                      >
                        <option value="" disabled>Pilih Cluster Hunian</option>
                        <option value="Cluster Taman Eden">Cluster Taman Eden</option>
                        <option value="Cluster Bougenville">Cluster Bougenville</option>
                        <option value="Cluster Edelweiss">Cluster Edelweiss</option>
                        <option value="Cluster Lavender">Cluster Lavender</option>
                        <option value="Cluster Jasmine">Cluster Jasmine</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="btn w-full bg-[#283330] hover:bg-[#1e2725] text-white font-bold py-3 rounded-2xl shadow-md text-xs"
                    >
                      Daftar
                    </button>
                  </div>
                </form>

                <div className="text-center pt-4">
                  <p className="text-xs text-slate-500">
                    Sudah memiliki akun?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      className="text-[#283330] font-bold hover:underline"
                    >
                      Masuk ke Akun
                    </button>
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>
      ) : (
        <main className="p-4 space-y-4 flex-1">
          <section className="card bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#283330]/10 ring-4 ring-[#283330]/10 flex items-center justify-center">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-[#283330]" />
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#283330] border-2 border-white flex items-center justify-center text-white">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {user.name}
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5" />
              {user.phone}
            </p>

            <div className="mt-3 flex gap-2">
              <span className="badge badge-success text-[11px] font-semibold">
                Warga Aktif
              </span>
              <span className="badge badge-info text-[11px] font-semibold">
                {user.cluster || "Cluster Taman Eden"}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-2xl font-black text-slate-900">
                {userReports.length}
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                Total Laporan
              </span>
            </div>
            <div className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-2xl font-black text-[#283330]">
                {userReports.filter((r) => r.status === "SELESAI").length}
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                Laporan Selesai
              </span>
            </div>
          </section>

          <section className="card bg-white border border-slate-200/80 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
            <Link
              href="/reports"
              className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#283330]/10 text-[#283330] flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Riwayat Laporan Saya</h3>
                  <p className="text-[11px] text-slate-400">Lihat semua tiket yang pernah diajukan</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Bantuan & Panduan QR</h3>
                  <p className="text-[11px] text-slate-400">Tata cara pelaporan aset taman</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </section>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline w-full rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </main>
      )}

      <BottomNav />
    </MobileContainer>
  );
}
