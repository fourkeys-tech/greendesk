import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getVendorReportCard } from "@/lib/services/vendor-replacement";
import { VendorAdminForms } from "./vendor-admin-forms";

export default async function VendorPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "VIEW_VENDORS")) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Role <strong>{session.role}</strong> tidak memiliki izin mengakses
          halaman Data Vendor.
        </p>
      </div>
    );
  }

  const canManage = hasPermission(session.role, "MANAGE_VENDORS");
  const canApproveTech = hasPermission(session.role, "APPROVE_TECHNICIANS");
  const isManager = session.role === "MANAGER";

  const [rawVendors, clusters, pendingTechs, unreadNotifications] =
    session.companyId
      ? await Promise.all([
          prisma.vendor.findMany({
            where:
              session.role === "PIC_VENDOR"
                ? { companyId: session.companyId, picUserId: session.id }
                : { companyId: session.companyId },
            include: {
              picUser: { select: { name: true, email: true } },
              serviceAreas: { include: { cluster: true } },
              technicians: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { createdAt: "asc" },
          }),
          prisma.cluster.findMany({
            where: { companyId: session.companyId },
            orderBy: { name: "asc" },
          }),
          canApproveTech
            ? prisma.technician.findMany({
                where: {
                  companyId: session.companyId,
                  approvalStatus: "PENDING",
                },
                include: { vendor: true },
                orderBy: { createdAt: "desc" },
              })
            : Promise.resolve([]),
          prisma.notification.findMany({
            where: {
              recipientId: session.id,
              isRead: false,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ])
      : [[], [], [], []];

  // Hitung Rapor Vendor (MGR-M7) untuk setiap vendor
  const vendors = await Promise.all(
    rawVendors.map(async (v) => {
      let reportCard = null;
      if (session.companyId) {
        try {
          const rc = await getVendorReportCard(session.companyId, v.id);
          reportCard = rc.metrics;
        } catch {}
      }
      return {
        ...v,
        reportCard,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 mb-2">
          {canManage
            ? "Fase 2 – Onboarding Vendor & Persetujuan Teknisi (Admin)"
            : "Fase 2 – Profil & Data Vendor"}
        </span>
        <h1 className="text-xl font-bold text-slate-900">
          Data Vendor, Kontrak, Area Layanan & Persetujuan Teknisi (
          {session.companyName})
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          {session.role === "PIC_VENDOR"
            ? "Menampilkan data perusahaan vendor Anda, area layanan cluster, dan masa garansi pekerjaan."
            : "Kelola perusahaan vendor (internal/eksternal), PIC Vendor, area layanan cluster, dan persetujuan teknisi."}
        </p>
      </div>

      {/* Notifikasi Web untuk Admin / PIC */}
      {unreadNotifications.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold uppercase text-sky-900">
            🔔 Notifikasi Web Terbaru ({unreadNotifications.length})
          </div>
          {unreadNotifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-white rounded-xl p-3 border border-sky-200 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900">{notif.title}:</span>{" "}
                <span className="text-slate-700">{notif.message}</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                {new Date(notif.createdAt).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Panel Form Admin: Input Vendor & Setujui Teknisi */}
      {canManage && (
        <VendorAdminForms
          clusters={clusters.map((c) => ({ id: c.id, name: c.name }))}
          pendingTechnicians={pendingTechs.map((t) => ({
            id: t.id,
            fullName: t.fullName,
            email: t.email,
            whatsapp: t.whatsapp,
            skills: t.skills,
            vendorName: t.vendor.name,
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      )}

      <div className="grid grid-cols-1 gap-4">
        {vendors.map((v) => (
          <div
            key={v.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {v.name}
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {v.type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Skema: {v.cooperationScheme || "-"} · Garansi Pekerjaan:{" "}
                  <strong>{v.warrantyDays} hari</strong> · NPWP:{" "}
                  {v.npwp || "-"}
                </div>
                <div className="text-xs text-slate-500">
                  Alamat: {v.address || "-"}
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {v.technicians.length} Teknisi Terdaftar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-400 font-medium">PIC Vendor</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {v.picUser?.name || "-"}
                </div>
                <div className="text-slate-500 font-mono">
                  {v.picUser?.email || "-"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-400 font-medium">
                  Area Layanan Cluster
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {v.serviceAreas.map((sa) => sa.cluster.name).join(", ") ||
                    "-"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-400 font-medium">
                  Keahlian & Konfirmasi Daftar Teknisi
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {v.skills.join(", ")}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Konfirmasi PIC Terakhir:{" "}
                  {v.lastTechnicianConfirmedAt
                    ? new Date(v.lastTechnicianConfirmedAt).toLocaleDateString(
                        "id-ID"
                      )
                    : "Belum pernah"}
                </div>
              </div>
            </div>

            {/* Rapor Vendor (MGR-M7) */}
            {v.reportCard && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>📊 Rapor Kinerja Vendor (Otomatis dari Riwayat SPK)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-lg font-black text-slate-900">
                      {v.reportCard.totalJobs}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Total Pekerjaan SPK
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-lg font-black text-slate-900">
                      {v.reportCard.avgDurationHours} jam
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Rata-rata Durasi
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-lg font-black text-amber-700">
                      {v.reportCard.revisionCount}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Perbaikan Ulang (Revisi)
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-lg font-black text-rose-700">
                      {v.reportCard.warrantyDefectsCount}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Rusak Lagi dlm Garansi
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daftar Teknisi di Vendor Ini */}
            {v.technicians.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-700">
                  Daftar Teknisi ({v.technicians.length}):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {v.technicians.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {t.fullName}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {t.email} · WA: {t.whatsapp}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          Keahlian: {t.skills.join(", ")}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            t.approvalStatus === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.approvalStatus === "PENDING"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.approvalStatus}
                        </span>
                        <div className="text-[11px] text-slate-500 font-semibold">
                          Status: {t.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
