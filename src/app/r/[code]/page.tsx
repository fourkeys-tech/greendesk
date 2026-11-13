import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import type { AssetRow, ReportRow } from "@/lib/db-types";
import { getCurrentSession } from "@/lib/auth";
import { STATUS_METADATA, TERMINAL_REPORT_STATUSES } from "@/lib/permissions";
import { assetUnreportableReason } from "@/lib/scopes";
import { BottomNav } from "@/components/BottomNav";
import { QrReportClientForm } from "./qr-report-client";

type AssetContextRow = AssetRow & {
  categoryName: string;
  categoryDamageTypes: string[];
  categoryIsActive: boolean;
  parkName: string;
  parkIsActive: boolean;
  clusterName: string;
  clusterIsActive: boolean;
  complexName: string;
  complexIsActive: boolean;
  ownerCompanyId: string;
};

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

  // Satu putaran paralel: aset + hierarki lokasi (INNER JOIN, relasi hilang → 404), laporan, sesi.
  // Sebelumnya 5 query berurutan (aset → kategori/taman → cluster → komplek → perusahaan).
  const [row, reports, session] = await Promise.all([
    queryOne<AssetContextRow>(
      `SELECT
         a.*,
         cat."name" AS "categoryName",
         cat."damageTypes" AS "categoryDamageTypes",
         cat."isActive" AS "categoryIsActive",
         p."name" AS "parkName",
         p."isActive" AS "parkIsActive",
         cl."name" AS "clusterName",
         cl."isActive" AS "clusterIsActive",
         cx."name" AS "complexName",
         cx."isActive" AS "complexIsActive",
         co."id" AS "ownerCompanyId"
       FROM "Asset" a
       JOIN "Category" cat ON cat."id" = a."categoryId"
       JOIN "Park" p ON p."id" = a."parkId"
       JOIN "Cluster" cl ON cl."id" = p."clusterId"
       JOIN "Complex" cx ON cx."id" = cl."complexId"
       JOIN "Company" co ON co."id" = cx."companyId"
       WHERE a."code" = $1
       LIMIT 1`,
      [decodedCode]
    ),
    query<ReportRow>(
      `SELECT *
       FROM "Report"
       WHERE "assetId" = (SELECT "id" FROM "Asset" WHERE "code" = $1)
         AND "archivedAt" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 10`,
      [decodedCode]
    ),
    getCurrentSession(),
  ]);

  if (!row) {
    notFound();
  }

  const company = { id: row.ownerCompanyId };
  const asset = {
    ...row,
    category: {
      name: row.categoryName,
      damageTypes: row.categoryDamageTypes,
      isActive: row.categoryIsActive,
    },
    park: {
      name: row.parkName,
      isActive: row.parkIsActive,
      cluster: {
        name: row.clusterName,
        isActive: row.clusterIsActive,
        complex: {
          name: row.complexName,
          isActive: row.complexIsActive,
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

  const backHref =
    session?.role && session.role !== "PENGGUNA" ? "/dashboard" : "/beranda";

  // Layout mobile-first bergaya FE; data, query PostgreSQL, dan proteksi privasi tetap dari lokal.
  const assetHeaderCard = (
    <div className="rounded-3xl border border-[#2f8f5b]/60 bg-[#1f2a27] p-5 text-white shadow-lg">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[#66d36e]/30 bg-[#66d36e]/15 px-3 py-0.5 text-[11px] font-semibold text-[#66d36e]">
          Pelaporan QR Fasilitas Taman
        </span>
        <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs font-bold text-white">
          {asset.code}
        </span>
      </div>
      <h1 className="text-xl font-extrabold tracking-tight">{asset.name}</h1>
      <p className="mt-1 text-xs text-emerald-200">
        {asset.park.name} · {asset.park.cluster.name} ·{" "}
        {asset.park.cluster.complex.name}
      </p>
      <p className="mt-0.5 text-xs text-slate-300">
        Lokasi Spesifik: {asset.locationNote || "-"} · Kategori:{" "}
        {asset.category.name}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F5F0] px-4 pt-5 pb-32">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center justify-between">
          <Link
            href={backHref}
            aria-label="Kembali"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2.5 pr-4 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>
              {session?.role && session.role !== "PENGGUNA"
                ? "Dashboard"
                : "Beranda"}
            </span>
          </Link>
          <span className="text-xs font-extrabold tracking-wide text-[#1B4D3E]">
            GreenDesk
          </span>
        </header>

        {assetHeaderCard}

        {unreportableReason ? (
          <div className="space-y-5">
            <div
              role="alert"
              className="space-y-2 rounded-3xl border-2 border-rose-300 bg-rose-50 p-6 text-rose-900"
            >
              <div className="text-sm font-extrabold uppercase tracking-wide text-rose-700">
                Belum Bisa Menerima Laporan
              </div>
              <p className="text-sm leading-relaxed">
                {unreportableReason} Aset <strong>{asset.name}</strong> (
                {asset.code}) untuk sementara tidak dapat menerima laporan
                kerusakan baru. Laporan yang sudah masuk tetap diproses.
              </p>
              <Link
                href={backHref}
                className="inline-block rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white"
              >
                {session?.role && session.role !== "PENGGUNA"
                  ? "Kembali ke Dashboard"
                  : "Kembali ke Beranda"}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {activeReports.length > 0 && (
              <section className="space-y-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="text-xs font-bold uppercase text-amber-900">
                  ℹ️ Terdapat {activeReports.length} laporan aktif pada aset ini
                </div>
                <p className="text-xs text-amber-800">
                  Kerusakan di bawah ini sedang ditangani. Anda tidak perlu
                  melapor ulang kecuali menemukan kerusakan yang berbeda.
                </p>
                <div className="space-y-2">
                  {activeReports.map((rep, idx) => {
                    const showDetails = canSeeReportDetails(rep);
                    return (
                      <div
                        key={rep.id}
                        className="rounded-xl border border-amber-200 bg-white p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span className="font-mono">
                            {showDetails
                              ? rep.ticketNo
                              : `Laporan Aktif #${idx + 1}`}
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 ${STATUS_METADATA[rep.status].badgeColor}`}
                          >
                            {STATUS_METADATA[rep.status].label}
                          </span>
                        </div>
                        {showDetails ? (
                          <p className="mt-1 text-slate-600">{rep.description}</p>
                        ) : (
                          <p className="mt-1 italic text-slate-500">
                            Laporan kerusakan sedang dalam penanganan petugas.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {recentRejections.length > 0 && (
              <section className="space-y-2 rounded-2xl border border-slate-300 bg-slate-200/70 p-4 text-xs">
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
              </section>
            )}

            <QrReportClientForm
              assetCode={asset.code}
              assetName={asset.name}
              damageTypes={asset.category.damageTypes}
              initialUser={session}
              oauthError={sp.oauthError ?? null}
            />
          </>
        )}
      </div>

      <BottomNav
        isLoggedIn={Boolean(session)}
        userRole={session?.role ?? null}
      />
    </div>
  );
}
