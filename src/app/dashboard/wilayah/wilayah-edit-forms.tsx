"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  updateClusterAction,
  updateComplexAction,
  updateParkAction,
} from "@/app/actions/phase1-actions";
import { updateAssetMasterAction } from "@/app/actions/foundation-actions";
import {
  FeedbackBanner,
  useActionRunner,
  type ActionResponse,
} from "@/components/dashboard/action-feedback";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

type Field = {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
};

/**
 * Form edit inline generik: tombol "Ubah" membuka form nama/keterangan + status aktif.
 */
function InlineEditForm({
  entityLabel,
  hiddenName,
  id,
  fields,
  isActive,
  action,
  deactivateWarning,
}: {
  entityLabel: string;
  hiddenName: string;
  id: string;
  fields: Field[];
  isActive: boolean;
  action: (fd: FormData) => Promise<ActionResponse>;
  deactivateWarning?: string;
}) {
  const [open, setOpen] = useState(false);
  const { feedback, isPending, run } = useActionRunner();

  function handleSubmit(fd: FormData) {
    const willDeactivate = isActive && fd.get("isActive") === "false";
    run(() => action(fd), {
      confirmText: willDeactivate ? deactivateWarning : undefined,
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-2">
      <FeedbackBanner feedback={feedback} compact />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
        >
          <Pencil className="w-3 h-3" />
          Ubah {entityLabel}
        </button>
      ) : (
        <form
          action={handleSubmit}
          className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5 text-xs"
        >
          <input type="hidden" name={hiddenName} value={id} />
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block font-medium text-slate-700 mb-1">
                {f.label}
              </label>
              <input
                type="text"
                name={f.name}
                defaultValue={f.defaultValue}
                required={f.required}
                className={inputClass}
              />
            </div>
          ))}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Status</label>
            <select
              name="isActive"
              defaultValue={isActive ? "true" : "false"}
              className={inputClass}
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ComplexEditForm({
  complex,
}: {
  complex: { id: string; name: string; address: string; isActive: boolean };
}) {
  return (
    <InlineEditForm
      entityLabel="komplek"
      hiddenName="id"
      id={complex.id}
      isActive={complex.isActive}
      action={updateComplexAction}
      deactivateWarning={`Nonaktifkan komplek "${complex.name}"? Semua cluster, taman, dan aset di dalamnya tidak bisa menerima laporan baru. Laporan yang sedang berjalan tetap diproses.`}
      fields={[
        { name: "name", label: "Nama komplek", defaultValue: complex.name, required: true },
        { name: "address", label: "Alamat", defaultValue: complex.address, required: true },
      ]}
    />
  );
}

export function ClusterEditForm({
  cluster,
}: {
  cluster: { id: string; name: string; isActive: boolean };
}) {
  return (
    <InlineEditForm
      entityLabel="cluster"
      hiddenName="id"
      id={cluster.id}
      isActive={cluster.isActive}
      action={updateClusterAction}
      deactivateWarning={`Nonaktifkan cluster "${cluster.name}"? Taman dan aset di dalamnya tidak bisa menerima laporan baru.`}
      fields={[
        { name: "name", label: "Nama cluster", defaultValue: cluster.name, required: true },
      ]}
    />
  );
}

export function ParkEditForm({
  park,
}: {
  park: { id: string; name: string; locationNote: string | null; isActive: boolean };
}) {
  return (
    <InlineEditForm
      entityLabel="taman"
      hiddenName="id"
      id={park.id}
      isActive={park.isActive}
      action={updateParkAction}
      deactivateWarning={`Nonaktifkan taman "${park.name}"? Aset di taman ini tidak bisa menerima laporan baru.`}
      fields={[
        { name: "name", label: "Nama taman", defaultValue: park.name, required: true },
        {
          name: "locationNote",
          label: "Keterangan lokasi",
          defaultValue: park.locationNote ?? "",
        },
      ]}
    />
  );
}

export function AssetEditForm({
  asset,
}: {
  asset: {
    id: string;
    code: string;
    name: string;
    locationNote: string | null;
    isActive: boolean;
  };
}) {
  return (
    <InlineEditForm
      entityLabel="aset"
      hiddenName="assetId"
      id={asset.id}
      isActive={asset.isActive}
      action={updateAssetMasterAction}
      deactivateWarning={`Nonaktifkan aset ${asset.code}? Warga tidak bisa melapor lewat QR aset ini sampai diaktifkan kembali.`}
      fields={[
        { name: "name", label: `Nama aset (${asset.code})`, defaultValue: asset.name, required: true },
        {
          name: "locationNote",
          label: "Titik lokasi",
          defaultValue: asset.locationNote ?? "",
        },
      ]}
    />
  );
}
