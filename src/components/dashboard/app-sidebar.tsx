import React from "react";
import Link from "next/link";
import { DashboardNav } from "./dashboard-nav";
import { logoutAction } from "@/app/actions/auth-actions";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import type { NavItem, RoleMetadata } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";

interface AppSidebarProps {
  session: SessionPayload;
  navItems: NavItem[];
  roleMeta: RoleMetadata;
  badges?: Record<string, number>;
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
    <aside className="w-64 lg:w-72 h-screen sticky top-0 hidden md:flex flex-col bg-white border-r border-slate-200/80 shadow-2xs z-30 select-none">
      {/* 1. Header Sidebar: Logo & Brand */}
      <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0 tracking-tight">
            GP
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none">
              GreenPark
            </span>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mt-1">
              Asset Desk
            </span>
          </div>
        </Link>

        {/* Perusahaan Terpilih */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs font-medium text-slate-600">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">
            {session.companyName || "PT Taman Hijau Nusantara"}
          </span>
        </div>
      </div>

      {/* 2. Middle Sidebar: Navigasi Menu */}
      <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 flex items-center justify-between">
            <span>Menu Utama</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${roleMeta.badgeColor}`}
            >
              {session.role}
            </span>
          </div>
          <DashboardNav items={navItems} badges={badges} />
        </div>

        {/* Info Cakupan Akses Role */}
        <div className="pt-2 px-1">
          <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cakupan Tugas</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {roleMeta.scopeDescription}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Footer Sidebar: Profil Pengguna & Tombol Logout */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
          <Link
            href="/dashboard/profil"
            className="flex items-center gap-2.5 min-w-0 flex-1 group"
          >
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-emerald-700 transition">
              {initials || "GP"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">
                {session.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {session.email}
              </div>
            </div>
          </Link>

          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
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
