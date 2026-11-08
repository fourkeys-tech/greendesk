import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { AssetEditForm } from "./asset-edit-form";
import { MasterDataForms } from "./master-data-forms";

export default async function WilayahPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const canView = hasPermission(session.role, "VIEW_MASTER_DATA");
  const canManage = hasPermission(session.role, "MANAGE_MASTER_DATA");

  if (!canView) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Role <strong>{session.role}</strong> tidak memiliki izin melihat atau
          mengelola data master wilayah & aset sesuai Matriks Hak Akses PRD.
        </p>
      </div>
    );
  }

  const [complexes, categories] = session.companyId
    ? await Promise.all([
        prisma.complex.findMany({
          where: { companyId: session.companyId },
          include: {
            clusters: {
              include: {
                parks: {
                  include: {
                    assets: {
                      include: { category: true },
                      orderBy: { code: "asc" },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.category.findMany({
          where: { companyId: session.companyId },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  // Siapkan daftar flat untuk dropdown form Admin
  const flatComplexes = complexes.map((c) => ({ id: c.id, name: c.name }));
  const flatClusters = complexes.flatMap((comp) =>
    comp.clusters.map((cl) => ({
      id: cl.id,
      name: cl.name,
      complexName: comp.name,
    }))
  );
  const flatParks = complexes.flatMap((comp) =>
    comp.clusters.flatMap((cl) =>
      cl.parks.map((p) => ({
        id: p.id,
        name: p.name,
        clusterName: cl.name,
      }))
    )
  );

  // Generate QR Data URL untuk seluruh aset
  const allAssets = complexes.flatMap((c) =>
    c.clusters.flatMap((cl) => cl.parks.flatMap((p) => p.assets))
  );
  const qrMap = new Map<string, { shortUrl: string; qrDataUrl: string }>();
  await Promise.all(
    allAssets.map(async (asset) => {
      const qr = await generateAssetQrDataUrl(asset.code);
      qrMap.set(asset.code, qr);
    })
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span
              className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 ${
                canManage
                  ? "bg-purple-100 text-purple-800 border border-purple-300"
                  : "bg-slate-100 text-slate-700 border border-slate-300"
              }`}
            >
              {canManage
                ? "Fase 1 – Mode Kelola Penuh (Admin)"
                : "Fase 1 – Mode Hanya Lihat (Read-Only)"}
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Struktur Wilayah 5 Tingkat, Kategori, Aset & Kode QR
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Hierarki wajib: Perusahaan ({session.companyName}) → Komplek →
              Cluster → Taman → Aset. Kode QR dibuat otomatis dengan tautan
              pendek <code>/r/&#123;kodeAset&#125;</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/wilayah/cetak-qr"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              🖨️ Halaman Cetak QR Aset
            </Link>
            {canManage && (
              <Link
                href="/dashboard/audit"
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                Lihat Riwayat Perubahan →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Form CRUD Data Master (Hanya untuk ADMIN) */}
      {canManage && (
        <MasterDataForms
          complexes={flatComplexes}
          clusters={flatClusters}
          parks={flatParks}
          categories={categories}
        />
      )}

      {complexes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-900">
          Belum ada data Komplek/Cluster untuk perusahaan{" "}
          <strong>{session.companyName}</strong>.
        </div>
      ) : (
        complexes.map((comp) => (
          <div
            key={comp.id}
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs"
          >
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase text-emerald-700">
                Tingkat 2: Komplek / Perumahan
              </div>
              <h2 className="text-lg font-bold text-slate-900">{comp.name}</h2>
              <p className="text-xs text-slate-500">{comp.address}</p>
            </div>

            <div className="space-y-4">
              {comp.clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3"
                >
                  <div>
                    <span className="text-xs font-semibold text-sky-700">
                      Tingkat 3: Cluster
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {cluster.name}
                    </h3>
                  </div>

                  {cluster.parks.map((park) => (
                    <div
                      key={park.id}
                      className="rounded-xl bg-white border border-slate-200 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-indigo-700">
                            Tingkat 4: Taman
                          </span>
                          <h4 className="font-bold text-sm text-slate-900">
                            {park.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Lokasi: {park.locationNote || "-"}
                          </p>
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                          {park.assets.length} Aset
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {park.assets.map((asset) => {
                          const qr = qrMap.get(asset.code);
                          return (
                            <div
                              key={asset.id}
                              className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 flex flex-col justify-between gap-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                                      {asset.code}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        asset.isActive
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {asset.isActive ? "Aktif" : "Nonaktif"}
                                    </span>
                                  </div>
                                  <div className="font-bold text-sm text-slate-900 mt-1">
                                    {asset.name}
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    Kategori:{" "}
                                    <strong>{asset.category.name}</strong>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Titik Lokasi: {asset.locationNote || "-"}
                                  </div>
                                  {asset.installedAt && (
                                    <div className="text-[11px] text-slate-400">
                                      Tanggal Pasang:{" "}
                                      {new Date(
                                        asset.installedAt
                                      ).toLocaleDateString("id-ID")}
                                    </div>
                                  )}
                                  {asset.photoUrl && (
                                    <img
                                      src={asset.photoUrl}
                                      alt={asset.name}
                                      className="h-20 w-28 object-cover rounded-lg border border-slate-200 mt-1.5"
                                    />
                                  )}
                                </div>

                                {/* QR Code Aset + Kode Aset Tercetak di Bawah QR */}
                                {qr && (
                                  <div className="flex flex-col items-center bg-white p-2 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                                    <img
                                      src={qr.qrDataUrl}
                                      alt={`QR ${asset.code}`}
                                      className="w-24 h-24"
                                    />
                                    <span className="font-mono text-[11px] font-extrabold text-slate-900 tracking-tight mt-1">
                                      {asset.code}
                                    </span>
                                    <Link
                                      href={`/r/${encodeURIComponent(asset.code)}`}
                                      className="mt-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                                    >
                                      Uji Scan QR →
                                    </Link>
                                  </div>
                                )}
                              </div>

                              {canManage && <AssetEditForm asset={asset} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
