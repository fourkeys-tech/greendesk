"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  ScanQrCode,
  Armchair,
  ChevronDown,
  Check,
  BookOpen,
  ArrowRight,
  X
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { mockReports } from "@/data/mock-park-data";
import { ReportStatus } from "@/types/park-asset";

export default function BerandaPage() {
  const parkOptions = ["Taman Eden", "Taman Perumahan A", "Taman Cluster B"];
  const [selectedPark, setSelectedPark] = useState("Taman Eden");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const getStatusBadge = (status: ReportStatus) => {
    const base =
      "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-white leading-none";
    switch (status) {
      case "SELESAI":
        return <span className={`${base} bg-[#6fcf7a]`}>Selesai</span>;
      case "DIKERJAKAN":
      case "DISETUJUI":
        return <span className={`${base} bg-[#3b9de0]`}>Dikerjakan</span>;
      case "MENUNGGU_KEPUTUSAN":
      case "BARU":
      default:
        return <span className={`${base} bg-[#e8a000]`}>Pending</span>;
    }
  };

  return (
    <MobileContainer className="bg-[#F6F5F0]">
      <header className="px-5 pt-8 pb-4 text-center">
        <img
          src="/images/GreenDesk.png"
          alt="GreenDesk Logo"
          className="mx-auto h-auto max-w-[130px] object-contain"
        />

        <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-black">
          Halo, Selamat Pagi!
        </h1>

        <div className="relative mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a55]"
          >
            <MapPin className="h-3.5 w-3.5 text-[#1f7a55]" />
            <span>{selectedPark}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-30">
              {parkOptions.map((park) => (
                <button
                  key={park}
                  type="button"
                  onClick={() => {
                    setSelectedPark(park);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    selectedPark === park
                      ? "bg-[#283330] font-bold text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{park}</span>
                  {selectedPark === park && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-32">
        <section className="rounded-3xl border border-[#2f8f5b] bg-[#272727] px-5 py-6 text-center shadow-lg">
          <ScanQrCode className="mx-auto h-16 w-16 text-white" strokeWidth={2} />

          <h2 className="mt-3 text-base font-extrabold text-white">
            Laporan Kerusakan
          </h2>
          <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-snug text-slate-300">
            Scan QR code pada fasilitas taman untuk melaporkan kerusakan.
          </p>

          <Link
            href="/scan"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#66d36e] py-2.5 text-sm font-extrabold text-[#1f2a27] transition-transform active:scale-[0.98]"
          >
            <ScanQrCode className="h-5 w-5" strokeWidth={2.4} />
            <span>Scan QR Code</span>
          </Link>
        </section>

        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="w-full rounded-2xl bg-white p-4 shadow-sm border border-slate-200/80 flex items-center gap-3.5 transition-transform active:scale-[0.98] text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Panduan / Cara Laporan
            </h3>
            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
              Pelajari 4 langkah mudah melaporkan fasilitas rusak
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#1b5e45] shrink-0" />
        </button>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-black">Laporan Terbaru</h3>
            <Link
              href="/reports"
              className="text-xs font-medium text-black underline underline-offset-2"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-3">
            {mockReports.slice(0, 3).map((report) => {
              const photo = (report as { photoUrl?: string }).photoUrl;

              return (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-2.5 shadow-sm transition-shadow hover:shadow"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {photo ? (
                      <img
                        src={photo}
                        alt={report.asset.name}
                        className="h-[52px] w-[52px] shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-[#dff1e7] text-[#1f7a55]">
                        <Armchair className="h-7 w-7" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <span className="block text-[11px] font-bold leading-none text-[#1f7a55]">
                        {report.ticketNo}
                      </span>
                      <h4 className="mt-1 truncate text-[13px] font-extrabold leading-tight text-black">
                        {report.asset.name}
                      </h4>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {report.asset.locationNote} • {report.createdAt}
                      </p>
                    </div>
                  </div>

                  {getStatusBadge(report.status)}
                </Link>
              );
            })}
          </div>
        </section>
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
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
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

      <BottomNav />
    </MobileContainer>
  );
}
