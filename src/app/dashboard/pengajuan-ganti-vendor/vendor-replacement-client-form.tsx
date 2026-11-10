"use client";

import { useState, useTransition, useMemo } from "react";
import { AlertCircle, CheckCircle2, Send, PlusCircle } from "lucide-react";
import { submitVendorReplacementAction } from "@/app/actions/phase6-actions";

export interface AssetReportItem {
  id: string;
  ticketNo: string;
  description: string;
  status: string;
  createdAt: string;
  vendorName?: string | null;
  vendorId?: string | null;
  spkNo?: string | null;
}

export interface AssetOptionItem {
  id: string;
  name: string;
  code: string;
  parkName: string;
  latestVendorId?: string | null;
  reports: AssetReportItem[];
}

export interface VendorOptionItem {
  id: string;
  name: string;
}

interface Props {
  assets: AssetOptionItem[];
  vendors: VendorOptionItem[];
}

export function VendorReplacementClientForm({ assets, vendors }: Props) {
  const defaultAsset =
    assets.find((a) => a.reports.length >= 2) || assets[0] || null;
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    defaultAsset?.id || ""
  );
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    defaultAsset?.latestVendorId || vendors[0]?.id || ""
  );
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>(
    defaultAsset && defaultAsset.reports.length >= 2
      ? defaultAsset.reports.slice(0, 2).map((r) => r.id)
      : []
  );
  const [reason, setReason] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAsset = assets.find((a) => a.id === selectedAssetId);

  // Filter laporan yang relevan dengan aset & vendor terpilih
  const relevantReports = useMemo(() => {
    if (!currentAsset) return [];
    if (!selectedVendorId) return currentAsset.reports;
    return currentAsset.reports.filter(
      (r) => !r.vendorId || r.vendorId === selectedVendorId
    );
  }, [currentAsset, selectedVendorId]);

  const handleAssetChange = (newAssetId: string) => {
    setSelectedAssetId(newAssetId);
    setErrorMsg(null);
    setSuccessMsg(null);

    const asset = assets.find((a) => a.id === newAssetId);
    const vendorId = asset?.latestVendorId || "";
    if (vendorId) {
      setSelectedVendorId(vendorId);
    }
    const matchedReports = asset
      ? vendorId
        ? asset.reports.filter((r) => !r.vendorId || r.vendorId === vendorId)
        : asset.reports
      : [];

    if (matchedReports.length >= 2) {
      setSelectedReportIds(matchedReports.slice(0, 2).map((r) => r.id));
    } else {
      setSelectedReportIds([]);
    }
  };

  const handleVendorChange = (newVendorId: string) => {
    setSelectedVendorId(newVendorId);
    setErrorMsg(null);
    setSuccessMsg(null);
    // Reset or filter selected reports to only those matching new vendor
    if (!currentAsset) return;
    const matched = currentAsset.reports.filter(
      (r) => !newVendorId || !r.vendorId || r.vendorId === newVendorId
    );
    setSelectedReportIds((prev) => prev.filter((id) => matched.some((m) => m.id === id)));
  };

  const handleToggleReport = (reportId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedReportIds((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAllReports = () => {
    if (relevantReports.length === 0) return;
    if (selectedReportIds.length === relevantReports.length) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(relevantReports.map((r) => r.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedAssetId) {
      setErrorMsg("Silakan pilih aset yang mengalami kerusakan berulang.");
      return;
    }

    if (!selectedVendorId) {
      setErrorMsg("Silakan tentukan vendor yang dipersoalkan.");
      return;
    }

    if (selectedReportIds.length < 2) {
      setErrorMsg(
        "Minimal 2 laporan berulang pada aset ini wajib dipilih sebagai bukti dasar."
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMsg("Alasan pengajuan pergantian vendor wajib diisi.");
      return;
    }

    const formData = new FormData();
    formData.append("assetId", selectedAssetId);
    formData.append("vendorId", selectedVendorId);
    formData.append("reason", reason.trim());
    selectedReportIds.forEach((id) => {
      formData.append("basisReportIds", id);
    });

    startTransition(async () => {
      const res = await submitVendorReplacementAction(formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSelectedReportIds([]);
        setReason("");
        setSuccessMsg(
          "Pengajuan pergantian vendor berhasil dikirim ke Manager!"
        );
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header Form */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Form Buat Pengajuan Pergantian Vendor Baru
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih aset di cluster Anda yang mengalami kerusakan berulang setelah
            diservis, sertakan minimal 2 nomor laporan sebagai bukti.
          </p>
        </div>
        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 items-center justify-center shrink-0">
          <PlusCircle className="w-5 h-5" />
        </div>
      </div>

      {/* Body Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Row 1: Asset & Vendor Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Select Asset */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Pilih Aset yang Rusak Berulang{" "}
              <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => handleAssetChange(e.target.value)}
              required
              className="w-full text-xs sm:text-sm font-medium rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition"
            >
              <option value="">-- Pilih Aset Taman --</option>
              {assets.map((ast) => (
                <option key={ast.id} value={ast.id}>
                  {ast.name} ({ast.code}) · {ast.reports.length} riwayat laporan
                </option>
              ))}
            </select>
            {currentAsset && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Lokasi: {currentAsset.parkName}</span>
              </p>
            )}
          </div>

          {/* Select Vendor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Vendor yang Dipersoalkan{" "}
                <span className="text-rose-600">*</span>
              </label>
              {currentAsset?.latestVendorId && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Otomatis dari SPK Terakhir
                </span>
              )}
            </div>
            <select
              value={selectedVendorId}
              onChange={(e) => handleVendorChange(e.target.value)}
              required
              className="w-full text-xs sm:text-sm font-medium rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition"
            >
              <option value="">-- Pilih Vendor Terkait --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Vendor yang bertanggung jawab atas servis/perbaikan aset ini
              sebelumnya.
            </p>
          </div>
        </div>

        {/* Row 2: Basis Reports Checklist */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-800">
              Laporan Berulang sebagai Dasar Pembuktian{" "}
              <span className="text-emerald-700 font-extrabold">
                (Pilih Minimal 2)
              </span>
            </label>
            <div className="flex items-center gap-3">
              {relevantReports.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllReports}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                >
                  {selectedReportIds.length === relevantReports.length
                    ? "Batal Pilih Semua"
                    : "Pilih Semua"}
                </button>
              )}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  selectedReportIds.length >= 2
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-amber-800 bg-amber-50 border-amber-200"
                }`}
              >
                {selectedReportIds.length} dari {relevantReports.length}{" "}
                Tiket Dipilih
              </span>
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Syarat Validasi PRD:</strong> Hanya laporan sah &amp; valid pada
              aset{" "}
              <strong className="underline">
                {currentAsset
                  ? `${currentAsset.name} (${currentAsset.code})`
                  : "terpilih"}
              </strong>{" "}
              (bukan berstatus DIBATALKAN, TIDAK_VALID, atau DIGABUNG) yang ditampilkan
              sebagai bukti dasar kerusakan berulang.
            </span>
          </div>

          {!currentAsset ? (
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
              Silakan pilih aset terlebih dahulu di atas untuk melihat riwayat
              laporannya.
            </div>
          ) : relevantReports.length === 0 ? (
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-800">
              ⚠️ <strong>Tidak Ada Laporan Terkait</strong> untuk aset{" "}
              <strong>
                {currentAsset.name} ({currentAsset.code})
              </strong>
              {selectedVendorId ? " pada vendor terpilih ini" : ""}. Pengajuan pergantian vendor mensyaratkan minimal 2 laporan
              berulang yang pernah masuk pada aset tersebut.
            </div>
          ) : (
            <div className="space-y-2">
              {relevantReports.length < 2 && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/70 text-xs text-rose-800">
                  ℹ️ <strong>Perhatian:</strong> Riwayat yang cocok baru memiliki{" "}
                  <strong>{relevantReports.length} laporan valid</strong>.
                  Anda memerlukan minimal 2 laporan berulang pada aset yang sama
                  untuk mengajukan pergantian vendor.
                </div>
              )}

              <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200/90 p-3 bg-slate-50/70 space-y-2.5">
                {relevantReports.map((rep) => {
                  const isChecked = selectedReportIds.includes(rep.id);
                  return (
                    <label
                      key={rep.id}
                      className={`flex items-start gap-3.5 text-xs p-3.5 rounded-xl transition cursor-pointer ${
                        isChecked
                          ? "bg-white border-2 border-emerald-500/70 shadow-2xs hover:border-emerald-600"
                          : "bg-white/90 border border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleReport(rep.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {rep.ticketNo}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                rep.status === "SELESAI"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : rep.status === "DIKERJAKAN" ||
                                    rep.status === "DISETUJUI"
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-sky-100 text-sky-800 border-sky-200"
                              }`}
                            >
                              {rep.status}
                            </span>
                            {rep.vendorName && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                • SPK: {rep.vendorName}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(rep.createdAt).toLocaleDateString(
                              "id-ID",
                              { dateStyle: "medium" }
                            )}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1.5 leading-relaxed">
                          {rep.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Reason Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Alasan Pengajuan Pergantian Vendor{" "}
              <span className="text-rose-600">*</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              {reason.length}/500 karakter
            </span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            required
            rows={3}
            placeholder="Jelaskan alasan mengapa vendor perlu diganti (misal: unit rusak kembali dalam hitungan hari setelah perbaikan, pengerjaan tidak tuntas)."
            className="w-full text-xs sm:text-sm rounded-2xl border border-slate-300 p-3.5 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition"
          />
        </div>

        {/* Submit Action */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Pengajuan akan dikirim ke antrean{" "}
              <strong>Estate Manager Klaster</strong>.
            </span>
          </div>
          <button
            type="submit"
            disabled={
              isPending ||
              selectedReportIds.length < 2 ||
              !selectedAssetId ||
              !selectedVendorId ||
              !reason.trim()
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {isPending
                ? "Mengirim Pengajuan..."
                : `Kirim Pengajuan ke Manager (${selectedReportIds.length}/2 Laporan Terlampir)`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
