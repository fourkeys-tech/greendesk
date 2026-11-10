import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNavigationForRole, ROLE_METADATA } from "@/lib/permissions";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import {
  TopHeader,
  NotificationBellPopover,
  type HeaderNotificationItem,
} from "@/components/dashboard/top-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const navItems = getNavigationForRole(session.role);
  const roleMeta = ROLE_METADATA[session.role];

  // Ambil notifikasi terbaru & info klaster untuk header dan badge sidebar
  const [rawNotifications, staffCluster, managerClusters, pendingQueueCount] =
    await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: session.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      session.staffClusterId
        ? prisma.cluster.findUnique({
            where: { id: session.staffClusterId },
            select: { name: true },
          })
        : Promise.resolve(null),
      session.role === "MANAGER"
        ? prisma.clusterManagerAssignment.findMany({
            where: { userId: session.id },
            include: { cluster: { select: { name: true } } },
          })
        : Promise.resolve([]),
      session.role === "PENGELOLA" && session.staffClusterId
        ? prisma.report.count({
            where: {
              archivedAt: null,
              status: "BARU",
              asset: { park: { clusterId: session.staffClusterId } },
            },
          })
        : session.role === "MANAGER" && session.companyId
        ? prisma.report.count({
            where: {
              companyId: session.companyId,
              archivedAt: null,
              status: { in: ["MENUNGGU_KEPUTUSAN", "MENUNGGU_KONFIRMASI"] },
            },
          })
        : Promise.resolve(0),
    ]);

  const notifications: HeaderNotificationItem[] = rawNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    linkUrl: n.linkUrl,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navBadges: Record<string, number> = {};
  if (pendingQueueCount > 0) {
    navBadges["/dashboard/laporan"] = pendingQueueCount;
  }
  if (unreadCount > 0) {
    navBadges["/dashboard/notifikasi"] = unreadCount;
  }

  const roleHeaderLabel =
    session.role === "PENGELOLA"
      ? "Meja Pengelola Klaster"
      : session.role === "MANAGER"
      ? "Meja Kerja Estate Manager"
      : roleMeta.label;

  const scopeHeaderLabel =
    staffCluster?.name ||
    (managerClusters.length > 0
      ? managerClusters.map((m) => m.cluster.name).join(", ")
      : session.companyName || "Seluruh Area Taman");

  const initials = session.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const formattedTodayShort = new Date().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row antialiased print:bg-white print:block">
      {/* 1. Sidebar Kiri (Tampil di Desktop >= md, disembunyikan saat cetak) */}
      <div className="print:hidden">
        <AppSidebar
          session={session}
          navItems={navItems}
          roleMeta={roleMeta}
          badges={navBadges}
        />
      </div>

      {/* 2. Kolom Kanan: Header & Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen print:min-h-0 print:block">
        {/* Topbar Desktop (Sticky >= md, disembunyikan saat cetak) */}
        <div className="print:hidden">
          <TopHeader
            roleLabel={roleHeaderLabel}
            scopeLabel={scopeHeaderLabel}
            notifications={notifications}
          />
        </div>

        {/* Topbar Mobile (< md, disembunyikan saat cetak) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 print:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-emerald-600/20 shrink-0">
                  GP
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-none">
                      GreenPark
                    </span>
                    <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Asset Desk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {session.companyName || "PT Taman Hijau Nusantara"}
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationBellPopover notifications={notifications} />
              <Link
                href="/dashboard/profil"
                className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs ring-2 ring-slate-100"
              >
                {initials || "GP"}
              </Link>
            </div>
          </div>

          {/* Subheader Konteks Klaster & Tanggal di Mobile */}
          <div className="px-4 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {roleHeaderLabel}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-600 truncate">
                {scopeHeaderLabel}
              </span>
            </div>
            <span
              className="text-slate-400 font-medium shrink-0 ml-2"
              suppressHydrationWarning
            >
              {formattedTodayShort}
            </span>
          </div>
        </header>

        {/* Main Content Area (Full Width Konsisten di Semua Menu, Bersih saat Cetak) */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10 print:p-0 print:m-0 print:w-full print:block">
          {children}
        </main>

        {/* Bottom Tab Bar Mobile (< md, disembunyikan saat cetak) */}
        <div className="print:hidden">
          <MobileBottomNav items={navItems} badges={navBadges} />
        </div>
      </div>
    </div>
  );
}
