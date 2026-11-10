import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, ReportStatus, Role } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagerAssignedClusterIds } from "@/lib/services/phase5-decision";
import { ROLE_METADATA, STATUS_METADATA } from "@/lib/permissions";
import { formatWibDate } from "@/lib/dates";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";

interface SpkPageProps {
  searchParams: Promise<{ filter?: string }>;
}

const ALLOWED_ROLES: Role[] = ["MANAGER", "PIC_VENDOR", "TEKNISI", "ADMIN", "OWNER"];

const FILTERS: { key: string; label: string; status?: ReportStatus }[] = [
  { key: "ALL", label: "Semua SPK" },
  { key: "MENUNGGU_TEKNISI", label: "Menunggu Teknisi", status: "DISETUJUI" },
  { key: "DIKERJAKAN", label: "Sedang Dikerjakan", status: "DIKERJAKAN" },
  { key: "MENUNGGU_KONFIRMASI", label: "Menunggu Konfirmasi", status: "MENUNGGU_KONFIRMASI" },
  { key: "SELESAI", label: "Selesai", status: "SELESAI" },
];

const WORK_ORDER_INCLUDE = {
  report: {
    include: {
      asset: {
        include: {
          park: { include: { cluster: true } },
        },
      },
    },
  },
  vendor: true,
  technician: true,
} satisfies Prisma.WorkOrderInclude;

export default async function SpkListPage({ searchParams }: SpkPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!ALLOWED_ROLES.includes(session.role)) {
    return (
      <AccessDeniedNotice
        message={`Role ${ROLE_METADATA[session.role].label} tidak memiliki akses ke daftar SPK.`}
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

  const { filter: rawFilter } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === rawFilter) ?? FILTERS[0];
  const isReadOnly = session.role === "ADMIN" || session.role === "OWNER";

  let workOrders: Prisma.WorkOrderGetPayload<{ include: typeof WORK_ORDER_INCLUDE }>[];
  try {
    const reportWhere: Prisma.ReportWhereInput = {};
    const where: Prisma.WorkOrderWhereInput = { companyId: session.companyId };

    if (session.role === "MANAGER") {
      const clusterIds = await getManagerAssignedClusterIds(session.id);
      reportWhere.asset = { park: { clusterId: { in: clusterIds } } };
    } else if (session.role === "PIC_VENDOR") {
      where.vendor = { picUserId: session.id };
    } else if (session.role === "TEKNISI") {
      where.technician = { userId: session.id };
    }

    if (activeFilter.status) {
      reportWhere.status = activeFilter.status;
    }
    if (Object.keys(reportWhere).length > 0) {
      where.report = reportWhere;
    }

    workOrders = await prisma.workOrder.findMany({
      where,
      include: WORK_ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (error) {
    console.error("[spk] gagal memuat SPK:", error);
    return <DbErrorNotice />;
  }

  const subtitle = isReadOnly
    ? "Pantau seluruh SPK perbaikan di perusahaan (hanya lihat)."
    : session.role === "MANAGER"
      ? "Pantau SPK di cluster yang Anda pegang: penunjukan teknisi dan status pengerjaan."
      : session.role === "PIC_VENDOR"
        ? "Seluruh SPK untuk vendor Anda. Tunjuk atau ganti teknisi dari halaman SPK Vendor."
        : "SPK yang ditugaskan kepada Anda.";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Daftar Surat Perintah Kerja (SPK)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const isActive = activeFilter.key === f.key;
          return (
            <Link
              key={f.key}
              href={`/dashboard/spk?filter=${f.key}`}
              aria-current={isActive ? "page" : undefined}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {workOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <p className="text-sm text-slate-500">
            Tidak ada SPK yang sesuai dengan filter ini.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: kartu */}
          <div className="space-y-3 sm:hidden">
            {workOrders.map((wo) => {
              const meta = STATUS_METADATA[wo.report.status];
              return (
                <div
                  key={wo.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono font-black text-slate-900">{wo.spkNo}</div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${meta.badgeColor}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{wo.report.asset.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {wo.report.asset.park.name} · {wo.report.asset.park.cluster.name}
                    </div>
                  </div>
                  <div className="text-slate-600">
                    {wo.vendor.name} · Teknisi:{" "}
                    {wo.technician ? (
                      <span className="font-semibold text-slate-800">
                        {wo.technician.fullName}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Belum ditunjuk</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      {wo.assignedAt ? formatWibDate(wo.assignedAt) : "-"}
                      {wo.report.underWarrantyOfVendorId ? " · Masa garansi" : ""}
                    </span>
                    <SpkActions
                      spkFileUrl={wo.spkFileUrl}
                      spkFileName={wo.spkFileName}
                      ticketNo={wo.report.ticketNo}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3">Nomor SPK</th>
                    <th className="px-4 py-3">Tiket &amp; Aset</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3">Vendor &amp; Teknisi</th>
                    <th className="px-4 py-3">Tgl Ditugaskan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((wo) => {
                    const meta = STATUS_METADATA[wo.report.status];
                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-mono font-black text-slate-900">
                          {wo.spkNo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {wo.report.asset.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Tiket: {wo.report.ticketNo}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">
                            {wo.report.asset.park.cluster.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {wo.report.asset.park.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{wo.vendor.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Teknisi:{" "}
                            {wo.technician ? (
                              <span className="font-bold text-slate-800">
                                {wo.technician.fullName}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold">
                                Belum ditunjuk PIC
                              </span>
                            )}
                          </div>
                          {wo.report.underWarrantyOfVendorId && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Masa garansi
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {wo.assignedAt ? formatWibDate(wo.assignedAt) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <SpkActions
                            spkFileUrl={wo.spkFileUrl}
                            spkFileName={wo.spkFileName}
                            ticketNo={wo.report.ticketNo}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SpkActions({
  spkFileUrl,
  spkFileName,
  ticketNo,
}: {
  spkFileUrl: string | null;
  spkFileName: string | null;
  ticketNo: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {spkFileUrl && (
        <a
          href={spkFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={spkFileName || "SPK.pdf"}
          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] inline-flex items-center gap-1 border border-indigo-200"
        >
          Unduh SPK
        </a>
      )}
      <Link
        href={`/dashboard/laporan?q=${encodeURIComponent(ticketNo)}`}
        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-block"
      >
        Detail →
      </Link>
    </div>
  );
}
