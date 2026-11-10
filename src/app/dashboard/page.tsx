import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getScopedReportsForUser } from "@/lib/services/foundation";
import { getVendorReportCard } from "@/lib/services/vendor-replacement";
import { REPORTER_REVIEW_THRESHOLD } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { activeAssignmentWhere, reporterInCompanyWhere } from "@/lib/scopes";
import { DbErrorNotice } from "@/components/dashboard/db-error-notice";

import { CitizenDashboard } from "@/components/dashboard/views/citizen-dashboard";
import { PengelolaDashboard } from "@/components/dashboard/views/pengelola-dashboard";
import { ManagerDashboard } from "@/components/dashboard/views/manager-dashboard";
import { VendorDashboard } from "@/components/dashboard/views/vendor-dashboard";
import { TechnicianDashboard } from "@/components/dashboard/views/technician-dashboard";
import { AdminDashboard } from "@/components/dashboard/views/admin-dashboard";
import {
  OwnerDashboard,
  type OwnerEscalationItem,
  type OwnerVendorSummary,
} from "@/components/dashboard/views/owner-dashboard";

export default async function DashboardHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  let visibleReports: any[] = [];
  let dbError = false;
  try {
    visibleReports = await getScopedReportsForUser(session, {
      throwOnError: true,
    });
  } catch {
    dbError = true;
    visibleReports = [];
  }

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
      dbError = true;
    }
  }

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
      let vendorRecord: { lastTechnicianConfirmedAt: Date | null } | null = null;
      try {
        vendorRecord = await prisma.vendor.findUnique({
          where: { picUserId: session.id },
          select: { lastTechnicianConfirmedAt: true },
        });
      } catch {
        dbError = true;
      }
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const needsConfirmation =
        !vendorRecord?.lastTechnicianConfirmedAt ||
        vendorRecord.lastTechnicianConfirmedAt < ninetyDaysAgo;

      return (
        <div className="space-y-4">
          {dbError && <DbErrorNotice />}
          <VendorDashboard
            session={session}
            reports={visibleReports}
            technicianCount={technicianCount}
            needsConfirmation={needsConfirmation}
            lastConfirmedAt={
              vendorRecord?.lastTechnicianConfirmedAt?.toISOString() ?? null
            }
          />
        </div>
      );
    }

    case "TEKNISI":
      return (
        <TechnicianDashboard session={session} reports={visibleReports} />
      );

    case "ADMIN": {
      const companyId = session.companyId;
      if (!companyId) {
        return (
          <DbErrorNotice
            title="Akun belum terhubung ke perusahaan"
            message="Hubungi pemilik platform untuk menautkan akun Anda ke perusahaan."
          />
        );
      }

      let pendingTechnicians: any[] = [];
      let pendingTechTotalCount = 0;
      let pendingReplacementForwardCount = 0;
      let complexCount = 0;
      let clusterCount = 0;
      let parkCount = 0;
      let activeAssetCount = 0;
      let inactiveAssetCount = 0;
      let categoryCount = 0;
      let pengelolaCount = 0;
      let managerCount = 0;
      let activeTempAssignments: any[] = [];
      let blockedUsersCount = 0;
      let reviewReportersCount = 0;
      let recentAuditLogs: any[] = [];

      try {
        const [
          techs,
          techTotal,
          replacementCount,
          [cx, cl, pk, actA, inactA, catC],
          [peng, mgr, tempAssign, blk, revCount],
          audits,
        ] = await Promise.all([
          prisma.technician.findMany({
            where: { companyId, approvalStatus: "PENDING" },
            include: { vendor: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 6,
          }),
          prisma.technician.count({
            where: { companyId, approvalStatus: "PENDING" },
          }),
          prisma.vendorReplacementRequest.count({
            where: { companyId, status: "DISETUJUI" },
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
                ...activeAssignmentWhere(new Date()),
              },
              include: {
                user: { select: { name: true } },
                cluster: { select: { name: true } },
              },
            }),
            prisma.user.count({
              where: { ...reporterInCompanyWhere(companyId), isBlocked: true },
            }),
            prisma.user.count({
              where: {
                ...reporterInCompanyWhere(companyId),
                invalidReportCount: { gte: REPORTER_REVIEW_THRESHOLD },
              },
            }),
          ]),
          prisma.auditLog.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);

        pendingTechnicians = techs;
        pendingTechTotalCount = techTotal;
        pendingReplacementForwardCount = replacementCount;
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
        reviewReportersCount = revCount;
        recentAuditLogs = audits;
      } catch (err) {
        console.error("[dashboard] gagal memuat ringkasan Admin:", err);
        dbError = true;
      }

      return (
        <div className="space-y-4">
          {dbError && <DbErrorNotice />}
          <AdminDashboard
            session={session}
            reports={visibleReports}
            assetCount={assetCount}
            auditCount={auditCount}
            vendorCount={vendorCount}
            technicianCount={technicianCount}
            pendingTechnicians={pendingTechnicians}
            pendingTechTotalCount={pendingTechTotalCount}
            pendingReplacementForwardCount={pendingReplacementForwardCount}
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
              reviewReportersCount,
            }}
            recentAuditLogs={recentAuditLogs}
          />
        </div>
      );
    }

    case "OWNER": {
      const companyId = session.companyId;
      if (!companyId) {
        return (
          <DbErrorNotice
            title="Akun belum terhubung ke perusahaan"
            message="Hubungi pemilik platform untuk menautkan akun Anda ke perusahaan."
          />
        );
      }

      let activeAssetCount = 0;
      let activeVendorCount = 0;
      let revisionTotalCount = 0;
      let warrantyDefectsTotalCount = 0;
      let escalationCount = 0;
      let recentEscalations: OwnerEscalationItem[] = [];
      let clustersWithStats: any[] = [];
      let vendorSummaries: OwnerVendorSummary[] = [];
      let recentAuditLogs: any[] = [];

      try {
        const [
          actAssetC,
          actVendorC,
          revC,
          warC,
          escCount,
          escRows,
          clusters,
          vendors,
          audits,
        ] = await Promise.all([
          prisma.asset.count({ where: { companyId, isActive: true } }),
          prisma.vendor.count({ where: { companyId, isActive: true } }),
          prisma.revisionNote.count({ where: { workOrder: { companyId } } }),
          prisma.report.count({
            where: {
              companyId,
              archivedAt: null,
              underWarrantyOfVendorId: { not: null },
              status: { notIn: ["DIBATALKAN", "TIDAK_VALID", "DIGABUNG"] },
            },
          }),
          prisma.vendorReplacementRequest.count({
            where: { companyId, status: "DITERUSKAN_KE_OWNER" },
          }),
          prisma.vendorReplacementRequest.findMany({
            where: { companyId, status: "DITERUSKAN_KE_OWNER" },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              requestNo: true,
              createdAt: true,
              ownerViewedAt: true,
              asset: { select: { name: true, code: true } },
              vendor: { select: { name: true } },
            },
          }),
          prisma.cluster.findMany({
            where: { companyId },
            select: {
              id: true,
              name: true,
              isActive: true,
              parks: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  _count: { select: { assets: { where: { isActive: true } } } },
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
              isActive: true,
              warrantyDays: true,
              _count: { select: { technicians: true } },
            },
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
          }),
          prisma.auditLog.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);

        activeAssetCount = actAssetC;
        activeVendorCount = actVendorC;
        revisionTotalCount = revC;
        warrantyDefectsTotalCount = warC;
        escalationCount = escCount;
        recentEscalations = escRows;
        clustersWithStats = clusters;
        recentAuditLogs = audits;

        vendorSummaries = await Promise.all(
          vendors.map(async (v) => {
            try {
              const card = await getVendorReportCard(companyId, v.id);
              return {
                id: v.id,
                name: v.name,
                type: v.type,
                isActive: v.isActive,
                warrantyDays: v.warrantyDays,
                technicianCount: v._count.technicians,
                totalJobs: card.metrics.totalJobs,
                completedJobs: card.metrics.completedJobs,
                avgDurationHours: card.metrics.avgDurationHours,
                revisionCount: card.metrics.revisionCount,
                warrantyDefectsCount: card.metrics.warrantyDefectsCount,
              };
            } catch {
              return {
                id: v.id,
                name: v.name,
                type: v.type,
                isActive: v.isActive,
                warrantyDays: v.warrantyDays,
                technicianCount: v._count.technicians,
                totalJobs: 0,
                completedJobs: 0,
                avgDurationHours: 0,
                revisionCount: 0,
                warrantyDefectsCount: 0,
              };
            }
          })
        );
      } catch (err) {
        console.error("[dashboard] gagal memuat ringkasan Owner:", err);
        dbError = true;
      }

      const completedDurations = visibleReports
        .filter((r) => r.status === "SELESAI" && r.workOrder?.confirmedAt)
        .map((r) => {
          const start = new Date(r.createdAt).getTime();
          const end = new Date(r.workOrder.confirmedAt).getTime();
          return Math.max(0, end - start) / (1000 * 60 * 60 * 24);
        });
      const avgResolutionDays =
        completedDurations.length > 0
          ? Math.round(
              (completedDurations.reduce((a, b) => a + b, 0) /
                completedDurations.length) *
                10
            ) / 10
          : null;

      return (
        <div className="space-y-4">
          {dbError && <DbErrorNotice />}
          <OwnerDashboard
            session={session}
            reports={visibleReports}
            activeAssetCount={activeAssetCount}
            totalAssetCount={assetCount}
            activeVendorCount={activeVendorCount}
            totalVendorCount={vendorCount}
            avgResolutionDays={avgResolutionDays}
            revisionTotalCount={revisionTotalCount}
            warrantyDefectsTotalCount={warrantyDefectsTotalCount}
            escalationCount={escalationCount}
            recentEscalations={recentEscalations}
            clustersWithStats={clustersWithStats}
            vendorSummaries={vendorSummaries}
            recentAuditLogs={recentAuditLogs}
          />
        </div>
      );
    }

    default:
      redirect("/login");
  }
}
