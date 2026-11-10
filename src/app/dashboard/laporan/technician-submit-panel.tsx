"use client";

import { useState, useTransition } from "react";
import { submitWorkResultAction } from "@/app/actions/phase6-actions";

interface TechnicianSubmitPanelProps {
  workOrderId: string;
  spkNo: string;
  ticketNo: string;
}

export function TechnicianSubmitPanel({
  workOrderId,
  spkNo,
  ticketNo,
}: TechnicianSubmitPanelProps) {
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const bUrl = beforeUrl.trim() || "https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800";
    const aUrl = afterUrl.trim() || "https://images.unsplash.com/photo-1584467735867-4297ae2ebcee?w=800";

    const fd = new FormData();
    fd.append("workOrderId", workOrderId);
    fd.append("beforePhotoUrls", bUrl);
    fd.append("afterPhotoUrls", aUrl);
    if (notes.trim()) fd.append("notes", notes.trim());

    startTransition(async () => {
      const res = await submitWorkResultAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: "Hasil perbaikan berhasil dikirim! Menunggu konfirmasi Manager.",
        });
      }
    });
  };

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-orange-50/50 p-4 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-orange-900 bg-orange-100 px-2 py-0.5 rounded border border-orange-300">
          Lapor Selesai Kerja (Teknisi)
        </span>
        <span className="text-xs text-slate-600">
          SPK: <strong className="font-mono">{spkNo}</strong>
        </span>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-3.5 rounded-xl border border-orange-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Foto Sebelum (Before) - Wajib:
            </label>
            <input
              type="text"
              value={beforeUrl}
              onChange={(e) => setBeforeUrl(e.target.value)}
              placeholder="https://... (atau biarkan default foto perbaikan)"
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Foto Sesudah (After) - Wajib:
            </label>
            <input
              type="text"
              value={afterUrl}
              onChange={(e) => setAfterUrl(e.target.value)}
              placeholder="https://... (atau biarkan default foto selesai)"
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Pengerjaan Teknisi:
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Mis. Komponen engsel telah diganti baru dan dicat ulang anti karat."
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
          >
            {isPending ? "Mengirimkan Hasil..." : "Kirim Hasil Perbaikan ke Manager →"}
          </button>
        </div>
      </form>
    </div>
  );
}
