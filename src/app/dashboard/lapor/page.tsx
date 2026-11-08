import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ManualReportForm } from "./manual-report-form";

export default async function BuatLaporanPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "CREATE_REPORT")) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Sesuai Matriks Hak Akses PRD Bagian 4, hanya role{" "}
          <strong>PENGGUNA</strong> yang dapat membuat laporan kerusakan.
        </p>
      </div>
    );
  }

  const assets = await prisma.asset.findMany({
    where: { isActive: true },
    include: {
      park: { include: { cluster: true } },
      category: true,
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 mb-2">
            Fase 3 – Pelaporan Kerusakan (QR & Dashboard Manual)
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Buat Laporan Kerusakan Fasilitas Taman
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Anda dapat melapor dengan memilih aset secara manual di bawah ini,
            atau memindai langsung QR pada aset (mis.{" "}
            <Link
              href="/r/AST-BGV-001"
              className="text-emerald-700 font-semibold underline"
            >
              /r/AST-BGV-001
            </Link>
            ).
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
