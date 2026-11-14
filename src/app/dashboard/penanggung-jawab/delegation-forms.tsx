"use client";

import { useMemo, useState } from "react";
import {
  assignTemporaryManagerAction,
  cancelTemporaryManagerAction,
} from "@/app/actions/phase1-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

type ClusterOption = { id: string; name: string; isActive: boolean };

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
const labelClass = "block font-semibold text-slate-700 mb-1 text-xs";

export function DelegationForm({
  managers,
  clusters,
  permanentClusterIdsByManager,
  defaultFrom,
  defaultUntil,
  defaultClusterId,
}: {
  managers: Array<{ id: string; name: string; email: string }>;
  clusters: ClusterOption[];
  permanentClusterIdsByManager: Record<string, string[]>;
  defaultFrom: string;
  defaultUntil: string;
  defaultClusterId?: string;
}) {
  // Bila ada defaultClusterId, prioritaskan manager yang memegang cluster tersebut
  const initialReplacedId = useMemo(() => {
    if (defaultClusterId) {
      const match = managers.find((m) =>
        (permanentClusterIdsByManager[m.id] ?? []).includes(defaultClusterId)
      );
      if (match) return match.id;
    }
    return managers[0]?.id ?? "";
  }, [defaultClusterId, managers, permanentClusterIdsByManager]);

  const [replacedId, setReplacedId] = useState(initialReplacedId);
  const [formKey, setFormKey] = useState(0);
  const { feedback, isPending, run } = useActionRunner();

  const replacedClusters = useMemo(() => {
    const ids = permanentClusterIdsByManager[replacedId] ?? [];
    return clusters.filter((c) => c.isActive && ids.includes(c.id));
  }, [clusters, permanentClusterIdsByManager, replacedId]);

  const [clusterId, setClusterId] = useState(defaultClusterId ?? "");
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
          Saat Manager berhalangan, tunjuk Manager lain untuk memegang cluster-nya selama periode tertentu.
          Setiap penunjukan tersimpan di riwayat.
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
