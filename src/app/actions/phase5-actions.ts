"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { flushEmailOutboxSafely } from "@/lib/email";
import { assertPermission } from "@/lib/permissions";
import { saveUploadedDocument } from "@/lib/storage";
import {
  decideManagerReport,
  getEligibleVendorsForCluster,
  getManagerAssignedClusterIds,
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

    assertPermission(session.role, "DECIDE_REPAIR");
    if (!session.companyId) throw new Error("Akun Anda tidak memiliki tautan Perusahaan.");
    if (decision === "SETUJU") {
      assertPermission(session.role, "CREATE_SPK");
    }

    // Otorisasi resource sebelum menyimpan upload ke disk.
    const reportScope = await queryOne<{ id: string; clusterId: string; status: string }>(
      `SELECT r."id", p."clusterId", r."status"
       FROM "Report" r
       JOIN "Asset" a ON a."id" = r."assetId"
       JOIN "Park" p ON p."id" = a."parkId"
       WHERE r."id" = $1 AND r."companyId" = $2 AND r."archivedAt" IS NULL`,
      [reportId, session.companyId]
    );
    if (!reportScope || reportScope.status !== "MENUNGGU_KEPUTUSAN") {
      throw new Error("Laporan tidak ditemukan atau tidak dapat diputuskan.");
    }
    const assignedClusterIds = await getManagerAssignedClusterIds(session.id);
    if (!assignedClusterIds.includes(reportScope.clusterId)) {
      throw new Error("Anda tidak memiliki wewenang pada cluster laporan ini.");
    }
    if (decision === "SETUJU") {
      if (!vendorId) throw new Error("Pilihan vendor wajib diisi saat menyetujui perbaikan.");
      const eligibleVendor = await queryOne<{ id: string }>(
        `SELECT v."id"
         FROM "Vendor" v
         WHERE v."id" = $1
           AND v."companyId" = $2
           AND v."isActive" = true
           AND EXISTS (
             SELECT 1 FROM "VendorServiceArea" vsa
             WHERE vsa."vendorId" = v."id" AND vsa."clusterId" = $3
           )`,
        [vendorId, session.companyId, reportScope.clusterId]
      );
      if (!eligibleVendor) throw new Error("Vendor tidak melayani cluster laporan ini.");
    }

    let spkFileUrl = (formData.get("spkFileUrl") as string) || undefined;
    let spkFileName = (formData.get("spkFileName") as string) || undefined;
    let spkFileSize: number | undefined = undefined;
    let spkFileMime: string | undefined = undefined;

    const file = formData.get("spkFile") as File | null;
    if (decision === "SETUJU" && file && file.size > 0) {
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

    after(() => flushEmailOutboxSafely());
    revalidatePath("/dashboard/laporan");
    revalidatePath("/dashboard/spk");
    revalidatePath("/dashboard");

    const safeReport = result.report
      ? (({ statusToken: _omitted, ...report }) => report)(result.report)
      : undefined;
    return {
      success: true,
      result: safeReport ? { ...result, report: safeReport } : result,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memproses keputusan perbaikan." };
  }
}

export async function getEligibleVendorsAction(clusterId: string) {
  const session = await getCurrentSession();
  if (!session || !session.companyId) return { error: "Unauthorized" };

  try {
    assertPermission(session.role, "DECIDE_REPAIR");
    const cluster = await queryOne<{ id: string }>(
      `SELECT "id" FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
      [clusterId, session.companyId]
    );
    if (!cluster) {
      return { error: "Cluster tidak ditemukan pada perusahaan Anda." };
    }
    if (session.role === "MANAGER") {
      const assignedIds = await getManagerAssignedClusterIds(session.id);
      if (!assignedIds.includes(clusterId)) {
        return { error: "Anda tidak memiliki wewenang pada cluster tersebut." };
      }
    }
    const vendors = await getEligibleVendorsForCluster(session.companyId, clusterId);
    return { success: true, vendors };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memuat vendor." };
  }
}
