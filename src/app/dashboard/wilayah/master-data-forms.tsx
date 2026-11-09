"use client";

import { useState, useTransition } from "react";
import {
  createAssetAction,
  createCategoryAction,
  createClusterAction,
  createComplexAction,
  createParkAction,
  updateCategoryAction,
} from "@/app/actions/phase1-actions";
import { buildAssetPrefix } from "@/lib/asset-code";

interface MasterDataFormsProps {
  complexes: Array<{ id: string; name: string }>;
  clusters: Array<{ id: string; name: string; complexName: string }>;
  parks: Array<{
    id: string;
    name: string;
    clusterName: string;
    complexName?: string;
  }>;
  categories: Array<{ id: string; name: string; damageTypes: string[] }>;
}

export function MasterDataForms({
  complexes,
  clusters,
  parks,
  categories,
}: MasterDataFormsProps) {
  const [activeTab, setActiveTab] = useState<
    "wilayah" | "kategori" | "aset" | null
  >(parks.length === 0 ? "wilayah" : "aset");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [selectedParkId, setSelectedParkId] = useState<string>(
    parks[0]?.id || ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedPark = parks.find((p) => p.id === selectedParkId) || parks[0];
  const selectedCat =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];

  const previewPrefix =
    selectedPark && selectedCat
      ? buildAssetPrefix(
          selectedPark.complexName || "KMP",
          selectedPark.clusterName || "CLS",
          selectedPark.name || "TMN",
          selectedCat.name || "AST"
        )
      : "KMP-CLS-TMN-AST";
  const [isPending, startTransition] = useTransition();

  function runAction(
    actionFn: (fd: FormData) => Promise<{
      success?: boolean;
      message?: string;
      error?: string;
    }>
  ) {
    return (formData: FormData) => {
      setFeedback(null);
      startTransition(async () => {
        const res = await actionFn(formData);
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
        } else if (res.message) {
          setFeedback({ type: "success", text: res.message });
          setEditingCategoryId(null);
        }
      });
    };
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Panel Admin Fase 1: Kelola Hierarki Wilayah, Kategori & Aset
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Urutan hierarki wajib: <strong>1. Komplek</strong> →{" "}
            <strong>2. Cluster</strong> → <strong>3. Taman</strong> →{" "}
            <strong>4. Kategori</strong> → <strong>5. Aset</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === "wilayah" ? null : "wilayah")
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "wilayah"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            1. + Komplek / Cluster / Taman ({parks.length} Taman)
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === "kategori" ? null : "kategori")
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "kategori"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            2. Kelola Kategori ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "aset" ? null : "aset")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "aset"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            3. + Tambah Aset & Buat QR
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

      {/* TAB 1: KOMPLEK, CLUSTER, TAMAN */}
      {activeTab === "wilayah" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Form Komplek */}
          <form
            action={runAction(createComplexAction)}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="font-bold text-slate-900 text-sm">
              Langkah 1: Tambah Komplek (Tingkat 2)
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Komplek / Perumahan
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Mis. GreenPark Residence Sentul"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Alamat Lengkap
              </label>
              <input
                type="text"
                name="address"
                required
                placeholder="Jl. Raya Boulevard No. 8"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              Simpan Komplek
            </button>
          </form>

          {/* Form Cluster */}
          <form
            action={runAction(createClusterAction)}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="font-bold text-slate-900 text-sm">
              Langkah 2: Tambah Cluster (Tingkat 3)
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Komplek Induk (Wajib)
              </label>
              <select
                name="complexId"
                required
                disabled={complexes.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              >
                {complexes.length === 0 ? (
                  <option value="">
                    -- Buat Komplek di Langkah 1 dulu --
                  </option>
                ) : (
                  complexes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Cluster
              </label>
              <input
                type="text"
                name="name"
                required
                disabled={complexes.length === 0}
                placeholder="Mis. Cluster Lavender"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || complexes.length === 0}
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              Simpan Cluster
            </button>
          </form>

          {/* Form Taman */}
          <form
            action={runAction(createParkAction)}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="font-bold text-slate-900 text-sm">
              Langkah 3: Tambah Taman (Tingkat 4)
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Cluster Induk (Wajib)
              </label>
              <select
                name="clusterId"
                required
                disabled={clusters.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              >
                {clusters.length === 0 ? (
                  <option value="">
                    -- Buat Cluster di Langkah 2 dulu --
                  </option>
                ) : (
                  clusters.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} ({cl.complexName})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Taman
              </label>
              <input
                type="text"
                name="name"
                required
                disabled={clusters.length === 0}
                placeholder="Mis. Taman Bermain Timur"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Keterangan Lokasi
              </label>
              <input
                type="text"
                name="locationNote"
                disabled={clusters.length === 0}
                placeholder="Mis. Sebelah Pos Sekuriti Blok B"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || clusters.length === 0}
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              Simpan Taman
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: KATEGORI ASET & JENIS KERUSAKAN */}
      {activeTab === "kategori" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            action={runAction(createCategoryAction)}
            className="lg:col-span-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="font-bold text-slate-900 text-sm">
              Tambah Kategori Aset & Jenis Kerusakan
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Kategori Aset
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Mis. Bangku & Gazebo Taman"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Daftar Jenis Kerusakan (pisahkan dengan koma)
              </label>
              <textarea
                name="damageTypes"
                rows={3}
                required
                placeholder="Kayu lapuk, Atap bocor, Baut lepas, Cat mengelupas"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              Simpan Kategori Baru
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-bold uppercase text-slate-500">
              Kategori Terdaftar ({categories.length})
            </div>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2"
              >
                {editingCategoryId === cat.id ? (
                  <form
                    action={runAction(updateCategoryAction)}
                    className="space-y-2.5"
                  >
                    <input type="hidden" name="categoryId" value={cat.id} />
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Kategori
                      </label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={cat.name}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Jenis Kerusakan (pisahkan dengan koma)
                      </label>
                      <input
                        type="text"
                        name="damageTypes"
                        defaultValue={cat.damageTypes.join(", ")}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Simpan Perubahan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {cat.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {cat.damageTypes.map((dt) => (
                          <span
                            key={dt}
                            className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px]"
                          >
                            {dt}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryId(cat.id)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-medium cursor-pointer"
                    >
                      Ubah
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TAMBAH ASET BARU (Tingkat 5 Hierarki) */}
      {activeTab === "aset" && (
        <div className="space-y-3">
          {(parks.length === 0 || categories.length === 0) && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong>Perhatian Hierarki 5 Tingkat:</strong>{" "}
                {parks.length === 0
                  ? "Perusahaan yang sedang aktif belum memiliki data Taman (Komplek → Cluster → Taman). Buat Taman terlebih dahulu di Tab 1 agar pilihan Taman muncul."
                  : "Belum ada Kategori Aset. Buat Kategori terlebih dahulu di Tab 2."}
              </div>
              {parks.length === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("wilayah")}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold cursor-pointer"
                >
                  Buka Tab 1 (+ Komplek / Cluster / Taman) →
                </button>
              )}
            </div>
          )}

          <form
            action={runAction(createAssetAction)}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
          >
            <div className="sm:col-span-2 lg:col-span-3 font-bold text-slate-900 text-sm">
              Tambah Aset Taman Baru (Otomatis Membuat Tautan QR `/r/&#123;kodeAset&#125;`)
            </div>

            <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Otomatisasi Kode & QR Aset (Hierarki 5 Tingkat)
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Auto-Generated
                  </span>
                </div>
                <p className="text-slate-600 text-xs mt-0.5">
                  Format: <code>[Komplek]-[Cluster]-[Taman]-[Kategori]-[Urut]</code>. Nomor urut otomatis dihitung oleh sistem.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-2xs font-mono text-xs font-bold text-emerald-900">
                <span className="text-slate-400">Preview:</span>
                <span>{previewPrefix}-###</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pilih Taman Induk (Wajib)
              </label>
              <select
                name="parkId"
                required
                value={selectedParkId}
                onChange={(e) => setSelectedParkId(e.target.value)}
                disabled={parks.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              >
                {parks.length === 0 ? (
                  <option value="">
                    -- Belum ada Taman (Buat di Tab 1 dulu) --
                  </option>
                ) : (
                  parks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.clusterName})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Kategori Aset (Wajib)
              </label>
              <select
                name="categoryId"
                required
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={categories.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              >
                {categories.length === 0 ? (
                  <option value="">
                    -- Belum ada Kategori (Buat di Tab 2 dulu) --
                  </option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nama Aset
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Mis. Perosotan Spiral Anak"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Titik Lokasi Spesifik
              </label>
              <input
                type="text"
                name="locationNote"
                placeholder="Mis. Sebelah Timur Kolam Ikan"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tanggal Pasang
              </label>
              <input
                type="date"
                name="installedAt"
                defaultValue="2026-11-08"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Foto Aset (Opsional, maks 5 MB)
              </label>
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Status Awal Aset
              </label>
              <select
                name="isActive"
                defaultValue="true"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="true">Aktif (Menerima Laporan QR)</option>
                <option value="false">Nonaktif (Tidak Bisa Dilaporkan)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={
                  isPending || parks.length === 0 || categories.length === 0
                }
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {isPending ? "Menyimpan..." : "Simpan Aset & Buat QR"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
