"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Megaphone, X } from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

const MASK_SRC = "/images/maskgroup.png";

export default function WelcomePage() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      {/* ===== MOBILE (unchanged) ===== */}
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

      {/* ===== DESKTOP / TABLET ===== */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#F6F5F0] relative overflow-x-hidden">
        <img
          src="/assets/BackgroundLeaf.svg"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute top-0 left-0 w-[28%] max-w-[420px] h-auto object-contain z-0"
        />
        <img
          src="/assets/BackgroundLeaf.svg"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute top-0 right-0 w-[28%] max-w-[420px] h-auto object-contain -scale-x-100 z-0"
        />

        <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 lg:pt-28">
          <span className="text-2xl lg:text-4xl font-medium text-slate-800">
            Selamat Datang di
          </span>
          <h1 className="mt-1 text-6xl lg:text-8xl tracking-tight leading-none text-[#1b5e45]">
            <span className="font-extrabold">Green</span>
            <span className="font-medium">Desk</span>
          </h1>
          <h2 className="mt-4 text-2xl lg:text-3xl font-bold text-[#1f7a55]">
            Mari Jaga Taman Tetap Nyaman.
          </h2>
          <p className="mt-3 max-w-xl lg:max-w-2xl text-sm lg:text-base text-slate-500 leading-relaxed">
            Temukan fasilitas taman yang rusak? Laporkan dengan mudah melalui
            GreenDesk dan pantau proses perbaikannya hingga selesai.
          </p>

          <div className="relative mt-10 lg:mt-12 w-full max-w-5xl flex items-center justify-center min-h-[240px] lg:min-h-[280px]">
            <img
              src="/assets/KursiTaman.svg"
              alt=""
              aria-hidden
              className="pointer-events-none select-none absolute left-4 lg:left-12 bottom-0 w-[240px] lg:w-[320px] h-auto object-contain object-left-bottom -scale-x-100"
            />
            <img
              src="/assets/KursiTaman.svg"
              alt=""
              aria-hidden
              className="pointer-events-none select-none absolute right-4 lg:right-12 bottom-0 w-[240px] lg:w-[320px] h-auto object-contain object-right-bottom"
            />

            <Link
              href="/login"
              className="relative z-10 group flex items-center justify-between w-[360px] lg:w-[440px] h-16 lg:h-[72px] pl-0 pr-8 rounded-full bg-[#d8efe2] text-[#1b5e45] shadow-md hover:shadow-lg hover:bg-[#cdeadb] transition-all overflow-hidden"
            >
              <img
                src="/assets/LeafButton.svg"
                alt=""
                aria-hidden
                className="h-full w-auto object-contain select-none pointer-events-none shrink-0 scale-x-[-1]"
              />
              <span className="text-lg lg:text-xl font-bold">Mulai buat Laporan</span>
              <ArrowRight className="w-5 h-5 lg:w-6 lg:h-6 transition-transform group-hover:translate-x-1 shrink-0" />
            </Link>
          </div>
        </section>

        <section className="relative z-10 w-full max-w-screen-xl mx-auto px-6 lg:px-12 pt-8 pb-12 flex flex-col gap-5">
          <div className="relative overflow-hidden w-full rounded-3xl bg-white p-7 lg:p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#1b5e45]">Panduan</h3>
                <p className="text-sm text-[#1f7a55] mt-0.5">Pelajari Cara Menggunakan Aplikasi</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] text-sm font-bold hover:bg-[#1b5e45]/20 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Lihat Panduan</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 lg:gap-5">
              <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                  <span>1</span>
                  <span className="text-[10px] opacity-75">🍃</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Scan QR di aset</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Form terbuka dengan aset dan lokasi sudah terisi. Laporan aktif untuk aset itu ikut tampil agar tidak dobel.</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                  <span>2</span>
                  <span className="text-[10px] opacity-75">🍃</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Isi dan kirim</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Unggah minimal satu foto dan tulis deskripsi singkat. Belum login? Isian disimpan, lalu Anda masuk dan laporan terkirim otomatis.</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                  <span>3</span>
                  <span className="text-[10px] opacity-75">🍃</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Diverifikasi pengelola</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Pengelola taman memeriksa laporan dan menentukan prioritas, lalu manager memutuskan perbaikan.</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                  <span>4</span>
                  <span className="text-[10px] opacity-75">🍃</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Dikerjakan, Anda diberi kabar</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Email dikirim di setiap tahap. Saat selesai, Anda menerima foto hasil perbaikan.</p>
              </div>
            </div>

            <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-4 -left-2 w-32 h-auto object-contain opacity-90 scale-x-[-1]" />
            <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-4 -right-2 w-32 h-auto object-contain opacity-90" />
          </div>

          <div className="relative overflow-hidden flex items-center justify-between h-24 px-8 rounded-2xl bg-white shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 z-10">
              <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                <Megaphone className="w-10 h-10 text-[#1b5e45] fill-[#1b5e45]/90" strokeWidth={1.5} />
                <svg viewBox="0 0 24 24" className="absolute -top-0.5 right-0 w-4 h-4 text-[#f5b800]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M12 3v4M18 6l-2.5 2.5M21 12h-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">Bersama Menjaga Taman</h3>
                <p className="text-sm text-slate-600 leading-snug mt-0.5">Laporkan, Dukung, dan Bantu Kami Merawat Fasilitas Taman.</p>
              </div>
            </div>
            <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-6 right-0 w-28 h-auto object-contain opacity-90" />
          </div>
        </section>

        <footer className="mt-auto bg-[#0a1f15] text-white px-8 lg:px-12 py-5 flex items-center justify-between text-xs">
          <span className="font-bold text-sm">GreenDesk</span>
          <span className="text-white/60">Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.</span>
        </footer>

        {/* Guide modal (shared with mobile) */}
        {isGuideOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">Panduan Pelaporan</h3>
                    <p className="text-xs text-slate-500">Langkah mudah melaporkan fasilitas</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsGuideOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors" aria-label="Tutup">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-sm text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                  <div className="w-7 h-7 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                  <div><h4 className="font-bold text-slate-900 text-sm">Temukan Fasilitas Rusak</h4><p className="text-xs text-slate-600 mt-0.5">Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.</p></div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                  <div className="w-7 h-7 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                  <div><h4 className="font-bold text-slate-900 text-sm">Pindai (Scan) QR Code</h4><p className="text-xs text-slate-600 mt-0.5">Buka menu Scan QR Code di aplikasi, lalu arahkan kamera ke kode QR aset tersebut.</p></div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                  <div className="w-7 h-7 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                  <div><h4 className="font-bold text-slate-900 text-sm">Isi Formulir Laporan</h4><p className="text-xs text-slate-600 mt-0.5">Unggah foto bukti kerusakan, pilih jenis kerusakan, dan sertakan deskripsi singkat posisi atau detail kerusakan.</p></div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                  <div className="w-7 h-7 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
                  <div><h4 className="font-bold text-slate-900 text-sm">Kirim & Pantau Progres</h4><p className="text-xs text-slate-600 mt-0.5">Kirim laporan Anda. Anda dapat memantau status pengerjaan oleh teknisi hingga selesai di halaman riwayat laporan.</p></div>
                </div>
              </div>
              <div className="pt-2">
                <button type="button" onClick={() => setIsGuideOpen(false)} className="w-full h-12 rounded-2xl bg-[#1b5e45] hover:bg-[#154a36] text-white font-semibold text-sm shadow-md transition-colors">Tutup</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
