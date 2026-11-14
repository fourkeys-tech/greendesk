"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Camera, Download, FileText, Upload } from "lucide-react";
import { submitWorkResultAction } from "@/app/actions/phase6-actions";

interface TechnicianSubmitPanelProps {
  workOrderId: string;
  spkNo: string;
  ticketNo: string;
  revisionNote?: string | null;
  spkFileHref?: string | null;
  existingBeforeCount?: number;
}

export function TechnicianSubmitPanel({
  workOrderId,
  spkNo,
  ticketNo,
  revisionNote,
  spkFileHref,
  existingBeforeCount = 0,
}: TechnicianSubmitPanelProps) {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const hasBeforePhoto =
    existingBeforeCount > 0 || Boolean(beforeFile) || Boolean(beforeUrl.trim());
  const hasAfterPhoto = Boolean(afterFile) || Boolean(afterUrl.trim());
  const canSubmit = hasBeforePhoto && hasAfterPhoto;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!canSubmit) {
      setFeedback({
        type: "error",
        text: "Foto sebelum (before) dan foto sesudah (after) perbaikan wajib dilampirkan sebelum lapor selesai.",
      });
      return;
    }

    const fd = new FormData();
    fd.append("workOrderId", workOrderId);
    if (beforeFile) fd.append("beforeFiles", beforeFile);
    if (afterFile) fd.append("afterFiles", afterFile);
    if (beforeUrl.trim()) fd.append("beforePhotoUrls", beforeUrl.trim());
    if (afterUrl.trim()) fd.append("afterPhotoUrls", afterUrl.trim());
    if (notes.trim()) fd.append("notes", notes.trim());

    startTransition(async () => {
      const res = await submitWorkResultAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: "Hasil perbaikan berhasil dilaporkan! Status SPK berubah menjadi Menunggu Konfirmasi Manager.",
        });
      }
    });
  };

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-orange-50/50 p-4 rounded-xl space-y-3">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-900 bg-orange-100 px-2 py-0.5 rounded border border-orange-300">
            Lapor Selesai Kerja (Teknisi Lapangan)
          </span>
          <span className="text-xs text-slate-600">
            SPK: <strong className="font-mono">{spkNo}</strong>
          </span>
        </div>

        {spkFileHref && (
          <a
            href={spkFileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh File SPK Resmi</span>
          </a>
        )}
      </div>

      {/* Pinned Revision Note (PRD 4.3 & 4.5: Catatan Manager tampil di bagian atas Detail SPK) */}
      {revisionNote && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold uppercase tracking-wide text-rose-800">
              Catatan Perbaikan Ulang dari Manager:
            </div>
            <div className="mt-1 font-semibold">{revisionNote}</div>
            <div className="text-[11px] text-rose-600 mt-1">
              * Perbaiki kembali kerusakan sesuai catatan di atas, lalu unggah foto sesudah (after) yang baru.
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
              : "bg-rose-100 text-rose-900 border border-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form onSubmit={handleSubmit} suppressHydrationWarning className="space-y-3 bg-white p-4 rounded-xl border border-orange-200 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Foto Sebelum */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-600" />
                <span>Foto Sebelum (Before) *</span>
              </label>
              {existingBeforeCount > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  ✓ {existingBeforeCount} Foto Tersimpan
                </span>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              suppressHydrationWarning
              onChange={(e) => setBeforeFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-800 hover:file:bg-orange-200 border border-slate-200 rounded-lg p-1 bg-white"
            />

            <div className="text-[11px] text-slate-400">Atau masukkan URL foto jika bukan dari kamera:</div>
            <input
              type="text"
              value={beforeUrl}
              suppressHydrationWarning
              onChange={(e) => setBeforeUrl(e.target.value)}
              placeholder="https://..."
              className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white"
            />
          </div>

          {/* Foto Sesudah */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Foto Sesudah (After) *</span>
              </label>
              {hasAfterPhoto && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  ✓ Siap Diunggah
                </span>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              suppressHydrationWarning
              onChange={(e) => setAfterFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 border border-slate-200 rounded-lg p-1 bg-white"
            />

            <div className="text-[11px] text-slate-400">Atau masukkan URL foto jika bukan dari kamera:</div>
            <input
              type="text"
              value={afterUrl}
              suppressHydrationWarning
              onChange={(e) => setAfterUrl(e.target.value)}
              placeholder="https://..."
              className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Tambahan Teknisi:
          </label>
          <input
            type="text"
            value={notes}
            suppressHydrationWarning
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Mis. Komponen engsel dan baut telah diganti baru serta dicat anti karat."
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-500">
            * Tombol lapor selesai otomatis aktif setelah kedua foto (sebelum &amp; sesudah) tersedia (Keputusan 6).
          </div>
          <button
            type="submit"
            suppressHydrationWarning
            disabled={isPending || !canSubmit}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>{isPending ? "Mengirimkan Laporan..." : "Lapor Selesai Kerja"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
