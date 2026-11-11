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

interface StatusPageProps {
  params: Promise<{ ticketNo: string }>;
  searchParams: Promise<{ k?: string }>;
}

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
            ✕
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 mb-1">
            Laporan Tidak Ditemukan
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Nomor tiket <code className="font-mono font-bold text-slate-800">{ticketNo}</code> tidak terdaftar di sistem GreenPark atau telah diarsipkan.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
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
            `SELECT "ticketNo", "status", "statusToken" FROM "Report" WHERE "id" = $1`,
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

  const [parkRow, categoryRow, workPhotos] = await Promise.all([
    queryOne<ParkRow>(`SELECT * FROM "Park" WHERE "id" = $1`, [assetRow.parkId]),
    queryOne<CategoryRow>(`SELECT * FROM "Category" WHERE "id" = $1`, [
      assetRow.categoryId,
    ]),
    workOrderRow
      ? query<WorkPhotoRow>(
          `SELECT * FROM "WorkPhoto" WHERE "workOrderId" = $1 AND "type" = 'AFTER'`,
          [workOrderRow.id]
        )
      : Promise.resolve([]),
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 text-white flex items-center justify-center text-sm font-black shadow-xs">
              GP
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 block leading-tight">
                GreenPark
              </span>
              <span className="text-[11px] text-slate-500 font-medium block">
                Pelacakan Status Publik
              </span>
            </div>
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg"
          >
            Masuk Akun →
          </Link>
        </div>

        {/* Card Utama */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Tiket */}
          <div className="bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Nomor Tiket
              </div>
              <div className="text-xl font-black font-mono tracking-tight text-white mt-0.5">
                {report.ticketNo}
              </div>
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeColor}`}
              >
                {meta.label}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Info Aset */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Informasi Aset
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">Nama Aset:</span>
                  <span className="font-semibold text-slate-900">
                    {report.asset.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Kode Aset:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {report.asset.code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Lokasi Taman:</span>
                  <span className="font-medium text-slate-800">
                    {report.asset.park.name} ({report.asset.park.cluster.name})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Tanggal Lapor:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(report.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>

              {report.asset.locationNote && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold">Titik Lokasi:</span> {report.asset.locationNote}
                </div>
              )}
            </div>

            {/* Deskripsi & Foto Kerusakan Awal */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Deskripsi Kerusakan yang Dilaporkan
              </div>
              <p className="text-sm text-slate-700 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200">
                {report.description}
              </p>

              {report.photos.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-500 block mb-2">
                    Foto Kerusakan:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {report.photos.map((p, idx) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg overflow-hidden border border-slate-300 hover:opacity-90"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={`Foto kerusakan ${idx + 1}`}
                          className="w-24 h-24 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Catatan Alasan (Bila Tidak Valid atau Ditolak) */}
            {report.reason && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                  Catatan dari Tim Pengelola / Manager
                </div>
                <p className="text-sm text-amber-900 font-medium">
                  {report.reason}
                </p>
              </div>
            )}

            {/* Info Jika Digabung */}
            {report.status === "DIGABUNG" && report.parentReport && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">
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

            {/* Foto Hasil Perbaikan (Bila Selesai) */}
            {report.status === "SELESAI" && completionPhotos.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  ✓ Foto Hasil Perbaikan Selesai
                </div>
                <div className="flex flex-wrap gap-2">
                  {completionPhotos.map((cp, idx) => (
                    <a
                      key={cp.id}
                      href={cp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden border border-emerald-300 hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cp.url}
                        alt={`Foto hasil ${idx + 1}`}
                        className="w-28 h-28 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Perubahan Status */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Riwayat Perkembangan Tiket
              </div>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                {report.statusLogs.map((log) => {
                  const logMeta = STATUS_METADATA[log.toStatus];
                  return (
                    <div key={log.id} className="relative flex items-start gap-3 pl-8">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${logMeta.badgeColor}`}
                          >
                            {logMeta.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(log.createdAt).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        {log.note &&
                          (log.toStatus === "TIDAK_VALID" ||
                            log.toStatus === "DITOLAK") && (
                            <p className="text-xs text-slate-600 mt-1">
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
        <div className="text-center text-xs text-slate-400 mt-6">
          Sistem Manajemen Fasilitas & Taman GreenPark · Pembaruan real-time
        </div>
      </div>
    </div>
  );
}
