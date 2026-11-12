import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { sanitizeMediaHref } from "@/lib/url-safety";
import { query } from "@/lib/db";
import type { TechnicianRow, VendorRow } from "@/lib/db-types";
import { getVendorReportCard } from "@/lib/services/vendor-replacement";
import { formatWibDate, wibDateInputValue } from "@/lib/dates";
import {
  APPROVAL_STATUS_META,
  DEACTIVATION_REASON_LABEL,
  TECHNICIAN_STATUS_META,
  VENDOR_TYPE_LABEL,
} from "@/lib/vendor-labels";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import { PendingTechniciansCard } from "@/components/dashboard/admin/pending-technicians-card";
import { VendorAdminForms } from "./vendor-admin-forms";
import {
  TechnicianDeactivateButton,
  TechnicianReactivateButton,
  VendorManagePanel,
} from "./vendor-manage-forms";

type VendorWithRelations = VendorRow & {
  picUser: { name: string; email: string } | null;
  serviceAreas: Array<{
    id: string;
    clusterId: string;
    cluster: { id: string; name: string; isActive: boolean };
  }>;
  technicians: TechnicianRow[];
};
type TechnicianWithVendorName = TechnicianRow & { vendor: { name: string } };
type ReportCardMetrics = Awaited<ReturnType<typeof getVendorReportCard>>["metrics"];

const DAY_MS = 86400000;

function contractNotice(contractEnd: Date | null, now: Date) {
  if (!contractEnd) return null;
  const daysLeft = Math.ceil((contractEnd.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) {
    return { text: "Kontrak sudah berakhir", color: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (daysLeft <= 30) {
    return {
      text: `Kontrak berakhir ${daysLeft} hari lagi`,
      color: "bg-amber-50 text-amber-900 border-amber-300",
    };
  }
  return null;
}

export default async function VendorPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "VIEW_VENDORS")) {
    return (
      <AccessDeniedNotice
        message={`Role ${ROLE_METADATA[session.role].label} tidak memiliki akses ke halaman data vendor.`}
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
  const canManage = hasPermission(session.role, "MANAGE_VENDORS");
  const canApproveTech = hasPermission(session.role, "APPROVE_TECHNICIANS");
  const isPic = session.role === "PIC_VENDOR";

  let vendors: Array<VendorWithRelations & { reportCard: ReportCardMetrics | null }>;
  let clusters: Array<{ id: string; name: string; isActive: boolean }>;
  let pendingTechs: TechnicianWithVendorName[];
  let reactivationTechs: TechnicianWithVendorName[];

  try {
    const vendorFilterSql = isPic
      ? `v."companyId" = $1 AND v."picUserId" = $2`
      : `v."companyId" = $1`;
    const vendorParams = isPic ? [companyId, session.id] : [companyId];

    const [rawVendorRows, serviceAreaRows, techRows, clusterRows] = await Promise.all([
      query<VendorRow & { picName: string | null; picEmail: string | null }>(
        `SELECT v.*, u."name" AS "picName", u."email" AS "picEmail"
         FROM "Vendor" v
         LEFT JOIN "User" u ON u."id" = v."picUserId"
         WHERE ${vendorFilterSql}
         ORDER BY v."isActive" DESC, v."name" ASC`,
        vendorParams
      ),
      query<{
        id: string;
        vendorId: string;
        clusterId: string;
        clusterName: string;
        clusterIsActive: boolean;
      }>(
        `SELECT vsa."id", vsa."vendorId", vsa."clusterId",
                cl."name" AS "clusterName", cl."isActive" AS "clusterIsActive"
         FROM "VendorServiceArea" vsa
         JOIN "Vendor" v ON v."id" = vsa."vendorId"
         JOIN "Cluster" cl ON cl."id" = vsa."clusterId"
         WHERE ${vendorFilterSql}`,
        vendorParams
      ),
      query<TechnicianRow & { vendorName: string }>(
        `SELECT t.*, v."name" AS "vendorName"
         FROM "Technician" t
         JOIN "Vendor" v ON v."id" = t."vendorId"
         WHERE t."companyId" = $1${isPic && !canApproveTech ? ` AND v."picUserId" = $2` : ""}
         ORDER BY t."createdAt" DESC`,
        isPic && !canApproveTech ? [companyId, session.id] : [companyId]
      ),
      canManage
        ? query<{ id: string; name: string; isActive: boolean }>(
            `SELECT "id", "name", "isActive"
             FROM "Cluster"
             WHERE "companyId" = $1
             ORDER BY "name" ASC`,
            [companyId]
          )
        : Promise.resolve([]),
    ]);

    const areasByVendor = new Map<string, VendorWithRelations["serviceAreas"]>();
    for (const sa of serviceAreaRows) {
      const list = areasByVendor.get(sa.vendorId) ?? [];
      list.push({
        id: sa.id,
        clusterId: sa.clusterId,
        cluster: {
          id: sa.clusterId,
          name: sa.clusterName,
          isActive: sa.clusterIsActive,
        },
      });
      areasByVendor.set(sa.vendorId, list);
    }

    const techsByVendor = new Map<string, TechnicianRow[]>();
    for (const { vendorName: _vendorName, ...t } of techRows) {
      const list = techsByVendor.get(t.vendorId) ?? [];
      list.push(t);
      techsByVendor.set(t.vendorId, list);
    }

    const rawVendors: VendorWithRelations[] = rawVendorRows.map(
      ({ picName, picEmail, ...v }) => ({
        ...v,
        picUser:
          picName !== null && picEmail !== null
            ? { name: picName, email: picEmail }
            : null,
        serviceAreas: areasByVendor.get(v.id) ?? [],
        technicians: techsByVendor.get(v.id) ?? [],
      })
    );

    vendors = await Promise.all(
      rawVendors.map(async (v) => {
        try {
          const rc = await getVendorReportCard(companyId, v.id);
          return { ...v, reportCard: rc.metrics };
        } catch (error) {
          console.error(`[vendor] gagal menghitung rapor ${v.id}:`, error);
          return { ...v, reportCard: null };
        }
      })
    );
    clusters = clusterRows;

    if (canApproveTech) {
      pendingTechs = techRows
        .filter((t) => t.approvalStatus === "PENDING")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(({ vendorName, ...t }) => ({ ...t, vendor: { name: vendorName } }));
      reactivationTechs = techRows
        .filter((t) => t.reactivationRequested)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(({ vendorName, ...t }) => ({ ...t, vendor: { name: vendorName } }));
    } else {
      pendingTechs = [];
      reactivationTechs = [];
    }
  } catch (error) {
    console.error("[vendor] gagal memuat data vendor:", error);
    return <DbErrorNotice />;
  }

  const now = new Date();
  const activeClusters = clusters.filter((c) => c.isActive);

  const title = canManage
    ? "Kelola Vendor & Teknisi"
    : isPic
      ? "Profil Vendor Saya"
      : "Data & Rapor Vendor";
  const subtitle = canManage
    ? "Tambah dan ubah data vendor, atur area layanan, setujui teknisi baru, dan nonaktifkan teknisi bila perlu."
    : isPic
      ? "Informasi kontrak, area layanan, masa garansi, dan daftar teknisi vendor Anda."
      : "Pantau kontrak, area layanan, rapor kinerja, dan daftar teknisi setiap vendor (hanya lihat).";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">{subtitle}</p>
        <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {vendors.length} vendor
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {vendors.filter((v) => v.isActive).length} aktif
          </span>
          {canApproveTech && pendingTechs.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
              {pendingTechs.length} teknisi menunggu persetujuan
            </span>
          )}
        </div>
      </div>

      {canApproveTech && (
        <PendingTechniciansCard
          hideWhenEmpty
          technicians={pendingTechs.map((t) => ({
            id: t.id,
            fullName: t.fullName,
            email: t.email,
            whatsapp: t.whatsapp,
            skills: t.skills,
            facePhotoUrl: sanitizeMediaHref(t.facePhotoUrl),
            vendor: { name: t.vendor.name },
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      )}

      {canManage && (
        <VendorAdminForms
          clusters={activeClusters.map((c) => ({ id: c.id, name: c.name }))}
          contractStartDefault={wibDateInputValue(0)}
          contractEndDefault={wibDateInputValue(365)}
          reactivationRequests={reactivationTechs.map((t) => ({
            id: t.id,
            fullName: t.fullName,
            email: t.email,
            vendorName: t.vendor.name,
            reactivationNote: t.reactivationNote,
            deactivationLabel: t.deactivationReason
              ? DEACTIVATION_REASON_LABEL[t.deactivationReason] ?? "Nonaktif"
              : "Nonaktif",
          }))}
        />
      )}

      {vendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          {isPic
            ? "Akun Anda belum ditautkan ke vendor mana pun. Hubungi Admin."
            : canManage
              ? "Belum ada vendor. Tambahkan vendor pertama melalui tombol Tambah Vendor di atas."
              : "Belum ada vendor yang terdaftar di perusahaan ini."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {vendors.map((v) => {
            const notice = v.isActive ? contractNotice(v.contractEnd, now) : null;
            const serviceClusterIds = new Set(v.serviceAreas.map((sa) => sa.clusterId));
            const editClusters = clusters.filter(
              (c) => c.isActive || serviceClusterIds.has(c.id)
            );
            const approvedTechs = v.technicians.filter(
              (t) => t.approvalStatus === "APPROVED"
            );
            const activeTechCount = approvedTechs.filter((t) => t.status === "ACTIVE").length;

            return (
              <section
                key={v.id}
                aria-label={`Vendor ${v.name}`}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 ${
                  v.isActive ? "border-slate-200" : "border-slate-300 bg-slate-50/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 break-words">
                        {v.name}
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {VENDOR_TYPE_LABEL[v.type]}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          v.isActive
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-200 text-slate-600 border-slate-300"
                        }`}
                      >
                        {v.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      {notice && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${notice.color}`}>
                          {notice.text}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Skema: {v.cooperationScheme || "-"} · NPWP: {v.npwp || "-"}
                    </div>
                    <div className="text-xs text-slate-500 break-words">
                      Alamat: {v.address || "-"}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    {activeTechCount} dari {approvedTechs.length} teknisi aktif
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <InfoTile label="Masa Kontrak">
                    <div className="font-bold text-slate-900">
                      {v.contractStart || v.contractEnd
                        ? `${formatWibDate(v.contractStart)} – ${formatWibDate(v.contractEnd)}`
                        : "Belum diisi"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Garansi pekerjaan: <strong>{v.warrantyDays} hari</strong>
                    </div>
                  </InfoTile>

                  <InfoTile label="PIC Vendor">
                    <div className="font-bold text-slate-900">{v.picUser?.name || "-"}</div>
                    <div className="text-slate-500 break-all">{v.picUser?.email || "-"}</div>
                  </InfoTile>

                  <InfoTile label="Area Layanan">
                    {v.serviceAreas.length === 0 ? (
                      <div className="text-slate-500">Belum ada</div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {v.serviceAreas.map((sa) => (
                          <span
                            key={sa.id}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                              sa.cluster.isActive
                                ? "bg-white text-slate-800 border-slate-200"
                                : "bg-slate-100 text-slate-500 border-slate-200 line-through"
                            }`}
                            title={sa.cluster.isActive ? undefined : "Cluster nonaktif"}
                          >
                            {sa.cluster.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </InfoTile>

                  <InfoTile label="Keahlian">
                    <div className="font-bold text-slate-900">{v.skills.join(", ") || "-"}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Konfirmasi daftar teknisi:{" "}
                      {v.lastTechnicianConfirmedAt
                        ? formatWibDate(v.lastTechnicianConfirmedAt)
                        : "belum pernah"}
                    </div>
                  </InfoTile>
                </div>

                {v.reportCard && (
                  <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Rapor Kinerja (dari riwayat SPK)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 text-center">
                      <Metric value={v.reportCard.totalJobs} label="Total SPK" />
                      <Metric value={v.reportCard.completedJobs} label="SPK Selesai" />
                      <Metric
                        value={`${v.reportCard.avgDurationHours} jam`}
                        label="Rata-rata Durasi"
                      />
                      <Metric
                        value={v.reportCard.revisionCount}
                        label="Perbaikan Ulang"
                        tone="text-amber-700"
                      />
                      <Metric
                        value={v.reportCard.warrantyDefectsCount}
                        label="Rusak Lagi (Garansi)"
                        tone="text-rose-700"
                      />
                    </div>
                  </div>
                )}

                {canManage && (
                  <VendorManagePanel
                    vendorId={v.id}
                    vendorName={v.name}
                    isActive={v.isActive}
                    clusters={editClusters}
                    defaults={{
                      name: v.name,
                      type: v.type,
                      skills: v.skills,
                      cooperationScheme: v.cooperationScheme,
                      contractStart: v.contractStart ? wibDateInputValue(0, v.contractStart) : "",
                      contractEnd: v.contractEnd ? wibDateInputValue(0, v.contractEnd) : "",
                      warrantyDays: v.warrantyDays,
                      npwp: v.npwp,
                      address: v.address,
                      clusterIds: v.serviceAreas.map((sa) => sa.clusterId),
                    }}
                  />
                )}

                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-slate-700">
                    Daftar Teknisi ({v.technicians.length})
                  </div>
                  {v.technicians.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
                      Belum ada teknisi terdaftar. PIC Vendor mendaftarkan teknisi dari menu Teknisi Saya.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {v.technicians.map((t) => {
                        const approval = APPROVAL_STATUS_META[t.approvalStatus];
                        const status = TECHNICIAN_STATUS_META[t.status];
                        const isApproved = t.approvalStatus === "APPROVED";
                        return (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 break-words">
                                  {t.fullName}
                                </div>
                                <div className="text-slate-500 text-[11px] break-all">
                                  {t.email} · WA: {t.whatsapp}
                                </div>
                                <div className="text-slate-600 text-[11px]">
                                  Keahlian: {t.skills.join(", ") || "-"}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 shrink-0">
                                {isApproved ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${status.badgeColor}`}
                                  >
                                    {status.label}
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${approval.badgeColor}`}
                                  >
                                    {approval.label}
                                  </span>
                                )}
                              </div>
                            </div>

                            {t.approvalStatus === "REJECTED" && t.rejectionReason && (
                              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                                Alasan ditolak: {t.rejectionReason}
                              </div>
                            )}
                            {isApproved && t.status === "INACTIVE" && (
                              <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1">
                                {t.deactivationReason
                                  ? DEACTIVATION_REASON_LABEL[t.deactivationReason] ?? "Nonaktif"
                                  : "Nonaktif"}
                                {t.deactivationReason === "MANUAL_BY_ADMIN" && t.reactivationNote
                                  ? ` – ${t.reactivationNote}`
                                  : ""}
                                {t.reactivationRequested ? " · Pengajuan aktif kembali menunggu Admin" : ""}
                              </div>
                            )}

                            {canApproveTech && isApproved && (
                              <div className="pt-1 border-t border-slate-200/70">
                                {t.status === "INACTIVE" ? (
                                  // Nonaktif oleh PIC diaktifkan kembali oleh PIC sendiri.
                                  !t.reactivationRequested &&
                                  t.deactivationReason !== "MANUAL_BY_PIC" && (
                                    <TechnicianReactivateButton
                                      technicianId={t.id}
                                      technicianName={t.fullName}
                                    />
                                  )
                                ) : (
                                  <TechnicianDeactivateButton
                                    technicianId={t.id}
                                    technicianName={t.fullName}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
      <div className="text-slate-400 font-medium mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Metric({
  value,
  label,
  tone = "text-slate-900",
}: {
  value: React.ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
      <div className={`text-base sm:text-lg font-black ${tone}`}>{value}</div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase leading-tight">
        {label}
      </div>
    </div>
  );
}
