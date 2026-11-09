import React from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Shield,
  History,
  Wrench,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

export interface OwnerDashboardProps {
  session: SessionPayload;
  reports: any[];
  assetCount: number;
  vendorCount: number;
  clustersWithStats: Array<{
    id: string;
    name: string;
    parks: Array<{
      id: string;
      name: string;
      _count: { assets: number };
    }>;
  }>;
  vendorsWithStats: Array<{
    id: string;
    name: string;
    type: string;
    warrantyDays: number;
    _count: { workOrders: number; technicians: number };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entityName: string;
    summary: string;
    actorName: string;
    actorRole: string;
    createdAt: Date;
  }>;
}

export function OwnerDashboard({
  session,
  reports,
  assetCount,
  vendorCount,
  clustersWithStats,
  vendorsWithStats,
  recentAuditLogs,
}: OwnerDashboardProps) {
  const total = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const aktif = reports.filter(
    (r) => r.status !== "SELESAI" && r.status !== "DIBATALKAN" && r.status !== "DITOLAK"
  ).length;
  const rate = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner Eksekutif */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
              Eksekutif & Direksi
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {session.companyName}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ringkasan Pengawasan Operasional Estate
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Pantau performa penanganan perbaikan aset, efektivitas rekanan vendor, dan transparansi audit di seluruh klaster {session.companyName}.
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
            <span>Struktur Aset ({assetCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI Eksekutif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tingkat Penyelesaian (SLA)</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{rate}%</div>
          <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-100">
            {selesai} dari {total} tiket selesai tuntas
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tiket Sedang Berjalan</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{aktif}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Dalam proses verifikasi & pengerjaan
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Aset Fisik Terdata</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{assetCount}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Fasilitas berlabel QR di seluruh taman
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Mitra Vendor Rekanan</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{vendorCount}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Kontraktor pemeliharaan aktif
          </div>
        </div>
      </div>

      {/* 3. Sebaran Klaster & Rapor Vendor Rekanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Sebaran Klaster & Feed Laporan (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sebaran Klaster & Aset */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Sebaran Kawasan & Klaster Estate
                </h2>
                <p className="text-xs text-slate-500">
                  Ringkasan fasilitas taman dan aset fisik per klaster
                </p>
              </div>
              <Link
                href="/dashboard/wilayah"
                className="text-xs font-semibold text-rose-700 hover:underline"
              >
                Peta Lengkap →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {clustersWithStats.map((cl) => {
                const totalParks = cl.parks.length;
                const totalAssetsInCluster = cl.parks.reduce(
                  (acc, p) => acc + p._count.assets,
                  0
                );
                return (
                  <div
                    key={cl.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {cl.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-bold">
                        {totalAssetsInCluster} Aset
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{totalParks} Taman terdaftar</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feed Laporan Terkini Lintas Klaster */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Aktivitas Laporan Terkini Lintas Klaster
                </h2>
                <p className="text-xs text-slate-500">
                  Pergerakan tiket perbaikan fasilitas estate
                </p>
              </div>
              <Link
                href="/dashboard/laporan"
                className="text-xs font-semibold text-slate-800 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Semua Laporan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {reports.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                Belum ada tiket laporan kerusakan yang tercatat.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 p-2 rounded-xl transition text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {r.ticketNo}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="font-bold text-slate-900">
                        {r.asset?.name}{" "}
                        <span className="font-normal text-slate-500">
                          ({r.asset?.park?.cluster?.name || r.asset?.park?.name})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {r.description}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/laporan?highlight=${r.id}`}
                      className="text-[11px] font-semibold text-rose-700 hover:underline shrink-0"
                    >
                      Detail Tiket →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Rapor Vendor & Jejak Audit Eksekutif (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mitra Vendor Rekanan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Mitra Vendor Rekanan
                </h2>
                <p className="text-xs text-slate-500">
                  Kontraktor pemeliharaan dan teknisi
                </p>
              </div>
              <Link
                href="/dashboard/vendor"
                className="text-xs font-semibold text-rose-700 hover:underline"
              >
                Data Vendor →
              </Link>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {vendorsWithStats.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-500">
                  Belum ada vendor rekanan terdaftar.
                </div>
              ) : (
                vendorsWithStats.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{v.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {v.type === "INTERNAL" ? "Tim Internal" : "Eksternal"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{v._count.technicians} Teknisi terdaftar</span>
                      <span>Garansi: {v.warrantyDays} hari</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Jejak Audit Eksekutif (AuditLog) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Transparansi Perubahan Data
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Log mutasi data master estate (AuditLog)
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/audit"
                className="text-xs font-semibold text-rose-700 hover:underline"
              >
                Semua Log →
              </Link>
            </div>

            <div className="space-y-2 pt-1">
              {recentAuditLogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Belum ada catatan log riwayat.
                </div>
              ) : (
                recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">
                        {log.summary}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                          log.action === "CREATE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {log.actorName} ({log.actorRole})
                      </span>
                      <span>
                        {new Date(log.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
