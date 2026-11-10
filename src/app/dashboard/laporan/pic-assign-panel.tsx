"use client";

import { useState, useTransition } from "react";
import { assignTechnicianAction } from "@/app/actions/phase6-actions";

interface TechnicianOption {
  id: string;
  fullName: string;
}

interface PicAssignPanelProps {
  workOrderId: string;
  spkNo: string;
  technicians: TechnicianOption[];
}

export function PicAssignPanel({
  workOrderId,
  spkNo,
  technicians,
}: PicAssignPanelProps) {
  const [selectedTechId, setSelectedTechId] = useState(technicians[0]?.id || "");
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

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-amber-50/50 p-4 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
          Penugasan Teknisi (PIC Vendor)
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

      {technicians.length === 0 ? (
        <div className="text-xs text-amber-800">
          Belum ada teknisi aktif yang disetujui. Silakan daftarkan teknisi di menu Kelola Teknisi.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTechId}
            onChange={(e) => setSelectedTechId(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white flex-1 min-w-[200px]"
          >
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={handleAssign}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
          >
            {isPending ? "Menugaskan..." : "Tunjuk Teknisi Ini"}
          </button>
        </div>
      )}
    </div>
  );
}
