"use client";

export function PrintQrSheetButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer print:hidden"
    >
      🖨️ Cetak Lembar QR Sekarang
    </button>
  );
}

