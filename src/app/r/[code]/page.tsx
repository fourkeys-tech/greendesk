import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  History,
  Info,
  Leaf,
  MapPin,
  QrCode,
  Tag,
} from "lucide-react";
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
import { BottomNav } from "@/components/BottomNav";
import { QrReportClientForm } from "./qr-report-client";

export default async function QrAssetShortlinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<{ oauthError?: string; googleAuth?: string }>;
}) {
  const { code } = await params;
  const sp = searchParams ? await searchParams : {};
  const decodedCode = code.toUpperCase();

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

  const canSeeReportDetails = (rep: ReportRow) => {
    if (!session) return false;
    if (rep.reporterId === session.id) return true;
    return (
      session.companyId === company.id &&
      ["PENGELOLA", "MANAGER", "ADMIN", "OWNER"].includes(session.role)
    );
  };

  const activeReports = asset.reports.filter(
    (r) => !TERMINAL_REPORT_STATUSES.includes(r.status)
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRejections = asset.reports.filter(
    (r) =>
      canSeeReportDetails(r) &&
      (r.status === "DITOLAK" || r.status === "TIDAK_VALID") &&
      new Date(r.createdAt) >= thirtyDaysAgo
  );

  const isStaff = Boolean(session?.role && session.role !== "PENGGUNA");
  const backHref = isStaff ? "/dashboard" : "/beranda";
  const backLabel = isStaff ? "Dashboard" : "Beranda";

  const assetHeaderCard = (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#1f2a27] via-[#1d3a30] to-[#14532d] p-5 text-white shadow-xl sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#66d36e]/15 blur-2xl"
      />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#66d36e]/30 bg-[#66d36e]/15 px-3 py-1 text-[11px] font-semibold text-[#8fe596]">
            <QrCode className="h-3.5 w-3.5" />
            Pelaporan QR Fasilitas Taman
          </span>
          <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-white ring-1 ring-white/10">
            {asset.code}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {asset.name}
        </h1>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div>
              <dt className="sr-only">Lokasi</dt>
              <dd className="text-emerald-100">
                {asset.park.name} · {asset.park.cluster.name} ·{" "}
                {asset.park.cluster.complex.name}
              </dd>
              <dd className="mt-0.5 text-xs text-slate-300">
                Lokasi spesifik: {asset.locationNote || "-"}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Tag className="h-4 w-4 shrink-0 text-emerald-300" />
            <dt className="sr-only">Kategori</dt>
            <dd className="text-emerald-100">{asset.category.name}</dd>
          </div>
        </dl>
      </div>
    </section>
  );

  const activeReportsCard = activeReports.length > 0 && (
    <section className="space-y-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <div className="text-sm font-bold text-amber-900">
            {activeReports.length} laporan aktif pada aset ini
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            Kerusakan di bawah ini sedang ditangani. Anda tidak perlu melapor
            ulang kecuali menemukan kerusakan yang berbeda.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {activeReports.map((rep, idx) => {
          const showDetails = canSeeReportDetails(rep);
          return (
            <li
              key={rep.id}
              className="rounded-2xl border border-amber-200 bg-white p-3 text-xs shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 font-semibold text-slate-900">
                <span className="font-mono">
                  {showDetails ? rep.ticketNo : `Laporan Aktif #${idx + 1}`}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_METADATA[rep.status].badgeColor}`}
                >
                  {STATUS_METADATA[rep.status].label}
                </span>
              </div>
              {showDetails ? (
                <p className="mt-1.5 leading-relaxed text-slate-600">
                  {rep.description}
                </p>
              ) : (
                <p className="mt-1.5 italic text-slate-500">
                  Laporan kerusakan sedang dalam penanganan petugas.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const rejectionsCard = recentRejections.length > 0 && (
    <section className="space-y-2 rounded-3xl border border-slate-300 bg-slate-100 p-4 text-xs sm:p-5">
      <div className="flex items-center gap-2 font-bold text-slate-800">
        <History className="h-4 w-4" />
        Riwayat penolakan 30 hari terakhir
      </div>
      <ul className="space-y-1.5 text-slate-700">
        {recentRejections.map((rej) => (
          <li key={rej.id} className="leading-relaxed">
            Tiket <strong>{rej.ticketNo}</strong> (
            {STATUS_METADATA[rej.status].label}):{" "}
            {rej.reason || "Tanpa catatan alasan"}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#F6F5F0] px-4 pb-32 pt-5 sm:px-6 md:pb-12 lg:px-8">
      <div className="mx-auto w-full max-w-xl space-y-5 md:max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href={backHref}
            aria-label={`Kembali ke ${backLabel}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2.5 pr-4 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4D3E]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-[#1B4D3E]">
            <Leaf className="h-4 w-4" />
            GreenDesk
          </span>
        </header>

        {unreportableReason ? (
          <div className="mx-auto max-w-xl space-y-5">
            {assetHeaderCard}
            <div
              role="alert"
              className="space-y-3 rounded-3xl border-2 border-rose-300 bg-rose-50 p-6 text-rose-900"
            >
              <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-rose-700">
                <AlertTriangle className="h-4 w-4" />
                Belum Bisa Menerima Laporan
              </div>
              <p className="text-sm leading-relaxed">
                {unreportableReason} Aset <strong>{asset.name}</strong> (
                {asset.code}) untuk sementara tidak dapat menerima laporan
                kerusakan baru. Laporan yang sudah masuk tetap diproses.
              </p>
              <Link
                href={backHref}
                className="inline-block rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800"
              >
                Kembali ke {backLabel}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start md:gap-6 lg:gap-8">
            {/* Kolom kiri: info aset + riwayat (sticky di desktop/tablet) */}
            <aside className="space-y-5 md:sticky md:top-5">
              {assetHeaderCard}
              {activeReportsCard}
              {rejectionsCard}
            </aside>

            {/* Kolom kanan: form pelaporan */}
            <main className="rounded-3xl md:border md:border-slate-200 md:bg-white md:p-6 md:shadow-sm lg:p-8">
              <QrReportClientForm
                assetCode={asset.code}
                assetName={asset.name}
                damageTypes={asset.category.damageTypes}
                initialUser={session}
                oauthError={sp.oauthError ?? null}
              />
            </main>
          </div>
        )}
      </div>

      {/* Bottom navbar hanya tampil di mobile */}
      <div className="md:hidden">
        <BottomNav
          isLoggedIn={Boolean(session)}
          userRole={session?.role ?? null}
        />
      </div>
    </div>
  );
}