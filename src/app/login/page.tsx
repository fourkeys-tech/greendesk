import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { quickSwitchRoleAction } from "@/app/actions/auth-actions";
import { ROLE_METADATA } from "@/lib/permissions";
import { LoginForms } from "./login-forms";
import type { Role } from "@prisma/client";

const DEMO_ACCOUNTS: Array<{
  role: Role;
  email: string;
  name: string;
  companyNote: string;
}> = [
  {
    role: "PENGGUNA",
    email: "warga@greenpark.id",
    name: "Rina Kartika",
    companyNote: "Warga Bougenville A2/15",
  },
  {
    role: "PENGELOLA",
    email: "pengelola.bgv@greenpark.id",
    name: "Hendro Wibowo",
    companyNote: "Cakupan: Cluster Bougenville",
  },
  {
    role: "MANAGER",
    email: "manager@greenpark.id",
    name: "Diana Kusuma",
    companyNote: "Cakupan: Cluster Bougenville & Edelweiss",
  },
  {
    role: "PIC_VENDOR",
    email: "pic@vendorjaya.id",
    name: "Agus Pratama",
    companyNote: "Vendor: PT Teknik Taman Jaya",
  },
  {
    role: "TEKNISI",
    email: "teknisi.budi@vendorjaya.id",
    name: "Budi Santoso",
    companyNote: "Teknisi PT Teknik Taman Jaya (Disetujui Admin)",
  },
  {
    role: "ADMIN",
    email: "admin@greenpark.id",
    name: "Arfin Mardiyanto",
    companyNote: "PT Taman Hijau Nusantara (Semua Cluster)",
  },
  {
    role: "OWNER",
    email: "owner@greenpark.id",
    name: "Ir. Surya Darmawan",
    companyNote: "Direksi PT Taman Hijau Nusantara",
  },
];

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-slate-900 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-medium mb-3">
              Platform Manajemen Aset Taman (PRD v0.2)
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              GreenPark – Login Dashboard & Portal Warga
            </h1>
            <p className="text-slate-300 mt-2 max-w-3xl text-sm sm:text-base">
              Masuk menggunakan email &amp; kata sandi, kode OTP, atau gunakan
              panel Masuk Cepat 1-Klik di kanan untuk menguji masing-masing
              role.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/lapor"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
            >
              + Buat Laporan Warga (/lapor)
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Kolom Kiri: Form Login Manual & OTP */}
          <div className="lg:col-span-5">
            <LoginForms />
          </div>

          {/* Kolom Kanan: Panel Uji Cepat 7 Role */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Masuk Cepat 1-Klik – Uji 7 Role ke Dashboard
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Klik salah satu role di bawah untuk langsung masuk ke{" "}
                  <code>/dashboard</code> sesuai hak akses role tersebut.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const meta = ROLE_METADATA[acc.role];
                return (
                  <form
                    key={acc.email}
                    action={quickSwitchRoleAction.bind(null, acc.email)}
                  >
                    <button
                      type="submit"
                      className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${meta.badgeColor}`}
                        >
                          {acc.role}
                        </span>
                        <span className="text-xs font-medium text-emerald-700 group-hover:translate-x-0.5 transition">
                          Masuk →
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-900">
                        {acc.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {acc.email}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {acc.companyNote}
                      </div>
                    </button>
                  </form>
                );
              })}

              {/* Tombol Uji Isolasi Multi-Perusahaan (Perusahaan B) */}
              <form
                action={quickSwitchRoleAction.bind(
                  null,
                  "admin@griyaasri.id"
                )}
              >
                <button
                  type="submit"
                  className="w-full text-left p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50/40 transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-slate-200 text-slate-800 border-slate-300">
                      UJI MULTI-PERUSAHAAN
                    </span>
                    <span className="text-xs font-medium text-indigo-700">
                      Masuk →
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900">
                    Admin PT Griya Asri (Perusahaan B)
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    admin@griyaasri.id
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Buktikan data PT Taman Hijau Nusantara tidak bocor ke
                    perusahaan lain
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
