import React from "react";
import Link from "next/link";
import { PlusCircle, FileText, CheckCircle2, Clock, QrCode, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { SessionPayload } from "@/lib/auth";

interface CitizenDashboardProps {
  session: SessionPayload;
  reports: any[];
}

export function CitizenDashboard({ session, reports }: CitizenDashboardProps) {
  const baruCount = reports.filter((r) => r.status === "BARU").length;
  const inProgressCount = reports.filter(
    (r) =>
      r.status === "MENUNGGU_KEPUTUSAN" ||
      r.status === "DISETUJUI" ||
      r.status === "DIKERJAKAN" ||
      r.status === "MENUNGGU_KONFIRMASI"
  ).length;
  const selesaiCount = reports.filter((r) => r.status === "SELESAI").length;

  return (
    <div className="space-y-6">
      {/* 1. Hero Card Khusus Warga / Pengguna */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-semibold border border-emerald-400/30">
            Portal Warga & Pengunjung
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Halo, {session.name}!
          </h1>
          <p className="text-emerald-100/90 text-sm leading-relaxed">
            Menemukan fasilitas taman seperti lampu mati, ayunan rusak, atau bangku patah? Laporkan di sini secara langsung agar segera ditangani oleh tim teknisi.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard/lapor"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-sm transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>Buat Laporan Sekarang</span>
            </Link>
            <Link
              href="/dashboard/laporan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-900/50 hover:bg-emerald-900/70 text-white border border-emerald-500/40 font-semibold text-sm transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Lihat Laporan Saya ({reports.length})</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Laporan Terkirim (Baru)</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{baruCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Menunggu verifikasi pengelola klaster
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Sedang Ditangani (Proses)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{inProgressCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dalam tahap SPK & perbaikan teknisi
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Selesai Diperbaiki</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-3">{selesaiCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Fasilitas telah diperbaiki & dikonfirmasi
          </div>
        </div>
      </div>

      {/* 3. Cara Kerja / Panduan Pelaporan Ringkas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-emerald-600" />
          <span>Cara Cepat Melapor via QR Code</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              1
            </div>
            <div className="font-bold text-slate-800">Scan QR di Fasilitas</div>
            <p className="text-slate-500 text-[11px]">
              Setiap lampu taman, ayunan, atau bangku memiliki stiker QR Code resmi GreenPark.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              2
            </div>
            <div className="font-bold text-slate-800">Foto & Kirim Laporan</div>
            <p className="text-slate-500 text-[11px]">
              Pilih jenis kerusakan, foto bukti kondisi fasilitas, dan kirimkan laporan Anda.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              3
            </div>
            <div className="font-bold text-slate-800">Pantau Perbaikan</div>
            <p className="text-slate-500 text-[11px]">
              Pantau progres perbaikan dari status Baru hingga teknisi menyelesaikan pekerjaan.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Daftar Laporan Saya Terkini */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Laporan Kerusakan Terkini Anda
          </h2>
          <Link
            href="/dashboard/laporan"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            <span>Semua Laporan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-700">
              Belum ada riwayat laporan
            </div>
            <p className="text-[11px] text-slate-500">
              Laporan yang Anda buat akan muncul di sini beserta status penanganannya.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {r.ticketNo}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {r.asset?.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {r.asset?.park?.name} · {new Date(r.createdAt).toLocaleDateString("id-ID")}
                  </div>
                </div>

                <Link
                  href="/dashboard/laporan"
                  className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-xs font-semibold text-slate-700 transition"
                >
                  Lihat Status →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
