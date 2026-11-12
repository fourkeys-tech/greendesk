"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  Armchair,
  ArrowRight,
  Plus,
  Archive,
} from "lucide-react";
import type { Priority, ReportStatus } from "@/lib/db-types";
import { STATUS_METADATA } from "@/lib/permissions";
import { sanitizeMediaHref } from "@/lib/url-safety";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { CancelReportButton } from "@/app/dashboard/laporan/cancel-report-button";

export interface CitizenReportItem {
  id: string;
  ticketNo: string;
  status: ReportStatus;
  priority: Priority | null;
  description: string;
  reason: string | null;
  createdAtLabel: string;
  assetCode: string;
  assetName: string;
  assetLocationNote: string | null;
  parkName: string;
  clusterName: string;
  photoUrl: string | null;
  spkNo: string | null;
  parentTicketNo: string | null;
}

type StatusCategory = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
type Tab = "ALL" | StatusCategory;

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu" },
  { key: "IN_PROGRESS", label: "Diproses" },
  { key: "COMPLETED", label: "Selesai" },
  { key: "CLOSED", label: "Ditutup" },
];

function getStatusCategory(status: ReportStatus): StatusCategory {
  switch (status) {
    case "SELESAI":
      return "COMPLETED";
    case "DISETUJUI":
    case "DIKERJAKAN":
    case "MENUNGGU_KONFIRMASI":
      return "IN_PROGRESS";
    case "DITOLAK":
    case "TIDAK_VALID":
    case "DIBATALKAN":
    case "DIGABUNG":
      return "CLOSED";
    case "BARU":
    case "MENUNGGU_KEPUTUSAN":
    default:
      return "PENDING";
  }
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const cat = getStatusCategory(status);
  const label = STATUS_METADATA[status]?.label ?? status;
  const cls =
    cat === "COMPLETED"
      ? "bg-[#1B4D3E] text-white"
      : cat === "IN_PROGRESS"
        ? "bg-sky-500 text-white"
        : cat === "CLOSED"
          ? "bg-rose-600 text-white"
          : "bg-[#F0A30A] text-white";

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function AssetThumb({
  photoUrl,
  assetName,
  className,
}: {
  photoUrl: string | null;
  assetName: string;
  className: string;
}) {
  const safeUrl = sanitizeMediaHref(photoUrl);
  if (safeUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeUrl}
        alt={assetName}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-[#E3EDE6] text-[#1B4D3E] ${className}`}
    >
      <Armchair className="h-6 w-6" />
    </div>
  );
}

function StatsBar({
  stats,
  large = false,
}: {
  stats: { total: number; active: number; completed: number };
  large?: boolean;
}) {
  const items = [
    { label: "Total", value: stats.total, color: "" },
    { label: "Aktif", value: stats.active, color: "text-amber-300" },
    { label: "Selesai", value: stats.completed, color: "text-emerald-300" },
  ];

  return (
    <section
      className={`grid grid-cols-3 divide-x divide-white/15 bg-[#222522] text-white ${
        large ? "rounded-3xl py-6" : "rounded-2xl py-4"
      }`}
    >
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex flex-col items-center">
          <span
            className={`font-bold leading-none ${large ? "text-3xl" : "text-xl"} ${color}`}
          >
            {value}
          </span>
          <span
            className={`text-slate-300 ${large ? "mt-2 text-xs" : "mt-1.5 text-[10px]"}`}
          >
            {label}
          </span>
        </div>
      ))}
    </section>
  );
}

function ReportTabs({
  activeTab,
  setActiveTab,
  className = "",
  tabClassName = "",
}: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  className?: string;
  tabClassName?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActiveTab(tab.key)}
          className={`shrink-0 whitespace-nowrap rounded-full text-xs font-semibold transition-all cursor-pointer ${tabClassName} ${
            activeTab === tab.key
              ? "bg-[#1B4D3E] text-white"
              : "border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ReportCard({
  report,
  variant,
}: {
  report: CitizenReportItem;
  variant: "mobile" | "desktop";
}) {
  const isMobile = variant === "mobile";
  const detailHref = `/status/${encodeURIComponent(report.ticketNo)}`;

  return (
    <div
      className={`rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] border border-slate-200/60 ${
        isMobile ? "p-3.5 space-y-3" : "p-4 space-y-3"
      }`}
    >
      <div className="flex items-start gap-3">
        <AssetThumb
          photoUrl={report.photoUrl}
          assetName={report.assetName}
          className={isMobile ? "h-14 w-14 rounded-xl" : "h-12 w-12 rounded-xl"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] font-bold tracking-wide text-[#1B4D3E]">
              {report.ticketNo}
            </span>
            <StatusBadge status={report.status} />
          </div>
          <h3 className="mt-0.5 truncate text-sm font-bold leading-tight text-slate-900">
            {report.assetName}{" "}
            <span className="font-mono text-[11px] font-medium text-slate-400">
              ({report.assetCode})
            </span>
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {report.assetLocationNote || report.parkName} • {report.createdAtLabel}
          </p>
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-700">
            {report.description}
          </p>
          {report.reason && (
            <p className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900">
              <strong>Catatan:</strong> {report.reason}
            </p>
          )}
          {report.status === "DIGABUNG" && report.parentTicketNo && (
            <p className="mt-1.5 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-[11px] text-purple-900">
              Digabung ke tiket induk{" "}
              <strong className="font-mono">{report.parentTicketNo}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        {report.status === "BARU" ? (
          <CancelReportButton reportId={report.id} />
        ) : (
          <span className="text-[11px] text-slate-400">
            {report.spkNo ? `SPK: ${report.spkNo}` : report.clusterName}
          </span>
        )}
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-[#1B4D3E] hover:bg-slate-50 transition-colors"
        >
          <span>Lihat Detail</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function CitizenReportsClient({
  reports,
  showArchived,
  initialQuery = "",
  dbError = false,
}: {
  reports: CitizenReportItem[];
  showArchived: boolean;
  initialQuery?: string;
  dbError?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [showMobileSearch, setShowMobileSearch] = useState(Boolean(initialQuery));

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      const tabOk =
        activeTab === "ALL" || getStatusCategory(r.status) === activeTab;
      if (!tabOk) return false;
      if (!q) return true;
      return (
        r.ticketNo.toLowerCase().includes(q) ||
        r.assetName.toLowerCase().includes(q) ||
        r.assetCode.toLowerCase().includes(q) ||
        r.parkName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [reports, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const completed = reports.filter((r) => r.status === "SELESAI").length;
    const closed = reports.filter(
      (r) => getStatusCategory(r.status) === "CLOSED"
    ).length;
    return {
      total: reports.length,
      completed,
      active: Math.max(0, reports.length - completed - closed),
    };
  }, [reports]);

  const archiveHref = showArchived
    ? "/beranda/laporan"
    : "/beranda/laporan?arsip=1";

  return (
    <>
      {/* ===== MOBILE (< md) ===== */}
      <div className="md:hidden">
        <MobileContainer className="bg-[#F6F5F0] pb-28">
          <header className="sticky top-0 z-30 bg-[#F6F5F0] px-4 pb-3 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <Link
                href="/beranda"
                aria-label="Kembali ke Beranda"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                {showArchived ? "Arsip Laporan Saya" : "Laporan Saya"}
              </h1>
              <button
                type="button"
                onClick={() => setShowMobileSearch((v) => !v)}
                aria-label="Cari laporan"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {showMobileSearch && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tiket, aset, atau deskripsi..."
                className="mb-3 w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#1B4D3E]"
              />
            )}

            <ReportTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              tabClassName="px-4 py-1.5"
            />
          </header>

          <main className="flex-1 space-y-4 px-4 pt-2">
            {dbError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                Koneksi basis data sedang bermasalah. Silakan muat ulang halaman.
              </div>
            )}

            <StatsBar stats={stats} />

            <div className="flex items-center justify-between gap-2">
              <Link
                href="/beranda/lapor"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1B4D3E] px-4 py-2 text-xs font-bold text-white shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Buat Laporan</span>
              </Link>
              <Link
                href={archiveHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
              >
                <Archive className="h-3.5 w-3.5 text-slate-500" />
                <span>{showArchived ? "Laporan Aktif" : "Lihat Arsip"}</span>
              </Link>
            </div>

            <section className="space-y-3">
              {filteredReports.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center border border-slate-200/70">
                  <p className="text-xs font-semibold text-slate-600">
                    Tidak ada laporan pada kategori ini.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Gunakan tombol Scan QR atau Buat Laporan untuk melaporkan kerusakan fasilitas taman.
                  </p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <ReportCard key={report.id} report={report} variant="mobile" />
                ))
              )}
            </section>
          </main>
        </MobileContainer>
      </div>

      {/* ===== DESKTOP / TABLET (>= md) ===== */}
      <div className="hidden min-h-screen flex-col bg-[#F6F5F0] md:flex">
        <div className="relative flex-1 overflow-hidden">
          <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 pb-36 pt-8">
            <header className="relative flex items-center justify-between py-2">
              <Link
                href="/beranda"
                aria-label="Kembali ke Beranda"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {showArchived ? "Arsip Laporan Saya" : "Laporan Saya"}
              </h1>
              <div className="flex items-center gap-2">
                <Link
                  href={archiveHref}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Archive className="h-3.5 w-3.5 text-slate-500" />
                  <span>{showArchived ? "Laporan Aktif" : "Arsip"}</span>
                </Link>
                <Link
                  href="/beranda/lapor"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1B4D3E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#154a36]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Buat Laporan</span>
                </Link>
              </div>
            </header>

            {dbError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                Koneksi basis data sedang bermasalah. Silakan muat ulang halaman.
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <ReportTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                tabClassName="px-6 py-1.5"
              />

              <div className="relative w-64 shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari tiket, aset, atau deskripsi..."
                  aria-label="Cari laporan"
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-4 pr-9 text-xs outline-none transition-colors focus:border-[#1B4D3E]"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <StatsBar stats={stats} large />

            {filteredReports.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-slate-200/60">
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada laporan ditemukan
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Coba ubah kata kunci pencarian, pilih tab kategori lain, atau buat laporan baru.
                </p>
              </div>
            ) : (
              <section className="grid grid-cols-2 gap-4">
                {filteredReports.map((report) => (
                  <ReportCard key={report.id} report={report} variant="desktop" />
                ))}
              </section>
            )}
          </div>

          <img
            src="/assets/LeafButton.svg"
            alt=""
            aria-hidden
            className="pointer-events-none select-none absolute -bottom-6 -left-6 z-0 w-56 object-contain -scale-x-100"
          />
          <img
            src="/assets/LeafButton.svg"
            alt=""
            aria-hidden
            className="pointer-events-none select-none absolute -bottom-6 -right-6 z-0 w-56 object-contain"
          />
        </div>

        <footer className="relative z-10 flex items-center justify-between bg-[#0a1f15] px-8 pt-4 pb-24 text-xs text-white lg:px-12">
          <span className="font-bold">GreenDesk</span>
          <span className="text-white/60">
            Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
          </span>
        </footer>
      </div>

      <BottomNav isLoggedIn userRole="PENGGUNA" />
    </>
  );
}
