import React from "react";
import Link from "next/link";
import { Layers, Building2, Users, History, QrCode, Shield, ArrowRight, Eye } from "lucide-react";
import type { SessionPayload } from "@/lib/auth";

interface AdminDashboardProps {
  session: SessionPayload;
  reports: any[];
  assetCount: number;
  auditCount: number;
  vendorCount: number;
  technicianCount: number;
}

export function AdminDashboard({
  session,
  reports,
  assetCount,
  auditCount,
  vendorCount,
  technicianCount,
}: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
              Admin Perusahaan
            </span>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {session.companyName}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pusat Pengelolaan Master Data & Wilayah
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Kelola struktur kawasan 5 tingkat, master aset, cetak QR code, persetujuan teknisi rekanan, dan akun staf internal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Layers className="w-4 h-4" />
            <span>Kelola Wilayah & QR</span>
          </Link>
          <Link
            href="/dashboard/vendor"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Building2 className="w-4 h-4" />
            <span>Kelola Vendor</span>
          </Link>
        </div>
      </div>

      {/* Catatan Aturan Bisnis PRD */}
      <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200/80 text-xs text-purple-900 flex items-center gap-2.5">
        <Shield className="w-4 h-4 text-purple-600 shrink-0" />
        <span>
          <strong>Aturan Bisnis PRD:</strong> Admin memiliki akses penuh atas master data, namun <em>tidak dapat</em> memverifikasi laporan atau memutuskan SPK (fungsi operasional tetap di Pengelola & Manager).
        </span>
      </div>

      {/* 2. Kartu Metrik Master Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Aset Fisik</span>
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{assetCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Struktur 5 tingkat wilayah</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Vendor & Teknisi</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{vendorCount} / {technicianCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Vendor aktif / teknisi</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Jejak Audit Data Master</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{auditCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Aktivitas tercatat permanen</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Semua Laporan Masuk</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3">{reports.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Mode pantau perusahaan</div>
        </div>
      </div>

      {/* 3. Panel Akses Cepat Modul Administrasi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">
          Modul Kerja Administrasi
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/dashboard/wilayah"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Kelola Wilayah & Aset</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Input Kawasan, Klaster, Taman, Kategori, dan data aset fisik.
            </p>
          </Link>

          <Link
            href="/dashboard/wilayah/cetak-qr"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <QrCode className="w-4 h-4 text-purple-600" />
              <span>Cetak Label QR Code</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Generate dan cetak stiker QR siap tempel di fasilitas taman.
            </p>
          </Link>

          <Link
            href="/dashboard/vendor"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Vendor & Approval Teknisi</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Daftarkan vendor rekanan dan setujui profil teknisi lapangan.
            </p>
          </Link>

          <Link
            href="/dashboard/akun"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Akun & Blokir Pengguna</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Buat akun internal staf dan blokir pelapor laporan palsu.
            </p>
          </Link>

          <Link
            href="/dashboard/audit"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <History className="w-4 h-4 text-purple-600" />
              <span>Jejak Audit Master Data</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Riwayat kronologis perubahan data yang bersifat append-only.
            </p>
          </Link>

          <Link
            href="/dashboard/laporan"
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition group"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-purple-900">
              <Eye className="w-4 h-4 text-purple-600" />
              <span>Pantau Semua Laporan</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mode lihat seluruh tiket tanpa hak modifikasi laporan operasional.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
