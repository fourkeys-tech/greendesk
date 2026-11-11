"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Priority } from "@/lib/db-types";
import { getCurrentSession } from "@/lib/auth";
import { flushEmailOutboxSafely } from "@/lib/email";
import {
  markReportAsInvalid,
  mergeDuplicateReport,
  verifyReportAsValid,
} from "@/lib/services/phase4-verification";

function revalidateVerificationPaths() {
  revalidatePath("/dashboard/laporan");
  revalidatePath("/dashboard/akun");
  revalidatePath("/dashboard");
}

export async function verifyReportValidAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const reportId = (formData.get("reportId") as string) ?? "";
    const priority = ((formData.get("priority") as string) ||
      "NORMAL") as Priority;
    const note = (formData.get("note") as string) ?? "";

    const updated = await verifyReportAsValid(session, {
      reportId,
      priority,
      note,
    });

    after(() => flushEmailOutboxSafely());
    revalidateVerificationPaths();
    return {
      success: true,
      message: `Laporan berhasil dinyatakan VALID (Prioritas: ${updated.priority}) dan diteruskan ke Manager. Email konfirmasi terkirim ke pelapor.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal memverifikasi laporan.",
    };
  }
}

export async function markReportInvalidAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const reportId = (formData.get("reportId") as string) ?? "";
    const reason = (formData.get("reason") as string) ?? "";

    await markReportAsInvalid(session, { reportId, reason });
    after(() => flushEmailOutboxSafely());
    revalidateVerificationPaths();
    return {
      success: true,
      message:
        "Laporan berhasil ditandai TIDAK VALID dan alasan penolakan telah dikirim ke email pelapor.",
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal menandai laporan tidak valid.",
    };
  }
}

export async function mergeDuplicateReportAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const childReportId = (formData.get("childReportId") as string) ?? "";
    const parentReportId = (formData.get("parentReportId") as string) ?? "";

    await mergeDuplicateReport(session, { childReportId, parentReportId });
    after(() => flushEmailOutboxSafely());
    revalidateVerificationPaths();
    return {
      success: true,
      message:
        "Laporan ganda berhasil digabungkan ke laporan induk. Pelapor telah dikabari via email.",
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal menggabungkan laporan.",
    };
  }
}
