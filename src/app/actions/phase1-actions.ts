"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { saveUploadedPhoto } from "@/lib/storage";
import {
  assignTemporaryManager,
  createAsset,
  createCategory,
  createClientAdminOrOwnerByPlatform,
  createCluster,
  createComplex,
  createInternalStaffAccount,
  createPark,
  updateCategory,
} from "@/lib/services/phase1-master";

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
      message: `Komplek "${created.name}" berhasil ditambahkan dan tercatat di AuditLog.`,
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
      message: `Cluster "${created.name}" berhasil ditambahkan dan tercatat di AuditLog.`,
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
      message: `Taman "${created.name}" berhasil ditambahkan dan tercatat di AuditLog.`,
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
      message: `Kategori "${created.name}" berhasil ditambahkan dan tercatat di AuditLog.`,
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
    });
    revalidateMasterPaths();
    return {
      success: true,
      message: `Kategori "${updated.name}" berhasil diperbarui dan tercatat di AuditLog.`,
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
    const code = (formData.get("code") as string) ?? "";
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
      installedAt: installedAtRaw ? new Date(installedAtRaw) : new Date(),
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

    if (!validFromRaw || !validUntilRaw) {
      return { error: "Tanggal mulai dan selesai wajib diisi." };
    }

    await assignTemporaryManager(session, {
      substituteManagerId,
      replacedManagerId,
      clusterId,
      validFrom: new Date(validFromRaw),
      validUntil: new Date(validUntilRaw),
    });

    revalidateMasterPaths();
    return {
      success: true,
      message:
        "Penunjukan Manager Pengganti Sementara berhasil disimpan dan tercatat di Riwayat Perubahan Data (AuditLog).",
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

export async function createClientAdminOrOwnerAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) return { error: "Silakan login terlebih dahulu." };

  try {
    const name = (formData.get("name") as string) ?? "";
    const email = (formData.get("email") as string) ?? "";
    const role = (formData.get("role") as "ADMIN" | "OWNER") ?? "OWNER";
    const password = (formData.get("password") as string) ?? "";

    const created = await createClientAdminOrOwnerByPlatform(session, {
      name,
      email,
      role,
      password,
    });

    revalidateMasterPaths();
    return {
      success: true,
      message: `Akun ${created.role} (${created.name}) berhasil dibuat atas permintaan resmi perusahaan klien.`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Gagal membuat akun Admin/Owner.",
    };
  }
}

