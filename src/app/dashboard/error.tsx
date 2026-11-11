"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { DbErrorNotice } from "@/components/dashboard/db-error-notice";

/**
 * Error boundary dashboard. Dipicu antara lain oleh SessionUnavailableError
 * (database tidak bisa dihubungi saat memvalidasi sesi) — sesi fail-closed, bukan fallback JWT.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-8 space-y-4">
      <DbErrorNotice
        title="Layanan sedang gangguan"
        message="Halaman tidak dapat dimuat karena koneksi ke database bermasalah. Coba lagi beberapa saat; bila berlanjut, hubungi tim teknis."
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <RefreshCw className="w-4 h-4" />
          Coba lagi
        </button>
        {error.digest && (
          <span className="text-[11px] text-slate-400">Ref: {error.digest}</span>
        )}
      </div>
    </div>
  );
}
