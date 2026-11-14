import React from "react";
import Link from "next/link";
import { DashboardNav } from "./dashboard-nav";
import { logoutAction } from "@/app/actions/auth-actions";
import { LogOut } from "lucide-react";
import type { NavItem, RoleMetadata } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";

interface AppSidebarProps {
  session: SessionPayload;
  navItems: NavItem[];
  roleMeta: RoleMetadata;
  badges?: Record<string, number>;
}

/** "Pengguna (Warga / Pengunjung)" → "Pengguna" agar muat di badge sempit. */
function shortRoleLabel(label: string) {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

export function AppSidebar({
  session,
  navItems,
  roleMeta,
  badges = {},
}: AppSidebarProps) {
  const initials = session.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="w-60 h-screen sticky top-0 hidden md:flex flex-col bg-white border-r border-slate-200/80 z-30 select-none">
      {/* Brand + perusahaan */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img
            src="/assets/greendesk_favicon.svg"
            alt="GreenDesk Logo"
            className="w-9 h-9 object-contain group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                GreenPark
              </span>
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Asset Desk
              </span>
            </div>
            <p
              className="text-[11px] text-slate-500 font-medium truncate mt-1"
              title={session.companyName || undefined}
            >
              {session.companyName || "PT Taman Hijau Nusantara"}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigasi */}
      <div className="flex-1 py-3 px-2.5 overflow-y-auto">
        <DashboardNav items={navItems} badges={badges} />
      </div>

      {/* Profil + peran + keluar */}
      <div className="p-2.5 border-t border-slate-200/80">
        <div className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
          <Link
            href="/dashboard/profil"
            className="flex items-center gap-2.5 min-w-0 flex-1 group"
            title={`${session.name} · ${roleMeta.label}\n${roleMeta.scopeDescription}`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 group-hover:bg-emerald-700 transition">
              {initials || "GP"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">
                {session.name}
              </div>
              <span
                className={`inline-block max-w-full truncate mt-0.5 text-[9px] font-bold px-1.5 py-px rounded border ${roleMeta.badgeColor}`}
              >
                {shortRoleLabel(roleMeta.label)}
              </span>
            </div>
          </Link>

          <form action={logoutAction} className="shrink-0" suppressHydrationWarning>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              suppressHydrationWarning
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
