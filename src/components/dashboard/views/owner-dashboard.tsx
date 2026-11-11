import React from "react";
import Link from "next/link";
import type { AuditAction, ReportStatus, Role } from "@/lib/db-types";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  History,
  MapPin,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AUDIT_ACTION_META } from "@/lib/audit-labels";
import {
  ROLE_METADATA,
  STATUS_METADATA,
  TERMINAL_REPORT_STATUSES,
} from "@/lib/permissions";
import { VENDOR_TYPE_LABEL } from "@/lib/vendor-labels";
import { formatWibDate, formatWibDateTime } from "@/lib/dates";
import type { SessionPayload } from "@/lib/auth";

export interface OwnerVendorSummary {
  id: string;
  name: string;
  type: "INTERNAL" | "EXTERNAL";
  isActive: boolean;
  warrantyDays: number;
  technicianCount: number;
  totalJobs: number;
  completedJobs: number;
  avgDurationHours: number;
  revisionCount: number;
  warrantyDefectsCount: number;
}

export interface OwnerEscalationItem {
  id: string;
  requestNo: string;
  createdAt: Date;
  ownerViewedAt: Date | null;
  asset: { name: string; code: string };
  vendor: { name: string };
}

export interface OwnerDashboardProps {
  session: SessionPayload;
  reports: any[];
  activeAssetCount: number;
  totalAssetCount: number;
  activeVendorCount: number;
  totalVendorCount: number;
  avgResolutionDays: number | null;
  revisionTotalCount: number;
  warrantyDefectsTotalCount: number;
  escalationCount: number;
  recentEscalations: OwnerEscalationItem[];
  clustersWithStats: Array<{
    id: string;
    name: string;
    isActive: boolean;
    parks: Array<{
      id: string;
      name: string;
      isActive: boolean;
      _count: { assets: number };
    }>;
  }>;
  vendorSummaries: OwnerVendorSummary[];
  recentAuditLogs: Array<{
    id: string;
    action: AuditAction;
    entityName: string;
    summary: string;
    actorName: string;
    actorRole: Role;
    createdAt: Date;
  }>;
}

const ORDERED_STATUSES: ReportStatus[] = [
  "BARU",
  "MENUNGGU_KEPUTUSAN",
  "DISETUJUI",
  "DIKERJAKAN",
  "MENUNGGU_KONFIRMASI",
  "SELESAI",
  "DIGABUNG",
  "TIDAK_VALID",
  "DITOLAK",
  "DIBATALKAN",
];

const STATUS_BAR_COLOR: Record<ReportStatus, string> = {
  BARU: "bg-sky-500",
  MENUNGGU_KEPUTUSAN: "bg-amber-500",
  DISETUJUI: "bg-indigo-500",
  DIKERJAKAN: "bg-orange-500",
  MENUNGGU_KONFIRMASI: "bg-teal-500",
  SELESAI: "bg-emerald-500",
  DIGABUNG: "bg-purple-500",
  TIDAK_VALID: "bg-rose-400",
  DITOLAK: "bg-rose-600",
  DIBATALKAN: "bg-slate-400",
};

export function OwnerDashboard({
  session,
  reports,
  activeAssetCount,
  totalAssetCount,
  activeVendorCount,
  totalVendorCount,
  avgResolutionDays,
  revisionTotalCount,
  warrantyDefectsTotalCount,
  escalationCount,
  recentEscalations,
  clustersWithStats,
  vendorSummaries,
  recentAuditLogs,
}: OwnerDashboardProps) {
  const total = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const dibatalkanCount = reports.filter((r) => r.status === "DIBATALKAN").length;
  const digabungCount = reports.filter((r) => r.status === "DIGABUNG").length;
  const tidakValidCount = reports.filter((r) => r.status === "TIDAK_VALID").length;
  const validDenominator = Math.max(0, total - dibatalkanCount - digabungCount - tidakValidCount);

  const completionRate =
    validDenominator > 0 ? Math.round((selesai / validDenominator) * 100) : 0;
  const aktif = reports.filter(
    (r) => !TERMINAL_REPORT_STATUSES.includes(r.status as ReportStatus)
  ).length;

  const pctTidakValid = total > 0 ? ((tidakValidCount / total) * 100).toFixed(1) : "0";
  const pctDigabung = total > 0 ? ((digabungCount / total) * 100).toFixed(1) : "0";

  const statusCountMap = new Map<ReportStatus, number>();
  for (const r of reports) {
    const st = r.status as ReportStatus;
    statusCountMap.set(st, (statusCountMap.get(st) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${ROLE_METADATA.OWNER.badgeColor}`}
            >
              {ROLE_METADATA.OWNER.label}
            </span>
            {session.companyName && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {session.companyName}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ringkasan Pengawasan Operasional Estate
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Pantau efektivitas penanganan kerusakan aset, rapor kinerja vendor, eskalasi, dan riwayat perubahan data di seluruh cluster.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Pantau Laporan ({total})</span>
          </Link>
          <Link
            href="/dashboard/spk"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Daftar SPK</span>
          </Link>
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Layers className="w-4 h-4" />
            <span>Struktur Aset ({activeAssetCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Kartu Metrik KPI Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tingkat Penyelesaian</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{completionRate}%</div>
          <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-slate-100">
            {selesai} dari {validDenominator} laporan valid selesai
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tiket Aktif</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{aktif}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Dalam proses verifikasi &amp; pengerjaan
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Aset Aktif Ber-QR</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeAssetCount}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Dari {totalAssetCount} total aset terdaftar
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Vendor Aktif</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeVendorCount}</div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Dari {totalVendorCount} total mitra vendor
          </div>
        </div>
      </div>

      {/* 2b. Metrik Kualitas Penanganan & Distribusi Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            Indikator Kualitas Penanganan
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] text-slate-500">Laporan Tidak Valid</div>
              <div className="text-lg font-extrabold text-rose-700 mt-0.5">
                {pctTidakValid}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {tidakValidCount} dari {total} laporan
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] text-slate-500">Laporan Digabung</div>
              <div className="text-lg font-extrabold text-purple-700 mt-0.5">
                {pctDigabung}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {digabungCount} laporan ganda
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] text-slate-500">Rata-rata Waktu Selesai</div>
              <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                {avgResolutionDays !== null ? `${avgResolutionDays} hari` : "-"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Sejak laporan hingga konfirmasi
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] text-slate-500">Revisi &amp; Garansi</div>
              <div className="text-lg font-extrabold text-amber-800 mt-0.5">
                {revisionTotalCount} / {warrantyDefectsTotalCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Perbaikan ulang · rusak masa garansi
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Distribusi Status Laporan
              </h2>
              <p className="text-xs text-slate-500">
                Sebaran {total} laporan pada setiap tahap
              </p>
            </div>
            <Link
              href="/dashboard/laporan"
              className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
            >
              Rincian →
            </Link>
          </div>

          {total === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
              Belum ada laporan untuk ditampilkan.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {ORDERED_STATUSES.map((st) => {
                const count = statusCountMap.get(st) ?? 0;
                if (count === 0) return null;
                const pct = Math.max(4, Math.round((count / total) * 100));
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 truncate">
                        {STATUS_METADATA[st].label}
                      </span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {count}{" "}
                        <span className="font-normal text-slate-400">
                          ({Math.round((count / total) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_BAR_COLOR[st]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Sebaran Klaster, Feed Laporan, Eskalasi, Rapor Vendor, Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sebaran Cluster & Tiket */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Ringkasan per Cluster
                </h2>
                <p className="text-xs text-slate-500">
                  Taman, aset aktif, tiket aktif, dan laporan selesai di setiap cluster
                </p>
              </div>
              <Link
                href="/dashboard/wilayah"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Lihat Wilayah →
              </Link>
            </div>

            {clustersWithStats.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                Belum ada data cluster.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {clustersWithStats.map((cl) => {
                  const totalParks = cl.parks.length;
                  const activeAssetsInCluster = cl.parks.reduce(
                    (acc, p) => acc + p._count.assets,
                    0
                  );
                  const clusterReports = reports.filter(
                    (r) => r.asset?.park?.clusterId === cl.id
                  );
                  const clusterActiveTickets = clusterReports.filter(
                    (r) => !TERMINAL_REPORT_STATUSES.includes(r.status as ReportStatus)
                  ).length;
                  const clusterCompletedTickets = clusterReports.filter(
                    (r) => r.status === "SELESAI"
                  ).length;

                  return (
                    <div
                      key={cl.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {cl.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-bold shrink-0">
                          {activeAssetsInCluster} Aset aktif
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{totalParks} Taman</span>
                        {!cl.isActive && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                        <span className="text-amber-800 font-semibold">
                          {clusterActiveTickets} Tiket aktif
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {clusterCompletedTickets} Selesai
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aktivitas Laporan Terkini */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Aktivitas Laporan Terkini Lintas Cluster
                </h2>
                <p className="text-xs text-slate-500">
                  Pergerakan tiket perbaikan fasilitas estate
                </p>
              </div>
              <Link
                href="/dashboard/laporan"
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
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
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {r.ticketNo}
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="font-bold text-slate-900 truncate">
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
                      href={`/dashboard/laporan?q=${encodeURIComponent(r.ticketNo)}`}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline shrink-0"
                    >
                      Lihat Tiket →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Eskalasi Pergantian Vendor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Eskalasi Ganti Vendor ({escalationCount})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Diteruskan Admin untuk tinjauan Direksi
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/pengajuan-ganti-vendor?status=DITERUSKAN_KE_OWNER"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Semua ({escalationCount}) →
              </Link>
            </div>

            {recentEscalations.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                Belum ada eskalasi pergantian vendor yang diteruskan ke Owner.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {recentEscalations.map((esc) => (
                  <div
                    key={esc.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-900">
                        {esc.requestNo}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                        {esc.ownerViewedAt ? "Sudah ditinjau" : "Menunggu tinjauan"}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800">
                      {esc.asset.name}{" "}
                      <span className="font-mono text-[11px] text-slate-500">
                        ({esc.asset.code})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Vendor: {esc.vendor.name}</span>
                      <span>{formatWibDate(esc.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rapor Kinerja Mitra Vendor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Rapor Kinerja Mitra Vendor
                </h2>
                <p className="text-xs text-slate-500">
                  Total SPK, rata-rata durasi, revisi, dan garansi
                </p>
              </div>
              <Link
                href="/dashboard/vendor"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Data Vendor →
              </Link>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              {vendorSummaries.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-500">
                  Belum ada vendor rekanan terdaftar.
                </div>
              ) : (
                vendorSummaries.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-bold text-slate-900">{v.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {VENDOR_TYPE_LABEL[v.type]}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            v.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {v.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="bg-white rounded-lg border border-slate-200/80 px-1.5 py-1">
                        <div className="text-[10px] text-slate-500">SPK</div>
                        <div className="font-bold text-slate-900">{v.totalJobs}</div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200/80 px-1.5 py-1">
                        <div className="text-[10px] text-slate-500">Durasi</div>
                        <div className="font-bold text-slate-900">
                          {v.avgDurationHours}j
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200/80 px-1.5 py-1">
                        <div className="text-[10px] text-slate-500">Revisi</div>
                        <div className="font-bold text-amber-800">
                          {v.revisionCount}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200/80 px-1.5 py-1">
                        <div className="text-[10px] text-slate-500">Garansi</div>
                        <div className="font-bold text-rose-700">
                          {v.warrantyDefectsCount}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{v.technicianCount} Teknisi · {v.completedJobs} SPK selesai</span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Garansi {v.warrantyDays} hari
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Riwayat Perubahan Data */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Riwayat Perubahan Data
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Catatan perubahan data master terbaru
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/audit"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Semua Log →
              </Link>
            </div>

            <div className="space-y-2 pt-1">
              {recentAuditLogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Belum ada catatan riwayat perubahan.
                </div>
              ) : (
                recentAuditLogs.map((log) => {
                  const actionMeta = AUDIT_ACTION_META[log.action];
                  const actorRoleLabel =
                    ROLE_METADATA[log.actorRole]?.label ?? log.actorRole;
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {log.summary}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${actionMeta.badgeColor}`}
                        >
                          {actionMeta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500">
                        <span>
                          {log.actorName} ({actorRoleLabel})
                        </span>
                        <span>{formatWibDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
