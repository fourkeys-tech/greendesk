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
};

interface DashboardNavProps {
  items: NavItem[];
  onItemClick?: () => void;
}

export function DashboardNav({ items, onItemClick }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`group relative flex items-start gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
              isActive
                ? "bg-emerald-50/80 text-emerald-950 border-emerald-200/80 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border-transparent"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-r-full" />
            )}
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
              }`}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm truncate ${
                  isActive
                    ? "font-bold text-emerald-950"
                    : "font-medium text-slate-800 group-hover:text-slate-900"
                }`}
              >
                {item.label}
              </div>
              <div
                className={`text-xs line-clamp-1 ${
                  isActive
                    ? "text-emerald-800/80"
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
