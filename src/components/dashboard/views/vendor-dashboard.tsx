import React from "react";
import Link from "next/link";
import { Wrench, Users, CheckCircle2, Clock, ArrowRight, Building2 } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface VendorDashboardProps {
  session: SessionPayload;
  reports: any[];
  technicianCount: number;
}

export function VendorDashboard({
  session,
  reports,
  technicianCount,
}: VendorDashboardProps) {
  // SPK Baru butuh alokasi teknisi
  const unassignedReports = reports.filter(
    (r) => r.status === "DISETUJUI" || (r.workOrder && !r.workOrder.technicianId)
  );
  const inProgressReports = reports.filter((r) => r.status === "DIKERJAKAN");
  const confirmReports = reports.filter((r) => r.status === "MENUNGGU_KONFIRMASI");
  const selesaiReports = reports.filter((r) => r.status === "SELESAI");

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            Hub Rekanan Vendor
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Manajemen SPK & Penugasan Teknisi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Terima Surat Perintah Kerja (SPK) dari Estate Manager, tunjuk teknisi pelaksana, dan kelola personel teknisi rekanan Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Wrench className="w-4 h-4" />
            <span>Alokasikan SPK ({unassignedReports.length})</span>
          </Link>
          <Link
            href="/dashboard/teknisi"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Users className="w-4 h-4" />
            <span>Tim Teknisi ({technicianCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Perlu Tunjuk Teknisi</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{unassignedReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">SPK baru disetujui Manager</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">SPK Sedang Berjalan</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{inProgressReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Sedang dikerjakan teknisi</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Menunggu Konfirmasi</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{confirmReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Bukti perbaikan telah dikirim</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Teknisi Terdaftar</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{technicianCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Personel di vendor Anda</div>
        </div>
      </div>

      {/* 3. Daftar SPK Masuk */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Daftar SPK Terbitan Manager (Vendor Anda)
            </h2>
            <p className="text-[11px] text-slate-500">
              Segera tunjuk teknisi yang kompeten agar perbaikan segera dijalankan di lapangan.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
          >
            <span>Semua SPK</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <div className="text-xs font-bold text-slate-800">
              Tidak Ada SPK Menunggu
            </div>
            <p className="text-[11px] text-slate-500">
              Belum ada SPK baru yang ditugaskan ke vendor Anda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {r.workOrder?.spkNo || r.ticketNo}
                    </span>
                    <StatusBadge status={r.status} />
                    <PriorityBadge priority={r.priority} />
                    <span className="text-[11px] text-slate-400">
                      Teknisi: {r.workOrder?.technician?.fullName || "Belum ditunjuk"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {r.asset?.name}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {r.description}
                  </div>
                </div>

                <Link
                  href="/dashboard/laporan"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition self-start sm:self-center"
                >
                  Tunjuk Teknisi →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
