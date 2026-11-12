"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, ScanQrCode, FileText } from "lucide-react";
import type { Role } from "@/lib/db-types";

interface BottomNavProps {
  isLoggedIn?: boolean;
  userRole?: Role | null;
}

export function BottomNav({
  isLoggedIn = false,
  userRole = null,
}: BottomNavProps) {
  const pathname = usePathname();

  const isStaff = Boolean(isLoggedIn && userRole && userRole !== "PENGGUNA");

  const profileHref = isStaff
    ? "/dashboard/profil"
    : isLoggedIn
      ? "/beranda/profil"
      : "/login?returnTo=%2Fberanda%2Fprofil";

  const reportsHref = isStaff
    ? "/dashboard/laporan"
    : isLoggedIn
      ? "/beranda/laporan"
      : "/login?returnTo=%2Fberanda%2Flaporan";

  const isProfile =
    pathname.startsWith("/beranda/profil") ||
    pathname.startsWith("/dashboard/profil") ||
    pathname === "/login";

  const isReports =
    pathname.startsWith("/beranda/laporan") ||
    pathname.startsWith("/beranda/lapor") ||
    pathname.startsWith("/dashboard/laporan");

  return (
    <>
      {/* ===== Mobile Bottom Nav (< md) ===== */}
      <nav
        aria-label="Navigasi Utama"
        className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 flex items-center justify-around h-[72px] rounded-t-3xl bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-6"
      >
        <Link
          href={profileHref}
          aria-current={isProfile ? "page" : undefined}
          className={`flex flex-1 h-full flex-col items-center justify-center gap-1 translate-x-2 transition-colors ${
            isProfile ? "text-[#1B4D3E]" : "text-slate-900 hover:text-[#1B4D3E]"
          }`}
        >
          <CircleUserRound className="w-7 h-7" strokeWidth={2.2} />
          <span className={`text-[10px] ${isProfile ? "font-bold" : "font-semibold"}`}>
            Profil
          </span>
        </Link>

        <div className="flex flex-1 justify-center -translate-y-7">
          <Link
            href="/scan"
            aria-label="Scan QR Code"
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#1f2a27] text-white shadow-xl ring-[6px] ring-white transition-transform active:scale-95 hover:bg-[#161e1c]"
          >
            <ScanQrCode className="w-9 h-9" strokeWidth={1.8} />
          </Link>
        </div>

        <Link
          href={reportsHref}
          aria-current={isReports ? "page" : undefined}
          className={`flex flex-1 h-full flex-col items-center justify-center gap-1 -translate-x-2 transition-colors ${
            isReports ? "text-[#1B4D3E]" : "text-slate-900 hover:text-[#1B4D3E]"
          }`}
        >
          <FileText className="w-7 h-7" strokeWidth={2.2} />
          <span className={`text-[10px] ${isReports ? "font-bold" : "font-semibold"}`}>
            Laporan Saya
          </span>
        </Link>
      </nav>

      {/* ===== Desktop/Tablet Floating Navbar (>= md) ===== */}
      <nav
        aria-label="Navigasi Utama"
        className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center fixed bottom-5 left-1/2 -translate-x-1/2 z-40 h-[68px] w-[420px] max-w-[calc(100vw-2rem)] rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_12px_32px_rgba(15,23,42,0.14)] px-4"
      >
        <Link
          href={profileHref}
          aria-current={isProfile ? "page" : undefined}
          className={`flex h-12 items-center justify-center gap-2 rounded-full px-3 whitespace-nowrap transition-colors ${
            isProfile
              ? "bg-emerald-50 text-[#1B4D3E]"
              : "text-slate-700 hover:bg-slate-100/80 hover:text-[#1B4D3E]"
          }`}
        >
          <CircleUserRound className="w-5 h-5 shrink-0" strokeWidth={2.1} />
          <span className={`text-xs ${isProfile ? "font-bold" : "font-semibold"}`}>
            Profil
          </span>
        </Link>

        <div className="flex justify-center -translate-y-4 mx-2">
          <Link
            href="/scan"
            aria-label="Scan QR Code"
            title="Scan QR Code"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1f2a27] text-white shadow-lg ring-[5px] ring-white transition-all hover:bg-[#161e1c] hover:scale-[1.03] active:scale-95"
          >
            <ScanQrCode className="w-7 h-7" strokeWidth={1.9} />
          </Link>
        </div>

        <Link
          href={reportsHref}
          aria-current={isReports ? "page" : undefined}
          className={`flex h-12 items-center justify-center gap-2 rounded-full px-3 whitespace-nowrap transition-colors ${
            isReports
              ? "bg-emerald-50 text-[#1B4D3E]"
              : "text-slate-700 hover:bg-slate-100/80 hover:text-[#1B4D3E]"
          }`}
        >
          <FileText className="w-5 h-5 shrink-0" strokeWidth={2.1} />
          <span className={`text-xs ${isReports ? "font-bold" : "font-semibold"}`}>
            Laporan Saya
          </span>
        </Link>
      </nav>
    </>
  );
}
