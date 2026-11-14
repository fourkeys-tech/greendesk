"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearReportDraftFromIdb,
  loadReportDraftFromIdb,
  saveReportDraftToIdb,
} from "@/lib/draft-idb";
import { submitReportAction } from "@/app/actions/phase3-actions";

const QR_OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Login Google belum dikonfigurasi pada server.",
  consent_required: "Anda wajib menyetujui penggunaan data pribadi terlebih dahulu.",
  access_denied: "Autentikasi Google dibatalkan.",
  invalid_state: "Sesi autentikasi Google tidak valid. Silakan coba lagi.",
  expired_state: "Sesi autentikasi Google kedaluwarsa. Silakan coba lagi.",
  account_blocked: "Akun Anda sedang dinonaktifkan atau diblokir.",
  internal_role_password_required:
    "Akun internal harus masuk menggunakan tab Masuk Akun (kata sandi).",
  oauth_failed: "Autentikasi Google gagal. Silakan coba lagi.",
};

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
  oauthError?: string | null;
}

export function QrReportClientForm({
  assetCode,
  assetName,
  damageTypes,
  initialUser,
  oauthError = null,
}: QrReportClientProps) {
  const router = useRouter();
  const [user] = useState(initialUser);
  const [description, setDescription] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>("");
  const [photoType, setPhotoType] = useState<string>("image/jpeg");
  const [draftRestored, setDraftRestored] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketNo: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(
    oauthError ? QR_OAUTH_ERRORS[oauthError] ?? "Autentikasi Google gagal." : null
  );
  const [isPending, startTransition] = useTransition();

  // Pulihkan draft saat halaman aset dibuka; pengguna menekan Kirim sendiri.
  useEffect(() => {
    let active = true;
    loadReportDraftFromIdb(assetCode).then((draft) => {
      if (!active || !draft) return;
      setDescription(draft.description);
      setPhotoDataUrl(draft.photoDataUrl);
      setPhotoName(draft.photoName);
      setPhotoType(draft.photoType);
      setDraftRestored(true);
    });
    return () => {
      active = false;
    };
  }, [assetCode]);

  function goToLogin() {
    const returnTo = `/r/${encodeURIComponent(assetCode)}`;
    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

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
      goToLogin();
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
    }
  }

  function handleFormSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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
        goToLogin();
        return;
      }

      await executeSubmitReport();
    });
  }

  if (submittedTicket) {
    const reportsHref =
      user?.role && user.role !== "PENGGUNA"
        ? "/dashboard/laporan"
        : "/beranda/laporan";

    return (
      <div className="bg-emerald-50 border-2 border-[#1b5e45]/40 rounded-3xl p-6 space-y-4 text-emerald-950 shadow-sm">
        <div className="inline-block text-xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-[#1b5e45]/15 text-[#1b5e45]">
          ✓ Laporan Terkirim & Email Diterima Dikirim
        </div>
        <h2 className="text-xl font-bold">
          Nomor Tiket: <span className="font-mono">{submittedTicket.ticketNo}</span>
        </h2>
        <p className="text-sm text-emerald-900">{submittedTicket.message}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={reportsHref}
            className="px-4 py-2.5 rounded-xl bg-[#1b5e45] hover:bg-[#154a36] text-white text-xs font-semibold transition-colors"
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
            className="px-4 py-2.5 rounded-xl border border-[#1b5e45]/40 text-[#1b5e45] text-xs font-semibold cursor-pointer hover:bg-white/60 transition-colors"
          >
            Buat Laporan Lain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Isi Laporan Kerusakan ({assetName})
          </h2>
          <p className="text-xs text-slate-500">
            Tidak perlu login di awal. Isi foto & deskripsi, simpan draft, lalu masuk dan kembali untuk menekan Kirim.
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
                ✓ Foto siap dikirim & tersimpan di draft lokal IndexedDB
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
          className="w-full py-3.5 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] disabled:opacity-50 text-white font-bold text-sm shadow-md transition cursor-pointer"
        >
          {isPending
            ? "Memproses Laporan..."
            : user
              ? "Kirim Laporan Sekarang"
              : "Simpan Draft & Masuk untuk Melanjutkan →"}
        </button>
      </form>

    </div>
  );
}

