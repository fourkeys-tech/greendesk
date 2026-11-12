"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { flushEmailOutboxSafely } from "@/lib/email";
import { assertPermission } from "@/lib/permissions";
import { queryOne } from "@/lib/db";
import { saveUploadedPhoto } from "@/lib/storage";
import {
  assignTechnicianToWorkOrder,
  replaceTechnicianForWorkOrder,
  submitWorkResultByTechnician,
  confirmWorkResultByManager,
} from "@/lib/services/phase6-execution";
import {
  submitVendorReplacementRequest,
  decideVendorReplacementByManager,
  forwardVendorReplacementByAdmin,
} from "@/lib/services/vendor-replacement";

function stripReportToken<T extends { report?: { statusToken?: string } }>(
  result: T
) {
  if (!result.report) return result;
  const { statusToken: _omitted, ...safeReport } = result.report;
  return { ...result, report: safeReport };
}

export async function assignTechnicianAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const workOrderId = (formData.get("workOrderId") as string) ?? "";
    const technicianId = (formData.get("technicianId") as string) ?? "";

    const result = await assignTechnicianToWorkOrder(session, {
      workOrderId,
      technicianId,
    });

    after(() => flushEmailOutboxSafely());
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    return { success: true, result: stripReportToken(result) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menugaskan teknisi." };
  }
}

export async function replaceTechnicianAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const workOrderId = (formData.get("workOrderId") as string) ?? "";
    const newTechnicianId = (formData.get("newTechnicianId") as string) ?? "";
    const reason = (formData.get("reason") as string) ?? undefined;

    const result = await replaceTechnicianForWorkOrder(session, {
      workOrderId,
      newTechnicianId,
      reason,
    });

    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    return { success: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengganti teknisi." };
  }
}

export async function submitWorkResultAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    assertPermission(session.role, "SUBMIT_WORK_RESULT");
    const workOrderId = (formData.get("workOrderId") as string) ?? "";
    const notes = (formData.get("notes") as string) ?? undefined;
    const beforeUrls = (formData.getAll("beforePhotoUrls") as string[]).filter(Boolean);
    const afterUrls = (formData.getAll("afterPhotoUrls") as string[]).filter(Boolean);

    if (!session.companyId) throw new Error("Akun Teknisi tidak terhubung ke perusahaan.");
    const ownsActiveWorkOrder = await queryOne<{ id: string }>(
      `SELECT wo."id"
       FROM "WorkOrder" wo
       JOIN "Report" r ON r."id" = wo."reportId"
       JOIN "Technician" t ON t."id" = wo."technicianId"
       JOIN "Vendor" v ON v."id" = wo."vendorId"
       WHERE wo."id" = $1
         AND wo."companyId" = $2
         AND r."companyId" = $2
         AND r."archivedAt" IS NULL
         AND t."userId" = $3
         AND t."companyId" = $2
         AND t."status" = 'ACTIVE'::"TechnicianStatus"
         AND t."approvalStatus" = 'APPROVED'::"ApprovalStatus"
         AND v."companyId" = $2
         AND v."isActive" = true`,
      [workOrderId, session.companyId, session.id]
    );
    if (!ownsActiveWorkOrder) {
      throw new Error("SPK tidak ditemukan atau bukan ditugaskan kepada Anda.");
    }

    // Support direct file uploads
    const beforeFiles = formData.getAll("beforeFiles") as File[];
    for (const file of beforeFiles) {
      if (file && typeof file.size === "number" && file.size > 0) {
        const uploaded = await saveUploadedPhoto(file, "workorders");
        beforeUrls.push(uploaded.url);
      }
    }

    const afterFiles = formData.getAll("afterFiles") as File[];
    for (const file of afterFiles) {
      if (file && typeof file.size === "number" && file.size > 0) {
        const uploaded = await saveUploadedPhoto(file, "workorders");
        afterUrls.push(uploaded.url);
      }
    }

    const result = await submitWorkResultByTechnician(session, {
      workOrderId,
      beforePhotoUrls: beforeUrls,
      afterPhotoUrls: afterUrls,
      notes,
    });

    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    return { success: true, result: stripReportToken(result) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengirimkan hasil perbaikan." };
  }
}

export async function confirmWorkResultAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const workOrderId = (formData.get("workOrderId") as string) ?? "";
    const decision = (formData.get("decision") as "SESUAI" | "BELUM_SESUAI") ?? "SESUAI";
    const revisionNote = (formData.get("revisionNote") as string) ?? undefined;

    const result = await confirmWorkResultByManager(session, {
      workOrderId,
      decision,
      revisionNote,
    });

    after(() => flushEmailOutboxSafely());
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    return { success: true, result: stripReportToken(result) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengonfirmasi hasil perbaikan." };
  }
}

export async function submitVendorReplacementAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const assetId = (formData.get("assetId") as string) ?? "";
    const vendorId = (formData.get("vendorId") as string) ?? "";
    const reason = (formData.get("reason") as string) ?? "";
    const basisReportIds = (formData.getAll("basisReportIds") as string[]).filter(Boolean);

    const result = await submitVendorReplacementRequest(session, {
      assetId,
      vendorId,
      basisReportIds,
      reason,
    });

    revalidatePath("/dashboard/pengajuan-ganti-vendor");
    revalidatePath("/dashboard");

    return { success: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengajukan pergantian vendor." };
  }
}

export async function decideVendorReplacementAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const requestId = (formData.get("requestId") as string) ?? "";
    const decision = (formData.get("decision") as "SETUJU" | "TOLAK") ?? "TOLAK";
    const decisionNote = (formData.get("decisionNote") as string) ?? undefined;

    const result = await decideVendorReplacementByManager(session, {
      requestId,
      decision,
      decisionNote,
    });

    revalidatePath("/dashboard/pengajuan-ganti-vendor");
    revalidatePath("/dashboard");

    return {
      success: true,
      message:
        result.decision === "DISETUJUI"
          ? "Pengajuan disetujui. Admin sudah diberi tahu untuk meneruskan ke Owner."
          : "Pengajuan ditolak. Pengelola sudah diberi tahu.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memutuskan pengajuan." };
  }
}

export async function forwardVendorReplacementAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const requestId = (formData.get("requestId") as string) ?? "";
    const forwardNote = (formData.get("forwardNote") as string) ?? undefined;

    await forwardVendorReplacementByAdmin(session, {
      requestId,
      forwardNote,
    });

    revalidatePath("/dashboard/pengajuan-ganti-vendor");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Pengajuan diteruskan ke Owner / Direksi.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal meneruskan pengajuan ke Owner." };
  }
}
