"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanQrCode, FileText } from "lucide-react";

// Sesuaikan href dengan route aplikasimu
const LEFT = { href: "/profile", label: "Profile", icon: Home };
const RIGHT = { href: "/reports", label: "My Reports", icon: FileText };

export function FloatingNav() {
    const pathname = usePathname();
    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    const renderItem = ({ href, label, icon: Icon }: typeof LEFT) => (
        <Link
            href={href}
            className={`flex flex-col items-center gap-1 text-[11px] font-bold transition-colors ${isActive(href)
                ? "text-[#1b5e45]"
                : "text-slate-500 hover:text-slate-800"
                }`}
        >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
        </Link>
    );

    return (
        <nav className="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 md:block">
            <div className="grid w-[340px] grid-cols-[1fr_auto_1fr] items-center rounded-full border border-slate-200/70 bg-white px-12 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <div className="flex justify-center">{renderItem(LEFT)}</div>
                <Link
                    href="/scan"
                    aria-label="Scan QR Code"
                    className="-mt-9 flex h-16 w-16 items-center justify-center rounded-full bg-[#1f2a27] text-white shadow-lg ring-4 ring-[#F6F5F0] transition-transform hover:scale-105 active:scale-95"
                >
                    <ScanQrCode className="h-7 w-7" />
                </Link>
                <div className="flex justify-center">{renderItem(RIGHT)}</div>
            </div>
        </nav>
    );
}