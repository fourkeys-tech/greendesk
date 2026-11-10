import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { UserCheck, LogOut, Wrench } from "lucide-react";
import { logoutAction } from "@/app/actions/auth-actions";

export default async function ProfilTeknisiPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const tech = await prisma.technician.findUnique({
    where: { userId: session.id },
    include: { vendor: true },
  });

  if (!hasPermission(session.role, "VIEW_OWN_TECH_PROFILE") && !tech) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Halaman ini khusus untuk personel dengan profil teknisi aktif.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                TKN-M4 · Profil Teknisi Lapangan
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Data Diri Teknisi
              </h1>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar dari Akun</span>
            </button>
          </form>
        </div>

        {tech ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-4">
              {tech.facePhotoUrl ? (
                <img
                  src={tech.facePhotoUrl}
                  alt={tech.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-800 font-extrabold text-xl flex items-center justify-center">
                  {tech.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{tech.fullName}</h2>
                <p className="text-xs text-slate-500 font-mono">{tech.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Status: {tech.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Persetujuan: {tech.approvalStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Vendor Rekanan
                </span>
                <div className="font-bold text-slate-900 text-sm">{tech.vendor.name}</div>
                <div className="text-slate-500 text-[11px]">{tech.vendor.type} · Masa Garansi: {tech.vendor.warrantyDays} Hari</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Kontak WhatsApp
                </span>
                <div className="font-bold text-slate-900 text-sm">{tech.whatsapp}</div>
                <div className="text-slate-500 text-[11px]">Terdaftar untuk penugasan lapangan</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 sm:col-span-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Bidang Keahlian Teknis
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tech.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-xs shadow-2xs"
                    >
                      🛠️ {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-4">
            Data profil teknisi belum ditemukan.
          </p>
        )}
      </div>
    </div>
  );
}

