import React from "react";
import Link from "next/link";
import {
  CheckSquare,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building2,
  Check,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface ManagerDashboardProps {
  session: SessionPayload;
  reports: any[];
  vendorCount: number;
}

export function ManagerDashboard({
  reports,
  vendorCount,
}: ManagerDashboardProps) {
  const reviewReports = reports.filter(
    (r) => r.status === "MENUNGGU_KEPUTUSAN"
  );
  const inProgressReports = reports.filter(
    (r) => r.status === "DIKERJAKAN" || r.status === "DISETUJUI"
  );
  const confirmReports = reports.filter(
    (r) => r.status === "MENUNGGU_KONFIRMASI"
  );
  const selesaiReports = reports.filter((r) => r.status === "SELESAI");

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>Pengawasan &amp; Otorisasi</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-semibold">
              {vendorCount} Mitra Vendor Aktif
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Persetujuan SPK &amp; Pengawasan Perbaikan
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Evaluasi laporan terverifikasi, terbitkan Surat Perintah Kerja (SPK)
            ke vendor, dan validasi hasil perbaikan di lapangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Review Keputusan ({reviewReports.length})</span>
          </Link>
          <Link
            href="/dashboard/vendor"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-bold shadow-2xs transition"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>Rapor Vendor ({vendorCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-indigo-500 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Menunggu Keputusan SPK
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {reviewReports.length}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Laporan diverifikasi pengelola
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                SPK Berjalan (Vendor)
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {inProgressReports.length}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Dikerjakan teknisi vendor
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-500 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Menunggu Konfirmasi
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {confirmReports.length}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Menunggu validasi Manager
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Total Selesai Ditutup
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {selesaiReports.length}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Tiket perbaikan tuntas
          </div>
        </div>
      </div>

      {/* 3. Laporan Menunggu Keputusan & Penerbitan SPK */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Laporan Menunggu Keputusan Persetujuan / SPK
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tentukan vendor pelaksana, terbitkan SPK, atau tolak perbaikan
              jika di luar standar operasional.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 rounded-xl transition self-start sm:self-auto"
          >
            <span>Buka Semua Antrean</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 sm:p-6">
          {reviewReports.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 py-10 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4 shadow-xs ring-8 ring-emerald-50/60">
                <Check className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Tidak Ada Keputusan Tertunda
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5">
                Semua usulan perbaikan dari pengelola klaster telah diputuskan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviewReports.slice(0, 5).map((r) => (
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
                      {r.underWarrantyOfVendor && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                          🛡️ Garansi Vendor ({r.underWarrantyOfVendor.name})
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {r.asset?.name} ({r.asset?.park?.name})
                    </div>
                    <div className="text-xs text-slate-600">
                      {r.description}
                    </div>
                  </div>

                  <Link
                    href="/dashboard/laporan"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition self-start sm:self-center shrink-0"
                  >
                    Putuskan &amp; Buat SPK →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
