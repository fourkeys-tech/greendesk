"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth-actions";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { ProfileForm } from "@/app/dashboard/profil/profile-form";

interface CitizenProfileClientProps {
  user: {
    name: string;
    email: string;
    loginMethod: string;
    isActive: boolean;
    lastLoginLabel: string | null;
    validReportCount: number;
    invalidReportCount: number;
    reporterStatus: string | null;
    blockHouseNo: string | null;
    hasConsent: boolean;
    dataConsentLabel: string;
  };
}

function AccordionCard({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3.5 shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm md:text-base font-semibold text-slate-900">
            {title}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-slate-700" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-700" />
        )}
      </button>
      {open && (
        <div className="mt-3 text-xs md:text-sm text-slate-700 leading-relaxed">
          {children}
        </div>
      )}
    </section>
  );
}

const GUIDE_ITEMS = [
  {
    title: "Temukan Fasilitas Rusak",
    desc: "Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.",
  },
  {
    title: "Pindai (Scan) QR Code",
    desc: "Buka menu Scan QR Code di bilah bawah, lalu arahkan kamera ke kode QR aset tersebut.",
  },
  {
    title: "Isi Formulir Laporan",
    desc: "Unggah foto bukti kerusakan dan sertakan deskripsi singkat kerusakan.",
  },
  {
    title: "Kirim & Pantau Progres",
    desc: "Kirim laporan Anda dan pantau progres pengerjaan hingga selesai di halaman Laporan Saya.",
  },
];

export function CitizenProfileClient({ user }: CitizenProfileClientProps) {
  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "GP";

  const identityCard = (
    <section className="rounded-2xl bg-white border border-slate-200/80 px-5 py-4 flex items-center gap-4 shadow-xs">
      <div className="w-16 h-16 shrink-0 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xl font-black tracking-tight shadow-md ring-4 ring-emerald-50">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight truncate">
          {user.name}
        </h2>
        <p className="text-xs md:text-sm text-slate-600 leading-tight mt-0.5 truncate">
          {user.email}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-[#E3EDE6] px-2.5 py-0.5 font-bold text-[#1B4D3E]">
            Warga / Pengunjung
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono font-semibold text-slate-600">
            {user.loginMethod}
          </span>
          {user.lastLoginLabel && (
            <span className="text-slate-400">
              Masuk terakhir: {user.lastLoginLabel}
            </span>
          )}
        </div>
      </div>
    </section>
  );

  const trackRecordCard = (
    <section className="rounded-2xl bg-[#222522] text-white px-5 py-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-3">
        Rekam Jejak Pelapor
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/15 text-center">
        <div className="px-2">
          <div className="text-2xl font-black text-emerald-300">
            {user.validReportCount}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            Laporan Valid
          </div>
        </div>
        <div className="px-2">
          <div className="text-2xl font-black text-amber-300">
            {user.invalidReportCount}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            Tidak Valid
          </div>
        </div>
      </div>
    </section>
  );

  const editProfileCard = (
    <section className="rounded-2xl bg-white border border-slate-200/80 px-5 py-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] flex items-center justify-center">
          <UserIcon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-sm md:text-base font-bold text-slate-900">
            Pengaturan Data Akun
          </h3>
          <p className="text-[11px] text-slate-500">
            Perubahan disimpan langsung ke profil akun GreenDesk Anda.
          </p>
        </div>
      </div>

      <ProfileForm
        name={user.name}
        email={user.email}
        isReporter
        reporterStatus={user.reporterStatus}
        blockHouseNo={user.blockHouseNo}
        hasConsent={user.hasConsent}
        dataConsentLabel={user.dataConsentLabel}
      />
    </section>
  );

  const accordions = (
    <>
      <AccordionCard
        title="Panduan / Cara Laporan"
        icon={<BookOpen className="w-5 h-5 text-[#1b5e45]" />}
      >
        <div className="space-y-2.5">
          {GUIDE_ITEMS.map((item, idx) => (
            <div
              key={item.title}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F6F5F0]"
            >
              <div className="w-5 h-5 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </AccordionCard>

      <AccordionCard
        title="Kebijakan Privasi"
        icon={<ShieldCheck className="w-5 h-5 text-[#1b5e45]" />}
      >
        <p className="text-xs text-slate-600">
          Nama dan kontak Anda hanya dilihat pengelola dan manager. Teknisi
          tidak dapat melihatnya. Data laporan digunakan hanya untuk keperluan
          perbaikan fasilitas taman.
        </p>
      </AccordionCard>
    </>
  );

  const logoutButton = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="w-full h-11 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 text-xs md:text-sm font-bold transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>Keluar Sesi</span>
      </button>
    </form>
  );

  return (
    <>
      {/* ===== MOBILE (< md) ===== */}
      <div className="md:hidden">
        <MobileContainer className="bg-[#F6F5F0] relative overflow-hidden pb-28">
          <img
            src="/assets/BackgroundLeaf.svg"
            alt=""
            aria-hidden
            className="pointer-events-none select-none absolute bottom-16 right-0 w-40 h-auto object-contain opacity-30"
          />

          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            <header className="flex items-center gap-4 px-4 pt-6 pb-4">
              <Link
                href="/beranda"
                aria-label="Kembali ke Beranda"
                className="w-10 h-10 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-800 shadow-xs"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <h1 className="flex-1 text-center pr-10 text-2xl font-bold text-slate-900 tracking-tight leading-none">
                Profil Saya
              </h1>
            </header>

            <main className="flex-1 px-4 pb-6 space-y-3.5">
              {identityCard}
              {trackRecordCard}
              {editProfileCard}
              {accordions}
              {logoutButton}
            </main>
          </div>
        </MobileContainer>
      </div>

      {/* ===== DESKTOP / TABLET (>= md) ===== */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#F6F5F0] relative">
        <img
          src="/assets/BackgroundLeaf.svg"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute bottom-20 right-0 w-64 h-auto object-contain opacity-25"
        />

        <div className="relative z-10 max-w-4xl mx-auto w-full px-6 pt-10 pb-36 flex flex-col gap-5">
          <header className="relative flex items-center justify-center pb-2">
            <Link
              href="/beranda"
              aria-label="Kembali ke Beranda"
              className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition-all hover:bg-slate-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <img
              src="/assets/GreenDesk.svg"
              alt="GreenDesk Logo"
              className="h-9 w-auto object-contain"
            />
          </header>

          {identityCard}
          {trackRecordCard}
          {editProfileCard}
          {accordions}

          <div className="max-w-xs mx-auto w-full">{logoutButton}</div>
        </div>

        <footer className="relative mt-auto flex items-center justify-between bg-[#0a1f15] px-8 pt-4 pb-24 text-xs text-white lg:px-12">
          <span className="font-bold">GreenDesk</span>
          <span className="text-white/60">
            Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
          </span>
        </footer>
      </div>

      <BottomNav isLoggedIn userRole="PENGGUNA" />
    </>
  );
}
