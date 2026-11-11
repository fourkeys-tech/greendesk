"use client";

import { useState, useTransition } from "react";
import {
  loginWithPasswordAction,
  requestOtpAction,
  verifyOtpAction,
} from "@/app/actions/auth-actions";

export function LoginForms() {
  const [tab, setTab] = useState<"password" | "otp">("password");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState("warga@greenpark.id");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePasswordSubmit(formData: FormData) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await loginWithPasswordAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  }

  function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await requestOtpAction(otpEmail);
      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("message" in res) {
        setOtpSent(true);
        setInfo(res.message ?? null);
      }
    });
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyOtpAction(otpEmail, otpCode);
      if (res?.error) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex gap-2 border-b border-slate-200 pb-3 mb-5">
        <button
          type="button"
          onClick={() => {
            setTab("password");
            setError(null);
            setInfo(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "password"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Masuk dengan Kata Sandi
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("otp");
            setError(null);
            setInfo(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "otp"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Masuk dengan Kode OTP Email
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {info && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {tab === "password" ? (
        <form action={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alamat Email
            </label>
            <input
              type="email"
              name="email"
              defaultValue="admin@greenpark.id"
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              placeholder="nama@perusahaan.id"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kata Sandi
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="Masukkan kata sandi"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition cursor-pointer"
          >
            {isPending ? "Memproses..." : "Masuk ke Sistem"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Alamat Email
              </label>
              <input
                type="email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 text-sm transition cursor-pointer"
            >
              {isPending ? "Mengirim..." : "Kirim Kode OTP ke Email"}
            </button>
          </form>

          {otpSent && (
            <form
              onSubmit={handleVerifyOtp}
              className="space-y-3 pt-3 border-t border-slate-200"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kode OTP 6 Digit
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Contoh: 123456"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono tracking-widest focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 text-sm transition cursor-pointer"
              >
                Verifikasi & Masuk
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

