"use client";

import { useState, useTransition } from "react";
import { decideManagerReportAction } from "@/app/actions/phase5-actions";

interface EligibleVendor {
  id: string;
  name: string;
  warrantyDays: number;
}

interface ManagerDecisionPanelProps {
  reportId: string;
  ticketNo: string;
  clusterId: string;
  eligibleVendors: EligibleVendor[];
  hasWarrantyVendorName?: string | null;
}

export function ManagerDecisionPanel({
  reportId,
  ticketNo,
  clusterId,
  eligibleVendors,
  hasWarrantyVendorName,
}: ManagerDecisionPanelProps) {
  const [mode, setMode] = useState<"IDLE" | "SETUJU" | "TOLAK">("IDLE");
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    eligibleVendors[0]?.id || ""
  );
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [spkFile, setSpkFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleDecision = (decision: "SETUJU" | "TOLAK") => {
    setFeedback(null);
    const fd = new FormData();
    fd.append("reportId", reportId);
    fd.append("decision", decision);

    if (decision === "TOLAK") {
      if (!rejectionReason.trim()) {
        setFeedback({
          type: "error",
          text: "Alasan penolakan perbaikan wajib diisi.",
        });
        return;
      }
      fd.append("rejectionReason", rejectionReason.trim());
    } else {
      if (!selectedVendorId) {
        setFeedback({
          type: "error",
          text: "Silakan pilih vendor yang melayani cluster ini.",
        });
        return;
      }
      if (!spkFile) {
        setFeedback({
          type: "error",
          text: "File Surat Perintah Kerja (SPK) wajib dilampirkan (format PDF/DOC/Scan maks 10 MB) sesuai PRD v0.2 Keputusan 14.",
        });
        return;
      }
      fd.append("vendorId", selectedVendorId);
      fd.append("spkFile", spkFile);
      if (notes.trim()) fd.append("notes", notes.trim());
    }

    startTransition(async () => {
      const res = await decideManagerReportAction(fd);
      if (res?.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text:
            decision === "SETUJU"
              ? "Perbaikan disetujui & SPK berhasil diterbitkan!"
              : "Laporan perbaikan berhasil ditolak.",
        });
        setMode("IDLE");
      }
    });
  };

  return (
    <div className="pt-3 border-t border-slate-200/80 bg-slate-50/70 p-4 rounded-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
            MGR-M2 · Keputusan Manager
          </span>
          <span className="text-xs text-slate-500">
            Pilih tindakan perbaikan untuk tiket <strong className="font-mono">{ticketNo}</strong>
          </span>
        </div>

        {hasWarrantyVendorName && (
          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
            ℹ️ Catatan: Masih dalam garansi {hasWarrantyVendorName}
          </span>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
              : "bg-rose-100 text-rose-900 border border-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {mode === "IDLE" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("SETUJU")}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
          >
            ✓ Setujui & Buat SPK Vendor
          </button>
          <button
            type="button"
            onClick={() => setMode("TOLAK")}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition"
          >
            ✕ Tolak Perbaikan (Wajib Alasan)
          </button>
        </div>
      )}

      {/* Form Setujui & Buat SPK */}
      {mode === "SETUJU" && (
        <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-3">
          <div className="font-bold text-xs text-emerald-900 uppercase">
            Form Terbitkan SPK ke Vendor (MGR-M2a)
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Vendor yang Melayani Cluster Ini (Wajib):
            </label>
            {eligibleVendors.length === 0 ? (
              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                ⚠️ Belum ada vendor yang memiliki area layanan di cluster ini. Daftarkan area layanan vendor terlebih dahulu.
              </div>
            ) : (
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                {eligibleVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (Garansi: {v.warrantyDays} hari)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              File Dokumen Surat Perintah Kerja / SPK (Wajib - Keputusan 14):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setSpkFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-300 rounded-lg p-1 bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Format didukung: PDF, DOCX, scan JPG/PNG (Maks 10 MB). PIC Vendor dan Teknisi wajib dapat mengunduh dokumen ini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Instruksi untuk Vendor (Opsional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis. Mohon dicek bagian engsel dan baut penopang utama."
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || eligibleVendors.length === 0}
              onClick={() => handleDecision("SETUJU")}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
            >
              {isPending ? "Menerbitkan SPK..." : "Konfirmasi Terbitkan SPK"}
            </button>
            <button
              type="button"
              onClick={() => setMode("IDLE")}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Form Tolak Perbaikan */}
      {mode === "TOLAK" && (
        <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-3">
          <div className="font-bold text-xs text-rose-900 uppercase">
            Penolakan Perbaikan oleh Manager (Wajib Alasan)
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Penolakan (Akan dikirim ke email pelapor):
            </label>
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Mis. Kerusakan tergolong estetika ringan dan ditunda hingga jadwal peremajaan semester depan."
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDecision("TOLAK")}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50"
            >
              {isPending ? "Memproses..." : "Konfirmasi Tolak Perbaikan"}
            </button>
            <button
              type="button"
              onClick={() => setMode("IDLE")}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
