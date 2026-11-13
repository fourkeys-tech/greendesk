import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  ParkRow,
  ReportPhotoRow,
  ReportRow,
  ReportStatus,
  ReportStatusLogRow,
  WorkOrderRow,
  WorkPhotoRow,
} from "@/lib/db-types";
import { STATUS_METADATA } from "@/lib/permissions";
import { sanitizeMediaHref } from "@/lib/url-safety";

interface StatusPageProps {
  params: Promise<{ ticketNo: string }>;
  searchParams: Promise<{ k?: string }>;
}

/* ---------- Helpers kecil ---------- */

const TERMINAL_STATUSES: ReportStatus[] = [
  "SELESAI",
  "TIDAK_VALID",
  "DITOLAK",
  "DIGABUNG",
] as ReportStatus[];

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtDay(value: string | Date) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function CheckIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M6 18v2M18 18v2" />
    </svg>
  );
}

function Avatar({ name, size = "w-9 h-9" }: { name: string; size?: string }) {
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-tr from-emerald-800 to-teal-500 text-white flex items-center justify-center text-xs font-bold shrink-0`}
    >
      {initials(name) || "?"}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
      {children}
    </h2>
  );
}

const cardClass =
  "bg-white rounded-2xl shadow-sm border border-slate-200/70 p-5";

/* ---------- Halaman ---------- */

export default async function PublicStatusPage({
  params,
  searchParams,
}: StatusPageProps) {
  const [{ ticketNo }, { k }, session] = await Promise.all([
    params,
    searchParams,
    getCurrentSession(),
  ]);
  const tokenParam = k?.trim();

  const reportRow = await queryOne<ReportRow>(
    `SELECT *
     FROM "Report"
     WHERE "ticketNo" = $1 AND "archivedAt" IS NULL
     LIMIT 1`,
    [ticketNo.trim()]
  );

  const isReporterOwner = Boolean(
    session && reportRow && session.id === reportRow.reporterId
  );
  const hasValidToken = Boolean(
    reportRow && tokenParam && tokenParam === reportRow.statusToken
  );

  if (!reportRow || (!isReporterOwner && !hasValidToken)) {
    return (
      <div className="min-h-screen bg-[#f5f4ef] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/70 p-6 text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            ✕
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mb-1">
            Laporan Tidak Ditemukan
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Nomor tiket{" "}
            <code className="font-mono font-bold text-slate-800">
              {ticketNo}
            </code>{" "}
            tidak terdaftar di sistem GreenPark atau telah diarsipkan.
          </p>
          <Link
            href="/beranda"
            className="inline-block px-4 py-2 bg-emerald-900 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const [assetRow, photos, statusLogs, parentReport, workOrderRow] =
    await Promise.all([
      queryOne<AssetRow>(`SELECT * FROM "Asset" WHERE "id" = $1`, [
        reportRow.assetId,
      ]),
      query<ReportPhotoRow>(
        `SELECT * FROM "ReportPhoto" WHERE "reportId" = $1 ORDER BY "createdAt" ASC`,
        [reportRow.id]
      ),
      query<ReportStatusLogRow>(
        `SELECT * FROM "ReportStatusLog" WHERE "reportId" = $1 ORDER BY "createdAt" ASC`,
        [reportRow.id]
      ),
      reportRow.parentReportId
        ? queryOne<{
          ticketNo: string;
          status: ReportStatus;
          statusToken: string;
        }>(
          `SELECT "ticketNo", "status", "statusToken"
             FROM "Report"
             WHERE "id" = $1 AND "archivedAt" IS NULL`,
          [reportRow.parentReportId]
        )
        : Promise.resolve(null),
      queryOne<WorkOrderRow>(
        `SELECT * FROM "WorkOrder" WHERE "reportId" = $1`,
        [reportRow.id]
      ),
    ]);

  if (!assetRow) {
    throw new Error("Aset laporan tidak ditemukan.");
  }

  // Data pribadi (pelapor & teknisi) hanya untuk pemilik laporan / staf,
  // bukan untuk siapa saja yang memegang link token publik.
  const canSeePrivate = Boolean(
    isReporterOwner || (session?.role && session.role !== "PENGGUNA")
  );

  // ASUMSI: tabel "User" punya kolom id, name, email; WorkOrder punya technicianId.
  // Sesuaikan nama tabel/kolom dengan skema kamu.
  const technicianId = workOrderRow
    ? (workOrderRow as unknown as { technicianId?: string | null })
      .technicianId
    : null;

  const [parkRow, categoryRow, workPhotos, reporterRow, technicianRow] =
    await Promise.all([
      queryOne<ParkRow>(`SELECT * FROM "Park" WHERE "id" = $1`, [
        assetRow.parkId,
      ]),
      queryOne<CategoryRow>(`SELECT * FROM "Category" WHERE "id" = $1`, [
        assetRow.categoryId,
      ]),
      workOrderRow
        ? query<WorkPhotoRow>(
          `SELECT * FROM "WorkPhoto" WHERE "workOrderId" = $1 AND "type" = 'AFTER'`,
          [workOrderRow.id]
        )
        : Promise.resolve([]),
      canSeePrivate && reportRow.reporterId
        ? queryOne<{ name: string; email: string }>(
          `SELECT "name", "email" FROM "User" WHERE "id" = $1`,
          [reportRow.reporterId]
        )
        : Promise.resolve(null),
      technicianId
        ? queryOne<{ name: string; email: string }>(
          `SELECT "name", "email" FROM "User" WHERE "id" = $1`,
          [technicianId]
        )
        : Promise.resolve(null),
    ]);

  if (!parkRow || !categoryRow) {
    throw new Error("Lokasi taman aset tidak ditemukan.");
  }

  const clusterRow = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1`,
    [parkRow.clusterId]
  );
  if (!clusterRow) {
    throw new Error("Cluster taman tidak ditemukan.");
  }

  const report = {
    ...reportRow,
    asset: {
      ...assetRow,
      category: categoryRow,
      park: {
        ...parkRow,
        cluster: clusterRow,
      },
    },
    photos,
    statusLogs,
    parentReport,
    workOrder: workOrderRow ? { ...workOrderRow, photos: workPhotos } : null,
  };

  const meta = STATUS_METADATA[report.status];
  const completionPhotos = report.workOrder?.photos || [];
  const homeHref =
    session?.role && session.role !== "PENGGUNA" ? "/dashboard" : "/beranda";
  const actionHref = !session
    ? "/login"
    : session.role === "PENGGUNA"
      ? "/beranda/laporan"
      : "/dashboard/laporan";
  const actionLabel = !session
    ? "Masuk Akun →"
    : session.role === "PENGGUNA"
      ? "Laporan Saya →"
      : "Dashboard →";

  /* ----- Stepper "Status Penanganan" (diturunkan dari log status) ----- */
  const isTerminal = TERMINAL_STATUSES.includes(report.status);
  const firstLog = report.statusLogs[0];
  const lastLog = report.statusLogs[report.statusLogs.length - 1];
  const middleLogs = report.statusLogs
    .slice(1)
    .filter((l) => !TERMINAL_STATUSES.includes(l.toStatus));
  const hasProgress = middleLogs.length > 0 || (isTerminal && report.statusLogs.length > 2);

  const steps = [
    {
      title: "Dilaporkan",
      sub: fmtDay(firstLog?.createdAt ?? report.createdAt),
      done: true,
      align: "items-start text-left",
    },
    {
      title: "Diproses",
      sub: middleLogs.length
        ? fmtDay(middleLogs[middleLogs.length - 1].createdAt)
        : "Menunggu",
      done: hasProgress,
      align: "items-center text-center",
    },
    {
      title: isTerminal ? meta.label : "Selesai",
      sub: isTerminal && lastLog ? fmtDay(lastLog.createdAt) : "Belum selesai",
      done: isTerminal,
      align: "items-end text-right",
    },
  ];

  const showAfterCard =
    report.status === "SELESAI" && completionPhotos.length > 0;
  const safeCompletion = completionPhotos
    .map((cp) => ({ id: cp.id, url: sanitizeMediaHref(cp.url) }))
    .filter((p): p is { id: string; url: string } => Boolean(p.url));

  return (
    <div className="min-h-screen bg-[#f5f4ef] py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="relative flex items-center justify-center mb-6 min-h-10">
          <Link
            href={homeHref}
            aria-label="Kembali"
            className="absolute left-0 w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-sm"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-base font-extrabold text-slate-900">
            Detail Laporan
          </h1>
          <Link
            href={actionHref}
            className="absolute right-0 text-xs font-semibold text-emerald-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition"
          >
            {actionLabel}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-5">
            {/* Kartu Aset */}
            <div className={`${cardClass} flex items-center gap-4`}>
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                <SeatIcon />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                  {report.ticketNo}
                </div>
                <div className="text-lg font-extrabold text-slate-900 leading-tight">
                  {report.asset.name}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5 break-words">
                  ID: {report.asset.code} • {report.asset.park.name} (
                  {report.asset.park.cluster.name})
                  {report.asset.locationNote
                    ? ` - ${report.asset.locationNote}`
                    : ""}
                </div>
              </div>
            </div>

            {/* Status Penanganan */}
            <div className={cardClass}>
              <CardTitle>Status Penanganan</CardTitle>
              <div className="relative mt-5 mb-1">
                <div className="absolute top-3 left-3 right-3 h-0.5 bg-emerald-950" />
                <div className="relative flex justify-between">
                  {steps.map((s, i) => (
                    <div key={i} className={`flex flex-col ${s.align}`}>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${s.done
                            ? "bg-emerald-950 border-emerald-950 text-white"
                            : "bg-white border-slate-300 text-slate-400"
                          }`}
                      >
                        {s.done && i !== 2 ? <CheckIcon /> : i + 1}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1.5">
                        {s.title}
                      </div>
                      <div className="text-[10px] text-slate-400">{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Profil Pelapor (hanya pemilik / staf) */}
            {reporterRow && (
              <div className={cardClass}>
                <CardTitle>Profil Pelapor</CardTitle>
                <div className="flex items-center gap-3 mt-3">
                  <Avatar name={reporterRow.name} size="w-11 h-11" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      {reporterRow.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <MailIcon />
                      <span className="truncate">{reporterRow.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deskripsi Kerusakan */}
            <div className={cardClass}>
              <CardTitle>Deskripsi Kerusakan</CardTitle>
              <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                {report.description}
              </p>

              {report.photos.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-900 block mb-2">
                    Foto Lampiran
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {report.photos.map((p, idx) => {
                      const safeUrl = sanitizeMediaHref(p.url);
                      if (!safeUrl) return null;
                      return (
                        <a
                          key={p.id}
                          href={safeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={safeUrl}
                            alt={`Foto kerusakan ${idx + 1}`}
                            className="w-44 h-24 object-cover"
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Catatan Alasan (Bila Tidak Valid atau Ditolak) */}
            {report.reason && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                  Catatan dari Tim Pengelola / Manager
                </div>
                <p className="text-sm text-amber-900 font-medium">
                  {report.reason}
                </p>
              </div>
            )}

            {/* Info Jika Digabung */}
            {report.status === "DIGABUNG" && report.parentReport && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                  Laporan Digabung
                </div>
                <p className="text-sm text-blue-900">
                  Laporan ini telah digabung ke tiket induk{" "}
                  <Link
                    href={`/status/${report.parentReport.ticketNo}?k=${encodeURIComponent(report.parentReport.statusToken)}`}
                    className="font-mono font-bold underline"
                  >
                    {report.parentReport.ticketNo}
                  </Link>
                  . Perkembangan perbaikan akan mengikuti tiket tersebut.
                </p>
              </div>
            )}
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="space-y-5">
            {/* Laporan Setelah Diperbaiki */}
            {showAfterCard && (
              <div className={cardClass}>
                <div className="flex items-center justify-between">
                  <CardTitle>Laporan Setelah Diperbaiki</CardTitle>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {technicianRow && (
                  <div className="mt-3 flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <Avatar name={technicianRow.name} size="w-10 h-10" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Teknisi yang Mengerjakan
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {technicianRow.name}
                      </div>
                      {canSeePrivate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MailIcon />
                          <span className="truncate">
                            {technicianRow.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {safeCompletion.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <a
                      href={safeCompletion[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl overflow-hidden border border-slate-200 hover:opacity-95 transition"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={safeCompletion[0].url}
                        alt="Foto hasil perbaikan 1"
                        className="w-full h-52 object-cover"
                      />
                    </a>
                    {safeCompletion.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {safeCompletion.slice(1).map((cp, idx) => (
                          <a
                            key={cp.id}
                            href={cp.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cp.url}
                              alt={`Foto hasil perbaikan ${idx + 2}`}
                              className="w-24 h-24 object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                  Fasilitas taman telah selesai diperbaiki oleh teknisi
                  lapangan. Perkembangan dan hasil perbaikan dapat dilihat pada
                  foto di atas serta riwayat status di bawah.
                </p>
              </div>
            )}

            {/* Riwayat Status */}
            <div className={cardClass}>
              <CardTitle>Riwayat Status</CardTitle>
              <div className="mt-4">
                {report.statusLogs.map((log, i) => {
                  const logMeta = STATUS_METADATA[log.toStatus];
                  const isLast = i === report.statusLogs.length - 1;
                  return (
                    <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!isLast && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />
                      )}
                      <div className="relative z-10 w-6 h-6 rounded-full bg-slate-100 border border-slate-300 text-slate-600 flex items-center justify-center shrink-0">
                        <CheckIcon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {logMeta.label}
                          </span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {fmtDate(log.createdAt)}
                          </span>
                        </div>
                        {log.note &&
                          (log.toStatus === "TIDAK_VALID" ||
                            log.toStatus === "DITOLAK") && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {log.note}
                            </p>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 mt-8">
          Sistem Manajemen Fasilitas & Taman GreenPark · Pembaruan real-time
        </div>
      </div>
    </div>
  );
}