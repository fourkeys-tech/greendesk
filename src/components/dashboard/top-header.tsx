"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/app/actions/notification-actions";

export interface HeaderNotificationItem {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellPopoverProps {
  notifications: HeaderNotificationItem[];
}

export function NotificationBellPopover({
  notifications,
}: NotificationBellPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"ALL" | "UNREAD">("ALL");
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayedNotifications =
    tab === "UNREAD"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsAsReadAction();
    });
  }

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationAsReadAction(id);
    });
  }

  function getNotificationIcon(title: string) {
    const lower = title.toLowerCase();
    if (lower.includes("tinggi") || lower.includes("darurat") || lower.includes("tolak") || lower.includes("revisi")) {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/60 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    if (lower.includes("spk") || lower.includes("teknisi") || lower.includes("kerja")) {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60 mt-0.5">
          <Wrench className="w-4 h-4" />
        </div>
      );
    }
    if (lower.includes("selesai") || lower.includes("setuju") || lower.includes("valid")) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 mt-0.5">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200/60 mt-0.5">
        <ClipboardList className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Buka Notifikasi"
        className={`relative p-2 rounded-xl transition cursor-pointer border ${
          isOpen
            ? "text-emerald-700 bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200/80 bg-white"
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/5 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover Dropdown */}
          <div className="absolute right-0 mt-3 w-80 sm:w-[410px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 z-40 overflow-hidden flex flex-col">
            {/* Popover Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Notifikasi
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    {unreadCount} Baru
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Tandai semua dibaca</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="px-5 pt-2.5 pb-0 border-b border-slate-100 flex items-center gap-4 text-xs font-semibold bg-white">
              <button
                type="button"
                onClick={() => setTab("ALL")}
                className={`pb-2.5 border-b-2 transition cursor-pointer ${
                  tab === "ALL"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("UNREAD")}
                className={`pb-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  tab === "UNREAD"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Belum Dibaca</span>
                {unreadCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
            </div>

            {/* Notification Items List */}
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {displayedNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    Tidak ada notifikasi
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Semua pemberitahuan terbaru akan tampil di sini.
                  </p>
                </div>
              ) : (
                displayedNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 transition relative group ${
                      notif.isRead
                        ? "hover:bg-slate-50/90 bg-white opacity-85 hover:opacity-100"
                        : "bg-emerald-50/35 hover:bg-slate-50/90"
                    }`}
                  >
                    {!notif.isRead && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                    )}
                    <div className="flex items-start gap-3.5 pl-1.5">
                      {getNotificationIcon(notif.title)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs truncate ${
                              notif.isRead
                                ? "font-semibold text-slate-800"
                                : "font-bold text-slate-900"
                            }`}
                          >
                            {notif.title}
                          </p>
                          <span
                            className={`text-[10px] whitespace-nowrap ${
                              notif.isRead
                                ? "font-medium text-slate-400"
                                : "font-semibold text-emerald-700"
                            }`}
                          >
                            {new Date(notif.createdAt).toLocaleDateString(
                              "id-ID",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {notif.linkUrl && (
                            <Link
                              href={notif.linkUrl}
                              onClick={() => {
                                if (!notif.isRead) handleMarkRead(notif.id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200/70 px-2.5 py-0.5 rounded-md transition"
                            >
                              <span>Buka Detail</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                          {!notif.isRead && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleMarkRead(notif.id)}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Tandai dibaca
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Popover Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200/80 text-center">
              <Link
                href="/dashboard/notifikasi"
                onClick={() => setIsOpen(false)}
                className="w-full py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-white border border-transparent hover:border-slate-200/80 transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>Lihat Semua Notifikasi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface TopHeaderProps {
  roleLabel: string;
  scopeLabel: string;
  notifications: HeaderNotificationItem[];
}

export function TopHeader({
  roleLabel,
  scopeLabel,
  notifications,
}: TopHeaderProps) {
  const formattedToday = new Date().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="hidden md:flex bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 px-6 lg:px-8 py-3.5 items-center justify-between">
      {/* Left: Context Breadcrumb */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {roleLabel}
        </span>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-medium text-slate-600">{scopeLabel}</span>
      </div>

      {/* Right: Quick Status & Actions */}
      <div className="flex items-center gap-4">
        <NotificationBellPopover notifications={notifications} />

        <div className="h-5 w-px bg-slate-200" />

        <div className="text-right">
          <div className="text-xs font-semibold text-slate-800">Hari ini</div>
          <div className="text-[11px] text-slate-500" suppressHydrationWarning>
            {formattedToday}
          </div>
        </div>
      </div>
    </header>
  );
}

