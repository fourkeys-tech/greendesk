"use client";

import { useState, useTransition } from "react";
import type { TechnicianStatus } from "@prisma/client";
import {
  confirmTechnicianRosterAction,
  registerTechnicianAction,
  updateTechnicianStatusAction,
} from "@/app/actions/phase2-actions";

export function PicTechnicianForms({
  vendorName,
  lastConfirmedAt,
}: {
  vendorName: string;
  lastConfirmedAt: string | null;
}) {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegister(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const res = await registerTechnicianAction(formData);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
      }
    });
  }

  function handleConfirmRoster() {
    setFeedback(null);
    startTransition(async () => {
      const res = await confirmTechnicianRosterAction();
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setFeedback({ type: "success", text: res.message });
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Panel PIC Vendor ({vendorName}): Daftarkan Teknisi Baru
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Teknisi baru akan berstatus <strong>PENDING</strong> dan menunggu
            persetujuan Admin sebelum dapat login atau menerima SPK.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirmRoster}
            className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-semibold cursor-pointer"
          >
            ✓ Konfirmasi Daftar Teknisi 3 Bulanan (Terakhir:{" "}
            {lastConfirmedAt
              ? new Date(lastConfirmedAt).toLocaleDateString("id-ID")
              : "Belum"}
            )
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form
        action={handleRegister}
        className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
      >
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Nama Lengkap Teknisi
          </label>
          <input
            type="text"
            name="fullName"
            required
            placeholder="Mis. Dedi Kurniawan"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Nomor WhatsApp
          </label>
          <input
            type="text"
            name="whatsapp"
            required
            placeholder="081298765432"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Email Teknisi (Untuk Login)
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="dedi@vendorjaya.id"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Keahlian (pisahkan koma)
          </label>
          <input
            type="text"
            name="skills"
            required
            placeholder="Kelistrikan, Las Besi, Kayu"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Foto Wajah Teknisi (Opsional)
          </label>
          <input
            type="file"
            name="facePhoto"
            accept="image/jpeg,image/png,image/webp"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
          >
            {isPending
              ? "Mendaftarkan..."
              : "Daftarkan Teknisi (Kirim ke Admin)"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TechnicianStatusSelect({
  technicianId,
  currentStatus,
}: {
  technicianId: string;
  currentStatus: TechnicianStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: TechnicianStatus) {
    startTransition(async () => {
      await updateTechnicianStatusAction(technicianId, newStatus);
    });
  }

  return (
    <select
      disabled={isPending}
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value as TechnicianStatus)}
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
    >
      <option value="ACTIVE">ACTIVE (Siap Tugas)</option>
      <option value="ON_LEAVE">ON_LEAVE (Cuti)</option>
      <option value="INACTIVE">INACTIVE (Nonaktif)</option>
    </select>
  );
}

