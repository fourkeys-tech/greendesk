import { redirect } from "next/navigation";
import { Building2, LogOut, Check, Lock } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_METADATA } from "@/lib/permissions";
import {
  logoutAction,
  updateUserProfileAction,
} from "@/app/actions/auth-actions";

export default async function DashboardProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      staffCluster: {
        include: {
          complex: true,
        },
      },
      managerAssignments: {
        include: {
          cluster: {
            include: { complex: true },
          },
        },
      },
      managedVendor: true,
      technicianProfile: true,
    },
  });

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
                  {new Date(user.lastLoginAt).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
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
                      Sesuai PRD v0.2, Pengelola bertanggung jawab memverifikasi
                      laporan kerusakan dan dapat mengajukan pergantian vendor
                      untuk aset di cluster ini.
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
                            Pengganti Sementara (s/d{" "}
                            {a.validUntil
                              ? new Date(a.validUntil).toLocaleDateString(
                                  "id-ID"
                                )
                              : "-"}
                            )
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

          {/* Form Pembaruan Profil */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-5">
              Ubah Data Diri
            </h3>

            <form
              action={async (formData) => {
                "use server";
                await updateUserProfileAction(formData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={user.name}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Email (Akun)
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/80 text-sm font-medium text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Email akun tidak dapat diubah secara langsung.</span>
                </p>
              </div>

              {user.role === "PENGGUNA" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Status Pelapor (Opsional)
                      </label>
                      <select
                        name="reporterStatus"
                        defaultValue={user.reporterStatus || ""}
                        className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="WARGA">Warga Perumahan</option>
                        <option value="PENGUNJUNG">Pengunjung Umum</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Blok / Nomor Rumah (Untuk Warga)
                      </label>
                      <input
                        type="text"
                        name="blockHouseNo"
                        defaultValue={user.blockHouseNo || ""}
                        placeholder="Mis. Blok B2 No. 08"
                        className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        name="dataConsent"
                        defaultChecked={!!user.dataConsentAt}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Saya menyetujui data laporan dan identitas saya
                        digunakan untuk keperluan perbaikan fasilitas taman
                        GreenPark (Data Consent:{" "}
                        {user.dataConsentAt
                          ? new Date(user.dataConsentAt).toLocaleDateString(
                              "id-ID"
                            )
                          : "Belum disetujui"}
                        ).
                      </span>
                    </label>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
