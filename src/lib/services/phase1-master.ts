import crypto from "crypto";
import bcrypt from "bcryptjs";
import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  AssetRow,
  CategoryRow,
  ClusterManagerAssignmentRow,
  ClusterRow,
  ComplexRow,
  ParkRow,
  UserRow,
} from "../db-types";
import { assertPermission } from "../permissions";
import { activeAssignmentSql, reporterInCompanySql } from "../scopes";
import { recordAuditLog } from "../audit";
import { buildAssetPrefix } from "../asset-code";
import type { SessionUser } from "../auth";

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

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

  return withTransaction(async (tx) => {
    const created = await queryOne<ComplexRow>(
      `INSERT INTO "Complex" ("companyId", "name", "address")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [companyId, name, address],
      tx
    );
    if (!created) throw new Error("Gagal membuat komplek.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return created;
  });
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

  const parentComplex = await queryOne<ComplexRow>(
    `SELECT * FROM "Complex" WHERE "id" = $1 AND "companyId" = $2`,
    [input.complexId, companyId]
  );
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

  return withTransaction(async (tx) => {
    const created = await queryOne<ClusterRow>(
      `INSERT INTO "Cluster" ("companyId", "complexId", "name")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [companyId, parentComplex.id, name],
      tx
    );
    if (!created) throw new Error("Gagal membuat cluster.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return created;
  });
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

  const parentCluster = await queryOne<
    ClusterRow & { complexActive: boolean }
  >(
    `SELECT cl.*, cmp."isActive" AS "complexActive"
     FROM "Cluster" cl
     JOIN "Complex" cmp ON cmp."id" = cl."complexId"
     WHERE cl."id" = $1 AND cl."companyId" = $2`,
    [input.clusterId, companyId]
  );
  if (!parentCluster) {
    throw new Error(
      "Hierarki tidak valid: Cluster induk tidak ditemukan di perusahaan Anda."
    );
  }
  if (!parentCluster.isActive || !parentCluster.complexActive) {
    throw new Error(
      "Cluster induk (atau komplek di atasnya) sedang nonaktif. Aktifkan terlebih dahulu."
    );
  }

  return withTransaction(async (tx) => {
    const created = await queryOne<ParkRow>(
      `INSERT INTO "Park" ("companyId", "clusterId", "name", "locationNote")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, parentCluster.id, name, input.locationNote?.trim() || null],
      tx
    );
    if (!created) throw new Error("Gagal membuat taman.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return created;
  });
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

  return withTransaction(async (tx) => {
    const created = await queryOne<CategoryRow>(
      `INSERT INTO "Category" ("companyId", "name", "damageTypes")
       VALUES ($1, $2, $3::text[])
       RETURNING *`,
      [companyId, name, cleanDamageTypes],
      tx
    );
    if (!created) throw new Error("Gagal membuat kategori.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return created;
  });
}

export async function updateCategory(
  actor: SessionUser,
  categoryId: string,
  input: { name: string; damageTypes: string[]; isActive?: boolean }
) {
  const companyId = requireAdminWithCompany(actor);
  const existing = await queryOne<CategoryRow>(
    `SELECT * FROM "Category" WHERE "id" = $1 AND "companyId" = $2`,
    [categoryId, companyId]
  );
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

  const nextIsActive =
    typeof input.isActive === "boolean" ? input.isActive : existing.isActive;

  return withTransaction(async (tx) => {
    const updated = await queryOne<CategoryRow>(
      `UPDATE "Category"
       SET "name" = $2, "damageTypes" = $3::text[], "isActive" = $4, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, name, cleanDamageTypes, nextIsActive],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui kategori.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return updated;
  });
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

  const existingAssets = await query<{ code: string }>(
    `SELECT "code" FROM "Asset" WHERE "companyId" = $1 AND "code" LIKE $2`,
    [companyId, `${prefix}-%`]
  );

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
    queryOne<
      ParkRow & {
        clusterName: string;
        clusterActive: boolean;
        complexName: string;
        complexActive: boolean;
      }
    >(
      `SELECT
         p.*,
         cl."name" AS "clusterName",
         cl."isActive" AS "clusterActive",
         cmp."name" AS "complexName",
         cmp."isActive" AS "complexActive"
       FROM "Park" p
       JOIN "Cluster" cl ON cl."id" = p."clusterId"
       JOIN "Complex" cmp ON cmp."id" = cl."complexId"
       WHERE p."id" = $1 AND p."companyId" = $2`,
      [input.parkId, companyId]
    ),
    queryOne<CategoryRow>(
      `SELECT * FROM "Category" WHERE "id" = $1 AND "companyId" = $2`,
      [input.categoryId, companyId]
    ),
  ]);

  if (!park) {
    throw new Error(
      "Hierarki tidak valid: Taman induk tidak ditemukan di perusahaan Anda."
    );
  }
  if (!category) {
    throw new Error("Kategori aset tidak ditemukan di perusahaan Anda.");
  }
  if (!park.isActive || !park.clusterActive || !park.complexActive) {
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
    code = await generateNextAssetCode(
      companyId,
      park.complexName || "KMP",
      park.clusterName,
      park.name,
      category.name
    );
  }

  const existingCode = await queryOne<{ id: string }>(
    `SELECT "id" FROM "Asset" WHERE "code" = $1`,
    [code]
  );
  if (existingCode) {
    throw new Error(`Kode aset ${code} sudah digunakan oleh aset lain.`);
  }

  return withTransaction(async (tx) => {
    const created = await queryOne<AssetRow>(
      `INSERT INTO "Asset" (
         "companyId", "code", "parkId", "categoryId", "name",
         "locationNote", "photoUrl", "installedAt", "isActive"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        companyId,
        code,
        park.id,
        category.id,
        name,
        input.locationNote?.trim() || null,
        input.photoUrl || null,
        input.installedAt || new Date(),
        input.isActive ?? true,
      ],
      tx
    );
    if (!created) throw new Error("Gagal membuat aset.");

    await recordAuditLog(
      {
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
          clusterName: park.clusterName,
          categoryName: category.name,
          isActive: created.isActive,
        },
      },
      tx
    );

    return created;
  });
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

  const uniqueClusterIds = Array.from(new Set(input.clusterIds.filter(Boolean)));
  if (uniqueClusterIds.length === 0) {
    throw new Error("Pilih minimal satu cluster untuk ditautkan.");
  }

  if (input.role === "PENGELOLA" && uniqueClusterIds.length !== 1) {
    throw new Error(
      "Sesuai PRD Bagian 4, akun Pengelola wajib ditautkan tepat ke satu cluster."
    );
  }

  // Validasi semua cluster milik perusahaan ini & aktif
  const validClusters = await query<ClusterRow>(
    `SELECT *
     FROM "Cluster"
     WHERE "id" = ANY($1::text[]) AND "companyId" = $2 AND "isActive" = true`,
    [uniqueClusterIds, companyId]
  );

  if (validClusters.length !== uniqueClusterIds.length) {
    throw new Error(
      "Satu atau lebih cluster tidak valid (bukan milik perusahaan ini atau sedang nonaktif)."
    );
  }

  const existingUser = await queryOne<{ id: string }>(
    `SELECT "id" FROM "User" WHERE "email" = $1`,
    [email]
  );
  if (existingUser) {
    throw new Error(`Email ${email} sudah digunakan oleh akun lain.`);
  }

  // Tidak lagi fallback ke SEED_DEFAULT_PASSWORD (P0-5): bila kosong, buat sandi acak sekali lihat.
  const suppliedPassword = input.password?.trim();
  const temporaryPassword = suppliedPassword ? null : generateTemporaryPassword();
  const rawPassword = suppliedPassword || temporaryPassword!;
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const createdUser = await withTransaction(async (tx) => {
    const user = await queryOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "staffClusterId")
       VALUES ($1, $2, $3, $4, $5::"Role", $6)
       RETURNING *`,
      [
        companyId,
        name,
        email,
        passwordHash,
        input.role,
        input.role === "PENGELOLA" ? validClusters[0].id : null,
      ],
      tx
    );
    if (!user) throw new Error("Gagal membuat akun internal.");

    if (input.role === "MANAGER") {
      await execute(
        `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
         SELECT $1, cid, false FROM unnest($2::text[]) AS cid`,
        [user.id, validClusters.map((c) => c.id)],
        tx
      );
    }

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "User",
        entityId: user.id,
        action: "CREATE",
        summary: `Membuat akun internal ${input.role}: ${user.name} (${user.email})`,
        oldValues: null,
        newValues: {
          name: user.name,
          email: user.email,
          role: user.role,
          clusters: validClusters.map((c) => c.name),
        },
      },
      tx
    );

    return user;
  });

  return { ...createdUser, temporaryPassword };
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
  const existing = await queryOne<ComplexRow>(
    `SELECT * FROM "Complex" WHERE "id" = $1 AND "companyId" = $2`,
    [complexId, companyId]
  );
  if (!existing) throw new Error("Komplek tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  const address = input.address?.trim() ?? existing.address;
  if (!name || !address) throw new Error("Nama komplek dan alamat wajib diisi.");
  const nextIsActive =
    typeof input.isActive === "boolean" ? input.isActive : existing.isActive;

  return withTransaction(async (tx) => {
    const updated = await queryOne<ComplexRow>(
      `UPDATE "Complex"
       SET "name" = $2, "address" = $3, "isActive" = $4, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, name, address, nextIsActive],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui komplek.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return updated;
  });
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
  const existing = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
    [clusterId, companyId]
  );
  if (!existing) throw new Error("Cluster tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  if (!name) throw new Error("Nama cluster wajib diisi.");
  const nextIsActive =
    typeof input.isActive === "boolean" ? input.isActive : existing.isActive;

  return withTransaction(async (tx) => {
    const updated = await queryOne<ClusterRow>(
      `UPDATE "Cluster"
       SET "name" = $2, "isActive" = $3, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, name, nextIsActive],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui cluster.");

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "Cluster",
        entityId: existing.id,
        action: "UPDATE",
        summary: `Memperbarui cluster: ${updated.name}`,
        oldValues: { name: existing.name, isActive: existing.isActive },
        newValues: { name: updated.name, isActive: updated.isActive },
      },
      tx
    );

    return updated;
  });
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
  const existing = await queryOne<ParkRow>(
    `SELECT * FROM "Park" WHERE "id" = $1 AND "companyId" = $2`,
    [parkId, companyId]
  );
  if (!existing) throw new Error("Taman tidak ditemukan di perusahaan Anda.");

  const name = input.name?.trim() ?? existing.name;
  if (!name) throw new Error("Nama taman wajib diisi.");
  const locationNote =
    input.locationNote === undefined
      ? existing.locationNote
      : input.locationNote?.trim() || null;
  const nextIsActive =
    typeof input.isActive === "boolean" ? input.isActive : existing.isActive;

  return withTransaction(async (tx) => {
    const updated = await queryOne<ParkRow>(
      `UPDATE "Park"
       SET "name" = $2, "locationNote" = $3, "isActive" = $4, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, name, locationNote, nextIsActive],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui taman.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return updated;
  });
}

function requireAccountManager(actor: SessionUser): string {
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  return actor.companyId;
}

async function findInternalStaff(companyId: string, userId: string) {
  const target = await queryOne<UserRow & { staffClusterName: string | null }>(
    `SELECT u.*, cl."name" AS "staffClusterName"
     FROM "User" u
     LEFT JOIN "Cluster" cl ON cl."id" = u."staffClusterId"
     WHERE u."id" = $1
       AND u."companyId" = $2
       AND u."role" = ANY($3::"Role"[])`,
    [userId, companyId, ["PENGELOLA", "MANAGER"]]
  );
  if (!target) {
    throw new Error("Akun Pengelola/Manager tidak ditemukan di perusahaan Anda.");
  }

  const managerAssignments =
    target.role === "MANAGER"
      ? await query<{ clusterId: string; clusterName: string }>(
          `SELECT cma."clusterId", cl."name" AS "clusterName"
           FROM "ClusterManagerAssignment" cma
           JOIN "Cluster" cl ON cl."id" = cma."clusterId"
           WHERE cma."userId" = $1 AND cma."isTemporary" = false`,
          [target.id]
        )
      : [];

  return {
    ...target,
    staffCluster: target.staffClusterId
      ? { id: target.staffClusterId, name: target.staffClusterName ?? "" }
      : null,
    managerAssignments: managerAssignments.map((a) => ({
      clusterId: a.clusterId,
      cluster: { id: a.clusterId, name: a.clusterName },
    })),
  };
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
    const clusters = await query<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "id" = ANY($1::text[]) AND "companyId" = $2`,
      [requested, companyId]
    );
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

  return withTransaction(async (tx) => {
    const nextStaffClusterId =
      target.role === "PENGELOLA" ? (newClusterIds[0] ?? null) : target.staffClusterId;
    const user = await queryOne<UserRow>(
      `UPDATE "User"
       SET "name" = $2, "staffClusterId" = $3, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [target.id, name, nextStaffClusterId],
      tx
    );
    if (!user) throw new Error("Gagal memperbarui akun.");

    if (target.role === "MANAGER" && input.clusterIds) {
      await execute(
        `DELETE FROM "ClusterManagerAssignment"
         WHERE "userId" = $1
           AND "isTemporary" = false
           AND NOT ("clusterId" = ANY($2::text[]))`,
        [target.id, newClusterIds],
        tx
      );
      const toCreate = newClusterIds.filter((id) => !oldClusterIds.includes(id));
      if (toCreate.length > 0) {
        await execute(
          `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
           SELECT $1, cid, false FROM unnest($2::text[]) AS cid`,
          [target.id, toCreate],
          tx
        );
      }
    }

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "User",
        entityId: target.id,
        action: "UPDATE",
        summary: `Memperbarui akun ${target.role === "MANAGER" ? "Manager" : "Pengelola"}: ${user.name}`,
        oldValues: { name: target.name, clusters: oldClusterNames },
        newValues: { name: user.name, clusters: newClusterNames },
      },
      tx
    );

    return user;
  });
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

  return withTransaction(async (tx) => {
    let cancelledDelegations = 0;

    const user = await queryOne<UserRow>(
      `UPDATE "User" SET "isActive" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
      [target.id, isActive],
      tx
    );
    if (!user) throw new Error("Gagal mengubah status akun.");

    if (!isActive && target.role === "MANAGER") {
      cancelledDelegations = await execute(
        `UPDATE "ClusterManagerAssignment"
         SET "cancelledAt" = $2, "cancelledById" = $3, "validUntil" = $2
         WHERE "userId" = $1
           AND "isTemporary" = true
           AND "cancelledAt" IS NULL
           AND ("validUntil" IS NULL OR "validUntil" >= $2)`,
        [target.id, now, actor.id],
        tx
      );
    }

    const warnings: string[] = [];
    if (!isActive) {
      if (target.role === "PENGELOLA" && target.staffClusterId) {
        const remaining = await queryCount(
          `SELECT COUNT(*)::int AS count
           FROM "User"
           WHERE "companyId" = $1
             AND "role" = 'PENGELOLA'::"Role"
             AND "staffClusterId" = $2
             AND "isActive" = true`,
          [companyId, target.staffClusterId],
          tx
        );
        if (remaining === 0) {
          warnings.push(
            `${target.staffCluster?.name ?? "Cluster"} kini tidak punya Pengelola aktif.`
          );
        }
      }
      if (target.role === "MANAGER") {
        for (const a of target.managerAssignments) {
          const remaining = await queryCount(
            `SELECT COUNT(*)::int AS count
             FROM "ClusterManagerAssignment" cma
             JOIN "User" u ON u."id" = cma."userId"
             WHERE cma."clusterId" = $1
               AND u."isActive" = true
               AND ${activeAssignmentSql("cma", "$2")}`,
            [a.clusterId, now],
            tx
          );
          if (remaining === 0) {
            warnings.push(`${a.cluster.name} kini tidak punya Manager aktif.`);
          }
        }
      }
    }

    await recordAuditLog(
      {
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
      },
      tx
    );

    return { user, warnings, cancelledDelegations };
  });
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

  const target = await queryOne<UserRow>(
    `SELECT u.*
     FROM "User" u
     WHERE u."id" = $1 AND ${reporterInCompanySql("u", "$2")}`,
    [userId, companyId]
  );
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

  return withTransaction(async (tx) => {
    const updated = await queryOne<UserRow>(
      `UPDATE "User"
       SET "isBlocked" = $2, "blockedReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [target.id, block, block ? cleanReason : null],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui status blokir akun.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return updated;
  });
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
    queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1 AND "companyId" = $2 AND "role" = 'MANAGER'::"Role"`,
      [input.substituteManagerId, companyId]
    ),
    queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1 AND "companyId" = $2 AND "role" = 'MANAGER'::"Role"`,
      [input.replacedManagerId, companyId]
    ),
    queryOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
      [input.clusterId, companyId]
    ),
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
    queryOne<{ id: string }>(
      `SELECT "id" FROM "ClusterManagerAssignment"
       WHERE "userId" = $1 AND "clusterId" = $2 AND "isTemporary" = false LIMIT 1`,
      [repManager.id, cluster.id]
    ),
    queryOne<{ id: string }>(
      `SELECT "id" FROM "ClusterManagerAssignment"
       WHERE "userId" = $1 AND "clusterId" = $2 AND "isTemporary" = false LIMIT 1`,
      [subManager.id, cluster.id]
    ),
    queryOne<{ id: string }>(
      `SELECT "id" FROM "ClusterManagerAssignment"
       WHERE "clusterId" = $1
         AND "isTemporary" = true
         AND "cancelledAt" IS NULL
         AND ("userId" = $2 OR "replacedManagerId" = $3)
         AND "validFrom" <= $4
         AND "validUntil" >= $5
       LIMIT 1`,
      [cluster.id, subManager.id, repManager.id, input.validUntil, input.validFrom]
    ),
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

  return withTransaction(async (tx) => {
    const assignment = await queryOne<ClusterManagerAssignmentRow>(
      `INSERT INTO "ClusterManagerAssignment" (
         "userId", "clusterId", "isTemporary", "replacedManagerId", "validFrom", "validUntil"
       )
       VALUES ($1, $2, true, $3, $4, $5)
       RETURNING *`,
      [subManager.id, cluster.id, repManager.id, input.validFrom, input.validUntil],
      tx
    );
    if (!assignment) throw new Error("Gagal membuat delegasi sementara.");

    await recordAuditLog(
      {
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
      },
      tx
    );

    return assignment;
  });
}

/**
 * Membatalkan delegasi Manager sementara (riwayat tetap tersimpan).
 */
export async function cancelTemporaryManagerAssignment(
  actor: SessionUser,
  assignmentId: string
) {
  const companyId = requireAccountManager(actor);
  const existing = await queryOne<
    ClusterManagerAssignmentRow & { userName: string; clusterName: string }
  >(
    `SELECT cma.*, u."name" AS "userName", cl."name" AS "clusterName"
     FROM "ClusterManagerAssignment" cma
     JOIN "User" u ON u."id" = cma."userId"
     JOIN "Cluster" cl ON cl."id" = cma."clusterId"
     WHERE cma."id" = $1 AND cma."isTemporary" = true AND cl."companyId" = $2`,
    [assignmentId, companyId]
  );
  if (!existing) throw new Error("Delegasi tidak ditemukan di perusahaan Anda.");
  if (existing.cancelledAt) throw new Error("Delegasi ini sudah dibatalkan.");

  const now = new Date();
  if (existing.validUntil && existing.validUntil < now) {
    throw new Error("Delegasi ini sudah selesai dan tidak perlu dibatalkan.");
  }

  return withTransaction(async (tx) => {
    const updated = await queryOne<ClusterManagerAssignmentRow>(
      `UPDATE "ClusterManagerAssignment"
       SET "cancelledAt" = $2, "cancelledById" = $3, "validUntil" = $2
       WHERE "id" = $1
       RETURNING *`,
      [existing.id, now, actor.id],
      tx
    );
    if (!updated) throw new Error("Gagal membatalkan delegasi.");

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "ClusterManagerAssignment",
        entityId: existing.id,
        action: "UPDATE",
        summary: `Membatalkan delegasi ${existing.userName} di ${existing.clusterName}`,
        oldValues: {
          validUntil: existing.validUntil?.toISOString() ?? null,
          cancelledAt: null,
        },
        newValues: {
          validUntil: now.toISOString(),
          cancelledAt: now.toISOString(),
        },
      },
      tx
    );

    return updated;
  });
}
