import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import {
  hasPermission,
  REPORTER_REVIEW_THRESHOLD,
  ROLE_METADATA,
} from "@/lib/permissions";
import { query, queryCount } from "@/lib/db";
import type { Role } from "@/lib/db-types";
import { activeAssignmentSql, reporterInCompanySql } from "@/lib/scopes";
import { formatWibDate, wibDateInputValue } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import {
  ReporterBlockActions,
  StaffRowActions,
  CreateStaffForm,
} from "./internal-account-forms";

type Tab = "staf" | "pelapor";
const PAGE_SIZE = 25;

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "staf", label: "Staf Internal" },
  { key: "pelapor", label: "Pelapor & Blokir" },
];

function tabHref(tab: Tab, extra?: Record<string, string>) {
  const params = new URLSearchParams({ tab, ...(extra ?? {}) });
  return `/dashboard/akun?${params.toString()}`;
}

export default async function AkunInternalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "MANAGE_INTERNAL_ACCOUNTS")) {
    return (
      <AccessDeniedNotice message="Hanya Admin perusahaan yang dapat mengelola akun internal dan memblokir akun pelapor." />
    );
  }

  const params = await searchParams;
  if (params.tab === "delegasi") {
    redirect("/dashboard/penanggung-jawab?tab=manager&view=delegasi");
  }
  const tab: Tab = TABS.some((t) => t.key === params.tab)
    ? (params.tab as Tab)
    : "staf";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">
          Akun & Pengguna
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Kelola akun staf internal Pengelola dan Manager {session.companyName ? `di ${session.companyName}` : ""} serta
          blokir pelapor bermasalah. Penugasan cluster & delegasi diatur di menu <strong>Penanggung Jawab</strong>.
        </p>
        <nav
          aria-label="Bagian halaman akun"
          className="mt-4 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1"
        >
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {!session.companyId ? (
        <DbErrorNotice
          title="Akun belum terhubung ke perusahaan"
          message="Hubungi pemilik platform untuk menautkan akun Admin ini ke perusahaan."
        />
      ) : tab === "staf" ? (
        <StaffTab companyId={session.companyId} selfId={session.id} />
      ) : (
        <ReporterTab
          companyId={session.companyId}
          q={params.q?.trim() ?? ""}
          page={Math.max(1, Number(params.page) || 1)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
async function StaffTab({
  companyId,
  selfId,
}: {
  companyId: string;
  selfId: string;
}) {
  const now = new Date();
  let users: Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    staffClusterId: string | null;
    staffCluster: { name: string } | null;
    managerAssignments: Array<{
      id: string;
      clusterId: string;
      isTemporary: boolean;
      validUntil: Date | null;
      cluster: { name: string };
    }>;
  }>;
  let clusters: Array<{ id: string; name: string; isActive: boolean }>;

  try {
    const [userRows, assignmentRows, clusterRows] = await Promise.all([
      query<{
        id: string;
        name: string;
        email: string;
        role: Role;
        isActive: boolean;
        staffClusterId: string | null;
        staffClusterName: string | null;
      }>(
        `SELECT u."id", u."name", u."email", u."role", u."isActive",
                u."staffClusterId", sc."name" AS "staffClusterName"
         FROM "User" u
         LEFT JOIN "Cluster" sc ON sc."id" = u."staffClusterId"
         WHERE u."companyId" = $1
           AND u."role"::text = ANY($2::text[])
         ORDER BY u."role" ASC, u."name" ASC`,
        [companyId, ["ADMIN", "OWNER", "MANAGER", "PENGELOLA"]]
      ),
      query<{
        id: string;
        userId: string;
        clusterId: string;
        isTemporary: boolean;
        validUntil: Date | null;
        clusterName: string;
      }>(
        `SELECT cma."id", cma."userId", cma."clusterId", cma."isTemporary", cma."validUntil",
                cl."name" AS "clusterName"
         FROM "ClusterManagerAssignment" cma
         JOIN "User" u ON u."id" = cma."userId"
         JOIN "Cluster" cl ON cl."id" = cma."clusterId"
         WHERE u."companyId" = $1
           AND u."role" IN ('ADMIN', 'OWNER', 'MANAGER', 'PENGELOLA')
           AND (cma."isTemporary" = false OR (cma."isTemporary" = true AND ${activeAssignmentSql("cma", "$2")}))`,
        [companyId, now]
      ),
      query<{ id: string; name: string; isActive: boolean }>(
        `SELECT "id", "name", "isActive"
         FROM "Cluster"
         WHERE "companyId" = $1
         ORDER BY "name" ASC`,
        [companyId]
      ),
    ]);

    const assignmentsByUser = new Map<
      string,
      Array<{
        id: string;
        clusterId: string;
        isTemporary: boolean;
        validUntil: Date | null;
        cluster: { name: string };
      }>
    >();
    for (const a of assignmentRows) {
      const list = assignmentsByUser.get(a.userId) ?? [];
      list.push({
        id: a.id,
        clusterId: a.clusterId,
        isTemporary: a.isTemporary,
        validUntil: a.validUntil,
        cluster: { name: a.clusterName },
      });
      assignmentsByUser.set(a.userId, list);
    }

    users = userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      staffClusterId: u.staffClusterId,
      staffCluster: u.staffClusterName ? { name: u.staffClusterName } : null,
      managerAssignments: assignmentsByUser.get(u.id) ?? [],
    }));
    clusters = clusterRows;
  } catch (error) {
    console.error("[akun/staf] gagal memuat data:", error);
    return <DbErrorNotice />;
  }

  return (
    <div className="space-y-6">
      <CreateStaffForm clusters={clusters} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">
            Daftar staf internal ({users.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Akun PIC Vendor dan Teknisi dikelola di menu Vendor. Akun Admin dan
            Owner dibuat oleh pemilik platform.
          </p>
        </div>
        {users.length === 0 ? (
          <p className="p-5 text-xs text-slate-500">Belum ada akun staf.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {users.map((u) => {
              const meta = ROLE_METADATA[u.role];
              const editable = u.role === "PENGELOLA" || u.role === "MANAGER";
              const permanent = u.managerAssignments.filter((a) => !a.isTemporary);
              const temporary = u.managerAssignments.filter((a) => a.isTemporary);
              const clusterIds =
                u.role === "PENGELOLA"
                  ? u.staffClusterId
                    ? [u.staffClusterId]
                    : []
                  : permanent.map((a) => a.clusterId);
              return (
                <li
                  key={u.id}
                  className={`p-4 sm:px-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-3 ${
                    u.isActive ? "" : "bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {u.name}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                      >
                        {meta.label}
                      </span>
                      {!u.isActive && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Nonaktif
                        </span>
                      )}
                      {u.id === selfId && (
                        <span className="text-[11px] text-slate-500">(Anda)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 break-all">{u.email}</div>
                  </div>
                  <div className="text-xs text-slate-700">
                    {u.role === "PENGELOLA" ? (
                      u.staffCluster ? (
                        <span>
                          Cluster: <strong>{u.staffCluster.name}</strong>
                        </span>
                      ) : (
                        <span className="text-rose-700">Belum ditautkan ke cluster</span>
                      )
                    ) : u.role === "MANAGER" ? (
                      <div className="space-y-1">
                        <div>
                          Cluster tetap:{" "}
                          {permanent.length > 0 ? (
                            <strong>{permanent.map((a) => a.cluster.name).join(", ")}</strong>
                          ) : (
                            <span className="text-rose-700">belum ada</span>
                          )}
                        </div>
                        {temporary.map((a) => (
                          <div key={a.id}>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold">
                              Pengganti di {a.cluster.name} s/d {formatWibDate(a.validUntil)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">{meta.scopeDescription}</span>
                    )}
                  </div>
                  <div>
                    {editable ? (
                      <StaffRowActions
                        user={{
                          id: u.id,
                          name: u.name,
                          role: u.role as "PENGELOLA" | "MANAGER",
                          isActive: u.isActive,
                          clusterIds,
                        }}
                        clusters={clusters}
                        isSelf={u.id === selfId}
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Dikelola pemilik platform
                      </span>
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

/* ---------------------------------------------------------------- */
async function ReporterTab({
  companyId,
  q,
  page,
}: {
  companyId: string;
  q: string;
  page: number;
}) {
  type ReporterRow = {
    id: string;
    name: string;
    email: string;
    reporterStatus: string | null;
    blockHouseNo: string | null;
    validReportCount: number;
    invalidReportCount: number;
    isBlocked: boolean;
    blockedReason: string | null;
    createdAt: Date;
  };

  let total: number;
  let reporters: ReporterRow[];
  let blockedCount: number;

  try {
    const searchParamsList: unknown[] = [companyId];
    const searchClause = q
      ? (() => {
          searchParamsList.push(`%${q}%`);
          return ` AND (u."name" ILIKE $2 OR u."email" ILIKE $2)`;
        })()
      : "";
    const baseWhere = `${reporterInCompanySql("u", "$1")}${searchClause}`;
    const listParams = [...searchParamsList, PAGE_SIZE, (page - 1) * PAGE_SIZE];
    const limitIdx = searchParamsList.length + 1;
    const offsetIdx = searchParamsList.length + 2;

    [total, reporters, blockedCount] = await Promise.all([
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "User" u WHERE ${baseWhere}`,
        searchParamsList
      ),
      query<ReporterRow>(
        `SELECT u."id", u."name", u."email", u."reporterStatus", u."blockHouseNo",
                u."validReportCount", u."invalidReportCount", u."isBlocked",
                u."blockedReason", u."createdAt"
         FROM "User" u
         WHERE ${baseWhere}
         ORDER BY u."isBlocked" DESC, u."invalidReportCount" DESC, u."name" ASC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        listParams
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count
         FROM "User" u
         WHERE ${reporterInCompanySql("u", "$1")} AND u."isBlocked" = true`,
        [companyId]
      ),
    ]);
  } catch (error) {
    console.error("[akun/pelapor] gagal memuat data:", error);
    return <DbErrorNotice />;
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Pelapor ({total}) · {blockedCount} diblokir
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelapor dengan {REPORTER_REVIEW_THRESHOLD} laporan tidak valid atau
            lebih ditandai &quot;Perlu ditinjau&quot;. Blokir berlaku langsung.
          </p>
        </div>
        <form method="get" action="/dashboard/akun" className="flex gap-2 w-full sm:w-auto">
          <input type="hidden" name="tab" value="pelapor" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama atau email"
            aria-label="Cari pelapor"
            className="flex-1 sm:w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
          >
            Cari
          </button>
        </form>
      </div>

      {reporters.length === 0 ? (
        <p className="p-5 text-xs text-slate-500">
          {q ? `Tidak ada pelapor yang cocok dengan "${q}".` : "Belum ada pelapor."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {reporters.map((r) => {
            const needsReview =
              !r.isBlocked && r.invalidReportCount >= REPORTER_REVIEW_THRESHOLD;
            return (
              <li
                key={r.id}
                className={`p-4 sm:px-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 ${
                  r.isBlocked ? "bg-rose-50/50" : needsReview ? "bg-amber-50/60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">{r.name}</span>
                    {r.isBlocked && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        Diblokir
                      </span>
                    )}
                    {needsReview && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        Perlu ditinjau
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 break-all">{r.email}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.reporterStatus === "PENGUNJUNG" ? "Pengunjung" : r.reporterStatus === "WARGA" ? "Warga" : "Status belum diisi"}
                    {r.blockHouseNo ? ` · ${r.blockHouseNo}` : ""} · Daftar {formatWibDate(r.createdAt)}
                  </div>
                  {r.isBlocked && r.blockedReason && (
                    <div className="text-[11px] text-rose-700 mt-1">
                      Alasan: {r.blockedReason}
                    </div>
                  )}
                </div>
                <div className="text-xs">
                  <div className="text-emerald-700 font-semibold">
                    Valid: {r.validReportCount}
                  </div>
                  <div className="text-rose-700 font-semibold">
                    Tidak valid: {r.invalidReportCount}
                  </div>
                </div>
                <div>
                  <ReporterBlockActions userId={r.id} name={r.name} isBlocked={r.isBlocked} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={tabHref("pelapor", { ...(q ? { q } : {}), page: String(page - 1) })}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700"
              >
                Sebelumnya
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={tabHref("pelapor", { ...(q ? { q } : {}), page: String(page + 1) })}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700"
              >
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
