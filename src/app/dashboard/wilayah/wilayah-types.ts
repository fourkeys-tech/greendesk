/** Bentuk data ringkas hierarki wilayah yang dikirim dari server ke komponen client. */

export type HierarchyAsset = {
  id: string;
  code: string;
  name: string;
  locationNote: string | null;
  photoUrl: string | null;
  installedAt: string | null;
  isActive: boolean;
  category: { id: string; name: string; isActive: boolean };
  qrDataUrl: string | null;
  recentWork: { id: string; vendorName: string; spkNo: string }[];
};

export type HierarchyPark = {
  id: string;
  name: string;
  locationNote: string | null;
  isActive: boolean;
  assets: HierarchyAsset[];
};

export type HierarchyCluster = {
  id: string;
  name: string;
  isActive: boolean;
  pengelolaNames: string[];
  managerNames: { name: string; isTemporary: boolean }[];
  parks: HierarchyPark[];
};

export type HierarchyComplex = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  clusters: HierarchyCluster[];
};
