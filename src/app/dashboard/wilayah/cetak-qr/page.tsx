import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateAssetQrDataUrl } from "@/lib/qr";
import {
  PrintQrSheetButton,
  SingleCardQrActions,
  type QrPrintItem,
} from "./print-button";

export default async function CetakQrPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "VIEW_MASTER_DATA")) {
    redirect("/dashboard");
  }

  const assets = session.companyId
    ? await prisma.asset.findMany({
        where: { companyId: session.companyId },
        include: {
          park: {
            include: {
              cluster: {
                include: { complex: true },
              },
            },
          },
          category: true,
        },
        orderBy: { code: "asc" },
      })
    : [];

  const assetsWithQr = await Promise.all(
    assets.map(async (asset) => {
      const qr = await generateAssetQrDataUrl(asset.code);
      return { asset, qr };
    })
  );

  const qrPrintItems: QrPrintItem[] = assetsWithQr.map(({ asset, qr }) => ({
    qrDataUrl: qr.qrDataUrl,
    assetCode: asset.code,
    assetName: asset.name,
    parkName: `${asset.park.cluster.name} · ${asset.park.name}`,
    companyName: session.companyName || undefined,
  }));

  return (
    <div className="w-full space-y-6">
      {/* Header Halaman (Hanya Tampil di Layar, Tersembunyi saat Cetak) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Fase 1 · Cetak Stiker &amp; Unduh Gambar QR Aset
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Lembar Cetak QR Aset ({session.companyName})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Pilih cetak lembar stiker QR langsung, cetak per-stiker aset, atau
            unduh data gambar QR code (.png) untuk keperluan pencetakan fisik di
            lapangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/90 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Kembali ke Wilayah</span>
          </Link>
          <PrintQrSheetButton
            items={qrPrintItems}
            companyName={session.companyName || undefined}
          />
        </div>
      </div>

      {/* Grid Stiker QR Siap Cetak & Unduh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3">
        {assetsWithQr.map(({ asset, qr }) => {
          const item: QrPrintItem = {
            qrDataUrl: qr.qrDataUrl,
            assetCode: asset.code,
            assetName: asset.name,
            parkName: `${asset.park.cluster.name} · ${asset.park.name}`,
            companyName: session.companyName || undefined,
          };

          return (
            <div
              key={asset.id}
              className="bg-white rounded-3xl border-2 border-slate-900/90 p-5 flex flex-col items-center text-center shadow-xs hover:shadow-md transition break-inside-avoid justify-between"
            >
              <div className="w-full">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                  {session.companyName}
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-0.5 truncate">
                  {asset.park.cluster.name} · {asset.park.name}
                </div>

                <div className="my-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr.qrDataUrl}
                    alt={`QR ${asset.code}`}
                    className="w-36 h-36 mx-auto object-contain"
                  />
                  {/* Kode aset tercetak di bawah QR */}
                  <div className="font-mono text-base font-extrabold text-slate-950 tracking-wider mt-1.5">
                    {asset.code}
                  </div>
                </div>

                <div className="font-extrabold text-sm text-slate-900 line-clamp-1">
                  {asset.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Lokasi: {asset.locationNote || "-"}
                </div>
              </div>

              {/* Action Buttons: Cetak Gambar QR Ini & Unduh PNG */}
              <div className="w-full mt-3 print:hidden">
                <SingleCardQrActions item={item} />
                <div className="mt-2 text-center">
                  <Link
                    href={`/r/${encodeURIComponent(asset.code)}`}
                    target="_blank"
                    className="text-[11px] font-mono text-emerald-700 hover:underline"
                  >
                    /r/{asset.code} ↗
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
