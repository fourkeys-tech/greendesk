"use client";

import { useState, useTransition } from "react";
import {
  archiveReportAction,
  restoreArchivedReportAction,
} from "@/app/actions/foundation-actions";

export function ArchiveReportButton({
  reportId,
  isArchived,
}: {
  reportId: string;
  isArchived: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleClick() {
    const confirmText = isArchived
      ? "Pulihkan laporan ini dari arsip?"
      : "Arsipkan laporan ini? Laporan tidak dihapus dan masih bisa dipulihkan.";
    if (!window.confirm(confirmText)) return;

    setFeedback(null);
    startTransition(async () => {
      const res = isArchived
        ? await restoreArchivedReportAction(reportId)
        : await archiveReportAction(reportId);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        suppressHydrationWarning
        disabled={isPending}
        onClick={handleClick}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60 ${
          isArchived
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
        }`}
      >
        {isPending
          ? "Memproses..."
          : isArchived
          ? "Pulihkan dari Arsip"
          : "Arsipkan Laporan"}
      </button>
      {feedback && (
        <span
          className={`text-[11px] font-medium ${
            feedback.type === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {feedback.text}
        </span>
      )}
    </div>
  );
}
