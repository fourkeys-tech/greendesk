"use server";

import { revalidatePath } from "next/cache";
import type { ApprovalStatus, TechnicianStatus, VendorType } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { saveUploadedPhoto } from "@/lib/storage";
import {
  approveOrRejectTechnicianByAdmin,
  approveTechnicianReactivationByAdmin,
  confirmTechnicianRosterByPic,
  createVendorWithPic,
  registerTechnicianByPic,
  requestTechnicianReactivationByPic,
  runPhase2MaintenanceJob,
  updateTechnicianStatusByPic,
} from "@/lib/services/phase2-vendor";

function revalidateVendorPaths() {
  revalidatePath("/dashboard/vendor");
  revalidatePath("/dashboard/teknisi");
  revalidatePath("/dashboard/audit");
  revalidatePath("/dashboard/fondasi");
  revalidatePath("/dashboard");
}

export async function createVendorAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string) ?? "";
    const type = ((formData.get("type") as string) || "EXTERNAL") as VendorType;
    const skillsRaw = (formData.get("skills") as string) ?? "";
    const cooperationScheme =
      (formData.get("cooperationScheme") as string) ?? "";
    const contractStartRaw = (formData.get("contractStart") as string) ?? "";
    const contractEndRaw = (formData.get("contractEnd") as string) ?? "";
    const warrantyDays = Number(formData.get("warrantyDays") ?? 30);
    const address = (formData.get("address") as string) ?? "";
    const npwp = (formData.get("npwp") as string) ?? "";
    const clusterIds = formData.getAll("clusterIds") as string[];
    const picName = (formData.get("picName") as string) ?? "";
    const picEmail = (formData.get("picEmail") as string) ?? "";
    const picPassword = (formData.get("picPassword") as string) ?? "";

    const { vendor } = await createVendorWithPic(session, {
      name,
      type,
      skills: skillsRaw.split(","),
      cooperationScheme,
      contractStart: contractStartRaw ? new Date(contractStartRaw) : null,
      contractEnd: contractEndRaw ? new Date(contractEndRaw) : null,
      warrantyDays,
      address,
      npwp,
      clusterIds,
      picName,
      picEmail,
      picPassword,
    });

    revalidateVendorPaths();
    return {
      success: true,
      message: `Vendor "${vendor.name}" beserta akun PIC (${picEmail}) berhasil dibuat dan email undangan telah dikirim!`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal membuat data vendor.",
    };
  }
}

export async function registerTechnicianAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const fullName = (formData.get("fullName") as string) ?? "";
    const whatsapp = (formData.get("whatsapp") as string) ?? "";
    const email = (formData.get("email") as string) ?? "";
    const skillsRaw = (formData.get("skills") as string) ?? "";
    const password = (formData.get("password") as string) ?? "";

    let facePhotoUrl: string | null = null;
    const photoFile = formData.get("facePhoto") as File | null;
    if (photoFile && photoFile.size > 0) {
      const saved = await saveUploadedPhoto(photoFile, "technicians");
      facePhotoUrl = saved.url;
    }

    const tech = await registerTechnicianByPic(session, {
      fullName,
      whatsapp,
      email,
      facePhotoUrl,
      skills: skillsRaw.split(","),
      password,
    });

    revalidateVendorPaths();
    return {
      success: true,
      message: `Teknisi "${tech.fullName}" berhasil didaftarkan (Status: PENDING). Notifikasi persetujuan telah dikirim ke Admin.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal mendaftarkan teknisi.",
    };
  }
}

export async function updateTechnicianStatusAction(
  technicianId: string,
  newStatus: TechnicianStatus
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const updated = await updateTechnicianStatusByPic(
      session,
      technicianId,
      newStatus
    );
    revalidateVendorPaths();
    return {
      success: true,
      message: `Status teknisi ${updated.fullName} diubah menjadi ${updated.status}.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal mengubah status teknisi.",
    };
  }
}

export async function requestTechnicianReactivationAction(
  technicianId: string,
  note?: string
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const updated = await requestTechnicianReactivationByPic(
      session,
      technicianId,
      note
    );
    revalidateVendorPaths();
    return {
      success: true,
      message: `Pengajuan aktif kembali untuk teknisi ${updated.fullName} berhasil dikirim ke Admin.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal mengajukan aktif kembali teknisi.",
    };
  }
}

export async function approveTechnicianReactivationAction(
  technicianId: string
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const updated = await approveTechnicianReactivationByAdmin(
      session,
      technicianId
    );
    revalidateVendorPaths();
    return {
      success: true,
      message: `Pengaktifan kembali teknisi ${updated.fullName} berhasil disetujui.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal memproses pengaktifan kembali teknisi.",
    };
  }
}

export async function approveOrRejectTechnicianAction(
  technicianId: string,
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED">
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const updated = await approveOrRejectTechnicianByAdmin(
      session,
      technicianId,
      decision
    );
    revalidateVendorPaths();
    return {
      success: true,
      message: `Status persetujuan teknisi ${updated.fullName} berhasil diubah menjadi ${updated.approvalStatus}.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal memproses persetujuan teknisi.",
    };
  }
}

export async function confirmTechnicianRosterAction() {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    await confirmTechnicianRosterByPic(session);
    revalidateVendorPaths();
    return {
      success: true,
      message:
        "Daftar teknisi aktif berhasil dikonfirmasi untuk periode 3 bulan ini.",
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal mengonfirmasi daftar teknisi.",
    };
  }
}

export async function runPhase2MaintenanceCronAction() {
  const session = await getCurrentSession();
  if (!session || !session.companyId) {
    return { error: "Silakan login terlebih dahulu." };
  }

  try {
    const res = await runPhase2MaintenanceJob(session.companyId);
    revalidateVendorPaths();
    return {
      success: true,
      message: `Job Pemeliharaan Selesai: ${res.deactivatedCount} teknisi tidak aktif (60 hari) dinonaktifkan, dan ${res.reminderSentCount} pengingat konfirmasi 3 bulanan dikirim ke PIC Vendor.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal menjalankan job pemeliharaan teknisi.",
    };
  }
}

