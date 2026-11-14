"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { flushEmailOutboxSafely } from "@/lib/email";
import {
  bulkAssignToComplex,
  setClusterManagers,
  setClusterPengelola,
  setClusterVendors,
} from "@/lib/services/cluster-responsibility";
import {
  changeVendorPic,
  setVendorServiceAreas,
} from "@/lib/services/phase2-vendor";

type ActionResult = {
  success?: boolean;
  message?: string;
  error?: string;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function revalidateResponsibilityPaths() {
  revalidatePath("/dashboard/penanggung-jawab");
  revalidatePath("/dashboard/akun");
  revalidatePath("/dashboard/vendor");
  revalidatePath("/dashboard/wilayah");
  revalidatePath("/dashboard/audit");
  revalidatePath("/dashboard");
}

export async function setClusterPengelolaAction(
  clusterId: string,
  userIds: string[]
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await setClusterPengelola(session, clusterId, userIds);
    await revalidateResponsibilityPaths();
    const warn = res.warnings.length > 0 ? ` Perhatian: ${res.warnings.join(" ")}` : "";
    return {
      success: true,
      message: `Daftar Pengelola cluster berhasil diperbarui.${warn}`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui Pengelola cluster.") };
  }
}

export async function setClusterManagersAction(
  clusterId: string,
  userIds: string[]
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await setClusterManagers(session, clusterId, userIds);
    await revalidateResponsibilityPaths();
    const warn = res.warnings.length > 0 ? ` Perhatian: ${res.warnings.join(" ")}` : "";
    return {
      success: true,
      message: `Daftar Manager cluster berhasil diperbarui.${warn}`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui Manager cluster.") };
  }
}

export async function setClusterVendorsAction(
  clusterId: string,
  vendorIds: string[]
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await setClusterVendors(session, clusterId, vendorIds);
    await revalidateResponsibilityPaths();
    const warn = res.warnings.length > 0 ? ` Perhatian: ${res.warnings.join(" ")}` : "";
    return {
      success: true,
      message: `Area layanan Vendor untuk cluster ini berhasil diperbarui.${warn}`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui Vendor cluster.") };
  }
}

export async function bulkAssignToComplexAction(
  complexId: string,
  kind: "manager" | "vendor",
  ids: string[]
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await bulkAssignToComplex(session, complexId, { kind, ids });
    await revalidateResponsibilityPaths();
    const label = kind === "manager" ? "Manager" : "Vendor";
    return {
      success: true,
      message: `${label} berhasil diterapkan ke semua cluster aktif (${res.addedCount} penugasan baru ditambahkan).`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal menerapkan penugasan massal.") };
  }
}

export async function setVendorServiceAreasAction(
  vendorId: string,
  clusterIds: string[]
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await setVendorServiceAreas(session, vendorId, clusterIds);
    await revalidateResponsibilityPaths();
    return {
      success: true,
      message: `Area layanan vendor berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui area layanan vendor.") };
  }
}

export async function changeVendorPicAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const vendorId = (formData.get("vendorId") as string) ?? "";
    const mode = ((formData.get("mode") as string) || "existing") as
      | "existing"
      | "new";
    const deactivateOldPic = formData.get("deactivateOldPic") === "true";

    let res: Awaited<ReturnType<typeof changeVendorPic>>;

    if (mode === "existing") {
      const picUserId = (formData.get("picUserId") as string) ?? "";
      res = await changeVendorPic(session, vendorId, {
        mode: "existing",
        picUserId,
        deactivateOldPic,
      });
    } else {
      const picName = (formData.get("picName") as string) ?? "";
      const picEmail = (formData.get("picEmail") as string) ?? "";
      const picPassword = (formData.get("picPassword") as string) ?? "";
      res = await changeVendorPic(session, vendorId, {
        mode: "new",
        picName,
        picEmail,
        picPassword: picPassword || undefined,
        deactivateOldPic,
      });
      after(() => flushEmailOutboxSafely());
    }

    await revalidateResponsibilityPaths();

    const tempNote = res.temporaryPassword
      ? ` Sandi sementara PIC baru (tampil sekali, catat & berikan): ${res.temporaryPassword}`
      : "";
    const deactNote = res.deactivatedOldPic
      ? " Akun PIC lama telah dinonaktifkan."
      : "";

    return {
      success: true,
      message: `PIC vendor "${res.vendor.name}" berhasil diganti menjadi ${res.newPicUser.name}.${tempNote}${deactNote}`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal mengganti PIC vendor.") };
  }
}
