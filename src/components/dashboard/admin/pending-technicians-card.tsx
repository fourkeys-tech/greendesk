"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ShieldAlert, CheckCircle2, UserCheck, Wrench } from "lucide-react";
import { approveOrRejectTechnicianAction } from "@/app/actions/phase2-actions";
import {
  FeedbackBanner,
  useActionRunner,
} from "@/components/dashboard/action-feedback";
import { formatWibDate } from "@/lib/dates";

export interface PendingTechnicianItem {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  skills: string[];
  facePhotoUrl: string | null;
  vendor: {
    name: string;
  };
  createdAt: string | Date;
}

interface PendingTechniciansCardProps {
  technicians: PendingTechnicianItem[];
  /** Jumlah total pending (bila daftar dipotong, mis. di dashboard). */
  totalCount?: number;
  /** Sembunyikan kartu sepenuhnya bila tidak ada antrean. */
  hideWhenEmpty?: boolean;
}

export function PendingTechniciansCard({
  technicians,
  totalCount,
  hideWhenEmpty = false,
}: PendingTechniciansCardProps) {
  const { feedback, setFeedback, isPending, run } = useActionRunner();
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const techs = technicians.filter((t) => !handledIds.includes(t.id));
  // Hanya kurangi id yang masih ada di props (setelah revalidasi, props sudah berkurang sendiri).
  const handledStillListed = handledIds.filter((id) =>
    technicians.some((t) => t.id === id)
  ).length;
  const remaining = Math.max(
    0,
    (totalCount ?? technicians.length) - handledStillListed
  );
  const hasMore = remaining > techs.length;

  function markHandled(id: string) {
    setHandledIds((prev) => [...prev, id]);
  }

  function approve(tech: PendingTechnicianItem) {
    run(() => approveOrRejectTechnicianAction(tech.id, "APPROVED"), {
      confirmText: `Setujui ${tech.fullName} (${tech.vendor.name})? Teknisi langsung bisa login dan ditunjuk ke SPK.`,
      onSuccess: () => markHandled(tech.id),
    });
  }

  function submitReject(tech: PendingTechnicianItem) {
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setFeedback({ type: "error", text: "Isi alasan penolakan terlebih dahulu." });
      return;
    }
    run(
      () => approveOrRejectTechnicianAction(tech.id, "REJECTED", cleanReason),
      {
        confirmText: `Tolak pendaftaran ${tech.fullName}? Alasan penolakan akan dikirim ke PIC Vendor.`,
        onSuccess: () => {
          markHandled(tech.id);
          setRejectingId(null);
          setReason("");
        },
      }
    );
  }

  if (techs.length === 0) {
    if (hideWhenEmpty && !feedback) return null;
    return (
      <div className="space-y-2">
        <FeedbackBanner feedback={feedback} />
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Tidak ada teknisi yang menunggu persetujuan.</span>{" "}
              Semua pendaftaran teknisi sudah ditinjau.
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-300 font-bold text-emerald-700 text-[11px] shrink-0">
            0 menunggu
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 sm:p-5 space-y-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-200 text-amber-800 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-amber-950">
              Teknisi Menunggu Persetujuan ({remaining})
            </h2>
            <p className="text-xs text-amber-800">
              Teknisi baru belum bisa login atau ditunjuk ke SPK sebelum disetujui Admin.
            </p>
          </div>
        </div>
        {hasMore && (
          <Link
            href="/dashboard/vendor"
            className="text-xs font-bold text-amber-900 hover:underline"
          >
            Lihat semua →
          </Link>
        )}
      </div>

      <FeedbackBanner feedback={feedback} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {techs.map((tech) => {
          const isRejecting = rejectingId === tech.id;
          return (
            <div
              key={tech.id}
              className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                {tech.facePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tech.facePhotoUrl}
                    alt={`Foto wajah ${tech.fullName}`}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"
                    title="Belum ada foto wajah"
                  >
                    <UserCheck className="w-6 h-6" />
                  </div>
                )}

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-bold text-slate-900 text-sm break-words">
                      {tech.fullName}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {tech.vendor.name}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] break-all">
                    WA: {tech.whatsapp} · {tech.email}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Didaftarkan {formatWibDate(tech.createdAt)}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {tech.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[10px] flex items-center gap-1 font-medium"
                      >
                        <Wrench className="w-2.5 h-2.5 text-slate-400" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {isRejecting ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label
                    htmlFor={`reject-reason-${tech.id}`}
                    className="block text-[11px] font-bold text-slate-700"
                  >
                    Alasan penolakan (dikirim ke PIC Vendor)
                  </label>
                  <textarea
                    id={`reject-reason-${tech.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Mis. Foto wajah tidak jelas, data WhatsApp tidak valid"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:outline-hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitReject(tech)}
                      className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isPending ? "Memproses..." : "Kirim Penolakan"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setRejectingId(null);
                        setReason("");
                      }}
                      className="py-1.5 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => approve(tech)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Setujui</span>
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setRejectingId(tech.id);
                      setReason("");
                      setFeedback(null);
                    }}
                    className="py-1.5 px-3 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tolak</span>
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
