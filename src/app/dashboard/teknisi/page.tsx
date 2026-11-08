import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  PicTechnicianForms,
  TechnicianStatusSelect,
} from "./pic-technician-forms";

export default async function TeknisiManagementPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "VIEW_TECHNICIANS")) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Role <strong>{session.role}</strong> tidak memiliki izin mengakses
          manajemen teknisi.
        </p>
      </div>
    );
  }

  const isPicVendor = hasPermission(session.role, "MANAGE_OWN_TECHNICIANS");

  const ownVendor = isPicVendor
    ? await prisma.vendor.findUnique({
        where: { picUserId: session.id },
      })
    : null;

  const technicians = session.companyId
    ? await prisma.technician.findMany({
        where:
          isPicVendor && ownVendor
            ? { companyId: session.companyId, vendorId: ownVendor.id }
            : { companyId: session.companyId },
        include: { vendor: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 mb-2">
          Fase 2 – Manajemen Teknisi Lapangan
        </span>
        <h1 className="text-xl font-bold text-slate-900">
          Daftar & Status Teknisi Vendor
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Teknisi didaftarkan oleh PIC Vendor, disetujui oleh Admin, dan
          dinonaktifkan otomatis bila tidak aktif selama 60 hari.
        </p>
      </div>

      {isPicVendor && ownVendor && (
        <PicTechnicianForms
          vendorName={ownVendor.name}
          lastConfirmedAt={
            ownVendor.lastTechnicianConfirmedAt?.toISOString() ?? null
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {technicians.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {t.facePhotoUrl ? (
                  <img
                    src={t.facePhotoUrl}
                    alt={t.fullName}
                    className="w-12 h-12 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                    {t.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900">{t.fullName}</div>
                  <div className="text-xs text-slate-600">
                    Vendor: <strong>{t.vendor.name}</strong>
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  t.approvalStatus === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : t.approvalStatus === "PENDING"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {t.approvalStatus}
              </span>
            </div>

            <div className="text-xs text-slate-600">
              Email: <span className="font-mono">{t.email}</span> · WA:{" "}
              {t.whatsapp}
            </div>
            <div className="text-xs text-slate-600">
              Keahlian: {t.skills.join(", ")}
            </div>
            <div className="text-[11px] text-slate-400">
              Aktif Terakhir:{" "}
              {new Date(t.lastActiveAt).toLocaleDateString("id-ID")}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Status Kehadiran:
              </span>
              {isPicVendor ? (
                <TechnicianStatusSelect
                  technicianId={t.id}
                  currentStatus={t.status}
                />
              ) : (
                <span className="font-bold text-slate-800">{t.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
