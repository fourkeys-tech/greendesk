import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { reportableAssetSql } from "@/lib/scopes";
import { BottomNav } from "@/components/BottomNav";
import { ManualReportForm } from "@/app/dashboard/lapor/manual-report-form";

export const dynamic = "force-dynamic";

export default async function CitizenManualReportPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?returnTo=%2Fberanda%2Flapor");
  }
  if (session.role !== "PENGGUNA") {
    redirect("/dashboard/lapor");
  }
  if (!hasPermission(session.role, "CREATE_REPORT")) {
    redirect("/beranda");
  }

  let assets: {
    code: string;
    name: string;
    parkName: string;
    clusterName: string;
    categoryName: string;
    damageTypes: string[];
  }[] = [];
  let dbError = false;

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
    console.error("[beranda/lapor] gagal memuat aset:", error);
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-[#F6F5F0] px-4 pt-5 pb-32">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center justify-between">
          <Link
            href="/beranda/laporan"
            aria-label="Kembali ke Laporan Saya"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2.5 pr-4 text-xs font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Laporan Saya</span>
          </Link>
          <span className="text-xs font-extrabold tracking-wide text-[#1B4D3E]">
            GreenDesk
          </span>
        </header>

        <div className="rounded-3xl bg-[#1f2a27] p-5 text-white shadow-lg">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Buat Laporan Kerusakan Fasilitas Taman
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Pilih aset taman di bawah ini, atau gunakan tombol Scan QR pada
            bilah navigasi bawah agar aset terpilih otomatis.
          </p>
        </div>

        {dbError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            Gagal memuat daftar aset dari basis data. Silakan coba lagi nanti.
          </div>
        ) : (
          <ManualReportForm
            assets={assets}
            reportsHref="/beranda/laporan"
          />
        )}
      </div>

      <BottomNav isLoggedIn userRole="PENGGUNA" />
    </div>
  );
}
