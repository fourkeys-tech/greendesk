import React from "react";
import type { ReportStatus, Priority } from "@prisma/client";

interface StatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  BARU: {
    label: "Baru",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    dotClass: "bg-sky-500",
  },
  DIBATALKAN: {
    label: "Dibatalkan",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  },
  DIGABUNG: {
    label: "Digabung",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    dotClass: "bg-purple-500",
  },
  TIDAK_VALID: {
    label: "Tidak Valid",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
  MENUNGGU_KEPUTUSAN: {
    label: "Menunggu Keputusan",
    badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
    dotClass: "bg-violet-500",
  },
  DITOLAK: {
    label: "Ditolak",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    dotClass: "bg-rose-600",
  },
  DISETUJUI: {
    label: "Disetujui (SPK)",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  DIKERJAKAN: {
    label: "Dikerjakan",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500 animate-pulse",
  },
  MENUNGGU_KONFIRMASI: {
    label: "Menunggu Konfirmasi",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dotClass: "bg-indigo-500",
  },
  SELESAI: {
    label: "Selesai",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority | null | undefined;
  className?: string;
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  TINGGI: {
    label: "Tinggi",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    dotClass: "bg-rose-600",
  },
  NORMAL: {
    label: "Normal",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  RENDAH: {
    label: "Rendah",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },
};

export function PriorityBadge({
  priority,
  className = "",
}: PriorityBadgeProps) {
  if (!priority) return null;
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${config.badgeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
