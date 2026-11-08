import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getNavigationForRole, ROLE_METADATA } from "@/lib/permissions";
import { quickSwitchRoleAction } from "@/app/actions/auth-actions";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { DevRoleSwitcher } from "@/components/dashboard/dev-role-switcher";

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 1. Bar Penguji Fase 0: Collapsible Role Switcher */}
      <DevRoleSwitcher
        currentEmail={session.email}
        currentRole={session.role}
        onSwitchAction={quickSwitchRoleAction}
      />

      {/* 2. Main Shell: Full-Height Sidebar + Workspace */}
      <div className="flex-1 flex w-full">
        {/* Full-Height Desktop Sidebar */}
        <AppSidebar
          session={session}
          navItems={navItems}
          roleMeta={roleMeta}
        />

        {/* Area Kerja Utama */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Top Header (hanya muncul di layar ponsel < md) */}
          <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                GP
              </div>
              <span className="font-extrabold text-base text-slate-900">GreenPark</span>
            </div>

            <MobileNav
              items={navItems}
              role={session.role}
              roleBadgeColor={roleMeta.badgeColor}
              sessionName={session.name}
              sessionEmail={session.email}
              companyName={session.companyName}
            />
          </header>

          {/* Konten Halaman */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
