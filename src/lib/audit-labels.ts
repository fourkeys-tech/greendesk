import type { AuditAction } from "./db-types";
import { STATUS_METADATA } from "./permissions";
import { APPROVAL_STATUS_META, DEACTIVATION_REASON_LABEL, TECHNICIAN_STATUS_META } from "./vendor-labels";
import { formatWibDateTime } from "./dates";

/** Label & warna tampilan riwayat perubahan data (AuditLog). */

export const AUDIT_ACTIONS: AuditAction[] = ["CREATE", "UPDATE", "ARCHIVE", "BLOCK", "UNBLOCK"];

export const AUDIT_ACTION_META: Record<AuditAction, { label: string; badgeColor: string }> = {
  CREATE: { label: "Dibuat", badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  UPDATE: { label: "Diubah", badgeColor: "bg-sky-50 text-sky-800 border-sky-200" },
  ARCHIVE: { label: "Diarsipkan", badgeColor: "bg-slate-100 text-slate-700 border-slate-300" },
  BLOCK: { label: "Diblokir", badgeColor: "bg-rose-50 text-rose-700 border-rose-200" },
  UNBLOCK: { label: "Buka blokir", badgeColor: "bg-amber-50 text-amber-900 border-amber-300" },
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  Complex: "Komplek",
  Cluster: "Cluster",
  Park: "Taman",
  Category: "Kategori",
  Asset: "Aset",
  User: "Akun",
  Vendor: "Vendor",
  Technician: "Teknisi",
  Report: "Laporan",
  WorkOrder: "SPK",
  VendorReplacementRequest: "Pengajuan Ganti Vendor",
  ClusterManagerAssignment: "Delegasi Manager",
};

export function auditEntityLabel(entityName: string) {
  return AUDIT_ENTITY_LABEL[entityName] ?? entityName;
}

const FIELD_LABEL: Record<string, string> = {
  name: "Nama",
  fullName: "Nama lengkap",
  email: "Email",
  whatsapp: "WhatsApp",
  role: "Role",
  code: "Kode",
  address: "Alamat",
  locationNote: "Catatan lokasi",
  isActive: "Status aktif",
  isBlocked: "Status blokir",
  blockedReason: "Alasan blokir",
  status: "Status",
  reportStatus: "Status laporan",
  approvalStatus: "Status persetujuan",
  deactivationReason: "Penyebab nonaktif",
  reactivationRequested: "Pengajuan aktif kembali",
  reactivationNote: "Catatan aktif kembali",
  rejectionNote: "Alasan penolakan",
  reason: "Alasan",
  archivedAt: "Diarsipkan pada",
  type: "Jenis",
  skills: "Keahlian",
  cooperationScheme: "Skema kerja sama",
  contractStart: "Kontrak mulai",
  contractEnd: "Kontrak berakhir",
  warrantyDays: "Garansi (hari)",
  npwp: "NPWP",
  serviceClusters: "Area layanan",
  clusters: "Cluster",
  cluster: "Cluster",
  clusterName: "Cluster",
  complexName: "Komplek",
  parkName: "Taman",
  assetName: "Aset",
  categoryName: "Kategori",
  damageTypes: "Jenis kerusakan",
  validFrom: "Berlaku mulai",
  validUntil: "Berlaku sampai",
  cancelledAt: "Dibatalkan pada",
  substituteManager: "Manager pengganti",
  replacedManager: "Manager yang digantikan",
  technicianName: "Teknisi",
  vendorName: "Vendor",
  picEmail: "Email PIC",
  photoUrl: "Foto",
  lastTechnicianConfirmedAt: "Konfirmasi daftar teknisi",
  managerDecisionNote: "Catatan Manager",
  adminForwardedNote: "Catatan Admin",
  approvedBy: "Disetujui oleh",
};

/** Kolom ID internal tidak ditampilkan karena tidak bermakna bagi pengguna. */
const HIDDEN_FIELDS = new Set(["technicianId", "vendorId", "reportId", "complexId", "categoryId", "actor", "input"]);

export function auditFieldLabel(field: string) {
  return FIELD_LABEL[field] ?? field;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") {
    if (field === "isActive") return value ? "Aktif" : "Nonaktif";
    if (field === "isBlocked") return value ? "Diblokir" : "Tidak diblokir";
    return value ? "Ya" : "Tidak";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "-" : value.map((v) => formatAuditValue(field, v)).join(", ");
  }
  if (typeof value === "string") {
    if ((field === "status" || field === "reportStatus") && value in STATUS_METADATA) {
      return STATUS_METADATA[value as keyof typeof STATUS_METADATA].label;
    }
    if (field === "status" && value in TECHNICIAN_STATUS_META) {
      return TECHNICIAN_STATUS_META[value as keyof typeof TECHNICIAN_STATUS_META].label;
    }
    if (field === "approvalStatus" && value in APPROVAL_STATUS_META) {
      return APPROVAL_STATUS_META[value as keyof typeof APPROVAL_STATUS_META].label;
    }
    if (field === "deactivationReason" && value in DEACTIVATION_REASON_LABEL) {
      return DEACTIVATION_REASON_LABEL[value];
    }
    if (ISO_DATE_RE.test(value)) return formatWibDateTime(value);
    return value;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${auditFieldLabel(k)}: ${formatAuditValue(k, v)}`)
      .join("; ");
  }
  return String(value);
}

export interface AuditDiffRow {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Susun baris "field: lama → baru" dari kolom oldValues/newValues. */
export function buildAuditDiff(oldValues: unknown, newValues: unknown): AuditDiffRow[] {
  const oldRec = asRecord(oldValues);
  const newRec = asRecord(newValues);
  const hasOld = Object.keys(oldRec).length > 0;
  const fields = Array.from(new Set([...Object.keys(oldRec), ...Object.keys(newRec)])).filter(
    (f) => !HIDDEN_FIELDS.has(f)
  );

  return fields.map((field) => {
    const inOld = field in oldRec;
    const inNew = field in newRec;
    const oldValue = hasOld && inOld ? formatAuditValue(field, oldRec[field]) : null;
    const newValue = inNew ? formatAuditValue(field, newRec[field]) : null;
    return {
      field,
      label: auditFieldLabel(field),
      oldValue,
      newValue,
      changed: oldValue !== newValue,
    };
  });
}
