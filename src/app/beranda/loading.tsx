/** Skeleton instan saat navigasi antar halaman /beranda/* sambil menunggu render server. */
export default function BerandaLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-screen bg-[#F6F5F0] px-4 pt-6 pb-32 md:px-6 md:pt-10"
    >
      <span className="sr-only">Memuat halaman...</span>
      <div className="mx-auto w-full max-w-md space-y-4 animate-pulse md:max-w-4xl md:space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-full bg-white border border-slate-200" />
          <div className="h-6 w-36 rounded-full bg-slate-200/80" />
          <div className="h-10 w-10 rounded-full bg-white border border-slate-200" />
        </div>

        <div className="h-24 rounded-2xl bg-[#222522]/90 md:h-28 md:rounded-3xl" />

        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 shrink-0 rounded-full bg-white border border-slate-200" />
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-2xl bg-white border border-slate-200/60 p-3.5"
            >
              <div className="h-14 w-14 shrink-0 rounded-xl bg-[#E3EDE6]" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-1/3 rounded-full bg-slate-200" />
                <div className="h-3.5 w-3/4 rounded-full bg-slate-200" />
                <div className="h-3 w-1/2 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
