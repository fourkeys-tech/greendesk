import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  ClusterManagerAssignmentRow,
  ClusterRow,
  ComplexRow,
  UserRow,
  VendorRow,
} from "../db-types";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import { activeAssignmentSql } from "../scopes";
import type { SessionUser } from "../auth";

function requireAdmin(actor: SessionUser): string {
  assertPermission(actor.role, "MANAGE_INTERNAL_ACCOUNTS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  return actor.companyId;
}

function auditActor(actor: SessionUser, companyId: string) {
  return { id: actor.id, name: actor.name, role: actor.role, companyId };
}

/* ---------------------------------------------------------------- */
/* Tipe data overview penanggung jawab                               */
/* ---------------------------------------------------------------- */

export type ResponsibilityCluster = {
  id: string;
  name: string;
  isActive: boolean;
  complexId: string;
  complexName: string;
  complexIsActive: boolean;
  pengelola: Array<{ id: string; name: string; email: string; isActive: boolean }>;
  managers: Array<{ id: string; name: string; email: string; isActive: boolean }>;
  substitutes: Array<{
    id: string;
    assignmentId: string;
    name: string;
    email: string;
    validFrom: Date;
    validUntil: Date | null;
    replacedManagerName: string;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    skills: string[];
    picName: string | null;
    picEmail: string | null;
  }>;
  missing: {
    pengelola: boolean;
    manager: boolean;
    vendor: boolean;
  };
  isIncomplete: boolean;
};

export type ResponsibilityComplexGroup = {
  complex: { id: string; name: string; address: string; isActive: boolean };
  clusters: ResponsibilityCluster[];
  totalClusters: number;
  incompleteCount: number;
};

export type ResponsibilityOverview = {
  groups: ResponsibilityComplexGroup[];
  candidates: {
    pengelola: Array<{
      id: string;
      name: string;
      email: string;
      currentClusterId: string | null;
      currentClusterName: string | null;
    }>;
    managers: Array<{ id: string; name: string; email: string }>;
    vendors: Array<{ id: string; name: string; type: string; skills: string[] }>;
  };
  summary: {
    totalComplexes: number;
    totalClusters: number;
    activeClusters: number;
    incompleteClusters: number;
  };
};

/**
 * Memuat ringkasan penanggung jawab semua cluster di perusahaan,
 * dikelompokkan per komplek.
 */
export async function getResponsibilityOverview(
  companyId: string,
  now: Date = new Date()
): Promise<ResponsibilityOverview> {
  const [
    complexRows,
    clusterRows,
    pengelolaRows,
    cmaRows,
    vsaRows,
    candidatePengelolaRows,
    candidateManagerRows,
    candidateVendorRows,
  ] = await Promise.all([
    query<ComplexRow>(
      `SELECT * FROM "Complex"
       WHERE "companyId" = $1
       ORDER BY "isActive" DESC, "name" ASC`,
      [companyId]
    ),
    query<ClusterRow & { complexName: string; complexIsActive: boolean }>(
      `SELECT cl.*, cp."name" AS "complexName", cp."isActive" AS "complexIsActive"
       FROM "Cluster" cl
       JOIN "Complex" cp ON cp."id" = cl."complexId"
       WHERE cl."companyId" = $1
       ORDER BY cp."name" ASC, cl."isActive" DESC, cl."name" ASC`,
      [companyId]
    ),
    query<{
      id: string;
      name: string;
      email: string;
      isActive: boolean;
      staffClusterId: string;
    }>(
      `SELECT u."id", u."name", u."email", u."isActive", u."staffClusterId"
       FROM "User" u
       WHERE u."companyId" = $1
         AND u."role" = 'PENGELOLA'::"Role"
         AND u."staffClusterId" IS NOT NULL
       ORDER BY u."name" ASC`,
      [companyId]
    ),
    query<{
      assignmentId: string;
      userId: string;
      clusterId: string;
      isTemporary: boolean;
      validFrom: Date;
      validUntil: Date | null;
      userName: string;
      userEmail: string;
      userIsActive: boolean;
      replacedManagerName: string | null;
    }>(
      `SELECT cma."id" AS "assignmentId", cma."userId", cma."clusterId",
              cma."isTemporary", cma."validFrom", cma."validUntil",
              u."name" AS "userName", u."email" AS "userEmail", u."isActive" AS "userIsActive",
              rep."name" AS "replacedManagerName"
       FROM "ClusterManagerAssignment" cma
       JOIN "User" u ON u."id" = cma."userId"
       JOIN "Cluster" cl ON cl."id" = cma."clusterId"
       LEFT JOIN "User" rep ON rep."id" = cma."replacedManagerId"
       WHERE cl."companyId" = $1
         AND u."role" = 'MANAGER'::"Role"
         AND (
           cma."isTemporary" = false
           OR (cma."isTemporary" = true AND cma."cancelledAt" IS NULL AND (cma."validUntil" IS NULL OR cma."validUntil" >= $2))
         )
       ORDER BY u."name" ASC`,
      [companyId, now]
    ),
    query<{
      clusterId: string;
      vendorId: string;
      vendorName: string;
      vendorType: string;
      vendorIsActive: boolean;
      skills: string[];
      picName: string | null;
      picEmail: string | null;
    }>(
      `SELECT vsa."clusterId", v."id" AS "vendorId", v."name" AS "vendorName",
              v."type"::text AS "vendorType", v."isActive" AS "vendorIsActive",
              v."skills", u."name" AS "picName", u."email" AS "picEmail"
       FROM "VendorServiceArea" vsa
       JOIN "Vendor" v ON v."id" = vsa."vendorId"
       JOIN "Cluster" cl ON cl."id" = vsa."clusterId"
       LEFT JOIN "User" u ON u."id" = v."picUserId"
       WHERE cl."companyId" = $1
       ORDER BY v."isActive" DESC, v."name" ASC`,
      [companyId]
    ),
    query<{
      id: string;
      name: string;
      email: string;
      currentClusterId: string | null;
      currentClusterName: string | null;
    }>(
      `SELECT u."id", u."name", u."email", u."staffClusterId" AS "currentClusterId",
              cl."name" AS "currentClusterName"
       FROM "User" u
       LEFT JOIN "Cluster" cl ON cl."id" = u."staffClusterId"
       WHERE u."companyId" = $1
         AND u."role" = 'PENGELOLA'::"Role"
         AND u."isActive" = true
       ORDER BY u."name" ASC`,
      [companyId]
    ),
    query<{ id: string; name: string; email: string }>(
      `SELECT u."id", u."name", u."email"
       FROM "User" u
       WHERE u."companyId" = $1
         AND u."role" = 'MANAGER'::"Role"
         AND u."isActive" = true
       ORDER BY u."name" ASC`,
      [companyId]
    ),
    query<{ id: string; name: string; type: string; skills: string[] }>(
      `SELECT v."id", v."name", v."type"::text AS "type", v."skills"
       FROM "Vendor" v
       WHERE v."companyId" = $1
         AND v."isActive" = true
       ORDER BY v."name" ASC`,
      [companyId]
    ),
  ]);

  // Indexing relasi per clusterId
  const pengelolaByCluster = new Map<
    string,
    Array<{ id: string; name: string; email: string; isActive: boolean }>
  >();
  for (const p of pengelolaRows) {
    const list = pengelolaByCluster.get(p.staffClusterId) ?? [];
    list.push({ id: p.id, name: p.name, email: p.email, isActive: p.isActive });
    pengelolaByCluster.set(p.staffClusterId, list);
  }

  const managersByCluster = new Map<
    string,
    Array<{ id: string; name: string; email: string; isActive: boolean }>
  >();
  const substitutesByCluster = new Map<
    string,
    Array<{
      id: string;
      assignmentId: string;
      name: string;
      email: string;
      validFrom: Date;
      validUntil: Date | null;
      replacedManagerName: string;
    }>
  >();
  for (const c of cmaRows) {
    if (c.isTemporary) {
      const list = substitutesByCluster.get(c.clusterId) ?? [];
      list.push({
        id: c.userId,
        assignmentId: c.assignmentId,
        name: c.userName,
        email: c.userEmail,
        validFrom: c.validFrom,
        validUntil: c.validUntil,
        replacedManagerName: c.replacedManagerName ?? "-",
      });
      substitutesByCluster.set(c.clusterId, list);
    } else {
      const list = managersByCluster.get(c.clusterId) ?? [];
      list.push({ id: c.userId, name: c.userName, email: c.userEmail, isActive: c.userIsActive });
      managersByCluster.set(c.clusterId, list);
    }
  }

  const vendorsByCluster = new Map<
    string,
    Array<{
      id: string;
      name: string;
      type: string;
      isActive: boolean;
      skills: string[];
      picName: string | null;
      picEmail: string | null;
    }>
  >();
  for (const v of vsaRows) {
    const list = vendorsByCluster.get(v.clusterId) ?? [];
    list.push({
      id: v.vendorId,
      name: v.vendorName,
      type: v.vendorType,
      isActive: v.vendorIsActive,
      skills: v.skills,
      picName: v.picName,
      picEmail: v.picEmail,
    });
    vendorsByCluster.set(v.clusterId, list);
  }

  const clustersByComplex = new Map<string, ResponsibilityCluster[]>();
  let activeClusterCount = 0;
  let incompleteCountTotal = 0;

  for (const cl of clusterRows) {
    const pengelola = pengelolaByCluster.get(cl.id) ?? [];
    const managers = managersByCluster.get(cl.id) ?? [];
    const substitutes = substitutesByCluster.get(cl.id) ?? [];
    const vendors = vendorsByCluster.get(cl.id) ?? [];

    const activePengelola = pengelola.filter((p) => p.isActive);
    const activeManagers = managers.filter((m) => m.isActive);
    const activeSubstitutesNow = substitutes.filter((s) => s.validFrom <= now);
    const activeVendors = vendors.filter((v) => v.isActive);

    const hasPengelola = activePengelola.length > 0;
    const hasManager = activeManagers.length > 0 || activeSubstitutesNow.length > 0;
    const hasVendor = activeVendors.length > 0;

    const clusterIsActive = cl.isActive && cl.complexIsActive;
    if (clusterIsActive) activeClusterCount++;

    const missing = {
      pengelola: !hasPengelola,
      manager: !hasManager,
      vendor: !hasVendor,
    };
    const isIncomplete = clusterIsActive && (missing.pengelola || missing.manager || missing.vendor);
    if (isIncomplete) incompleteCountTotal++;

    const item: ResponsibilityCluster = {
      id: cl.id,
      name: cl.name,
      isActive: cl.isActive,
      complexId: cl.complexId,
      complexName: cl.complexName,
      complexIsActive: cl.complexIsActive,
      pengelola,
      managers,
      substitutes,
      vendors,
      missing,
      isIncomplete,
    };

    const list = clustersByComplex.get(cl.complexId) ?? [];
    list.push(item);
    clustersByComplex.set(cl.complexId, list);
  }

  const groups: ResponsibilityComplexGroup[] = complexRows.map((comp) => {
    const clusters = clustersByComplex.get(comp.id) ?? [];
    const incompleteCount = clusters.filter((c) => c.isIncomplete).length;
    return {
      complex: {
        id: comp.id,
        name: comp.name,
        address: comp.address,
        isActive: comp.isActive,
      },
      clusters,
      totalClusters: clusters.length,
      incompleteCount,
    };
  });

  return {
    groups,
    candidates: {
      pengelola: candidatePengelolaRows,
      managers: candidateManagerRows,
      vendors: candidateVendorRows,
    },
    summary: {
      totalComplexes: complexRows.length,
      totalClusters: clusterRows.length,
      activeClusters: activeClusterCount,
      incompleteClusters: incompleteCountTotal,
    },
  };
}

/**
 * Menghitung jumlah cluster aktif yang belum lengkap (untuk badge di sidebar/header).
 */
export async function countIncompleteClusters(
  companyId: string,
  now: Date = new Date()
): Promise<number> {
  const result = await queryCount(
    `SELECT COUNT(*)::int AS count
     FROM "Cluster" cl
     JOIN "Complex" cp ON cp."id" = cl."complexId"
     WHERE cl."companyId" = $1
       AND cl."isActive" = true
       AND cp."isActive" = true
       AND (
         -- Belum ada Pengelola aktif
         NOT EXISTS (
           SELECT 1 FROM "User" u
           WHERE u."companyId" = $1
             AND u."role" = 'PENGELOLA'::"Role"
             AND u."staffClusterId" = cl."id"
             AND u."isActive" = true
         )
         -- Belum ada Manager aktif (tetap atau pengganti saat ini)
         OR NOT EXISTS (
           SELECT 1 FROM "ClusterManagerAssignment" cma
           JOIN "User" u ON u."id" = cma."userId"
           WHERE cma."clusterId" = cl."id"
             AND u."companyId" = $1
             AND u."isActive" = true
             AND (
               cma."isTemporary" = false
               OR (cma."isTemporary" = true AND ${activeAssignmentSql("cma", "$2")})
             )
         )
         -- Belum ada Vendor aktif di area layanan
         OR NOT EXISTS (
           SELECT 1 FROM "VendorServiceArea" vsa
           JOIN "Vendor" v ON v."id" = vsa."vendorId"
           WHERE vsa."clusterId" = cl."id"
             AND v."companyId" = $1
             AND v."isActive" = true
         )
       )`,
    [companyId, now]
  );
  return result;
}

/* ---------------------------------------------------------------- */
/* Mutasi: Atur Pengelola cluster                                    */
/* ---------------------------------------------------------------- */

export async function setClusterPengelola(
  actor: SessionUser,
  clusterId: string,
  userIds: string[]
): Promise<{ warnings: string[] }> {
  const companyId = requireAdmin(actor);

  const cluster = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
    [clusterId, companyId]
  );
  if (!cluster) throw new Error("Cluster tidak ditemukan di perusahaan Anda.");

  const requestedIds = Array.from(new Set(userIds.filter(Boolean)));
  const requestedUsers =
    requestedIds.length > 0
      ? await query<UserRow>(
          `SELECT * FROM "User"
           WHERE "id" = ANY($1::text[])
             AND "companyId" = $2
             AND "role" = 'PENGELOLA'::"Role"
             AND "isActive" = true`,
          [requestedIds, companyId]
        )
      : [];

  if (requestedUsers.length !== requestedIds.length) {
    throw new Error(
      "Satu atau lebih akun Pengelola tidak valid, nonaktif, atau bukan milik perusahaan ini."
    );
  }

  const existingPengelola = await query<UserRow>(
    `SELECT * FROM "User"
     WHERE "companyId" = $1
       AND "role" = 'PENGELOLA'::"Role"
       AND "staffClusterId" = $2`,
    [companyId, cluster.id]
  );

  const existingIds = new Set(existingPengelola.map((u) => u.id));
  const toAdd = requestedUsers.filter((u) => !existingIds.has(u.id));
  const toRemove = existingPengelola.filter((u) => !requestedIds.includes(u.id));

  const warnings: string[] = [];

  return withTransaction(async (tx) => {
    // Kunci cluster
    await queryOne<{ id: string }>(
      `SELECT "id" FROM "Cluster" WHERE "id" = $1 FOR UPDATE`,
      [cluster.id],
      tx
    );

    // Lepas pengelola lama
    if (toRemove.length > 0) {
      await execute(
        `UPDATE "User"
         SET "staffClusterId" = NULL, "updatedAt" = NOW()
         WHERE "id" = ANY($1::text[])`,
        [toRemove.map((u) => u.id)],
        tx
      );
      for (const u of toRemove) {
        warnings.push(`Pengelola ${u.name} kini tidak ditautkan ke cluster mana pun.`);
      }
    }

    // Tautkan pengelola baru (dan pindahkan bila sebelumnya di cluster lain)
    for (const u of toAdd) {
      if (u.staffClusterId && u.staffClusterId !== cluster.id) {
        // Cek apakah cluster lama jadi kosong pengelola aktif
        const remainingOld = await queryCount(
          `SELECT COUNT(*)::int AS count
           FROM "User"
           WHERE "companyId" = $1
             AND "role" = 'PENGELOLA'::"Role"
             AND "staffClusterId" = $2
             AND "isActive" = true
             AND "id" <> $3`,
          [companyId, u.staffClusterId, u.id],
          tx
        );
        const oldCluster = await queryOne<{ name: string }>(
          `SELECT "name" FROM "Cluster" WHERE "id" = $1`,
          [u.staffClusterId],
          tx
        );
        if (remainingOld === 0) {
          warnings.push(
            `Cluster "${oldCluster?.name ?? "sebelumnya"}" kini tidak punya Pengelola aktif karena ${u.name} dipindah.`
          );
        }
      }

      await execute(
        `UPDATE "User"
         SET "staffClusterId" = $2, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [u.id, cluster.id],
        tx
      );

      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          u.id,
          "Penugasan Cluster Baru",
          `Admin menugaskan Anda sebagai Pengelola di cluster ${cluster.name}.`,
          "/dashboard/laporan",
        ],
        tx
      );
    }

    if (requestedIds.length === 0 && cluster.isActive) {
      warnings.push(`Cluster "${cluster.name}" kini belum memiliki Pengelola aktif.`);
    }

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "Cluster",
        entityId: cluster.id,
        action: "UPDATE",
        summary: `Mengatur Pengelola cluster ${cluster.name} (${requestedUsers.length} orang)`,
        oldValues: {
          pengelola: existingPengelola.map((u) => u.name),
        },
        newValues: {
          pengelola: requestedUsers.map((u) => u.name),
        },
      },
      tx
    );

    return { warnings };
  });
}

/* ---------------------------------------------------------------- */
/* Mutasi: Atur Manager cluster                                      */
/* ---------------------------------------------------------------- */

export async function setClusterManagers(
  actor: SessionUser,
  clusterId: string,
  userIds: string[]
): Promise<{ warnings: string[] }> {
  const companyId = requireAdmin(actor);
  const now = new Date();

  const cluster = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
    [clusterId, companyId]
  );
  if (!cluster) throw new Error("Cluster tidak ditemukan di perusahaan Anda.");

  const requestedIds = Array.from(new Set(userIds.filter(Boolean)));
  const requestedUsers =
    requestedIds.length > 0
      ? await query<UserRow>(
          `SELECT * FROM "User"
           WHERE "id" = ANY($1::text[])
             AND "companyId" = $2
             AND "role" = 'MANAGER'::"Role"
             AND "isActive" = true`,
          [requestedIds, companyId]
        )
      : [];

  if (requestedUsers.length !== requestedIds.length) {
    throw new Error(
      "Satu atau lebih akun Manager tidak valid, nonaktif, atau bukan milik perusahaan ini."
    );
  }

  const existingAssignments = await query<{
    id: string;
    userId: string;
    userName: string;
  }>(
    `SELECT cma."id", cma."userId", u."name" AS "userName"
     FROM "ClusterManagerAssignment" cma
     JOIN "User" u ON u."id" = cma."userId"
     WHERE cma."clusterId" = $1 AND cma."isTemporary" = false`,
    [cluster.id]
  );

  const existingIds = new Set(existingAssignments.map((a) => a.userId));
  const toAdd = requestedUsers.filter((u) => !existingIds.has(u.id));
  const toRemove = existingAssignments.filter((a) => !requestedIds.includes(a.userId));

  // Tolak pelepasan Manager yang masih menjadi replacedManagerId pada delegasi aktif/terjadwal di cluster ini
  if (toRemove.length > 0) {
    const blocked = await query<{ userName: string }>(
      `SELECT u."name" AS "userName"
       FROM "ClusterManagerAssignment" cma
       JOIN "User" u ON u."id" = cma."replacedManagerId"
       WHERE cma."clusterId" = $1
         AND cma."isTemporary" = true
         AND cma."cancelledAt" IS NULL
         AND (cma."validUntil" IS NULL OR cma."validUntil" >= $2)
         AND cma."replacedManagerId" = ANY($3::text[])`,
      [cluster.id, now, toRemove.map((a) => a.userId)]
    );
    if (blocked.length > 0) {
      throw new Error(
        `Tidak dapat melepas ${blocked.map((b) => b.userName).join(", ")} karena sedang digantikan oleh Manager lain di cluster ini. Batalkan delegasi sementara terlebih dahulu.`
      );
    }
  }

  const warnings: string[] = [];

  return withTransaction(async (tx) => {
    await queryOne<{ id: string }>(
      `SELECT "id" FROM "Cluster" WHERE "id" = $1 FOR UPDATE`,
      [cluster.id],
      tx
    );

    // Hapus baris tetap yang dilepas
    if (toRemove.length > 0) {
      await execute(
        `DELETE FROM "ClusterManagerAssignment"
         WHERE "clusterId" = $1
           AND "isTemporary" = false
           AND "userId" = ANY($2::text[])`,
        [cluster.id, toRemove.map((a) => a.userId)],
        tx
      );
    }

    // Tambahkan baris tetap baru
    for (const u of toAdd) {
      // Batalkan delegasi sementara bila Manager ini sebelumnya sedang menjadi pengganti di cluster yang sama
      await execute(
        `UPDATE "ClusterManagerAssignment"
         SET "cancelledAt" = $2, "cancelledById" = $3
         WHERE "clusterId" = $1
           AND "userId" = $4
           AND "isTemporary" = true
           AND "cancelledAt" IS NULL
           AND ("validUntil" IS NULL OR "validUntil" >= $2)`,
        [cluster.id, now, actor.id, u.id],
        tx
      );

      await execute(
        `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
         VALUES ($1, $2, false)`,
        [u.id, cluster.id],
        tx
      );

      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          u.id,
          "Penugasan Cluster Baru",
          `Admin menugaskan Anda sebagai Estate Manager di cluster ${cluster.name}.`,
          "/dashboard/laporan",
        ],
        tx
      );
    }

    if (requestedIds.length === 0 && cluster.isActive) {
      warnings.push(`Cluster "${cluster.name}" kini belum memiliki Manager tetap.`);
    }

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "Cluster",
        entityId: cluster.id,
        action: "UPDATE",
        summary: `Mengatur Manager cluster ${cluster.name} (${requestedUsers.length} orang)`,
        oldValues: {
          managers: existingAssignments.map((a) => a.userName),
        },
        newValues: {
          managers: requestedUsers.map((u) => u.name),
        },
      },
      tx
    );

    return { warnings };
  });
}

/* ---------------------------------------------------------------- */
/* Mutasi: Atur Vendor area layanan cluster                          */
/* ---------------------------------------------------------------- */

export async function setClusterVendors(
  actor: SessionUser,
  clusterId: string,
  vendorIds: string[]
): Promise<{ warnings: string[] }> {
  assertPermission(actor.role, "MANAGE_VENDORS");
  const companyId = requireAdmin(actor);

  const cluster = await queryOne<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = $1 AND "companyId" = $2`,
    [clusterId, companyId]
  );
  if (!cluster) throw new Error("Cluster tidak ditemukan di perusahaan Anda.");

  const requestedIds = Array.from(new Set(vendorIds.filter(Boolean)));
  const requestedVendors =
    requestedIds.length > 0
      ? await query<VendorRow>(
          `SELECT * FROM "Vendor"
           WHERE "id" = ANY($1::text[])
             AND "companyId" = $2
             AND "isActive" = true`,
          [requestedIds, companyId]
        )
      : [];

  if (requestedVendors.length !== requestedIds.length) {
    throw new Error(
      "Satu atau lebih vendor tidak valid, nonaktif, atau bukan milik perusahaan ini."
    );
  }

  const existingAreas = await query<{
    id: string;
    vendorId: string;
    vendorName: string;
  }>(
    `SELECT vsa."id", vsa."vendorId", v."name" AS "vendorName"
     FROM "VendorServiceArea" vsa
     JOIN "Vendor" v ON v."id" = vsa."vendorId"
     WHERE vsa."clusterId" = $1`,
    [cluster.id]
  );

  const existingIds = new Set(existingAreas.map((a) => a.vendorId));
  const toAdd = requestedVendors.filter((v) => !existingIds.has(v.id));
  const toRemove = existingAreas.filter((a) => !requestedIds.includes(a.vendorId));

  // Validasi: vendor tidak boleh kehilangan area layanan terakhirnya (aturan "minimal 1 cluster")
  if (toRemove.length > 0) {
    for (const v of toRemove) {
      const remainingAreas = await queryCount(
        `SELECT COUNT(*)::int AS count
         FROM "VendorServiceArea"
         WHERE "vendorId" = $1 AND "clusterId" <> $2`,
        [v.vendorId, cluster.id]
      );
      if (remainingAreas === 0) {
        throw new Error(
          `Vendor "${v.vendorName}" wajib memiliki minimal satu area layanan. Tambahkan cluster lain ke area layanannya sebelum melepas cluster ini.`
        );
      }
    }
  }

  const warnings: string[] = [];

  // Peringatan bila vendor yang dilepas masih memiliki SPK berjalan di cluster ini
  if (toRemove.length > 0) {
    const openWos = await query<{ vendorName: string; count: number }>(
      `SELECT v."name" AS "vendorName", COUNT(wo."id")::int AS "count"
       FROM "WorkOrder" wo
       JOIN "Report" r ON r."id" = wo."reportId"
       JOIN "Asset" a ON a."id" = r."assetId"
       JOIN "Park" p ON p."id" = a."parkId"
       JOIN "Vendor" v ON v."id" = wo."vendorId"
       WHERE p."clusterId" = $1
         AND wo."vendorId" = ANY($2::text[])
         AND r."archivedAt" IS NULL
         AND r."status" = ANY($3::"ReportStatus"[])
       GROUP BY v."name"`,
      [
        cluster.id,
        toRemove.map((v) => v.vendorId),
        ["DISETUJUI", "DIKERJAKAN", "MENUNGGU_KONFIRMASI"],
      ]
    );
    for (const o of openWos) {
      warnings.push(
        `Vendor "${o.vendorName}" masih memegang ${o.count} SPK berjalan di cluster ini. SPK tersebut tetap dapat diselesaikan.`
      );
    }
  }

  return withTransaction(async (tx) => {
    await queryOne<{ id: string }>(
      `SELECT "id" FROM "Cluster" WHERE "id" = $1 FOR UPDATE`,
      [cluster.id],
      tx
    );

    if (toRemove.length > 0) {
      await execute(
        `DELETE FROM "VendorServiceArea"
         WHERE "clusterId" = $1 AND "vendorId" = ANY($2::text[])`,
        [cluster.id, toRemove.map((v) => v.vendorId)],
        tx
      );
    }

    if (toAdd.length > 0) {
      await execute(
        `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
         SELECT vid, $1 FROM unnest($2::text[]) AS vid`,
        [cluster.id, toAdd.map((v) => v.id)],
        tx
      );
    }

    if (requestedIds.length === 0 && cluster.isActive) {
      warnings.push(`Cluster "${cluster.name}" kini belum memiliki Vendor area layanan.`);
    }

    await recordAuditLog(
      {
        actor: auditActor(actor, companyId),
        entityName: "Cluster",
        entityId: cluster.id,
        action: "UPDATE",
        summary: `Mengatur area layanan Vendor di cluster ${cluster.name} (${requestedVendors.length} vendor)`,
        oldValues: {
          vendors: existingAreas.map((a) => a.vendorName),
        },
        newValues: {
          vendors: requestedVendors.map((v) => v.name),
        },
      },
      tx
    );

    return { warnings };
  });
}

/* ---------------------------------------------------------------- */
/* Mutasi massal per Komplek                                        */
/* ---------------------------------------------------------------- */

export async function bulkAssignToComplex(
  actor: SessionUser,
  complexId: string,
  input: {
    kind: "manager" | "vendor";
    ids: string[];
  }
): Promise<{ addedCount: number; warnings: string[] }> {
  const companyId = requireAdmin(actor);
  if (input.kind === "vendor") {
    assertPermission(actor.role, "MANAGE_VENDORS");
  }

  const complex = await queryOne<ComplexRow>(
    `SELECT * FROM "Complex" WHERE "id" = $1 AND "companyId" = $2`,
    [complexId, companyId]
  );
  if (!complex) throw new Error("Komplek tidak ditemukan di perusahaan Anda.");

  const activeClusters = await query<ClusterRow>(
    `SELECT * FROM "Cluster"
     WHERE "complexId" = $1 AND "companyId" = $2 AND "isActive" = true`,
    [complex.id, companyId]
  );
  if (activeClusters.length === 0) {
    throw new Error("Tidak ada cluster aktif di komplek ini.");
  }

  const requestedIds = Array.from(new Set(input.ids.filter(Boolean)));
  if (requestedIds.length === 0) {
    throw new Error(
      `Pilih minimal satu ${input.kind === "manager" ? "Manager" : "Vendor"} untuk diterapkan.`
    );
  }

  return withTransaction(async (tx) => {
    let addedCount = 0;

    if (input.kind === "manager") {
      const managers = await query<UserRow>(
        `SELECT * FROM "User"
         WHERE "id" = ANY($1::text[])
           AND "companyId" = $2
           AND "role" = 'MANAGER'::"Role"
           AND "isActive" = true`,
        [requestedIds, companyId],
        tx
      );
      if (managers.length !== requestedIds.length) {
        throw new Error("Satu atau lebih akun Manager tidak valid atau nonaktif.");
      }

      for (const cl of activeClusters) {
        const existing = await query<{ userId: string }>(
          `SELECT "userId" FROM "ClusterManagerAssignment"
           WHERE "clusterId" = $1 AND "isTemporary" = false`,
          [cl.id],
          tx
        );
        const existingSet = new Set(existing.map((e) => e.userId));
        const toInsert = requestedIds.filter((id) => !existingSet.has(id));
        if (toInsert.length > 0) {
          await execute(
            `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
             SELECT uid, $1, false FROM unnest($2::text[]) AS uid`,
            [cl.id, toInsert],
            tx
          );
          addedCount += toInsert.length;
        }
      }

      await recordAuditLog(
        {
          actor: auditActor(actor, companyId),
          entityName: "Complex",
          entityId: complex.id,
          action: "UPDATE",
          summary: `Menerapkan Manager massal ke semua cluster aktif di komplek ${complex.name}`,
          oldValues: null,
          newValues: {
            kind: "manager",
            managers: managers.map((m) => m.name),
            complexName: complex.name,
            clustersUpdated: activeClusters.length,
          },
        },
        tx
      );
    } else {
      const vendors = await query<VendorRow>(
        `SELECT * FROM "Vendor"
         WHERE "id" = ANY($1::text[])
           AND "companyId" = $2
           AND "isActive" = true`,
        [requestedIds, companyId],
        tx
      );
      if (vendors.length !== requestedIds.length) {
        throw new Error("Satu atau lebih Vendor tidak valid atau nonaktif.");
      }

      for (const cl of activeClusters) {
        const existing = await query<{ vendorId: string }>(
          `SELECT "vendorId" FROM "VendorServiceArea" WHERE "clusterId" = $1`,
          [cl.id],
          tx
        );
        const existingSet = new Set(existing.map((e) => e.vendorId));
        const toInsert = requestedIds.filter((id) => !existingSet.has(id));
        if (toInsert.length > 0) {
          await execute(
            `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
             SELECT vid, $1 FROM unnest($2::text[]) AS vid`,
            [cl.id, toInsert],
            tx
          );
          addedCount += toInsert.length;
        }
      }

      await recordAuditLog(
        {
          actor: auditActor(actor, companyId),
          entityName: "Complex",
          entityId: complex.id,
          action: "UPDATE",
          summary: `Menerapkan Vendor area layanan massal ke semua cluster aktif di komplek ${complex.name}`,
          oldValues: null,
          newValues: {
            kind: "vendor",
            vendors: vendors.map((v) => v.name),
            complexName: complex.name,
            clustersUpdated: activeClusters.length,
          },
        },
        tx
      );
    }

    return {
      addedCount,
      warnings: [],
    };
  });
}
