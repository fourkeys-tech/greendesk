"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Home,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  requestRegistrationOtpAction,
  verifyRegistrationOtpAction,
} from "@/app/actions/phase3-actions";
import { MobileContainer } from "@/components/MobileContainer";

const inputClass =
  "w-full h-11 rounded-xl bg-white border border-slate-200 pl-10 pr-3 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs outline-none transition focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20";

const primaryBtn =
  "w-full h-12 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-[13px] font-bold tracking-wide shadow-lg shadow-[#1b5e45]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer";

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
      <span className="block text-[12px] font-bold text-slate-800 mb-1.5">
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

interface RegisterClientProps {
  returnTo: string;
  googleOAuthEnabled?: boolean;
  googleStartUrl?: string;
}

export function RegisterClient({
  returnTo,
  googleOAuthEnabled = false,
  googleStartUrl = "/api/auth/google/start",
}: RegisterClientProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reporterStatus, setReporterStatus] = useState<"WARGA" | "PENGUNJUNG">(
    "WARGA"
  );
  const [blockHouseNo, setBlockHouseNo] = useState("");
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function submitOtpRequest() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestRegistrationOtpAction({
        name,
        email,
        reporterStatus,
        blockHouseNo,
        dataConsent: consent,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOtpSent(true);
      setResendCooldown(60);
      setDebugOtp(result.debugOtpHint ?? null);
      setMessage(
        result.message ?? "Periksa kotak masuk email Anda untuk kode verifikasi."
      );
    });
  }

  function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitOtpRequest();
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyRegistrationOtpAction({
        email,
        code: otp,
        returnTo,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace(result.returnTo ?? "/beranda");
      router.refresh();
    });
  }

  function resetToDetails() {
    setOtpSent(false);
    setOtp("");
    setError(null);
    setMessage(null);
  }

  const stepIndicator = (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-semibold transition-colors ${
          !otpSent
            ? "bg-emerald-50 border-emerald-300 text-[#1b5e45]"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            otpSent
              ? "bg-[#1b5e45] text-white"
              : "bg-[#1b5e45] text-white"
          }`}
        >
          {otpSent ? "✓" : "1"}
        </span>
        <span className="truncate">Data Akun</span>
      </div>
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-semibold transition-colors ${
          otpSent
            ? "bg-emerald-50 border-emerald-300 text-[#1b5e45]"
            : "bg-slate-50 border-slate-200 text-slate-400"
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            otpSent
              ? "bg-[#1b5e45] text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          2
        </span>
        <span className="truncate">Verifikasi OTP</span>
      </div>
    </div>
  );

  const feedbackBanners = (
    <>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900"
        >
          {message}
        </div>
      )}
    </>
  );

  const registrationContent = (
    <>
      {stepIndicator}
      {feedbackBanners}

      {!otpSent ? (
        <form onSubmit={requestCode} className="space-y-3.5">
          <Field label="Nama Lengkap" icon={<UserRound className="w-4 h-4" />}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={160}
              autoComplete="name"
              placeholder="Contoh: Rina Kartika"
              className={inputClass}
            />
          </Field>

          <Field label="Alamat Email" icon={<Mail className="w-4 h-4" />}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="nama@email.com"
              className={inputClass}
            />
          </Field>

          <div>
            <span className="block text-[12px] font-bold text-slate-800 mb-1.5">
              Status Pelapor
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReporterStatus("WARGA")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  reporterStatus === "WARGA"
                    ? "bg-emerald-50 border-[#1b5e45] text-[#1b5e45] ring-2 ring-[#1b5e45]/15"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Warga Penghuni</span>
              </button>
              <button
                type="button"
                onClick={() => setReporterStatus("PENGUNJUNG")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  reporterStatus === "PENGUNJUNG"
                    ? "bg-emerald-50 border-[#1b5e45] text-[#1b5e45] ring-2 ring-[#1b5e45]/15"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Pengunjung Taman</span>
              </button>
            </div>
          </div>

          {reporterStatus === "WARGA" && (
            <Field
              label="Blok / Nomor Rumah (Opsional)"
              icon={<Home className="w-4 h-4" />}
            >
              <input
                value={blockHouseNo}
                onChange={(event) => setBlockHouseNo(event.target.value)}
                maxLength={120}
                placeholder="Contoh: Bougenville A2/15"
                className={inputClass}
              />
            </Field>
          )}

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F6F5F0]/80 p-3 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1b5e45]"
            />
            <span className="leading-relaxed">
              Saya menyetujui penggunaan data pribadi untuk verifikasi akun dan
              pembaruan status laporan kerusakan.
            </span>
          </label>

          <button type="submit" disabled={isPending} className={primaryBtn}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengirim Kode...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Kirim Kode Verifikasi</span>
              </>
            )}
          </button>

          {googleOAuthEnabled && (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-3 shrink-0 text-[11px] font-semibold text-slate-400">
                  atau daftar cepat
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <a
                href={`${googleStartUrl}?returnTo=${encodeURIComponent(returnTo)}&consent=1`}
                className="w-full h-11 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[13px] font-bold tracking-wide flex items-center justify-center gap-2 transition"
              >
                <ShieldCheck className="w-4 h-4 text-[#1b5e45]" />
                <span>Daftar / Masuk dengan Google</span>
              </a>
              <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                Dengan melanjutkan lewat Google, Anda menyetujui penggunaan data
                pribadi untuk verifikasi pelapor.
              </p>
            </>
          )}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-[#F6F5F0] px-3.5 py-2.5">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kode dikirim ke
              </span>
              <span className="block truncate text-xs font-bold text-slate-800">
                {email}
              </span>
            </div>
            <button
              type="button"
              onClick={resetToDetails}
              disabled={isPending}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-[#1b5e45] hover:bg-emerald-50 transition cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Ubah Email</span>
            </button>
          </div>

          {debugOtp && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              Kode verifikasi dev: <strong className="font-mono">{debugOtp}</strong>
            </div>
          )}

          <label className="block">
            <span className="block text-[12px] font-bold text-slate-800 mb-1.5">
              Kode Verifikasi 6 Digit
            </span>
            <span className="relative block">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                placeholder="000000"
                className="w-full h-12 rounded-xl bg-white border border-slate-200 pl-10 pr-4 text-center font-mono text-lg font-extrabold tracking-[0.45em] text-slate-900 placeholder:text-slate-300 placeholder:tracking-[0.45em] shadow-2xs outline-none transition focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20"
              />
            </span>
          </label>

          <button type="submit" disabled={isPending} className={primaryBtn}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Verifikasi &amp; Buat Akun</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Belum menerima email?</span>
            <button
              type="button"
              disabled={isPending || resendCooldown > 0}
              onClick={submitOtpRequest}
              className="inline-flex items-center gap-1.5 font-bold text-[#1b5e45] hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {resendCooldown > 0
                  ? `Kirim ulang (${resendCooldown}s)`
                  : "Kirim ulang kode"}
              </span>
            </button>
          </div>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-slate-500">
        Sudah punya akun?{" "}
        <Link
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-[#1b5e45] hover:underline"
        >
          Masuk sekarang →
        </Link>
      </p>
    </>
  );

  return (
    <>
      {/* ===== MOBILE (< md) ===== */}
      <MobileContainer className="bg-[#f6f4ee] overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 pt-7 pb-8 flex flex-col">
          <div className="flex items-center justify-between pb-4">
            <Link
              href="/beranda"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1b5e45]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Beranda</span>
            </Link>
            <Link
              href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#1b5e45] text-[11px] font-bold transition border border-emerald-300"
            >
              <span>Masuk Akun</span>
            </Link>
          </div>

          <div className="text-center mb-5">
            <h1 className="text-[28px] tracking-tight leading-none">
              <span className="font-extrabold text-[#1b5e45]">Green</span>
              <span className="font-semibold text-[#1b5e45]">Desk</span>
            </h1>
            <h2 className="mt-2 text-lg font-extrabold text-slate-900">
              Daftar Akun Warga
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Verifikasi email dengan OTP untuk mulai melapor &amp; memantau
              perbaikan taman.
            </p>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-sm">
            {registrationContent}
          </div>
        </main>
      </MobileContainer>

      {/* ===== DESKTOP / TABLET (>= md) ===== */}
      <div className="hidden md:flex min-h-screen bg-[#F6F5F0] items-center justify-center p-6">
        <div className="w-full max-w-4xl lg:max-w-5xl grid grid-cols-12 rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Kiri: panel branding */}
          <div className="col-span-5 bg-gradient-to-br from-[#1b5e45] to-[#113d2d] p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs text-white/80">
                Portal Warga &amp; Pengunjung Taman
              </p>
              <div className="mt-7 space-y-3">
                <h2 className="text-2xl font-bold text-white leading-tight">
                  Buat Akun dalam Hitungan Detik
                </h2>
                <p className="text-xs text-white/80 leading-relaxed">
                  Daftarkan email Anda menggunakan kode OTP 6 digit atau akun
                  Google. Semua progres laporan akan dikirim otomatis ke email
                  Anda.
                </p>
              </div>
            </div>

            <div className="relative z-10 my-5 flex items-center justify-center">
              <div className="relative w-44 h-44 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 flex items-center justify-center shadow-lg">
                <img
                  src="/assets/KursiTaman.svg"
                  alt="Ilustrasi Kursi Taman"
                  className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-md"
                />
              </div>
            </div>

            <div className="relative z-10 space-y-2 pt-3 border-t border-white/15 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <span className="text-[#8be294]">✓</span>
                <span>Verifikasi Aman via OTP Email (10 Menit)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8be294]">✓</span>
                <span>Notifikasi Otomatis Tiap Tahap Perbaikan</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8be294]">✓</span>
                <span>Riwayat Laporan Tersimpan Rapi</span>
              </div>
            </div>
          </div>

          {/* Kanan: form pendaftaran */}
          <div className="col-span-7 p-8 lg:p-10 flex flex-col justify-center bg-white max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <img
                src="/assets/GreenDesk.svg"
                alt="GreenDesk Logo"
                className="h-9 w-auto object-contain"
              />
              <Link
                href="/beranda"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Beranda</span>
              </Link>
            </div>

            <div className="mt-4 mb-5">
              <h1 className="text-xl font-extrabold text-slate-900">
                Daftar Akun Warga
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Isi data diri singkat dan verifikasi email dengan kode OTP (OTP
                khusus pendaftaran akun baru).
              </p>
            </div>

            {registrationContent}
          </div>
        </div>
      </div>
    </>
  );
}
