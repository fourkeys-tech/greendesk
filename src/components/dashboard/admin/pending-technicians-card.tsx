"use client";

import React, { useState, useTransition } from "react";
import { Check, X, ShieldAlert, CheckCircle2, UserCheck, Wrench } from "lucide-react";
import { approveOrRejectTechnicianAction } from "@/app/actions/phase2-actions";

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
}

export function PendingTechniciansCard({ technicians: initialTechs }: PendingTechniciansCardProps) {
  const [techs, setTechs] = useState<PendingTechnicianItem[]>(initialTechs);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ id: string; message: string; type: "success" | "error" } | null>(null);

  const handleDecision = (id: string, decision: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      const res = await approveOrRejectTechnicianAction(id, decision);
      if (res.success) {
        setTechs((prev) => prev.filter((t) => t.id !== id));
        setFeedback({
          id,
          message: decision === "APPROVED" ? "Teknisi berhasil disetujui & aktif." : "Permohonan teknisi ditolak.",
          type: "success",
        });
      } else {
        setFeedback({
          id,
          message: res.error || "Gagal memproses persetujuan.",
          type: "error",
        });
      }
    });
  };

  if (techs.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold">Antrean Persetujuan Teknisi Bersih:</span> Seluruh teknisi rekanan yang terdaftar telah ditinjau dan berstatus aktif.
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-300 font-bold text-emerald-700 text-[11px] shrink-0">
          0 Pending
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 space-y-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-200 text-amber-800">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-amber-950">
              Persetujuan Teknisi Rekanan Menunggu Aksi ({techs.length})
            </h2>
            <p className="text-xs text-amber-800">
              Sesuai PRD Fase 2: Akun teknisi lapangan hanya dapat menerima penugasan SPK setelah disetujui Admin.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white font-extrabold text-xs">
          Wajib Ditinjau
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : "bg-rose-100 text-rose-800 border border-rose-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {techs.map((tech) => (
          <div
            key={tech.id}
            className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-3">
              {tech.facePhotoUrl ? (
                <img
                  src={tech.facePhotoUrl}
                  alt={tech.fullName}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold text-sm">
                  <UserCheck className="w-6 h-6" />
                </div>
              )}

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 truncate text-sm">
                    {tech.fullName}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    {tech.vendor.name}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] truncate">
                  WA: {tech.whatsapp} · {tech.email}
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

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDecision(tech.id, "APPROVED")}
                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Setujui Akun</span>
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDecision(tech.id, "REJECTED")}
                className="py-1.5 px-3 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
