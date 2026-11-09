"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, ScanQrCode, FileText } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const isProfile = pathname === "/profile" || pathname === "/login";
  const isReports = pathname.startsWith("/reports");

  return (
    <nav className="btm-nav relative z-20 h-[72px] rounded-t-3xl border-0 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-6">
      <Link
        href="/login"
        aria-current={isProfile ? "page" : undefined}
        className="flex flex-1 h-full flex-col items-center justify-center gap-1 text-slate-900 translate-x-2"
      >
        <CircleUserRound className="w-7 h-7" strokeWidth={2.2} />
        <span className={`text-[10px] ${isProfile ? "font-bold" : "font-semibold"}`}>
          Profile
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
        href="/reports"
        aria-current={isReports ? "page" : undefined}
        className="flex flex-1 h-full flex-col items-center justify-center gap-1 text-slate-900 -translate-x-2"
      >
        <FileText className="w-7 h-7" strokeWidth={2.2} />
        <span className={`text-[10px] ${isReports ? "font-bold" : "font-semibold"}`}>
          My Reports
        </span>
      </Link>
    </nav>
  );
}
