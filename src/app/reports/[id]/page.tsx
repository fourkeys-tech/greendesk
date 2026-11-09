"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Armchair,
  CheckCircle2,
  Mail,
  User as UserIcon,
  Wrench
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import { mockReports, mockStatusLogs } from "@/data/mock-park-data";
import { ReportStatus } from "@/types/park-asset";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReportDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const report =
    mockReports.find((r) => r.id === resolvedParams.id || r.ticketNo === resolvedParams.id) ||
    mockReports[0];

  const [reporterUser, setReporterUser] = useState(report.reporter);

  const technician = {
    name: "Budi Santoso",
    email: "teknisi.budi@vendorjaya.id",
    company: "PT Teknik Taman Jaya",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("greendesk_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name || parsed?.email) {
          setReporterUser((prev) => ({
            ...prev,
            name: parsed.name || prev.name,
            email: parsed.email || prev.email,
            avatarUrl: parsed.avatarUrl || prev.avatarUrl,
          }));
        }
      }
    } catch {}
  }, []);

  const getStepState = (currentStatus: ReportStatus) => {
    switch (currentStatus) {
      case "SELESAI":
        return 3;
      case "DIKERJAKAN":
      case "DISETUJUI":
        return 2;
      case "BARU":
      case "MENUNGGU_KEPUTUSAN":
      default:
        return 1;
    }
  };

  const activeStep = getStepState(report.status);

  return (
    <MobileContainer className="bg-[#F6F5F0] pb-8">
      <header className="p-4 bg-white border-b border-slate-100 sticky top-0 z-30 flex items-center justify-between">
        <Link
          href="/reports"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          Detail Laporan
        </h1>
        <div className="w-9" />
      </header>

      <main className="p-4 space-y-4 flex-1">
        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#283330]/10 text-[#283330] flex items-center justify-center shrink-0 border border-[#283330]/20">
              <Armchair className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                {report.ticketNo}
              </span>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {report.asset.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                ID: {report.asset.code} • {report.asset.parkName}, {report.asset.locationNote}
              </p>
            </div>
          </div>
        </section>

        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Status Penanganan
          </h3>

          <div className="relative flex items-center justify-between px-3">
            <div className="absolute left-6 right-6 top-3 h-0.5 bg-slate-200 -z-0" />
            <div
              className={`absolute left-6 top-3 h-0.5 bg-[#283330] -z-0 transition-all duration-500 ${
                activeStep === 1 ? "w-0" : activeStep === 2 ? "w-1/2" : "w-[calc(100%-3rem)]"
              }`}
            />

            <div className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  activeStep >= 1 ? "bg-[#283330] text-white ring-4 ring-[#283330]/20" : "bg-slate-200 text-slate-500"
                }`}
              >
                ✓
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Pending</span>
              <span className="text-[10px] text-slate-400">1 Nov 2026</span>
            </div>

            <div className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  activeStep >= 2 ? "bg-[#283330] text-white ring-4 ring-[#283330]/20" : "bg-slate-200 text-slate-500"
                }`}
              >
                {activeStep > 2 ? "✓" : "2"}
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">In Progress</span>
              <span className="text-[10px] text-slate-400">Diproses</span>
            </div>

            <div className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  activeStep >= 3 ? "bg-[#283330] text-white ring-4 ring-[#283330]/20" : "bg-slate-200 text-slate-500"
                }`}
              >
                3
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Completed</span>
              <span className="text-[10px] text-slate-400">Selesai</span>
            </div>
          </div>
        </section>

        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Profil Pelapor
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 border border-slate-200">
              {reporterUser.avatarUrl ? (
                <img
                  src={reporterUser.avatarUrl}
                  alt={reporterUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 leading-tight truncate">
                {reporterUser.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{reporterUser.email}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Deskripsi Kerusakan
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {report.description}
          </p>

          <div className="pt-2">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Foto Lampiran
            </span>
            <div className="grid grid-cols-2 gap-2">
              {report.photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-100 shadow-sm"
                >
                  <img
                    src={photo}
                    alt={`Lampiran ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Laporan Setelah Diperbaiki
            </h3>
            {report.status === "SELESAI" ? (
              <span className="badge badge-success text-[10px] font-semibold">
                Perbaikan Selesai
              </span>
            ) : (
              <span className="badge badge-warning text-[10px] font-semibold">
                Sedang Dikerjakan
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 border border-slate-200">
              <img
                src={technician.avatarUrl}
                alt={technician.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  Teknisi yang Mengerjakan
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {technician.company}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 leading-tight mt-0.5 truncate">
                {technician.name}
              </h4>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{technician.email}</span>
              </p>
            </div>
          </div>

          {report.status === "SELESAI" ? (
            <>
              <div className="rounded-xl overflow-hidden border border-slate-200 h-44 bg-slate-100 shadow-sm">
                <img
                  src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800"
                  alt="Foto Setelah Diperbaiki"
                  className="w-full h-full object-cover"
                />
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                Fasilitas taman telah selesai diperbaiki oleh teknisi lapangan. Struktur telah diperkuat, komponen yang longgar telah dikencangkan kembali, dan pembersihan menyeluruh telah dilakukan sehingga aman digunakan kembali oleh warga.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
                <Wrench className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-800">
                Sedang dalam perbaikan
              </span>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                Teknisi sedang menangani perbaikan fasilitas ini. Foto dan catatan hasil pekerjaan akan diperbarui saat perbaikan telah selesai.
              </p>
            </div>
          )}
        </section>

        <section className="card bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Riwayat Status
          </h3>

          <div className="space-y-4">
            {mockStatusLogs.map((log, index) => (
              <div key={log.id} className="flex gap-3 items-start relative">
                {index !== mockStatusLogs.length - 1 && (
                  <div className="absolute left-3.5 top-6 bottom-0 w-0.5 bg-slate-200 -z-0" />
                )}
                <div className="w-7 h-7 rounded-full bg-[#283330]/10 text-[#283330] border border-[#283330]/30 flex items-center justify-center shrink-0 z-10">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      {log.statusLabel}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    {log.note}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    Oleh: {log.actor}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </MobileContainer>
  );
}
