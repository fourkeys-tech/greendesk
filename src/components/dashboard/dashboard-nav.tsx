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

/** Menu akun pribadi dipisah ke grup "Akun" di bawah. */
const ACCOUNT_HREFS = new Set([
  "/dashboard/profil",
  "/dashboard/profil-teknisi",
]);

interface DashboardNavProps {
  items: NavItem[];
  badges?: Record<string, number>;
  onItemClick?: () => void;
}

function isRouteActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  item,
  active,
  badgeCount,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  onClick?: () => void;
}) {
  const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
  const isNotification = item.href === "/dashboard/notifikasi";

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={item.description}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 h-10 px-2.5 rounded-xl text-[13px] transition-colors ${
        active
          ? "bg-emerald-50 text-emerald-950 font-bold"
          : "text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-r-full"
        />
      )}
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          active
            ? "bg-emerald-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700"
        }`}
      >
        <IconComponent className="w-4 h-4" aria-hidden="true" />
      </span>

      <span className="flex-1 min-w-0 truncate">{item.label}</span>

      {item.readOnly && (
        <span
          className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-400"
          title="Hanya lihat"
        >
          Lihat
        </span>
      )}

      {badgeCount > 0 &&
        (isNotification ? (
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
            aria-label="Ada notifikasi baru"
          />
        ) : (
          <span
            className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-sky-500 text-white rounded-full shrink-0"
            aria-label={`${badgeCount} perlu ditindaklanjuti`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ))}
    </Link>
  );
}

export function DashboardNav({
  items,
  badges = {},
  onItemClick,
}: DashboardNavProps) {
  const pathname = usePathname();

  const groups = [
    {
      key: "kerja",
      title: "Menu",
      items: items.filter((i) => !ACCOUNT_HREFS.has(i.href)),
    },
    {
      key: "akun",
      title: "Akun",
      items: items.filter((i) => ACCOUNT_HREFS.has(i.href)),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Menu dashboard" className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {group.title}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isRouteActive(pathname, item.href)}
                  badgeCount={badges[item.href] || 0}
                  onClick={onItemClick}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
