"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, ScanQrCode, Armchair, ChevronDown, Check } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import { mockReports } from "@/data/mock-park-data";
import { ReportStatus } from "@/types/park-asset";

export default function BerandaPage() {
  const parkOptions = ["Taman Eden", "Taman Perumahan A", "Taman Cluster B"];
  const [selectedPark, setSelectedPark] = useState("Taman Eden");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    <MobileContainer className="bg-[#f6f4ee]">
      {/* Header */}
      <header className="px-5 pt-8 pb-4 text-center">
        <img
          src="/images/GreenDesk.png"
          alt="GreenDesk Logo"
          className="mx-auto h-auto max-w-[130px] object-contain"
        />

        <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-black">
          Halo, Selamat Pagi!
        </h1>

        {/* Pilihan taman */}
        <div className="relative mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 text-[13px] font-medium text-slate-400"
          >
            <MapPin className="h-4 w-4 shrink-0 fill-slate-300 text-slate-300" />
            <span>{selectedPark}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""
                }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
              {parkOptions.map((park) => (
                <button
                  key={park}
                  type="button"
                  onClick={() => {
                    setSelectedPark(park);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${selectedPark === park
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
        {/* Kartu scan */}
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

        {/* Laporan terbaru */}
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

      <BottomNav />
    </MobileContainer>
  );
}