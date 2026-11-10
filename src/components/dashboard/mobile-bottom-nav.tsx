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

const SHORT_LABELS: Record<string, string> = {
  "/dashboard": "Ringkasan",
  "/dashboard/laporan": "Antrean",
  "/dashboard/pengajuan-ganti-vendor": "Vendor",
  "/dashboard/wilayah": "Aset",
  "/dashboard/profil": "Profil",
  "/dashboard/lapor": "Lapor",
  "/dashboard/notifikasi": "Notifikasi",
  "/dashboard/spk": "SPK",
  "/dashboard/vendor": "Vendor",
  "/dashboard/teknisi": "Teknisi",
  "/dashboard/users": "Pengguna",
  "/dashboard/audit": "Audit",
  "/dashboard/statistik": "Statistik",
};

interface MobileBottomNavProps {
  items: NavItem[];
  badges?: Record<string, number>;
}

export function MobileBottomNav({ items, badges = {} }: MobileBottomNavProps) {
  const pathname = usePathname();

  // Pilih maksimal 5 menu utama (prioritaskan Ringkasan, Antrean/Laporan, Vendor/SPK, Wilayah/Aset, dan Profil)
  const profileItem = items.find((i) => i.href === "/dashboard/profil");
  const nonProfileItems = items.filter(
    (i) => i.href !== "/dashboard/profil" && i.href !== "/dashboard/notifikasi"
  );
  const tabItems = profileItem
    ? [...nonProfileItems.slice(0, 4), profileItem]
    : nonProfileItems.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]">
      <div
        className="grid h-16 max-w-md mx-auto px-1"
        style={{
          gridTemplateColumns: `repeat(${tabItems.length}, minmax(0, 1fr))`,
        }}
      >
        {tabItems.map((item) => {
          const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = badges[item.href] || 0;
          const shortLabel = SHORT_LABELS[item.href] || item.label.split(" ")[0];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 relative transition ${
                isActive
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-1 bg-emerald-600 rounded-b-full" />
              )}
              <div className="relative">
                <IconComponent className="w-5 h-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 bg-sky-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
                    {badgeCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight truncate max-w-[64px] ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

