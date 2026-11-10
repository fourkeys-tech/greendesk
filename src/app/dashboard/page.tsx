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
  let visibleReports: any[] = [];
  try {
    visibleReports = await getScopedReportsForUser(session);
  } catch {
    visibleReports = [];
  }

  // Ambil metrik master data dari database HANYA sesuai kebutuhan role pengguna saat ini
  let assetCount = 0;
  let auditCount = 0;
  let vendorCount = 0;
  let technicianCount = 0;

  if (session.companyId) {
    const companyId = session.companyId;
    try {
      if (session.role === "ADMIN") {
        [assetCount, auditCount, vendorCount, technicianCount] =
          await Promise.all([
            prisma.asset.count({ where: { companyId } }),
            prisma.auditLog.count({ where: { companyId } }),
            prisma.vendor.count({ where: { companyId } }),
            prisma.technician.count({ where: { companyId } }),
          ]);
      } else if (session.role === "PENGELOLA") {
        assetCount = await prisma.asset.count({ where: { companyId } });
      } else if (session.role === "MANAGER") {
        vendorCount = await prisma.vendor.count({ where: { companyId } });
      } else if (session.role === "OWNER") {
        [assetCount, vendorCount] = await Promise.all([
          prisma.asset.count({ where: { companyId } }),
          prisma.vendor.count({ where: { companyId } }),
        ]);
      } else if (session.role === "PIC_VENDOR") {
        technicianCount = await prisma.technician.count({
          where: { companyId },
        });
      }
    } catch {
      // Fallback statis dev/testing
    }
  }

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

    case "PIC_VENDOR": {
      const vendorRecord = await prisma.vendor.findUnique({
        where: { picUserId: session.id },
        select: { lastTechnicianConfirmedAt: true },
      });
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const needsConfirmation =
        !vendorRecord?.lastTechnicianConfirmedAt ||
        vendorRecord.lastTechnicianConfirmedAt < ninetyDaysAgo;

      return (
        <VendorDashboard
          session={session}
          reports={visibleReports}
          technicianCount={technicianCount}
          needsConfirmation={needsConfirmation}
          lastConfirmedAt={vendorRecord?.lastTechnicianConfirmedAt?.toISOString() ?? null}
        />
      );
    }

    case "TEKNISI":
      return (
        <TechnicianDashboard session={session} reports={visibleReports} />
      );

    case "ADMIN": {
      const companyId = session.companyId;
      let pendingTechnicians: any[] = [];
      let complexCount = 1;
      let clusterCount = 2;
      let parkCount = 4;
      let activeAssetCount = 12;
      let inactiveAssetCount = 1;
      let categoryCount = 5;
      let pengelolaCount = 2;
      let managerCount = 1;
      let activeTempAssignments: any[] = [];
      let blockedUsersCount = 0;
      let recentAuditLogs: any[] = [];

      if (companyId) {
        try {
          const [
            techs,
            [cx, cl, pk, actA, inactA, catC],
            [peng, mgr, tempAssign, blk],
            audits,
          ] = await Promise.all([
            prisma.technician.findMany({
              where: { companyId, approvalStatus: "PENDING" },
              include: { vendor: { select: { name: true } } },
              orderBy: { createdAt: "desc" },
              take: 6,
            }),
            Promise.all([
              prisma.complex.count({ where: { companyId } }),
              prisma.cluster.count({ where: { companyId } }),
              prisma.park.count({ where: { companyId } }),
              prisma.asset.count({ where: { companyId, isActive: true } }),
              prisma.asset.count({ where: { companyId, isActive: false } }),
              prisma.category.count({ where: { companyId } }),
            ]),
            Promise.all([
              prisma.user.count({ where: { companyId, role: "PENGELOLA" } }),
              prisma.user.count({ where: { companyId, role: "MANAGER" } }),
              prisma.clusterManagerAssignment.findMany({
                where: {
                  isTemporary: true,
                  cluster: { companyId },
                  validUntil: { gte: new Date() },
                },
                include: {
                  user: { select: { name: true } },
                  cluster: { select: { name: true } },
                },
              }),
              prisma.user.count({ where: { companyId, isBlocked: true } }),
            ]),
            prisma.auditLog.findMany({
              where: { companyId },
              orderBy: { createdAt: "desc" },
              take: 5,
            }),
          ]);

          pendingTechnicians = techs;
          complexCount = cx;
          clusterCount = cl;
          parkCount = pk;
          activeAssetCount = actA;
          inactiveAssetCount = inactA;
          categoryCount = catC;
          pengelolaCount = peng;
          managerCount = mgr;
          activeTempAssignments = tempAssign;
          blockedUsersCount = blk;
          recentAuditLogs = audits;
        } catch {
          // Fallback statis dev/testing
        }
      }

      return (
        <AdminDashboard
          session={session}
          reports={visibleReports}
          assetCount={assetCount}
          auditCount={auditCount}
          vendorCount={vendorCount}
          technicianCount={technicianCount}
          pendingTechnicians={pendingTechnicians}
          hierarchyStats={{
            complexCount,
            clusterCount,
            parkCount,
            activeAssetCount,
            inactiveAssetCount,
            categoryCount,
          }}
          staffStats={{
            pengelolaCount,
            managerCount,
            activeTempAssignments,
            blockedUsersCount,
          }}
          recentAuditLogs={recentAuditLogs}
        />
      );
    }

    case "OWNER": {
      const companyId = session.companyId;
      let clustersWithStats: any[] = [];
      let vendorsWithStats: any[] = [];
      let recentAuditLogs: any[] = [];

      if (companyId) {
        try {
          [clustersWithStats, vendorsWithStats, recentAuditLogs] = await Promise.all([
            prisma.cluster.findMany({
              where: { companyId },
              select: {
                id: true,
                name: true,
                parks: {
                  select: {
                    id: true,
                    name: true,
                    _count: { select: { assets: true } },
                  },
                },
              },
              orderBy: { name: "asc" },
            }),
            prisma.vendor.findMany({
              where: { companyId },
              select: {
                id: true,
                name: true,
                type: true,
                warrantyDays: true,
                _count: { select: { workOrders: true, technicians: true } },
              },
              orderBy: { createdAt: "asc" },
            }),
            prisma.auditLog.findMany({
              where: { companyId },
              orderBy: { createdAt: "desc" },
              take: 5,
            }),
          ]);
        } catch {
          // Fallback statis dev/testing
        }
      }

      return (
        <OwnerDashboard
          session={session}
          reports={visibleReports}
          assetCount={assetCount}
          vendorCount={vendorCount}
          clustersWithStats={clustersWithStats}
          vendorsWithStats={vendorsWithStats}
          recentAuditLogs={recentAuditLogs}
        />
      );
    }

    default:
      redirect("/login");
  }
}
