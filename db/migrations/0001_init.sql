-- Skema Awal GreenPark (1:1 dari struktur domain PostgreSQL)

-- 1. Enums
CREATE TYPE "Role" AS ENUM (
  'PENGGUNA',
  'PENGELOLA',
  'MANAGER',
  'PIC_VENDOR',
  'TEKNISI',
  'ADMIN',
  'OWNER'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'BARU',
  'DIBATALKAN',
  'DIGABUNG',
  'TIDAK_VALID',
  'MENUNGGU_KEPUTUSAN',
  'DITOLAK',
  'DISETUJUI',
  'DIKERJAKAN',
  'MENUNGGU_KONFIRMASI',
  'SELESAI'
);

CREATE TYPE "Priority" AS ENUM (
  'TINGGI',
  'NORMAL',
  'RENDAH'
);

CREATE TYPE "Channel" AS ENUM (
  'QR',
  'DASHBOARD'
);

CREATE TYPE "VendorType" AS ENUM (
  'INTERNAL',
  'EXTERNAL'
);

CREATE TYPE "TechnicianStatus" AS ENUM (
  'ACTIVE',
  'ON_LEAVE',
  'INACTIVE'
);

CREATE TYPE "ApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "WorkPhotoType" AS ENUM (
  'BEFORE',
  'AFTER'
);

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'ARCHIVE',
  'BLOCK',
  'UNBLOCK'
);

CREATE TYPE "VendorReplacementStatus" AS ENUM (
  'DIAJUKAN',
  'DITOLAK',
  'DISETUJUI',
  'DITERUSKAN_KE_OWNER'
);

-- 2. Trigger helper untuk kolom updatedAt
CREATE OR REPLACE FUNCTION greenpark_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Tabel Entitas

CREATE TABLE "Company" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Company_code_key" UNIQUE ("code")
);

CREATE TABLE "Complex" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Complex_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Complex_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Complex_companyId_idx" ON "Complex"("companyId");

CREATE TABLE "Cluster" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "complexId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cluster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Cluster_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Cluster_companyId_idx" ON "Cluster"("companyId");
CREATE INDEX "Cluster_complexId_idx" ON "Cluster"("complexId");

CREATE TABLE "Park" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationNote" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Park_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Park_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Park_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Park_companyId_idx" ON "Park"("companyId");
CREATE INDEX "Park_clusterId_idx" ON "Park"("clusterId");

CREATE TABLE "Category" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "damageTypes" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Category_companyId_idx" ON "Category"("companyId");

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "parkId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationNote" TEXT,
  "photoUrl" TEXT,
  "installedAt" TIMESTAMPTZ,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Asset_code_key" UNIQUE ("code"),
  CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Asset_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");
CREATE INDEX "Asset_parkId_idx" ON "Asset"("parkId");
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

CREATE TABLE "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "role" "Role" NOT NULL DEFAULT 'PENGGUNA',
  "loginMethod" TEXT NOT NULL DEFAULT 'EMAIL',
  "reporterStatus" TEXT,
  "blockHouseNo" TEXT,
  "dataConsentAt" TIMESTAMPTZ,
  "validReportCount" INTEGER NOT NULL DEFAULT 0,
  "invalidReportCount" INTEGER NOT NULL DEFAULT 0,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "blockedReason" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "staffClusterId" TEXT,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email"),
  CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "User_staffClusterId_fkey" FOREIGN KEY ("staffClusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_role_idx" ON "User"("role");

CREATE TABLE "ClusterManagerAssignment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "isTemporary" BOOLEAN NOT NULL DEFAULT false,
  "replacedManagerId" TEXT,
  "validFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "validUntil" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "cancelledById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ClusterManagerAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClusterManagerAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClusterManagerAssignment_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClusterManagerAssignment_userId_clusterId_idx" ON "ClusterManagerAssignment"("userId", "clusterId");
CREATE INDEX "ClusterManagerAssignment_clusterId_idx" ON "ClusterManagerAssignment"("clusterId");

CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "VendorType" NOT NULL DEFAULT 'EXTERNAL',
  "skills" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "picUserId" TEXT,
  "cooperationScheme" TEXT,
  "contractStart" TIMESTAMPTZ,
  "contractEnd" TIMESTAMPTZ,
  "warrantyDays" INTEGER NOT NULL DEFAULT 30,
  "address" TEXT,
  "npwp" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastTechnicianConfirmedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vendor_picUserId_key" UNIQUE ("picUserId"),
  CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Vendor_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");

CREATE TABLE "VendorServiceArea" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vendorId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  CONSTRAINT "VendorServiceArea_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorServiceArea_vendorId_clusterId_key" UNIQUE ("vendorId", "clusterId"),
  CONSTRAINT "VendorServiceArea_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorServiceArea_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VendorServiceArea_clusterId_idx" ON "VendorServiceArea"("clusterId");

CREATE TABLE "Technician" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "facePhotoUrl" TEXT,
  "skills" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "status" "TechnicianStatus" NOT NULL DEFAULT 'ACTIVE',
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "rejectionReason" TEXT,
  "deactivationReason" TEXT,
  "reactivationRequested" BOOLEAN NOT NULL DEFAULT false,
  "reactivationNote" TEXT,
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Technician_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Technician_userId_key" UNIQUE ("userId"),
  CONSTRAINT "Technician_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Technician_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Technician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Technician_companyId_idx" ON "Technician"("companyId");
CREATE INDEX "Technician_vendorId_idx" ON "Technician"("vendorId");
CREATE INDEX "Technician_companyId_approvalStatus_idx" ON "Technician"("companyId", "approvalStatus");

CREATE TABLE "Report" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "ticketNo" TEXT NOT NULL,
  "statusToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assetId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "channel" "Channel" NOT NULL DEFAULT 'QR',
  "description" TEXT NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'BARU',
  "priority" "Priority",
  "reason" TEXT,
  "parentReportId" TEXT,
  "underWarrantyOfVendorId" TEXT,
  "archivedAt" TIMESTAMPTZ,
  "stageEnteredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Report_ticketNo_key" UNIQUE ("ticketNo"),
  CONSTRAINT "Report_statusToken_key" UNIQUE ("statusToken"),
  CONSTRAINT "Report_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Report_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Report_parentReportId_fkey" FOREIGN KEY ("parentReportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Report_underWarrantyOfVendorId_fkey" FOREIGN KEY ("underWarrantyOfVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Report_companyId_archivedAt_idx" ON "Report"("companyId", "archivedAt");
CREATE INDEX "Report_companyId_status_archivedAt_idx" ON "Report"("companyId", "status", "archivedAt");
CREATE INDEX "Report_assetId_idx" ON "Report"("assetId");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_parentReportId_idx" ON "Report"("parentReportId");
CREATE INDEX "Report_underWarrantyOfVendorId_idx" ON "Report"("underWarrantyOfVendorId");

CREATE TABLE "ReportPhoto" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reportId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ReportPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReportPhoto_reportId_idx" ON "ReportPhoto"("reportId");

CREATE TABLE "ReportStatusLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reportId" TEXT NOT NULL,
  "fromStatus" "ReportStatus",
  "toStatus" "ReportStatus" NOT NULL,
  "changedById" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ReportStatusLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportStatusLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportStatusLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReportStatusLog_reportId_idx" ON "ReportStatusLog"("reportId");

CREATE TABLE "WorkOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "spkNo" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "technicianId" TEXT,
  "spkFileUrl" TEXT,
  "spkFileName" TEXT,
  "spkFileSize" INTEGER,
  "spkFileMime" TEXT,
  "spkFileUploadedAt" TIMESTAMPTZ,
  "spkFileUploadedById" TEXT,
  "assignedAt" TIMESTAMPTZ,
  "submittedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "confirmedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkOrder_reportId_key" UNIQUE ("reportId"),
  CONSTRAINT "WorkOrder_companyId_spkNo_key" UNIQUE ("companyId", "spkNo"),
  CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkOrder_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WorkOrder_companyId_idx" ON "WorkOrder"("companyId");
CREATE INDEX "WorkOrder_vendorId_idx" ON "WorkOrder"("vendorId");
CREATE INDEX "WorkOrder_technicianId_idx" ON "WorkOrder"("technicianId");

CREATE TABLE "WorkPhoto" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workOrderId" TEXT NOT NULL,
  "type" "WorkPhotoType" NOT NULL,
  "url" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WorkPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkPhoto_workOrderId_idx" ON "WorkPhoto"("workOrderId");

CREATE TABLE "RevisionNote" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workOrderId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "RevisionNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RevisionNote_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RevisionNote_workOrderId_idx" ON "RevisionNote"("workOrderId");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "entityName" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "summary" TEXT NOT NULL,
  "oldValues" JSONB,
  "newValues" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_entityName_entityId_idx" ON "AuditLog"("entityName", "entityId");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT,
  "recipientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "linkUrl" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

CREATE TABLE "EmailLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "ticketNo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EmailLog_companyId_createdAt_idx" ON "EmailLog"("companyId", "createdAt");
CREATE INDEX "EmailLog_status_nextAttemptAt_idx" ON "EmailLog"("status", "nextAttemptAt");

CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

CREATE TABLE "SequenceCounter" (
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("scope", "key")
);

CREATE TABLE "VendorReplacementRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "requestNo" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "basisReportIds" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "reason" TEXT NOT NULL,
  "status" "VendorReplacementStatus" NOT NULL DEFAULT 'DIAJUKAN',
  "submittedById" TEXT NOT NULL,
  "managerDecisionNote" TEXT,
  "managerDecidedById" TEXT,
  "managerDecidedAt" TIMESTAMPTZ,
  "adminForwardedById" TEXT,
  "adminForwardedAt" TIMESTAMPTZ,
  "adminForwardedNote" TEXT,
  "ownerViewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "VendorReplacementRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorReplacementRequest_companyId_requestNo_key" UNIQUE ("companyId", "requestNo"),
  CONSTRAINT "VendorReplacementRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_managerDecidedById_fkey" FOREIGN KEY ("managerDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "VendorReplacementRequest_adminForwardedById_fkey" FOREIGN KEY ("adminForwardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "VendorReplacementRequest_companyId_idx" ON "VendorReplacementRequest"("companyId");
CREATE INDEX "VendorReplacementRequest_clusterId_idx" ON "VendorReplacementRequest"("clusterId");
CREATE INDEX "VendorReplacementRequest_assetId_idx" ON "VendorReplacementRequest"("assetId");
CREATE INDEX "VendorReplacementRequest_status_idx" ON "VendorReplacementRequest"("status");

-- 4. Pasang trigger updatedAt otomatis pada 13 tabel yang memilikinya
CREATE TRIGGER "trg_Company_updated_at" BEFORE UPDATE ON "Company" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Complex_updated_at" BEFORE UPDATE ON "Complex" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Cluster_updated_at" BEFORE UPDATE ON "Cluster" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Park_updated_at" BEFORE UPDATE ON "Park" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Category_updated_at" BEFORE UPDATE ON "Category" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Asset_updated_at" BEFORE UPDATE ON "Asset" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_User_updated_at" BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Vendor_updated_at" BEFORE UPDATE ON "Vendor" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Technician_updated_at" BEFORE UPDATE ON "Technician" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_Report_updated_at" BEFORE UPDATE ON "Report" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_WorkOrder_updated_at" BEFORE UPDATE ON "WorkOrder" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_SequenceCounter_updated_at" BEFORE UPDATE ON "SequenceCounter" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
CREATE TRIGGER "trg_VendorReplacementRequest_updated_at" BEFORE UPDATE ON "VendorReplacementRequest" FOR EACH ROW EXECUTE FUNCTION greenpark_set_updated_at();
