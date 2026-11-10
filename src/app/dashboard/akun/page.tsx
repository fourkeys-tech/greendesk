import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import {
  hasPermission,
  REPORTER_REVIEW_THRESHOLD,
  ROLE_METADATA,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { activeAssignmentWhere, reporterInCompanyWhere } from "@/lib/scopes";
import { formatWibDate, wibDateInputValue } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import {
  CancelDelegationButton,
  CreateStaffForm,
  DelegationForm,
  ReporterBlockActions,
  StaffRowActions,
} from "./internal-account-forms";

type Tab = "staf" | "pelapor" | "delegasi";
const PAGE_SIZE = 25;

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "staf", label: "Staf Internal" },
  { key: "pelapor", label: "Pelapor & Blokir" },
  { key: "delegasi", label: "Delegasi Manager" },
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
          Kelola akun Pengelola dan Manager {session.companyName ? `di ${session.companyName}` : ""},
          blokir pelapor bermasalah, dan atur Manager pengganti sementara.
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
      ) : tab === "pelapor" ? (
        <ReporterTab
          companyId={session.companyId}
          q={params.q?.trim() ?? ""}
          page={Math.max(1, Number(params.page) || 1)}
        />
      ) : (
        <DelegationTab companyId={session.companyId} />
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
  let data;
  try {
    data = await Promise.all([
      prisma.user.findMany({
        where: {
          companyId,
          role: { in: ["ADMIN", "OWNER", "MANAGER", "PENGELOLA"] },
        },
        include: {
          staffCluster: true,
          managerAssignments: {
            where: {
              OR: [{ isTemporary: false }, { isTemporary: true, ...activeAssignmentWhere(now) }],
            },
            include: { cluster: true },
          },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.cluster.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, isActive: true },
      }),
    ]);
  } catch (error) {
    console.error("[akun/staf] gagal memuat data:", error);
    return <DbErrorNotice />;
  }
  const [users, clusters] = data;

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
  const where = {
    AND: [
      reporterInCompanyWhere(companyId),
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  let data;
  try {
    data = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ isBlocked: "desc" }, { invalidReportCount: "desc" }, { name: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          reporterStatus: true,
          blockHouseNo: true,
          validReportCount: true,
          invalidReportCount: true,
          isBlocked: true,
          blockedReason: true,
          createdAt: true,
        },
      }),
      prisma.user.count({
        where: { ...reporterInCompanyWhere(companyId), isBlocked: true },
      }),
    ]);
  } catch (error) {
    console.error("[akun/pelapor] gagal memuat data:", error);
    return <DbErrorNotice />;
  }
  const [total, reporters, blockedCount] = data;
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

/* ---------------------------------------------------------------- */
function delegationStatus(a: {
  validFrom: Date;
  validUntil: Date | null;
  cancelledAt: Date | null;
}, now: Date) {
  if (a.cancelledAt) return { label: "Dibatalkan", cls: "bg-slate-200 text-slate-700", cancellable: false };
  if (a.validFrom > now) return { label: "Terjadwal", cls: "bg-sky-100 text-sky-800", cancellable: true };
  if (!a.validUntil || a.validUntil >= now)
    return { label: "Aktif", cls: "bg-emerald-100 text-emerald-800", cancellable: true };
  return { label: "Selesai", cls: "bg-slate-100 text-slate-600", cancellable: false };
}

async function DelegationTab({ companyId }: { companyId: string }) {
  const now = new Date();
  let data;
  try {
    data = await Promise.all([
      prisma.user.findMany({
        where: { companyId, role: "MANAGER", isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          managerAssignments: {
            where: { isTemporary: false },
            select: { clusterId: true },
          },
        },
      }),
      prisma.cluster.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, isActive: true },
      }),
      prisma.clusterManagerAssignment.findMany({
        where: { isTemporary: true, cluster: { companyId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true } },
          cluster: { select: { name: true } },
        },
      }),
    ]);
  } catch (error) {
    console.error("[akun/delegasi] gagal memuat data:", error);
    return <DbErrorNotice />;
  }
  const [managers, clusters, history] = data;

  const relatedIds = Array.from(
    new Set(
      history.flatMap((h) => [h.replacedManagerId, h.cancelledById].filter(Boolean) as string[])
    )
  );
  let nameById = new Map<string, string>();
  if (relatedIds.length > 0) {
    try {
      const related = await prisma.user.findMany({
        where: { id: { in: relatedIds } },
        select: { id: true, name: true },
      });
      nameById = new Map(related.map((u) => [u.id, u.name]));
    } catch {
      // nama tetap tampil sebagai "-"
    }
  }

  const permanentClusterIdsByManager: Record<string, string[]> = {};
  for (const m of managers) {
    permanentClusterIdsByManager[m.id] = m.managerAssignments.map((a) => a.clusterId);
  }

  return (
    <div className="space-y-6">
      <DelegationForm
        managers={managers.map((m) => ({ id: m.id, name: m.name, email: m.email }))}
        clusters={clusters}
        permanentClusterIdsByManager={permanentClusterIdsByManager}
        defaultFrom={wibDateInputValue(0)}
        defaultUntil={wibDateInputValue(7)}
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat delegasi (50 terakhir)
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="p-5 text-xs text-slate-500">Belum ada delegasi.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {history.map((h) => {
              const st = delegationStatus(h, now);
              const replacedName = h.replacedManagerId
                ? nameById.get(h.replacedManagerId) ?? "-"
                : "-";
              return (
                <li
                  key={h.id}
                  className="p-4 sm:px-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] gap-3 items-start"
                >
                  <div className="text-xs text-slate-700 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {h.user.name}{" "}
                      <span className="font-normal text-slate-500">menggantikan</span>{" "}
                      {replacedName}
                    </div>
                    <div>Cluster: {h.cluster.name}</div>
                    {h.cancelledAt && (
                      <div className="text-[11px] text-slate-500">
                        Dibatalkan {formatWibDate(h.cancelledAt)}
                        {h.cancelledById ? ` oleh ${nameById.get(h.cancelledById) ?? "-"}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-700">
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
