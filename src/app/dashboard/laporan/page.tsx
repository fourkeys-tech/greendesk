import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getReportViewScope, hasPermission } from "@/lib/permissions";
import { getScopedReportsForUser } from "@/lib/services/foundation";
import { ArchiveReportButton } from "./archive-button";
import { CancelReportButton } from "./cancel-report-button";
import { PengelolaVerificationPanel } from "./pengelola-verification-panel";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ arsip?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const showArchived = resolvedParams.arsip === "1";

  const reports = await getScopedReportsForUser(session, {
    includeArchived: showArchived,
  });

  const scope = getReportViewScope(session.role);
  const canArchive = hasPermission(session.role, "ARCHIVE_REPORT");
  const canVerify = hasPermission(session.role, "VERIFY_AND_PRIORITIZE");

  const baruCount = reports.filter((r) => r.status === "BARU").length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Cakupan Role {session.role}: {scope}
              </span>
              {canVerify && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
                  Fase 4 – Antrean Laporan Baru Menunggu Verifikasi: {baruCount}
                </span>
              )}
              {session.role === "TEKNISI" && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Privasi Aktif: Identitas Pelapor Disembunyikan di Query DB
                </span>
              )}
              {session.role === "ADMIN" && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                  Mode Hanya Lihat (Admin Tidak Bisa Verifikasi/Putuskan)
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {showArchived
                ? "Arsip Laporan Kerusakan (archivedAt != null)"
                : session.role === "PENGELOLA"
                ? "Antrean Verifikasi Laporan Cluster Saya"
                : "Daftar & Riwayat Laporan Kerusakan"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {session.role === "PENGELOLA"
                ? "Saring laporan BARU di cluster Anda: nyatakan Valid + tetapkan prioritas (Tinggi/Normal/Rendah), tandai Tidak Valid dengan alasan wajib, atau gabungkan laporan ganda."
                : session.role === "PENGGUNA"
                ? "Pantau status laporan Anda. Laporan hanya dapat dibatalkan selama statusnya masih BARU."
                : "Sesuai PRD, laporan tidak pernah dihapus permanen. Query default menyembunyikan laporan yang diarsipkan."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {session.role === "PENGGUNA" && (
              <Link
                href="/dashboard/lapor"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                + Buat Laporan Baru
              </Link>
            )}
            <Link
              href={
                showArchived
                  ? "/dashboard/laporan"
                  : "/dashboard/laporan?arsip=1"
              }
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition"
            >
              {showArchived
                ? "← Kembali ke Laporan Aktif"
                : "Lihat Arsip Laporan"}
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Tidak ada laporan {showArchived ? "di arsip " : "aktif "}untuk
            cakupan role <strong>{session.role}</strong> saat ini.
          </div>
        ) : (
          reports.map((report) => {
            const daysInStage = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(report.stageEnteredAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            const reporter =
              "reporter" in report && report.reporter
                ? (report.reporter as { name: string; email: string })
                : null;
            const warrantyVendor =
              "underWarrantyOfVendor" in report
                ? (report.underWarrantyOfVendor as { name: string } | null)
                : null;
            const parentReport =
              "parentReport" in report
                ? (report.parentReport as { ticketNo: string; status: string } | null)
                : null;
            const mergedChildren =
              "mergedChildReports" in report
                ? (report.mergedChildReports as Array<{ id: string; ticketNo: string; status: string }>)
                : [];

            // Kandidat laporan induk untuk aset yang sama (saat Pengelola ingin menggabungkan laporan)
            const candidateParents = reports
              .filter(
                (r) =>
                  r.id !== report.id &&
                  r.asset.code === report.asset.code &&
                  r.status !== "DIGABUNG" &&
                  r.status !== "TIDAK_VALID" &&
                  r.status !== "DIBATALKAN"
              )
              .map((r) => ({
                id: r.id,
                ticketNo: r.ticketNo,
                status: r.status,
                description: r.description,
              }));

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-white">
                      {report.ticketNo}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
                      Status: {report.status}
                    </span>
                    {report.priority && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        Prioritas: {report.priority}
                      </span>
                    )}
                    {warrantyVendor && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        🛡️ Masih Dalam Garansi Vendor ({warrantyVendor.name})
                      </span>
                    )}
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      ⏱️ {daysInStage} hari di tahap {report.status} · Saluran:{" "}
                      {report.channel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.role === "PENGGUNA" &&
                      report.status === "BARU" && (
                        <CancelReportButton reportId={report.id} />
                      )}

                    {canArchive && (
                      <ArchiveReportButton
                        reportId={report.id}
                        isArchived={Boolean(report.archivedAt)}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Aset: {report.asset.name} ({report.asset.code})
                  </div>
                  <div className="text-xs text-slate-500">
                    Taman: {report.asset.park.name} · Cluster:{" "}
                    {report.asset.park.cluster.name}
                  </div>
                </div>

                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  {report.description}
                </p>

                {report.reason && (
                  <div className="text-xs p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                    <strong>Alasan / Catatan:</strong> {report.reason}
                  </div>
                )}

                {parentReport && (
                  <div className="text-xs p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
                    🔗 Laporan ini digabung ke Laporan Induk:{" "}
                    <strong className="font-mono">
                      {parentReport.ticketNo}
                    </strong>{" "}
                    (Status Induk: <strong>{parentReport.status}</strong>)
                  </div>
                )}

                {mergedChildren && mergedChildren.length > 0 && (
                  <div className="text-xs p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    📌 Laporan Induk dari {mergedChildren.length} laporan
                    gabungan:{" "}
                    <strong className="font-mono">
                      {mergedChildren.map((c) => c.ticketNo).join(", ")}
                    </strong>
                  </div>
                )}

                {report.photos && report.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {report.photos.map((p) => (
                      <img
                        key={p.id}
                        src={p.url}
                        alt="Foto Laporan"
                        className="h-20 w-28 object-cover rounded-lg border border-slate-200"
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div>
                    {reporter ? (
                      <span>
                        Pelapor: <strong>{reporter.name}</strong> (
                        {reporter.email})
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        🔒 Identitas Pelapor Disembunyikan (Aturan Privasi
                        Teknisi PRD 14.5)
                      </span>
                    )}
                  </div>

                  {report.workOrder && (
                    <div className="font-mono text-xs bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded border border-indigo-200">
                      SPK: {report.workOrder.spkNo} (
                      {report.workOrder.vendor.name})
                    </div>
                  )}
                </div>

                {/* Panel Verifikasi Pengelola (Hanya muncul untuk PENGELOLA pada laporan berstatus BARU) */}
                {canVerify && report.status === "BARU" && (
                  <PengelolaVerificationPanel
                    reportId={report.id}
                    ticketNo={report.ticketNo}
                    assetCode={report.asset.code}
                    candidateParentReports={candidateParents}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
