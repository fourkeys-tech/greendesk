import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/app/actions/notification-actions";

export default async function NotificationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Notifikasi Web
            </h1>
            {unreadCount > 0 && (
              <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full">
                {unreadCount} Baru
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Pemberitahuan real-time untuk penugasan, verifikasi laporan, dan hasil kerja teknisi.
          </p>
        </div>

        {unreadCount > 0 && (
          <form
            action={async () => {
              "use server";
              await markAllNotificationsAsReadAction();
            }}
          >
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition shadow-2xs"
            >
              Tandai Semua Sudah Dibaca
            </button>
          </form>
        )}
      </div>

      {/* List Notifikasi */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 font-bold">
            🔔
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">
            Belum Ada Notifikasi
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Setiap ada laporan baru, SPK, atau pembaruan status di cluster Anda, pemberitahuan akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                notif.isRead
                  ? "bg-white border-slate-200/80 text-slate-700"
                  : "bg-emerald-50/60 border-emerald-300 shadow-2xs text-slate-900"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  )}
                  <h4 className="font-bold text-sm text-slate-900">
                    {notif.title}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {new Date(notif.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {notif.message}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {notif.linkUrl && (
                  <Link
                    href={notif.linkUrl}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    Buka Detail →
                  </Link>
                )}

                {!notif.isRead && (
                  <form
                    action={async () => {
                      "use server";
                      await markNotificationAsReadAction(notif.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
                    >
                      Tandai Dibaca
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
