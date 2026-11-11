import type { ApprovalStatus, TechnicianStatus, VendorType } from "./db-types";

/** Label & warna tampilan untuk data vendor dan teknisi (dipakai server & client). */

export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
  INTERNAL: "Internal",
  EXTERNAL: "Eksternal",
};

export const TECHNICIAN_STATUS_META: Record<
  TechnicianStatus,
  { label: string; badgeColor: string }
> = {
  ACTIVE: { label: "Aktif", badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  ON_LEAVE: { label: "Cuti", badgeColor: "bg-sky-50 text-sky-800 border-sky-200" },
  INACTIVE: { label: "Nonaktif", badgeColor: "bg-slate-100 text-slate-600 border-slate-300" },
};

export const APPROVAL_STATUS_META: Record<
  ApprovalStatus,
  { label: string; badgeColor: string }
> = {
  PENDING: { label: "Menunggu persetujuan", badgeColor: "bg-amber-50 text-amber-900 border-amber-300" },
  APPROVED: { label: "Disetujui", badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  REJECTED: { label: "Ditolak", badgeColor: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const DEACTIVATION_REASON_LABEL: Record<string, string> = {
  AUTO_60_DAYS: "Nonaktif otomatis (tidak ada aktivitas 60 hari)",
  MANUAL_BY_PIC: "Dinonaktifkan PIC Vendor",
  MANUAL_BY_ADMIN: "Dinonaktifkan Admin",
};
