import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, History } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { activeAssignmentWhere } from "@/lib/scopes";
import { wibDateInputValue } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import { MasterDataForms } from "./master-data-forms";
import { WilayahHierarchyClient } from "./wilayah-hierarchy-client";
import type { HierarchyComplex } from "./wilayah-types";

export default async function WilayahPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const canView = hasPermission(session.role, "VIEW_MASTER_DATA");
  const canManage = hasPermission(session.role, "MANAGE_MASTER_DATA");
  const canViewAudit = hasPermission(session.role, "VIEW_AUDIT_LOGS");

  if (!canView) {
    return (
      <AccessDeniedNotice
        message={`Role ${ROLE_METADATA[session.role].label} tidak memiliki akses ke data wilayah & aset.`}
      />
    );
  }
  if (!session.companyId) {
    return (
      <DbErrorNotice
        title="Akun belum terhubung ke perusahaan"
        message="Hubungi Admin untuk menautkan akun Anda ke perusahaan."
      />
    );
  }

  const companyId = session.companyId;
  const now = new Date();

  // Pengelola hanya melihat cluster tempat ia bertugas; Manager melihat cluster yang ditugaskan.
  let clusterScope: string[] | null = null;

  let complexes: HierarchyComplex[];
  let categories: { id: string; name: string; damageTypes: string[]; isActive: boolean }[];

  try {
    if (session.role === "PENGELOLA") {
      clusterScope = session.staffClusterId ? [session.staffClusterId] : [];
    } else if (session.role === "MANAGER") {
      const assignments = await prisma.clusterManagerAssignment.findMany({
        where: { userId: session.id, ...activeAssignmentWhere(now) },
        select: { clusterId: true },
      });
      clusterScope = assignments.map((a) => a.clusterId);
    }

    const clusterWhere = clusterScope ? { id: { in: clusterScope } } : {};

    const [rawComplexes, rawCategories] = await Promise.all([
      prisma.complex.findMany({
        where: {
          companyId,
          ...(clusterScope ? { clusters: { some: clusterWhere } } : {}),
        },
        include: {
          clusters: {
            where: clusterWhere,
            orderBy: { name: "asc" },
            include: {
              staffUsers: {
                where: { role: "PENGELOLA", isActive: true },
                select: { name: true },
              },
              managerAssignments: {
                where: { ...activeAssignmentWhere(now), user: { isActive: true } },
                select: { isTemporary: true, user: { select: { name: true } } },
              },
              parks: {
                orderBy: { name: "asc" },
                include: {
                  assets: {
                    orderBy: { code: "asc" },
                    include: {
                      category: { select: { id: true, name: true, isActive: true } },
                      reports: {
                        where: { workOrder: { isNot: null } },
                        select: {
                          id: true,
                          workOrder: {
                            select: { spkNo: true, vendor: { select: { name: true } } },
                          },
                        },
                        orderBy: { createdAt: "desc" },
                        take: 3,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.category.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, damageTypes: true, isActive: true },
      }),
    ]);
    categories = rawCategories;

    const allCodes = rawComplexes.flatMap((c) =>
      c.clusters.flatMap((cl) => cl.parks.flatMap((p) => p.assets.map((a) => a.code)))
    );
    const qrEntries = await Promise.all(
      allCodes.map(async (code) => {
        try {
          const qr = await generateAssetQrDataUrl(code);
          return [code, qr.qrDataUrl] as const;
        } catch {
          return [code, null] as const;
        }
      })
    );
    const qrByCode = new Map(qrEntries);

    complexes = rawComplexes.map((comp) => ({
      id: comp.id,
      name: comp.name,
      address: comp.address,
      isActive: comp.isActive,
      clusters: comp.clusters.map((cl) => ({
        id: cl.id,
        name: cl.name,
        isActive: cl.isActive,
        pengelolaNames: cl.staffUsers.map((u) => u.name),
        managerNames: cl.managerAssignments.map((m) => ({
          name: m.user.name,
          isTemporary: m.isTemporary,
        })),
        parks: cl.parks.map((p) => ({
          id: p.id,
          name: p.name,
          locationNote: p.locationNote,
          isActive: p.isActive,
          assets: p.assets.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            locationNote: a.locationNote,
            photoUrl: a.photoUrl,
            installedAt: a.installedAt ? a.installedAt.toISOString() : null,
            isActive: a.isActive,
            category: a.category,
            qrDataUrl: qrByCode.get(a.code) ?? null,
            recentWork: a.reports
              .filter((r) => r.workOrder)
              .map((r) => ({
                id: r.id,
                vendorName: r.workOrder!.vendor.name,
                spkNo: r.workOrder!.spkNo,
              })),
          })),
        })),
      })),
    }));
  } catch (error) {
    console.error("[wilayah] gagal memuat data:", error);
    return <DbErrorNotice />;
  }

  // Dropdown form Admin hanya menawarkan induk yang aktif.
  const activeComplexes = complexes.filter((c) => c.isActive);
  const flatComplexes = activeComplexes.map((c) => ({ id: c.id, name: c.name }));
  const flatClusters = activeComplexes.flatMap((comp) =>
    comp.clusters
      .filter((cl) => cl.isActive)
      .map((cl) => ({ id: cl.id, name: cl.name, complexName: comp.name }))
  );
  const flatParks = activeComplexes.flatMap((comp) =>
    comp.clusters
      .filter((cl) => cl.isActive)
      .flatMap((cl) =>
        cl.parks
          .filter((p) => p.isActive)
          .map((p) => ({
            id: p.id,
            name: p.name,
            clusterName: cl.name,
            complexName: comp.name,
          }))
      )
  );

  const scopeText =
    session.role === "PENGELOLA"
      ? "Data wilayah dan aset di cluster tempat Anda bertugas."
      : session.role === "MANAGER"
        ? "Data wilayah dan aset di cluster yang Anda pegang."
        : canManage
          ? "Kelola komplek, cluster, taman, kategori, dan aset. Setiap aset otomatis mendapat kode QR untuk pelaporan warga."
          : "Data wilayah dan aset seluruh perusahaan (hanya lihat).";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Wilayah &amp; Aset
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              {scopeText}
            </p>
            <p className="text-[11px] text-slate-500">
              Urutan: {session.companyName} → Komplek → Cluster → Taman → Aset. Tautan
              QR berbentuk{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-800 border border-slate-200">
                /r/kode-aset
              </code>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canManage && (
              <Link
                href="/dashboard/wilayah/cetak-qr"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Stiker QR</span>
              </Link>
            )}
            {canViewAudit && (
              <Link
                href="/dashboard/audit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
              >
                <History className="w-4 h-4" />
                <span>Riwayat Perubahan</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <MasterDataForms
          complexes={flatComplexes}
          clusters={flatClusters}
          parks={flatParks}
          categories={categories}
          todayInput={wibDateInputValue(0)}
        />
      )}

      {complexes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-900">
          {clusterScope
            ? "Belum ada cluster yang ditugaskan ke akun Anda. Hubungi Admin."
            : canManage
              ? "Belum ada data komplek. Mulai dengan menambah komplek di panel di atas."
              : "Belum ada data wilayah untuk perusahaan ini."}
        </div>
      ) : (
        <WilayahHierarchyClient
          complexes={complexes}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            isActive: c.isActive,
          }))}
          canManage={canManage}
          companyName={session.companyName || undefined}
        />
      )}
    </div>
  );
}
