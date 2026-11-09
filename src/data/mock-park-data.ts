import { User, Asset, Report, StatusHistoryLog } from "@/types/park-asset";

export const mockCurrentUser: User = {
  id: "usr-01",
  name: "Budi Santoso",
  email: "pelapor@gmail.com",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  isBlocked: false,
};

export const mockAssets: Asset[] = [
  {
    id: "ast-01",
    code: "TK-0824-91",
    name: "Kursi Taman",
    parkName: "Taman Eden",
    locationNote: "Zona A - Dekat Kolam Ikan",
    photoUrl: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600",
    isActive: true,
  },
  {
    id: "ast-02",
    code: "LP-0412-10",
    name: "Lampu Taman Tiang",
    parkName: "Taman Eden",
    locationNote: "Zona B - Area Jogging Track",
    photoUrl: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600",
    isActive: true,
  },
  {
    id: "ast-03",
    code: "AY-0921-44",
    name: "Ayunan Anak",
    parkName: "Taman Eden",
    locationNote: "Zona C - Taman Bermain Anak",
    photoUrl: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600",
    isActive: true,
  },
  {
    id: "ast-04",
    code: "BS-1102-12",
    name: "Tempat Sampah Organik",
    parkName: "Taman Eden",
    locationNote: "Pintu Masuk Barat",
    photoUrl: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600",
    isActive: true,
  },
];

export const mockReports: Report[] = [
  {
    id: "rep-1",
    ticketNo: "TK-0824-91",
    asset: mockAssets[0],
    reporter: mockCurrentUser,
    channel: "QR",
    description: "Kayu sandaran kursi patah dan paku terlihat mencuat sehingga membahayakan pengunjung taman.",
    status: "MENUNGGU_KEPUTUSAN",
    priority: "TINGGI",
    createdAt: "2 Jam lalu",
    photos: [
      "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600",
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600",
    ],
  },
  {
    id: "rep-2",
    ticketNo: "LP-0412-10",
    asset: mockAssets[1],
    reporter: mockCurrentUser,
    channel: "QR",
    description: "Lampu tiang mati total saat malam hari, area jogging track menjadi sangat gelap.",
    status: "DIKERJAKAN",
    priority: "NORMAL",
    createdAt: "Kemarin",
    photos: [
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600",
    ],
  },
  {
    id: "rep-3",
    ticketNo: "AY-0921-44",
    asset: mockAssets[2],
    reporter: mockCurrentUser,
    channel: "DASHBOARD",
    description: "Rantai ayunan sebelah kanan putus dan perlu diganti rantai galvanis baru.",
    status: "SELESAI",
    priority: "TINGGI",
    createdAt: "3 Hari lalu",
    photos: [
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600",
    ],
  },
  {
    id: "rep-4",
    ticketNo: "BS-1102-12",
    asset: mockAssets[3],
    reporter: mockCurrentUser,
    channel: "QR",
    description: "Tutup tempat sampah rusak dan terlepas dari engsel penutup.",
    status: "BARU",
    priority: "RENDAH",
    createdAt: "4 Hari lalu",
    photos: [
      "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600",
    ],
  },
  {
    id: "rep-5",
    ticketNo: "TK-0824-88",
    asset: {
      ...mockAssets[0],
      code: "TK-0824-88",
      name: "Bangku Gazebo Timur",
    },
    reporter: mockCurrentUser,
    channel: "QR",
    description: "Cat bangku mengelupas akibat terpapar hujan dan panas.",
    status: "SELESAI",
    priority: "RENDAH",
    createdAt: "1 Minggu lalu",
    photos: [
      "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600",
    ],
  },
];

export const mockActiveReport: Report = mockReports[0];

export const mockStatusLogs: StatusHistoryLog[] = [
  {
    id: "log-1",
    status: "BARU",
    statusLabel: "Laporan Diterima",
    timestamp: "1 Nov 2026, 09:30",
    note: "Laporan otomatis dibuat dari pemindaian QR Code di lokasi fasilitas.",
    actor: "Sistem QR",
  },
  {
    id: "log-2",
    status: "MENUNGGU_KEPUTUSAN",
    statusLabel: "Verifikasi Pengelola",
    timestamp: "1 Nov 2026, 10:15",
    note: "Menunggu penugasan teknisi dan persetujuan estimasi perbaikan oleh koordinator.",
    actor: "Admin Pengelola",
  },
  {
    id: "log-3",
    status: "DIKERJAKAN",
    statusLabel: "Teknisi Ditugaskan",
    timestamp: "1 Nov 2026, 11:00",
    note: "Teknisi lapangan menuju lokasi untuk penggantian papan kayu.",
    actor: "Teknisi Joko",
  },
  {
    id: "log-4",
    status: "SELESAI",
    statusLabel: "Perbaikan Selesai",
    timestamp: "1 Nov 2026, 13:52",
    note: "Fasilitas telah diperbaiki dan dapat digunakan kembali dengan aman.",
    actor: "Teknisi Joko",
  },
];

