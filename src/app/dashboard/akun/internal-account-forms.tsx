"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createInternalAccountAction,
  setInternalAccountActiveAction,
  setUserBlockStatusAction,
  updateInternalAccountAction,
} from "@/app/actions/phase1-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

type ClusterOption = { id: string; name: string; isActive: boolean };

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
const labelClass = "block font-semibold text-slate-700 mb-1 text-xs";

/* ---------------------------------------------------------------- */
/* Buat akun Pengelola / Manager                                     */
/* ---------------------------------------------------------------- */
export function CreateStaffForm({ clusters }: { clusters: ClusterOption[] }) {
  const activeClusters = clusters.filter((c) => c.isActive);
  const [selectedRole, setSelectedRole] = useState<"PENGELOLA" | "MANAGER">(
    "PENGELOLA"
  );
  const [formKey, setFormKey] = useState(0);
  const { feedback, isPending, run } = useActionRunner();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          Tambah akun Pengelola / Manager
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Pengelola ditautkan ke tepat satu cluster. Manager bisa memegang satu
          atau beberapa cluster.
        </p>
      </div>
      <FeedbackBanner feedback={feedback} />
      <form
        key={formKey}
        action={(fd) =>
          run(() => createInternalAccountAction(fd), {
            onSuccess: () => setFormKey((k) => k + 1),
          })
        }
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div>
          <label className={labelClass} htmlFor="staff-role">
            Role
          </label>
          <select
            id="staff-role"
            name="role"
            value={selectedRole}
            onChange={(e) =>
              setSelectedRole(e.target.value as "PENGELOLA" | "MANAGER")
            }
            className={inputClass}
          >
            <option value="PENGELOLA">Pengelola Cluster (1 cluster)</option>
            <option value="MANAGER">Manager (1 atau lebih cluster)</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="staff-name">
            Nama lengkap
          </label>
          <input
            id="staff-name"
            type="text"
            name="name"
            required
            placeholder="Mis. Bambang Pamungkas"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="staff-email">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            name="email"
            required
            placeholder="nama@perusahaan.id"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="staff-password">
            Kata sandi awal (opsional)
          </label>
          <input
            id="staff-password"
            type="password"
            name="password"
            minLength={6}
            placeholder="Kosongkan untuk sandi acak otomatis (tampil sekali)"
            className={inputClass}
          />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>
            {selectedRole === "PENGELOLA"
              ? "Cluster penugasan (pilih satu)"
              : "Cluster yang dipegang (boleh lebih dari satu)"}
          </legend>
          {activeClusters.length === 0 ? (
            <p className="text-xs text-rose-700">
              Belum ada cluster aktif. Tambahkan cluster di menu Wilayah.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeClusters.map((cl, idx) => (
                <label
                  key={cl.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 cursor-pointer text-xs"
                >
                  <input
                    type={selectedRole === "PENGELOLA" ? "radio" : "checkbox"}
                    name="clusterIds"
                    value={cl.id}
                    defaultChecked={idx === 0}
                  />
                  <span className="font-medium text-slate-800">{cl.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending || activeClusters.length === 0}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {isPending ? "Menyimpan..." : "Buat akun"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Aksi per baris akun staf: edit nama/cluster & aktif/nonaktif      */
/* ---------------------------------------------------------------- */
export function StaffRowActions({
  user,
  clusters: _clusters,
  isSelf,
}: {
  user: {
    id: string;
    name: string;
    role: "PENGELOLA" | "MANAGER";
    isActive: boolean;
    clusterIds: string[];
  };
  clusters: ClusterOption[];
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { feedback, isPending, run } = useActionRunner();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          {editing ? "Tutup" : "Edit Nama"}
        </button>
        <Link
          href="/dashboard/penanggung-jawab?tab=manager&view=orang"
          className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
        >
          Atur Cluster →
        </Link>
        {!isSelf && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => setInternalAccountActiveAction(user.id, !user.isActive), {
                confirmText: user.isActive
                  ? `Nonaktifkan akun ${user.name}? Akun tidak bisa login sampai diaktifkan lagi.${
                      user.role === "MANAGER"
                        ? " Delegasi sementara miliknya yang masih berjalan ikut dibatalkan."
                        : ""
                    }`
                  : `Aktifkan kembali akun ${user.name}?`,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 ${
              user.isActive
                ? "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {isPending ? "Memproses..." : user.isActive ? "Nonaktifkan" : "Aktifkan"}
          </button>
        )}
      </div>

      {editing && (
        <form
          action={(fd) =>
            run(() => updateInternalAccountAction(fd), {
              onSuccess: () => setEditing(false),
            })
          }
          className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
        >
          <input type="hidden" name="userId" value={user.id} />
          <div>
            <label className={labelClass} htmlFor={`name-${user.id}`}>
              Nama lengkap
            </label>
            <input
              id={`name-${user.id}`}
              name="name"
              defaultValue={user.name}
              required
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Penugasan cluster untuk akun ini dikelola di menu{" "}
            <Link
              href="/dashboard/penanggung-jawab?tab=manager&view=orang"
              className="text-emerald-700 font-semibold underline"
            >
              Penanggung Jawab
            </Link>
            .
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan nama"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}
      <FeedbackBanner feedback={feedback} compact />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Blokir / buka blokir pelapor                                      */
/* ---------------------------------------------------------------- */
export function ReporterBlockActions({
  userId,
  name,
  isBlocked,
}: {
  userId: string;
  name: string;
  isBlocked: boolean;
}) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const { feedback, isPending, run } = useActionRunner();

  if (isBlocked) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(() => setUserBlockStatusAction(userId, false), {
              confirmText: `Buka blokir akun ${name}? Pengguna bisa login dan melapor lagi.`,
            })
          }
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
        >
          {isPending ? "Memproses..." : "Buka blokir"}
        </button>
        <FeedbackBanner feedback={feedback} compact />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {!showReason ? (
        <button
          type="button"
          onClick={() => setShowReason(true)}
          className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer"
        >
          Blokir
        </button>
      ) : (
        <div className="space-y-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200">
          <label className={labelClass} htmlFor={`block-reason-${userId}`}>
            Alasan pemblokiran (wajib)
          </label>
          <textarea
            id={`block-reason-${userId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Mis. Berulang kali mengirim laporan palsu"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || reason.trim().length === 0}
              onClick={() =>
                run(() => setUserBlockStatusAction(userId, true, reason), {
                  confirmText: `Blokir akun ${name}? Pengguna langsung keluar dan tidak bisa login.`,
                  onSuccess: () => {
                    setShowReason(false);
                    setReason("");
                  },
                })
              }
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {isPending ? "Memproses..." : "Konfirmasi blokir"}
            </button>
            <button
              type="button"
              onClick={() => setShowReason(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
      <FeedbackBanner feedback={feedback} compact />
    </div>
  );
}
