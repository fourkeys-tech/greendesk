"use client";

import { useState } from "react";
import { Pencil, Power, RotateCcw, UserX, X } from "lucide-react";
import {
  approveTechnicianReactivationAction,
  deactivateTechnicianByAdminAction,
  setVendorActiveAction,
  updateVendorAction,
} from "@/app/actions/phase2-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";
import {
  VendorFormFields,
  type VendorClusterOption,
  type VendorFormDefaults,
} from "./vendor-form-fields";

/** Aksi Admin per vendor: edit data & aktif/nonaktif. */
export function VendorManagePanel({
  vendorId,
  vendorName,
  isActive,
  clusters,
  defaults,
}: {
  vendorId: string;
  vendorName: string;
  isActive: boolean;
  clusters: VendorClusterOption[];
  defaults: VendorFormDefaults;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { feedback, isPending, run } = useActionRunner();

  function handleSubmit(fd: FormData) {
    fd.set("vendorId", vendorId);
    run(() => updateVendorAction(fd), {
      onSuccess: () => setIsEditing(false),
    });
  }

  function toggleActive() {
    run(() => setVendorActiveAction(vendorId, !isActive), {
      confirmText: isActive
        ? `Nonaktifkan vendor "${vendorName}"? Vendor tidak akan muncul lagi di pilihan SPK baru. Ditolak bila masih ada SPK berjalan.`
        : `Aktifkan kembali vendor "${vendorName}"?`,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          aria-expanded={isEditing}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-semibold cursor-pointer"
        >
          {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {isEditing ? "Tutup Edit" : "Edit Data Vendor"}
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 cursor-pointer ${
            isActive
              ? "border border-rose-300 text-rose-700 hover:bg-rose-50"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {isActive ? "Nonaktifkan Vendor" : "Aktifkan Vendor"}
        </button>
      </div>

      <FeedbackBanner feedback={feedback} />

      {isEditing && (
        <form
          action={handleSubmit}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
        >
          <VendorFormFields
            idPrefix={`edit-vendor-${vendorId}`}
            clusters={clusters}
            defaults={defaults}
          />
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-white font-semibold cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Admin mengaktifkan kembali teknisi nonaktif (tanpa menunggu pengajuan PIC). */
export function TechnicianReactivateButton({
  technicianId,
  technicianName,
}: {
  technicianId: string;
  technicianName: string;
}) {
  const { feedback, isPending, run } = useActionRunner();

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(() => approveTechnicianReactivationAction(technicianId), {
            confirmText: `Aktifkan kembali ${technicianName}? Teknisi bisa login dan menerima SPK lagi.`,
          })
        }
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-[11px] font-semibold cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        {isPending ? "Memproses..." : "Aktifkan Kembali"}
      </button>
      <FeedbackBanner feedback={feedback} compact />
    </div>
  );
}

/** Admin menonaktifkan teknisi (wajib alasan). */
export function TechnicianDeactivateButton({
  technicianId,
  technicianName,
}: {
  technicianId: string;
  technicianName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { feedback, setFeedback, isPending, run } = useActionRunner();

  function submit() {
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setFeedback({ type: "error", text: "Isi alasan penonaktifan terlebih dahulu." });
      return;
    }
    run(() => deactivateTechnicianByAdminAction(technicianId, cleanReason), {
      confirmText: `Nonaktifkan ${technicianName}? Teknisi tidak bisa login atau menerima SPK sampai diaktifkan kembali oleh Admin.`,
      onSuccess: () => {
        setIsOpen(false);
        setReason("");
      },
    });
  }

  if (!isOpen) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setFeedback(null);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
        >
          <UserX className="w-3 h-3" />
          Nonaktifkan
        </button>
        <FeedbackBanner feedback={feedback} compact />
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      <label
        htmlFor={`deactivate-reason-${technicianId}`}
        className="block text-[11px] font-bold text-slate-700"
      >
        Alasan penonaktifan
      </label>
      <textarea
        id={`deactivate-reason-${technicianId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] focus:border-rose-500 focus:outline-hidden"
      />
      <FeedbackBanner feedback={feedback} compact />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
        >
          {isPending ? "Memproses..." : "Nonaktifkan"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setReason("");
            setFeedback(null);
          }}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
