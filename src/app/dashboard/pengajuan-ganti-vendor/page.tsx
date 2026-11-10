import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManagerAssignedClusterIds } from "@/lib/services/phase5-decision";
import {
  decideVendorReplacementAction,
  forwardVendorReplacementAction,
} from "@/app/actions/phase6-actions";
import {
  VendorReplacementClientForm,
  type AssetOptionItem,
  type VendorOptionItem,
} from "./vendor-replacement-client-form";

export default async function VendorReplacementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams.status || "ALL";

  const companyId = session.companyId || undefined;

  // 1. Data untuk Pengelola (PGL-M4)
  let formattedAssets: AssetOptionItem[] = [];
  let companyVendors: VendorOptionItem[] = [];

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
            r.workOrder?.vendor?.name ||
            r.underWarrantyOfVendor?.name ||
            null,
          vendorId:
            r.workOrder?.vendorId || r.underWarrantyOfVendor?.id || null,
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

  // 2. Query Pengajuan berdasarkan role
  let allReplacementRequests: any[] = [];

  if (session.role === "PENGELOLA") {
    allReplacementRequests = await prisma.vendorReplacementRequest.findMany({
      where: {
        submittedById: session.id,
      },
      include: {
        asset: { include: { park: { include: { cluster: true } } } },
        vendor: true,
        submittedBy: { select: { name: true, email: true } },
        managerDecidedBy: { select: { name: true } },
        adminForwardedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (session.role === "MANAGER") {
    const clusterIds = await getManagerAssignedClusterIds(session.id);
    allReplacementRequests = await prisma.vendorReplacementRequest.findMany({
      where: {
        companyId,
        clusterId: { in: clusterIds },
      },
      include: {
        asset: { include: { park: { include: { cluster: true } } } },
        vendor: true,
        submittedBy: { select: { name: true, email: true } },
        managerDecidedBy: { select: { name: true } },
        adminForwardedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (session.role === "ADMIN" || session.role === "OWNER") {
    allReplacementRequests = await prisma.vendorReplacementRequest.findMany({
      where: { companyId },
      include: {
        asset: { include: { park: { include: { cluster: true } } } },
        vendor: true,
        submittedBy: { select: { name: true, email: true } },
        managerDecidedBy: { select: { name: true } },
        adminForwardedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Ambil daftar nomor tiket laporan dasar untuk ditampilkan pada kartu riwayat
  const allBasisIds = Array.from(
    new Set(
      allReplacementRequests.flatMap((req) =>
        Array.isArray(req.basisReportIds) ? (req.basisReportIds as string[]) : []
      )
    )
  );
  const basisReportsList =
    allBasisIds.length > 0
      ? await prisma.report.findMany({
          where: { id: { in: allBasisIds } },
          select: { id: true, ticketNo: true },
        })
      : [];
  const basisTicketMap = new Map(
    basisReportsList.map((r) => [r.id, r.ticketNo])
  );

  const countDiajukan = allReplacementRequests.filter(
    (r) => r.status === "DIAJUKAN"
  ).length;
  const countDisetujui = allReplacementRequests.filter(
    (r) => r.status === "DISETUJUI"
  ).length;
  const countOwner = allReplacementRequests.filter(
    (r) => r.status === "DITERUSKAN_KE_OWNER"
  ).length;

  const replacementRequests =
    statusFilter === "ALL"
      ? allReplacementRequests
      : allReplacementRequests.filter((r) => r.status === statusFilter);

  const statusBadges: Record<string, { label: string; badge: string }> = {
    DIAJUKAN: {
      label: "Diajukan (Menunggu Manager)",
      badge: "bg-amber-50 text-amber-800 border-amber-300",
    },
    DITOLAK: {
      label: "Ditolak Manager",
      badge: "bg-rose-50 text-rose-800 border-rose-300",
    },
    DISETUJUI: {
      label: "Disetujui Manager (Menunggu Admin)",
      badge: "bg-sky-50 text-sky-800 border-sky-300",
    },
    DITERUSKAN_KE_OWNER: {
      label: "Diteruskan ke Owner / Direksi",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-300",
    },
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            PRD Bagian 7 · Alur Pergantian Vendor
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Pengajuan Pergantian Vendor
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          Pengelola mengajukan pergantian bila aset rusak berulang (2x/3x
          perbaikan). Manager memutuskan, Admin meneruskan, dan Owner menerima
          eskalasi.
        </p>
      </div>

      {/* Form Pengajuan untuk Pengelola (PGL-M4) */}
      {session.role === "PENGELOLA" && (
        <VendorReplacementClientForm
          assets={formattedAssets}
          vendors={companyVendors}
        />
      )}

      {/* Daftar Pengajuan Ganti Vendor */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Daftar Pengajuan Pergantian Vendor
            </h2>
            <p className="text-xs text-slate-500">
              Pantau status persetujuan Manager hingga eskalasi ke Owner /
              Direksi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="/dashboard/pengajuan-ganti-vendor"
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua ({allReplacementRequests.length})
            </a>
            <a
              href="/dashboard/pengajuan-ganti-vendor?status=DIAJUKAN"
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                statusFilter === "DIAJUKAN"
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Menunggu Manager ({countDiajukan})
            </a>
            <a
              href="/dashboard/pengajuan-ganti-vendor?status=DISETUJUI"
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                statusFilter === "DISETUJUI"
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Disetujui ({countDisetujui})
            </a>
            <a
              href="/dashboard/pengajuan-ganti-vendor?status=DITERUSKAN_KE_OWNER"
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                statusFilter === "DITERUSKAN_KE_OWNER"
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Diteruskan ke Owner ({countOwner})
            </a>
          </div>
        </div>

        {replacementRequests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center">
            <p className="text-sm text-slate-500">
              Belum ada pengajuan pergantian vendor yang tercatat pada filter
              ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {replacementRequests.map((req) => {
              const statusInfo = statusBadges[req.status] || {
                label: req.status,
                badge: "bg-slate-100 text-slate-800 border-slate-300",
              };
              const basisIds = Array.isArray(req.basisReportIds)
                ? (req.basisReportIds as string[])
                : [];

              return (
                <article
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4 hover:shadow-md transition"
                >
                  {/* Baris Atas: Nomor Pengajuan, Tiket Terlampir & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                        {req.requestNo}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        Diajukan pada{" "}
                        {new Date(req.createdAt).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })}
                      </span>
                      {basisIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">
                            • Tiket Terlampir:
                          </span>
                          {basisIds.map((bid) => (
                            <span
                              key={bid}
                              className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {basisTicketMap.get(bid) || bid.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badge}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Info Aset & Vendor */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Aset Taman
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {req.asset.name}
                      </span>
                      <span className="font-mono text-xs text-slate-500 block mt-0.5">
                        {req.asset.code} · {req.asset.park.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Vendor Dipersoalkan
                      </span>
                      <span className="font-extrabold text-rose-700 text-sm">
                        {req.vendor.name}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Kontrak Perbaikan Klaster
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-bold mb-0.5">
                        Diajukan Oleh
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {req.submittedBy.name}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Pengelola {req.asset.park.cluster.name}
                      </span>
                    </div>
                  </div>

                  {/* Alasan Pengajuan */}
                  <div className="text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Alasan Pengajuan Pengelola
                    </span>
                    <p className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 text-slate-800 leading-relaxed font-medium">
                      {req.reason}
                    </p>
                  </div>

                  {/* Catatan Keputusan Manager */}
                  {req.managerDecisionNote && (
                    <div className="text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1.5">
                        Catatan Keputusan Manager (
                        {req.managerDecidedBy?.name || "Manager"})
                      </span>
                      <p className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-950 font-medium">
                        {req.managerDecisionNote}
                      </p>
                    </div>
                  )}

                  {/* Catatan Teruskan Admin */}
                  {req.adminForwardedNote && (
                    <div className="text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1.5">
                        Catatan Eskalasi Admin (
                        {req.adminForwardedBy?.name || "Admin"})
                      </span>
                      <p className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80 text-emerald-950 font-medium">
                        {req.adminForwardedNote}
                      </p>
                    </div>
                  )}

                  {/* Panel Aksi Manager: Setuju / Tolak (MGR-M5) */}
                  {session.role === "MANAGER" && req.status === "DIAJUKAN" && (
                    <div className="pt-3 border-t border-slate-100 bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 space-y-3">
                      <div className="text-xs font-bold text-emerald-900 uppercase">
                        Panel Keputusan Manager (MGR-M5)
                      </div>

                      <div className="flex flex-wrap gap-4">
                        {/* Form Setuju */}
                        <form
                          action={async (formData) => {
                            "use server";
                            await decideVendorReplacementAction(formData);
                          }}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <input type="hidden" name="decision" value="SETUJU" />
                          <input
                            type="text"
                            name="decisionNote"
                            placeholder="Catatan persetujuan (opsional)"
                            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                          >
                            Setujui Pengajuan
                          </button>
                        </form>

                        {/* Form Tolak */}
                        <form
                          action={async (formData) => {
                            "use server";
                            await decideVendorReplacementAction(formData);
                          }}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <input type="hidden" name="decision" value="TOLAK" />
                          <input
                            type="text"
                            name="decisionNote"
                            required
                            placeholder="Alasan penolakan (wajib)"
                            className="text-xs rounded-xl border border-rose-300 px-3 py-2 bg-white"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                          >
                            Tolak Pengajuan
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Panel Aksi Admin: Teruskan ke Owner */}
                  {session.role === "ADMIN" && req.status === "DISETUJUI" && (
                    <div className="pt-3 border-t border-slate-100 bg-sky-50/40 p-4 rounded-2xl border border-sky-200 space-y-3">
                      <div className="text-xs font-bold text-sky-900 uppercase">
                        Panel Tindak Lanjut Admin Perusahaan
                      </div>
                      <form
                        action={async (formData) => {
                          "use server";
                          await forwardVendorReplacementAction(formData);
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="requestId" value={req.id} />
                        <input
                          type="text"
                          name="forwardNote"
                          placeholder="Catatan pengantar eskalasi ke Owner (opsional)"
                          className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white flex-1 min-w-[200px]"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Teruskan ke Owner / Direksi →
                        </button>
                      </form>
                    </div>
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
