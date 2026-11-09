"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden>
      <path d="M95 5C55 5 15 30 8 72c-1 8 0 15 2 20 5-3 12-6 20-8C65 78 92 45 95 5Z" />
    </svg>
  );
}

export default function WelcomePage() {
  return (
    <MobileContainer className="bg-[#f6f4ee] justify-between overflow-hidden">
      <div className="absolute top-0 right-0 w-44 h-44 pointer-events-none select-none text-[#cfe5d3]">
        <Leaf className="absolute -top-6 -right-6 w-36 h-36 opacity-70 rotate-[20deg]" />
        <Leaf className="absolute top-8 right-14 w-20 h-20 opacity-50 -rotate-[10deg]" />
      </div>

      <div className="absolute bottom-20 -left-6 w-32 h-40 pointer-events-none select-none text-[#cfe5d3]">
        <Leaf className="absolute bottom-0 left-0 w-28 h-28 opacity-60 rotate-[200deg]" />
        <Leaf className="absolute bottom-10 left-6 w-16 h-16 opacity-40 rotate-[160deg]" />
      </div>

      <div className="absolute bottom-16 right-0 w-20 h-20 pointer-events-none select-none text-[#9fd1ab]">
        <Leaf className="absolute bottom-0 right-0 w-16 h-16 opacity-70 rotate-[-30deg]" />
      </div>

      <main className="relative z-10 px-6 pt-10 pb-6 flex-1 flex flex-col justify-between">
        <div>
          <span className="block text-[15px] font-medium text-slate-900">
            Selamat Datang di
          </span>
          <h1 className="text-[40px] font-extrabold text-[#1b5e45] tracking-tight leading-none mt-1">
            GreenDesk
          </h1>
          <h2 className="text-[22px] font-semibold text-[#1f7a55] leading-tight mt-2">
            Mari Jaga Taman
            <br />
            Tetap Nyaman.
          </h2>
          <p className="text-[10px] text-slate-500 max-w-[260px] leading-relaxed mt-3">
            Temukan fasilitas taman yang rusak? Laporkan dengan mudah melalui
            GreenDesk dan pantau proses perbaikannya hingga selesai.
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center py-2">
          <img
            src="/images/Kursi%20Taman.png"
            alt="Ilustrasi Fasilitas Taman"
            className="w-full max-w-[300px] h-auto object-contain select-none pointer-events-none"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-[#d9f0e2] px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
              <Megaphone className="w-8 h-8 text-[#1b5e45] fill-[#1b5e45]/90" strokeWidth={1.5} />
              <svg
                viewBox="0 0 24 24"
                className="absolute -top-1 right-0 w-5 h-5 text-[#f5b800]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 3v4M18 6l-2.5 2.5M21 12h-4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-bold text-slate-900 leading-tight">
                Bersama Menjaga Taman
              </h3>
              <p className="text-[10px] text-slate-800 leading-snug mt-0.5">
                Laporkan, Dukung, dan Bantu Kami Merawat Fasilitas Taman.
              </p>
            </div>
          </div>

          <Link
            href="/beranda"
            className="w-full py-3.5 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white font-bold text-sm shadow-lg shadow-[#1b5e45]/20 flex items-center justify-center gap-1 transition-transform active:scale-[0.98]"
          >
            <span>Mulai &gt;</span>
          </Link>
        </div>
      </main>
    </MobileContainer>
  );
}
