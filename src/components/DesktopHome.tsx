"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

const REPORT_HREF = "/reports/new";
const GUIDE_HREF = "/panduan";
const STATUS_HREF = (ticket: string) => `/status/${encodeURIComponent(ticket)}`;

export function DesktopHome() {
  const router = useRouter();
  const [ticket, setTicket] = useState("");

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticket.trim();
    if (t) router.push(STATUS_HREF(t));
  };

  return (
    <div className="hidden md:flex flex-col min-h-screen bg-[#f6f4ef] relative overflow-hidden">
      <img
        src="/assets/BackgroundLeaf.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 w-[32%] max-w-[460px] select-none"
      />
      <img
        src="/assets/BackgroundLeaf.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 w-[26%] max-w-[400px] select-none -scale-x-100"
      />

      <section className="relative flex flex-col items-center text-center px-6 pt-24 lg:pt-32 pb-16">
        <h2 className="text-3xl lg:text-5xl font-medium text-slate-900">
          Selamat Datang di
        </h2>
        <h1 className="mt-1 text-6xl lg:text-8xl font-extrabold tracking-tight text-[#1b5e45] leading-none">
          Green<span className="font-medium">Desk</span>
        </h1>
        <p className="mt-6 text-2xl lg:text-4xl font-semibold text-[#2a7a58]">
          Mari Jaga Taman Tetap Nyaman.
        </p>
        <p className="mt-5 max-w-xl lg:max-w-2xl text-base lg:text-2xl text-slate-500 leading-relaxed">
          Temukan fasilitas taman yang rusak? Laporkan dengan mudah melalui GreenDesk dan
          pantau proses perbaikannya hingga selesai.
        </p>

        <div className="relative mt-14 w-full max-w-6xl flex items-center justify-center min-h-[220px]">
          <img
            src="/assets/KursiTaman.svg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-0 bottom-0 w-[26%] lg:w-[28%] select-none"
          />
          <img
            src="/assets/KursiTaman.svg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-0 w-[28%] lg:w-[30%] select-none -scale-x-100"
          />

          <Link
            href={REPORT_HREF}
            className="relative z-10 group flex items-center justify-between w-[48%] min-w-[340px] max-w-[520px] h-16 lg:h-[72px] pl-0 pr-8 rounded-full bg-[#d8efe2] text-[#1b5e45] shadow-md hover:shadow-lg hover:bg-[#cdeadb] transition-all overflow-hidden"
          >
            <img
              src="/assets/LeafButton.svg"
              alt=""
              aria-hidden
              className="h-full w-auto object-contain"
            />
            <span className="text-xl lg:text-2xl font-bold">Mulai buat Laporan</span>
            <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-16 flex flex-col gap-4">
        <Link
          href={GUIDE_HREF}
          className="relative flex flex-col justify-center h-24 px-7 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow overflow-hidden"
        >
          <span className="text-xl font-bold text-[#1b5e45]">Panduan</span>
          <span className="text-base text-[#1b5e45]">Pelajari Cara Menggunakan Aplikasi</span>
          <img
            src="/assets/LeafButton.svg"
            alt=""
            aria-hidden
            className="absolute right-0 bottom-0 h-full w-auto"
          />
        </Link>

        <form
          onSubmit={onCheck}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-7 py-6 rounded-2xl bg-white shadow-sm"
        >
          <div className="max-w-xl">
            <h3 className="text-lg font-bold text-slate-900">Cek status laporan</h3>
            <p className="mt-1 text-sm text-slate-500">
              Masukkan nomor tiket dari email konfirmasi Anda untuk melihat sampai tahap mana
              laporan diproses.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Contoh: TK-0824-91"
              aria-label="Nomor tiket"
              className="h-12 w-60 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-[#0f2a1d] text-white text-sm font-semibold hover:bg-[#1b5e45] transition-colors"
            >
              Cek Status
            </button>
          </div>
        </form>

        <div className="relative flex items-center gap-4 h-24 px-7 rounded-2xl bg-white shadow-md overflow-hidden">
          <img
            src="/assets/LeafButton.svg"
            alt=""
            aria-hidden
            className="h-14 w-auto"
          />
          <div>
            <p className="text-lg font-bold text-slate-900">Bersama Menjaga Taman</p>
            <p className="text-sm text-slate-700 leading-snug">
              Laporkan, Dukung, dan Bantu
              <br />
              Kami Merawat Fasilitas Taman.
            </p>
          </div>
          <img
            src="/assets/LeafButton.svg"
            alt=""
            aria-hidden
            className="absolute right-0 bottom-0 h-full w-auto"
          />
        </div>
      </section>

      <footer className="mt-auto bg-[#0f2a1d] text-white/90 px-10 py-5 flex items-center justify-between text-sm">
        <span className="font-semibold">GreenDesk</span>
        <span className="text-white/60">
          Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
        </span>
      </footer>
    </div>
  );
}
