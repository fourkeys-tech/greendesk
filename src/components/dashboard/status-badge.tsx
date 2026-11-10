import React from "react";
import type { ReportStatus, Priority } from "@prisma/client";
import { STATUS_METADATA } from "@/lib/permissions";

interface StatusBadgeProps {
  status: ReportStatus;
  className?: string;
}

const STATUS_DOT_CLASS: Record<ReportStatus, string> = {
  BARU: "bg-sky-500",
  DIBATALKAN: "bg-slate-400",
  DIGABUNG: "bg-purple-500",
  TIDAK_VALID: "bg-rose-500",
  MENUNGGU_KEPUTUSAN: "bg-amber-500",
  DITOLAK: "bg-rose-600",
  DISETUJUI: "bg-indigo-500",
  DIKERJAKAN: "bg-orange-500 animate-pulse",
  MENUNGGU_KONFIRMASI: "bg-teal-500",
  SELESAI: "bg-emerald-500",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const meta = STATUS_METADATA[status];
  const label = meta?.label ?? status;
  const badgeClass = meta?.badgeColor ?? "bg-slate-100 text-slate-700 border-slate-200";
  const dotClass = STATUS_DOT_CLASS[status] ?? "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
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
