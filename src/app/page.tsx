"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Megaphone, X } from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

const MASK_SRC = "/images/maskgroup.png";

export default function WelcomePage() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <MobileContainer className="bg-[#F6F5F0] justify-between overflow-hidden">
      <main className="relative z-10 flex-1 flex flex-col justify-between px-6 pt-8 pb-6">
        <div>
          <span className="block text-[22px] font-medium text-slate-900 leading-tight">
            Selamat Datang di
          </span>
          <h1 className="text-[48px] font-extrabold text-[#1b5e45] tracking-tight leading-none mt-1">
            GreenDesk
          </h1>
          <h2 className="text-[22px] font-medium text-[#1f7a55] leading-tight mt-3">
            Mari Jaga Taman
            <br />
            Tetap Nyaman.
          </h2>
          <p className="text-[11px] text-slate-500 max-w-[290px] leading-relaxed mt-3">
            Temukan fasilitas taman yang rusak? Laporkan dengan mudah melalui
            GreenDesk dan pantau proses perbaikannya hingga selesai.
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center py-4">
          <img
            src="/images/Kursi%20Taman.png"
            alt="Ilustrasi Fasilitas Taman"
            className="w-full max-w-[340px] h-auto object-contain select-none pointer-events-none"
          />
        </div>

        <div className="space-y-3">
          <div className="relative overflow-hidden flex items-center gap-3 rounded-3xl bg-[#d9f0e2] px-4 py-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <img
              src={MASK_SRC}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-fill -scale-x-100 pointer-events-none select-none"
            />
            <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
              <Megaphone
                className="w-9 h-9 text-[#1b5e45] fill-[#1b5e45]/90"
                strokeWidth={1.5}
              />
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
            <div className="relative min-w-0 flex-1 pr-10">
              <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                Bersama Menjaga Taman
              </h3>
              <p className="text-[11px] text-slate-800 leading-snug mt-0.5">
                Laporkan, Dukung, dan Bantu Kami Merawat Fasilitas Taman.
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="relative overflow-hidden w-full h-[64px] rounded-3xl bg-white text-[#1b5e45] font-bold text-[22px] shadow-[0_4px_14px_rgba(0,0,0,0.10)] flex items-center justify-center transition-transform active:scale-[0.98]"
          >
            <img
              src={MASK_SRC}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
            />
            <span className="relative">Mulai</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="w-full rounded-3xl bg-white px-5 py-3.5 shadow-[0_4px_14px_rgba(0,0,0,0.10)] flex items-center gap-4 transition-transform active:scale-[0.98] text-left"
          >
            <BookOpen className="w-9 h-9 text-[#1b5e45] shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-bold text-[#1b5e45] leading-tight">
                Panduan
              </h3>
              <p className="text-[11px] text-slate-800 leading-snug mt-0.5">
                Pelajari Cara Menggunakan Aplikasi
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#1b5e45] shrink-0" />
          </button>
        </div>
      </main>

      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Panduan Pelaporan
                  </h3>
                  <p className="text-[11px] text-slate-500">Langkah mudah melaporkan fasilitas</p>
                </div>
              </div>
              {/* <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button> */}
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Temukan Fasilitas Rusak</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Pindai (Scan) QR Code</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Buka menu Scan QR Code di aplikasi, lalu arahkan kamera ke kode QR aset tersebut.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Isi Formulir Laporan</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Unggah foto bukti kerusakan, pilih jenis kerusakan, dan sertakan deskripsi singkat posisi atau detail kerusakan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Kirim & Pantau Progres</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Kirim laporan Anda. Anda dapat memantau status pengerjaan oleh teknisi hingga selesai di halaman riwayat laporan.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="w-full h-11 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white font-semibold text-xs shadow-md transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}
