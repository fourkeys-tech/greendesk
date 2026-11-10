import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagerAssignedClusterIds } from "@/lib/services/phase5-decision";
import { STATUS_METADATA } from "@/lib/permissions";

interface SpkPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function SpkListPage({ searchParams }: SpkPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { filter = "ALL" } = await searchParams;
  const companyId = session.companyId || undefined;

  let whereClause: any = { companyId };

  if (session.role === "MANAGER") {
    const clusterIds = await getManagerAssignedClusterIds(session.id);
    whereClause = {
      ...whereClause,
      report: {
        asset: {
          park: {
            clusterId: { in: clusterIds },
          },
        },
      },
    };
  } else if (session.role === "PIC_VENDOR") {
    whereClause = {
      ...whereClause,
      vendor: {
        picUserId: session.id,
      },
    };
  } else if (session.role === "TEKNISI") {
    whereClause = {
      ...whereClause,
      technician: {
        userId: session.id,
      },
    };
  }

  // Filter status SPK
  if (filter === "MENUNGGU_TEKNISI") {
    whereClause.report = { ...whereClause.report, status: "DISETUJUI" };
  } else if (filter === "DIKERJAKAN") {
    whereClause.report = { ...whereClause.report, status: "DIKERJAKAN" };
  } else if (filter === "MENUNGGU_KONFIRMASI") {
    whereClause.report = { ...whereClause.report, status: "MENUNGGU_KONFIRMASI" };
  } else if (filter === "SELESAI") {
    whereClause.report = { ...whereClause.report, status: "SELESAI" };
  }

  const workOrders = await prisma.workOrder.findMany({
    where: whereClause,
    include: {
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
      revisionNotes: true,
      photos: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const filters = [
    { key: "ALL", label: "Semua SPK" },
    { key: "MENUNGGU_TEKNISI", label: "Menunggu Teknisi" },
    { key: "DIKERJAKAN", label: "Sedang Dikerjakan" },
    { key: "MENUNGGU_KONFIRMASI", label: "Menunggu Konfirmasi" },
    { key: "SELESAI", label: "Selesai" },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            MGR-M3 · Manajemen Surat Perintah Kerja
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Daftar Surat Perintah Kerja (SPK)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pantau seluruh penugasan perbaikan vendor, penunjukan teknisi, dan status pengerjaan.
          </p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const isActive = filter === f.key;
          return (
            <Link
              key={f.key}
              href={`/dashboard/spk?filter=${f.key}`}
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

      {/* Tabel SPK */}
      {workOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <p className="text-sm text-slate-500">
            Tidak ada SPK yang sesuai dengan filter ini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Nomor SPK</th>
                  <th className="px-4 py-3">Tiket & Aset</th>
                  <th className="px-4 py-3">Lokasi Cluster</th>
                  <th className="px-4 py-3">Vendor & Teknisi</th>
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
                        <div className="font-semibold text-slate-900">
                          {wo.vendor.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Teknisi:{" "}
                          {wo.technician ? (
                            <span className="font-bold text-slate-800">
                              {wo.technician.fullName}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold">
                              Belum Ditunjuk PIC
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {wo.assignedAt
                          ? new Date(wo.assignedAt).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/status/${wo.report.ticketNo}`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-block"
                        >
                          Lihat Status →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
