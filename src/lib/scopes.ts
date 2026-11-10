import type { Prisma } from "@prisma/client";

/**
 * Filter penugasan Manager yang sedang berlaku saat `now`:
 * sudah dimulai (validFrom <= now), belum berakhir (validUntil null / >= now), dan tidak dibatalkan.
 */
export function activeAssignmentWhere(
  now: Date = new Date()
): Prisma.ClusterManagerAssignmentWhereInput {
  return {
    validFrom: { lte: now },
    cancelledAt: null,
    OR: [{ validUntil: null }, { validUntil: { gte: now } }],
  };
}

/**
 * Filter pelapor (role PENGGUNA) dalam cakupan perusahaan.
 * companyId pelapor bisa null (daftar mandiri), jadi pelapor juga dianggap
 * dalam cakupan bila pernah membuat laporan di perusahaan tersebut.
 */
export function reporterInCompanyWhere(
  companyId: string
): Prisma.UserWhereInput {
  return {
    role: "PENGGUNA",
    OR: [{ companyId }, { reports: { some: { companyId } } }],
  };
}

/**
 * Filter aset yang boleh dilaporkan: aset, taman, cluster, komplek, dan kategori semuanya aktif.
 */
export function reportableAssetWhere(): Prisma.AssetWhereInput {
  return {
    isActive: true,
    category: { isActive: true },
    park: {
      isActive: true,
      cluster: {
        isActive: true,
        complex: { isActive: true },
      },
    },
  };
}

type ReportableAssetShape = {
  isActive: boolean;
  category?: { isActive: boolean } | null;
  park?: {
    isActive: boolean;
    cluster?: {
      isActive: boolean;
      complex?: { isActive: boolean } | null;
    } | null;
  } | null;
};

/**
 * Versi in-memory dari reportableAssetWhere. Relasi yang tidak dimuat dianggap aktif.
 */
export function isAssetReportable(asset: ReportableAssetShape): boolean {
  if (!asset.isActive) return false;
  if (asset.category && !asset.category.isActive) return false;
  const park = asset.park;
  if (park) {
    if (!park.isActive) return false;
    const cluster = park.cluster;
    if (cluster) {
      if (!cluster.isActive) return false;
      if (cluster.complex && !cluster.complex.isActive) return false;
    }
  }
  return true;
}

/**
 * Alasan aset tidak bisa dilaporkan (untuk pesan ke pengguna), atau null bila bisa.
 */
export function assetUnreportableReason(
  asset: ReportableAssetShape
): string | null {
  if (!asset.isActive) return "Aset ini sedang tidak aktif.";
  if (asset.category && !asset.category.isActive)
    return "Kategori aset ini sedang tidak aktif.";
  if (asset.park && !asset.park.isActive) return "Taman lokasi aset ini sedang tidak aktif.";
  if (asset.park?.cluster && !asset.park.cluster.isActive)
    return "Cluster lokasi aset ini sedang tidak aktif.";
  if (asset.park?.cluster?.complex && !asset.park.cluster.complex.isActive)
    return "Komplek lokasi aset ini sedang tidak aktif.";
  return null;
}
