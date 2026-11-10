"use client";

import { useState } from "react";
import {
  decideVendorReplacementAction,
  forwardVendorReplacementAction,
} from "@/app/actions/phase6-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

const inputClass =
  "w-full sm:flex-1 min-w-0 text-xs rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

/** Panel keputusan Manager: setujui (catatan opsional) atau tolak (alasan wajib). */
export function ManagerDecisionPanel({
  requestId,
  requestNo,
}: {
  requestId: string;
  requestNo: string;
}) {
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const { feedback, isPending, run } = useActionRunner();

  function submit(decision: "SETUJU" | "TOLAK") {
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("decision", decision);
    fd.set("decisionNote", decision === "SETUJU" ? approveNote : rejectNote);
    run(() => decideVendorReplacementAction(fd), {
      confirmText:
        decision === "SETUJU"
          ? `Setujui pengajuan ${requestNo}? Admin akan meneruskannya ke Owner.`
          : `Tolak pengajuan ${requestNo}?`,
    });
  }

  return (
    <div className="pt-3 border-t border-slate-100 bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 space-y-3">
      <div className="text-xs font-bold text-emerald-900">Keputusan Manager</div>
      <FeedbackBanner feedback={feedback} compact />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="Catatan persetujuan (opsional)"
            aria-label="Catatan persetujuan"
            className={`${inputClass} border-slate-300`}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => submit("SETUJU")}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
          >
            Setujui
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Alasan penolakan (wajib)"
            aria-label="Alasan penolakan"
            className={`${inputClass} border-rose-300`}
          />
          <button
            type="button"
            disabled={isPending || rejectNote.trim().length === 0}
            onClick={() => submit("TOLAK")}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
          >
            Tolak
          </button>
        </div>
      </div>
    </div>
  );
}

/** Panel Admin: teruskan pengajuan yang disetujui Manager ke Owner / Direksi. */
export function AdminForwardPanel({
  requestId,
  requestNo,
}: {
  requestId: string;
  requestNo: string;
}) {
  const [note, setNote] = useState("");
  const { feedback, isPending, run } = useActionRunner();

  return (
    <div className="pt-3 border-t border-slate-100 bg-sky-50/40 p-4 rounded-2xl border border-sky-200 space-y-3">
      <div className="text-xs font-bold text-sky-900">Teruskan ke Owner / Direksi</div>
      <FeedbackBanner feedback={feedback} compact />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan pengantar untuk Owner (opsional)"
          aria-label="Catatan pengantar untuk Owner"
          className={`${inputClass} border-slate-300`}
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const fd = new FormData();
            fd.set("requestId", requestId);
            fd.set("forwardNote", note);
            run(() => forwardVendorReplacementAction(fd), {
              confirmText: `Teruskan pengajuan ${requestNo} ke Owner / Direksi?`,
            });
          }}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
        >
          {isPending ? "Memproses..." : "Teruskan ke Owner"}
        </button>
      </div>
    </div>
  );
}
