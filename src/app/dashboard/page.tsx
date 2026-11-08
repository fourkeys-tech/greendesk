import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getScopedReportsForUser } from "@/lib/services/foundation";
import { prisma } from "@/lib/prisma";

import { CitizenDashboard } from "@/components/dashboard/views/citizen-dashboard";
import { PengelolaDashboard } from "@/components/dashboard/views/pengelola-dashboard";
import { ManagerDashboard } from "@/components/dashboard/views/manager-dashboard";
import { VendorDashboard } from "@/components/dashboard/views/vendor-dashboard";
import { TechnicianDashboard } from "@/components/dashboard/views/technician-dashboard";
import { AdminDashboard } from "@/components/dashboard/views/admin-dashboard";
import { OwnerDashboard } from "@/components/dashboard/views/owner-dashboard";

export default async function DashboardHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // Ambil laporan terfilter sesuai cakupan role pengguna
  const visibleReports = await getScopedReportsForUser(session);

  // Ambil metrik master data dari database
  const [assetCount, auditCount, vendorCount, technicianCount] =
    session.companyId
      ? await Promise.all([
          prisma.asset.count({ where: { companyId: session.companyId } }),
          prisma.auditLog.count({ where: { companyId: session.companyId } }),
          prisma.vendor.count({ where: { companyId: session.companyId } }),
          prisma.technician.count({
            where: { companyId: session.companyId },
          }),
        ])
      : [0, 0, 0, 0];

  // Render halaman khusus yang presisi sesuai hak akses & fungsi role
  switch (session.role) {
    case "PENGGUNA":
      return <CitizenDashboard session={session} reports={visibleReports} />;

    case "PENGELOLA":
      return (
        <PengelolaDashboard
          session={session}
          reports={visibleReports}
          assetCount={assetCount}
        />
      );

    case "MANAGER":
      return (
        <ManagerDashboard
          session={session}
          reports={visibleReports}
          vendorCount={vendorCount}
        />
      );

    case "PIC_VENDOR":
      return (
        <VendorDashboard
          session={session}
          reports={visibleReports}
          technicianCount={technicianCount}
        />
      );

    case "TEKNISI":
      return (
        <TechnicianDashboard session={session} reports={visibleReports} />
      );

    case "ADMIN":
      return (
        <AdminDashboard
          session={session}
          reports={visibleReports}
          assetCount={assetCount}
          auditCount={auditCount}
          vendorCount={vendorCount}
          technicianCount={technicianCount}
        />
      );

    case "OWNER":
      return (
        <OwnerDashboard
          session={session}
          reports={visibleReports}
          assetCount={assetCount}
          vendorCount={vendorCount}
        />
      );

    default:
      redirect("/login");
  }
}
