"use client";

import { useState } from "react";
import { Layers, Pencil, X } from "lucide-react";
import {
  bulkAssignToComplexAction,
  setClusterManagersAction,
  setClusterPengelolaAction,
  setClusterVendorsAction,
} from "@/app/actions/responsibility-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

/* ---------------------------------------------------------------- */
/* Editor Pengelola Cluster (bisa memilih banyak Pengelola)         */
/* ---------------------------------------------------------------- */

export function ClusterPengelolaEditor({
  clusterId,
  clusterName,
  currentPengelolaIds,
  candidates,
}: {
  clusterId: string;
  clusterName: string;
  currentPengelolaIds: string[];
  candidates: Array<{
    id: string;
    name: string;
    email: string;
    currentClusterId: string | null;
    currentClusterName: string | null;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentPengelolaIds);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    run(() => setClusterPengelolaAction(clusterId, selectedIds), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedIds(currentPengelolaIds);
            setOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          {open ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {open ? "Tutup" : "Atur Pengelola"}
        </button>
      </div>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-semibold text-slate-800">
            Pilih Pengelola untuk {clusterName}
          </div>
          <p className="text-[11px] text-slate-500">
            Satu Pengelola bekerja di tepat 1 cluster. Bila Anda memilih Pengelola yang sudah ditugaskan di cluster lain, ia akan dipindah ke sini.
          </p>
          {candidates.length === 0 ? (
            <p className="text-slate-500 text-xs">Belum ada akun Pengelola aktif.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {candidates.map((c) => {
                const checked = selectedIds.includes(c.id);
                const isAnother =
                  c.currentClusterId && c.currentClusterId !== clusterId;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                      checked
                        ? "bg-emerald-50/70 border-emerald-300"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{c.email}</div>
                      {isAnother && (
                        <div className="text-[10px] text-amber-800 font-medium mt-0.5">
                          Saat ini di cluster: {c.currentClusterName} (akan dipindah)
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Pengelola"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
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
/* Editor Manager Cluster (bisa memilih banyak Manager tetap)        */
/* ---------------------------------------------------------------- */

export function ClusterManagerEditor({
  clusterId,
  clusterName,
  currentManagerIds,
  candidates,
}: {
  clusterId: string;
  clusterName: string;
  currentManagerIds: string[];
  candidates: Array<{ id: string; name: string; email: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentManagerIds);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    run(() => setClusterManagersAction(clusterId, selectedIds), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedIds(currentManagerIds);
            setOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          {open ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {open ? "Tutup" : "Atur Manager"}
        </button>
      </div>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-semibold text-slate-800">
            Pilih Manager tetap untuk {clusterName}
          </div>
          <p className="text-[11px] text-slate-500">
            Manager bisa memegang satu atau beberapa cluster. Penunjukan sementara (pengganti) diatur lewat tombol &quot;Tunjuk pengganti&quot;.
          </p>
          {candidates.length === 0 ? (
            <p className="text-slate-500 text-xs">Belum ada akun Manager aktif.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {candidates.map((m) => {
                const checked = selectedIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                      checked
                        ? "bg-emerald-50/70 border-emerald-300"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.id)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{m.name}</div>
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Manager"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
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
/* Editor Vendor Area Layanan Cluster                                */
/* ---------------------------------------------------------------- */

export function ClusterVendorEditor({
  clusterId,
  clusterName,
  currentVendorIds,
  candidates,
}: {
  clusterId: string;
  clusterName: string;
  currentVendorIds: string[];
  candidates: Array<{ id: string; name: string; type: string; skills: string[] }>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentVendorIds);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    run(() => setClusterVendorsAction(clusterId, selectedIds), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedIds(currentVendorIds);
            setOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          {open ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {open ? "Tutup" : "Atur Vendor"}
        </button>
      </div>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-semibold text-slate-800">
            Pilih Vendor area layanan untuk {clusterName}
          </div>
          <p className="text-[11px] text-slate-500">
            Manager hanya bisa menerbitkan SPK ke vendor yang melayani cluster ini. Setiap vendor wajib memegang minimal 1 cluster.
          </p>
          {candidates.length === 0 ? (
            <p className="text-slate-500 text-xs">Belum ada vendor aktif.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {candidates.map((v) => {
                const checked = selectedIds.includes(v.id);
                return (
                  <label
                    key={v.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                      checked
                        ? "bg-emerald-50/70 border-emerald-300"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(v.id)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          {v.type}
                        </span>
                      </div>
                      {v.skills.length > 0 && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {v.skills.join(", ")}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan Vendor"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white cursor-pointer"
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
/* Aksi massal per Komplek: Terapkan ke semua cluster aktif           */
/* ---------------------------------------------------------------- */

export function ComplexBulkAssignForm({
  complexId,
  complexName,
  kind,
  candidates,
  activeClusterCount,
}: {
  complexId: string;
  complexName: string;
  kind: "manager" | "vendor";
  candidates: Array<{ id: string; name: string; subtitle?: string }>;
  activeClusterCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { feedback, isPending, run } = useActionRunner();

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleApply() {
    if (selectedIds.length === 0) return;
    const label = kind === "manager" ? "Manager" : "Vendor";
    run(
      () => bulkAssignToComplexAction(complexId, kind, selectedIds),
      {
        confirmText: `Terapkan ${selectedIds.length} ${label} ke seluruh ${activeClusterCount} cluster aktif di ${complexName}? (Penugasan yang sudah ada tidak akan dihapus)`,
        onSuccess: () => {
          setOpen(false);
          setSelectedIds([]);
        },
      }
    );
  }

  const label = kind === "manager" ? "Manager" : "Vendor";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5 text-slate-500" />
        {open ? `Tutup Terapkan Massal` : `Terapkan ${label} ke Semua Cluster`}
      </button>

      <FeedbackBanner feedback={feedback} compact />

      {open && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div>
            <div className="font-bold text-slate-900">
              Terapkan {label} ke semua cluster aktif di {complexName} ({activeClusterCount} cluster)
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilihan akan <strong>ditambahkan</strong> ke cluster-cluster yang belum memilikinya. Penugasan yang sudah ada tetap dipertahankan.
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {candidates.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition ${
                    checked
                      ? "bg-emerald-50/70 border-emerald-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    {c.subtitle && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {c.subtitle}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || selectedIds.length === 0}
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menerapkan..." : `Terapkan ke ${activeClusterCount} Cluster`}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSelectedIds([]);
              }}
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
