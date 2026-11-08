"use client";

import { useState, useTransition } from "react";
import {
  assignTemporaryManagerAction,
  createClientAdminOrOwnerAction,
  createInternalAccountAction,
} from "@/app/actions/phase1-actions";

interface InternalAccountFormsProps {
  clusters: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; name: string; email: string }>;
}

export function InternalAccountForms({
  clusters,
  managers,
}: InternalAccountFormsProps) {
  const [activeTab, setActiveTab] = useState<
    "staff" | "substitute" | "platform"
  >("staff");
  const [selectedRole, setSelectedRole] = useState<"PENGELOLA" | "MANAGER">(
    "PENGELOLA"
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    fn: (fd: FormData) => Promise<{
      success?: boolean;
      message?: string;
      error?: string;
    }>
  ) {
    return (formData: FormData) => {
      setFeedback(null);
      startTransition(async () => {
        const res = await fn(formData);
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
        } else if (res.message) {
          setFeedback({ type: "success", text: res.message });
        }
      });
    };
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Panel Fase 1: Pembuatan Akun Internal & Manager Pengganti Sementara
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola penautan Pengelola (1 cluster), Manager (satu/beberapa
            cluster), dan penunjukan Manager Pengganti Sementara.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "staff"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            + Akun Pengelola / Manager
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("substitute")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "substitute"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Tunjuk Manager Pengganti Sementara
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("platform")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "platform"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Otorisasi Pemilik Platform (Admin/Owner)
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

      {/* TAB 1: BUAT AKUN PENGELOLA / MANAGER */}
      {activeTab === "staff" && (
        <form
          action={runAction(createInternalAccountAction)}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Pilih Role Internal
            </label>
            <select
              name="role"
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole(e.target.value as "PENGELOLA" | "MANAGER")
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="PENGELOLA">
                PENGELOLA (Wajib ditautkan ke tepat 1 Cluster)
              </option>
              <option value="MANAGER">
                MANAGER (Dapat ditautkan ke 1 atau beberapa Cluster)
              </option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Mis. Bambang Pamungkas"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alamat Email
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="nama@greenpark.id"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Kata Sandi Awal (Opsional, kosongkan untuk default `.env`)
            </label>
            <input
              type="password"
              name="password"
              placeholder="Minimal 6 karakter"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1.5">
              {selectedRole === "PENGELOLA"
                ? "Pilih 1 Cluster Penugasan Pengelola:"
                : "Pilih Satu atau Beberapa Cluster untuk Manager:"}
            </label>
            <div className="flex flex-wrap gap-3">
              {clusters.map((cl, idx) => (
                <label
                  key={cl.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 cursor-pointer"
                >
                  <input
                    type={selectedRole === "PENGELOLA" ? "radio" : "checkbox"}
                    name="clusterIds"
                    value={cl.id}
                    defaultChecked={idx === 0}
                  />
                  <span className="font-medium text-slate-800">{cl.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Buat Akun & Tautkan Cluster"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: TUNJUK MANAGER PENGGANTI SEMENTARA */}
      {activeTab === "substitute" && (
        <form
          action={runAction(assignTemporaryManagerAction)}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
        >
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="font-bold text-slate-900 text-sm">
              Penunjukan Manager Pengganti Sementara (Tercatat di AuditLog)
            </div>
            <p className="text-slate-600 mt-0.5">
              Saat manager utama berhalangan/cuti, Admin menunjuk manager lain
              sebagai pengganti sementara untuk cluster terkait.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Manager yang Berhalangan (Digantikan)
            </label>
            <select
              name="replacedManagerId"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Manager Pengganti Sementara
            </label>
            <select
              name="substituteManagerId"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Cluster yang Digantikan
            </label>
            <select
              name="clusterId"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {clusters.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Berlaku Mulai Tanggal
            </label>
            <input
              type="date"
              name="validFrom"
              defaultValue="2026-11-08"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Berlaku Sampai Tanggal
            </label>
            <input
              type="date"
              name="validUntil"
              defaultValue="2026-11-22"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending || managers.length < 2}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              {managers.length < 2
                ? "Butuh Min. 2 Akun Manager"
                : "Simpan Penunjukan Sementara"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: OTORISASI PEMILIK PLATFORM (BUAT AKUN ADMIN & OWNER) */}
      {activeTab === "platform" && (
        <form
          action={runAction(createClientAdminOrOwnerAction)}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs"
        >
          <div className="sm:col-span-3">
            <div className="font-bold text-slate-900 text-sm">
              Otorisasi Pemilik Platform: Buat Akun Admin / Owner Perusahaan
              Klien
            </div>
            <p className="text-slate-600 mt-0.5">
              Sesuai User Story Fase 1: Pemilik platform membuat akun Admin dan
              Owner/Direksi atas permintaan resmi perusahaan klien.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Role Tingkat Perusahaan
            </label>
            <select
              name="role"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="OWNER">OWNER / Direksi</option>
              <option value="ADMIN">ADMIN Perusahaan</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nama Lengkap Pejabat
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Mis. Dr. Hendra Wijaya"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Resmi
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="direksi2@greenpark.id"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              Buat Akun Resmi & Catat di AuditLog
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

