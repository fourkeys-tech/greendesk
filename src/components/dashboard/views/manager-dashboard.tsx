import React from "react";
import Link from "next/link";
import { CheckSquare, Wrench, CheckCircle2, Clock, ArrowRight, Building2, AlertTriangle } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface ManagerDashboardProps {
  session: SessionPayload;
  reports: any[];
  vendorCount: number;
}

export function ManagerDashboard({
  session,
  reports,
  vendorCount,
}: ManagerDashboardProps) {
  const reviewReports = reports.filter((r) => r.status === "MENUNGGU_KEPUTUSAN");
  const inProgressReports = reports.filter((r) => r.status === "DIKERJAKAN" || r.status === "DISETUJUI");
  const confirmReports = reports.filter((r) => r.status === "MENUNGGU_KONFIRMASI");
  const selesaiReports = reports.filter((r) => r.status === "SELESAI");

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
            Meja Kerja Estate Manager
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Persetujuan SPK & Pengawasan Perbaikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Evaluasi laporan terverifikasi, terbitkan Surat Perintah Kerja (SPK) ke vendor, dan validasi hasil perbaikan di lapangan.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Review Keputusan ({reviewReports.length})</span>
          </Link>
          <Link
            href="/dashboard/vendor"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Building2 className="w-4 h-4" />
            <span>Vendor ({vendorCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Menunggu Keputusan SPK</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{reviewReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Laporan diverifikasi pengelola</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">SPK Berjalan (Vendor)</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{inProgressReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Dikerjakan teknisi vendor</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Konfirmasi Hasil Selesai</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{confirmReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Menunggu validasi Manager</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Selesai Ditutup</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{selesaiReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Tiket perbaikan tuntas</div>
        </div>
      </div>

      {/* 3. Laporan Menunggu Keputusan & Penerbitan SPK */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Laporan Menunggu Keputusan Persetujuan / SPK
            </h2>
            <p className="text-[11px] text-slate-500">
              Tentukan vendor pelaksana, terbitkan SPK, atau tolak perbaikan jika di luar standar operasional.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-bold text-indigo-700 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            <span>Buka Semua Antrean</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reviewReports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <div className="text-xs font-bold text-slate-800">
              Tidak Ada Keputusan Tertunda
            </div>
            <p className="text-[11px] text-slate-500">
              Semua usulan perbaikan dari pengelola klaster telah diputuskan.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviewReports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {r.ticketNo}
                    </span>
                    <StatusBadge status={r.status} />
                    <PriorityBadge priority={r.priority} />
                    {r.underWarrantyOfVendor && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                        Garansi Vendor ({r.underWarrantyOfVendor.name})
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {r.asset?.name} ({r.asset?.park?.name})
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {r.description}
                  </div>
                </div>

                <Link
                  href="/dashboard/laporan"
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition self-start sm:self-center"
                >
                  Putuskan & Buat SPK →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
