"use client";

import React, { useEffect, useState } from "react";
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
  UserCog,
  RotateCcw,
  Bell,
  FileSpreadsheet,
  MoreHorizontal,
  X,
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
  UserCog,
  RotateCcw,
  Bell,
  FileSpreadsheet,
};

interface MobileBottomNavProps {
  items: NavItem[];
  badges?: Record<string, number>;
}

function isRouteActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

export function MobileBottomNav({ items, badges = {} }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  // Notifikasi sudah ada di bel header mobile.
  const navItems = items.filter((i) => i.href !== "/dashboard/notifikasi");
  const hasOverflow = navItems.length > 5;
  const primaryItems = hasOverflow ? navItems.slice(0, 4) : navItems;
  const overflowItems = hasOverflow ? navItems.slice(4) : [];

  const overflowBadgeTotal = overflowItems.reduce(
    (sum, item) => sum + (badges[item.href] || 0),
    0
  );
  const overflowHasActive = overflowItems.some((item) =>
    isRouteActive(pathname, item.href)
  );
  const colCount = hasOverflow ? 5 : Math.max(primaryItems.length, 1);

  return (
    <>
      {moreOpen && hasOverflow && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu lainnya"
            className="bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-4 pb-6 max-h-[75vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-extrabold text-slate-900">
                Menu Lainnya
              </span>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {overflowItems.map((item) => {
                const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
                const active = isRouteActive(pathname, item.href);
                const badgeCount = badges[item.href] || 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border text-xs transition ${
                      active
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold"
                        : "bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100 font-semibold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          active
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-slate-200 text-slate-600"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.readOnly && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                              Lihat
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-normal text-slate-500 truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    {badgeCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]">
        <div
          className="grid h-16 max-w-md mx-auto px-1"
          style={{
            gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
          }}
        >
          {primaryItems.map((item) => {
            const IconComponent = ICON_MAP[item.iconName] || HelpCircle;
            const active = isRouteActive(pathname, item.href);
            const badgeCount = badges[item.href] || 0;
            const shortLabel = item.shortLabel || item.label.split(" ")[0];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 relative transition ${
                  active
                    ? "text-emerald-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <span className="absolute top-0 w-8 h-1 bg-emerald-600 rounded-b-full" />
                )}
                <div className="relative">
                  <IconComponent className="w-5 h-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.5 leading-none bg-sky-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
                      {badgeCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight truncate max-w-[64px] ${
                    active ? "font-bold" : "font-medium"
                  }`}
                >
                  {shortLabel}
                </span>
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={`flex flex-col items-center justify-center gap-1 relative transition cursor-pointer ${
                moreOpen || overflowHasActive
                  ? "text-emerald-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {(moreOpen || overflowHasActive) && (
                <span className="absolute top-0 w-8 h-1 bg-emerald-600 rounded-b-full" />
              )}
              <div className="relative">
                <MoreHorizontal className="w-5 h-5" />
                {overflowBadgeTotal > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.5 leading-none bg-amber-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
                    {overflowBadgeTotal}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight truncate max-w-[64px] ${
                  moreOpen || overflowHasActive ? "font-bold" : "font-medium"
                }`}
              >
                Lainnya
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
