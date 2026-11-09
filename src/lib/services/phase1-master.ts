import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { assertPermission } from "../permissions";
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
  });
  if (!parentCluster) {
    throw new Error(
      "Hierarki tidak valid: Cluster induk tidak ditemukan di perusahaan Anda."
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
  input: { name: string; damageTypes: string[] }
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
    },
    newValues: {
      name: updated.name,
      damageTypes: updated.damageTypes,
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

  // Validasi semua cluster milik perusahaan ini
  const validClusters = await prisma.cluster.findMany({
    where: {
      id: { in: input.clusterIds },
      companyId,
    },
  });

  if (validClusters.length !== input.clusterIds.length) {
    throw new Error("Satu atau lebih cluster tidak valid untuk perusahaan ini.");
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

/**
 * 7. Penunjukan Manager Pengganti Sementara (Tercatat di AuditLog)
 * User story: "Sebagai Admin, saya menunjuk manager pengganti sementara saat manager berhalangan,
 * dan penunjukan itu tercatat di riwayat."
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
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }

  const companyId = actor.companyId;

  if (input.substituteManagerId === input.replacedManagerId) {
    throw new Error(
      "Manager pengganti tidak boleh sama dengan manager yang digantikan."
    );
  }

  if (input.validUntil <= input.validFrom) {
    throw new Error(
      "Tanggal selesai penunjukan sementara harus setelah tanggal mulai."
    );
  }

  const [subManager, repManager, cluster] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: input.substituteManagerId,
        companyId,
        role: "MANAGER",
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.replacedManagerId,
        companyId,
        role: "MANAGER",
      },
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
  if (!cluster) {
    throw new Error("Cluster tidak ditemukan di perusahaan ini.");
  }

  const assignment = await prisma.clusterManagerAssignment.upsert({
    where: {
      userId_clusterId_isTemporary: {
        userId: subManager.id,
        clusterId: cluster.id,
        isTemporary: true,
      },
    },
    update: {
      replacedManagerId: repManager.id,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    },
    create: {
      userId: subManager.id,
      clusterId: cluster.id,
      isTemporary: true,
      replacedManagerId: repManager.id,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "ClusterManagerAssignment",
    entityId: assignment.id,
    action: "CREATE",
    summary: `Menunjuk ${subManager.name} sebagai Manager Pengganti Sementara untuk ${repManager.name} di ${cluster.name}`,
    oldValues: {
      primaryManager: repManager.name,
      cluster: cluster.name,
    },
    newValues: {
      substituteManager: subManager.name,
      replacedManager: repManager.name,
      cluster: cluster.name,
      isTemporary: true,
      validFrom: input.validFrom.toISOString(),
      validUntil: input.validUntil.toISOString(),
    },
  });

  return assignment;
}

/**
 * 8. Pemilik Platform: Membuat Akun Admin dan Owner/Direksi atas permintaan resmi perusahaan klien
 */
export async function createClientAdminOrOwnerByPlatform(
  actor: SessionUser,
  input: {
    name: string;
    email: string;
    role: "ADMIN" | "OWNER";
    password?: string;
  }
) {
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Perusahaan target tidak ditemukan.");
  }

  const companyId = actor.companyId;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name || !email) {
    throw new Error("Nama dan email wajib diisi.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`Email ${email} sudah terdaftar.`);
  }

  const rawPassword =
    input.password?.trim() || process.env.SEED_DEFAULT_PASSWORD;
  if (!rawPassword) {
    throw new Error("Kata sandi akun wajib diisi.");
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const created = await prisma.user.create({
    data: {
      companyId,
      name,
      email,
      passwordHash,
      role: input.role,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: `${actor.name} (Otorisasi Pemilik Platform)`,
      role: actor.role,
      companyId,
    },
    entityName: "User",
    entityId: created.id,
    action: "CREATE",
    summary: `Pemilik Platform membuat akun ${input.role}: ${created.name} (${created.email})`,
    oldValues: null,
    newValues: {
      name: created.name,
      email: created.email,
      role: created.role,
    },
  });

  return created;
}

