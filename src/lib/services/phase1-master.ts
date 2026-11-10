import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { assertPermission } from "../permissions";
import { activeAssignmentWhere, reporterInCompanyWhere } from "../scopes";
import { recordAuditLog } from "../audit";
import { buildAssetPrefix } from "../asset-code";
import type { SessionUser } from "../auth";

function requireAdminWithCompany(actor: SessionUser): string {
  assertPermission(actor.role, "MANAGE_MASTER_DATA");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  return actor.companyId;
}

/**
 * 1. Kelola Komplek (Tingkat 2 Hierarki Wilayah)
 */
export async function createComplex(
  actor: SessionUser,
  input: { name: string; address: string }
) {
  const companyId = requireAdminWithCompany(actor);
  const name = input.name.trim();
  const address = input.address.trim();

  if (!name || !address) {
    throw new Error("Nama komplek dan alamat wajib diisi.");
  }

  const created = await prisma.complex.create({
    data: {
      companyId,
      name,
      address,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Complex",
    entityId: created.id,
    action: "CREATE",
    summary: `Menambahkan komplek baru: ${created.name}`,
    oldValues: null,
    newValues: { name: created.name, address: created.address },
  });

  return created;
}

/**
 * 2. Kelola Cluster (Tingkat 3 Hierarki Wilayah – Wajib memiliki Komplek di perusahaan yang sama)
 */
export async function createCluster(
  actor: SessionUser,
  input: { complexId: string; name: string }
) {
  const companyId = requireAdminWithCompany(actor);
  const name = input.name.trim();

  if (!name || !input.complexId) {
    throw new Error("Komplek induk dan nama cluster wajib diisi.");
  }

  const parentComplex = await prisma.complex.findFirst({
    where: { id: input.complexId, companyId },
  });
  if (!parentComplex) {
    throw new Error(
      "Hierarki tidak valid: Komplek induk tidak ditemukan di perusahaan Anda."
    );
  }
  if (!parentComplex.isActive) {
    throw new Error(
      "Komplek induk sedang nonaktif. Aktifkan komplek terlebih dahulu."
    );
  }

  const created = await prisma.cluster.create({
    data: {
      companyId,
      complexId: parentComplex.id,
      name,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Cluster",
    entityId: created.id,
    action: "CREATE",
    summary: `Menambahkan cluster baru: ${created.name} di komplek ${parentComplex.name}`,
    oldValues: null,
    newValues: {
      name: created.name,
      complexId: parentComplex.id,
      complexName: parentComplex.name,
    },
  });

  return created;
}

/**
 * 3. Kelola Taman (Tingkat 4 Hierarki Wilayah – Wajib memiliki Cluster di perusahaan yang sama)
 */
export async function createPark(
  actor: SessionUser,
  input: { clusterId: string; name: string; locationNote?: string }
) {
  const companyId = requireAdminWithCompany(actor);
  const name = input.name.trim();

  if (!name || !input.clusterId) {
    throw new Error("Cluster induk dan nama taman wajib diisi.");
  }

  const parentCluster = await prisma.cluster.findFirst({
    where: { id: input.clusterId, companyId },
    include: { complex: true },
  });
  if (!parentCluster) {
    throw new Error(
      "Hierarki tidak valid: Cluster induk tidak ditemukan di perusahaan Anda."
    );
  }
  if (!parentCluster.isActive || !parentCluster.complex.isActive) {
    throw new Error(
      "Cluster induk (atau komplek di atasnya) sedang nonaktif. Aktifkan terlebih dahulu."
    );
  }

  const created = await prisma.park.create({
    data: {
      companyId,
      clusterId: parentCluster.id,
      name,
      locationNote: input.locationNote?.trim() || null,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Park",
    entityId: created.id,
    action: "CREATE",
    summary: `Menambahkan taman baru: ${created.name} di ${parentCluster.name}`,
    oldValues: null,
    newValues: {
      name: created.name,
      clusterName: parentCluster.name,
      locationNote: created.locationNote,
    },
  });

  return created;
}

/**
 * 4. Kelola Kategori Aset & Jenis Kerusakan
 */
export async function createCategory(
  actor: SessionUser,
  input: { name: string; damageTypes: string[] }
) {
  const companyId = requireAdminWithCompany(actor);
  const name = input.name.trim();
  const cleanDamageTypes = input.damageTypes
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (!name || cleanDamageTypes.length === 0) {
    throw new Error(
      "Nama kategori dan minimal satu jenis kerusakan wajib diisi."
    );
  }

  const created = await prisma.category.create({
    data: {
      companyId,
      name,
      damageTypes: cleanDamageTypes,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Category",
    entityId: created.id,
    action: "CREATE",
    summary: `Menambahkan kategori aset: ${created.name}`,
    oldValues: null,
    newValues: {
      name: created.name,
      damageTypes: created.damageTypes,
    },
  });

  return created;
}

export async function updateCategory(
  actor: SessionUser,
  categoryId: string,
  input: { name: string; damageTypes: string[]; isActive?: boolean }
) {
  const companyId = requireAdminWithCompany(actor);
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, companyId },
  });
  if (!existing) {
    throw new Error("Kategori tidak ditemukan di perusahaan Anda.");
  }

  const name = input.name.trim();
  const cleanDamageTypes = input.damageTypes
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (!name || cleanDamageTypes.length === 0) {
    throw new Error(
      "Nama kategori dan minimal satu jenis kerusakan wajib diisi."
    );
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      name,
      damageTypes: cleanDamageTypes,
      isActive:
        typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Category",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Memperbarui kategori aset: ${updated.name}`,
    oldValues: {
      name: existing.name,
      damageTypes: existing.damageTypes,
      isActive: existing.isActive,
    },
    newValues: {
      name: updated.name,
      damageTypes: updated.damageTypes,
      isActive: updated.isActive,
    },
  });

  return updated;
}

/**
 * Helper menghasilkan kode urut otomatis berdasarkan hierarki:
 * [Kompleks]-[Klaster]-[Taman]-[Kategori]-[Seq] (misal: GPR-BGV-TMU-LMP-001)
 */
export async function generateNextAssetCode(
  companyId: string,
  complexName: string,
  clusterName: string,
  parkName: string,
  categoryName: string
): Promise<string> {
  const prefix = buildAssetPrefix(complexName, clusterName, parkName, categoryName);

  const existingAssets = await prisma.asset.findMany({
    where: {
      companyId,
      code: { startsWith: `${prefix}-` },
    },
    select: { code: true },
  });

  let maxSeq = 0;
  for (const a of existingAssets) {
    const parts = a.code.split("-");
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${prefix}-${nextSeq}`;
}

/**
 * 5. Kelola Aset (Tingkat 5 Hierarki Wilayah – Wajib punya Taman & Kategori)
 * Kode aset digenerate otomatis berdasarkan Kompleks > Klaster > Taman > Kategori
 */
export async function createAsset(
  actor: SessionUser,
  input: {
    code?: string;
    parkId: string;
    categoryId: string;
    name: string;
    locationNote?: string;
    photoUrl?: string | null;
    installedAt?: Date | null;
    isActive?: boolean;
  }
) {
  const companyId = requireAdminWithCompany(actor);
  const name = input.name.trim();

  if (!name || !input.parkId || !input.categoryId) {
    throw new Error("Nama aset, taman, dan kategori wajib diisi.");
  }

  const [park, category] = await Promise.all([
    prisma.park.findFirst({
      where: { id: input.parkId, companyId },
      include: {
        cluster: {
          include: {
            complex: true,
          },
        },
      },
    }),
    prisma.category.findFirst({
      where: { id: input.categoryId, companyId },
    }),
  ]);

  if (!park) {
    throw new Error(
      "Hierarki tidak valid: Taman induk tidak ditemukan di perusahaan Anda."
    );
  }
  if (!category) {
    throw new Error("Kategori aset tidak ditemukan di perusahaan Anda.");
  }
  if (
    !park.isActive ||
    !park.cluster.isActive ||
    !park.cluster.complex.isActive
  ) {
    throw new Error(
      "Taman induk (atau cluster/komplek di atasnya) sedang nonaktif. Aktifkan terlebih dahulu."
    );
  }
  if (!category.isActive) {
    throw new Error("Kategori aset sedang nonaktif. Aktifkan terlebih dahulu.");
  }

  // Tentukan kode aset: jika diinput manual (migrasi/test) gunakan itu, jika kosong generate otomatis
  let code = input.code?.trim().toUpperCase();
  if (!code) {
    const complexName = park.cluster.complex?.name || "KMP";
    const clusterName = park.cluster.name;
    const parkName = park.name;
    const categoryName = category.name;

    code = await generateNextAssetCode(
      companyId,
      complexName,
      clusterName,
      parkName,
      categoryName
    );
  }

  const existingCode = await prisma.asset.findUnique({ where: { code } });
  if (existingCode) {
    throw new Error(`Kode aset ${code} sudah digunakan oleh aset lain.`);
  }

  const created = await prisma.asset.create({
    data: {
      companyId,
      code,
      parkId: park.id,
      categoryId: category.id,
      name,
      locationNote: input.locationNote?.trim() || null,
      photoUrl: input.photoUrl || null,
      installedAt: input.installedAt || new Date(),
      isActive: input.isActive ?? true,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Asset",
    entityId: created.id,
    action: "CREATE",
    summary: `Menambahkan aset baru ${created.code} (${created.name}) di ${park.name}`,
    oldValues: null,
    newValues: {
      code: created.code,
      name: created.name,
      parkName: park.name,
      clusterName: park.cluster.name,
      categoryName: category.name,
      isActive: created.isActive,
    },
  });

  return created;
}

/**
 * 6. Buat Akun Internal: Pengelola (ditautkan ke 1 cluster) & Manager (ditautkan ke >= 1 cluster)
 */
export async function createInternalStaffAccount(
  actor: SessionUser,
  input: {
    name: string;
    email: string;
    password?: string;
    role: "PENGELOLA" | "MANAGER";
    clusterIds: string[];
  }
) {
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }

  const companyId = actor.companyId;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name || !email) {
    throw new Error("Nama dan email wajib diisi.");
  }

  if (input.clusterIds.length === 0) {
    throw new Error("Pilih minimal satu cluster untuk ditautkan.");
  }

  if (input.role === "PENGELOLA" && input.clusterIds.length !== 1) {
    throw new Error(
      "Sesuai PRD Bagian 4, akun Pengelola wajib ditautkan tepat ke satu cluster."
    );
  }

  // Validasi semua cluster milik perusahaan ini & aktif
  const validClusters = await prisma.cluster.findMany({
    where: {
      id: { in: input.clusterIds },
      companyId,
      isActive: true,
    },
  });

  if (validClusters.length !== input.clusterIds.length) {
    throw new Error(
      "Satu atau lebih cluster tidak valid (bukan milik perusahaan ini atau sedang nonaktif)."
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error(`Email ${email} sudah digunakan oleh akun lain.`);
  }

  const rawPassword =
    input.password?.trim() || process.env.SEED_DEFAULT_PASSWORD;
  if (!rawPassword) {
    throw new Error("Kata sandi akun wajib diisi.");
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const createdUser = await prisma.user.create({
    data: {
      companyId,
      name,
      email,
      passwordHash,
      role: input.role,
      staffClusterId:
        input.role === "PENGELOLA" ? validClusters[0].id : null,
      managerAssignments:
        input.role === "MANAGER"
          ? {
              create: validClusters.map((c) => ({
                clusterId: c.id,
                isTemporary: false,
              })),
            }
          : undefined,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "User",
    entityId: createdUser.id,
    action: "CREATE",
    summary: `Membuat akun internal ${input.role}: ${createdUser.name} (${createdUser.email})`,
    oldValues: null,
    newValues: {
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      clusters: validClusters.map((c) => c.name),
    },
  });

  return createdUser;
}


function auditActor(actor: SessionUser, companyId: string) {
  return { id: actor.id, name: actor.name, role: actor.role, companyId };
}

/**
 * Edit Komplek (nama, alamat, status aktif). Nama baru tidak mengubah kode aset yang sudah ada.
 */
export async function updateComplex(
  actor: SessionUser,
  complexId: string,
  input: { name?: string; address?: string; isActive?: boolean }
) {
  const companyId = requireAdminWithCompany(actor);
  const existing = await prisma.complex.findFirst({
    where: { id: complexId, companyId },
  });
  if (!existing) throw new Error("Komplek tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  const address = input.address?.trim() ?? existing.address;
  if (!name || !address) throw new Error("Nama komplek dan alamat wajib diisi.");

  const updated = await prisma.complex.update({
    where: { id: existing.id },
    data: {
      name,
      address,
      isActive:
        typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "Complex",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Memperbarui komplek: ${updated.name}`,
    oldValues: {
      name: existing.name,
      address: existing.address,
      isActive: existing.isActive,
    },
    newValues: {
      name: updated.name,
      address: updated.address,
      isActive: updated.isActive,
    },
  });

  return updated;
}

/**
 * Edit Cluster (nama, status aktif).
 */
export async function updateCluster(
  actor: SessionUser,
  clusterId: string,
  input: { name?: string; isActive?: boolean }
) {
  const companyId = requireAdminWithCompany(actor);
  const existing = await prisma.cluster.findFirst({
    where: { id: clusterId, companyId },
  });
  if (!existing) throw new Error("Cluster tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  if (!name) throw new Error("Nama cluster wajib diisi.");

  const updated = await prisma.cluster.update({
    where: { id: existing.id },
    data: {
      name,
      isActive:
        typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "Cluster",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Memperbarui cluster: ${updated.name}`,
    oldValues: { name: existing.name, isActive: existing.isActive },
    newValues: { name: updated.name, isActive: updated.isActive },
  });

  return updated;
}

/**
 * Edit Taman (nama, keterangan lokasi, status aktif).
 */
export async function updatePark(
  actor: SessionUser,
  parkId: string,
  input: { name?: string; locationNote?: string | null; isActive?: boolean }
) {
  const companyId = requireAdminWithCompany(actor);
  const existing = await prisma.park.findFirst({
    where: { id: parkId, companyId },
  });
  if (!existing) throw new Error("Taman tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  if (!name) throw new Error("Nama taman wajib diisi.");
  const locationNote =
    input.locationNote === undefined
      ? existing.locationNote
      : input.locationNote?.trim() || null;

  const updated = await prisma.park.update({
    where: { id: existing.id },
    data: {
      name,
      locationNote,
      isActive:
        typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "Park",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Memperbarui taman: ${updated.name}`,
    oldValues: {
      name: existing.name,
      locationNote: existing.locationNote,
      isActive: existing.isActive,
    },
    newValues: {
      name: updated.name,
      locationNote: updated.locationNote,
      isActive: updated.isActive,
    },
  });

  return updated;
}

function requireAccountManager(actor: SessionUser): string {
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  return actor.companyId;
}

async function findInternalStaff(companyId: string, userId: string) {
  const target = await prisma.user.findFirst({
    where: { id: userId, companyId, role: { in: ["PENGELOLA", "MANAGER"] } },
    include: {
      staffCluster: true,
      managerAssignments: {
        where: { isTemporary: false },
        include: { cluster: true },
      },
    },
  });
  if (!target) {
    throw new Error("Akun Pengelola/Manager tidak ditemukan di perusahaan Anda.");
  }
  return target;
}

/**
 * Edit akun internal (nama & cluster tertaut).
 * Pengelola wajib tepat 1 cluster. Untuk Manager, hanya penugasan permanen yang disinkronkan;
 * delegasi sementara tidak disentuh.
 */
export async function updateInternalAccount(
  actor: SessionUser,
  userId: string,
  input: { name?: string; clusterIds?: string[] }
) {
  const companyId = requireAccountManager(actor);
  const target = await findInternalStaff(companyId, userId);

  const name = input.name?.trim() ?? target.name;
  if (!name) throw new Error("Nama akun wajib diisi.");

  const oldClusterIds =
    target.role === "PENGELOLA"
      ? target.staffClusterId
        ? [target.staffClusterId]
        : []
      : target.managerAssignments.map((a) => a.clusterId);
  const oldClusterNames =
    target.role === "PENGELOLA"
      ? target.staffCluster
        ? [target.staffCluster.name]
        : []
      : target.managerAssignments.map((a) => a.cluster.name);

  let newClusterIds = oldClusterIds;
  let newClusterNames = oldClusterNames;

  if (input.clusterIds) {
    const requested = Array.from(new Set(input.clusterIds.filter(Boolean)));
    if (requested.length === 0) {
      throw new Error("Pilih minimal satu cluster untuk ditautkan.");
    }
    if (target.role === "PENGELOLA" && requested.length !== 1) {
      throw new Error(
        "Sesuai PRD Bagian 4, akun Pengelola wajib ditautkan tepat ke satu cluster."
      );
    }
    const clusters = await prisma.cluster.findMany({
      where: { id: { in: requested }, companyId },
    });
    if (clusters.length !== requested.length) {
      throw new Error("Satu atau lebih cluster tidak valid untuk perusahaan ini.");
    }
    const newlyAdded = clusters.filter((c) => !oldClusterIds.includes(c.id));
    if (newlyAdded.some((c) => !c.isActive)) {
      throw new Error("Cluster yang sedang nonaktif tidak bisa ditautkan.");
    }
    newClusterIds = requested;
    newClusterNames = requested.map(
      (id) => clusters.find((c) => c.id === id)?.name ?? id
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: {
        name,
        staffClusterId:
          target.role === "PENGELOLA" ? newClusterIds[0] ?? null : undefined,
      },
    });

    if (target.role === "MANAGER" && input.clusterIds) {
      await tx.clusterManagerAssignment.deleteMany({
        where: {
          userId: target.id,
          isTemporary: false,
          clusterId: { notIn: newClusterIds },
        },
      });
      const toCreate = newClusterIds.filter((id) => !oldClusterIds.includes(id));
      if (toCreate.length > 0) {
        await tx.clusterManagerAssignment.createMany({
          data: toCreate.map((clusterId) => ({
            userId: target.id,
            clusterId,
            isTemporary: false,
          })),
        });
      }
    }
    return user;
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "User",
    entityId: target.id,
    action: "UPDATE",
    summary: `Memperbarui akun ${target.role === "MANAGER" ? "Manager" : "Pengelola"}: ${updated.name}`,
    oldValues: { name: target.name, clusters: oldClusterNames },
    newValues: { name: updated.name, clusters: newClusterNames },
  });

  return updated;
}

/**
 * Aktifkan / nonaktifkan akun internal (Pengelola/Manager).
 * Menonaktifkan Manager juga membatalkan delegasi sementara yang sedang berjalan/terjadwal miliknya.
 * Mengembalikan peringatan bila ada cluster yang jadi tanpa Manager/Pengelola aktif.
 */
export async function setInternalAccountActive(
  actor: SessionUser,
  userId: string,
  isActive: boolean
) {
  const companyId = requireAccountManager(actor);
  if (actor.id === userId) {
    throw new Error("Anda tidak bisa mengubah status aktif akun sendiri.");
  }
  const target = await findInternalStaff(companyId, userId);
  if (target.isActive === isActive) {
    throw new Error(
      `Akun ${target.name} sudah dalam status ${isActive ? "aktif" : "nonaktif"}.`
    );
  }

  const now = new Date();
  let cancelledDelegations = 0;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: { isActive },
    });
    if (!isActive && target.role === "MANAGER") {
      const res = await tx.clusterManagerAssignment.updateMany({
        where: {
          userId: target.id,
          isTemporary: true,
          cancelledAt: null,
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        data: { cancelledAt: now, cancelledById: actor.id, validUntil: now },
      });
      cancelledDelegations = res.count;
    }
    return user;
  });

  const warnings: string[] = [];
  if (!isActive) {
    if (target.role === "PENGELOLA" && target.staffClusterId) {
      const remaining = await prisma.user.count({
        where: {
          companyId,
          role: "PENGELOLA",
          staffClusterId: target.staffClusterId,
          isActive: true,
        },
      });
      if (remaining === 0) {
        warnings.push(
          `${target.staffCluster?.name ?? "Cluster"} kini tidak punya Pengelola aktif.`
        );
      }
    }
    if (target.role === "MANAGER") {
      for (const a of target.managerAssignments) {
        const remaining = await prisma.clusterManagerAssignment.count({
          where: {
            clusterId: a.clusterId,
            user: { isActive: true },
            ...activeAssignmentWhere(now),
          },
        });
        if (remaining === 0) {
          warnings.push(`${a.cluster.name} kini tidak punya Manager aktif.`);
        }
      }
    }
  }

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "User",
    entityId: target.id,
    action: "UPDATE",
    summary: `${isActive ? "Mengaktifkan" : "Menonaktifkan"} akun ${target.role === "MANAGER" ? "Manager" : "Pengelola"}: ${target.name}`,
    oldValues: { isActive: target.isActive },
    newValues: {
      isActive,
      ...(cancelledDelegations > 0 ? { cancelledDelegations } : {}),
    },
  });

  return { user: updated, warnings, cancelledDelegations };
}

/**
 * Blokir / buka blokir akun pelapor (PRD Bagian 4 & Fase 7). Efek langsung:
 * getCurrentSession menolak akun yang diblokir.
 */
export async function setUserBlockStatus(
  actor: SessionUser,
  userId: string,
  block: boolean,
  reason?: string | null
) {
  assertPermission(actor.role, "BLOCK_USER_ACCOUNT");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  const companyId = actor.companyId;

  const target = await prisma.user.findFirst({
    where: { id: userId, ...reporterInCompanyWhere(companyId) },
  });
  if (!target) {
    throw new Error("Akun pelapor tidak ditemukan di cakupan perusahaan Anda.");
  }

  const cleanReason = reason?.trim() ?? "";
  if (block) {
    if (target.isBlocked) throw new Error(`Akun ${target.name} sudah diblokir.`);
    if (!cleanReason) throw new Error("Alasan pemblokiran wajib diisi.");
  } else if (!target.isBlocked) {
    throw new Error(`Akun ${target.name} tidak sedang diblokir.`);
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: block
      ? { isBlocked: true, blockedReason: cleanReason }
      : { isBlocked: false, blockedReason: null },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "User",
    entityId: target.id,
    action: block ? "BLOCK" : "UNBLOCK",
    summary: block
      ? `Memblokir akun pelapor ${target.name} (${target.email})`
      : `Membuka blokir akun pelapor ${target.name} (${target.email})`,
    oldValues: {
      isBlocked: target.isBlocked,
      blockedReason: target.blockedReason,
    },
    newValues: {
      isBlocked: updated.isBlocked,
      blockedReason: updated.blockedReason,
    },
  });

  return updated;
}

/**
 * 7. Penunjukan Manager Pengganti Sementara (Tercatat di AuditLog)
 * User story: "Sebagai Admin, saya menunjuk manager pengganti sementara saat manager berhalangan,
 * dan penunjukan itu tercatat di riwayat." Setiap penunjukan disimpan sebagai baris baru
 * agar riwayat delegasi tidak tertimpa.
 */
export async function assignTemporaryManager(
  actor: SessionUser,
  input: {
    substituteManagerId: string;
    replacedManagerId: string;
    clusterId: string;
    validFrom: Date;
    validUntil: Date;
  }
) {
  const companyId = requireAccountManager(actor);

  if (input.substituteManagerId === input.replacedManagerId) {
    throw new Error(
      "Manager pengganti tidak boleh sama dengan manager yang digantikan."
    );
  }
  if (
    Number.isNaN(input.validFrom.getTime()) ||
    Number.isNaN(input.validUntil.getTime())
  ) {
    throw new Error("Tanggal mulai dan selesai penunjukan wajib diisi.");
  }
  if (input.validUntil <= input.validFrom) {
    throw new Error(
      "Tanggal selesai penunjukan sementara harus setelah tanggal mulai."
    );
  }
  if (input.validUntil < new Date()) {
    throw new Error(
      "Periode penunjukan sudah lewat. Pilih tanggal yang akan datang."
    );
  }

  const [subManager, repManager, cluster] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.substituteManagerId, companyId, role: "MANAGER" },
    }),
    prisma.user.findFirst({
      where: { id: input.replacedManagerId, companyId, role: "MANAGER" },
    }),
    prisma.cluster.findFirst({
      where: { id: input.clusterId, companyId },
    }),
  ]);

  if (!subManager || !repManager) {
    throw new Error(
      "Manager pengganti atau yang digantikan tidak ditemukan di perusahaan ini."
    );
  }
  if (!subManager.isActive || !repManager.isActive) {
    throw new Error(
      "Manager pengganti dan yang digantikan harus berstatus aktif."
    );
  }
  if (!cluster) {
    throw new Error("Cluster tidak ditemukan di perusahaan ini.");
  }
  if (!cluster.isActive) {
    throw new Error("Cluster sedang nonaktif.");
  }

  const [repPermanent, subPermanent, overlap] = await Promise.all([
    prisma.clusterManagerAssignment.findFirst({
      where: { userId: repManager.id, clusterId: cluster.id, isTemporary: false },
    }),
    prisma.clusterManagerAssignment.findFirst({
      where: { userId: subManager.id, clusterId: cluster.id, isTemporary: false },
    }),
    prisma.clusterManagerAssignment.findFirst({
      where: {
        clusterId: cluster.id,
        isTemporary: true,
        cancelledAt: null,
        OR: [{ userId: subManager.id }, { replacedManagerId: repManager.id }],
        validFrom: { lte: input.validUntil },
        validUntil: { gte: input.validFrom },
      },
    }),
  ]);

  if (!repPermanent) {
    throw new Error(
      `${repManager.name} tidak memegang ${cluster.name} secara tetap, jadi tidak bisa digantikan di cluster ini.`
    );
  }
  if (subPermanent) {
    throw new Error(
      `${subManager.name} sudah menjadi Manager tetap di ${cluster.name}; penunjukan sementara tidak diperlukan.`
    );
  }
  if (overlap) {
    throw new Error(
      "Periode ini tumpang-tindih dengan delegasi lain di cluster yang sama. Batalkan delegasi lama atau pilih periode lain."
    );
  }

  const assignment = await prisma.clusterManagerAssignment.create({
    data: {
      userId: subManager.id,
      clusterId: cluster.id,
      isTemporary: true,
      replacedManagerId: repManager.id,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "ClusterManagerAssignment",
    entityId: assignment.id,
    action: "CREATE",
    summary: `Menunjuk ${subManager.name} sebagai Manager Pengganti Sementara untuk ${repManager.name} di ${cluster.name}`,
    oldValues: null,
    newValues: {
      substituteManager: subManager.name,
      replacedManager: repManager.name,
      cluster: cluster.name,
      validFrom: input.validFrom.toISOString(),
      validUntil: input.validUntil.toISOString(),
    },
  });

  return assignment;
}

/**
 * Membatalkan delegasi Manager sementara (riwayat tetap tersimpan).
 */
export async function cancelTemporaryManagerAssignment(
  actor: SessionUser,
  assignmentId: string
) {
  const companyId = requireAccountManager(actor);
  const existing = await prisma.clusterManagerAssignment.findFirst({
    where: { id: assignmentId, isTemporary: true, cluster: { companyId } },
    include: { user: true, cluster: true },
  });
  if (!existing) throw new Error("Delegasi tidak ditemukan di perusahaan Anda.");
  if (existing.cancelledAt) throw new Error("Delegasi ini sudah dibatalkan.");

  const now = new Date();
  if (existing.validUntil && existing.validUntil < now) {
    throw new Error("Delegasi ini sudah selesai dan tidak perlu dibatalkan.");
  }

  const updated = await prisma.clusterManagerAssignment.update({
    where: { id: existing.id },
    data: { cancelledAt: now, cancelledById: actor.id, validUntil: now },
  });

  await recordAuditLog({
    actor: auditActor(actor, companyId),
    entityName: "ClusterManagerAssignment",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Membatalkan delegasi ${existing.user.name} di ${existing.cluster.name}`,
    oldValues: {
      validUntil: existing.validUntil?.toISOString() ?? null,
      cancelledAt: null,
    },
    newValues: {
      validUntil: now.toISOString(),
      cancelledAt: now.toISOString(),
    },
  });

  return updated;
}
