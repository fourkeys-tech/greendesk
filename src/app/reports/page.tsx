"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Sofa, ArrowRight } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { mockReports } from "@/data/mock-park-data";
import { ReportStatus } from "@/types/park-asset";

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type StatusCategory = "PENDING" | "IN_PROGRESS" | "COMPLETED";
type Tab = "ALL" | StatusCategory;
type Report = (typeof mockReports)[number];

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

const BADGE_STYLES: Record<StatusCategory, { label: string; className: string }> = {
  COMPLETED: { label: "Completed", className: "bg-[#1B4D3E]" },
  IN_PROGRESS: { label: "In Progress", className: "bg-sky-500" },
  PENDING: { label: "Pending", className: "bg-[#F0A30A]" },
};

const ASSETS = {
  leafButton: "/assets/LeafButton.svg",
} as const;

const SEARCH_PLACEHOLDER = "Cari tiket, aset, atau deskripsi...";

/* -------------------------------------------------------------------------- */
/* Domain logic                                                               */
/* -------------------------------------------------------------------------- */

function getStatusCategory(status: ReportStatus): StatusCategory {
  switch (status) {
    case "SELESAI":
      return "COMPLETED";
    case "DIKERJAKAN":
    case "DISETUJUI":
      return "IN_PROGRESS";
    default:
      return "PENDING";
  }
}

function matchesQuery(report: Report, query: string) {
  const q = query.toLowerCase();
  return (
    report.ticketNo.toLowerCase().includes(q) ||
    report.asset.name.toLowerCase().includes(q) ||
    report.description.toLowerCase().includes(q)
  );
}

function useReportFilters() {
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReports = useMemo(
    () =>
      mockReports.filter(
        (report) =>
          (activeTab === "ALL" || getStatusCategory(report.status) === activeTab) &&
          matchesQuery(report, searchQuery)
      ),
    [activeTab, searchQuery]
  );

  const stats = useMemo(() => {
    const completed = mockReports.filter(
      (r) => getStatusCategory(r.status) === "COMPLETED"
    ).length;
    return {
      total: mockReports.length,
      completed,
      active: mockReports.length - completed,
    };
  }, []);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredReports,
    stats,
  };
}

type Filters = ReturnType<typeof useReportFilters>;

/* -------------------------------------------------------------------------- */
/* Shared components                                                          */
/* -------------------------------------------------------------------------- */

/** Purely decorative image: hidden from assistive tech and not interactive. */
function Decor({ src, className = "" }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
    />
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, className } = BADGE_STYLES[getStatusCategory(status)];
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold text-white ${className}`}
    >
      {label}
    </span>
  );
}

function AssetIcon({ className }: { className: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-[#E3EDE6] text-[#1B4D3E] ${className}`}
    >
      <Sofa className="h-6 w-6" />
    </div>
  );
}

/** Dark summary bar (Total / Aktif / Selesai). `large` is the desktop size. */
function StatsBar({
  stats,
  large = false,
}: Pick<Filters, "stats"> & { large?: boolean }) {
  const items = [
    { label: "Total", value: stats.total, color: "" },
    { label: "Aktif", value: stats.active, color: "text-amber-300" },
    { label: "Selesai", value: stats.completed, color: "text-emerald-300" },
  ];

  return (
    <section
      className={`grid grid-cols-3 divide-x divide-white/15 bg-[#222522] text-white ${large ? "rounded-3xl py-6" : "rounded-2xl py-4"
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

/** Pill-shaped tab list. `className` controls sizing per breakpoint. */
function ReportTabs({
  activeTab,
  setActiveTab,
  className = "",
  tabClassName = "",
}: Pick<Filters, "activeTab" | "setActiveTab"> & {
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
          className={`shrink-0 whitespace-nowrap rounded-full text-xs font-semibold transition-all ${tabClassName} ${activeTab === tab.key
            ? "bg-[#1B4D3E] text-white"
            : "border border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                     */
/* -------------------------------------------------------------------------- */

function MobileReportCard({ report }: { report: Report }) {
  return (
    <div className="space-y-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <AssetIcon className="h-14 w-14 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wide text-[#1B4D3E]">
              {report.ticketNo}
            </span>
            <StatusBadge status={report.status} />
          </div>
          <h3 className="mt-0.5 text-sm font-bold leading-tight text-slate-900">
            {report.asset.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {report.asset.locationNote} • {report.createdAt}
          </p>
        </div>
      </div>

      <Link
        href={`/reports/${report.id}`}
        className="flex w-full items-center justify-between rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-[#1B4D3E] hover:bg-slate-50"
      >
        <span>View Details</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function MobileReports({ filters }: { filters: Filters }) {
  const [showSearch, setShowSearch] = useState(false);
  const { activeTab, setActiveTab, searchQuery, setSearchQuery, filteredReports, stats } =
    filters;

  return (
    <MobileContainer>
      <div className="flex min-h-screen flex-col bg-[#F6F5F0]">
        <header className="sticky top-0 z-30 bg-[#F6F5F0] px-4 pb-3 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/beranda"
              aria-label="Kembali"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Laporan Saya
            </h1>
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Search reports"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {showSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className="mb-3 w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#1B4D3E]"
              autoFocus
            />
          )}

          <ReportTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabClassName="px-4 py-1.5"
          />
        </header>

        <main className="flex-1 space-y-4 px-4 pb-24 pt-2">
          <StatsBar stats={stats} />

          <section className="space-y-3">
            {filteredReports.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center">
                <p className="text-xs text-slate-400">
                  Tidak ada laporan pada kategori ini.
                </p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <MobileReportCard key={report.id} report={report} />
              ))
            )}
          </section>
        </main>

        <BottomNav />
      </div>
    </MobileContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop / tablet                                                           */
/* -------------------------------------------------------------------------- */

function DesktopHeader() {
  return (
    <header className="relative flex items-center justify-center py-2">
      <Link
        href="/beranda"
        aria-label="Kembali"
        className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Laporan Saya</h1>
    </header>
  );
}

function DesktopToolbar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
}: Filters) {
  return (
    <div className="flex items-center justify-between gap-4">
      <ReportTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabClassName="px-9 py-1.5"
      />

      <div className="relative w-64 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="Cari laporan"
          className="w-full rounded-full border border-slate-100 bg-white py-1.5 pl-4 pr-9 text-xs outline-none transition-colors focus:border-[#1B4D3E]"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function DesktopReportCard({ report }: { report: Report }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <AssetIcon className="h-11 w-11 rounded-lg" />
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold tracking-wide text-slate-900">
            {report.ticketNo}
          </span>
          <h3 className="truncate text-xs font-bold leading-tight text-slate-900">
            {report.asset.name}
          </h3>
          <p className="truncate text-[10px] text-slate-400">
            {report.asset.locationNote} • {report.createdAt}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <Link
        href={`/reports/${report.id}`}
        className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-semibold text-[#1B4D3E] hover:underline"
      >
        <span>View Details</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DesktopEmptyState() {
  return (
    <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Tidak ada laporan ditemukan</p>
      <p className="mt-1 text-xs text-slate-400">
        Coba ubah kata kunci pencarian atau pilih tab kategori lain.
      </p>
    </div>
  );
}

function DesktopFooter() {
  return (
    <footer className="relative z-10 flex items-center justify-between bg-[#0a1f15] px-8 py-4 text-xs text-white lg:px-12">
      <span className="font-bold">GreenDesk</span>
      <span className="text-white/60">
        Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
      </span>
    </footer>
  );
}

function DesktopReports({ filters }: { filters: Filters }) {
  const { filteredReports, stats } = filters;

  return (
    <div className="hidden min-h-screen flex-col bg-[#F6F5F0] md:flex">
      <div className="relative flex-1 overflow-hidden">
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 pb-40 pt-8">
          <DesktopHeader />
          <DesktopToolbar {...filters} />
          <StatsBar stats={stats} large />

          {filteredReports.length === 0 ? (
            <DesktopEmptyState />
          ) : (
            <section className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {filteredReports.map((report) => (
                <DesktopReportCard key={report.id} report={report} />
              ))}
            </section>
          )}
        </div>

        <Decor
          src={ASSETS.leafButton}
          className="absolute -bottom-6 -left-6 z-0 w-56 object-contain -scale-x-100"
        />
        <Decor
          src={ASSETS.leafButton}
          className="absolute -bottom-6 -right-6 z-0 w-56  object-contain"
        />
      </div>

      <DesktopFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function MyReportsPage() {
  const filters = useReportFilters();

  return (
    <>
      <MobileReports filters={filters} />
      <DesktopReports filters={filters} />
    </>
  );
}