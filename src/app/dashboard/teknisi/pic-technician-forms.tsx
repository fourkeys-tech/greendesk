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
  deactivationReason,
  reactivationRequested = false,
}: {
  technicianId: string;
  currentStatus: TechnicianStatus;
  deactivationReason?: string | null;
  reactivationRequested?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleChange(newStatus: TechnicianStatus) {
    if (newStatus === "ACTIVE" && deactivationReason === "AUTO_60_DAYS") {
      setShowRequestModal(true);
      return;
    }

    startTransition(async () => {
      const res = await updateTechnicianStatusAction(technicianId, newStatus);
      if (res.error) {
        setFeedback(res.error);
      }
    });
  }

  function handleReactivateRequest(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { requestTechnicianReactivationAction } = await import(
        "@/app/actions/phase2-actions"
      );
      const res = await requestTechnicianReactivationAction(
        technicianId,
        note
      );
      if (res.error) {
        setFeedback(res.error);
      } else {
        setShowRequestModal(false);
      }
    });
  }

  return (
    <div className="space-y-1">
      {feedback && (
        <div className="text-[10px] text-rose-600 font-semibold">{feedback}</div>
      )}

      {currentStatus === "INACTIVE" && deactivationReason === "AUTO_60_DAYS" && (
        <div className="flex items-center gap-2">
          {reactivationRequested ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              ⏳ Menunggu Persetujuan Admin
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition"
            >
              Ajukan Aktif Kembali ke Admin
            </button>
          )}
        </div>
      )}

      {(!deactivationReason || deactivationReason === "MANUAL_BY_PIC" || currentStatus === "ON_LEAVE" || currentStatus === "ACTIVE") && (
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
      )}

      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-sm text-slate-900">
              Ajukan Pengaktifan Kembali Teknisi (60 Hari)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuai PRD v0.2 Bagian 5.3, teknisi yang dinonaktifkan otomatis oleh sistem karena tidak aktif selama 60 hari memerlukan persetujuan ulang dari Admin.
            </p>
            <form onSubmit={handleReactivateRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan untuk Admin (Opsional):
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mis. Teknisi telah kembali bertugas aktif dan siap menerima penugasan SPK..."
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  {isPending ? "Mengajukan..." : "Kirim Pengajuan ke Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

