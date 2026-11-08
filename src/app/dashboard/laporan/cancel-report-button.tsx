"use client";

import { useState, useTransition } from "react";
import { cancelOwnReportAction } from "@/app/actions/phase3-actions";

export function CancelReportButton({ reportId }: { reportId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelOwnReportAction(reportId);
      if (res.error) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={isPending}
        onClick={handleCancel}
        className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-semibold transition cursor-pointer"
      >
        {isPending ? "Membatalkan..." : "✕ Batalkan Laporan (Status Baru)"}
      </button>
      {error && <span className="text-[11px] text-rose-700 mt-1">{error}</span>}
    </div>
  );
}

