"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Sofa, ArrowRight } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { mockReports } from "@/data/mock-park-data";
import { ReportStatus } from "@/types/park-asset";

type Tab = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

export default function MyReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const getStatusCategory = (
    status: ReportStatus
  ): "PENDING" | "IN_PROGRESS" | "COMPLETED" => {
    switch (status) {
      case "SELESAI":
        return "COMPLETED";
      case "DIKERJAKAN":
      case "DISETUJUI":
        return "IN_PROGRESS";
      case "BARU":
      case "MENUNGGU_KEPUTUSAN":
      default:
        return "PENDING";
    }
  };

  const filteredReports = mockReports.filter((report) => {
    const q = searchQuery.toLowerCase();
    const matchesTab =
      activeTab === "ALL" || getStatusCategory(report.status) === activeTab;
    const matchesSearch =
      report.ticketNo.toLowerCase().includes(q) ||
      report.asset.name.toLowerCase().includes(q) ||
      report.description.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const totalCount = mockReports.length;
  const activeCount = mockReports.filter((r) => {
    const c = getStatusCategory(r.status);
    return c === "PENDING" || c === "IN_PROGRESS";
  }).length;
  const completedCount = mockReports.filter(
    (r) => getStatusCategory(r.status) === "COMPLETED"
  ).length;

  const renderBadge = (status: ReportStatus) => {
    const base =
      "text-[11px] font-semibold text-white px-3 py-1 rounded-full whitespace-nowrap";
    switch (getStatusCategory(status)) {
      case "COMPLETED":
        return <span className={`${base} bg-[#1B4D3E]`}>Completed</span>;
      case "IN_PROGRESS":
        return <span className={`${base} bg-sky-500`}>In Progress</span>;
      default:
        return <span className={`${base} bg-[#F0A30A]`}>Pending</span>;
    }
  };

  return (
    <MobileContainer>
      <div className="bg-[#F6F5F0] min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-4 pt-5 pb-3 sticky top-0 z-30 bg-[#F6F5F0]">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/beranda"
              className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-800"
              aria-label="Kembali"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Laporan Saya
            </h1>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700"
              aria-label="Search reports"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {showSearch && (
            <div className="mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tiket, aset, atau deskripsi..."
                className="w-full text-xs py-2.5 px-4 rounded-full bg-white border border-slate-200 outline-none focus:border-[#1B4D3E]"
                autoFocus
              />
            </div>
          )}

          {/* Tabs (pill, horizontally scrollable) */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === tab.key
                    ? "bg-[#1B4D3E] text-white"
                    : "bg-white text-slate-700 border border-slate-100"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <main className="px-4 pb-24 pt-2 space-y-4 flex-1">
          {/* Stats */}
          <section className="bg-[#222522] text-white rounded-2xl py-4 grid grid-cols-3 divide-x divide-white/15">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold leading-none">{totalCount}</span>
              <span className="text-[10px] text-slate-400 mt-1.5">Total</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold leading-none text-amber-400">
                {activeCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-1.5">Aktif</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold leading-none text-emerald-400">
                {completedCount}
              </span>
              <span className="text-[10px] text-slate-400 mt-1.5">Selesai</span>
            </div>
          </section>

          {/* List */}
          <section className="space-y-3">
            {filteredReports.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-2xl">
                <p className="text-xs text-slate-400">
                  Tidak ada laporan pada kategori ini.
                </p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl p-3 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-[#E3EDE6] text-[#1B4D3E] flex items-center justify-center shrink-0">
                      <Sofa className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold text-[#1B4D3E] tracking-wide">
                          {report.ticketNo}
                        </span>
                        {renderBadge(report.status)}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">
                        {report.asset.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {report.asset.locationNote} • {report.createdAt}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/reports/${report.id}`}
                    className="flex items-center justify-between w-full px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-[#1B4D3E] hover:bg-slate-50"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </section>
        </main>

        <BottomNav />
      </div>
    </MobileContainer>
  );
}