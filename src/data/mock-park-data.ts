/**
 * Data mock untuk halaman report/new (submit ticket via QR scan).
 * Digunakan hanya di sisi client; tidak terhubung ke database.
 */

export interface MockAsset {
  id: string;
  code: string;
  name: string;
  parkName: string;
  locationNote: string;
  photoUrl: string | null;
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const mockAssets: MockAsset[] = [
  {
    id: "ast-bgv-001",
    code: "AST-BGV-001",
    name: "Kursi Taman Besi",
    parkName: "Taman Bunga Vanda",
    locationNote: "Dekat Kolam Utama",
    photoUrl: null,
  },
  {
    id: "ast-bgv-002",
    code: "AST-BGV-002",
    name: "Lampu Taman LED",
    parkName: "Taman Bunga Vanda",
    locationNote: "Jalur Pedestrian Utara",
    photoUrl: null,
  },
  {
    id: "ast-mrd-001",
    code: "AST-MRD-001",
    name: "Ayunan Anak",
    parkName: "Taman Mawar Merah",
    locationNote: "Area Bermain Anak",
    photoUrl: null,
  },
  {
    id: "ast-mrd-002",
    code: "AST-MRD-002",
    name: "Papan Seluncur",
    parkName: "Taman Mawar Merah",
    locationNote: "Area Bermain Anak",
    photoUrl: null,
  },
  {
    id: "ast-hij-001",
    code: "AST-HIJ-001",
    name: "Bangku Taman Kayu",
    parkName: "Taman Hijau Asri",
    locationNote: "Sudut Barat Daya",
    photoUrl: null,
  },
];

export const mockCurrentUser: MockUser = {
  id: "usr-mock-001",
  name: "Warga GreenDesk",
  email: "warga@greendesk.id",
  phone: "0812-9876-5432",
};
