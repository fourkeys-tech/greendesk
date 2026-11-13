/** Skeleton area konten dashboard; sidebar & header dari layout tetap tampil saat navigasi. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5 animate-pulse">
      <span className="sr-only">Memuat halaman...</span>

      <div className="space-y-2">
        <div className="h-6 w-56 rounded-lg bg-slate-200" />
        <div className="h-3.5 w-80 max-w-full rounded-full bg-slate-100" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            <div className="mt-3 h-6 w-1/3 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded-full bg-slate-200" />
              <div className="h-3 w-1/3 rounded-full bg-slate-100" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
