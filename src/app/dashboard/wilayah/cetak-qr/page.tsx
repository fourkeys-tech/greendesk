import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { assetUnreportableReason } from "@/lib/scopes";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import {
  PrintQrSheetButton,
  SingleCardQrActions,
  type QrPrintItem,
} from "./print-button";

interface CetakQrPageProps {
  searchParams: Promise<{ komplek?: string }>;
}

export default async function CetakQrPage({ searchParams }: CetakQrPageProps) {
  const [session, { komplek }] = await Promise.all([
    getCurrentSession(),
    searchParams,
  ]);
  if (!session) redirect("/login");

  // PRD §10: stiker QR dicetak oleh Admin.
  if (!hasPermission(session.role, "MANAGE_MASTER_DATA")) {
    return (
      <AccessDeniedNotice message="Pencetakan stiker QR hanya dilakukan oleh Admin." />
    );
  }
  if (!session.companyId) {
    return (
      <DbErrorNotice
        title="Akun belum terhubung ke perusahaan"
        message="Hubungi pemilik platform untuk menautkan akun Anda ke perusahaan."
      />
    );
  }

  const companyName = session.companyName || undefined;

  let complexes: {
    id: string;
    name: string;
    isActive: boolean;
    assetCount: number;
  }[];
  let selectedComplex: (typeof complexes)[number] | null = null;
  let cards: {
    id: string;
    item: QrPrintItem;
    locationNote: string | null;
    inactiveReason: string | null;
  }[];

  try {
    complexes = await query<{
      id: string;
      name: string;
      isActive: boolean;
      assetCount: number;
    }>(
      `SELECT cx."id", cx."name", cx."isActive",
              COUNT(a."id")::int AS "assetCount"
       FROM "Complex" cx
       LEFT JOIN "Cluster" cl ON cl."complexId" = cx."id"
       LEFT JOIN "Park" p ON p."clusterId" = cl."id"
       LEFT JOIN "Asset" a ON a."parkId" = p."id"
       WHERE cx."companyId" = $1
       GROUP BY cx."id"
       ORDER BY cx."name" ASC`,
      [session.companyId]
    );
    // Hanya terima id komplek milik perusahaan ini; nilai lain diperlakukan sebagai "semua".
    selectedComplex = complexes.find((c) => c.id === komplek) ?? null;

    const assets = await query<{
      id: string;
      code: string;
      name: string;
      locationNote: string | null;
      isActive: boolean;
      parkName: string;
      parkIsActive: boolean;
      clusterName: string;
      clusterIsActive: boolean;
      complexIsActive: boolean;
      categoryIsActive: boolean;
    }>(
      `SELECT a."id", a."code", a."name", a."locationNote", a."isActive",
              p."name" AS "parkName", p."isActive" AS "parkIsActive",
              cl."name" AS "clusterName", cl."isActive" AS "clusterIsActive",
              cx."isActive" AS "complexIsActive",
              cat."isActive" AS "categoryIsActive"
       FROM "Asset" a
       JOIN "Park" p ON p."id" = a."parkId"
       JOIN "Cluster" cl ON cl."id" = p."clusterId"
       JOIN "Complex" cx ON cx."id" = cl."complexId"
       JOIN "Category" cat ON cat."id" = a."categoryId"
       WHERE a."companyId" = $1
         AND ($2::text IS NULL OR cx."id" = $2)
       ORDER BY a."code" ASC`,
      [session.companyId, selectedComplex?.id ?? null]
    );

    cards = await Promise.all(
      assets.map(async (asset) => {
        const qr = await generateAssetQrDataUrl(asset.code);
        return {
          id: asset.id,
          locationNote: asset.locationNote,
          inactiveReason: assetUnreportableReason({
            isActive: asset.isActive,
            category: { isActive: asset.categoryIsActive },
            park: {
              isActive: asset.parkIsActive,
              cluster: {
                isActive: asset.clusterIsActive,
                complex: { isActive: asset.complexIsActive },
              },
            },
          }),
          item: {
            qrDataUrl: qr.qrDataUrl,
            assetCode: asset.code,
            assetName: asset.name,
            parkName: `${asset.clusterName} · ${asset.parkName}`,
            companyName,
          },
        };
      })
    );
  } catch (error) {
    console.error("[cetak-qr] gagal memuat aset:", error);
    return <DbErrorNotice />;
  }

  // Lembar cetak massal hanya berisi aset yang masih bisa dilaporkan.
  const printableItems = cards
    .filter((c) => !c.inactiveReason)
    .map((c) => c.item);
  const inactiveCount = cards.length - printableItems.length;
  const totalAssets = complexes.reduce((sum, c) => sum + c.assetCount, 0);

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
      active
        ? "bg-emerald-900 border-emerald-900 text-white"
        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
    }`;
  const countClass = (active: boolean) =>
    `rounded-full px-1.5 text-[10px] font-bold ${
      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
    }`;

  return (
    <div className="w-full space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 print:hidden">
        <div className="space-y-1.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Cetak Stiker QR Aset
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Cetak satu lembar stiker untuk semua aset aktif, cetak per aset, atau
            unduh gambar QR (.png) untuk dicetak di percetakan.
          </p>
          {inactiveCount > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 inline-block">
              {inactiveCount} aset nonaktif tidak dimasukkan ke lembar cetak massal.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/90 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Kembali ke Wilayah</span>
          </Link>
          {printableItems.length > 0 && (
            <PrintQrSheetButton items={printableItems} companyName={companyName} />
          )}
        </div>
      </div>

      {complexes.length > 1 && (
        <nav
          aria-label="Filter komplek"
          className="flex flex-wrap items-center gap-2 print:hidden"
        >
          <span className="text-xs font-bold text-slate-500 mr-1">Komplek:</span>
          <Link
            href="/dashboard/wilayah/cetak-qr"
            aria-current={!selectedComplex ? "page" : undefined}
            className={chipClass(!selectedComplex)}
          >
            Semua
            <span className={countClass(!selectedComplex)}>{totalAssets}</span>
          </Link>
          {complexes.map((c) => {
            const active = selectedComplex?.id === c.id;
            return (
              <Link
                key={c.id}
                href={`/dashboard/wilayah/cetak-qr?komplek=${encodeURIComponent(c.id)}`}
                aria-current={active ? "page" : undefined}
                className={chipClass(active)}
              >
                {c.name}
                {!c.isActive && (
                  <span className="text-[10px] font-medium opacity-70">(nonaktif)</span>
                )}
                <span className={countClass(active)}>{c.assetCount}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {cards.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          {selectedComplex ? (
            <>
              Komplek <strong className="text-slate-700">{selectedComplex.name}</strong>{" "}
              belum punya aset. Tambahkan taman dan aset untuk komplek ini di halaman{" "}
              <Link href="/dashboard/wilayah" className="text-emerald-700 font-semibold hover:underline">
                Wilayah &amp; Aset
              </Link>
              ; QR akan dibuat otomatis.
            </>
          ) : (
            <>Belum ada aset. Tambahkan aset di halaman Wilayah &amp; Aset.</>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3">
          {cards.map(({ id, item, locationNote, inactiveReason }) => (
            <div
              key={id}
              className={`bg-white rounded-3xl border-2 p-5 flex flex-col items-center text-center shadow-xs hover:shadow-md transition break-inside-avoid justify-between ${
                inactiveReason ? "border-slate-300 opacity-70" : "border-slate-900/90"
              }`}
            >
              <div className="w-full">
                {inactiveReason && (
                  <div className="mb-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    {inactiveReason}
                  </div>
                )}
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                  {companyName}
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-0.5 truncate">
                  {item.parkName}
                </div>

                <div className="my-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.qrDataUrl}
                    alt={`QR ${item.assetCode}`}
                    className="w-36 h-36 mx-auto object-contain"
                  />
                  <div className="font-mono text-base font-extrabold text-slate-950 tracking-wider mt-1.5 break-all">
                    {item.assetCode}
                  </div>
                </div>

                <div className="font-extrabold text-sm text-slate-900 line-clamp-1">
                  {item.assetName}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Lokasi: {locationNote || "-"}
                </div>
              </div>

              <div className="w-full mt-3 print:hidden">
                <SingleCardQrActions item={item} />
                <div className="mt-2 text-center">
                  <Link
                    href={`/r/${encodeURIComponent(item.assetCode)}`}
                    target="_blank"
                    className="text-[11px] font-mono text-emerald-700 hover:underline break-all"
                  >
                    /r/{item.assetCode}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
