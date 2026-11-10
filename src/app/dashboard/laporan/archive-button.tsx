"use client";

import { useTransition } from "react";
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

  function handleClick() {
    startTransition(async () => {
      if (isArchived) {
        await restoreArchivedReportAction(reportId);
      } else {
        await archiveReportAction(reportId);
      }
    });
  }

  return (
    <button
      type="button"
      suppressHydrationWarning
      disabled={isPending}
      onClick={handleClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
        isArchived
          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
          : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
      }`}
    >
      {isPending
        ? "Memproses..."
        : isArchived
        ? "Pulihkan dari Arsip"
        : "Arsipkan Laporan (Soft Archive)"}
    </button>
  );
}

