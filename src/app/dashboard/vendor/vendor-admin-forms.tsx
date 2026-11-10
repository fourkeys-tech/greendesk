"use client";

import { useState } from "react";
import { Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import {
  approveTechnicianReactivationAction,
  createVendorAction,
  rejectTechnicianReactivationAction,
  runPhase2MaintenanceCronAction,
} from "@/app/actions/phase2-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";
import { VendorFormFields } from "./vendor-form-fields";

export interface ReactivationRequestItem {
  id: string;
  fullName: string;
  email: string;
  vendorName: string;
  reactivationNote: string | null;
  deactivationLabel: string;
}

interface VendorAdminFormsProps {
  clusters: Array<{ id: string; name: string }>;
  reactivationRequests: ReactivationRequestItem[];
  contractStartDefault: string;
  contractEndDefault: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-emerald-600 focus:outline-hidden";

export function VendorAdminForms({
  clusters,
  reactivationRequests,
  contractStartDefault,
  contractEndDefault,
}: VendorAdminFormsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { feedback, isPending, run } = useActionRunner();

  function handleCreateVendor(formData: FormData) {
    run(() => createVendorAction(formData), {
      onSuccess: () => {
        setShowCreateForm(false);
        setFormKey((k) => k + 1);
      },
    });
  }

  function handleRunCron() {
    run(() => runPhase2MaintenanceCronAction(), {
      confirmText:
        "Jalankan pemeriksaan teknisi sekarang? Teknisi tanpa aktivitas 60 hari akan dinonaktifkan dan PIC yang belum konfirmasi 3 bulanan akan diingatkan.",
    });
  }

  return (
    <div className="space-y-5">
      {reactivationRequests.length > 0 && (
        <ReactivationRequestsCard requests={reactivationRequests} />
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tambah Vendor & Pemeriksaan Berkala
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftarkan vendor rekanan beserta akun PIC (email undangan dikirim
              otomatis), atau jalankan pemeriksaan berkala teknisi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleRunCron}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Jalankan Pemeriksaan Teknisi
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              aria-expanded={showCreateForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              {showCreateForm ? (
                <>
                  <X className="w-3.5 h-3.5" /> Tutup Form
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Tambah Vendor
                </>
              )}
            </button>
          </div>
        </div>

        <FeedbackBanner feedback={feedback} />

        {showCreateForm && (
          <form
            key={formKey}
            action={handleCreateVendor}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
          >
            <div className="sm:col-span-2 lg:col-span-3 font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
              1. Data Perusahaan Vendor & Kontrak
            </div>

            <VendorFormFields
              idPrefix="new-vendor"
              clusters={clusters}
              defaults={{
                contractStart: contractStartDefault,
                contractEnd: contractEndDefault,
                warrantyDays: 30,
                clusterIds: clusters[0] ? [clusters[0].id] : [],
              }}
            />

            <div className="sm:col-span-2 lg:col-span-3 font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 pt-2">
              2. Akun PIC Vendor (menerima undangan & SPK)
            </div>

            <div>
              <label htmlFor="new-vendor-pic-name" className="block font-semibold text-slate-700 mb-1">
                Nama Lengkap PIC
              </label>
              <input
                id="new-vendor-pic-name"
                type="text"
                name="picName"
                required
                placeholder="Mis. Hendra Gunawan"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new-vendor-pic-email" className="block font-semibold text-slate-700 mb-1">
                Email PIC (untuk login)
              </label>
              <input
                id="new-vendor-pic-email"
                type="email"
                name="picEmail"
                required
                placeholder="pic@karyahijau.id"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new-vendor-pic-password" className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Awal PIC (opsional)
              </label>
              <input
                id="new-vendor-pic-password"
                type="password"
                name="picPassword"
                autoComplete="new-password"
                placeholder="Kosongkan untuk kata sandi bawaan"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 pt-2">
              <button
                type="submit"
                disabled={isPending || clusters.length === 0}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {isPending ? "Menyimpan..." : "Simpan Vendor & Kirim Undangan PIC"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ReactivationRequestsCard({
  requests,
}: {
  requests: ReactivationRequestItem[];
}) {
  const { feedback, setFeedback, isPending, run } = useActionRunner();
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const items = requests.filter((r) => !handledIds.includes(r.id));

  function approve(item: ReactivationRequestItem) {
    run(() => approveTechnicianReactivationAction(item.id), {
      confirmText: `Aktifkan kembali ${item.fullName} (${item.vendorName})?`,
      onSuccess: () => setHandledIds((prev) => [...prev, item.id]),
    });
  }

  function reject(item: ReactivationRequestItem) {
    const cleanNote = note.trim();
    if (!cleanNote) {
      setFeedback({ type: "error", text: "Isi alasan penolakan terlebih dahulu." });
      return;
    }
    run(() => rejectTechnicianReactivationAction(item.id, cleanNote), {
      confirmText: `Tolak pengajuan aktif kembali ${item.fullName}? Alasan dikirim ke PIC Vendor.`,
      onSuccess: () => {
        setHandledIds((prev) => [...prev, item.id]);
        setRejectingId(null);
        setNote("");
      },
    });
  }

  if (items.length === 0 && !feedback) return null;

  return (
    <div className="bg-sky-50 border border-sky-300 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shrink-0">
          <RotateCcw className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-sky-950">
            Pengajuan Aktif Kembali Teknisi ({items.length})
          </h2>
          <p className="text-xs text-sky-800 mt-0.5">
            Teknisi yang dinonaktifkan sistem atau Admin perlu persetujuan Admin
            sebelum bisa menerima SPK lagi.
          </p>
        </div>
      </div>

      <FeedbackBanner feedback={feedback} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((t) => {
          const isRejecting = rejectingId === t.id;
          return (
            <div
              key={t.id}
              className="bg-white rounded-xl p-4 border border-sky-200 flex flex-col justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-slate-900">{t.fullName}</div>
                <div className="text-slate-600">
                  Vendor: <strong>{t.vendorName}</strong>
                </div>
                <div className="text-slate-500 break-all">{t.email}</div>
                <div className="text-[11px] text-slate-500">{t.deactivationLabel}</div>
                {t.reactivationNote && (
                  <div className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1.5">
                    Catatan PIC: &ldquo;{t.reactivationNote}&rdquo;
                  </div>
                )}
              </div>

              {isRejecting ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label
                    htmlFor={`reactivation-note-${t.id}`}
                    className="block text-[11px] font-bold text-slate-700"
                  >
                    Alasan penolakan (dikirim ke PIC Vendor)
                  </label>
                  <textarea
                    id={`reactivation-note-${t.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => reject(t)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
                    >
                      {isPending ? "Memproses..." : "Kirim Penolakan"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setRejectingId(null);
                        setNote("");
                      }}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => approve(t)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
                  >
                    Setujui Aktif Kembali
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setRejectingId(t.id);
                      setNote("");
                      setFeedback(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 font-semibold cursor-pointer"
                  >
                    Tolak
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
