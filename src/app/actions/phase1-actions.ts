"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { saveUploadedPhoto } from "@/lib/storage";
import { parseWibDateEnd, parseWibDateStart } from "@/lib/dates";
import {
  assignTemporaryManager,
  cancelTemporaryManagerAssignment,
  createAsset,
  createCategory,
  createCluster,
  createComplex,
  createInternalStaffAccount,
  createPark,
  setInternalAccountActive,
  setUserBlockStatus,
  updateCategory,
  updateCluster,
  updateComplex,
  updateInternalAccount,
  updatePark,
} from "@/lib/services/phase1-master";

type ActionResult = { success: true; message: string } | { error: string };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function parseActiveFlag(formData: FormData): boolean | undefined {
  const raw = formData.get("isActive");
  if (raw === null) return undefined;
  return raw === "true";
}

function revalidateMasterPaths() {
  revalidatePath("/dashboard/wilayah");
  revalidatePath("/dashboard/wilayah/cetak-qr");
  revalidatePath("/dashboard/akun");
  revalidatePath("/dashboard/audit");
  revalidatePath("/dashboard");
}

export async function createComplexAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string) ?? "";
    const address = (formData.get("address") as string) ?? "";
    const created = await createComplex(session, { name, address });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Komplek "${created.name}" berhasil ditambahkan dan tercatat di Riwayat Perubahan Data.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menambahkan komplek.",
    };
  }
}

export async function createClusterAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const complexId = (formData.get("complexId") as string) ?? "";
    const name = (formData.get("name") as string) ?? "";
    const created = await createCluster(session, { complexId, name });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Cluster "${created.name}" berhasil ditambahkan dan tercatat di Riwayat Perubahan Data.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menambahkan cluster.",
    };
  }
}

export async function createParkAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const clusterId = (formData.get("clusterId") as string) ?? "";
    const name = (formData.get("name") as string) ?? "";
    const locationNote = (formData.get("locationNote") as string) ?? "";
    const created = await createPark(session, {
      clusterId,
      name,
      locationNote,
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Taman "${created.name}" berhasil ditambahkan dan tercatat di Riwayat Perubahan Data.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menambahkan taman.",
    };
  }
}

export async function createCategoryAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string) ?? "";
    const damageTypesRaw = (formData.get("damageTypes") as string) ?? "";
    const damageTypes = damageTypesRaw.split(",");
    const created = await createCategory(session, { name, damageTypes });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Kategori "${created.name}" berhasil ditambahkan dan tercatat di Riwayat Perubahan Data.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menambahkan kategori.",
    };
  }
}

export async function updateCategoryAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const categoryId = (formData.get("categoryId") as string) ?? "";
    const name = (formData.get("name") as string) ?? "";
    const damageTypesRaw = (formData.get("damageTypes") as string) ?? "";
    const damageTypes = damageTypesRaw.split(",");
    const updated = await updateCategory(session, categoryId, {
      name,
      damageTypes,
      isActive: parseActiveFlag(formData),
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Kategori "${updated.name}" berhasil diperbarui dan tercatat di Riwayat Perubahan Data.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal memperbarui kategori.",
    };
  }
}

export async function createAssetAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const rawCode = (formData.get("code") as string) ?? "";
    const code = rawCode.trim() ? rawCode.trim() : undefined;
    const parkId = (formData.get("parkId") as string) ?? "";
    const categoryId = (formData.get("categoryId") as string) ?? "";
    const name = (formData.get("name") as string) ?? "";
    const locationNote = (formData.get("locationNote") as string) ?? "";
    const installedAtRaw = (formData.get("installedAt") as string) ?? "";
    const isActive = formData.get("isActive") !== "false";

    let photoUrl: string | null = null;
    const photoFile = formData.get("photo") as File | null;
    if (photoFile && photoFile.size > 0) {
      const saved = await saveUploadedPhoto(photoFile, "assets");
      photoUrl = saved.url;
    }

    const created = await createAsset(session, {
      code,
      parkId,
      categoryId,
      name,
      locationNote,
      photoUrl,
      installedAt: parseWibDateStart(installedAtRaw) ?? new Date(),
      isActive,
    });

    revalidateMasterPaths();
    return {
      success: true,
      message: `Aset "${created.code} - ${created.name}" berhasil dibuat beserta kode QR otomatis.`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menambahkan aset.",
    };
  }
}

export async function createInternalAccountAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string) ?? "";
    const email = (formData.get("email") as string) ?? "";
    const password = (formData.get("password") as string) ?? "";
    const role = (formData.get("role") as "PENGELOLA" | "MANAGER") ?? "PENGELOLA";
    const clusterIds = formData.getAll("clusterIds") as string[];

    const created = await createInternalStaffAccount(session, {
      name,
      email,
      password,
      role,
      clusterIds,
    });

    revalidateMasterPaths();
    return {
      success: true,
      message: `Akun ${created.role} (${created.name}) berhasil dibuat dan ditautkan ke cluster.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal membuat akun internal.",
    };
  }
}

export async function assignTemporaryManagerAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const substituteManagerId =
      (formData.get("substituteManagerId") as string) ?? "";
    const replacedManagerId =
      (formData.get("replacedManagerId") as string) ?? "";
    const clusterId = (formData.get("clusterId") as string) ?? "";
    const validFromRaw = (formData.get("validFrom") as string) ?? "";
    const validUntilRaw = (formData.get("validUntil") as string) ?? "";

    const validFrom = parseWibDateStart(validFromRaw);
    const validUntil = parseWibDateEnd(validUntilRaw);
    if (!validFrom || !validUntil) {
      return { error: "Tanggal mulai dan selesai wajib diisi." };
    }

    await assignTemporaryManager(session, {
      substituteManagerId,
      replacedManagerId,
      clusterId,
      validFrom,
      validUntil,
    });

    revalidateMasterPaths();
    return {
      success: true,
      message:
        "Penunjukan Manager pengganti sementara berhasil disimpan dan tercatat di Riwayat Perubahan Data.",
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal menunjuk manager pengganti.",
    };
  }
}

export async function cancelTemporaryManagerAction(
  assignmentId: string
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    await cancelTemporaryManagerAssignment(session, assignmentId);
    revalidateMasterPaths();
    return { success: true, message: "Delegasi Manager berhasil dibatalkan." };
  } catch (err) {
    return { error: errorMessage(err, "Gagal membatalkan delegasi.") };
  }
}

export async function updateComplexAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const id = (formData.get("id") as string) ?? "";
    const name = formData.get("name") as string | null;
    const address = formData.get("address") as string | null;
    const updated = await updateComplex(session, id, {
      name: name ?? undefined,
      address: address ?? undefined,
      isActive: parseActiveFlag(formData),
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Komplek "${updated.name}" berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui komplek.") };
  }
}

export async function updateClusterAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const id = (formData.get("id") as string) ?? "";
    const name = formData.get("name") as string | null;
    const updated = await updateCluster(session, id, {
      name: name ?? undefined,
      isActive: parseActiveFlag(formData),
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Cluster "${updated.name}" berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui cluster.") };
  }
}

export async function updateParkAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const id = (formData.get("id") as string) ?? "";
    const name = formData.get("name") as string | null;
    const locationNote = formData.get("locationNote") as string | null;
    const updated = await updatePark(session, id, {
      name: name ?? undefined,
      locationNote: locationNote ?? undefined,
      isActive: parseActiveFlag(formData),
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Taman "${updated.name}" berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui taman.") };
  }
}

export async function updateInternalAccountAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const userId = (formData.get("userId") as string) ?? "";
    const name = (formData.get("name") as string | null) ?? undefined;
    const clusterIds = formData.getAll("clusterIds") as string[];
    const updated = await updateInternalAccount(session, userId, {
      name,
      clusterIds: clusterIds.length > 0 ? clusterIds : undefined,
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Akun ${updated.name} berhasil diperbarui.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal memperbarui akun.") };
  }
}

export async function setInternalAccountActiveAction(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const res = await setInternalAccountActive(session, userId, isActive);
    revalidateMasterPaths();
    const extra = [
      res.cancelledDelegations > 0
        ? `${res.cancelledDelegations} delegasi ikut dibatalkan.`
        : "",
      ...res.warnings.map((w) => `Perhatian: ${w}`),
    ]
      .filter(Boolean)
      .join(" ");
    return {
      success: true,
      message: `Akun ${res.user.name} berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.${extra ? ` ${extra}` : ""}`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal mengubah status akun.") };
  }
}

export async function setUserBlockStatusAction(
  userId: string,
  block: boolean,
  reason?: string
): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };
  try {
    const updated = await setUserBlockStatus(session, userId, block, reason);
    revalidateMasterPaths();
    return {
      success: true,
      message: block
        ? `Akun ${updated.name} diblokir dan langsung keluar dari sesi aktifnya.`
        : `Blokir akun ${updated.name} dibuka.`,
    };
  } catch (err) {
    return { error: errorMessage(err, "Gagal mengubah status blokir.") };
  }
}
