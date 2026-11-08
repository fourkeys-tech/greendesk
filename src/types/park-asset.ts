export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isBlocked: boolean;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  parkName: string;
  locationNote?: string;
  photoUrl?: string;
  isActive: boolean;
}

export type ReportStatus =
  | 'BARU'
  | 'DIBATALKAN'
  | 'DIGABUNG'
  | 'TIDAK_VALID'
  | 'MENUNGGU_KEPUTUSAN'
  | 'DITOLAK'
  | 'DISETUJUI'
  | 'DIKERJAKAN'
  | 'MENUNGGU_KONFIRMASI'
  | 'SELESAI';

export interface Report {
  id: string;
  ticketNo: string;
  asset: Asset;
  reporter: User;
  channel: 'QR' | 'DASHBOARD';
  description: string;
  status: ReportStatus;
  priority?: 'TINGGI' | 'NORMAL' | 'RENDAH';
  reason?: string;
  createdAt: string;
  photos: string[];
}

export interface StatusHistoryLog {
  id: string;
  status: ReportStatus;
  statusLabel: string;
  timestamp: string;
  note: string;
  actor: string;
}

