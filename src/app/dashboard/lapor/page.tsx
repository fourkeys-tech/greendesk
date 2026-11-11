import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { query } from "@/lib/db";
import { reportableAssetSql } from "@/lib/scopes";
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

  let assets: {
    code: string;
    name: string;
    parkName: string;
    clusterName: string;
    categoryName: string;
    damageTypes: string[];
  }[];
  try {
    const params: unknown[] = [];
    const companyClause = session.companyId
      ? (() => {
          params.push(session.companyId);
          return ` AND a."companyId" = $${params.length}`;
        })()
      : "";
    assets = await query<{
      code: string;
      name: string;
      parkName: string;
      clusterName: string;
      categoryName: string;
      damageTypes: string[];
    }>(
      `SELECT a."code",
              a."name",
              p."name" AS "parkName",
              cl."name" AS "clusterName",
              cat."name" AS "categoryName",
              cat."damageTypes"
       FROM "Asset" a
       JOIN "Park" p ON p."id" = a."parkId"
       JOIN "Cluster" cl ON cl."id" = p."clusterId"
       JOIN "Complex" cx ON cx."id" = cl."complexId"
       JOIN "Category" cat ON cat."id" = a."categoryId"
       WHERE ${reportableAssetSql("a", "cat", "p", "cl", "cx")}${companyClause}
       ORDER BY a."code" ASC`,
      params
    );
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

      <ManualReportForm assets={assets} />
    </div>
  );
}
