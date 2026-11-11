"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  clearReportDraftFromIdb,
  loadReportDraftFromIdb,
  saveReportDraftToIdb,
} from "@/lib/draft-idb";
import {
  continueWithGoogleInlineAction,
  loginInlineOnQrAction,
  requestInlineOtpAction,
  submitReportAction,
  verifyInlineOtpAction,
} from "@/app/actions/phase3-actions";

interface QrReportClientProps {
  assetCode: string;
  assetName: string;
  damageTypes: string[];
  initialUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export function QrReportClientForm({
  assetCode,
  assetName,
  damageTypes,
  initialUser,
}: QrReportClientProps) {
  const [user, setUser] = useState(initialUser);
  const [description, setDescription] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [photoType, setPhotoType] = useState<string>("image/jpeg");
  const [draftRestored, setDraftRestored] = useState(false);

  // State modal 3 pilihan autentikasi (ketika belum login)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"google" | "login" | "register">(
    "google"
  );

  // State form auth
  const [googleName, setGoogleName] = useState("Rina Kartika");
  const [googleEmail, setGoogleEmail] = useState("warga@greenpark.id");
  const [loginEmail, setLoginEmail] = useState("warga@greenpark.id");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regStatus, setRegStatus] = useState<"WARGA" | "PENGUNJUNG">("WARGA");
  const [regBlockNo, setRegBlockNo] = useState("");
  const [dataConsent, setDataConsent] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // State hasil kirim laporan
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketNo: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pulihkan draft dari IndexedDB saat halaman dibuka
  useEffect(() => {
    let active = true;
    loadReportDraftFromIdb(assetCode).then((draft) => {
      if (active && draft) {
        setDescription(draft.description);
        setPhotoDataUrl(draft.photoDataUrl);
        setPhotoName(draft.photoName);
        setPhotoType(draft.photoType);
        setDraftRestored(true);
      }
    });
    return () => {
      active = false;
    };
  }, [assetCode]);

  // Simpan foto ke state & kompres/konversi ke DataURL agar bisa masuk IndexedDB
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran foto maksimal 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPhotoDataUrl(dataUrl);
      setPhotoName(file.name);
      setPhotoType(file.type || "image/jpeg");

      await saveReportDraftToIdb({
        assetCode: assetCode.toUpperCase(),
        description,
        photoDataUrl: dataUrl,
        photoName: file.name,
        photoType: file.type || "image/jpeg",
        savedAt: Date.now(),
      });
    };
    reader.readAsDataURL(file);
  }

  async function executeSubmitReport(
    overrideDesc?: string,
    overridePhoto?: string
  ) {
    const finalDesc = (overrideDesc ?? description).trim();
    const finalPhoto = overridePhoto ?? photoDataUrl;

    if (!finalPhoto) {
      setError("Wajib mengunggah minimal satu foto bukti kerusakan.");
      return;
    }
    if (finalDesc.length < 5) {
      setError("Deskripsi singkat kerusakan wajib diisi (minimal 5 karakter).");
      return;
    }

    const fd = new FormData();
    fd.set("assetCode", assetCode);
    fd.set("channel", "QR");
    fd.set("description", finalDesc);
    fd.set("draftPhotoDataUrl", finalPhoto);

    const res = await submitReportAction(fd);
    if (res.requiresAuth) {
      await saveReportDraftToIdb({
        assetCode: assetCode.toUpperCase(),
        description: finalDesc,
        photoDataUrl: finalPhoto,
        photoName: photoName || "qr-photo.jpg",
        photoType,
        savedAt: Date.now(),
      });
      setShowAuthModal(true);
      return;
    }

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.success && res.ticketNo) {
      await clearReportDraftFromIdb(assetCode);
      setSubmittedTicket({
        ticketNo: res.ticketNo,
        message: res.message,
      });
      setShowAuthModal(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!photoDataUrl) {
      setError(
        "Laporan tanpa foto ditolak: Wajib melampirkan minimal satu foto kerusakan."
      );
      return;
    }
    if (description.trim().length < 5) {
      setError(
        "Laporan tanpa deskripsi ditolak: Isi deskripsi singkat kerusakan."
      );
      return;
    }

    startTransition(async () => {
      // Simpan ke IndexedDB terlebih dahulu
      await saveReportDraftToIdb({
        assetCode: assetCode.toUpperCase(),
        description: description.trim(),
        photoDataUrl,
        photoName: photoName || "qr-photo.jpg",
        photoType,
        savedAt: Date.now(),
      });

      if (!user) {
        setShowAuthModal(true);
        return;
      }

      await executeSubmitReport();
    });
  }

  // Setelah autentikasi berhasil (Google / Masuk / Daftar), pulihkan draft dari IndexedDB & kirim otomatis!
  async function restoreDraftAndAutoSubmit() {
    const draft = await loadReportDraftFromIdb(assetCode);
    const descToUse = draft?.description || description;
    const photoToUse = draft?.photoDataUrl || photoDataUrl;
    await executeSubmitReport(descToUse, photoToUse ?? undefined);
  }

  function handleGoogleAuth() {
    setError(null);
    startTransition(async () => {
      const res = await continueWithGoogleInlineAction({
        name: googleName,
        email: googleEmail,
        dataConsent,
        assetCode,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.user) {
        setUser(res.user);
        await restoreDraftAndAutoSubmit();
      }
    });
  }

  function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginInlineOnQrAction({
        email: loginEmail,
        password: loginPassword,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.user) {
        setUser(res.user);
        await restoreDraftAndAutoSubmit();
      }
    });
  }

  function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestInlineOtpAction({
        name: regName,
        email: regEmail,
        reporterStatus: regStatus,
        blockHouseNo: regBlockNo,
        dataConsent,
        assetCode,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOtpSent(true);
      if ("debugOtpHint" in res && res.debugOtpHint) {
        setDebugOtp(res.debugOtpHint);
        setOtpCode(res.debugOtpHint);
      }
    });
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyInlineOtpAction({
        email: regEmail,
        code: otpCode,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.user) {
        setUser(res.user);
        await restoreDraftAndAutoSubmit();
      }
    });
  }

  if (submittedTicket) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-6 space-y-4 text-emerald-950">
        <div className="inline-block text-xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900">
          ✓ Laporan Terkirim & Email Diterima Dikirim
        </div>
        <h2 className="text-xl font-bold">
          Nomor Tiket: <span className="font-mono">{submittedTicket.ticketNo}</span>
        </h2>
        <p className="text-sm text-emerald-900">{submittedTicket.message}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard/laporan"
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
          >
            Pantau Status & Riwayat Laporan Saya →
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmittedTicket(null);
              setDescription("");
              setPhotoDataUrl(null);
              setDraftRestored(false);
            }}
            className="px-4 py-2.5 rounded-xl border border-emerald-400 text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Buat Laporan Lain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Isi Laporan Kerusakan ({assetName})
          </h2>
          <p className="text-xs text-slate-500">
            Tidak perlu login di awal. Isi foto & deskripsi terlebih dahulu!
          </p>
        </div>
        {user ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
            Masuk sebagai: {user.name}
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
            Mode Tamu (Draft tersimpan di IndexedDB)
          </span>
        )}
      </div>

      {draftRestored && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between">
          <span>
            💾 Draft laporan Anda (teks & foto) berhasil dipulihkan dari
            IndexedDB browser.
          </span>
          <button
            type="button"
            onClick={async () => {
              await clearReportDraftFromIdb(assetCode);
              setDescription("");
              setPhotoDataUrl(null);
              setDraftRestored(false);
            }}
            className="text-sky-700 underline font-semibold cursor-pointer"
          >
            Hapus Draft
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Pilihan Cepat Jenis Kerusakan */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Klik Cepat Jenis Kerusakan (Opsional):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {damageTypes.map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() =>
                  setDescription((prev) =>
                    prev ? `${prev}, ${dt.toLowerCase()}` : `${dt}: `
                  )
                }
                className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-medium cursor-pointer"
              >
                + {dt}
              </button>
            ))}
          </div>
        </div>

        {/* Unggah Foto Bukti Kerusakan (Wajib) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            1. Foto Bukti Kerusakan (Wajib minimal 1 foto) *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhotoChange}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
          />
          {photoDataUrl && (
            <div className="mt-2.5 flex items-center gap-3">
              <img
                src={photoDataUrl}
                alt="Preview Kerusakan"
                className="h-24 w-32 object-cover rounded-xl border border-slate-300"
              />
              <div className="text-xs text-emerald-700 font-medium">
                ✓ Foto siap dikirim & tersimpan aman di draft IndexedDB
              </div>
            </div>
          )}
        </div>

        {/* Deskripsi Singkat Kerusakan (Wajib) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            2. Deskripsi Singkat Kerusakan (Wajib) *
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan kondisi kerusakan fasilitas taman ini..."
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm transition cursor-pointer"
        >
          {isPending
            ? "Memproses Laporan..."
            : user
            ? "Kirim Laporan Sekarang"
            : "Simpan Draft & Lanjutkan Pengiriman →"}
        </button>
      </form>

      {/* Modal 3 Pilihan Autentikasi (Lanjut dengan Google, Masuk, Daftar) */}
      {showAuthModal && (
        <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 border-2 border-emerald-500">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Draft Foto & Teks Tersimpan di IndexedDB
              </span>
              <h3 className="text-base font-bold mt-1">
                Pilih Cara Masuk untuk Mengirim Laporan Otomatis
              </h3>
              <p className="text-xs text-slate-300">
                Begitu Anda berhasil masuk/daftar, draft laporan Anda akan
                langsung terkirim secara otomatis.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ Tutup
            </button>
          </div>

          {/* 3 Pilihan Sesuai User Story Fase 3 PRD */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAuthTab("google")}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                authTab === "google"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              1. Lanjut dgn Google
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("login")}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                authTab === "login"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              2. Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("register")}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                authTab === "register"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              3. Daftar (OTP)
            </button>
          </div>

          {authTab === "google" && (
            <div className="space-y-3 text-xs bg-slate-800/80 p-4 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Nama Akun Google
                  </label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">
                    Email Google
                  </label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={dataConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Saya menyetujui penggunaan data pribadi (nama & email) untuk
                  tindak lanjut dan notifikasi status laporan ini (Wajib sesuai
                  PRD).
                </span>
              </label>

              <button
                type="button"
                disabled={isPending}
                onClick={handleGoogleAuth}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold cursor-pointer"
              >
                {isPending
                  ? "Memulihkan Draft & Mengirim..."
                  : "Lanjut dengan Google & Kirim Laporan Otomatis"}
              </button>
            </div>
          )}

          {authTab === "login" && (
            <form
              onSubmit={handlePasswordLogin}
              className="space-y-3 text-xs bg-slate-800/80 p-4 rounded-xl"
            >
              <div>
                <label className="block text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Kata Sandi</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="Kata sandi akun"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
              >
                Masuk & Kirim Laporan Otomatis
              </button>
            </form>
          )}

          {authTab === "register" && (
            <div className="space-y-3 text-xs bg-slate-800/80 p-4 rounded-xl">
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      placeholder="Mis. Budi Raharjo"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Alamat Email *
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="budi@email.com"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Status Pelapor (Opsional)
                    </label>
                    <select
                      value={regStatus}
                      onChange={(e) =>
                        setRegStatus(e.target.value as "WARGA" | "PENGUNJUNG")
                      }
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                    >
                      <option value="WARGA">Warga Penghuni</option>
                      <option value="PENGUNJUNG">Pengunjung Taman</option>
                    </select>
                  </div>
                  {regStatus === "WARGA" && (
                    <div>
                      <label className="block text-slate-300 mb-1">
                        Blok / Nomor Rumah
                      </label>
                      <input
                        type="text"
                        value={regBlockNo}
                        onChange={(e) => setRegBlockNo(e.target.value)}
                        placeholder="Mis. Blok B4 No. 12"
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                      />
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dataConsent}
                    onChange={(e) => setDataConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Saya menyetujui penggunaan data pribadi saat mendaftar sesuai
                    kebijakan privasi (Wajib).
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold cursor-pointer"
                >
                  Kirim Kode OTP ke Email
                </button>
              </form>

              {otpSent && (
                <form
                  onSubmit={handleVerifyOtp}
                  className="space-y-2.5 pt-3 border-t border-slate-700"
                >
                  {debugOtp && (
                    <div className="p-2 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                      Mode Dev – Kode OTP Anda: <strong>{debugOtp}</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Masukkan Kode OTP 6 Digit
                    </label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white font-mono tracking-widest"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Verifikasi OTP, Pulihkan Draft & Kirim Laporan Otomatis
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

