import React from "react";
import Link from "next/link";
import type { AuditAction, Role } from "@/lib/db-types";
import {
  Layers,
  Building2,
  Users,
  History,
  QrCode,
  Shield,
  ArrowRight,
  Eye,
  FolderTree,
  Calendar,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import type { SessionPayload } from "@/lib/auth";
import { AUDIT_ACTION_META } from "@/lib/audit-labels";
import { ROLE_METADATA } from "@/lib/permissions";
import { formatWibDate, formatWibDateTime } from "@/lib/dates";
import {
  PendingTechniciansCard,
  type PendingTechnicianItem,
} from "@/components/dashboard/admin/pending-technicians-card";

export interface AdminDashboardProps {
  session: SessionPayload;
  reports: any[];
  assetCount: number;
  auditCount: number;
  vendorCount: number;
  technicianCount: number;
  pendingTechnicians: PendingTechnicianItem[];
  pendingTechTotalCount: number;
  pendingReplacementForwardCount: number;
  hierarchyStats: {
    complexCount: number;
    clusterCount: number;
    parkCount: number;
    activeAssetCount: number;
    inactiveAssetCount: number;
    categoryCount: number;
  };
  staffStats: {
    pengelolaCount: number;
    managerCount: number;
    activeTempAssignments: Array<{
      id: string;
      validUntil: Date | null;
      user: { name: string };
      cluster: { name: string };
    }>;
    blockedUsersCount: number;
    reviewReportersCount: number;
  };
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

export function AdminDashboard({
  session,
  reports,
  assetCount,
  auditCount,
  vendorCount,
  technicianCount,
  pendingTechnicians,
  pendingTechTotalCount,
  pendingReplacementForwardCount,
  hierarchyStats,
  staffStats,
  recentAuditLogs,
}: AdminDashboardProps) {
  const baruCount = reports.filter((r) => r.status === "BARU").length;
  const verifikasiCount = reports.filter((r) => r.status === "MENUNGGU_KEPUTUSAN").length;
  const pengerjaanCount = reports.filter(
    (r) => r.status === "DISETUJUI" || r.status === "DIKERJAKAN" || r.status === "MENUNGGU_KONFIRMASI"
  ).length;
  const selesaiCount = reports.filter((r) => r.status === "SELESAI").length;
  const tidakValidCount = reports.filter((r) => r.status === "TIDAK_VALID" || r.status === "DITOLAK").length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${ROLE_METADATA.ADMIN.badgeColor}`}
            >
              {ROLE_METADATA.ADMIN.label}
            </span>
            {session.companyName && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {session.companyName}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Pusat Pengelolaan Master Data &amp; Operasional
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Kelola hierarki kawasan 5 tingkat, kode aset &amp; QR, persetujuan teknisi rekanan, dan akun staf internal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Layers className="w-4 h-4" />
            <span>Kelola Wilayah &amp; QR</span>
          </Link>
          <Link
            href="/dashboard/wilayah/cetak-qr"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition"
          >
            <QrCode className="w-4 h-4 text-emerald-700" />
            <span>Cetak QR Aset</span>
          </Link>
        </div>
      </div>

      {/* 2. Persetujuan Teknisi Rekanan */}
      <PendingTechniciansCard
        technicians={pendingTechnicians}
        totalCount={pendingTechTotalCount}
      />

      {/* 2b. Pengajuan Ganti Vendor Menunggu Diteruskan */}
      {pendingReplacementForwardCount > 0 && (
        <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-300 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-200 text-sky-800 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">
                {pendingReplacementForwardCount} pengajuan pergantian vendor telah disetujui Manager
              </span>{" "}
              dan menunggu Anda teruskan ke Owner / Direksi.
            </div>
          </div>
          <Link
            href="/dashboard/pengajuan-ganti-vendor?status=DISETUJUI"
            className="text-[11px] font-bold text-sky-900 hover:underline px-2.5 py-1 rounded-lg bg-sky-200/70 shrink-0"
          >
            Tinjau &amp; Teruskan →
          </Link>
        </div>
      )}

      {/* 3. Delegasi Manager Sementara */}
      {staffStats.activeTempAssignments.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-200 text-amber-800 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Penunjukan Manager Pengganti Sementara Sedang Aktif:</span>{" "}
              {staffStats.activeTempAssignments.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <strong>{a.user.name}</strong> di cluster <strong>{a.cluster.name}</strong> (berlaku s/d{" "}
                  {a.validUntil ? formatWibDate(a.validUntil) : "selesai"})
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/dashboard/penanggung-jawab?tab=manager&view=delegasi"
            className="text-[11px] font-bold text-amber-900 hover:underline px-2.5 py-1 rounded-lg bg-amber-200/70 shrink-0"
          >
            Kelola Delegasi →
          </Link>
        </div>
      )}

      {/* 4. Grid Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Hierarki Wilayah 5 Tingkat</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <FolderTree className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-900">{hierarchyStats.parkCount}</div>
            <span className="text-xs text-slate-500 font-medium">Taman Terdaftar</span>
          </div>
          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span>{hierarchyStats.complexCount} Komplek</span>
            <span>·</span>
            <span>{hierarchyStats.clusterCount} Cluster</span>
            <span>·</span>
            <span>{hierarchyStats.categoryCount} Kategori</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Aset &amp; Kode QR</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-900">{assetCount}</div>
            <span className="text-xs text-emerald-700 font-bold">{hierarchyStats.activeAssetCount} Aktif</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Nonaktif: {hierarchyStats.inactiveAssetCount} aset</span>
            <span className="text-emerald-700 font-semibold">QR Otomatis</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Staf Operasional Internal</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-900">
              {staffStats.pengelolaCount + staffStats.managerCount}
            </div>
            <span className="text-xs text-slate-500 font-medium">Akun Staf</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-100">
            <span>{staffStats.pengelolaCount} Pengelola</span>
            <span>·</span>
            <span>{staffStats.managerCount} Manager</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Kemitraan Vendor</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-900">{vendorCount}</div>
            <span className="text-xs text-slate-500 font-medium">Vendor Rekanan</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{technicianCount} Teknisi Terdaftar</span>
            <span className="text-slate-700 font-semibold">{pendingTechTotalCount} Menunggu</span>
          </div>
        </div>
      </div>

      {/* 5. Dua Kolom Utama */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Status Tiket Laporan Perusahaan
                </h2>
                <p className="text-xs text-slate-500">
                  Total {reports.length} laporan di seluruh cluster (hanya pantau)
                </p>
              </div>
              <Link
                href="/dashboard/laporan"
                className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200/80">
                <div className="text-slate-500 text-[11px]">Laporan Baru</div>
                <div className="text-xl font-bold text-sky-800 mt-1">{baruCount}</div>
                <div className="text-[10px] text-sky-600 mt-0.5">Antrean Verifikasi</div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80">
                <div className="text-slate-500 text-[11px]">Valid (Keputusan)</div>
                <div className="text-xl font-bold text-indigo-800 mt-1">{verifikasiCount}</div>
                <div className="text-[10px] text-indigo-600 mt-0.5">Menunggu SPK</div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80">
                <div className="text-slate-500 text-[11px]">Dikerjakan Vendor</div>
                <div className="text-xl font-bold text-amber-800 mt-1">{pengerjaanCount}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">SPK Aktif / Konfirmasi</div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80">
                <div className="text-slate-500 text-[11px]">Selesai Perbaikan</div>
                <div className="text-xl font-bold text-emerald-800 mt-1">{selesaiCount}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Tuntas Terverifikasi</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Batas Wewenang Admin:</strong> Admin tidak dapat memverifikasi laporan atau menerbitkan SPK. Tugas operasional berada di Pengelola dan Manager.
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Keamanan Akun &amp; Pengawasan Pelapor
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tinjau pelapor dengan laporan tidak valid berulang dan kelola blokir akun.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/akun?tab=pelapor"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Kelola Pelapor →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2">
                <div>
                  <div className="text-slate-500 text-[11px]">Akun Diblokir</div>
                  <div className="text-lg font-bold text-rose-700 mt-0.5">
                    {staffStats.blockedUsersCount} Akun
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                  Diblokir
                </span>
              </div>

              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-2">
                <div>
                  <div className="text-amber-800 text-[11px]">Perlu Ditinjau</div>
                  <div className="text-lg font-bold text-amber-900 mt-0.5">
                    {staffStats.reviewReportersCount} Akun
                  </div>
                </div>
                <Link
                  href="/dashboard/akun?tab=pelapor"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold hover:underline"
                >
                  Tinjau
                </Link>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2">
                <div>
                  <div className="text-slate-500 text-[11px]">Ditolak / Tidak Valid</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    {tidakValidCount} Tiket
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  Tercatat
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
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
                    Total {auditCount} catatan permanen
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/audit"
                className="text-xs font-semibold text-emerald-700 hover:underline shrink-0"
              >
                Selengkapnya →
              </Link>
            </div>

            <div className="space-y-2 pt-1">
              {recentAuditLogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Belum ada aktivitas perubahan data master.
                </div>
              ) : (
                recentAuditLogs.map((log) => {
                  const actionMeta = AUDIT_ACTION_META[log.action];
                  const actorRoleLabel = ROLE_METADATA[log.actorRole]?.label ?? log.actorRole;
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
                          Oleh <strong>{log.actorName}</strong> ({actorRoleLabel})
                        </span>
                        <span>{formatWibDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Modul Kerja Administrasi
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Link
                href="/dashboard/wilayah"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Master Wilayah</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Komplek, Cluster, Taman &amp; Aset.
                </p>
              </Link>

              <Link
                href="/dashboard/wilayah/cetak-qr"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cetak Label QR</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Format stiker siap tempel.
                </p>
              </Link>

              <Link
                href="/dashboard/vendor"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Vendor &amp; Teknisi</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Kontrak, garansi &amp; persetujuan teknisi.
                </p>
              </Link>

              <Link
                href="/dashboard/akun"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Akun &amp; Blokir</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pengelola, Manager, Pelapor &amp; Delegasi.
                </p>
              </Link>

              <Link
                href="/dashboard/pengajuan-ganti-vendor"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center justify-between gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ganti Vendor</span>
                  </span>
                  {pendingReplacementForwardCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                      {pendingReplacementForwardCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Teruskan eskalasi ke Owner.
                </p>
              </Link>

              <Link
                href="/dashboard/audit"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <History className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Riwayat Perubahan</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Log perubahan data permanen.
                </p>
              </Link>

              <Link
                href="/dashboard/laporan"
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition group sm:col-span-2"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-emerald-900">
                  <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pantau Laporan Seluruh Cluster</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lihat semua tiket kerusakan fasilitas lintas cluster.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
