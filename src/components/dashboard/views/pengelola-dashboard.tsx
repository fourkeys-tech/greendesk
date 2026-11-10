import React from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  MapPin,
  AlertTriangle,
  Wrench,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Check,
  Building2,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface PengelolaDashboardProps {
  session: SessionPayload;
  reports: any[];
  assetCount: number;
}

export function PengelolaDashboard({
  reports,
  assetCount,
}: PengelolaDashboardProps) {
  const baruReports = reports.filter((r) => r.status === "BARU");
  const inProgressReports = reports.filter(
    (r) => r.status === "DIKERJAKAN" || r.status === "DISETUJUI"
  );
  const confirmReports = reports.filter(
    (r) => r.status === "MENUNGGU_KONFIRMASI"
  );
  const highPriorityReports = reports.filter(
    (r) =>
      r.priority === "TINGGI" &&
      !["SELESAI", "TIDAK_VALID", "DIBATALKAN", "DITOLAK"].includes(r.status)
  );
  const activeFieldReports = reports.filter((r) =>
    ["DIKERJAKAN", "DISETUJUI", "MENUNGGU_KONFIRMASI", "MENUNGGU_KEPUTUSAN"].includes(
      r.status
    )
  );

  return (
    <div className="space-y-6">
      {/* 1. Page Banner & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>Operasional Wilayah</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-semibold">
              {assetCount} Aset Taman Terdaftar
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Verifikasi &amp; Penanganan Klaster
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Pantau dan verifikasi laporan warga di klaster Anda sebelum
            diteruskan ke Manager untuk penerbitan SPK perbaikan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Antrean Verifikasi ({baruReports.length})</span>
          </Link>
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>Peta Aset</span>
          </Link>
        </div>
      </div>

      {/* 2. KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Perlu Verifikasi (Baru) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Perlu Verifikasi (Baru)
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {baruReports.length}
                </span>
                {baruReports.length === 0 ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Terkendali
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                    Antrean Baru
                  </span>
                )}
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Laporan masuk dari warga</span>
            <span className="font-semibold text-slate-700">Hari ini</span>
          </div>
        </div>

        {/* Card 2: Sedang Dikerjakan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 p-4 sm:p-5 shadow-xs hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Sedang Dikerjakan
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {inProgressReports.length}
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  SPK Aktif
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Teknisi aktif di lapangan</span>
            <Link
              href="/dashboard/laporan"
              className="font-semibold text-amber-700 hover:underline"
            >
              Pantau →
            </Link>
          </div>
        </div>

        {/* Card 3: Menunggu Konfirmasi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Menunggu Konfirmasi
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {confirmReports.length}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Pekerjaan teknisi tuntas</span>
            <span className="font-semibold text-slate-700">QC Akhir</span>
          </div>
        </div>

        {/* Card 4: Prioritas Tinggi Aktif */}
        <div className="bg-gradient-to-br from-white via-white to-rose-50/40 rounded-2xl border border-rose-200/80 border-t-4 border-t-rose-500 p-4 sm:p-5 shadow-xs hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-rose-700">
                Prioritas Tinggi Aktif
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
                  {highPriorityReports.length}
                </span>
                {highPriorityReports.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                    Mendesak
                  </span>
                )}
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-700/80">
            <span>Butuh perhatian mendesak</span>
            <Link
              href="/dashboard/laporan"
              className="font-bold text-rose-700 hover:underline"
            >
              Cek Detail →
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Main Queue Section (Antrean Laporan Baru Masuk) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Antrean Laporan Baru Masuk (Klaster Ini)
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-full">
                {baruReports.length} Menunggu
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Periksa keabsahan laporan, tetapkan tingkat prioritas, atau gabung
              jika merupakan laporan ganda.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 rounded-xl transition self-start sm:self-auto"
          >
            <span>Buka Antrean Lengkap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 sm:p-6">
          {baruReports.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 py-10 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4 shadow-xs ring-8 ring-emerald-50/60">
                <Check className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Antrean Verifikasi Bersih
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                Semua laporan warga telah diverifikasi dan diteruskan. Tidak ada
                tiket baru yang tertunda di meja pengelola saat ini.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  href="/dashboard/laporan"
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                >
                  Lihat Riwayat Tiket
                </Link>
                <Link
                  href="/dashboard/wilayah"
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/70 transition"
                >
                  Tinjau Peta Aset
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {baruReports.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-3 rounded-xl transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                        {r.ticketNo}
                      </span>
                      <StatusBadge status={r.status} />
                      <PriorityBadge priority={r.priority} />
                      <span className="text-[11px] text-slate-400">
                        Oleh: {r.reporter?.name || "Warga"}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {r.asset?.name} ({r.asset?.code})
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-1">
                      {r.description}
                    </div>
                  </div>

                  <Link
                    href="/dashboard/laporan"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition self-start sm:self-center shrink-0"
                  >
                    Verifikasi Sekarang →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Work Orders Preview (Ringkasan Penanganan Aktif) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ringkasan Penanganan Aktif ({activeFieldReports.length} Tiket)
            </h3>
          </div>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Lihat Semua →
          </Link>
        </div>

        {activeFieldReports.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Belum ada SPK atau penanganan lapangan yang sedang berjalan di
            klaster ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeFieldReports.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                      item.priority === "TINGGI"
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    {item.priority === "TINGGI" ? "P1" : "SPK"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {item.ticketNo}
                      </span>
                      <StatusBadge status={item.status} />
                      {item.priority && (
                        <PriorityBadge priority={item.priority} />
                      )}
                      <span className="text-xs font-bold text-slate-900">
                        {item.asset?.name} – {item.asset?.park?.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.workOrder ? (
                        <>
                          SPK:{" "}
                          <strong className="font-mono text-slate-700">
                            {item.workOrder.spkNo}
                          </strong>{" "}
                          • Vendor:{" "}
                          <strong className="text-slate-700">
                            {item.workOrder.vendor?.name}
                          </strong>
                          {item.workOrder.technician && (
                            <>
                              {" "}
                              • Teknisi:{" "}
                              <strong className="text-slate-700">
                                {item.workOrder.technician.fullName}
                              </strong>
                            </>
                          )}
                        </>
                      ) : (
                        item.description
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <Link
                    href="/dashboard/laporan"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition"
                  >
                    Detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
