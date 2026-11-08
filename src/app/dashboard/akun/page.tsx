import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { InternalAccountForms } from "./internal-account-forms";

export default async function AkunInternalPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (!hasPermission(session.role, "MANAGE_INTERNAL_ACCOUNTS")) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
        <h1 className="text-lg font-bold">Akses Ditolak (403)</h1>
        <p className="text-sm mt-1">
          Hanya <strong>ADMIN</strong> yang dapat mengelola Akun Internal dan
          memblokir akun pengguna.
        </p>
      </div>
    );
  }

  const [users, clusters] = session.companyId
    ? await Promise.all([
        prisma.user.findMany({
          where: { companyId: session.companyId },
          include: {
            staffCluster: true,
            managerAssignments: { include: { cluster: true } },
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        }),
        prisma.cluster.findMany({
          where: { companyId: session.companyId },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  const managers = users
    .filter((u) => u.role === "MANAGER")
    .map((m) => ({ id: m.id, name: m.name, email: m.email }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 mb-2">
          Fase 1 – Manajemen Akun Internal & Delegasi Manager
        </span>
        <h1 className="text-xl font-bold text-slate-900">
          Manajemen Akun Internal, Manager Pengganti & Rekam Jejak ({session.companyName})
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Buat akun Pengelola (1 cluster), Manager (satu/lebih cluster), tunjuk
          Manager Pengganti Sementara saat berhalangan, serta pantau rekam jejak
          laporan per akun.
        </p>
      </div>

      {/* Form Pembuatan Akun Internal & Manager Pengganti Sementara */}
      <InternalAccountForms clusters={clusters} managers={managers} />

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="p-3.5 font-semibold">Nama & Email</th>
                <th className="p-3.5 font-semibold">Role</th>
                <th className="p-3.5 font-semibold">
                  Cakupan / Cluster Tertaut
                </th>
                <th className="p-3.5 font-semibold">Rekam Jejak Laporan</th>
                <th className="p-3.5 font-semibold">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => {
                const meta = ROLE_METADATA[u.role];
                return (
                  <tr key={u.id} className="hover:bg-slate-50 align-top">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">
                        {u.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {u.email}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${meta.badgeColor}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-700 space-y-1">
                      {u.staffCluster ? (
                        <div>
                          Cluster Pengelola:{" "}
                          <strong>{u.staffCluster.name}</strong>
                        </div>
                      ) : u.managerAssignments.length > 0 ? (
                        <div className="space-y-1">
                          {u.managerAssignments.map((m) => (
                            <div
                              key={m.id}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <span className="font-semibold">
                                {m.cluster.name}
                              </span>
                              {m.isTemporary && (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold">
                                  Pengganti Sementara s/d{" "}
                                  {m.validUntil
                                    ? new Date(
                                        m.validUntil
                                      ).toLocaleDateString("id-ID")
                                    : "-"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        meta.scopeDescription
                      )}
                    </td>
                    <td className="p-3.5 text-xs">
                      <span className="text-emerald-700 font-semibold">
                        Valid: {u.validReportCount}
                      </span>{" "}
                      ·{" "}
                      <span className="text-rose-700 font-semibold">
                        Tidak Valid: {u.invalidReportCount}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          u.isBlocked
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {u.isBlocked ? "Diblokir" : "Aktif"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
