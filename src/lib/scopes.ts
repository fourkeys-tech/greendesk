/**
 * Helper filter SQL berparameter untuk penugasan Manager yang sedang berlaku saat `now`:
 * sudah dimulai (validFrom <= now), belum berakhir (validUntil null / >= now), dan tidak dibatalkan.
 */
export function activeAssignmentSql(alias: string, nowParam: string): string {
  return `(${alias}."validFrom" <= ${nowParam} AND ${alias}."cancelledAt" IS NULL AND (${alias}."validUntil" IS NULL OR ${alias}."validUntil" >= ${nowParam}))`;
}

/**
 * Helper filter SQL pelapor (role PENGGUNA) dalam cakupan perusahaan.
 * companyId pelapor bisa null (daftar mandiri), jadi pelapor juga dianggap
 * dalam cakupan bila pernah membuat laporan non-arsip di perusahaan tersebut.
 */
export function reporterInCompanySql(
  userAlias: string,
  companyParam: string
): string {
  return `(${userAlias}."role" = 'PENGGUNA'::"Role" AND (${userAlias}."companyId" = ${companyParam} OR EXISTS (SELECT 1 FROM "Report" _r WHERE _r."reporterId" = ${userAlias}."id" AND _r."companyId" = ${companyParam} AND _r."archivedAt" IS NULL)))`;
}

/**
 * Helper filter SQL aset yang boleh dilaporkan: aset, kategori, taman, cluster, dan komplek semuanya aktif.
 */
export function reportableAssetSql(
  assetAlias: string,
  categoryAlias: string,
  parkAlias: string,
  clusterAlias: string,
  complexAlias: string
): string {
  return `(${assetAlias}."isActive" = true AND ${categoryAlias}."isActive" = true AND ${parkAlias}."isActive" = true AND ${clusterAlias}."isActive" = true AND ${complexAlias}."isActive" = true)`;
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
