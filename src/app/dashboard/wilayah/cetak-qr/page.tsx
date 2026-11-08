import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { PrintQrSheetButton } from "./print-button";

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 mb-2">
            Fase 1 – Cetak Stiker QR Aset Taman
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Lembar Cetak QR Aset ({session.companyName})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Setiap stiker QR memuat tautan pendek <code>/r/&#123;kodeAset&#125;</code>{" "}
            dan mencetak kode aset secara jelas di bawah gambar QR sesuai PRD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/wilayah"
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Kembali ke Wilayah
          </Link>
          <PrintQrSheetButton />
        </div>
      </div>

      {/* Grid Stiker QR Siap Cetak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3">
        {assetsWithQr.map(({ asset, qr }) => (
          <div
            key={asset.id}
            className="bg-white rounded-2xl border-2 border-slate-900 p-5 flex flex-col items-center text-center shadow-xs break-inside-avoid"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              {session.companyName}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">
              {asset.park.cluster.name} · {asset.park.name}
            </div>

            <div className="my-3 p-2 bg-white rounded-xl border border-slate-200">
              <img
                src={qr.qrDataUrl}
                alt={`QR ${asset.code}`}
                className="w-40 h-40 mx-auto"
              />
              {/* Kode aset wajib tercetak di bawah QR sesuai PRD Fase 1 */}
              <div className="font-mono text-base font-extrabold text-slate-950 tracking-wider mt-1">
                {asset.code}
              </div>
            </div>

            <div className="font-bold text-sm text-slate-900">{asset.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Lokasi: {asset.locationNote || "-"}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 w-full flex items-center justify-between text-[11px] text-slate-500">
              <span>Scan untuk lapor kerusakan</span>
              <Link
                href={`/r/${encodeURIComponent(asset.code)}`}
                className="font-mono text-emerald-700 font-semibold hover:underline print:text-slate-700"
              >
                /r/{asset.code}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

