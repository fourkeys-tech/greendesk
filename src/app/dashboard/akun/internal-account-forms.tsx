"use client";

import { useMemo, useState } from "react";
import {
  assignTemporaryManagerAction,
  cancelTemporaryManagerAction,
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
  clusters,
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
  const selectable = clusters.filter(
    (c) => c.isActive || user.clusterIds.includes(c.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          {editing ? "Tutup" : "Edit"}
        </button>
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
              Nama
            </label>
            <input
              id={`name-${user.id}`}
              name="name"
              defaultValue={user.name}
              required
              className={inputClass}
            />
          </div>
          <fieldset>
            <legend className={labelClass}>
              {user.role === "PENGELOLA" ? "Cluster (pilih satu)" : "Cluster tetap"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {selectable.map((cl) => (
                <label
                  key={cl.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs cursor-pointer"
                >
                  <input
                    type={user.role === "PENGELOLA" ? "radio" : "checkbox"}
                    name="clusterIds"
                    value={cl.id}
                    defaultChecked={user.clusterIds.includes(cl.id)}
                  />
                  {cl.name}
                  {!cl.isActive && (
                    <span className="text-[10px] text-slate-500">(nonaktif)</span>
                  )}
                </label>
              ))}
            </div>
            {user.role === "MANAGER" && (
              <p className="text-[11px] text-slate-500 mt-1">
                Delegasi sementara tidak ikut berubah. Kelola di tab Delegasi
                Manager.
              </p>
            )}
          </fieldset>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {isPending ? "Menyimpan..." : "Simpan perubahan"}
          </button>
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

/* ---------------------------------------------------------------- */
/* Delegasi Manager pengganti sementara                              */
/* ---------------------------------------------------------------- */
export function DelegationForm({
  managers,
  clusters,
  permanentClusterIdsByManager,
  defaultFrom,
  defaultUntil,
}: {
  managers: Array<{ id: string; name: string; email: string }>;
  clusters: ClusterOption[];
  permanentClusterIdsByManager: Record<string, string[]>;
  defaultFrom: string;
  defaultUntil: string;
}) {
  const [replacedId, setReplacedId] = useState(managers[0]?.id ?? "");
  const [formKey, setFormKey] = useState(0);
  const { feedback, isPending, run } = useActionRunner();

  const replacedClusters = useMemo(() => {
    const ids = permanentClusterIdsByManager[replacedId] ?? [];
    return clusters.filter((c) => c.isActive && ids.includes(c.id));
  }, [clusters, permanentClusterIdsByManager, replacedId]);
  const [clusterId, setClusterId] = useState("");
  const effectiveClusterId = replacedClusters.some((c) => c.id === clusterId)
    ? clusterId
    : replacedClusters[0]?.id ?? "";

  const substitutes = managers.filter(
    (m) =>
      m.id !== replacedId &&
      !(permanentClusterIdsByManager[m.id] ?? []).includes(effectiveClusterId)
  );

  const disabled =
    isPending ||
    managers.length < 2 ||
    replacedClusters.length === 0 ||
    substitutes.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          Tunjuk Manager pengganti sementara
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Saat Manager berhalangan, tunjuk Manager lain untuk memegang
          cluster-nya selama periode tertentu. Setiap penunjukan tersimpan di
          riwayat.
        </p>
      </div>
      <FeedbackBanner feedback={feedback} />
      {managers.length < 2 ? (
        <p className="text-xs text-slate-600">
          Butuh minimal 2 akun Manager aktif untuk membuat delegasi.
        </p>
      ) : (
        <form
          key={formKey}
          action={(fd) =>
            run(() => assignTemporaryManagerAction(fd), {
              onSuccess: () => setFormKey((k) => k + 1),
            })
          }
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className={labelClass} htmlFor="del-replaced">
              Manager yang berhalangan
            </label>
            <select
              id="del-replaced"
              name="replacedManagerId"
              required
              value={replacedId}
              onChange={(e) => setReplacedId(e.target.value)}
              className={inputClass}
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="del-cluster">
              Cluster yang digantikan
            </label>
            <select
              id="del-cluster"
              name="clusterId"
              required
              value={effectiveClusterId}
              onChange={(e) => setClusterId(e.target.value)}
              className={inputClass}
            >
              {replacedClusters.length === 0 && (
                <option value="">Manager ini tidak memegang cluster tetap</option>
              )}
              {replacedClusters.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="del-substitute">
              Manager pengganti
            </label>
            <select
              id="del-substitute"
              name="substituteManagerId"
              required
              className={inputClass}
            >
              {substitutes.length === 0 && (
                <option value="">Tidak ada Manager lain yang bisa ditunjuk</option>
              )}
              {substitutes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="del-from">
              Mulai (WIB)
            </label>
            <input
              id="del-from"
              type="date"
              name="validFrom"
              defaultValue={defaultFrom}
              min={defaultFrom}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="del-until">
              Sampai (WIB, termasuk hari itu)
            </label>
            <input
              id="del-until"
              type="date"
              name="validUntil"
              defaultValue={defaultUntil}
              min={defaultFrom}
              required
              className={inputClass}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={disabled}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan penunjukan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CancelDelegationButton({
  assignmentId,
  label,
}: {
  assignmentId: string;
  label: string;
}) {
  const { feedback, isPending, run } = useActionRunner();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(() => cancelTemporaryManagerAction(assignmentId), {
            confirmText: `Batalkan delegasi ${label}? Riwayatnya tetap tersimpan.`,
          })
        }
        className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-semibold cursor-pointer"
      >
        {isPending ? "Memproses..." : "Batalkan"}
      </button>
      <FeedbackBanner feedback={feedback} compact />
    </div>
  );
}
