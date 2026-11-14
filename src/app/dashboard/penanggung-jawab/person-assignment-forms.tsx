"use client";

import { useState } from "react";
import { Pencil, UserCheck, X } from "lucide-react";
import { updateInternalAccountAction } from "@/app/actions/phase1-actions";
import {
  changeVendorPicAction,
  setVendorServiceAreasAction,
} from "@/app/actions/responsibility-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
const labelClass = "block font-semibold text-slate-700 mb-1 text-xs";

/* ---------------------------------------------------------------- */
/* Editor Cluster per Staf (memakai updateInternalAccountAction)     */
/* ---------------------------------------------------------------- */

export function StaffClusterEditor({
  user,
  clusters,
}: {
  user: {
    id: string;
    name: string;
    role: "PENGELOLA" | "MANAGER";
    clusterIds: string[];
  };
  clusters: Array<{ id: string; name: string; isActive: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(user.clusterIds);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    if (user.role === "PENGELOLA") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("userId", user.id);
    for (const cid of selectedIds) {
      fd.append("clusterIds", cid);
    }
    run(() => updateInternalAccountAction(fd), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setSelectedIds(user.clusterIds);
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        {open ? "Tutup" : "Atur Cluster"}
      </button>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-semibold text-slate-900">
            {user.role === "PENGELOLA"
              ? `Pilih 1 cluster untuk ${user.name}`
              : `Pilih cluster tetap untuk ${user.name}`}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {clusters.map((cl) => {
              const checked = selectedIds.includes(cl.id);
              return (
                <label
                  key={cl.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                    checked
                      ? "bg-emerald-50/70 border-emerald-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type={user.role === "PENGELOLA" ? "radio" : "checkbox"}
                    name={`staff-cluster-${user.id}`}
                    checked={checked}
                    onChange={() => toggle(cl.id)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">{cl.name}</span>
                  {!cl.isActive && (
                    <span className="text-[10px] text-slate-400">(nonaktif)</span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || selectedIds.length === 0}
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Penugasan"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Editor Area Layanan per Vendor                                    */
/* ---------------------------------------------------------------- */

export function VendorAreaEditor({
  vendorId,
  vendorName,
  currentClusterIds,
  clusters,
}: {
  vendorId: string;
  vendorName: string;
  currentClusterIds: string[];
  clusters: Array<{ id: string; name: string; isActive: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentClusterIds);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    run(() => setVendorServiceAreasAction(vendorId, selectedIds), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setSelectedIds(currentClusterIds);
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        {open ? "Tutup" : "Atur Area Layanan"}
      </button>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-semibold text-slate-900">
            Pilih area layanan untuk {vendorName} (minimal 1)
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {clusters.map((cl) => {
              const checked = selectedIds.includes(cl.id);
              return (
                <label
                  key={cl.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                    checked
                      ? "bg-emerald-50/70 border-emerald-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(cl.id)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">{cl.name}</span>
                  {!cl.isActive && (
                    <span className="text-[10px] text-slate-400">(nonaktif)</span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || selectedIds.length === 0}
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Area Layanan"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Form Ganti PIC Vendor                                             */
/* ---------------------------------------------------------------- */

export function ChangeVendorPicForm({
  vendorId,
  vendorName,
  currentPic,
  eligibleExistingPics,
}: {
  vendorId: string;
  vendorName: string;
  currentPic: { name: string; email: string } | null;
  eligibleExistingPics: Array<{ id: string; name: string; email: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(
    eligibleExistingPics.length > 0 ? "existing" : "new"
  );
  const [deactivateOldPic, setDeactivateOldPic] = useState(true);
  const { feedback, isPending, run } = useActionRunner();

  function handleSubmit(fd: FormData) {
    fd.set("vendorId", vendorId);
    fd.set("mode", mode);
    fd.set("deactivateOldPic", deactivateOldPic ? "true" : "false");
    run(() => changeVendorPicAction(fd), {
      confirmText: `Ganti PIC vendor "${vendorName}"? PIC baru akan langsung menerima seluruh SPK aktif dan notifikasi vendor ini.`,
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
      >
        {open ? <X className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
        {open ? "Tutup Ganti PIC" : "Ganti PIC Vendor"}
      </button>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <form
          action={handleSubmit}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5 text-xs"
        >
          <div>
            <div className="font-bold text-slate-900">
              Ganti PIC untuk {vendorName}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              PIC saat ini: <strong>{currentPic ? `${currentPic.name} (${currentPic.email})` : "belum ada"}</strong>.
              Satu akun hanya boleh menjadi PIC untuk satu vendor.
            </p>
          </div>

          <div className="flex gap-4 border-b border-slate-200 pb-2">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="picModeChoice"
                value="existing"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Pilih akun yang sudah ada
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800">
              <input
                type="radio"
                name="picModeChoice"
                value="new"
                checked={mode === "new"}
                onChange={() => setMode("new")}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Buat akun PIC baru
            </label>
          </div>

          {mode === "existing" ? (
            <div>
              <label className={labelClass} htmlFor={`pic-user-${vendorId}`}>
                Akun PIC yang tersedia
              </label>
              {eligibleExistingPics.length === 0 ? (
                <p className="text-slate-500 text-xs">
                  Tidak ada akun PIC aktif lain yang belum memegang vendor. Silakan pilih opsi &quot;Buat akun PIC baru&quot;.
                </p>
              ) : (
                <select
                  id={`pic-user-${vendorId}`}
                  name="picUserId"
                  required
                  className={inputClass}
                >
                  <option value="">-- Pilih akun PIC --</option>
                  {eligibleExistingPics.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor={`new-pic-name-${vendorId}`}>
                  Nama lengkap PIC baru
                </label>
                <input
                  id={`new-pic-name-${vendorId}`}
                  name="picName"
                  type="text"
                  required
                  placeholder="Mis. Ahmad Sobari"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`new-pic-email-${vendorId}`}>
                  Email PIC baru
                </label>
                <input
                  id={`new-pic-email-${vendorId}`}
                  name="picEmail"
                  type="email"
                  required
                  placeholder="ahmad@vendor.id"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor={`new-pic-pass-${vendorId}`}>
                  Kata sandi awal (opsional)
                </label>
                <input
                  id={`new-pic-pass-${vendorId}`}
                  name="picPassword"
                  type="password"
                  minLength={6}
                  placeholder="Kosongkan untuk sandi acak otomatis + email undangan"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {currentPic && (
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={deactivateOldPic}
                onChange={(e) => setDeactivateOldPic(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-700">
                Nonaktifkan akun PIC lama (<strong>{currentPic.name}</strong>) bila tidak merangkap sebagai Teknisi.
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending || (mode === "existing" && eligibleExistingPics.length === 0)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan PIC Baru"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
