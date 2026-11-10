"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  ShieldCheck,
  Clock,
  ExternalLink,
  AlertTriangle,
  FileText,
  User,
  Download,
} from "lucide-react";
import { STATUS_METADATA } from "@/lib/permissions";
import { ArchiveReportButton } from "./archive-button";
import { CancelReportButton } from "./cancel-report-button";
import { PengelolaVerificationPanel } from "./pengelola-verification-panel";
import { ManagerDecisionPanel } from "./manager-decision-panel";
import { ManagerConfirmationPanel } from "./manager-confirmation-panel";
import { PicAssignPanel } from "./pic-assign-panel";
import { TechnicianSubmitPanel } from "./technician-submit-panel";
import type { Role, ReportStatus } from "@prisma/client";

interface LaporanClientBoardProps {
  reports: any[];
  role: Role;
  canArchive: boolean;
  canVerify: boolean;
  isManager: boolean;
  allVendorsWithAreas: Array<{
    id: string;
    name: string;
    warrantyDays: number;
    serviceAreas: Array<{ clusterId: string }>;
  }>;
  picTechnicians: Array<{ id: string; fullName: string }>;
}

type FilterTab = "ALL" | "ACTION_NEEDED" | "WARRANTY" | "CLOSED";

export function LaporanClientBoard({
  reports,
  role,
  canArchive,
  canVerify,
  isManager,
  allVendorsWithAreas,
  picTechnicians,
}: LaporanClientBoardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Counts for KPIs & Tabs
  const totalCount = reports.length;
  const highPriorityCount = reports.filter((r) => r.priority === "TINGGI").length;
  const warrantyCount = reports.filter(
    (r) => "underWarrantyOfVendor" in r && Boolean(r.underWarrantyOfVendor)
  ).length;
  const selesaiCount = reports.filter((r) => r.status === "SELESAI").length;

  const actionNeededCount = useMemo(() => {
    return reports.filter((r) => {
      if (role === "PENGELOLA") return r.status === "BARU";
      if (role === "MANAGER")
        return (
          r.status === "MENUNGGU_KEPUTUSAN" ||
          r.status === "MENUNGGU_KONFIRMASI"
        );
      if (role === "PIC_VENDOR") return r.status === "DISETUJUI";
      if (role === "TEKNISI") return r.status === "DIKERJAKAN";
      return r.priority === "TINGGI" && r.status !== "SELESAI";
    }).length;
  }, [reports, role]);

  const closedCount = useMemo(() => {
    return reports.filter((r) =>
      ["SELESAI", "DITOLAK", "TIDAK_VALID", "DIBATALKAN", "DIGABUNG"].includes(
        r.status
      )
    ).length;
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // 1. Tab Filter
      if (activeTab === "ACTION_NEEDED") {
        if (role === "PENGELOLA" && r.status !== "BARU") return false;
        if (
          role === "MANAGER" &&
          r.status !== "MENUNGGU_KEPUTUSAN" &&
          r.status !== "MENUNGGU_KONFIRMASI"
        )
          return false;
        if (role === "PIC_VENDOR" && r.status !== "DISETUJUI") return false;
        if (role === "TEKNISI" && r.status !== "DIKERJAKAN") return false;
        if (
          !["PENGELOLA", "MANAGER", "PIC_VENDOR", "TEKNISI"].includes(role) &&
          (r.priority !== "TINGGI" || r.status === "SELESAI")
        )
          return false;
      } else if (activeTab === "WARRANTY") {
        if (!("underWarrantyOfVendor" in r && r.underWarrantyOfVendor))
          return false;
      } else if (activeTab === "CLOSED") {
        if (
          ![
            "SELESAI",
            "DITOLAK",
            "TIDAK_VALID",
            "DIBATALKAN",
            "DIGABUNG",
          ].includes(r.status)
        )
          return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ticketMatch = r.ticketNo?.toLowerCase().includes(q);
        const assetMatch =
          r.asset?.name?.toLowerCase().includes(q) ||
          r.asset?.code?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        const reporterMatch =
          "reporter" in r &&
          r.reporter &&
          (r.reporter.name?.toLowerCase().includes(q) ||
            r.reporter.email?.toLowerCase().includes(q));
        const spkMatch = r.workOrder?.spkNo?.toLowerCase().includes(q);

        if (
          !ticketMatch &&
          !assetMatch &&
          !descMatch &&
          !reporterMatch &&
          !spkMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [reports, activeTab, searchQuery, role]);

  function getLeftAccentBarColor(status: ReportStatus) {
    switch (status) {
      case "BARU":
        return "bg-sky-500";
      case "MENUNGGU_KEPUTUSAN":
        return "bg-indigo-500";
      case "DISETUJUI":
      case "DIKERJAKAN":
        return "bg-amber-500";
      case "MENUNGGU_KONFIRMASI":
        return "bg-teal-500";
      case "SELESAI":
        return "bg-emerald-500";
      case "DITOLAK":
      case "TIDAK_VALID":
      case "DIBATALKAN":
        return "bg-rose-400";
      case "DIGABUNG":
        return "bg-purple-500";
      default:
        return "bg-slate-400";
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Quick Stats / Metric Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Total Tiket Masuk
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {totalCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            ALL
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-200/80 p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-rose-700">
              Prioritas Tinggi
            </p>
            <p className="text-2xl font-extrabold text-rose-600 mt-0.5">
              {highPriorityCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold text-xs">
            P1
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-amber-800">
              Tercover Garansi
            </p>
            <p className="text-2xl font-extrabold text-amber-600 mt-0.5">
              {warrantyCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-semibold text-emerald-800">
              Status Selesai
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
              {selesaiCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-xs">
            OK
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold"
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab("ACTION_NEEDED")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ACTION_NEEDED"
                ? "bg-slate-900 text-white font-bold shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Butuh Tindakan ({actionNeededCount})</span>
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab("WARRANTY")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "WARRANTY"
                ? "bg-slate-900 text-white font-bold shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Dalam Garansi Vendor ({warrantyCount})</span>
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab("CLOSED")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === "CLOSED"
                ? "bg-slate-900 text-white font-bold shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700"
            }`}
          >
            Selesai / Ditolak ({closedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            suppressHydrationWarning
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor tiket, aset, atau pelapor..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* 3. Ticket Cards List */}
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Tidak ada laporan yang cocok dengan filter atau pencarian saat ini.
          </div>
        ) : (
          filteredReports.map((report) => {
            const daysInStage = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(report.stageEnteredAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            const isTechnicianOrPic = role === "TEKNISI" || role === "PIC_VENDOR";
            const reporter =
              !isTechnicianOrPic && "reporter" in report && report.reporter
                ? (report.reporter as { name: string; email: string })
                : null;
            const warrantyVendor =
              "underWarrantyOfVendor" in report
                ? (report.underWarrantyOfVendor as { name: string } | null)
                : null;
            const parentReport =
              "parentReport" in report
                ? (report.parentReport as {
                    ticketNo: string;
                    status: string;
                  } | null)
                : null;
            const mergedChildren =
              "mergedChildReports" in report
                ? (report.mergedChildReports as Array<{
                    id: string;
                    ticketNo: string;
                  }>)
                : [];

            const candidateParents = reports
              .filter(
                (r) =>
                  r.id !== report.id &&
                  r.asset.code === report.asset.code &&
                  r.status !== "DIGABUNG" &&
                  r.status !== "TIDAK_VALID" &&
                  r.status !== "DIBATALKAN"
              )
              .map((r) => ({
                id: r.id,
                ticketNo: r.ticketNo,
                status: r.status,
                description: r.description,
              }));

            const meta = STATUS_METADATA[report.status as ReportStatus];
            const accentBarColor = getLeftAccentBarColor(
              report.status as ReportStatus
            );

            const reportClusterId =
              "asset" in report &&
              "park" in report.asset &&
              "clusterId" in (report.asset.park as any)
                ? (report.asset.park as any).clusterId
                : "";

            const eligibleVendorsForThisReport = allVendorsWithAreas.filter(
              (v) =>
                !reportClusterId ||
                v.serviceAreas.some((sa) => sa.clusterId === reportClusterId)
            );

            const reporterInitials = reporter?.name
              ? reporter.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()
              : "WP";

            return (
              <article
                key={report.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden relative"
              >
                {/* Left Vertical Status Indicator Bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBarColor}`}
                />

                <div className="p-5 sm:p-6 pl-6 sm:pl-7 space-y-4">
                  {/* Top Bar: Ticket Meta, Badges & Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Ticket Number Pill */}
                      <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-slate-900 text-white tracking-wide shadow-2xs">
                        {report.ticketNo}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${meta.badgeColor}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {meta.label}
                      </span>

                      {/* Priority Badge */}
                      {report.priority && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${
                            report.priority === "TINGGI"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : report.priority === "NORMAL"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          Prioritas: {report.priority}
                        </span>
                      )}

                      {/* Warranty Tag */}
                      {warrantyVendor && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300/80">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Garansi Vendor ({warrantyVendor.name})
                          </span>
                        </span>
                      )}

                      {/* Time & Channel Tag */}
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
                        suppressHydrationWarning
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {daysInStage} hari di tahap ini · {report.channel}
                        </span>
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-auto">
                      <Link
                        href={`/status/${report.ticketNo}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition"
                      >
                        <span>Cek Status Publik</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      </Link>

                      {role === "PENGGUNA" && report.status === "BARU" && (
                        <CancelReportButton reportId={report.id} />
                      )}

                      {canArchive && (
                        <ArchiveReportButton
                          reportId={report.id}
                          isArchived={Boolean(report.archivedAt)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Main Body Grid: Left Info + Right Metadata & Role Action */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Column (8 Cols): Asset Info, Description, Reason & Photos */}
                    <div className="lg:col-span-8 space-y-3.5">
                      {/* Asset & Location Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-extrabold text-slate-900">
                              {report.asset.name}
                            </h2>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {report.asset.code}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            Taman:{" "}
                            <span className="text-slate-700 font-semibold">
                              {report.asset.park.name}
                            </span>{" "}
                            · Cluster:{" "}
                            <span className="text-slate-700 font-semibold">
                              {report.asset.park.cluster.name}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Complaint Description Box */}
                      <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Keluhan / Deskripsi Kerusakan
                        </div>
                        <p className="text-sm text-slate-800 font-medium leading-relaxed">
                          {report.description}
                        </p>
                      </div>

                      {/* Official Reason Notice */}
                      {report.reason && (
                        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold">
                              Alasan / Catatan Resmi:
                            </strong>{" "}
                            {report.reason}
                          </div>
                        </div>
                      )}

                      {/* Info Laporan Digabung */}
                      {parentReport && (
                        <div className="text-xs p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950">
                          🔗 Laporan ini digabung ke Laporan Induk:{" "}
                          <strong className="font-mono">
                            {parentReport.ticketNo}
                          </strong>{" "}
                          (Status Induk:{" "}
                          <strong>{parentReport.status}</strong>)
                        </div>
                      )}

                      {mergedChildren && mergedChildren.length > 0 && (
                        <div className="text-xs p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                          📌 Laporan Induk dari {mergedChildren.length} laporan
                          gabungan:{" "}
                          <strong className="font-mono">
                            {mergedChildren.map((c) => c.ticketNo).join(", ")}
                          </strong>
                        </div>
                      )}

                      {/* Photo Evidence Gallery */}
                      {report.photos && report.photos.length > 0 && (
                        <div className="pt-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Bukti Foto Lapangan ({report.photos.length})
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {report.photos.map((p: any) => (
                              <a
                                key={p.id}
                                href={p.url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative block rounded-xl overflow-hidden border border-slate-200 shadow-2xs"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.url}
                                  alt="Foto Laporan"
                                  className="h-24 w-36 object-cover group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold bg-white/95 text-slate-900 px-2 py-1 rounded-md shadow-xs transition">
                                    Perbesar
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column (4 Cols): SPK Status, Reporter Details & Action Panels */}
                    <div className="lg:col-span-4 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-4">
                      {/* SPK & Assignment Card */}
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>SPK &amp; Penugasan Teknisi</span>
                          {report.workOrder && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Aktif
                            </span>
                          )}
                        </div>

                        {report.workOrder ? (
                          <div className="bg-white rounded-xl p-3 border border-indigo-200/80 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-extrabold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                {report.workOrder.spkNo}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                Vendor Mitra
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                              {report.workOrder.vendor.name}
                            </div>
                            {report.workOrder.technician && (
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                <span className="text-slate-500">
                                  Teknisi:
                                </span>
                                <span className="font-bold text-slate-900">
                                  {report.workOrder.technician.fullName}
                                </span>
                              </div>
                            )}

                            {Boolean((report.workOrder as any)?.spkFileUrl) && (
                              <a
                                href={(report.workOrder as any).spkFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={(report.workOrder as any).spkFileName || "SPK.pdf"}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold border border-indigo-200 transition w-full mt-2"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Unduh File SPK Resmi</span>
                              </a>
                            )}

                            {warrantyVendor && (
                              <div className="mt-2 text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                <span>🛡️ Masa Garansi Vendor Aktif</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-3.5 border border-dashed border-slate-200 text-center">
                            <FileText className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                            <div className="text-xs font-semibold text-slate-600">
                              Belum Ada SPK Diterbitkan
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              SPK otomatis terbit setelah disetujui Manager.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Reporter Info */}
                      <div className="pt-3 border-t border-slate-200/80">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Informasi Pelapor
                        </div>
                        {reporter ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {reporterInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {reporter.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {reporter.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-800 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            <User className="w-4 h-4 shrink-0" />
                            <span>
                              Identitas Pelapor Disembunyikan (Aturan Privasi
                              Teknisi PRD 14.5)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role-Based Action Panels */}
                  {canVerify && report.status === "BARU" && (
                    <div className="pt-2 border-t border-slate-100">
                      <PengelolaVerificationPanel
                        reportId={report.id}
                        ticketNo={report.ticketNo}
                        assetCode={report.asset.code}
                        candidateParentReports={candidateParents}
                      />
                    </div>
                  )}

                  {isManager && report.status === "MENUNGGU_KEPUTUSAN" && (
                    <div className="pt-2 border-t border-slate-100">
                      <ManagerDecisionPanel
                        reportId={report.id}
                        ticketNo={report.ticketNo}
                        clusterId={reportClusterId}
                        eligibleVendors={eligibleVendorsForThisReport}
                        hasWarrantyVendorName={warrantyVendor?.name}
                      />
                    </div>
                  )}

                  {isManager &&
                    report.status === "MENUNGGU_KONFIRMASI" &&
                    report.workOrder && (
                      <div className="pt-2 border-t border-slate-100">
                        <ManagerConfirmationPanel
                          workOrderId={report.workOrder.id}
                          spkNo={report.workOrder.spkNo}
                          ticketNo={report.ticketNo}
                          technicianName={
                            report.workOrder.technician?.fullName || "Teknisi"
                          }
                          photos={(report.workOrder as any).photos || []}
                        />
                      </div>
                    )}

                  {role === "PIC_VENDOR" &&
                    (report.status === "DISETUJUI" || report.status === "DIKERJAKAN") &&
                    report.workOrder && (
                      <div className="pt-2 border-t border-slate-100">
                        <PicAssignPanel
                          workOrderId={report.workOrder.id}
                          spkNo={report.workOrder.spkNo}
                          technicians={picTechnicians}
                          currentTechnicianId={report.workOrder.technicianId}
                          currentTechnicianName={report.workOrder.technician?.fullName}
                          isReplacing={report.status === "DIKERJAKAN"}
                          spkFileUrl={(report.workOrder as any).spkFileUrl}
                          spkFileName={(report.workOrder as any).spkFileName}
                        />
                      </div>
                    )}

                  {role === "TEKNISI" &&
                    report.status === "DIKERJAKAN" &&
                    report.workOrder && (
                      <div className="pt-2 border-t border-slate-100">
                        <TechnicianSubmitPanel
                          workOrderId={report.workOrder.id}
                          spkNo={report.workOrder.spkNo}
                          ticketNo={report.ticketNo}
                          revisionNote={
                            (report.workOrder as any).revisionNotes &&
                            (report.workOrder as any).revisionNotes.length > 0
                              ? (report.workOrder as any).revisionNotes[
                                  (report.workOrder as any).revisionNotes.length - 1
                                ].note
                              : null
                          }
                          spkFileUrl={(report.workOrder as any).spkFileUrl}
                          spkFileName={(report.workOrder as any).spkFileName}
                          existingBeforeCount={
                            (report.workOrder as any).photos?.filter(
                              (p: any) => p.type === "BEFORE"
                            ).length || 0
                          }
                        />
                      </div>
                    )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

