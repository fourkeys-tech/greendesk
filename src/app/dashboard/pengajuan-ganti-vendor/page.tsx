import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatWibDate } from "@/lib/dates";
import { getManagerAssignedClusterIds } from "@/lib/services/phase5-decision";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import {
  VendorReplacementClientForm,
  type AssetOptionItem,
  type VendorOptionItem,
} from "./vendor-replacement-client-form";
import { AdminForwardPanel, ManagerDecisionPanel } from "./decision-forms";

const ALLOWED_ROLES = ["PENGELOLA", "MANAGER", "ADMIN", "OWNER"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const STATUS_FILTERS = [
  { key: "ALL", label: "Semua" },
  { key: "DIAJUKAN", label: "Menunggu Manager" },
  { key: "DISETUJUI", label: "Disetujui" },
  { key: "DITERUSKAN_KE_OWNER", label: "Diteruskan ke Owner" },
  { key: "DITOLAK", label: "Ditolak" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const REQUEST_INCLUDE = {
  asset: { include: { park: { include: { cluster: true } } } },
  vendor: true,
  submittedBy: { select: { name: true, email: true } },
  managerDecidedBy: { select: { name: true } },
  adminForwardedBy: { select: { name: true } },
} satisfies Prisma.VendorReplacementRequestInclude;

type ReplacementRequestRow = Prisma.VendorReplacementRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

const STATUS_BADGES: Record<string, { label: string; badge: string }> = {
  DIAJUKAN: {
    label: "Menunggu keputusan Manager",
    badge: "bg-amber-50 text-amber-800 border-amber-300",
  },
  DITOLAK: {
    label: "Ditolak Manager",
    badge: "bg-rose-50 text-rose-800 border-rose-300",
  },
  DISETUJUI: {
    label: "Disetujui Manager, menunggu Admin",
    badge: "bg-sky-50 text-sky-800 border-sky-300",
  },
  DITERUSKAN_KE_OWNER: {
    label: "Diteruskan ke Owner / Direksi",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300",
  },
};

function isAllowedRole(role: string): role is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

export default async function VendorReplacementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!isAllowedRole(session.role)) {
    return (
      <AccessDeniedNotice message="Halaman pengajuan pergantian vendor hanya untuk Pengelola, Manager, Admin, dan Owner." />
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
  const resolvedParams = await searchParams;
  const defaultFilter: StatusFilter =
    session.role === "OWNER" ? "DITERUSKAN_KE_OWNER" : "ALL";
  const statusFilter: StatusFilter = STATUS_FILTERS.some(
    (f) => f.key === resolvedParams.status
  )
    ? (resolvedParams.status as StatusFilter)
    : defaultFilter;

  let formattedAssets: AssetOptionItem[] = [];
  let companyVendors: VendorOptionItem[] = [];
  let allReplacementRequests: ReplacementRequestRow[] = [];
  let basisTicketMap = new Map<string, string>();

  try {
    // 1. Data form pengajuan untuk Pengelola
    if (session.role === "PENGELOLA" && session.staffClusterId) {
      const rawAssets = await prisma.asset.findMany({
        where: {
          park: { clusterId: session.staffClusterId },
          companyId,
        },
        select: {
          id: true,
          name: true,
          code: true,
          park: { select: { name: true } },
          reports: {
            where: {
              archivedAt: null,
              status: { notIn: ["DIBATALKAN", "TIDAK_VALID", "DIGABUNG"] },
            },
            select: {
              id: true,
              ticketNo: true,
              description: true,
              status: true,
              createdAt: true,
              workOrder: {
                select: {
                  spkNo: true,
                  vendorId: true,
                  vendor: { select: { id: true, name: true } },
                },
              },
              underWarrantyOfVendor: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
        orderBy: { name: "asc" },
      });

      formattedAssets = rawAssets.map((ast) => {
        const latestVendorId =
          ast.reports.find((r) => r.workOrder?.vendorId)?.workOrder?.vendorId ||
          ast.reports.find((r) => r.underWarrantyOfVendor?.id)
            ?.underWarrantyOfVendor?.id ||
          null;

        return {
          id: ast.id,
          name: ast.name,
          code: ast.code,
          parkName: ast.park.name,
          latestVendorId,
          reports: ast.reports.map((r) => ({
            id: r.id,
            ticketNo: r.ticketNo,
            description: r.description,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            vendorName:
              r.workOrder?.vendor?.name || r.underWarrantyOfVendor?.name || null,
            vendorId: r.workOrder?.vendorId || r.underWarrantyOfVendor?.id || null,
            spkNo: r.workOrder?.spkNo || null,
          })),
        };
      });

      companyVendors = await prisma.vendor.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    // 2. Daftar pengajuan sesuai cakupan role
    let where: Prisma.VendorReplacementRequestWhereInput;
    if (session.role === "PENGELOLA") {
      where = { companyId, submittedById: session.id };
    } else if (session.role === "MANAGER") {
      const clusterIds = await getManagerAssignedClusterIds(session.id);
      where = { companyId, clusterId: { in: clusterIds } };
    } else {
      where = { companyId };
    }

    allReplacementRequests = await prisma.vendorReplacementRequest.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    // 3. Nomor tiket laporan dasar
    const allBasisIds = Array.from(
      new Set(allReplacementRequests.flatMap((req) => req.basisReportIds))
    );
    if (allBasisIds.length > 0) {
      // archivedAt: undefined menimpa filter otomatis archivedAt: null dari
      // extension Prisma, supaya nomor tiket yang sudah diarsip tetap tampil.
      const basisReports = await prisma.report.findMany({
        where: { id: { in: allBasisIds }, companyId, archivedAt: undefined },
        select: { id: true, ticketNo: true },
      });
      basisTicketMap = new Map(basisReports.map((r) => [r.id, r.ticketNo]));
    }
  } catch (error) {
    console.error("[pengajuan-ganti-vendor] gagal memuat data:", error);
    return <DbErrorNotice />;
  }

  const countByStatus: Record<StatusFilter, number> = {
    ALL: allReplacementRequests.length,
    DIAJUKAN: 0,
    DISETUJUI: 0,
    DITERUSKAN_KE_OWNER: 0,
    DITOLAK: 0,
  };
  for (const r of allReplacementRequests) {
    countByStatus[r.status as StatusFilter] += 1;
  }

  const replacementRequests =
    statusFilter === "ALL"
      ? allReplacementRequests
      : allReplacementRequests.filter((r) => r.status === statusFilter);

  const roleIntro: Record<AllowedRole, string> = {
    PENGELOLA:
      "Ajukan pergantian vendor bila aset di cluster Anda rusak berulang (minimal 2 laporan). Manager cluster akan memutuskan.",
    MANAGER:
      "Tinjau pengajuan dari Pengelola di cluster Anda. Setujui untuk diteruskan Admin ke Owner, atau tolak dengan alasan.",
    ADMIN:
      "Pengajuan yang sudah disetujui Manager menunggu Anda teruskan ke Owner / Direksi.",
    OWNER:
      "Eskalasi pergantian vendor yang sudah disetujui Manager dan diteruskan Admin. Halaman ini hanya untuk ditinjau.",
  };

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {session.role === "OWNER"
            ? "Eskalasi Pergantian Vendor"
            : "Pengajuan Pergantian Vendor"}
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          {roleIntro[session.role]}
        </p>
      </div>

      {session.role === "PENGELOLA" && (
        <VendorReplacementClientForm
          assets={formattedAssets}
          vendors={companyVendors}
        />
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-extrabold text-slate-900">
            Daftar pengajuan
          </h2>
          <nav
            aria-label="Filter status pengajuan"
            className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 text-xs"
          >
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/dashboard/pengajuan-ganti-vendor?status=${f.key}`}
                aria-current={statusFilter === f.key ? "page" : undefined}
                className={`shrink-0 px-3 py-1.5 rounded-xl font-semibold transition ${
                  statusFilter === f.key
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label} ({countByStatus[f.key]})
              </Link>
            ))}
          </nav>
        </div>

        {replacementRequests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center">
            <p className="text-sm text-slate-500">
              Belum ada pengajuan pada filter ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {replacementRequests.map((req) => {
              const statusInfo = STATUS_BADGES[req.status] ?? {
                label: req.status,
                badge: "bg-slate-100 text-slate-800 border-slate-300",
              };
              const awaitingOwner =
                session.role === "OWNER" &&
                req.status === "DITERUSKAN_KE_OWNER" &&
                !req.ownerViewedAt;

              return (
                <article
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                        {req.requestNo}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Diajukan {formatWibDate(req.createdAt)}
                      </span>
                      {req.basisReportIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Tiket dasar:
                          </span>
                          {req.basisReportIds.map((bid) => {
                            const ticketNo = basisTicketMap.get(bid);
                            return ticketNo ? (
                              <Link
                                key={bid}
                                href={`/dashboard/laporan?q=${encodeURIComponent(ticketNo)}`}
                                className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300"
                              >
                                {ticketNo}
                              </Link>
                            ) : (
                              <span
                                key={bid}
                                className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200"
                              >
                                tiket tidak tersedia
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {awaitingOwner && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-amber-100 text-amber-900 border-amber-300">
                          Menunggu tinjauan Owner / Direksi
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badge}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80">
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Aset
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {req.asset.name}
                      </span>
                      <span className="font-mono text-xs text-slate-500 block mt-0.5 break-all">
                        {req.asset.code} · {req.asset.park.name}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Vendor dipersoalkan
                      </span>
                      <span className="font-extrabold text-rose-700 text-sm">
                        {req.vendor.name}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Diajukan oleh
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {req.submittedBy.name}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Pengelola {req.asset.park.cluster.name}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Alasan pengajuan
                    </span>
                    <p className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                      {req.reason}
                    </p>
                  </div>

                  {req.managerDecisionNote && (
                    <div className="text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1.5">
                        Catatan Manager ({req.managerDecidedBy?.name || "Manager"}
                        {req.managerDecidedAt ? `, ${formatWibDate(req.managerDecidedAt)}` : ""})
                      </span>
                      <p className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-950 font-medium whitespace-pre-line">
                        {req.managerDecisionNote}
                      </p>
                    </div>
                  )}

                  {req.adminForwardedNote && (
                    <div className="text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1.5">
                        Catatan Admin ({req.adminForwardedBy?.name || "Admin"}
                        {req.adminForwardedAt ? `, ${formatWibDate(req.adminForwardedAt)}` : ""})
                      </span>
                      <p className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 text-emerald-950 font-medium whitespace-pre-line">
                        {req.adminForwardedNote}
                      </p>
                    </div>
                  )}

                  {session.role === "MANAGER" && req.status === "DIAJUKAN" && (
                    <ManagerDecisionPanel requestId={req.id} requestNo={req.requestNo} />
                  )}

                  {session.role === "ADMIN" && req.status === "DISETUJUI" && (
                    <AdminForwardPanel requestId={req.id} requestNo={req.requestNo} />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
