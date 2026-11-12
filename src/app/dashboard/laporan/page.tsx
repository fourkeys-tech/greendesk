import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Plus } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { getScopedReportsForUser } from "@/lib/services/foundation";
import { DbErrorNotice } from "@/components/dashboard/db-error-notice";
import { LaporanClientBoard } from "./laporan-client-board";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ arsip?: string; q?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const showArchived = resolvedParams.arsip === "1";
  const initialQuery = resolvedParams.q ?? "";

  let rawReports: Awaited<ReturnType<typeof getScopedReportsForUser>> = [];
  let dbError = false;
  try {
    rawReports = await getScopedReportsForUser(session, {
      includeArchived: showArchived,
      throwOnError: true,
    });
  } catch (err) {
    console.error("[laporan] gagal memuat laporan:", err);
    dbError = true;
  }

  const roleMeta = ROLE_METADATA[session.role];
  const canArchive = hasPermission(session.role, "ARCHIVE_REPORT");
  const canVerify = hasPermission(session.role, "VERIFY_AND_PRIORITIZE");
  const isManager = session.role === "MANAGER";

  let allVendorsWithAreas: Array<{
    id: string;
    name: string;
    warrantyDays: number;
    serviceAreas: Array<{ clusterId: string }>;
  }> = [];

  let picTechnicians: Array<{ id: string; fullName: string }> = [];

  try {
    if (isManager && session.companyId) {
      const [vendorRows, areaRows] = await Promise.all([
        query<{ id: string; name: string; warrantyDays: number }>(
          `SELECT "id", "name", "warrantyDays"
           FROM "Vendor"
           WHERE "companyId" = $1 AND "isActive" = true`,
          [session.companyId]
        ),
        query<{ vendorId: string; clusterId: string }>(
          `SELECT vsa."vendorId", vsa."clusterId"
           FROM "VendorServiceArea" vsa
           JOIN "Vendor" v ON v."id" = vsa."vendorId"
           WHERE v."companyId" = $1 AND v."isActive" = true`,
          [session.companyId]
        ),
      ]);
      const areasByVendor = new Map<string, Array<{ clusterId: string }>>();
      for (const a of areaRows) {
        const list = areasByVendor.get(a.vendorId) ?? [];
        list.push({ clusterId: a.clusterId });
        areasByVendor.set(a.vendorId, list);
      }
      allVendorsWithAreas = vendorRows.map((v) => ({
        ...v,
        serviceAreas: areasByVendor.get(v.id) ?? [],
      }));
    } else if (session.role === "PIC_VENDOR" && session.companyId) {
      picTechnicians = await query<{ id: string; fullName: string }>(
        `SELECT t."id", t."fullName"
         FROM "Technician" t
         JOIN "Vendor" v ON v."id" = t."vendorId"
         WHERE v."picUserId" = $1
           AND v."companyId" = $2
           AND t."companyId" = $2
           AND v."isActive" = true
           AND t."status" = 'ACTIVE'::"TechnicianStatus"
           AND t."approvalStatus" = 'APPROVED'::"ApprovalStatus"`,
        [session.id, session.companyId]
      );
    }
  } catch (err) {
    console.error("Error loading vendor/technician data:", err);
    dbError = true;
  }

  // Pengurutan cerdas untuk Manager (MGR-M1 & MGR-M2)
  const reports = [...rawReports];
  if (isManager) {
    const priorityRank: Record<string, number> = {
      TINGGI: 1,
      NORMAL: 2,
      RENDAH: 3,
    };

    reports.sort((a, b) => {
      const isDecisionA = a.status === "MENUNGGU_KEPUTUSAN" ? 1 : 0;
      const isDecisionB = b.status === "MENUNGGU_KEPUTUSAN" ? 1 : 0;
      if (isDecisionA !== isDecisionB) return isDecisionB - isDecisionA;

      if (
        a.status === "MENUNGGU_KEPUTUSAN" &&
        b.status === "MENUNGGU_KEPUTUSAN"
      ) {
        const pA = priorityRank[a.priority || "NORMAL"] || 99;
        const pB = priorityRank[b.priority || "NORMAL"] || 99;
        if (pA !== pB) return pA - pB;
        return (
          new Date(a.stageEnteredAt).getTime() -
          new Date(b.stageEnteredAt).getTime()
        );
      }

      const isConfA = a.status === "MENUNGGU_KONFIRMASI" ? 1 : 0;
      const isConfB = b.status === "MENUNGGU_KONFIRMASI" ? 1 : 0;
      if (isConfA !== isConfB) return isConfB - isConfA;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const baruCount = reports.filter((r) => r.status === "BARU").length;
  const menungguKeputusanCount = reports.filter(
    (r) => r.status === "MENUNGGU_KEPUTUSAN"
  ).length;
  const menungguKonfirmasiCount = reports.filter(
    (r) => r.status === "MENUNGGU_KONFIRMASI"
  ).length;

  return (
    <div className="space-y-6">
      {dbError && <DbErrorNotice />}
      {/* Header Halaman */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${roleMeta.badgeColor}`}
              >
                {roleMeta.label}
              </span>

              {canVerify && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-900 border border-sky-200">
                  Antrean Verifikasi (Baru): {baruCount}
                </span>
              )}

              {isManager && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200">
                    Menunggu Keputusan: {menungguKeputusanCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                    Menunggu Konfirmasi: {menungguKonfirmasiCount}
                  </span>
                </>
              )}

              {session.role === "TEKNISI" && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                  Identitas pelapor disembunyikan
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {showArchived
                ? "Arsip Laporan Kerusakan"
                : session.role === "PENGELOLA"
                ? "Antrean Verifikasi Laporan Cluster"
                : isManager
                ? "Antrean Keputusan & Konfirmasi Hasil Perbaikan"
                : session.role === "PENGGUNA"
                ? "Laporan Saya"
                : "Daftar Laporan Fasilitas Taman"}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              {session.role === "PENGELOLA"
                ? "Saring laporan Baru: nyatakan Valid (plus prioritas), Tidak Valid (dengan alasan), atau gabungkan laporan ganda."
                : isManager
                ? "Urutan laporan otomatis memprioritaskan tingkat Tinggi dan waktu terlama. Setujui untuk menerbitkan SPK atau tolak dengan alasan."
                : session.role === "PENGGUNA"
                ? "Pantau status pengerjaan kerusakan aset. Anda dapat membatalkan laporan selama masih berstatus Baru."
                : session.role === "ADMIN" || session.role === "OWNER"
                ? "Pantau seluruh laporan kerusakan aset lintas cluster di perusahaan (hanya lihat)."
                : "Seluruh riwayat status tercatat secara transparan sesuai alur penanganan."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {session.role === "PENGGUNA" && (
              <Link
                href="/dashboard/lapor"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Laporan Baru</span>
              </Link>
            )}

            <Link
              href={
                showArchived
                  ? "/dashboard/laporan"
                  : "/dashboard/laporan?arsip=1"
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition shadow-2xs"
            >
              <Archive className="w-4 h-4 text-slate-500" />
              <span>
                {showArchived
                  ? "← Kembali ke Laporan Aktif"
                  : "Lihat Arsip Laporan"}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Board Interaktif: KPI, Filter Tab, Search & Kartu Tiket */}
      <LaporanClientBoard
        reports={reports}
        role={session.role}
        canArchive={canArchive}
        canVerify={canVerify}
        isManager={isManager}
        initialQuery={initialQuery}
        allVendorsWithAreas={allVendorsWithAreas}
        picTechnicians={picTechnicians}
      />
    </div>
  );
}
