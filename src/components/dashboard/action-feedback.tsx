"use client";

import { useState, useTransition } from "react";

export type ActionResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export type Feedback = { type: "success" | "error"; text: string } | null;

/**
 * Pola standar: jalankan server action dalam transition lalu tampilkan feedback sukses/gagal.
 */
export function useActionRunner() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    fn: () => Promise<ActionResponse>,
    options?: { confirmText?: string; onSuccess?: () => void }
  ) {
    if (options?.confirmText && !window.confirm(options.confirmText)) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
        } else {
          setFeedback({
            type: "success",
            text: res.message ?? "Perubahan berhasil disimpan.",
          });
          options?.onSuccess?.();
        }
      } catch {
        setFeedback({
          type: "error",
          text: "Terjadi kesalahan jaringan. Coba lagi.",
        });
      }
    });
  }

  return { feedback, setFeedback, isPending, run };
}

export function FeedbackBanner({
  feedback,
  compact = false,
}: {
  feedback: Feedback;
  compact?: boolean;
}) {
  if (!feedback) return null;
  const color =
    feedback.type === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : "bg-rose-50 border-rose-200 text-rose-800";
  return (
    <div
      role={feedback.type === "error" ? "alert" : "status"}
      className={`rounded-xl border font-medium ${color} ${
        compact ? "px-2.5 py-1.5 text-[11px]" : "p-3.5 text-xs"
      }`}
    >
      {feedback.text}
    </div>
  );
}
