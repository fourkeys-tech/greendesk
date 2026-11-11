/**
 * Tipe domain & DTO murni tanpa dependensi database agar aman diimpor
 * oleh Client Components, Server Actions, dan layanan domain.
 */

export const Role = {
  PENGGUNA: "PENGGUNA",
  PENGELOLA: "PENGELOLA",
  MANAGER: "MANAGER",
  PIC_VENDOR: "PIC_VENDOR",
  TEKNISI: "TEKNISI",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ReportStatus = {
  BARU: "BARU",
  DIBATALKAN: "DIBATALKAN",
  DIGABUNG: "DIGABUNG",
  TIDAK_VALID: "TIDAK_VALID",
  MENUNGGU_KEPUTUSAN: "MENUNGGU_KEPUTUSAN",
  DITOLAK: "DITOLAK",
  DISETUJUI: "DISETUJUI",
  DIKERJAKAN: "DIKERJAKAN",
  MENUNGGU_KONFIRMASI: "MENUNGGU_KONFIRMASI",
  SELESAI: "SELESAI",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const Priority = {
  TINGGI: "TINGGI",
  NORMAL: "NORMAL",
  RENDAH: "RENDAH",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const Channel = {
  QR: "QR",
  DASHBOARD: "DASHBOARD",
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const VendorType = {
  INTERNAL: "INTERNAL",
  EXTERNAL: "EXTERNAL",
} as const;
export type VendorType = (typeof VendorType)[keyof typeof VendorType];

export const TechnicianStatus = {
  ACTIVE: "ACTIVE",
  ON_LEAVE: "ON_LEAVE",
  INACTIVE: "INACTIVE",
} as const;
export type TechnicianStatus =
  (typeof TechnicianStatus)[keyof typeof TechnicianStatus];

export const ApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ApprovalStatus =
  (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const WorkPhotoType = {
  BEFORE: "BEFORE",
  AFTER: "AFTER",
} as const;
export type WorkPhotoType =
  (typeof WorkPhotoType)[keyof typeof WorkPhotoType];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  ARCHIVE: "ARCHIVE",
  BLOCK: "BLOCK",
  UNBLOCK: "UNBLOCK",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const VendorReplacementStatus = {
  DIAJUKAN: "DIAJUKAN",
  DITOLAK: "DITOLAK",
  DISETUJUI: "DISETUJUI",
  DITERUSKAN_KE_OWNER: "DITERUSKAN_KE_OWNER",
} as const;
export type VendorReplacementStatus =
  (typeof VendorReplacementStatus)[keyof typeof VendorReplacementStatus];

export interface CompanyRow {
  id: string;
  code: string;
  name: string;
  contact: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplexRow {
  id: string;
  companyId: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterRow {
  id: string;
  companyId: string;
  complexId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParkRow {
  id: string;
  companyId: string;
  clusterId: string;
  name: string;
  locationNote: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRow {
  id: string;
  companyId: string;
  name: string;
  damageTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetRow {
  id: string;
  companyId: string;
  code: string;
  parkId: string;
  categoryId: string;
  name: string;
  locationNote: string | null;
  photoUrl: string | null;
  installedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  passwordHash: string | null;
  role: Role;
  loginMethod: string;
  reporterStatus: string | null;
  blockHouseNo: string | null;
  dataConsentAt: Date | null;
  validReportCount: number;
  invalidReportCount: number;
  isBlocked: boolean;
  blockedReason: string | null;
  isActive: boolean;
  staffClusterId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterManagerAssignmentRow {
  id: string;
  userId: string;
  clusterId: string;
  isTemporary: boolean;
  replacedManagerId: string | null;
  validFrom: Date;
  validUntil: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  createdAt: Date;
}

export interface VendorRow {
  id: string;
  companyId: string;
  name: string;
  type: VendorType;
  skills: string[];
  picUserId: string | null;
  cooperationScheme: string | null;
  contractStart: Date | null;
  contractEnd: Date | null;
  warrantyDays: number;
  address: string | null;
  npwp: string | null;
  isActive: boolean;
  lastTechnicianConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorServiceAreaRow {
  id: string;
  vendorId: string;
  clusterId: string;
}

export interface TechnicianRow {
  id: string;
  companyId: string;
  vendorId: string;
  userId: string;
  fullName: string;
  whatsapp: string;
  email: string;
  facePhotoUrl: string | null;
  skills: string[];
  status: TechnicianStatus;
  approvalStatus: ApprovalStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  deactivationReason: string | null;
  reactivationRequested: boolean;
  reactivationNote: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportRow {
  id: string;
  companyId: string;
  ticketNo: string;
  statusToken: string;
  assetId: string;
  reporterId: string;
  channel: Channel;
  description: string;
  status: ReportStatus;
  priority: Priority | null;
  reason: string | null;
  parentReportId: string | null;
  underWarrantyOfVendorId: string | null;
  archivedAt: Date | null;
  stageEnteredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportPhotoRow {
  id: string;
  reportId: string;
  url: string;
  createdAt: Date;
}

export interface ReportStatusLogRow {
  id: string;
  reportId: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  changedById: string;
  note: string | null;
  createdAt: Date;
}

export interface WorkOrderRow {
  id: string;
  companyId: string;
  spkNo: string;
  reportId: string;
  vendorId: string;
  technicianId: string | null;
  spkFileUrl: string | null;
  spkFileName: string | null;
  spkFileSize: number | null;
  spkFileMime: string | null;
  spkFileUploadedAt: Date | null;
  spkFileUploadedById: string | null;
  assignedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkPhotoRow {
  id: string;
  workOrderId: string;
  type: WorkPhotoType;
  url: string;
  uploadedById: string;
  createdAt: Date;
}

export interface RevisionNoteRow {
  id: string;
  workOrderId: string;
  note: string;
  createdById: string;
  createdAt: Date;
}

export interface AuditLogRow {
  id: string;
  companyId: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: Role;
  entityName: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: Date;
}

export interface NotificationRow {
  id: string;
  companyId: string | null;
  recipientId: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface EmailLogRow {
  id: string;
  companyId: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  triggerType: string;
  ticketNo: string | null;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  nextAttemptAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface OtpCodeRow {
  id: string;
  email: string;
  code: string;
  attempts: number;
  payload: unknown;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface SequenceCounterRow {
  scope: string;
  key: string;
  value: number;
  updatedAt: Date;
}

export interface VendorReplacementRequestRow {
  id: string;
  companyId: string;
  requestNo: string;
  clusterId: string;
  assetId: string;
  vendorId: string;
  basisReportIds: string[];
  reason: string;
  status: VendorReplacementStatus;
  submittedById: string;
  managerDecisionNote: string | null;
  managerDecidedById: string | null;
  managerDecidedAt: Date | null;
  adminForwardedById: string | null;
  adminForwardedAt: Date | null;
  adminForwardedNote: string | null;
  ownerViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
