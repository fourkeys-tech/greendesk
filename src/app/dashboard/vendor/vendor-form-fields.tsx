"use client";

import type { VendorType } from "@/lib/db-types";

export interface VendorClusterOption {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface VendorFormDefaults {
  name?: string;
  type?: VendorType;
  skills?: string[];
  cooperationScheme?: string | null;
  contractStart?: string;
  contractEnd?: string;
  warrantyDays?: number;
  npwp?: string | null;
  address?: string | null;
  clusterIds?: string[];
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-emerald-600 focus:outline-hidden";

/** Field data vendor yang dipakai bersama oleh form tambah & edit vendor. */
export function VendorFormFields({
  idPrefix,
  clusters,
  defaults = {},
}: {
  idPrefix: string;
  clusters: VendorClusterOption[];
  defaults?: VendorFormDefaults;
}) {
  const selected = new Set(defaults.clusterIds ?? []);
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <>
      <div>
        <label htmlFor={id("name")} className="block font-semibold text-slate-700 mb-1">
          Nama Perusahaan Vendor
        </label>
        <input
          id={id("name")}
          type="text"
          name="name"
          required
          defaultValue={defaults.name}
          placeholder="Mis. CV Karya Hijau Mandiri"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("type")} className="block font-semibold text-slate-700 mb-1">
          Jenis Vendor
        </label>
        <select
          id={id("type")}
          name="type"
          defaultValue={defaults.type ?? "EXTERNAL"}
          className={inputClass}
        >
          <option value="EXTERNAL">Eksternal (perusahaan rekanan)</option>
          <option value="INTERNAL">Internal (tim teknisi pengelola)</option>
        </select>
      </div>

      <div>
        <label htmlFor={id("skills")} className="block font-semibold text-slate-700 mb-1">
          Keahlian (pisahkan dengan koma)
        </label>
        <input
          id={id("skills")}
          type="text"
          name="skills"
          required
          defaultValue={defaults.skills?.join(", ")}
          placeholder="Kelistrikan, Sipil, Tanaman, Besi"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("scheme")} className="block font-semibold text-slate-700 mb-1">
          Skema Kerja Sama
        </label>
        <input
          id={id("scheme")}
          type="text"
          name="cooperationScheme"
          defaultValue={defaults.cooperationScheme ?? ""}
          placeholder="Mis. Kontrak payung tahunan / per SPK"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("contract-start")} className="block font-semibold text-slate-700 mb-1">
          Kontrak Mulai
        </label>
        <input
          id={id("contract-start")}
          type="date"
          name="contractStart"
          defaultValue={defaults.contractStart ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("contract-end")} className="block font-semibold text-slate-700 mb-1">
          Kontrak Berakhir
        </label>
        <input
          id={id("contract-end")}
          type="date"
          name="contractEnd"
          defaultValue={defaults.contractEnd ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("warranty")} className="block font-semibold text-slate-700 mb-1">
          Masa Garansi Pekerjaan (hari)
        </label>
        <input
          id={id("warranty")}
          type="number"
          name="warrantyDays"
          defaultValue={defaults.warrantyDays ?? 30}
          min={1}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("npwp")} className="block font-semibold text-slate-700 mb-1">
          NPWP
        </label>
        <input
          id={id("npwp")}
          type="text"
          name="npwp"
          defaultValue={defaults.npwp ?? ""}
          placeholder="01.234.567.8-999.000"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={id("address")} className="block font-semibold text-slate-700 mb-1">
          Alamat Kantor
        </label>
        <input
          id={id("address")}
          type="text"
          name="address"
          defaultValue={defaults.address ?? ""}
          placeholder="Jl. Raya Serpong No. 45"
          className={inputClass}
        />
      </div>

      <fieldset className="sm:col-span-2 lg:col-span-3">
        <legend className="block font-semibold text-slate-700 mb-1.5">
          Area Layanan (minimal 1 cluster)
        </legend>
        {clusters.length === 0 ? (
          <div className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            Belum ada cluster aktif. Buat atau aktifkan cluster di menu Wilayah
            terlebih dahulu.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clusters.map((cl) => (
              <label
                key={cl.id}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="clusterIds"
                  value={cl.id}
                  defaultChecked={selected.has(cl.id)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-800">{cl.name}</span>
                {cl.isActive === false && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                    Nonaktif
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}
