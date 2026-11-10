import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, History } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { MasterDataForms } from "./master-data-forms";
import { WilayahHierarchyClient } from "./wilayah-hierarchy-client";

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
          mengelola data master wilayah &amp; aset sesuai Matriks Hak Akses PRD.
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
                      include: {
                        category: true,
                        reports: {
                          where: { workOrder: { isNot: null } },
                          include: {
                            workOrder: {
                              include: { vendor: true },
                            },
                          },
                          orderBy: { createdAt: "desc" },
                          take: 3,
                        },
                      },
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
        complexName: comp.name,
      }))
    )
  );

  // Generate QR Data URL untuk seluruh aset
  const allAssets = complexes.flatMap((c) =>
    c.clusters.flatMap((cl) => cl.parks.flatMap((p) => p.assets))
  );
  const qrRecord: Record<string, { shortUrl: string; qrDataUrl: string }> = {};
  await Promise.all(
    allAssets.map(async (asset) => {
      const qr = await generateAssetQrDataUrl(asset.code);
      qrRecord[asset.code] = qr;
    })
  );

  return (
    <div className="space-y-6">
      {/* Phase Banner & Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                canManage
                  ? "bg-purple-50 text-purple-800 border-purple-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {canManage
                ? "Fase 1 – Mode Kelola Penuh (Admin)"
                : "Fase 1 – Mode Hanya Lihat (Read-Only)"}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Struktur Wilayah 5 Tingkat, Kategori, Aset &amp; Kode QR
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Hierarki wajib: Perusahaan (
              <strong>{session.companyName}</strong>) → Komplek → Cluster →
              Taman → Aset. Kode QR dibuat otomatis dengan tautan pendek{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-800 border border-slate-200">
                /r/&#123;kodeAset&#125;
              </code>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/dashboard/wilayah/cetak-qr"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Halaman Cetak QR Aset</span>
            </Link>
            {canManage && (
              <Link
                href="/dashboard/audit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
              >
                <History className="w-4 h-4" />
                <span>Riwayat Perubahan →</span>
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
        <WilayahHierarchyClient
          complexes={complexes}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          qrRecord={qrRecord}
          canManage={canManage}
        />
      )}
    </div>
  );
}
