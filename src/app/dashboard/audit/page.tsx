import Link from "next/link";
import { redirect } from "next/navigation";
import type { AuditAction } from "@/lib/db-types";
import { ArrowRight, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { getCompanyAuditLogs } from "@/lib/audit";
import {
  AUDIT_ACTION_META,
  AUDIT_ACTIONS,
  auditEntityLabel,
  buildAuditDiff,
} from "@/lib/audit-labels";
import { formatWibDateTime } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";

interface AuditPageProps {
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>;
}

function buildHref(params: { entity?: string; action?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.entity) sp.set("entity", params.entity);
  if (params.action) sp.set("action", params.action);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/dashboard/audit?${qs}` : "/dashboard/audit";
}

export default async function AuditLogPage({ searchParams }: AuditPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "VIEW_AUDIT_LOGS")) {
    return (
      <AccessDeniedNotice
        message={`Role ${ROLE_METADATA[session.role].label} tidak memiliki akses ke riwayat perubahan data. Halaman ini hanya untuk Admin dan Owner.`}
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

  const sp = await searchParams;
  const entity = sp.entity?.trim() || undefined;
  const action = AUDIT_ACTIONS.includes(sp.action as AuditAction)
    ? (sp.action as AuditAction)
    : undefined;
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);

  let result: Awaited<ReturnType<typeof getCompanyAuditLogs>>;
  try {
    result = await getCompanyAuditLogs(session, {
      entityName: entity,
      action,
      page: Number.isFinite(requestedPage) ? requestedPage : 1,
    });
  } catch (error) {
    console.error("[audit] gagal memuat riwayat:", error);
    return <DbErrorNotice />;
  }

  const { logs, total, page, pageSize, totalPages, entityNames } = result;
  const isFiltered = Boolean(entity || action);
  const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Riwayat Perubahan Data
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Siapa mengubah apa dan kapan, beserta nilai lama dan baru. Riwayat ini
          permanen: tidak bisa diubah atau dihapus oleh siapa pun.
        </p>
      </div>

      <form
        method="get"
        action="/dashboard/audit"
        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-end gap-3 text-xs"
      >
        <div className="flex items-center gap-1.5 text-slate-500 font-bold w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="audit-entity" className="block font-semibold text-slate-700 mb-1">
            Jenis data
          </label>
          <select
            id="audit-entity"
            name="entity"
            defaultValue={entity ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Semua jenis data</option>
            {entityNames.map((name) => (
              <option key={name} value={name}>
                {auditEntityLabel(name)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="audit-action" className="block font-semibold text-slate-700 mb-1">
            Aksi
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={action ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Semua aksi</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_META[a].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            Terapkan
          </button>
          {isFiltered && (
            <Link
              href="/dashboard/audit"
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <div className="text-xs text-slate-500">
        {total === 0
          ? "Tidak ada catatan."
          : `Menampilkan ${firstIndex}–${lastIndex} dari ${total} catatan`}
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          {isFiltered
            ? "Tidak ada catatan yang cocok dengan filter ini."
            : "Belum ada catatan riwayat perubahan untuk perusahaan ini."}
        </div>
      ) : (
        <ol className="space-y-3">
          {logs.map((log) => {
            const actionMeta = AUDIT_ACTION_META[log.action];
            const diff = buildAuditDiff(log.oldValues, log.newValues);
            const hasOld = diff.some((d) => d.oldValue !== null);
            return (
              <li
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${actionMeta.badgeColor}`}
                    >
                      {actionMeta.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {auditEntityLabel(log.entityName)}
                    </span>
                  </div>
                  <time
                    dateTime={log.createdAt.toISOString()}
                    className="text-[11px] text-slate-500 font-medium"
                  >
                    {formatWibDateTime(log.createdAt)}
                  </time>
                </div>

                <div className="text-sm font-semibold text-slate-900 break-words">
                  {log.summary}
                </div>

                <div className="text-[11px] text-slate-500">
                  Oleh <strong className="text-slate-700">{log.actorName}</strong>{" "}
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${ROLE_METADATA[log.actorRole].badgeColor}`}
                  >
                    {ROLE_METADATA[log.actorRole].label}
                  </span>
                </div>

                {diff.length > 0 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[minmax(120px,1fr)_2fr_auto_2fr] gap-2 px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                      <span>Kolom</span>
                      <span>{hasOld ? "Nilai lama" : ""}</span>
                      <span />
                      <span>Nilai baru</span>
                    </div>
                    <dl className="divide-y divide-slate-100">
                      {diff.map((row) => (
                        <div
                          key={row.field}
                          className="grid grid-cols-1 sm:grid-cols-[minmax(120px,1fr)_2fr_auto_2fr] gap-1 sm:gap-2 px-3 py-2 sm:items-start"
                        >
                          <dt className="font-semibold text-slate-700">{row.label}</dt>
                          {row.oldValue !== null ? (
                            <>
                              <dd
                                className={`break-words ${
                                  row.changed ? "text-rose-700 line-through decoration-rose-300" : "text-slate-600"
                                }`}
                              >
                                {row.oldValue}
                              </dd>
                              <ArrowRight
                                aria-hidden="true"
                                className="hidden sm:block w-3.5 h-3.5 text-slate-400 mt-0.5"
                              />
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:block" />
                              <span className="hidden sm:block" />
                            </>
                          )}
                          <dd
                            className={`break-words ${
                              row.changed ? "text-emerald-800 font-semibold" : "text-slate-600"
                            }`}
                          >
                            {row.oldValue !== null && (
                              <span className="sm:hidden text-slate-400 font-normal">Menjadi: </span>
                            )}
                            {row.newValue ?? "-"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <nav aria-label="Halaman riwayat" className="flex items-center justify-between gap-3 text-xs">
          {page > 1 ? (
            <Link
              href={buildHref({ entity, action, page: page - 1 })}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500 font-medium">
            Halaman {page} dari {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ entity, action, page: page + 1 })}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
