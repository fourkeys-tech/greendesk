import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, History } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { query } from "@/lib/db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  ComplexRow,
  ParkRow,
} from "@/lib/db-types";
import { generateAssetQrDataUrl } from "@/lib/qr";
import { activeAssignmentSql } from "@/lib/scopes";
import { wibDateInputValue } from "@/lib/dates";
import { sanitizeMediaHref } from "@/lib/url-safety";
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
      clusterScope = session.staffClusterId
        ? (await query<{ id: string }>(
            `SELECT "id" FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
            [session.staffClusterId, companyId]
          )).map((cluster) => cluster.id)
        : [];
    } else if (session.role === "MANAGER") {
      const assignments = await query<{ clusterId: string }>(
        `SELECT cma."clusterId"
         FROM "ClusterManagerAssignment" cma
         JOIN "Cluster" cl ON cl."id" = cma."clusterId"
         WHERE cma."userId" = $1
           AND cl."companyId" = $2
           AND ${activeAssignmentSql("cma", "$3")}`,
        [session.id, companyId, now]
      );
      clusterScope = assignments.map((a) => a.clusterId);
    }

    const rawCategories = await query<{
      id: string;
      name: string;
      damageTypes: string[];
      isActive: boolean;
    }>(
      `SELECT "id", "name", "damageTypes", "isActive"
       FROM "Category"
       WHERE "companyId" = $1
       ORDER BY "name" ASC`,
      [companyId]
    );
    categories = rawCategories;

    if (clusterScope && clusterScope.length === 0) {
      complexes = [];
    } else {
      const [
        rawComplexes,
        rawClusters,
        rawParks,
        rawAssets,
        staffUsers,
        managerAssigns,
        recentWorks,
      ] = await Promise.all([
        clusterScope
          ? query<ComplexRow>(
              `SELECT DISTINCT c.*
               FROM "Complex" c
               JOIN "Cluster" cl ON cl."complexId" = c."id"
               WHERE c."companyId" = $1 AND cl."id" = ANY($2::text[])
               ORDER BY c."createdAt" ASC`,
              [companyId, clusterScope]
            )
          : query<ComplexRow>(
              `SELECT * FROM "Complex" WHERE "companyId" = $1 ORDER BY "createdAt" ASC`,
              [companyId]
            ),
        clusterScope
          ? query<ClusterRow>(
              `SELECT * FROM "Cluster"
               WHERE "companyId" = $1 AND "id" = ANY($2::text[])
               ORDER BY "name" ASC`,
              [companyId, clusterScope]
            )
          : query<ClusterRow>(
              `SELECT * FROM "Cluster" WHERE "companyId" = $1 ORDER BY "name" ASC`,
              [companyId]
            ),
        clusterScope
          ? query<ParkRow>(
              `SELECT * FROM "Park"
               WHERE "companyId" = $1 AND "clusterId" = ANY($2::text[])
               ORDER BY "name" ASC`,
              [companyId, clusterScope]
            )
          : query<ParkRow>(
              `SELECT * FROM "Park" WHERE "companyId" = $1 ORDER BY "name" ASC`,
              [companyId]
            ),
        clusterScope
          ? query<AssetRow>(
              `SELECT a.* FROM "Asset" a
               JOIN "Park" p ON p."id" = a."parkId"
               WHERE a."companyId" = $1 AND p."clusterId" = ANY($2::text[])
               ORDER BY a."code" ASC`,
              [companyId, clusterScope]
            )
          : query<AssetRow>(
              `SELECT * FROM "Asset" WHERE "companyId" = $1 ORDER BY "code" ASC`,
              [companyId]
            ),
        clusterScope
          ? query<{ name: string; staffClusterId: string }>(
              `SELECT "name", "staffClusterId"
               FROM "User"
               WHERE "companyId" = $1
                 AND "role" = 'PENGELOLA'::"Role"
                 AND "isActive" = true
                 AND "staffClusterId" = ANY($2::text[])`,
              [companyId, clusterScope]
            )
          : query<{ name: string; staffClusterId: string }>(
              `SELECT "name", "staffClusterId"
               FROM "User"
               WHERE "companyId" = $1
                 AND "role" = 'PENGELOLA'::"Role"
                 AND "isActive" = true
                 AND "staffClusterId" IS NOT NULL`,
              [companyId]
            ),
        clusterScope
          ? query<{ clusterId: string; isTemporary: boolean; userName: string }>(
              `SELECT cma."clusterId", cma."isTemporary", u."name" AS "userName"
               FROM "ClusterManagerAssignment" cma
               JOIN "User" u ON u."id" = cma."userId"
               WHERE u."companyId" = $1
                 AND cma."clusterId" = ANY($3::text[])
                 AND ${activeAssignmentSql("cma", "$2")}
                 AND u."isActive" = true`,
              [companyId, now, clusterScope]
            )
          : query<{ clusterId: string; isTemporary: boolean; userName: string }>(
              `SELECT cma."clusterId", cma."isTemporary", u."name" AS "userName"
               FROM "ClusterManagerAssignment" cma
               JOIN "User" u ON u."id" = cma."userId"
               WHERE u."companyId" = $1
                 AND ${activeAssignmentSql("cma", "$2")}
                 AND u."isActive" = true`,
              [companyId, now]
            ),
        query<{
          assetId: string;
          reportId: string;
          spkNo: string;
          vendorName: string;
        }>(
          `SELECT sub."assetId", sub."reportId", sub."spkNo", sub."vendorName"
           FROM (
             SELECT r."assetId",
                    r."id" AS "reportId",
                    wo."spkNo",
                    v."name" AS "vendorName",
                    ROW_NUMBER() OVER (PARTITION BY r."assetId" ORDER BY r."createdAt" DESC) AS rn
             FROM "Report" r
             JOIN "WorkOrder" wo ON wo."reportId" = r."id"
             JOIN "Vendor" v ON v."id" = wo."vendorId"
             JOIN "Asset" a ON a."id" = r."assetId"
             JOIN "Park" p ON p."id" = a."parkId"
             WHERE r."companyId" = $1
               AND r."archivedAt" IS NULL${clusterScope ? ` AND p."clusterId" = ANY($2::text[])` : ""}
           ) sub
           WHERE sub.rn <= 3`,
          clusterScope ? [companyId, clusterScope] : [companyId]
        ),
      ]);

      const categoryMap = new Map(
        rawCategories.map((c) => [
          c.id,
          { id: c.id, name: c.name, isActive: c.isActive },
        ])
      );
      const staffByCluster = new Map<string, string[]>();
      for (const u of staffUsers) {
        const arr = staffByCluster.get(u.staffClusterId) ?? [];
        arr.push(u.name);
        staffByCluster.set(u.staffClusterId, arr);
      }
      const managersByCluster = new Map<
        string,
        { name: string; isTemporary: boolean }[]
      >();
      for (const m of managerAssigns) {
        const arr = managersByCluster.get(m.clusterId) ?? [];
        arr.push({ name: m.userName, isTemporary: m.isTemporary });
        managersByCluster.set(m.clusterId, arr);
      }
      const worksByAsset = new Map<
        string,
        { id: string; vendorName: string; spkNo: string }[]
      >();
      for (const w of recentWorks) {
        const arr = worksByAsset.get(w.assetId) ?? [];
        arr.push({ id: w.reportId, vendorName: w.vendorName, spkNo: w.spkNo });
        worksByAsset.set(w.assetId, arr);
      }

      const qrEntries = await Promise.all(
        rawAssets.map(async (a) => {
          try {
            const qr = await generateAssetQrDataUrl(a.code);
            return [a.code, qr.qrDataUrl] as const;
          } catch {
            return [a.code, null] as const;
          }
        })
      );
      const qrByCode = new Map(qrEntries);

      const assetsByPark = new Map<string, HierarchyComplex["clusters"][number]["parks"][number]["assets"]>();
      for (const a of rawAssets) {
        const cat = categoryMap.get(a.categoryId);
        if (!cat) continue;
        const arr = assetsByPark.get(a.parkId) ?? [];
        arr.push({
          id: a.id,
          code: a.code,
          name: a.name,
          locationNote: a.locationNote,
          photoUrl: sanitizeMediaHref(a.photoUrl),
          installedAt: a.installedAt ? a.installedAt.toISOString() : null,
          isActive: a.isActive,
          category: cat,
          qrDataUrl: qrByCode.get(a.code) ?? null,
          recentWork: worksByAsset.get(a.id) ?? [],
        });
        assetsByPark.set(a.parkId, arr);
      }

      const parksByCluster = new Map<string, HierarchyComplex["clusters"][number]["parks"]>();
      for (const p of rawParks) {
        const arr = parksByCluster.get(p.clusterId) ?? [];
        arr.push({
          id: p.id,
          name: p.name,
          locationNote: p.locationNote,
          isActive: p.isActive,
          assets: assetsByPark.get(p.id) ?? [],
        });
        parksByCluster.set(p.clusterId, arr);
      }

      const clustersByComplex = new Map<string, HierarchyComplex["clusters"]>();
      for (const cl of rawClusters) {
        const arr = clustersByComplex.get(cl.complexId) ?? [];
        arr.push({
          id: cl.id,
          name: cl.name,
          isActive: cl.isActive,
          pengelolaNames: staffByCluster.get(cl.id) ?? [],
          managerNames: managersByCluster.get(cl.id) ?? [],
          parks: parksByCluster.get(cl.id) ?? [],
        });
        clustersByComplex.set(cl.complexId, arr);
      }

      complexes = rawComplexes.map((comp) => ({
        id: comp.id,
        name: comp.name,
        address: comp.address,
        isActive: comp.isActive,
        clusters: clustersByComplex.get(comp.id) ?? [],
      }));
    }
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
