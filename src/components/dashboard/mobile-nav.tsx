"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Shield, Building2 } from "lucide-react";
import { DashboardNav } from "./dashboard-nav";
import type { NavItem } from "@/lib/permissions";
import type { Role } from "@/lib/db-types";

interface MobileNavProps {
  items: NavItem[];
  role: Role;
  roleBadgeColor: string;
  sessionName: string;
  sessionEmail: string;
  companyName?: string | null;
}

export function MobileNav({
  items,
  role,
  roleBadgeColor,
  sessionName,
  sessionEmail,
  companyName,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Mencegah scroll pada body saat drawer terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Buka Menu Navigasi"
        className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sidebar */}
          <aside className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col p-5 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 font-bold text-lg text-slate-900"
              >
                <img
                  src="/assets/greendesk_favicon.svg"
                  alt="GreenDesk Logo"
                  className="w-8 h-8 object-contain shrink-0"
                />
                <span>GreenDesk</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup Menu"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profil Ringkas */}
            <div className="py-4 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {sessionName}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${roleBadgeColor}`}
                >
                  {role}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate">
                {sessionEmail}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{companyName || "Lintas Aset"}</span>
              </div>
            </div>

            {/* Menu Navigasi */}
            <div className="py-4 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
                Menu Utama
              </div>
              <DashboardNav items={items} onItemClick={() => setIsOpen(false)} />
            </div>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>GreenDesk Asset Management v0.1</span>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
