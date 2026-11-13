import type { Role } from "./db-types";

/**
 * Role yang boleh mengunduh berkas SPK (dokumen private).
 * Cakupan per-role (cluster/vendor/penugasan) tetap diperiksa di server
 * oleh `getAuthorizedSpkFile` sebelum presigned URL diterbitkan.
 */
export const SPK_FILE_ROLES: readonly Role[] = [
  "MANAGER",
  "PIC_VENDOR",
  "TEKNISI",
  "ADMIN",
  "OWNER",
];

export function canDownloadSpkFile(role: Role): boolean {
  return SPK_FILE_ROLES.includes(role);
}

/** Tautan unduh berkas SPK lewat route berotorisasi (bukan URL storage langsung). */
export function spkFileHref(workOrderId: string): string {
  return `/api/spk/${encodeURIComponent(workOrderId)}/file`;
}
