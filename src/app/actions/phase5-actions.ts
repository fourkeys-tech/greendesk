"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { saveUploadedDocument } from "@/lib/storage";
import {
  decideManagerReport,
  getEligibleVendorsForCluster,
  getPendingManagerReports,
} from "@/lib/services/phase5-decision";

export async function decideManagerReportAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const reportId = (formData.get("reportId") as string) ?? "";
    const decision = (formData.get("decision") as "SETUJU" | "TOLAK") ?? "TOLAK";
    const rejectionReason = (formData.get("rejectionReason") as string) ?? undefined;
    const vendorId = (formData.get("vendorId") as string) ?? undefined;
    const notes = (formData.get("notes") as string) ?? undefined;

    let spkFileUrl = (formData.get("spkFileUrl") as string) || undefined;
    let spkFileName = (formData.get("spkFileName") as string) || undefined;
    let spkFileSize: number | undefined = undefined;
    let spkFileMime: string | undefined = undefined;

    const file = formData.get("spkFile") as File | null;
    if (file && file.size > 0) {
      const uploaded = await saveUploadedDocument(file, "spk");
      spkFileUrl = uploaded.url;
      spkFileName = uploaded.fileName;
      spkFileSize = uploaded.sizeBytes;
      spkFileMime = uploaded.mimeType;
    }

    const result = await decideManagerReport(session, {
      reportId,
      decision,
      rejectionReason,
      spkInput: vendorId
        ? {
            vendorId,
            notes,
            spkFileUrl,
            spkFileName,
            spkFileSize,
            spkFileMime,
          }
        : undefined,
    });

    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    return { success: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memproses keputusan perbaikan." };
  }
}

export async function getEligibleVendorsAction(clusterId: string) {
  const session = await getCurrentSession();
  if (!session || !session.companyId) return { error: "Unauthorized" };

  try {
    const vendors = await getEligibleVendorsForCluster(session.companyId, clusterId);
    return { success: true, vendors };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memuat vendor." };
  }
}
