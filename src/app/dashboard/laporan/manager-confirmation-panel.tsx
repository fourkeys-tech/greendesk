"use client";

import { useState, useTransition } from "react";
import { confirmWorkResultAction } from "@/app/actions/phase6-actions";

interface WorkPhotoItem {
  id: string;
  type: "BEFORE" | "AFTER";
  url: string;
}

interface ManagerConfirmationPanelProps {
  workOrderId: string;
  spkNo: string;
  ticketNo: string;
  technicianName: string;
  photos: WorkPhotoItem[];
}

export function ManagerConfirmationPanel({
  workOrderId,
  spkNo,
  ticketNo,
  technicianName,
  photos,
}: ManagerConfirmationPanelProps) {
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const beforePhotos = photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = photos.filter((p) => p.type === "AFTER");

  const handleConfirm = (decision: "SESUAI" | "BELUM_SESUAI") => {
    setFeedback(null);
    const fd = new FormData();
    fd.append("workOrderId", workOrderId);
    fd.append("decision", decision);

    if (decision === "BELUM_SESUAI") {
      if (!revisionNote.trim()) {
        setFeedback({
          type: "error",
          text: "Catatan perbaikan ulang wajib diisi jika hasil belum sesuai.",
        });
        return;
      }
      fd.append("revisionNote", revisionNote.trim());
    }

    startTransition(async () => {
      const res = await confirmWorkResultAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text:
            decision === "SESUAI"
              ? "Perbaikan dikonfirmasi selesai! Email notifikasi hasil telah dikirim ke pelapor."
              : "Pekerjaan dikembalikan ke teknisi untuk perbaikan ulang.",
        });
        setShowRevisionForm(false);
      }
    });
  };

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-slate-50/70 p-4 rounded-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded border border-teal-200">
            MGR-M4 · Konfirmasi Hasil Perbaikan
          </span>
          <span className="text-xs text-slate-600">
            SPK: <strong className="font-mono">{spkNo}</strong> · Teknisi:{" "}
            <strong>{technicianName}</strong>
          </span>
        </div>
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

      {/* Perbandingan Foto Side-by-Side (Sebelum & Sesudah) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3.5 rounded-xl border border-slate-200">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            📸 Foto Sebelum Perbaikan (Before)
          </div>
          {beforePhotos.length === 0 ? (
            <div className="text-xs text-slate-400 italic">Belum ada foto before</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {beforePhotos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="Before" className="w-28 h-20 object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">
            📸 Foto Sesudah Perbaikan (After)
          </div>
          {afterPhotos.length === 0 ? (
            <div className="text-xs text-slate-400 italic">Belum ada foto after</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {afterPhotos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg overflow-hidden border border-emerald-300 hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="After" className="w-28 h-20 object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aksi Konfirmasi */}
      {!showRevisionForm ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            suppressHydrationWarning
            disabled={isPending || beforePhotos.length === 0 || afterPhotos.length === 0}
            onClick={() => handleConfirm("SESUAI")}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            {isPending ? "Menyimpan..." : "✓ Hasil Sesuai (Tutup SPK & Selesai)"}
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setShowRevisionForm(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
          >
            ↺ Belum Sesuai (Minta Revisi Teknisi)
          </button>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-xl border border-amber-300 space-y-3">
          <div className="text-xs font-bold text-amber-900 uppercase">
            Catatan Perbaikan Ulang untuk Teknisi (Wajib)
          </div>
          <textarea
            rows={2}
            suppressHydrationWarning
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="Mis. Cat pelindung anti-karat belum merata pada tiang bawah. Mohon disempurnakan."
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              suppressHydrationWarning
              disabled={isPending}
              onClick={() => handleConfirm("BELUM_SESUAI")}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50"
            >
              {isPending ? "Mengirim..." : "Kirim Catatan Revisi ke Teknisi"}
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setShowRevisionForm(false)}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
