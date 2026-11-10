import { DatabaseZap } from "lucide-react";

/**
 * Pemberitahuan saat data gagal dimuat (mis. database lokal offline),
 * agar halaman tidak jatuh ke error 500 tanpa penjelasan.
 */
export function DbErrorNotice({
  title = "Data belum bisa dimuat",
  message = "Koneksi ke database sedang bermasalah. Coba muat ulang halaman beberapa saat lagi. Jika berlanjut, hubungi tim teknis.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
        <DatabaseZap className="w-4 h-4" />
      </div>
      <div className="text-xs sm:text-sm">
        <div className="font-bold">{title}</div>
        <p className="mt-0.5 text-amber-800">{message}</p>
      </div>
    </div>
  );
}

export function AccessDeniedNotice({ message }: { message: string }) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
      <h1 className="text-lg font-bold">Akses ditolak</h1>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
}
