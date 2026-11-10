import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reportableAssetWhere } from "@/lib/scopes";
import {
  AccessDeniedNotice,
  DbErrorNotice,
} from "@/components/dashboard/db-error-notice";
import { ManualReportForm } from "./manual-report-form";

export default async function BuatLaporanPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "CREATE_REPORT")) {
    return (
      <AccessDeniedNotice
        message={`Laporan kerusakan dibuat oleh warga (Pengguna). Role ${ROLE_METADATA[session.role].label} tidak membuat laporan dari halaman ini.`}
      />
    );
  }

  let assets;
  try {
    assets = await prisma.asset.findMany({
      where: {
        ...reportableAssetWhere(),
        ...(session.companyId ? { companyId: session.companyId } : {}),
      },
      include: {
        park: { include: { cluster: true } },
        category: true,
      },
      orderBy: { code: "asc" },
    });
  } catch (error) {
    console.error("[lapor] gagal memuat aset:", error);
    return <DbErrorNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Buat Laporan Kerusakan Fasilitas Taman
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Pilih aset di bawah ini, atau pindai stiker QR yang menempel pada
            fasilitas taman agar aset terpilih otomatis.
          </p>
        </div>
      </div>

      <ManualReportForm
        assets={assets.map((a) => ({
          code: a.code,
          name: a.name,
          parkName: a.park.name,
          clusterName: a.park.cluster.name,
          categoryName: a.category.name,
          damageTypes: a.category.damageTypes,
        }))}
      />
    </div>
  );
}
