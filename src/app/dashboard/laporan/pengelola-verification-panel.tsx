"use client";

import { useState, useTransition } from "react";
import {
  markReportInvalidAction,
  mergeDuplicateReportAction,
  verifyReportValidAction,
} from "@/app/actions/phase4-actions";

interface PengelolaVerificationPanelProps {
  reportId: string;
  ticketNo: string;
  assetCode: string;
  candidateParentReports: Array<{
    id: string;
    ticketNo: string;
    status: string;
    description: string;
  }>;
}

export function PengelolaVerificationPanel({
  reportId,
  ticketNo,
  assetCode,
  candidateParentReports,
}: PengelolaVerificationPanelProps) {
  const [mode, setMode] = useState<"valid" | "invalid" | "merge" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    fn: (fd: FormData) => Promise<{
      success?: boolean;
      message?: string;
      error?: string;
    }>
  ) {
    return (formData: FormData) => {
      setFeedback(null);
      startTransition(async () => {
        const res = await fn(formData);
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
        } else if (res.message) {
          setFeedback({ type: "success", text: res.message });
          setMode(null);
        }
      });
    };
  }

  return (
    <div className="pt-3 border-t border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase text-sky-900">
          Aksi Verifikasi Pengelola Cluster ({ticketNo}):
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "valid" ? null : "valid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === "valid"
                ? "bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            ✓ Nyatakan Valid & Prioritas
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "invalid" ? null : "invalid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === "invalid"
                ? "bg-rose-700 text-white"
                : "bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300"
            }`}
          >
            ✕ Tandai Tidak Valid
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "merge" ? null : "merge")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === "merge"
                ? "bg-indigo-700 text-white"
                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300"
            }`}
          >
            🔗 Gabung Laporan Ganda ({candidateParentReports.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* FORM 1: NYATAKAN VALID & TETAPKAN PRIORITAS */}
      {mode === "valid" && (
        <form
          action={runAction(verifyReportValidAction)}
          className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 text-xs"
        >
          <input type="hidden" name="reportId" value={reportId} />
          <div className="font-bold text-emerald-950">
            Verifikasi Valid & Teruskan ke Manager (Status → MENUNGGU_KEPUTUSAN)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tetapkan Tingkat Prioritas (Ditentukan Pengelola) *
              </label>
              <select
                name="priority"
                defaultValue="NORMAL"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold"
              >
                <option value="TINGGI">TINGGI (Mendesak / Berbahaya)</option>
                <option value="NORMAL">NORMAL (Standar)</option>
                <option value="RENDAH">RENDAH (Kosmetik / Ringan)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Catatan Pengelola untuk Manager (Opsional)
              </label>
              <input
                type="text"
                name="note"
                placeholder="Mis. Sudah dicek di lokasi, perlu ganti komponen"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              {isPending
                ? "Memproses..."
                : "Konfirmasi Valid & Teruskan ke Manager"}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* FORM 2: TANDAI TIDAK VALID (ALASAN WAJIB) */}
      {mode === "invalid" && (
        <form
          action={runAction(markReportInvalidAction)}
          className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3 text-xs"
        >
          <input type="hidden" name="reportId" value={reportId} />
          <div className="font-bold text-rose-950">
            Tandai Laporan Tidak Valid (Status Akhir → TIDAK_VALID)
          </div>
          <div>
            <label className="block font-semibold text-rose-900 mb-1">
              Alasan Penolakan / Tidak Valid (Wajib diisi, akan dikirim ke email
              pelapor) *
            </label>
            <textarea
              name="reason"
              rows={2}
              required
              placeholder="Mis. Setelah dicek di lokasi, lampu taman berfungsi normal (hanya sensor siang hari)."
              className="w-full rounded-lg border border-rose-300 bg-white p-2.5"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
            >
              {isPending
                ? "Memproses..."
                : "Kirim Status Tidak Valid & Email Alasan"}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* FORM 3: GABUNGKAN LAPORAN GANDA KE LAPORAN INDUK ASET YANG SAMA */}
      {mode === "merge" && (
        <form
          action={runAction(mergeDuplicateReportAction)}
          className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3 text-xs"
        >
          <input type="hidden" name="childReportId" value={reportId} />
          <div className="font-bold text-indigo-950">
            Gabungkan Laporan Ganda untuk Aset {assetCode} (Status Akhir →
            DIGABUNG)
          </div>

          {candidateParentReports.length === 0 ? (
            <div className="text-indigo-900">
              Belum ada laporan aktif lain untuk aset{" "}
              <strong>{assetCode}</strong> yang bisa dijadikan laporan induk.
            </div>
          ) : (
            <>
              <div>
                <label className="block font-semibold text-indigo-950 mb-1">
                  Pilih Laporan Induk pada Aset {assetCode} *
                </label>
                <select
                  name="parentReportId"
                  required
                  className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2"
                >
                  {candidateParentReports.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.ticketNo}] ({p.status}) — {p.description.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  {isPending
                    ? "Menggabungkan..."
                    : "Gabungkan ke Laporan Induk"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
