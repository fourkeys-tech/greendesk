"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ApprovalStatus, TechnicianStatus, VendorType } from "@/lib/db-types";
import { getCurrentSession } from "@/lib/auth";
import { flushEmailOutboxSafely } from "@/lib/email";
import { saveUploadedPhoto } from "@/lib/storage";
import { parseWibDateEnd, parseWibDateStart } from "@/lib/dates";
import {
  approveOrRejectTechnicianByAdmin,
  approveTechnicianReactivationByAdmin,
  confirmTechnicianRosterByPic,
  createVendorWithPic,
  deactivateTechnicianByAdmin,
  registerTechnicianByPic,
  rejectTechnicianReactivationByAdmin,
  requestTechnicianReactivationByPic,
  runPhase2MaintenanceJobAsAdmin,
  setVendorActive,
  updateTechnicianStatusByPic,
  updateVendor,
} from "@/lib/services/phase2-vendor";

const TECHNICIAN_STATUS_LABEL: Record<TechnicianStatus, string> = {
  ACTIVE: "Aktif",
  ON_LEAVE: "Cuti",
  INACTIVE: "Nonaktif",
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function revalidateVendorPaths() {
  revalidatePath("/dashboard/penanggung-jawab");
  revalidatePath("/dashboard/vendor");
  revalidatePath("/dashboard/teknisi");
  revalidatePath("/dashboard/audit");
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

    const { vendor, temporaryPassword } = await createVendorWithPic(session, {
      name,
      type,
      skills: skillsRaw.split(","),
      cooperationScheme,
      contractStart: parseWibDateStart(contractStartRaw),
      contractEnd: parseWibDateEnd(contractEndRaw),
      warrantyDays,
      address,
      npwp,
      clusterIds,
      picName,
      picEmail,
      picPassword,
    });

    after(() => flushEmailOutboxSafely());
    revalidateVendorPaths();
    const tempPassNote = temporaryPassword
      ? ` Sandi sementara PIC (ditampilkan sekali, segera catat & berikan ke PIC): ${temporaryPassword}`
      : "";
    return {
      success: true,
      message: `Vendor "${vendor.name}" beserta akun PIC (${picEmail}) berhasil dibuat. Email undangan sedang dikirim.${tempPassNote}`,
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
    const tempPassNote = tech.temporaryPassword
      ? ` Sandi sementara teknisi (ditampilkan sekali, segera catat): ${tech.temporaryPassword}`
      : "";
    return {
      success: true,
      message: `Teknisi "${tech.fullName}" berhasil didaftarkan dan menunggu persetujuan Admin.${tempPassNote}`,
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
      message: `Status teknisi ${updated.fullName} diubah menjadi ${TECHNICIAN_STATUS_LABEL[updated.status]}.`,
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
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED">,
  reason?: string
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const updated = await approveOrRejectTechnicianByAdmin(
      session,
      technicianId,
      decision,
      reason
    );
    revalidateVendorPaths();
    return {
      success: true,
      message:
        decision === "APPROVED"
          ? `Teknisi ${updated.fullName} disetujui dan kini bisa menerima SPK.`
          : `Pendaftaran teknisi ${updated.fullName} ditolak. PIC Vendor sudah diberi tahu.`,
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
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const res = await runPhase2MaintenanceJobAsAdmin(session);
    revalidateVendorPaths();
    return {
      success: true,
      message: `Pemeriksaan selesai: ${res.deactivatedCount} teknisi yang tidak aktif 60 hari dinonaktifkan, ${res.reminderSentCount} pengingat konfirmasi 3 bulanan dikirim ke PIC Vendor.`,
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


export async function rejectTechnicianReactivationAction(
  technicianId: string,
  note: string
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const updated = await rejectTechnicianReactivationByAdmin(session, technicianId, note);
    revalidateVendorPaths();
    return {
      success: true,
      message: `Pengajuan aktif kembali teknisi ${updated.fullName} ditolak. PIC Vendor sudah diberi tahu.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal menolak pengajuan aktif kembali.") };
  }
}

export async function deactivateTechnicianByAdminAction(
  technicianId: string,
  reason: string
) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const updated = await deactivateTechnicianByAdmin(session, technicianId, reason);
    revalidateVendorPaths();
    return {
      success: true,
      message: `Teknisi ${updated.fullName} dinonaktifkan. Hanya Admin yang bisa mengaktifkannya kembali.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal menonaktifkan teknisi.") };
  }
}

export async function updateVendorAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const vendorId = (formData.get("vendorId") as string) ?? "";
    const updated = await updateVendor(session, vendorId, {
      name: (formData.get("name") as string) ?? "",
      type: ((formData.get("type") as string) || "EXTERNAL") as VendorType,
      skills: ((formData.get("skills") as string) ?? "").split(","),
      cooperationScheme: (formData.get("cooperationScheme") as string) ?? null,
      contractStart: parseWibDateStart(formData.get("contractStart") as string | null),
      contractEnd: parseWibDateEnd(formData.get("contractEnd") as string | null),
      warrantyDays: Number(formData.get("warrantyDays") ?? 30),
      address: (formData.get("address") as string) ?? null,
      npwp: (formData.get("npwp") as string) ?? null,
      clusterIds: formData.has("clusterIds")
        ? (formData.getAll("clusterIds") as string[])
        : undefined,
    });
    revalidateVendorPaths();
    return { success: true, message: `Data vendor "${updated.name}" berhasil diperbarui.` };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui vendor.") };
  }
}

export async function setVendorActiveAction(vendorId: string, isActive: boolean) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const updated = await setVendorActive(session, vendorId, isActive);
    revalidateVendorPaths();
    return {
      success: true,
      message: `Vendor "${updated.name}" berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal mengubah status vendor.") };
  }
}
