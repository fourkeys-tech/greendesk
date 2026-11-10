"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, MapPin, ArrowRight, Printer, Download } from "lucide-react";
import { AssetEditForm } from "./asset-edit-form";
import { downloadSingleQr, printSingleQr } from "./cetak-qr/print-button";

interface WilayahHierarchyClientProps {
  complexes: any[];
  categories: Array<{ id: string; name: string }>;
  qrRecord: Record<string, { shortUrl: string; qrDataUrl: string }>;
  canManage: boolean;
}

export function WilayahHierarchyClient({
  complexes,
  categories,
  qrRecord,
  canManage,
}: WilayahHierarchyClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <div className="space-y-6">
      {complexes.map((comp) => (
        <div
          key={comp.id}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 space-y-6 shadow-xs"
        >
          {/* Tingkat 2: Komplek Header */}
          <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                Tingkat 2: Komplek / Perumahan
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                {comp.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{comp.address}</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {comp.clusters.length} Cluster Aktif
              </span>
            </div>
          </div>

          {/* Tingkat 3: Cluster Container */}
          <div className="space-y-5">
            {comp.clusters.map((cluster: any) => (
              <div
                key={cluster.id}
                className="rounded-2xl border border-slate-200/90 p-5 bg-slate-50/60 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                      Tingkat 3: Cluster
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {cluster.name}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Cakupan Pengelola Klaster
                  </span>
                </div>

                {/* Tingkat 4: Taman Container */}
                {cluster.parks.map((park: any) => {
                  const filteredAssets = park.assets.filter((asset: any) => {
                    if (
                      selectedCategory !== "ALL" &&
                      asset.category?.name !== selectedCategory
                    ) {
                      return false;
                    }
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const matchName = asset.name?.toLowerCase().includes(q);
                      const matchCode = asset.code?.toLowerCase().includes(q);
                      const matchCat = asset.category?.name
                        ?.toLowerCase()
                        .includes(q);
                      if (!matchName && !matchCode && !matchCat) return false;
                    }
                    return true;
                  });

                  return (
                    <div
                      key={park.id}
                      className="rounded-2xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-2xs"
                    >
                      {/* Park Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                            Tingkat 4: Taman
                          </span>
                          <h4 className="font-extrabold text-base text-slate-900">
                            {park.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Lokasi: {park.locationNote || "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="text-xs bg-slate-100 text-slate-800 px-3 py-1 rounded-full font-bold border border-slate-200">
                            {park.assets.length} Aset Terdaftar
                          </span>
                        </div>
                      </div>

                      {/* Filter & Search Bar for Assets */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory("ALL")}
                            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                              selectedCategory === "ALL"
                                ? "bg-slate-900 text-white font-bold"
                                : "bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold"
                            }`}
                          >
                            Semua ({park.assets.length})
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSelectedCategory(cat.name)}
                              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                                selectedCategory === cat.name
                                  ? "bg-slate-900 text-white font-bold"
                                  : "bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold"
                              }`}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>

                        <div className="relative w-full sm:w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama atau kode aset..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>

                      {/* Tingkat 5: Asset Cards Grid */}
                      {filteredAssets.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Tidak ada aset pada taman ini yang cocok dengan filter
                          kategori / pencarian.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                          {filteredAssets.map((asset: any) => {
                            const qr = qrRecord[asset.code];
                            return (
                              <div
                                key={asset.id}
                                className="rounded-2xl border border-slate-200/90 p-5 bg-slate-50/40 hover:bg-white hover:shadow-md transition flex flex-col justify-between gap-4"
                              >
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                                        {asset.code}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                          asset.isActive
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                            : "bg-rose-100 text-rose-800 border-rose-200"
                                        }`}
                                      >
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${
                                            asset.isActive
                                              ? "bg-emerald-600"
                                              : "bg-rose-600"
                                          }`}
                                        />
                                        {asset.isActive ? "Aktif" : "Nonaktif"}
                                      </span>
                                    </div>

                                    <h5 className="font-extrabold text-base text-slate-900 pt-1">
                                      {asset.name}
                                    </h5>

                                    <div className="space-y-1 text-xs text-slate-600">
                                      <div>
                                        Kategori:{" "}
                                        <strong className="text-slate-800">
                                          {asset.category.name}
                                        </strong>
                                      </div>
                                      <div className="text-slate-500 flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span>
                                          Titik Lokasi:{" "}
                                          {asset.locationNote || "-"}
                                        </span>
                                      </div>
                                      {asset.installedAt && (
                                        <div className="text-[11px] text-slate-400">
                                          Tanggal Pasang:{" "}
                                          {new Date(
                                            asset.installedAt
                                          ).toLocaleDateString("id-ID")}
                                        </div>
                                      )}
                                    </div>

                                    {asset.photoUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={asset.photoUrl}
                                        alt={asset.name}
                                        className="h-20 w-28 object-cover rounded-xl border border-slate-200 mt-2"
                                      />
                                    )}

                                    {/* Riwayat Vendor Perbaikan Terakhir */}
                                    <div className="pt-3 mt-2 border-t border-slate-200/80 text-xs">
                                      <span className="font-bold text-slate-700 block mb-1.5">
                                        Riwayat Vendor Perbaikan Terakhir:
                                      </span>
                                      {asset.reports &&
                                      asset.reports.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {asset.reports.map((r: any) => (
                                            <div
                                              key={r.id}
                                              className="text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs"
                                            >
                                              • Vendor:{" "}
                                              <strong className="text-slate-900">
                                                {r.workOrder?.vendor.name}
                                              </strong>{" "}
                                              <span className="font-mono text-indigo-700 font-semibold">
                                                ({r.workOrder?.spkNo})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-[11px] text-slate-400 italic bg-white/60 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200">
                                          Belum ada riwayat SPK vendor pada aset
                                          ini.
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* QR Code Box */}
                                  {qr && (
                                    <div className="w-full sm:w-36 flex flex-col items-center justify-center bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={qr.qrDataUrl}
                                        alt={`QR ${asset.code}`}
                                        className="w-24 h-24 rounded-lg border border-slate-100 p-1"
                                      />
                                      <span className="font-mono text-[11px] font-extrabold text-slate-900 tracking-tight mt-2">
                                        {asset.code}
                                      </span>
                                      <Link
                                        href={`/r/${encodeURIComponent(
                                          asset.code
                                        )}`}
                                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition border border-emerald-200/60"
                                      >
                                        <span>Uji Scan QR</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </Link>

                                      <div className="flex items-center gap-1 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            printSingleQr({
                                              qrDataUrl: qr.qrDataUrl,
                                              assetCode: asset.code,
                                              assetName: asset.name,
                                              parkName: park.name,
                                            })
                                          }
                                          className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                                          title="Cetak hanya gambar QR ini"
                                        >
                                          Cetak
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            downloadSingleQr(
                                              qr.qrDataUrl,
                                              asset.code
                                            )
                                          }
                                          className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                                          title="Unduh gambar QR PNG"
                                        >
                                          Unduh
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {canManage && <AssetEditForm asset={asset} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

