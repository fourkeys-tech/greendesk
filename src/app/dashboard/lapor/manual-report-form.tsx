"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitReportAction } from "@/app/actions/phase3-actions";

interface ManualReportFormProps {
  assets: Array<{
    code: string;
    name: string;
    parkName: string;
    clusterName: string;
    categoryName: string;
    damageTypes: string[];
  }>;
  reportsHref?: string;
}

export function ManualReportForm({
  assets,
  reportsHref = "/dashboard/laporan",
}: ManualReportFormProps) {
  const [selectedCode, setSelectedCode] = useState(assets[0]?.code || "");
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    ticketNo?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAsset = assets.find((a) => a.code === selectedCode);

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const res = await submitReportAction(formData);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.success && res.ticketNo) {
        setFeedback({
          type: "success",
          text: res.message,
          ticketNo: res.ticketNo,
        });
        setDescription("");
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Formulir Pelaporan Manual via Dashboard
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Pilih aset taman secara manual, unggah minimal satu foto bukti
          kerusakan, dan tuliskan deskripsi singkat.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium space-y-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div>{feedback.text}</div>
          {feedback.ticketNo && (
            <div>
              <Link
                href={reportsHref}
                className="inline-block px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold"
              >
                Lihat Status Tiket {feedback.ticketNo} →
              </Link>
            </div>
          )}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4 text-xs">
        <input type="hidden" name="channel" value="DASHBOARD" />

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            1. Pilih Aset Taman (Hanya Aset Aktif) *
          </label>
          <select
            name="assetCode"
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
          >
            {assets.map((a) => (
              <option key={a.code} value={a.code}>
                [{a.code}] {a.name} — {a.parkName} ({a.clusterName})
              </option>
            ))}
          </select>
        </div>

        {currentAsset && (
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Klik Cepat Jenis Kerusakan ({currentAsset.categoryName}):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentAsset.damageTypes.map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() =>
                    setDescription((prev) =>
                      prev ? `${prev}, ${dt.toLowerCase()}` : `${dt}: `
                    )
                  }
                  className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-medium cursor-pointer"
                >
                  + {dt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            2. Foto Bukti Kerusakan (Wajib minimal 1 foto) *
          </label>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            3. Deskripsi Singkat Kerusakan (Wajib) *
          </label>
          <textarea
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Jelaskan detail kerusakan yang Anda temukan..."
            className="w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || assets.length === 0}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm cursor-pointer"
        >
          {isPending ? "Mengirim Laporan..." : "Kirim Laporan Kerusakan"}
        </button>
      </form>
    </div>
  );
}

