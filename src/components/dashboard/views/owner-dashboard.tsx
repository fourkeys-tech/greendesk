import React from "react";
import Link from "next/link";
import { BarChart3, Building2, CheckCircle2, Clock, Layers, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface OwnerDashboardProps {
  session: SessionPayload;
  reports: any[];
  assetCount: number;
  vendorCount: number;
}

export function OwnerDashboard({
  session,
  reports,
  assetCount,
  vendorCount,
}: OwnerDashboardProps) {
  const total = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const aktif = reports.filter((r) => r.status !== "SELESAI" && r.status !== "DIBATALKAN" && r.status !== "DITOLAK").length;
  const rate = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
            Eksekutif & Direksi
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Ringkasan Operasional Aset Estate
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Pengawasan performa operasional, SLA penanganan kerusakan aset, dan kualitas layanan vendor di seluruh klaster {session.companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Pantau Laporan ({total})</span>
          </Link>
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Layers className="w-4 h-4" />
            <span>Peta Aset ({assetCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI Eksekutif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tingkat Penyelesaian</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{rate}%</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {selesai} dari {total} tiket selesai
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tiket Masih Aktif</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{aktif}</div>
          <div className="text-[11px] text-slate-500 mt-1">Dalam proses penanganan</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Aset Terdaftar</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{assetCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Fasilitas fisik ber-QR</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Vendor Rekanan</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{vendorCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Kontraktor pemeliharaan</div>
        </div>
      </div>

      {/* 3. Feed Laporan Terbaru */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Aktivitas Laporan Terkini Lintas Klaster
            </h2>
            <p className="text-[11px] text-slate-500">
              Ringkasan pergerakan status tiket di seluruh klaster perumahan.
            </p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-bold text-slate-800 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <span>Semua Laporan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <div className="text-xs font-bold text-slate-800">
              Belum Ada Data Laporan
            </div>
            <p className="text-[11px] text-slate-500">
              Data laporan akan terhimpun otomatis saat warga atau staf melapor.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {r.ticketNo}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {r.asset?.name} ({r.asset?.park?.cluster?.name || r.asset?.park?.name})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.description}
                  </div>
                </div>

                <Link
                  href="/dashboard/laporan"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition self-start sm:self-center"
                >
                  Detail →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
