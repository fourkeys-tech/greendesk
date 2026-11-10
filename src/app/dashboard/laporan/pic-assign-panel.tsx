"use client";

import { useState, useTransition } from "react";
import { Download, RefreshCw, UserCheck } from "lucide-react";
import {
  assignTechnicianAction,
  replaceTechnicianAction,
} from "@/app/actions/phase6-actions";

interface TechnicianOption {
  id: string;
  fullName: string;
}

interface PicAssignPanelProps {
  workOrderId: string;
  spkNo: string;
  technicians: TechnicianOption[];
  currentTechnicianId?: string | null;
  currentTechnicianName?: string | null;
  isReplacing?: boolean;
  spkFileUrl?: string | null;
  spkFileName?: string | null;
}

export function PicAssignPanel({
  workOrderId,
  spkNo,
  technicians,
  currentTechnicianId,
  currentTechnicianName,
  isReplacing = false,
  spkFileUrl,
  spkFileName,
}: PicAssignPanelProps) {
  const [selectedTechId, setSelectedTechId] = useState(
    technicians.find((t) => t.id !== currentTechnicianId)?.id || technicians[0]?.id || ""
  );
  const [replaceReason, setReplaceReason] = useState("");
  const [showReplaceForm, setShowReplaceForm] = useState(isReplacing);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleAssign = () => {
    if (!selectedTechId) {
      setFeedback({ type: "error", text: "Silakan pilih teknisi." });
      return;
    }

    const fd = new FormData();
    fd.append("workOrderId", workOrderId);
    fd.append("technicianId", selectedTechId);

    startTransition(async () => {
      const res = await assignTechnicianAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: "Teknisi berhasil ditugaskan! Status SPK berubah menjadi DIKERJAKAN.",
        });
      }
    });
  };

  const handleReplace = () => {
    if (!selectedTechId) {
      setFeedback({ type: "error", text: "Silakan pilih teknisi pengganti." });
      return;
    }
    if (selectedTechId === currentTechnicianId) {
      setFeedback({
        type: "error",
        text: "Pilih teknisi yang berbeda dari teknisi saat ini.",
      });
      return;
    }

    const fd = new FormData();
    fd.append("workOrderId", workOrderId);
    fd.append("newTechnicianId", selectedTechId);
    if (replaceReason.trim()) {
      fd.append("reason", replaceReason.trim());
    }

    startTransition(async () => {
      const res = await replaceTechnicianAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: "Teknisi berhasil diganti! Foto sebelum yang ada tetap melekat pada SPK ini.",
        });
        setShowReplaceForm(false);
      }
    });
  };

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-amber-50/50 p-4 rounded-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
            Penugasan Teknisi (PIC Vendor)
          </span>
          <span className="text-xs text-slate-600">
            SPK: <strong className="font-mono">{spkNo}</strong>
          </span>
        </div>

        {spkFileUrl && (
          <a
            href={spkFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={spkFileName || "SPK.pdf"}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh File SPK</span>
          </a>
        )}
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

      {technicians.length === 0 ? (
        <div className="text-xs text-amber-800">
          Belum ada teknisi aktif yang disetujui Admin. Silakan daftarkan teknisi di menu Teknisi Saya.
        </div>
      ) : currentTechnicianId && !showReplaceForm ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 text-xs">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-600">Teknisi Bertugas:</span>
            <strong className="text-slate-900">{currentTechnicianName || "Teknisi"}</strong>
          </div>
          <button
            type="button"
            onClick={() => setShowReplaceForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Ganti Teknisi Saat SPK Berjalan
          </button>
        </div>
      ) : (
        <div className="space-y-2 bg-white p-3 rounded-xl border border-amber-200">
          <div className="text-xs font-bold text-slate-800">
            {currentTechnicianId
              ? "Ganti Teknisi Pelaksana (Foto sebelum tetap dipertahankan)"
              : "Tunjuk Teknisi Penanggung Jawab"}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white flex-1 min-w-[200px]"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} {t.id === currentTechnicianId ? "(Sedang Bertugas)" : ""}
                </option>
              ))}
            </select>

            {currentTechnicianId ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleReplace}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                {isPending ? "Mengganti..." : "Konfirmasi Ganti Teknisi"}
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={handleAssign}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                {isPending ? "Menugaskan..." : "Tunjuk Teknisi Ini"}
              </button>
            )}

            {currentTechnicianId && (
              <button
                type="button"
                onClick={() => setShowReplaceForm(false)}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
            )}
          </div>

          {currentTechnicianId && (
            <div>
              <input
                type="text"
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                placeholder="Alasan penggantian teknisi (opsional, misal: teknisi berhalangan sakit)..."
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
