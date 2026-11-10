"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  ClipboardCheck,
  MapPin,
  CheckSquare,
  Building2,
  Wrench,
  Users,
  Hammer,
  UserCheck,
  Eye,
  History,
  BarChart3,
  HelpCircle,
  User,
  RotateCcw,
  Bell,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/permissions";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  PlusCircle,
  FileText,
  ClipboardCheck,
  MapPin,
  CheckSquare,
  Building2,
  Wrench,
  Users,
  Hammer,
  UserCheck,
  Eye,
  History,
  BarChart3,
  User,
  RotateCcw,
  Bell,
  FileSpreadsheet,
};

interface DashboardNavProps {
  items: NavItem[];
  badges?: Record<string, number>;
  onItemClick?: () => void;
}

export function DashboardNav({
  items,
  badges = {},
  onItemClick,
}: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const badgeCount = badges[item.href] || 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              isActive
                ? "bg-emerald-50/90 text-emerald-950 border-emerald-200/80 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-emerald-600 rounded-r-full" />
            )}
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors mt-0.5 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
              }`}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`text-xs truncate ${
                    isActive
                      ? "font-bold text-emerald-950"
                      : "font-semibold text-slate-800 group-hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </div>
                {badgeCount > 0 && item.href === "/dashboard/notifikasi" ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                ) : badgeCount > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full shrink-0">
                    {badgeCount}
                  </span>
                ) : null}
              </div>
              <div
                className={`text-[11px] line-clamp-1 mt-0.5 ${
                  isActive
                    ? "text-emerald-700/85 font-medium"
                    : "text-slate-500 group-hover:text-slate-600"
                }`}
              >
                {item.description}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
