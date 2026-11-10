import type { Role, ReportStatus } from "@prisma/client";

export type PermissionFeature =
  | "CREATE_REPORT"
  | "VIEW_REPORTS"
  | "VERIFY_AND_PRIORITIZE"
  | "DECIDE_REPAIR"
  | "CREATE_SPK"
  | "ASSIGN_TECHNICIAN"
  | "SUBMIT_WORK_RESULT"
  | "CONFIRM_COMPLETION"
  | "VIEW_MASTER_DATA"
  | "MANAGE_MASTER_DATA"
  | "VIEW_VENDORS"
  | "MANAGE_VENDORS"
  | "VIEW_TECHNICIANS"
  | "MANAGE_OWN_TECHNICIANS"
  | "APPROVE_TECHNICIANS"
  | "VIEW_OWN_TECH_PROFILE"
  | "MANAGE_INTERNAL_ACCOUNTS"
  | "BLOCK_USER_ACCOUNT"
  | "VIEW_AUDIT_LOGS"
  | "ARCHIVE_REPORT";

export type ScopeLevel =
  | "NONE"
  | "OWN_REPORTS"
  | "OWN_CLUSTER"
  | "ASSIGNED_CLUSTERS"
  | "OWN_VENDOR_SPK"
  | "OWN_TECH_SPK"
  | "COMPANY_ALL_READ"
  | "COMPANY_ALL_MANAGE";

export interface RoleMetadata {
  role: Role;
  label: string;
  scopeDescription: string;
  mainDuties: string;
  createdBy: string;
  badgeColor: string;
}

export const ROLE_METADATA: Record<Role, RoleMetadata> = {
  PENGGUNA: {
    role: "PENGGUNA",
    label: "Pengguna (Warga / Pengunjung)",
    scopeDescription: "Semua aset",
    mainDuties: "Melapor kerusakan, memantau status, membatalkan sebelum diverifikasi",
    createdBy: "Daftar sendiri (Google/Email)",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  PENGELOLA: {
    role: "PENGELOLA",
    label: "Pengelola Cluster",
    scopeDescription: "Satu cluster",
    mainDuties: "Verifikasi, prioritas, gabung laporan ganda, teruskan ke manager",
    createdBy: "Admin",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
  },
  MANAGER: {
    role: "MANAGER",
    label: "Manager",
    scopeDescription: "Satu/beberapa cluster tertaut",
    mainDuties: "Setuju/tolak perbaikan, buat SPK, konfirmasi hasil",
    createdBy: "Admin",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  PIC_VENDOR: {
    role: "PIC_VENDOR",
    label: "PIC Vendor",
    scopeDescription: "Perusahaan vendornya",
    mainDuties: "Terima SPK, tunjuk teknisi, kelola data teknisi",
    createdBy: "Admin",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  TEKNISI: {
    role: "TEKNISI",
    label: "Teknisi",
    scopeDescription: "SPK yang ditugaskan",
    mainDuties: "Kerjakan perbaikan, unggah foto sebelum/sesudah",
    createdBy: "PIC Vendor (disetujui Admin)",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
  },
  ADMIN: {
    role: "ADMIN",
    label: "Admin Perusahaan",
    scopeDescription: "Satu perusahaan, semua cluster",
    mainDuties:
      "Kelola wilayah, aset, QR, kategori, akun internal, vendor; setujui teknisi; blokir pengguna",
    createdBy: "Pemilik platform",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  OWNER: {
    role: "OWNER",
    label: "Owner / Direksi",
    scopeDescription: "Satu perusahaan, semua cluster",
    mainDuties: "Pantau ringkasan semua cluster dan riwayat perubahan",
    createdBy: "Pemilik platform",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
  },
};

/**
 * Matriks Hak Akses sesuai Bagian 4 PRD.
 * Catatan penting: Admin TIDAK dapat memverifikasi laporan, memutuskan perbaikan,
 * menugaskan vendor, mengubah isi laporan, atau menghapus laporan permanen.
 */
const ROLE_PERMISSIONS: Record<Role, PermissionFeature[]> = {
  PENGGUNA: ["CREATE_REPORT", "VIEW_REPORTS"],
  PENGELOLA: [
    "VIEW_REPORTS",
    "VERIFY_AND_PRIORITIZE",
    "VIEW_MASTER_DATA",
    "ARCHIVE_REPORT",
  ],
  MANAGER: [
    "VIEW_REPORTS",
    "DECIDE_REPAIR",
    "CREATE_SPK",
    "CONFIRM_COMPLETION",
    "VIEW_MASTER_DATA",
    "VIEW_VENDORS",
    "VIEW_TECHNICIANS",
    "ARCHIVE_REPORT",
  ],
  PIC_VENDOR: [
    "VIEW_REPORTS",
    "ASSIGN_TECHNICIAN",
    "VIEW_VENDORS",
    "VIEW_TECHNICIANS",
    "MANAGE_OWN_TECHNICIANS",
  ],
  TEKNISI: [
    "VIEW_REPORTS",
    "SUBMIT_WORK_RESULT",
    "VIEW_OWN_TECH_PROFILE",
  ],
  ADMIN: [
    "VIEW_REPORTS",
    "VIEW_MASTER_DATA",
    "MANAGE_MASTER_DATA",
    "VIEW_VENDORS",
    "MANAGE_VENDORS",
    "VIEW_TECHNICIANS",
    "APPROVE_TECHNICIANS",
    "MANAGE_INTERNAL_ACCOUNTS",
    "BLOCK_USER_ACCOUNT",
    "VIEW_AUDIT_LOGS",
    "ARCHIVE_REPORT",
  ],
  OWNER: [
    "VIEW_REPORTS",
    "VIEW_MASTER_DATA",
    "VIEW_VENDORS",
    "VIEW_TECHNICIANS",
    "VIEW_AUDIT_LOGS",
  ],
};

export function hasPermission(role: Role, feature: PermissionFeature): boolean {
  return ROLE_PERMISSIONS[role]?.includes(feature) ?? false;
}

export function assertPermission(role: Role, feature: PermissionFeature): void {
  if (!hasPermission(role, feature)) {
    throw new Error(
      `Akses ditolak: Role ${role} tidak memiliki izin untuk fitur ${feature}.`
    );
  }
}

export function getReportViewScope(role: Role): ScopeLevel {
  switch (role) {
    case "PENGGUNA":
      return "OWN_REPORTS";
    case "PENGELOLA":
      return "OWN_CLUSTER";
    case "MANAGER":
      return "ASSIGNED_CLUSTERS";
    case "PIC_VENDOR":
      return "OWN_VENDOR_SPK";
    case "TEKNISI":
      return "OWN_TECH_SPK";
    case "ADMIN":
    case "OWNER":
      return "COMPANY_ALL_READ";
  }
}

export interface NavItem {
  href: string;
  label: string;
  description: string;
  iconName: string;
  badge?: string;
}

/**
 * Menu navigasi yang hanya ditampilkan sesuai hak akses masing-masing role (Kriteria Selesai Fase 0)
 */
export function getNavigationForRole(
  role: Role,
  options?: { isDualRoleTechnician?: boolean; isDualRolePic?: boolean }
): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Ringkasan & Tugas",
      description: "Halaman utama sesuai role Anda",
      iconName: "LayoutDashboard",
    },
  ];

  if (role === "PENGGUNA") {
    items.push(
      {
        href: "/dashboard/lapor",
        label: "Buat Laporan Baru",
        description: "Laporkan kerusakan fasilitas taman via QR atau pilih aset",
        iconName: "PlusCircle",
      },
      {
        href: "/dashboard/laporan",
        label: "Laporan Saya",
        description: "Pantau status laporan dan batalkan jika masih Baru",
        iconName: "FileText",
      },
      {
        href: "/dashboard/profil",
        label: "Profil Saya",
        description: "Status pelapor, rekam jejak, dan persetujuan data",
        iconName: "User",
      }
    );
  }

  if (role === "PENGELOLA") {
    items.push(
      {
        href: "/dashboard/laporan",
        label: "Antrean Verifikasi Cluster",
        description: "Verifikasi laporan Baru, tetapkan prioritas, atau gabung laporan",
        iconName: "ClipboardCheck",
      },
      {
        href: "/dashboard/pengajuan-ganti-vendor",
        label: "Pengajuan Ganti Vendor",
        description: "Ajukan pergantian vendor untuk aset yang rusak berulang",
        iconName: "RotateCcw",
      },
      {
        href: "/dashboard/wilayah",
        label: "Data Wilayah & Aset (Lihat)",
        description: "Lihat struktur cluster, taman, dan aset aktif",
        iconName: "MapPin",
      },
      {
        href: "/dashboard/profil",
        label: "Profil Saya",
        description: "Identitas akun dan cluster penugasan",
        iconName: "User",
      }
    );
  }

  if (role === "MANAGER") {
    items.push(
      {
        href: "/dashboard/laporan",
        label: "Keputusan & Konfirmasi",
        description: "Setuju/tolak perbaikan, buat SPK, dan konfirmasi hasil",
        iconName: "CheckSquare",
      },
      {
        href: "/dashboard/spk",
        label: "Daftar SPK",
        description: "Pantau seluruh penugasan SPK dan pengerjaan",
        iconName: "FileSpreadsheet",
      },
      {
        href: "/dashboard/pengajuan-ganti-vendor",
        label: "Pengajuan Ganti Vendor",
        description: "Putuskan pengajuan pergantian vendor dari Pengelola",
        iconName: "RotateCcw",
      },
      {
        href: "/dashboard/vendor",
        label: "Vendor & Rapor Kinerja",
        description: "Daftar vendor, rapor SPK, dan daftar teknisi",
        iconName: "Building2",
      },
      {
        href: "/dashboard/wilayah",
        label: "Wilayah & Aset (Lihat)",
        description: "Lihat daftar taman, aset, dan QR di cluster tertaut",
        iconName: "MapPin",
      },
      {
        href: "/dashboard/profil",
        label: "Profil Saya",
        description: "Identitas dan cluster wewenang manajer",
        iconName: "User",
      }
    );
  }

  if (role === "PIC_VENDOR") {
    items.push(
      {
        href: "/dashboard/laporan",
        label: "SPK Vendor Saya",
        description: "Terima SPK dari Manager dan tunjuk teknisi penanggung jawab",
        iconName: "Wrench",
      },
      {
        href: "/dashboard/spk",
        label: "Semua SPK Vendor",
        description: "Pantau seluruh SPK vendor dan ganti teknisi bila diperlukan",
        iconName: "FileSpreadsheet",
      },
      {
        href: "/dashboard/teknisi",
        label: "Teknisi Saya",
        description: "Daftarkan teknisi baru dan atur status aktif/cuti",
        iconName: "Users",
      },
      {
        href: "/dashboard/vendor",
        label: "Profil Vendor Saya",
        description: "Lihat informasi kontrak, area layanan, dan masa garansi",
        iconName: "Building2",
      }
    );

    if (options?.isDualRoleTechnician) {
      items.push({
        href: "/dashboard/profil-teknisi",
        label: "Profil Teknisi (Peran Ganda)",
        description: "Lihat data keahlian dan status tugas teknisi Anda",
        iconName: "UserCheck",
      });
    }
  }

  if (role === "TEKNISI") {
    items.push(
      {
        href: "/dashboard/laporan",
        label: "SPK Tugas Saya",
        description: "Kerjakan perbaikan dan unggah foto sebelum/sesudah (tanpa identitas pelapor)",
        iconName: "Hammer",
      },
      {
        href: "/dashboard/profil-teknisi",
        label: "Profil Teknisi Saya",
        description: "Lihat status keahlian dan penugasan Anda",
        iconName: "UserCheck",
      }
    );

    if (options?.isDualRolePic) {
      items.push({
        href: "/dashboard/teknisi",
        label: "Kelola Teknisi (Peran PIC)",
        description: "Akses kelola tim teknisi vendor Anda",
        iconName: "Users",
      });
    }
  }

  if (role === "ADMIN") {
    items.push(
      {
        href: "/dashboard/wilayah",
        label: "Kelola Wilayah, Aset & QR",
        description: "Kelola Komplek, Cluster, Taman, Aset, Kategori, dan cetak QR",
        iconName: "MapPin",
      },
      {
        href: "/dashboard/vendor",
        label: "Kelola Vendor & Setujui Teknisi",
        description: "Input data vendor, buat akun PIC, dan setujui teknisi",
        iconName: "Building2",
      },
      {
        href: "/dashboard/akun",
        label: "Akun Internal & Blokir Pengguna",
        description: "Kelola akun Pengelola/Manager dan blokir akun pelapor bermasalah",
        iconName: "Users",
      },
      {
        href: "/dashboard/laporan",
        label: "Semua Laporan (Mode Lihat)",
        description: "Pantau seluruh laporan perusahaan (Admin tidak bisa verifikasi/putuskan)",
        iconName: "Eye",
      },
      {
        href: "/dashboard/audit",
        label: "Riwayat Perubahan Data",
        description: "Jejak audit perubahan data master (siapa, apa, kapan, nilai lama & baru)",
        iconName: "History",
      },
      {
        href: "/dashboard/pengajuan-ganti-vendor",
        label: "Pengajuan Ganti Vendor",
        description: "Teruskan pengajuan ganti vendor yang disetujui Manager ke Owner",
        iconName: "RotateCcw",
      },
      {
        href: "/dashboard/profil",
        label: "Profil Saya",
        description: "Identitas akun Admin",
        iconName: "User",
      }
    );
  }

  if (role === "OWNER") {
    items.push(
      {
        href: "/dashboard/laporan",
        label: "Pantau Semua Laporan",
        description: "Ringkasan laporan seluruh cluster (Mode Lihat)",
        iconName: "BarChart3",
      },
      {
        href: "/dashboard/wilayah",
        label: "Data Wilayah & Aset (Lihat)",
        description: "Lihat struktur wilayah dan aset seluruh perusahaan",
        iconName: "MapPin",
      },
      {
        href: "/dashboard/vendor",
        label: "Data & Rapor Vendor (Lihat)",
        description: "Pantau performa vendor dan daftar teknisi",
        iconName: "Building2",
      },
      {
        href: "/dashboard/pengajuan-ganti-vendor",
        label: "Eskalasi Ganti Vendor",
        description: "Daftar eskalasi pergantian vendor dari Admin",
        iconName: "RotateCcw",
      },
      {
        href: "/dashboard/audit",
        label: "Riwayat Perubahan Data",
        description: "Audit seluruh perubahan data master di perusahaan",
        iconName: "History",
      },
      {
        href: "/dashboard/profil",
        label: "Profil Saya",
        description: "Identitas akun Owner",
        iconName: "User",
      }
    );
  }

  // Menu khusus dev/verifikasi Fase 0 (Email Log & Matriks Hak Akses)
  items.push({
    href: "/dashboard/fondasi",
    label: "Verifikasi Fase 0 (Fondasi)",
    description: "Uji Matriks Hak Akses, Storage Foto, Email Outbox, dan Arsip Laporan",
    iconName: "ShieldCheck",
  });

  return items;
}

/**
 * Metadata Tampilan 10 Status Laporan (Bagian 7 PRD)
 */
export const STATUS_METADATA: Record<
  ReportStatus,
  { label: string; badgeColor: string; description: string }
> = {
  BARU: {
    label: "Baru",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
    description: "Laporan baru masuk dan menunggu verifikasi Pengelola cluster.",
  },
  DIBATALKAN: {
    label: "Dibatalkan",
    badgeColor: "bg-slate-100 text-slate-600 border-slate-300",
    description: "Laporan dibatalkan sendiri oleh pelapor sebelum diverifikasi.",
  },
  DIGABUNG: {
    label: "Digabung",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Laporan ganda digabungkan ke laporan utama pada aset yang sama.",
  },
  TIDAK_VALID: {
    label: "Tidak Valid",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    description: "Laporan dinyatakan tidak valid oleh Pengelola beserta alasannya.",
  },
  MENUNGGU_KEPUTUSAN: {
    label: "Menunggu Keputusan",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Laporan valid telah diteruskan Pengelola ke Manager untuk keputusan perbaikan.",
  },
  DITOLAK: {
    label: "Ditolak",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
    description: "Perbaikan ditolak oleh Manager beserta alasan penolakannya.",
  },
  DISETUJUI: {
    label: "Disetujui (SPK Terbit)",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
    description: "Perbaikan disetujui Manager, SPK telah diterbitkan ke Vendor untuk penunjukan teknisi.",
  },
  DIKERJAKAN: {
    label: "Dikerjakan Teknisi",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
    description: "Teknisi vendor telah ditugaskan dan sedang mengerjakan perbaikan di lapangan.",
  },
  MENUNGGU_KONFIRMASI: {
    label: "Menunggu Konfirmasi",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
    description: "Teknisi telah mengunggah foto hasil perbaikan dan menunggu pemeriksaan Manager.",
  },
  SELESAI: {
    label: "Selesai",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    description: "Hasil perbaikan telah dikonfirmasi sesuai oleh Manager dan laporan ditutup.",
  },
};

/**
 * Aturan Transisi Status Laporan (Bagian 7 PRD)
 * 10 status; 5 di antaranya status akhir (DIBATALKAN, DIGABUNG, TIDAK_VALID, DITOLAK, SELESAI).
 */
export const TERMINAL_REPORT_STATUSES: ReportStatus[] = [
  "DIBATALKAN",
  "DIGABUNG",
  "TIDAK_VALID",
  "DITOLAK",
  "SELESAI",
];

interface TransitionRule {
  from: ReportStatus;
  to: ReportStatus;
  allowedRole: Role;
  requiresReason?: boolean;
}

export const ALLOWED_STATUS_TRANSITIONS: TransitionRule[] = [
  { from: "BARU", to: "DIBATALKAN", allowedRole: "PENGGUNA" },
  { from: "BARU", to: "DIGABUNG", allowedRole: "PENGELOLA" },
  { from: "BARU", to: "TIDAK_VALID", allowedRole: "PENGELOLA", requiresReason: true },
  { from: "BARU", to: "MENUNGGU_KEPUTUSAN", allowedRole: "PENGELOLA" },
  { from: "MENUNGGU_KEPUTUSAN", to: "DITOLAK", allowedRole: "MANAGER", requiresReason: true },
  { from: "MENUNGGU_KEPUTUSAN", to: "DISETUJUI", allowedRole: "MANAGER" },
  { from: "DISETUJUI", to: "DIKERJAKAN", allowedRole: "PIC_VENDOR" },
  { from: "DIKERJAKAN", to: "MENUNGGU_KONFIRMASI", allowedRole: "TEKNISI" },
  { from: "MENUNGGU_KONFIRMASI", to: "SELESAI", allowedRole: "MANAGER" },
  {
    from: "MENUNGGU_KONFIRMASI",
    to: "DIKERJAKAN",
    allowedRole: "MANAGER",
    requiresReason: true,
  },
];

export function validateStatusTransition(
  from: ReportStatus,
  to: ReportStatus,
  actorRole: Role,
  reason?: string | null
): { valid: boolean; error?: string } {
  const rule = ALLOWED_STATUS_TRANSITIONS.find(
    (r) => r.from === from && r.to === to
  );
  if (!rule) {
    return {
      valid: false,
      error: `Transisi status dari ${from} ke ${to} tidak diizinkan oleh aturan bisnis.`,
    };
  }
  if (rule.allowedRole !== actorRole) {
    return {
      valid: false,
      error: `Role ${actorRole} tidak berhak mengubah status dari ${from} ke ${to} (hanya ${rule.allowedRole}).`,
    };
  }
  if (rule.requiresReason && (!reason || reason.trim().length === 0)) {
    return {
      valid: false,
      error: `Alasan wajib diisi saat mengubah status menjadi ${to}.`,
    };
  }
  return { valid: true };
}

