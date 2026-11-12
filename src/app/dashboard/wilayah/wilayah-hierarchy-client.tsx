"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { downloadSingleQr, printSingleQr } from "./cetak-qr/print-button";
import {
  AssetEditForm,
  ClusterEditForm,
  ComplexEditForm,
  ParkEditForm,
} from "./wilayah-edit-forms";
import type {
  HierarchyAsset,
  HierarchyComplex,
} from "./wilayah-types";
import { sanitizeMediaHref } from "@/lib/url-safety";

interface WilayahHierarchyClientProps {
  complexes: HierarchyComplex[];
  categories: Array<{ id: string; name: string; isActive: boolean }>;
  canManage: boolean;
  companyName?: string;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

function ActiveBadge({
  isActive,
  parentInactive,
}: {
  isActive: boolean;
  parentInactive?: boolean;
}) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-800 border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        Nonaktif
      </span>
    );
  }
  if (parentInactive) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200"
        title="Ikut nonaktif karena induknya nonaktif"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Nonaktif (induk)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
      Aktif
    </span>
  );
}

export function WilayahHierarchyClient({
  complexes,
  categories,
  canManage,
  companyName,
}: WilayahHierarchyClientProps) {
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtersActive = categoryId !== "ALL" || status !== "ALL" || q.length > 0;

  const totalAssets = useMemo(
    () =>
      complexes.reduce(
        (sum, c) =>
          sum +
          c.clusters.reduce(
            (s, cl) => s + cl.parks.reduce((p, pk) => p + pk.assets.length, 0),
            0
          ),
        0
      ),
    [complexes]
  );

  function assetMatches(asset: HierarchyAsset, effectiveActive: boolean) {
    if (categoryId !== "ALL" && asset.category.id !== categoryId) return false;
    if (status === "ACTIVE" && !effectiveActive) return false;
    if (status === "INACTIVE" && effectiveActive) return false;
    if (q) {
      const hay = `${asset.name} ${asset.code} ${asset.category.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  let visibleAssetCount = 0;

  const rendered = complexes.map((comp) => {
    const clusters = comp.clusters.map((cluster) => {
      const clusterParentInactive = !comp.isActive;
      const parks = cluster.parks.map((park) => {
        const parkParentInactive =
          clusterParentInactive || !cluster.isActive;
        const assets = park.assets.filter((asset) => {
          const effectiveActive =
            asset.isActive &&
            asset.category.isActive &&
            park.isActive &&
            !parkParentInactive;
          return assetMatches(asset, effectiveActive);
        });
        visibleAssetCount += assets.length;
        return { park, parkParentInactive, assets };
      });
      return { cluster, clusterParentInactive, parks };
    });
    return { comp, clusters };
  });

  return (
    <div className="space-y-5">
      {/* Filter global */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 lg:sticky lg:top-2 lg:z-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, kode, atau kategori aset..."
              aria-label="Cari aset"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 transition"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Filter kategori"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <option value="ALL">Semua kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
                {cat.isActive ? "" : " (nonaktif)"}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter status aset"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Bisa dilaporkan</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            Menampilkan <strong className="text-slate-800">{visibleAssetCount}</strong> dari{" "}
            {totalAssets} aset
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryId("ALL");
                setStatus("ALL");
              }}
              className="font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {rendered.map(({ comp, clusters }) => (
        <section
          key={comp.id}
          className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Komplek
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h2 className="text-lg font-extrabold text-slate-900">{comp.name}</h2>
                <ActiveBadge isActive={comp.isActive} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{comp.address}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {comp.clusters.length} Cluster
              </span>
              {canManage && <ComplexEditForm complex={comp} />}
            </div>
          </div>

          <div className="space-y-4">
            {clusters.map(({ cluster, clusterParentInactive, parks }) => (
              <div
                key={cluster.id}
                className="rounded-2xl border border-slate-200/90 p-4 sm:p-5 bg-slate-50/60 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                      Cluster
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {cluster.name}
                      </h3>
                      <ActiveBadge
                        isActive={cluster.isActive}
                        parentInactive={clusterParentInactive}
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>
                        Pengelola:{" "}
                        {cluster.pengelolaNames.length > 0 ? (
                          <strong className="text-slate-800">
                            {cluster.pengelolaNames.join(", ")}
                          </strong>
                        ) : (
                          <span className="text-amber-700 font-semibold">belum ada</span>
                        )}
                      </div>
                      <div>
                        Manager:{" "}
                        {cluster.managerNames.length > 0 ? (
                          <strong className="text-slate-800">
                            {cluster.managerNames
                              .map((m) => (m.isTemporary ? `${m.name} (pengganti)` : m.name))
                              .join(", ")}
                          </strong>
                        ) : (
                          <span className="text-amber-700 font-semibold">belum ada</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="shrink-0">
                      <ClusterEditForm cluster={cluster} />
                    </div>
                  )}
                </div>

                {parks.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                    Belum ada taman di cluster ini.
                  </div>
                )}

                {parks.map(({ park, parkParentInactive, assets }) => {
                  if (filtersActive && assets.length === 0) return null;
                  return (
                    <div
                      key={park.id}
                      className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-4 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                            Taman
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-base text-slate-900">
                              {park.name}
                            </h4>
                            <ActiveBadge
                              isActive={park.isActive}
                              parentInactive={parkParentInactive}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Lokasi: {park.locationNote || "-"}
                          </p>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                          <span className="text-xs bg-slate-100 text-slate-800 px-3 py-1 rounded-full font-bold border border-slate-200">
                            {filtersActive
                              ? `${assets.length} dari ${park.assets.length} aset`
                              : `${park.assets.length} aset`}
                          </span>
                          {canManage && <ParkEditForm park={park} />}
                        </div>
                      </div>

                      {assets.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Belum ada aset di taman ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {assets.map((asset) => {
                            const parentInactive =
                              parkParentInactive ||
                              !park.isActive ||
                              !asset.category.isActive;
                            return (
                              <article
                                key={asset.id}
                                className="rounded-2xl border border-slate-200/90 p-4 bg-slate-50/40 hover:bg-white hover:shadow-md transition flex flex-col justify-between gap-4"
                              >
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white break-all">
                                        {asset.code}
                                      </span>
                                      <ActiveBadge
                                        isActive={asset.isActive}
                                        parentInactive={parentInactive}
                                      />
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
                                        {!asset.category.isActive && (
                                          <span className="text-amber-700"> (kategori nonaktif)</span>
                                        )}
                                      </div>
                                      <div className="text-slate-500 flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span>Titik lokasi: {asset.locationNote || "-"}</span>
                                      </div>
                                      {asset.installedAt && (
                                        <div className="text-[11px] text-slate-400">
                                          Dipasang:{" "}
                                          {new Date(asset.installedAt).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            timeZone: "Asia/Jakarta",
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {sanitizeMediaHref(asset.photoUrl) && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={sanitizeMediaHref(asset.photoUrl)!}
                                        alt={asset.name}
                                        className="h-20 w-28 object-cover rounded-xl border border-slate-200 mt-2"
                                      />
                                    )}

                                    <div className="pt-3 mt-2 border-t border-slate-200/80 text-xs">
                                      <span className="font-bold text-slate-700 block mb-1.5">
                                        Vendor perbaikan terakhir
                                      </span>
                                      {asset.recentWork.length > 0 ? (
                                        <ul className="space-y-1.5">
                                          {asset.recentWork.map((w) => (
                                            <li
                                              key={w.id}
                                              className="text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/90"
                                            >
                                              <strong className="text-slate-900">{w.vendorName}</strong>{" "}
                                              <span className="font-mono text-indigo-700 font-semibold">
                                                ({w.spkNo})
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <div className="text-[11px] text-slate-400 italic bg-white/60 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200">
                                          Belum ada riwayat SPK.
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {asset.qrDataUrl && (
                                    <div className="w-full sm:w-36 flex flex-col items-center justify-center bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={asset.qrDataUrl}
                                        alt={`QR ${asset.code}`}
                                        className="w-24 h-24 rounded-lg border border-slate-100 p-1"
                                      />
                                      <span className="font-mono text-[11px] font-extrabold text-slate-900 tracking-tight mt-2 break-all text-center">
                                        {asset.code}
                                      </span>
                                      <Link
                                        href={`/r/${encodeURIComponent(asset.code)}`}
                                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition border border-emerald-200/60"
                                      >
                                        <span>Uji scan QR</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </Link>

                                      {canManage && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              printSingleQr({
                                                qrDataUrl: asset.qrDataUrl!,
                                                assetCode: asset.code,
                                                assetName: asset.name,
                                                parkName: park.name,
                                                companyName,
                                              })
                                            }
                                            className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                                            title="Cetak stiker QR aset ini"
                                          >
                                            Cetak
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              downloadSingleQr(asset.qrDataUrl!, asset.code)
                                            }
                                            className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer"
                                            title="Unduh gambar QR (.png)"
                                          >
                                            Unduh
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {canManage && <AssetEditForm asset={asset} />}
                              </article>
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
        </section>
      ))}

      {filtersActive && visibleAssetCount === 0 && (
        <div className="p-6 text-center text-sm text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
          Tidak ada aset yang cocok dengan filter.
        </div>
      )}
    </div>
  );
}
