import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  ShieldAlert,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { formatWibDate, wibDateInputValue } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import {
  getResponsibilityOverview,
  type ResponsibilityCluster,
  type ResponsibilityComplexGroup,
} from "@/lib/services/cluster-responsibility";
import {
  ClusterManagerEditor,
  ClusterPengelolaEditor,
  ClusterVendorEditor,
  ComplexBulkAssignForm,
} from "./cluster-assignment-forms";
import {
  ChangeVendorPicForm,
  StaffClusterEditor,
  VendorAreaEditor,
} from "./person-assignment-forms";
import {
  CancelDelegationButton,
  DelegationForm,
} from "./delegation-forms";

type Tab = "manager" | "vendor";
type View = "cluster" | "orang" | "vendor" | "delegasi";

function pageUrl(params: {
  tab?: Tab;
  view?: View;
  filter?: "kurang" | "semua";
  komplek?: string;
  cluster?: string;
}) {
  const p = new URLSearchParams();
  if (params.tab && params.tab !== "manager") p.set("tab", params.tab);
  if (params.view && params.view !== "cluster") p.set("view", params.view);
  if (params.filter === "kurang") p.set("filter", "kurang");
  if (params.komplek) p.set("komplek", params.komplek);
  if (params.cluster) p.set("cluster", params.cluster);
  const q = p.toString();
  return `/dashboard/penanggung-jawab${q ? `?${q}` : ""}`;
}

export default async function PenanggungJawabPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    filter?: string;
    komplek?: string;
    cluster?: string;
  }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "MANAGE_INTERNAL_ACCOUNTS")) {
    return (
      <AccessDeniedNotice message="Hanya Admin perusahaan yang dapat mengelola penanggung jawab wilayah." />
    );
  }

  if (!session.companyId) {
    return (
      <DbErrorNotice
        title="Akun belum terhubung ke perusahaan"
        message="Hubungi pemilik platform untuk menautkan akun Admin ini ke perusahaan."
      />
    );
  }

  const companyId = session.companyId;
  const params = await searchParams;

  const tab: Tab = params.tab === "vendor" ? "vendor" : "manager";
  const defaultView: View = tab === "vendor" ? "cluster" : "cluster";
  const view: View = (params.view as View) || defaultView;
  const filterKurang = params.filter === "kurang";
  const selectedKomplekId = params.komplek || "";
  const targetClusterId = params.cluster || "";

  const now = new Date();

  let overview: Awaited<ReturnType<typeof getResponsibilityOverview>>;
  let delegationHistory: Array<{
    id: string;
    validFrom: Date;
    validUntil: Date | null;
    cancelledAt: Date | null;
    replacedManagerId: string | null;
    cancelledById: string | null;
    user: { id: string; name: string };
    cluster: { name: string };
  }> = [];
  let nameById = new Map<string, string>();
  let permAssignments: Array<{ userId: string; clusterId: string }> = [];
  let vendorWorkOrderCounts = new Map<string, number>();

  try {
    const [overviewData, historyRows, permRows, woRows] = await Promise.all([
      getResponsibilityOverview(companyId, now),
      view === "delegasi" || tab === "manager"
        ? query<{
            id: string;
            validFrom: Date;
            validUntil: Date | null;
            cancelledAt: Date | null;
            replacedManagerId: string | null;
            cancelledById: string | null;
            userId: string;
            userName: string;
            clusterName: string;
          }>(
            `SELECT cma."id", cma."validFrom", cma."validUntil", cma."cancelledAt",
                    cma."replacedManagerId", cma."cancelledById",
                    u."id" AS "userId", u."name" AS "userName", cl."name" AS "clusterName"
             FROM "ClusterManagerAssignment" cma
             JOIN "Cluster" cl ON cl."id" = cma."clusterId"
             JOIN "User" u ON u."id" = cma."userId"
             WHERE cma."isTemporary" = true AND cl."companyId" = $1
             ORDER BY cma."createdAt" DESC
             LIMIT 50`,
            [companyId]
          )
        : Promise.resolve([]),
      query<{ userId: string; clusterId: string }>(
        `SELECT cma."userId", cma."clusterId"
         FROM "ClusterManagerAssignment" cma
         JOIN "User" u ON u."id" = cma."userId"
         WHERE u."companyId" = $1
           AND u."role" = 'MANAGER'::"Role"
           AND u."isActive" = true
           AND cma."isTemporary" = false`,
        [companyId]
      ),
      query<{ vendorId: string; count: number }>(
        `SELECT wo."vendorId", COUNT(*)::int AS count
         FROM "WorkOrder" wo
         JOIN "Report" r ON r."id" = wo."reportId"
         WHERE r."companyId" = $1
           AND r."archivedAt" IS NULL
           AND r."status" = ANY($2::"ReportStatus"[])
         GROUP BY wo."vendorId"`,
        [companyId, ["DISETUJUI", "DIKERJAKAN", "MENUNGGU_KONFIRMASI"]]
      ),
    ]);

    overview = overviewData;
    permAssignments = permRows;
    delegationHistory = historyRows.map((h) => ({
      id: h.id,
      validFrom: h.validFrom,
      validUntil: h.validUntil,
      cancelledAt: h.cancelledAt,
      replacedManagerId: h.replacedManagerId,
      cancelledById: h.cancelledById,
      user: { id: h.userId, name: h.userName },
      cluster: { name: h.clusterName },
    }));

    for (const w of woRows) {
      vendorWorkOrderCounts.set(w.vendorId, w.count);
    }

    const relatedIds = Array.from(
      new Set(
        delegationHistory.flatMap((h) =>
          [h.replacedManagerId, h.cancelledById].filter(Boolean) as string[]
        )
      )
    );
    if (relatedIds.length > 0) {
      try {
        const related = await query<{ id: string; name: string }>(
          `SELECT "id", "name" FROM "User" WHERE "id" = ANY($1::text[])`,
          [relatedIds]
        );
        nameById = new Map(related.map((u) => [u.id, u.name]));
      } catch {
        // fallback '-'
      }
    }
  } catch (err) {
    console.error("[penanggung-jawab] gagal memuat data:", err);
    return <DbErrorNotice />;
  }

  // Siapkan map cluster tetap per manager untuk form delegasi
  const permanentClusterIdsByManager: Record<string, string[]> = {};
  for (const m of overview.candidates.managers) {
    permanentClusterIdsByManager[m.id] = [];
  }
  for (const a of permAssignments) {
    permanentClusterIdsByManager[a.userId]?.push(a.clusterId);
  }

  // Flatten cluster options untuk form
  const allClusterOptions = overview.groups.flatMap((g) =>
    g.clusters.map((c) => ({ id: c.id, name: `${g.complex.name} – ${c.name}`, isActive: c.isActive }))
  );

  // Filter kelompok yang ditampilkan
  const filteredGroups = overview.groups
    .filter((g) => !selectedKomplekId || g.complex.id === selectedKomplekId)
    .map((g) => {
      const clusters = g.clusters.filter((c) => {
        if (filterKurang) {
          if (tab === "manager") {
            return c.isActive && g.complex.isActive && (c.missing.pengelola || c.missing.manager);
          }
          return c.isActive && g.complex.isActive && c.missing.vendor;
        }
        return true;
      });
      return { ...g, clusters };
    })
    .filter((g) => g.clusters.length > 0 || !filterKurang);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-1">
              <UserCog className="w-3.5 h-3.5" />
              Kelola Penanggung Jawab Wilayah
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Penanggung Jawab Cluster & Vendor
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Atur siapa Pengelola, Manager tetap, pengganti sementara, dan Vendor area layanan untuk setiap cluster.
              Sesuai proses bisnis, Komplek berfungsi sebagai pengelompokan; penugasan operasional berada di tingkat Cluster.
            </p>
          </div>

          {/* Ringkasan status kelengkapan */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {overview.summary.incompleteClusters > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{overview.summary.incompleteClusters}</strong> cluster belum lengkap
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Semua {overview.summary.activeClusters} cluster aktif lengkap</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Utama: Manager & Pengelola vs Vendor */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <nav aria-label="Tab penanggung jawab" className="flex gap-2">
            <Link
              href={pageUrl({ tab: "manager", view: "cluster" })}
              aria-current={tab === "manager" ? "page" : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-2 ${
                tab === "manager"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Manager & Pengelola
            </Link>
            <Link
              href={pageUrl({ tab: "vendor", view: "cluster" })}
              aria-current={tab === "vendor" ? "page" : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-2 ${
                tab === "vendor"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Building2 className="w-4 h-4" />
              Vendor Rekanan
            </Link>
          </nav>

          {/* Sub-view switcher per tab */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Tampilan:</span>
            <Link
              href={pageUrl({ tab, view: "cluster", filter: filterKurang ? "kurang" : "semua" })}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                view === "cluster"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Per Cluster
            </Link>
            {tab === "manager" ? (
              <>
                <Link
                  href={pageUrl({ tab: "manager", view: "orang" })}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    view === "orang"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Per Staf
                </Link>
                <Link
                  href={pageUrl({ tab: "manager", view: "delegasi" })}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    view === "delegasi"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Delegasi Manager ({delegationHistory.length})
                </Link>
              </>
            ) : (
              <Link
                href={pageUrl({ tab: "vendor", view: "vendor" })}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  view === "vendor"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Per Vendor ({overview.candidates.vendors.length})
              </Link>
            )}
          </div>
        </div>

        {/* Filter bar (hanya di tampilan cluster) */}
        {view === "cluster" && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium inline-flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filter:
              </span>
              <Link
                href={pageUrl({
                  tab,
                  view: "cluster",
                  filter: filterKurang ? "semua" : "kurang",
                  komplek: selectedKomplekId,
                })}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                  filterKurang
                    ? "bg-amber-100 border-amber-300 text-amber-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {filterKurang
                  ? "✓ Menampilkan: Hanya cluster belum lengkap"
                  : "Tampilkan hanya yang belum lengkap"}
              </Link>

              {overview.groups.length > 1 && (
                <div className="flex items-center gap-1.5 pl-2">
                  <span className="text-slate-500">Komplek:</span>
                  <Link
                    href={pageUrl({ tab, view: "cluster", filter: filterKurang ? "kurang" : "semua" })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      !selectedKomplekId
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Semua ({overview.groups.length})
                  </Link>
                  {overview.groups.map((g) => (
                    <Link
                      key={g.complex.id}
                      href={pageUrl({
                        tab,
                        view: "cluster",
                        filter: filterKurang ? "kurang" : "semua",
                        komplek: g.complex.id,
                      })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        selectedKomplekId === g.complex.id
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {g.complex.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="text-slate-500 text-[11px]">
              Menampilkan {filteredGroups.reduce((acc, g) => acc + g.clusters.length, 0)} cluster
            </div>
          </div>
        )}
      </div>

      {/* Konten sesuai tab dan view */}
      {view === "delegasi" ? (
        <DelegationView
          managers={overview.candidates.managers}
          clusters={allClusterOptions}
          permanentClusterIdsByManager={permanentClusterIdsByManager}
          delegationHistory={delegationHistory}
          nameById={nameById}
          now={now}
          defaultClusterId={targetClusterId}
        />
      ) : view === "orang" ? (
        <StaffPersonView
          candidates={overview.candidates}
          clusters={allClusterOptions}
          permAssignments={permAssignments}
        />
      ) : view === "vendor" ? (
        <VendorPersonView
          vendors={overview.candidates.vendors}
          groups={overview.groups}
          clusters={allClusterOptions}
          workOrderCounts={vendorWorkOrderCounts}
        />
      ) : (
        <ClusterView
          tab={tab}
          groups={filteredGroups}
          candidates={overview.candidates}
          now={now}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* View: Per Cluster (dikelompokkan per Komplek)                     */
/* ---------------------------------------------------------------- */

function ClusterView({
  tab,
  groups,
  candidates,
  now,
}: {
  tab: Tab;
  groups: ResponsibilityComplexGroup[];
  candidates: {
    pengelola: Array<{
      id: string;
      name: string;
      email: string;
      currentClusterId: string | null;
      currentClusterName: string | null;
    }>;
    managers: Array<{ id: string; name: string; email: string }>;
    vendors: Array<{ id: string; name: string; type: string; skills: string[] }>;
  };
  now: Date;
}) {
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        Tidak ada data cluster yang cocok dengan filter yang dipilih.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const activeClustersInGroup = group.clusters.filter((c) => c.isActive && group.complex.isActive);
        return (
          <div
            key={group.complex.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
          >
            {/* Header Komplek */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Komplek
                  </span>
                  {!group.complex.isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      Nonaktif
                    </span>
                  )}
                  {group.incompleteCount > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      {group.incompleteCount} cluster belum lengkap
                    </span>
                  )}
                </div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {group.complex.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{group.complex.address}</p>
              </div>

              {/* Aksi massal per komplek */}
              {activeClustersInGroup.length > 0 && (
                <div className="shrink-0 flex flex-wrap gap-2">
                  {tab === "manager" ? (
                    <ComplexBulkAssignForm
                      complexId={group.complex.id}
                      complexName={group.complex.name}
                      kind="manager"
                      candidates={candidates.managers.map((m) => ({
                        id: m.id,
                        name: m.name,
                        subtitle: m.email,
                      }))}
                      activeClusterCount={activeClustersInGroup.length}
                    />
                  ) : (
                    <ComplexBulkAssignForm
                      complexId={group.complex.id}
                      complexName={group.complex.name}
                      kind="vendor"
                      candidates={candidates.vendors.map((v) => ({
                        id: v.id,
                        name: v.name,
                        subtitle: `${v.type} · ${v.skills.join(", ")}`,
                      }))}
                      activeClusterCount={activeClustersInGroup.length}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Daftar Cluster */}
            {group.clusters.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                Tidak ada cluster di komplek ini yang cocok dengan filter.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {group.clusters.map((cluster) => (
                  <ClusterRowItem
                    key={cluster.id}
                    tab={tab}
                    cluster={cluster}
                    candidates={candidates}
                    now={now}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClusterRowItem({
  tab,
  cluster,
  candidates,
  now,
}: {
  tab: Tab;
  cluster: ResponsibilityCluster;
  candidates: {
    pengelola: Array<{
      id: string;
      name: string;
      email: string;
      currentClusterId: string | null;
      currentClusterName: string | null;
    }>;
    managers: Array<{ id: string; name: string; email: string }>;
    vendors: Array<{ id: string; name: string; type: string; skills: string[] }>;
  };
  now: Date;
}) {
  const activeSubstitutes = cluster.substitutes.filter(
    (s) => s.validFrom <= now && (!s.validUntil || s.validUntil >= now)
  );
  const scheduledSubstitutes = cluster.substitutes.filter((s) => s.validFrom > now);

  const isInactive = !cluster.isActive || !cluster.complexIsActive;

  return (
    <li
      className={`p-4 sm:p-5 transition ${
        isInactive
          ? "bg-slate-50/70 opacity-75"
          : cluster.isIncomplete
          ? "bg-amber-50/30"
          : "hover:bg-slate-50/50"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Identitas Cluster */}
        <div className="min-w-0 lg:w-1/4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              Cluster
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              {cluster.name}
            </h3>
            {!cluster.isActive && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Nonaktif
              </span>
            )}
          </div>

          {/* Warning badge */}
          {!isInactive && cluster.isIncomplete && (
            <div className="mt-2 space-y-1">
              {cluster.missing.pengelola && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  <ShieldAlert className="w-3 h-3" /> Belum ada Pengelola
                </div>
              )}
              {cluster.missing.manager && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  <ShieldAlert className="w-3 h-3" /> Belum ada Manager
                </div>
              )}
              {cluster.missing.vendor && (
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  <ShieldAlert className="w-3 h-3" /> Belum ada Vendor
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kolom detail penanggung jawab */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {tab === "manager" ? (
            <>
              {/* Kolom Pengelola */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Pengelola ({cluster.pengelola.length})
                  </span>
                  <ClusterPengelolaEditor
                    clusterId={cluster.id}
                    clusterName={cluster.name}
                    currentPengelolaIds={cluster.pengelola.map((p) => p.id)}
                    candidates={candidates.pengelola}
                  />
                </div>
                {cluster.pengelola.length === 0 ? (
                  <p className="text-rose-700 font-semibold text-xs">
                    Belum ditugaskan pengelola
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {cluster.pengelola.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-slate-800">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-[11px] text-slate-500">{p.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Kolom Manager Tetap & Pengganti */}
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                    Manager ({cluster.managers.length} tetap)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/penanggung-jawab?tab=manager&view=delegasi&cluster=${cluster.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold"
                    >
                      <Calendar className="w-3 h-3" />
                      Tunjuk Pengganti
                    </Link>
                    <ClusterManagerEditor
                      clusterId={cluster.id}
                      clusterName={cluster.name}
                      currentManagerIds={cluster.managers.map((m) => m.id)}
                      candidates={candidates.managers}
                    />
                  </div>
                </div>

                {cluster.managers.length === 0 ? (
                  <p className="text-rose-700 font-semibold text-xs">
                    Belum ada Manager tetap
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {cluster.managers.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-slate-800">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-[11px] text-slate-500">{m.email}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Delegasi pengganti */}
                {(activeSubstitutes.length > 0 || scheduledSubstitutes.length > 0) && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    {activeSubstitutes.map((s) => (
                      <div
                        key={s.assignmentId}
                        className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900"
                      >
                        <strong>{s.name}</strong> (pengganti {s.replacedManagerName})
                        <div className="text-[10px] text-amber-700">
                          Aktif s/d {formatWibDate(s.validUntil)}
                        </div>
                      </div>
                    ))}
                    {scheduledSubstitutes.map((s) => (
                      <div
                        key={s.assignmentId}
                        className="p-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-900"
                      >
                        <strong>{s.name}</strong> (terjadwal mulai {formatWibDate(s.validFrom)})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Kolom Vendor Area Layanan */
            <div className="md:col-span-2 p-3 rounded-xl bg-white border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Vendor Rekanan ({cluster.vendors.length} melayani cluster ini)
                </span>
                <ClusterVendorEditor
                  clusterId={cluster.id}
                  clusterName={cluster.name}
                  currentVendorIds={cluster.vendors.map((v) => v.id)}
                  candidates={candidates.vendors}
                />
              </div>

              {cluster.vendors.length === 0 ? (
                <p className="text-rose-700 font-semibold text-xs">
                  Belum ada vendor yang ditugaskan ke area ini. Manager tidak akan bisa menerbitkan SPK untuk aset di cluster ini.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cluster.vendors.map((v) => (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 truncate">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold shrink-0">
                          {v.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        PIC: <strong>{v.picName ?? "-"}</strong>
                        {v.picEmail ? ` (${v.picEmail})` : ""}
                      </div>
                      {v.skills.length > 0 && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {v.skills.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- */
/* View: Per Staf (Pengelola & Manager)                              */
/* ---------------------------------------------------------------- */

function StaffPersonView({
  candidates,
  clusters,
  permAssignments,
}: {
  candidates: {
    pengelola: Array<{
      id: string;
      name: string;
      email: string;
      currentClusterId: string | null;
      currentClusterName: string | null;
    }>;
    managers: Array<{ id: string; name: string; email: string }>;
  };
  clusters: Array<{ id: string; name: string; isActive: boolean }>;
  permAssignments: Array<{ userId: string; clusterId: string }>;
}) {
  const permByManager = new Map<string, string[]>();
  for (const a of permAssignments) {
    const list = permByManager.get(a.userId) ?? [];
    list.push(a.clusterId);
    permByManager.set(a.userId, list);
  }

  const clusterNameById = new Map(clusters.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Bagian Manager */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-sm font-bold text-slate-900">
            Daftar Estate Manager ({candidates.managers.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manager dapat memegang beberapa cluster tetap. Delegasi sementara diatur terpisah di tab Delegasi.
          </p>
        </div>
        <ul className="divide-y divide-slate-200">
          {candidates.managers.map((m) => {
            const cids = permByManager.get(m.id) ?? [];
            return (
              <li
                key={m.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900">{m.name}</div>
                  <div className="text-slate-500">{m.email}</div>
                  <div className="mt-1 text-slate-700">
                    Cluster tetap:{" "}
                    {cids.length === 0 ? (
                      <span className="text-rose-700 font-semibold">belum ada</span>
                    ) : (
                      <strong>
                        {cids.map((id) => clusterNameById.get(id) ?? id).join(", ")}
                      </strong>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <StaffClusterEditor
                    user={{
                      id: m.id,
                      name: m.name,
                      role: "MANAGER",
                      clusterIds: cids,
                    }}
                    clusters={clusters}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bagian Pengelola */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-sm font-bold text-slate-900">
            Daftar Pengelola Cluster ({candidates.pengelola.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sesuai proses bisnis, akun Pengelola wajib ditautkan tepat ke satu cluster.
          </p>
        </div>
        <ul className="divide-y divide-slate-200">
          {candidates.pengelola.map((p) => (
            <li
              key={p.id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-bold text-sm text-slate-900">{p.name}</div>
                <div className="text-slate-500">{p.email}</div>
                <div className="mt-1 text-slate-700">
                  Cluster penugasan:{" "}
                  {p.currentClusterName ? (
                    <strong>{p.currentClusterName}</strong>
                  ) : (
                    <span className="text-rose-700 font-semibold">belum ditautkan</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <StaffClusterEditor
                  user={{
                    id: p.id,
                    name: p.name,
                    role: "PENGELOLA",
                    clusterIds: p.currentClusterId ? [p.currentClusterId] : [],
                  }}
                  clusters={clusters}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* View: Per Vendor                                                 */
/* ---------------------------------------------------------------- */

function VendorPersonView({
  vendors,
  groups,
  clusters,
  workOrderCounts,
}: {
  vendors: Array<{ id: string; name: string; type: string; skills: string[] }>;
  groups: ResponsibilityComplexGroup[];
  clusters: Array<{ id: string; name: string; isActive: boolean }>;
  workOrderCounts: Map<string, number>;
}) {
  // Bangun map info lengkap vendor dari kumpulan cluster
  const fullVendorMap = new Map<
    string,
    {
      picName: string | null;
      picEmail: string | null;
      serviceClusterNames: string[];
      serviceClusterIds: string[];
    }
  >();

  for (const g of groups) {
    for (const c of g.clusters) {
      for (const v of c.vendors) {
        const cur = fullVendorMap.get(v.id) ?? {
          picName: v.picName,
          picEmail: v.picEmail,
          serviceClusterNames: [],
          serviceClusterIds: [],
        };
        cur.serviceClusterNames.push(`${g.complex.name} – ${c.name}`);
        cur.serviceClusterIds.push(c.id);
        fullVendorMap.set(v.id, cur);
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
        <h2 className="text-sm font-bold text-slate-900">
          Daftar Vendor Rekanan & Penanggung Jawab ({vendors.length})
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ganti akun PIC atau atur cluster yang masuk dalam area layanan tiap vendor.
        </p>
      </div>

      <ul className="divide-y divide-slate-200">
        {vendors.map((v) => {
          const detail = fullVendorMap.get(v.id);
          const activeWoCount = workOrderCounts.get(v.id) ?? 0;
          return (
            <li
              key={v.id}
              className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 text-xs"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">{v.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    {v.type}
                  </span>
                  {activeWoCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      {activeWoCount} SPK berjalan
                    </span>
                  )}
                </div>

                <div className="text-slate-600">
                  PIC saat ini:{" "}
                  <strong>{detail?.picName ?? "-"}</strong>
                  {detail?.picEmail ? ` (${detail.picEmail})` : ""}
                </div>

                {v.skills.length > 0 && (
                  <div className="text-slate-500 text-[11px]">
                    Keahlian: {v.skills.join(", ")}
                  </div>
                )}

                <div className="text-slate-700 pt-1">
                  Area Layanan ({detail?.serviceClusterIds.length ?? 0} cluster):{" "}
                  {detail && detail.serviceClusterNames.length > 0 ? (
                    <strong className="text-slate-900">
                      {detail.serviceClusterNames.join(", ")}
                    </strong>
                  ) : (
                    <span className="text-rose-700 font-semibold">
                      Belum memiliki area layanan (SPK tidak bisa diterbitkan)
                    </span>
                  )}
                </div>
              </div>

              {/* Tombol aksi */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ChangeVendorPicForm
                  vendorId={v.id}
                  vendorName={v.name}
                  currentPic={
                    detail?.picName && detail.picEmail
                      ? { name: detail.picName, email: detail.picEmail }
                      : null
                  }
                  eligibleExistingPics={[]}
                />
                <VendorAreaEditor
                  vendorId={v.id}
                  vendorName={v.name}
                  currentClusterIds={detail?.serviceClusterIds ?? []}
                  clusters={clusters}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* View: Delegasi Manager                                           */
/* ---------------------------------------------------------------- */

function delegationStatus(
  a: {
    validFrom: Date;
    validUntil: Date | null;
    cancelledAt: Date | null;
  },
  now: Date
) {
  if (a.cancelledAt) return { label: "Dibatalkan", cls: "bg-slate-200 text-slate-700", cancellable: false };
  if (a.validFrom > now) return { label: "Terjadwal", cls: "bg-sky-100 text-sky-800", cancellable: true };
  if (!a.validUntil || a.validUntil >= now)
    return { label: "Aktif", cls: "bg-emerald-100 text-emerald-800", cancellable: true };
  return { label: "Selesai", cls: "bg-slate-100 text-slate-600", cancellable: false };
}

function DelegationView({
  managers,
  clusters,
  permanentClusterIdsByManager,
  delegationHistory,
  nameById,
  now,
  defaultClusterId,
}: {
  managers: Array<{ id: string; name: string; email: string }>;
  clusters: Array<{ id: string; name: string; isActive: boolean }>;
  permanentClusterIdsByManager: Record<string, string[]>;
  delegationHistory: Array<{
    id: string;
    validFrom: Date;
    validUntil: Date | null;
    cancelledAt: Date | null;
    replacedManagerId: string | null;
    cancelledById: string | null;
    user: { id: string; name: string };
    cluster: { name: string };
  }>;
  nameById: Map<string, string>;
  now: Date;
  defaultClusterId?: string;
}) {
  return (
    <div className="space-y-6">
      <DelegationForm
        managers={managers}
        clusters={clusters}
        permanentClusterIdsByManager={permanentClusterIdsByManager}
        defaultFrom={wibDateInputValue(0)}
        defaultUntil={wibDateInputValue(7)}
        defaultClusterId={defaultClusterId}
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat Delegasi Manager ({delegationHistory.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Penunjukan sementara yang dibatalkan tetap tersimpan untuk kebutuhan audit.
          </p>
        </div>

        {delegationHistory.length === 0 ? (
          <p className="p-5 text-xs text-slate-500">Belum ada delegasi.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {delegationHistory.map((h) => {
              const st = delegationStatus(h, now);
              const replacedName = h.replacedManagerId
                ? nameById.get(h.replacedManagerId) ?? "-"
                : "-";
              return (
                <li
                  key={h.id}
                  className="p-4 sm:px-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] gap-3 items-start text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900">
                      {h.user.name}{" "}
                      <span className="font-normal text-slate-500">menggantikan</span>{" "}
                      {replacedName}
                    </div>
                    <div className="text-slate-700">Cluster: <strong>{h.cluster.name}</strong></div>
                    {h.cancelledAt && (
                      <div className="text-[11px] text-slate-500">
                        Dibatalkan {formatWibDate(h.cancelledAt)}
                        {h.cancelledById ? ` oleh ${nameById.get(h.cancelledById) ?? "-"}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-slate-700">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    <div className="mt-1">
                      {formatWibDate(h.validFrom)} – {formatWibDate(h.validUntil)}
                    </div>
                  </div>
                  <div>
                    {st.cancellable && (
                      <CancelDelegationButton
                        assignmentId={h.id}
                        label={`${h.user.name} di ${h.cluster.name}`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
