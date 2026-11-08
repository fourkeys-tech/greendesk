import React from "react";
import Link from "next/link";
import { Hammer, CheckCircle2, Clock, UserCheck, ArrowRight, ShieldAlert } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface TechnicianDashboardProps {
  session: SessionPayload;
  reports: any[];
}

export function TechnicianDashboard({
  session,
  reports,
}: TechnicianDashboardProps) {
  const activeReports = reports.filter((r) => r.status === "DIKERJAKAN" || r.status === "DISETUJUI");
  const confirmReports = reports.filter((r) => r.status === "MENUNGGU_KONFIRMASI");
  const selesaiReports = reports.filter((r) => r.status === "SELESAI");

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
              Teknisi Lapangan
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Privasi Pelapor Terlindungi
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Daftar Tugas SPK Perbaikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Lihat instruksi kerja, lokasi fisik aset, dan unggah foto bukti pengerjaan (sebelum & sesudah).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Hammer className="w-4 h-4" />
            <span>Tugas Aktif ({activeReports.length})</span>
          </Link>
          <Link
            href="/dashboard/profil-teknisi"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <UserCheck className="w-4 h-4" />
            <span>Profil Saya</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">SPK Perlu Dikerjakan</span>
            <div className="p-1.5 rounded-lg bg-orange-100 text-orange-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{activeReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Tugas siap dieksekusi</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Menunggu Konfirmasi</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{confirmReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Sudah Anda selesaikan</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tugas Selesai Tuntas</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{selesaiReports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Divalidasi Manager/Pengelola</div>
        </div>
      </div>

      {/* 3. Daftar SPK Tugas Lapangan */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              SPK Penugasan Anda Saat Ini
            </h2>
            <p className="text-[11px] text-slate-500">
              Pergi ke lokasi aset, periksa kerusakan, dan kirim dokumentasi foto pekerjaan.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-bold text-orange-700 hover:text-orange-800 inline-flex items-center gap-1"
          >
            <span>Semua SPK</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <div className="text-xs font-bold text-slate-800">
              Tidak Ada Tugas Menunggu
            </div>
            <p className="text-[11px] text-slate-500">
              Saat ini semua SPK yang ditugaskan ke Anda telah selesai dikerjakan.
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
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {r.asset?.name}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Lokasi: {r.asset?.locationNote || r.asset?.park?.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Instruksi: {r.description}
                  </div>
                </div>

                <Link
                  href="/dashboard/laporan"
                  className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition self-start sm:self-center"
                >
                  Buka & Unggah Hasil →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
