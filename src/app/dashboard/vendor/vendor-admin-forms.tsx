"use client";

import { useState, useTransition } from "react";
import {
  approveOrRejectTechnicianAction,
  createVendorAction,
  runPhase2MaintenanceCronAction,
} from "@/app/actions/phase2-actions";

interface VendorAdminFormsProps {
  clusters: Array<{ id: string; name: string }>;
  pendingTechnicians: Array<{
    id: string;
    fullName: string;
    email: string;
    whatsapp: string;
    skills: string[];
    vendorName: string;
    createdAt: string;
  }>;
}

export function VendorAdminForms({
  clusters,
  pendingTechnicians,
}: VendorAdminFormsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreateVendor(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const res = await createVendorAction(formData);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
        setShowCreateForm(false);
      }
    });
  }

  function handleDecision(techId: string, decision: "APPROVED" | "REJECTED") {
    setFeedback(null);
    startTransition(async () => {
      const res = await approveOrRejectTechnicianAction(techId, decision);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
      }
    });
  }

  function handleRunCron() {
    setFeedback(null);
    startTransition(async () => {
      const res = await runPhase2MaintenanceCronAction();
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
      }
    });
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Antrean Persetujuan Teknisi Baru (Kriteria Penerimaan Fase 2) */}
      {pendingTechnicians.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase text-amber-900">
                🔔 {pendingTechnicians.length} Teknisi Baru Menunggu Persetujuan
                Admin
              </span>
              <p className="text-xs text-amber-800 mt-0.5">
                Sesuai PRD Fase 2, akun teknisi baru belum bisa login atau
                ditunjuk ke SPK sebelum disetujui Admin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTechnicians.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-xl p-4 border border-amber-200 flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    {t.fullName}
                  </div>
                  <div className="text-slate-600">
                    Vendor: <strong>{t.vendorName}</strong>
                  </div>
                  <div className="text-slate-500 font-mono">
                    {t.email} · WA: {t.whatsapp}
                  </div>
                  <div className="text-slate-600 mt-1">
                    Keahlian: {t.skills.join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDecision(t.id, "APPROVED")}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    ✓ Setujui Teknisi
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDecision(t.id, "REJECTED")}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold cursor-pointer"
                  >
                    ✕ Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel Aksi Admin: Input Vendor Baru & Job Terjadwal 60 Hari / 3 Bulan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Panel Admin Fase 2: Onboarding Vendor, Akun PIC & Job Otomatis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Input vendor rekanan baru beserta akun PIC Vendor (otomatis kirim
              email undangan) atau jalankan pemeriksaan berkala teknisi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleRunCron}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              ⏱️ Jalankan Job Cek 60 Hari & 3 Bulan
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              {showCreateForm
                ? "Tutup Form Vendor"
                : "+ Input Vendor Baru & Buat Akun PIC"}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form
            action={handleCreateVendor}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
          >
            <div className="sm:col-span-2 lg:col-span-3 font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
              1. Data Perusahaan Vendor & Kontrak
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Perusahaan Vendor
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Mis. CV Karya Hijau Mandiri"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Jenis Vendor (PRD Bagian 4)
              </label>
              <select
                name="type"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="EXTERNAL">
                  Eksternal (Perusahaan Vendor Rekanan)
                </option>
                <option value="INTERNAL">
                  Internal (Tim Teknisi Internal Pengelola)
                </option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Keahlian Vendor (pisahkan koma)
              </label>
              <input
                type="text"
                name="skills"
                required
                placeholder="Kelistrikan, Sipil, Tanaman, Besi"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Skema Kerja Sama
              </label>
              <input
                type="text"
                name="cooperationScheme"
                placeholder="Mis. Kontrak Payung Tahunan / Per SPK"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Masa Kontrak Mulai
              </label>
              <input
                type="date"
                name="contractStart"
                defaultValue="2026-01-01"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Masa Kontrak Berakhir
              </label>
              <input
                type="date"
                name="contractEnd"
                defaultValue="2027-01-01"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Masa Garansi Pekerjaan (Hari)
              </label>
              <input
                type="number"
                name="warrantyDays"
                defaultValue={30}
                min={1}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor NPWP
              </label>
              <input
                type="text"
                name="npwp"
                placeholder="01.234.567.8-999.000"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Alamat Kantor Vendor
              </label>
              <input
                type="text"
                name="address"
                placeholder="Jl. Raya Serpong No. 45"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1.5">
                Area Layanan per Cluster (Pilih minimal 1 cluster):
              </label>
              {clusters.length === 0 ? (
                <div className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Belum ada Cluster di perusahaan ini. Buat Cluster terlebih
                  dahulu di menu Wilayah.
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {clusters.map((cl, idx) => (
                    <label
                      key={cl.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="clusterIds"
                        value={cl.id}
                        defaultChecked={idx === 0}
                      />
                      <span className="font-medium text-slate-800">
                        {cl.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-3 font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 pt-2">
              2. Akun PIC Vendor (Menerima Email Undangan & SPK)
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Lengkap PIC Vendor
              </label>
              <input
                type="text"
                name="picName"
                required
                placeholder="Mis. Hendra Gunawan"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email PIC Vendor (Untuk Login & Undangan)
              </label>
              <input
                type="email"
                name="picEmail"
                required
                placeholder="pic@karyahijau.id"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Awal PIC (Opsional)
              </label>
              <input
                type="password"
                name="picPassword"
                placeholder="Kosongkan untuk default .env"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 pt-2">
              <button
                type="submit"
                disabled={isPending || clusters.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {isPending
                  ? "Menyimpan..."
                  : "Simpan Vendor, Buat Akun PIC & Kirim Email Undangan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

