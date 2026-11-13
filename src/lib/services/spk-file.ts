import { queryOne } from "../db";
import type { SessionUser } from "../auth";
import { canDownloadSpkFile } from "../spk-file";
import { parsePrivateStorageRef } from "../storage-config";
import { getManagerAssignedClusterIds } from "./phase5-decision";

export interface SpkFileAccessRow {
  id: string;
  spkNo: string;
  companyId: string;
  spkFileUrl: string | null;
  spkFileName: string | null;
  spkFileMime: string | null;
  clusterId: string;
  vendorPicUserId: string | null;
  vendorActive: boolean;
  techUserId: string | null;
  techStatus: string | null;
  techApprovalStatus: string | null;
}

/** Aturan cakupan akses berkas SPK per role (murni, tanpa I/O). */
export function canAccessSpkFile(
  user: Pick<SessionUser, "id" | "role" | "companyId">,
  row: SpkFileAccessRow,
  managerClusterIds: readonly string[] = []
): boolean {
  if (!user.companyId || user.companyId !== row.companyId) return false;
  if (!canDownloadSpkFile(user.role)) return false;

  switch (user.role) {
    case "ADMIN":
    case "OWNER":
      return true;
    case "MANAGER":
      return managerClusterIds.includes(row.clusterId);
    case "PIC_VENDOR":
      return row.vendorActive && row.vendorPicUserId === user.id;
    case "TEKNISI":
      return (
        row.vendorActive &&
        row.techUserId === user.id &&
        row.techStatus === "ACTIVE" &&
        row.techApprovalStatus === "APPROVED"
      );
    default:
      return false;
  }
}

/**
 * Mengembalikan metadata berkas SPK bila pengguna berwenang dan berkasnya ada
 * di storage private; null untuk semua kasus lain (tidak membedakan
 * "tidak ada" vs "tidak berwenang" agar tidak membocorkan keberadaan SPK).
 */
export async function getAuthorizedSpkFile(
  user: SessionUser,
  workOrderId: string
): Promise<{ key: string; fileName: string; mimeType: string } | null> {
  if (!user.companyId || !canDownloadSpkFile(user.role)) return null;

  const row = await queryOne<SpkFileAccessRow>(
    `SELECT wo."id", wo."spkNo", wo."companyId",
            wo."spkFileUrl", wo."spkFileName", wo."spkFileMime",
            p."clusterId",
            v."picUserId" AS "vendorPicUserId",
            v."isActive" AS "vendorActive",
            t."userId" AS "techUserId",
            t."status" AS "techStatus",
            t."approvalStatus" AS "techApprovalStatus"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     JOIN "Asset" a ON a."id" = r."assetId"
     JOIN "Park" p ON p."id" = a."parkId"
     JOIN "Vendor" v ON v."id" = wo."vendorId"
     LEFT JOIN "Technician" t ON t."id" = wo."technicianId"
     WHERE wo."id" = $1 AND wo."companyId" = $2`,
    [workOrderId, user.companyId]
  );
  if (!row) return null;

  const managerClusterIds =
    user.role === "MANAGER" ? await getManagerAssignedClusterIds(user.id) : [];
  if (!canAccessSpkFile(user, row, managerClusterIds)) return null;

  const key = parsePrivateStorageRef(row.spkFileUrl);
  if (!key) return null;

  return {
    key,
    fileName: row.spkFileName || `${row.spkNo}.pdf`,
    mimeType: row.spkFileMime || "application/octet-stream",
  };
}
