"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import {
  archiveReportById,
  restoreArchivedReportById,
  updateAssetMasterData,
} from "@/lib/services/foundation";

/**
 * Mengubah data master Aset (mencatat riwayat perubahan otomatis di AuditLog).
 */
export async function updateAssetMasterAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Sesi tidak ditemukan. Silakan login kembali." };
  }

  try {
    const assetId = formData.get("assetId") as string;
    const name = (formData.get("name") as string)?.trim();
    const locationNote = (formData.get("locationNote") as string)?.trim();
    const isActive = formData.get("isActive") === "true";

    await updateAssetMasterData(session, assetId, {
      name,
      locationNote,
      isActive,
    });

    revalidatePath("/dashboard/wilayah");
    revalidatePath("/dashboard/wilayah/cetak-qr");
    revalidatePath("/dashboard/audit");

    return {
      success: true,
      message: "Data aset berhasil diperbarui dan tercatat di Riwayat Perubahan.",
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal memperbarui aset.",
    };
  }
}

/**
 * Mengarsipkan laporan (soft archive menggunakan archivedAt).
 */
export async function archiveReportAction(reportId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Silakan login terlebih dahulu." };
  }

  try {
    await archiveReportById(session, reportId);
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/audit");
    return {
      success: true,
      message: "Laporan berhasil diarsipkan (tidak dihapus permanen).",
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal mengarsipkan laporan.",
    };
  }
}

/**
 * Memulihkan laporan dari arsip (dibatasi perusahaan & tercatat di AuditLog).
 */
export async function restoreArchivedReportAction(reportId: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Silakan login terlebih dahulu." };
  }

  try {
    await restoreArchivedReportById(session, reportId);
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/audit");
    return {
      success: true,
      message: "Laporan berhasil dikembalikan dari arsip.",
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal memulihkan laporan.",
    };
  }
}
