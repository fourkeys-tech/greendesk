import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getScopedReportsForUser } from "@/lib/services/foundation";
import { getVendorReportCard } from "@/lib/services/vendor-replacement";
import { REPORTER_REVIEW_THRESHOLD } from "@/lib/permissions";
import { query, queryCount, queryOne } from "@/lib/db";
import type { AuditAction, Role, VendorType } from "@/lib/db-types";
import { activeAssignmentSql, reporterInCompanySql } from "@/lib/scopes";
import { DbErrorNotice } from "@/components/dashboard/db-error-notice";
import type { PendingTechnicianItem } from "@/components/dashboard/admin/pending-technicians-card";

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
            queryCount(`SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Technician" WHERE "companyId" = $1`, [companyId]),
          ]);
      } else if (session.role === "PENGELOLA") {
        assetCount = await queryCount(
          `SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1`,
          [companyId]
        );
      } else if (session.role === "MANAGER") {
        vendorCount = await queryCount(
          `SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "companyId" = $1`,
          [companyId]
        );
      } else if (session.role === "OWNER") {
        [assetCount, vendorCount] = await Promise.all([
          queryCount(`SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1`, [companyId]),
          queryCount(`SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "companyId" = $1`, [companyId]),
        ]);
      } else if (session.role === "PIC_VENDOR") {
        technicianCount = await queryCount(
          `SELECT COUNT(*)::int AS count FROM "Technician" WHERE "companyId" = $1`,
          [companyId]
        );
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
        vendorRecord = await queryOne<{ lastTechnicianConfirmedAt: Date | null }>(
          `SELECT "lastTechnicianConfirmedAt" FROM "Vendor" WHERE "picUserId" = $1`,
          [session.id]
        );
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

      let pendingTechnicians: PendingTechnicianItem[] = [];
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
      let activeTempAssignments: Array<{
        id: string;
        validUntil: Date | null;
        user: { name: string };
        cluster: { name: string };
      }> = [];
      let blockedUsersCount = 0;
      let reviewReportersCount = 0;
      let recentAuditLogs: Array<{
        id: string;
        action: AuditAction;
        entityName: string;
        summary: string;
        actorName: string;
        actorRole: Role;
        createdAt: Date;
      }> = [];

      try {
        const now = new Date();
        const [
          techs,
          techTotal,
          replacementCount,
          [cx, cl, pk, actA, inactA, catC],
          [peng, mgr, tempAssign, blk, revCount],
          audits,
        ] = await Promise.all([
          query<{
            id: string;
            fullName: string;
            email: string;
            whatsapp: string;
            skills: string[];
            facePhotoUrl: string | null;
            createdAt: Date;
            vendorName: string;
          }>(
            `SELECT t."id", t."fullName", t."email", t."whatsapp", t."skills",
                    t."facePhotoUrl", t."createdAt", v."name" AS "vendorName"
             FROM "Technician" t
             JOIN "Vendor" v ON v."id" = t."vendorId"
             WHERE t."companyId" = $1 AND t."approvalStatus" = 'PENDING'::"ApprovalStatus"
             ORDER BY t."createdAt" DESC
             LIMIT 6`,
            [companyId]
          ),
          queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "Technician"
             WHERE "companyId" = $1 AND "approvalStatus" = 'PENDING'::"ApprovalStatus"`,
            [companyId]
          ),
          queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "VendorReplacementRequest"
             WHERE "companyId" = $1 AND "status" = 'DISETUJUI'::"VendorReplacementStatus"`,
            [companyId]
          ),
          Promise.all([
            queryCount(`SELECT COUNT(*)::int AS count FROM "Complex" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Cluster" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Park" WHERE "companyId" = $1`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1 AND "isActive" = true`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1 AND "isActive" = false`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "Category" WHERE "companyId" = $1`, [companyId]),
          ]),
          Promise.all([
            queryCount(`SELECT COUNT(*)::int AS count FROM "User" WHERE "companyId" = $1 AND "role" = 'PENGELOLA'::"Role"`, [companyId]),
            queryCount(`SELECT COUNT(*)::int AS count FROM "User" WHERE "companyId" = $1 AND "role" = 'MANAGER'::"Role"`, [companyId]),
            query<{
              id: string;
              validUntil: Date | null;
              userName: string;
              clusterName: string;
            }>(
              `SELECT cma."id", cma."validUntil", u."name" AS "userName", cl."name" AS "clusterName"
               FROM "ClusterManagerAssignment" cma
               JOIN "Cluster" cl ON cl."id" = cma."clusterId"
               JOIN "User" u ON u."id" = cma."userId"
               WHERE cma."isTemporary" = true
                 AND cl."companyId" = $1
                 AND ${activeAssignmentSql("cma", "$2")}`,
              [companyId, now]
            ),
            queryCount(
              `SELECT COUNT(*)::int AS count
               FROM "User" u
               WHERE ${reporterInCompanySql("u", "$1")} AND u."isBlocked" = true`,
              [companyId]
            ),
            queryCount(
              `SELECT COUNT(*)::int AS count
               FROM "User" u
               WHERE ${reporterInCompanySql("u", "$1")} AND u."invalidReportCount" >= $2`,
              [companyId, REPORTER_REVIEW_THRESHOLD]
            ),
          ]),
          query<{
            id: string;
            action: AuditAction;
            entityName: string;
            summary: string;
            actorName: string;
            actorRole: Role;
            createdAt: Date;
          }>(
            `SELECT "id", "action", "entityName", "summary", "actorName", "actorRole", "createdAt"
             FROM "AuditLog"
             WHERE "companyId" = $1
             ORDER BY "createdAt" DESC
             LIMIT 5`,
            [companyId]
          ),
        ]);

        pendingTechnicians = techs.map(({ vendorName, ...t }) => ({
          ...t,
          vendor: { name: vendorName },
        }));
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
        activeTempAssignments = tempAssign.map((a) => ({
          id: a.id,
          validUntil: a.validUntil,
          user: { name: a.userName },
          cluster: { name: a.clusterName },
        }));
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
      let clustersWithStats: Array<{
        id: string;
        name: string;
        isActive: boolean;
        parks: Array<{
          id: string;
          name: string;
          isActive: boolean;
          _count: { assets: number };
        }>;
      }> = [];
      let vendorSummaries: OwnerVendorSummary[] = [];
      let recentAuditLogs: Array<{
        id: string;
        action: AuditAction;
        entityName: string;
        summary: string;
        actorName: string;
        actorRole: Role;
        createdAt: Date;
      }> = [];

      try {
        const [
          actAssetC,
          actVendorC,
          revC,
          warC,
          escCount,
          escRows,
          clusterRows,
          parkRows,
          vendors,
          audits,
        ] = await Promise.all([
          queryCount(`SELECT COUNT(*)::int AS count FROM "Asset" WHERE "companyId" = $1 AND "isActive" = true`, [companyId]),
          queryCount(`SELECT COUNT(*)::int AS count FROM "Vendor" WHERE "companyId" = $1 AND "isActive" = true`, [companyId]),
          queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "RevisionNote" rn
             JOIN "WorkOrder" wo ON wo."id" = rn."workOrderId"
             JOIN "Report" r ON r."id" = wo."reportId"
             WHERE wo."companyId" = $1 AND r."archivedAt" IS NULL`,
            [companyId]
          ),
          queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "Report"
             WHERE "companyId" = $1
               AND "archivedAt" IS NULL
               AND "underWarrantyOfVendorId" IS NOT NULL
               AND "status" NOT IN ('DIBATALKAN', 'TIDAK_VALID', 'DIGABUNG')`,
            [companyId]
          ),
          queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "VendorReplacementRequest"
             WHERE "companyId" = $1 AND "status" = 'DITERUSKAN_KE_OWNER'::"VendorReplacementStatus"`,
            [companyId]
          ),
          query<{
            id: string;
            requestNo: string;
            createdAt: Date;
            ownerViewedAt: Date | null;
            assetName: string;
            assetCode: string;
            vendorName: string;
          }>(
            `SELECT vrr."id", vrr."requestNo", vrr."createdAt", vrr."ownerViewedAt",
                    a."name" AS "assetName", a."code" AS "assetCode", v."name" AS "vendorName"
             FROM "VendorReplacementRequest" vrr
             JOIN "Asset" a ON a."id" = vrr."assetId"
             JOIN "Vendor" v ON v."id" = vrr."vendorId"
             WHERE vrr."companyId" = $1
               AND vrr."status" = 'DITERUSKAN_KE_OWNER'::"VendorReplacementStatus"
             ORDER BY vrr."createdAt" DESC
             LIMIT 3`,
            [companyId]
          ),
          query<{ id: string; name: string; isActive: boolean }>(
            `SELECT "id", "name", "isActive"
             FROM "Cluster"
             WHERE "companyId" = $1
             ORDER BY "name" ASC`,
            [companyId]
          ),
          query<{
            id: string;
            clusterId: string;
            name: string;
            isActive: boolean;
            assetCount: number;
          }>(
            `SELECT p."id", p."clusterId", p."name", p."isActive",
                    COUNT(a."id")::int AS "assetCount"
             FROM "Park" p
             LEFT JOIN "Asset" a ON a."parkId" = p."id" AND a."isActive" = true
             WHERE p."companyId" = $1
             GROUP BY p."id"`,
            [companyId]
          ),
          query<{
            id: string;
            name: string;
            type: VendorType;
            isActive: boolean;
            warrantyDays: number;
            technicianCount: number;
          }>(
            `SELECT v."id", v."name", v."type", v."isActive", v."warrantyDays",
                    COUNT(t."id")::int AS "technicianCount"
             FROM "Vendor" v
             LEFT JOIN "Technician" t ON t."vendorId" = v."id"
             WHERE v."companyId" = $1
             GROUP BY v."id"
             ORDER BY v."isActive" DESC, v."name" ASC`,
            [companyId]
          ),
          query<{
            id: string;
            action: AuditAction;
            entityName: string;
            summary: string;
            actorName: string;
            actorRole: Role;
            createdAt: Date;
          }>(
            `SELECT "id", "action", "entityName", "summary", "actorName", "actorRole", "createdAt"
             FROM "AuditLog"
             WHERE "companyId" = $1
             ORDER BY "createdAt" DESC
             LIMIT 5`,
            [companyId]
          ),
        ]);

        const parksByCluster = new Map<
          string,
          Array<{
            id: string;
            name: string;
            isActive: boolean;
            _count: { assets: number };
          }>
        >();
        for (const p of parkRows) {
          const list = parksByCluster.get(p.clusterId) ?? [];
          list.push({
            id: p.id,
            name: p.name,
            isActive: p.isActive,
            _count: { assets: p.assetCount },
          });
          parksByCluster.set(p.clusterId, list);
        }

        activeAssetCount = actAssetC;
        activeVendorCount = actVendorC;
        revisionTotalCount = revC;
        warrantyDefectsTotalCount = warC;
        escalationCount = escCount;
        recentEscalations = escRows.map((e) => ({
          id: e.id,
          requestNo: e.requestNo,
          createdAt: e.createdAt,
          ownerViewedAt: e.ownerViewedAt,
          asset: { name: e.assetName, code: e.assetCode },
          vendor: { name: e.vendorName },
        }));
        clustersWithStats = clusterRows.map((c) => ({
          ...c,
          parks: parksByCluster.get(c.id) ?? [],
        }));
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
                technicianCount: v.technicianCount,
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
                technicianCount: v.technicianCount,
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
