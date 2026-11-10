"use client";

import { Check, Lock } from "lucide-react";
import { updateUserProfileAction } from "@/app/actions/auth-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";

export function ProfileForm({
  name,
  email,
  isReporter,
  reporterStatus,
  blockHouseNo,
  dataConsentLabel,
  hasConsent,
}: {
  name: string;
  email: string;
  isReporter: boolean;
  reporterStatus: string | null;
  blockHouseNo: string | null;
  dataConsentLabel: string;
  hasConsent: boolean;
}) {
  const { feedback, isPending, run } = useActionRunner();

  function handleSubmit(fd: FormData) {
    run(async () => {
      const res = await updateUserProfileAction(fd);
      return "error" in res && res.error
        ? { error: res.error }
        : { success: true, message: "Profil berhasil diperbarui." };
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FeedbackBanner feedback={feedback} />

      <div>
        <label
          htmlFor="profile-name"
          className="block text-xs font-bold text-slate-700 mb-1.5"
        >
          Nama Lengkap
        </label>
        <input
          id="profile-name"
          type="text"
          name="name"
          defaultValue={name}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
        />
      </div>

      <div>
        <label
          htmlFor="profile-email"
          className="block text-xs font-bold text-slate-700 mb-1.5"
        >
          Alamat Email (Akun)
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          disabled
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/80 text-sm font-medium text-slate-500 cursor-not-allowed"
        />
        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" />
          <span>Email akun tidak dapat diubah secara langsung.</span>
        </p>
      </div>

      {isReporter && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile-reporter-status"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Status Pelapor (Opsional)
              </label>
              <select
                id="profile-reporter-status"
                name="reporterStatus"
                defaultValue={reporterStatus || ""}
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
              >
                <option value="">-- Pilih Status --</option>
                <option value="WARGA">Warga Perumahan</option>
                <option value="PENGUNJUNG">Pengunjung Umum</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-block"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Blok / Nomor Rumah (Untuk Warga)
              </label>
              <input
                id="profile-block"
                type="text"
                name="blockHouseNo"
                defaultValue={blockHouseNo || ""}
                placeholder="Mis. Blok B2 No. 08"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                name="dataConsent"
                defaultChecked={hasConsent}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Saya menyetujui data laporan dan identitas saya digunakan untuk
                keperluan perbaikan fasilitas taman ({dataConsentLabel}).
              </span>
            </label>
          </div>
        </>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{isPending ? "Menyimpan..." : "Simpan Perubahan Profil"}</span>
        </button>
      </div>
    </form>
  );
}
