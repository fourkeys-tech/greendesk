import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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

export default async function CetakQrPage() {
  const session = await getCurrentSession();
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

  let cards: {
    id: string;
    item: QrPrintItem;
    locationNote: string | null;
    inactiveReason: string | null;
  }[];

  try {
    const assets = await prisma.asset.findMany({
      where: { companyId: session.companyId },
      include: {
        park: { include: { cluster: { include: { complex: true } } } },
        category: true,
      },
      orderBy: { code: "asc" },
    });

    cards = await Promise.all(
      assets.map(async (asset) => {
        const qr = await generateAssetQrDataUrl(asset.code);
        return {
          id: asset.id,
          locationNote: asset.locationNote,
          inactiveReason: assetUnreportableReason(asset),
          item: {
            qrDataUrl: qr.qrDataUrl,
            assetCode: asset.code,
            assetName: asset.name,
            parkName: `${asset.park.cluster.name} · ${asset.park.name}`,
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

      {cards.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          Belum ada aset. Tambahkan aset di halaman Wilayah &amp; Aset.
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
