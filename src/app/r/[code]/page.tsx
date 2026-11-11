import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  CompanyRow,
  ComplexRow,
  ParkRow,
  ReportRow,
} from "@/lib/db-types";
import { getCurrentSession } from "@/lib/auth";
import { STATUS_METADATA, TERMINAL_REPORT_STATUSES } from "@/lib/permissions";
import { assetUnreportableReason } from "@/lib/scopes";
import { QrReportClientForm } from "./qr-report-client";

export default async function QrAssetShortlinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code).toUpperCase();

  const [assetRow, session] = await Promise.all([
    queryOne<AssetRow>(`SELECT * FROM "Asset" WHERE "code" = $1`, [decodedCode]),
    getCurrentSession(),
  ]);

  if (!assetRow) {
    notFound();
  }

  const [category, park, reports] = await Promise.all([
    queryOne<CategoryRow>(`SELECT * FROM "Category" WHERE "id" = $1`, [
      assetRow.categoryId,
    ]),
    queryOne<ParkRow>(`SELECT * FROM "Park" WHERE "id" = $1`, [assetRow.parkId]),
    query<ReportRow>(
      `SELECT *
       FROM "Report"
       WHERE "assetId" = $1 AND "archivedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 10`,
      [assetRow.id]
    ),
  ]);

  if (!category || !park) {
    notFound();
  }

  const cluster = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1`,
    [park.clusterId]
  );
  if (!cluster) notFound();

  const complex = await queryOne<ComplexRow>(
    `SELECT * FROM "Complex" WHERE "id" = $1`,
    [cluster.complexId]
  );
  if (!complex) notFound();

  const company = await queryOne<CompanyRow>(
    `SELECT * FROM "Company" WHERE "id" = $1`,
    [complex.companyId]
  );
  if (!company) notFound();

  const asset = {
    ...assetRow,
    category,
    park: {
      ...park,
      cluster: {
        ...cluster,
        complex: {
          ...complex,
          company,
        },
      },
    },
    reports,
  };

  const unreportableReason = assetUnreportableReason(asset);

  const activeReports = asset.reports.filter(
    (r) => !TERMINAL_REPORT_STATUSES.includes(r.status)
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRejections = asset.reports.filter(
    (r) =>
      (r.status === "DITOLAK" || r.status === "TIDAK_VALID") &&
      new Date(r.createdAt) >= thirtyDaysAgo
  );

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header Mobile-First Hasil Scan QR */}
        <div className="bg-emerald-950 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              Lapor Kerusakan Fasilitas
            </span>
            <span className="font-mono text-xs font-bold bg-white/10 px-2.5 py-0.5 rounded">
              {asset.code}
            </span>
          </div>
          <h1 className="text-xl font-bold">{asset.name}</h1>
          <p className="text-xs text-emerald-200 mt-1">
            {asset.park.name} · {asset.park.cluster.name} ·{" "}
            {asset.park.cluster.complex.name}
          </p>
          <p className="text-xs text-slate-300 mt-0.5">
            Lokasi Spesifik: {asset.locationNote || "-"} · Kategori:{" "}
            {asset.category.name}
          </p>
        </div>

        {/* Aset (atau induknya) nonaktif tidak bisa menerima laporan baru */}
        {unreportableReason ? (
          <div
            role="alert"
            className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 text-rose-900 space-y-2"
          >
            <div className="text-sm font-extrabold uppercase tracking-wide text-rose-700">
              Belum Bisa Menerima Laporan
            </div>
            <p className="text-sm leading-relaxed">
              {unreportableReason} Aset <strong>{asset.name}</strong> (
              {asset.code}) untuk sementara tidak dapat menerima laporan
              kerusakan baru. Laporan yang sudah masuk tetap diproses.
            </p>
            <div className="pt-2">
              <Link
                href={session ? "/dashboard" : "/"}
                className="inline-block px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-semibold"
              >
                {session ? "Kembali ke Dashboard" : "Kembali ke Beranda"}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Daftar Laporan Aktif untuk Aset Ini (Mencegah Laporan Ganda) */}
            {activeReports.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-bold text-amber-900 uppercase">
                  Ada {activeReports.length} laporan aktif pada aset ini
                </div>
                <p className="text-xs text-amber-800">
                  Kerusakan di bawah ini sedang ditangani. Anda tidak perlu
                  melapor ulang kecuali menemukan kerusakan yang berbeda.
                </p>
                <div className="space-y-2">
                  {activeReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="bg-white rounded-xl p-3 border border-amber-200 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="font-mono">{rep.ticketNo}</span>
                        <span
                          className={`px-2 py-0.5 rounded border ${STATUS_METADATA[rep.status].badgeColor}`}
                        >
                          {STATUS_METADATA[rep.status].label}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{rep.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Penolakan Terakhir (30 Hari Terakhir) */}
            {recentRejections.length > 0 && (
              <div className="bg-slate-200/70 border border-slate-300 rounded-2xl p-4 space-y-2 text-xs">
                <div className="font-bold text-slate-800">
                  Riwayat Penolakan 30 Hari Terakhir pada Aset Ini:
                </div>
                {recentRejections.map((rej) => (
                  <div key={rej.id} className="text-slate-700">
                    • Tiket <strong>{rej.ticketNo}</strong> (
                    {STATUS_METADATA[rej.status].label}):{" "}
                    {rej.reason || "Tanpa catatan alasan"}
                  </div>
                ))}
              </div>
            )}

            {/* Komponen Form QR Interaktif dengan IndexedDB Draft & 3 Pilihan Login */}
            <QrReportClientForm
              assetCode={asset.code}
              assetName={asset.name}
              damageTypes={asset.category.damageTypes}
              initialUser={session}
            />
          </>
        )}
      </div>
    </div>
  );
}
