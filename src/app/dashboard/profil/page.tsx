import { redirect } from "next/navigation";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_METADATA } from "@/lib/permissions";
import { activeAssignmentWhere } from "@/lib/scopes";
import { formatWibDate, formatWibDateTime } from "@/lib/dates";
import { logoutAction } from "@/app/actions/auth-actions";
import { DbErrorNotice } from "@/components/dashboard/db-error-notice";
import { ProfileForm } from "./profile-form";

export default async function DashboardProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        staffCluster: {
          include: {
            complex: true,
          },
        },
        managerAssignments: {
          where: activeAssignmentWhere(new Date()),
          orderBy: { isTemporary: "asc" },
          include: {
            cluster: {
              include: { complex: true },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("[profil] gagal memuat profil:", error);
    return <DbErrorNotice />;
  }

  if (!user) redirect("/login");

  const roleMeta = ROLE_METADATA[user.role];
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Profil Saya
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Informasi identitas akun, hak akses role, dan pengaturan data pribadi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (4 Cols): Kartu Identitas Akun */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />

          {/* Avatar Initials Circle */}
          <div className="w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl font-black tracking-tight shadow-md shadow-emerald-600/25 ring-4 ring-emerald-50 mt-2">
            {initials || "GP"}
          </div>

          <h2 className="text-lg font-extrabold text-slate-900 mt-4">
            {user.name}
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5 break-all">
            {user.email}
          </p>

          {/* Role Badge Pill */}
          <div className="mt-4">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full border shadow-2xs ${roleMeta.badgeColor}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {roleMeta.label}
            </span>
          </div>

          {/* Account Details List */}
          <div className="w-full mt-6 pt-5 border-t border-slate-100 space-y-3 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Metode Login:</span>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {user.loginMethod}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Status Akun:</span>
              {user.isActive ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Nonaktif
                </span>
              )}
            </div>
            {user.lastLoginAt && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">
                  Terakhir Masuk:
                </span>
                <span className="font-medium text-slate-700">
                  {formatWibDateTime(user.lastLoginAt)}
                </span>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="w-full mt-6 pt-5 border-t border-slate-100">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200/90 hover:border-rose-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Akun (Logout)</span>
              </button>
            </form>
          </div>
        </div>

        {/* Kolom Kanan (8 Cols): Detail Role & Form Edit Data */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card Khusus Berdasarkan Role */}
          {user.role === "PENGGUNA" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-4">
                Rekam Jejak Pelapor Warga / Pengunjung
              </h3>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200">
                  <div className="text-2xl font-black text-emerald-800">
                    {user.validReportCount}
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    Laporan Terverifikasi Valid
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <div className="text-2xl font-black text-slate-700">
                    {user.invalidReportCount}
                  </div>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">
                    Laporan Tidak Valid
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                Data rekam jejak ini digunakan secara transparan oleh pengelola
                untuk memprioritaskan penanganan laporan.
              </div>
            </div>
          )}

          {user.role === "PENGELOLA" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-4">
                Cluster Tanggung Jawab Pengelola
              </h3>
              {user.staffCluster ? (
                <div className="rounded-2xl bg-emerald-50/40 border border-emerald-200/80 p-5 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-emerald-950">
                      {user.staffCluster.name}
                    </h4>
                    <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                      Kompleks: {user.staffCluster.complex.name}
                    </p>
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                      Anda memverifikasi laporan kerusakan dan dapat mengajukan
                      pergantian vendor untuk aset di cluster ini.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                  Akun Anda belum ditautkan ke cluster mana pun. Hubungi Admin
                  Perusahaan.
                </div>
              )}
            </div>
          )}

          {user.role === "MANAGER" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-4">
                Cluster Tertaut (Wewenang Keputusan &amp; SPK)
              </h3>
              {user.managerAssignments.length > 0 ? (
                <div className="space-y-2.5">
                  {user.managerAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {a.cluster.name}
                          </span>
                          <span className="text-slate-500">
                            Kompleks: {a.cluster.complex.name}
                          </span>
                        </div>
                      </div>
                      <div>
                        {a.isTemporary ? (
                          <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-amber-200">
                            Pengganti Sementara (s/d {formatWibDate(a.validUntil)})
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-200">
                            Manajer Tetap
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                  Belum ada cluster yang ditautkan ke akun Manager Anda. Hubungi
                  Admin.
                </div>
              )}
            </div>
          )}

          {(user.role === "ADMIN" || user.role === "OWNER") && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-4">
                Cakupan Akses {roleMeta.label}
              </h3>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <h4 className="text-base font-extrabold text-slate-900">
                    {session.companyName || "Belum terhubung ke perusahaan"}
                  </h4>
                  <p className="text-xs font-semibold text-slate-600">
                    {roleMeta.scopeDescription}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {user.role === "ADMIN"
                      ? "Anda mengelola wilayah, aset, QR, kategori, akun internal, dan vendor; menyetujui teknisi; serta memblokir akun pelapor bermasalah. Admin tidak memverifikasi atau memutuskan laporan."
                      : "Anda memantau ringkasan semua cluster, rapor vendor, eskalasi ganti vendor, dan riwayat perubahan data (hanya lihat)."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form Pembaruan Profil */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-5">
              Ubah Data Diri
            </h3>

            <ProfileForm
              name={user.name}
              email={user.email}
              isReporter={user.role === "PENGGUNA"}
              reporterStatus={user.reporterStatus}
              blockHouseNo={user.blockHouseNo}
              hasConsent={!!user.dataConsentAt}
              dataConsentLabel={
                user.dataConsentAt
                  ? `disetujui ${formatWibDate(user.dataConsentAt)}`
                  : "belum disetujui"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
