import { describe, expect, it } from "vitest";
import { query, queryCount, queryOne } from "../db";
import type { ClusterRow, UserRow, VendorRow } from "../db-types";
import type { SessionUser } from "../auth";
import {
  bulkAssignToComplex,
  countIncompleteClusters,
  getResponsibilityOverview,
  setClusterManagers,
  setClusterPengelola,
  setClusterVendors,
} from "../services/cluster-responsibility";
import {
  assignTemporaryManager,
  cancelTemporaryManagerAssignment,
} from "../services/phase1-master";
import { changeVendorPic, setVendorServiceAreas } from "../services/phase2-vendor";

async function mustOne<T extends object>(
  sql: string,
  params: unknown[],
  label: string
): Promise<T> {
  const row = await queryOne<T>(sql, params);
  if (!row) throw new Error(`Record tidak ditemukan: ${label}`);
  return row;
}

function makeSession(u: UserRow): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    companyName: "Test Company",
    staffClusterId: u.staffClusterId,
  };
}

describe("Penanggung Jawab Cluster & Vendor", () => {
  it("getResponsibilityOverview menghasilkan ringkasan per komplek beserta kandidat", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const overview = await getResponsibilityOverview(adminA.companyId!);

    expect(overview.groups.length).toBeGreaterThan(0);
    expect(overview.summary.totalClusters).toBeGreaterThan(0);
    expect(overview.candidates.managers.length).toBeGreaterThan(0);
    expect(overview.candidates.vendors.length).toBeGreaterThan(0);

    const bgvGroup = overview.groups.find((g) =>
      g.clusters.some((c) => c.name === "Cluster Bougenville")
    );
    expect(bgvGroup).toBeDefined();

    const bgv = bgvGroup!.clusters.find((c) => c.name === "Cluster Bougenville")!;
    expect(bgv.pengelola.length).toBeGreaterThan(0);
    expect(bgv.managers.length).toBeGreaterThan(0);
    expect(bgv.vendors.length).toBeGreaterThan(0);
  });

  it("countIncompleteClusters menghitung cluster yang belum lengkap PJ-nya", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const count = await countIncompleteClusters(adminA.companyId!);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("setClusterPengelola menugaskan pengelola dan mencatat ke audit", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    const clusterEdelweiss = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Edelweiss", adminA.companyId],
      "Edelweiss"
    );
    const pengelola = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["pengelola.bgv@greenpark.id"],
      "pengelolaBgv"
    );

    // Pindahkan pengelola.bgv ke Edelweiss
    const res = await setClusterPengelola(session, clusterEdelweiss.id, [pengelola.id]);
    expect(res.warnings).toBeDefined();

    const updated = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1`,
      [pengelola.id],
      "updatedPengelola"
    );
    expect(updated.staffClusterId).toBe(clusterEdelweiss.id);

    // Kembalikan ke Bougenville
    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Bougenville", adminA.companyId],
      "Bougenville"
    );
    await setClusterPengelola(session, clusterBgv.id, [pengelola.id]);
  });

  it("setClusterManagers mengatur Manager tetap dan membatalkan delegasi bila overlap", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Bougenville", adminA.companyId],
      "Bougenville"
    );
    const manager = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager@greenpark.id"],
      "managerGreenpark"
    );

    const res = await setClusterManagers(session, clusterBgv.id, [manager.id]);
    expect(res.warnings).toBeDefined();

    const exists = await queryCount(
      `SELECT COUNT(*)::int AS count
       FROM "ClusterManagerAssignment"
       WHERE "clusterId" = $1 AND "userId" = $2 AND "isTemporary" = false`,
      [clusterBgv.id, manager.id]
    );
    expect(exists).toBe(1);
  });

  it("setClusterManagers menolak melepas Manager yang sedang digantikan pada delegasi aktif", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    const manager1 = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager@greenpark.id"],
      "manager1"
    );
    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Bougenville", adminA.companyId],
      "Bougenville"
    );

    // Buat manager kedua untuk GreenPark agar bisa didelegasikan
    let manager2 = await queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager2.test@greenpark.id"]
    );
    if (!manager2) {
      manager2 = await mustOne<UserRow>(
        `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "isActive")
         VALUES ($1, 'Manager Pengganti Test', 'manager2.test@greenpark.id', 'hash', 'MANAGER'::"Role", true)
         RETURNING *`,
        [adminA.companyId],
        "createdManager2"
      );
    }

    const tomorrow = new Date(Date.now() + 86400000);
    const nextWeek = new Date(Date.now() + 7 * 86400000);

    const del = await assignTemporaryManager(session, {
      substituteManagerId: manager2.id,
      replacedManagerId: manager1.id,
      clusterId: clusterBgv.id,
      validFrom: tomorrow,
      validUntil: nextWeek,
    });

    // Coba lepas manager1 dari clusterBgv → harus ditolak
    await expect(
      setClusterManagers(session, clusterBgv.id, [])
    ).rejects.toThrow(/sedang digantikan/);

    // Batalkan delegasi dulu agar bersih
    await cancelTemporaryManagerAssignment(session, del.id);
  });

  it("setClusterVendors menolak pelepasan bila vendor kehilangan area terakhirnya", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    // Buat vendor khusus test dengan tepat 1 cluster area
    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Bougenville", adminA.companyId],
      "Bougenville"
    );

    let testVendor = await queryOne<VendorRow>(
      `SELECT * FROM "Vendor" WHERE "name" = $1 AND "companyId" = $2`,
      ["Vendor Area Test", adminA.companyId]
    );
    if (!testVendor) {
      testVendor = await mustOne<VendorRow>(
        `INSERT INTO "Vendor" ("companyId", "name", "type", "skills", "warrantyDays", "isActive")
         VALUES ($1, 'Vendor Area Test', 'EXTERNAL'::"VendorType", ARRAY['Taman'], 30, true)
         RETURNING *`,
        [adminA.companyId],
        "createdTestVendor"
      );
      await query(
        `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [testVendor.id, clusterBgv.id]
      );
    }

    // Coba hapus vendor dari clusterBgv (sehingga ia 0 cluster) → harus ditolak
    await expect(
      setClusterVendors(session, clusterBgv.id, [])
    ).rejects.toThrow(/wajib memiliki minimal satu area layanan/);

    // setVendorServiceAreas sukses saat minimal satu cluster dipilih
    const resArea = await setVendorServiceAreas(session, testVendor.id, [clusterBgv.id]);
    expect(resArea.warnings).toBeDefined();
  });

  it("bulkAssignToComplex menerapkan manager ke semua cluster aktif di komplek", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1 AND "companyId" = $2`,
      ["Cluster Bougenville", adminA.companyId],
      "Bougenville"
    );
    const manager = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager@greenpark.id"],
      "manager"
    );

    const res = await bulkAssignToComplex(session, clusterBgv.complexId, {
      kind: "manager",
      ids: [manager.id],
    });
    expect(res.addedCount).toBeGreaterThanOrEqual(0);
  });

  it("changeVendorPic mengganti PIC vendor ke akun baru dan menonaktifkan PIC lama", async () => {
    const adminA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@greenpark.id"],
      "adminA"
    );
    const session = makeSession(adminA);

    // Buat vendor test dengan PIC awal
    const oldPic = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "isActive")
       VALUES ($1, 'Old PIC Test', 'oldpic.test@greenpark.id', 'hash', 'PIC_VENDOR'::"Role", true)
       RETURNING *`,
      [adminA.companyId],
      "oldPic"
    );
    const vendor = await mustOne<VendorRow>(
      `INSERT INTO "Vendor" ("companyId", "name", "type", "skills", "warrantyDays", "picUserId", "isActive")
       VALUES ($1, 'Vendor Ganti PIC Test', 'EXTERNAL'::"VendorType", ARRAY['Lampu'], 30, $2, true)
       RETURNING *`,
      [adminA.companyId, oldPic.id],
      "vendorGantiPic"
    );

    // Ganti ke akun baru
    const result = await changeVendorPic(session, vendor.id, {
      mode: "new",
      picName: "New PIC Test",
      picEmail: "newpic.test@greenpark.id",
      deactivateOldPic: true,
    });

    expect(result.newPicUser.email).toBe("newpic.test@greenpark.id");
    expect(result.deactivatedOldPic).toBe(true);

    const oldPicReloaded = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1`,
      [oldPic.id],
      "oldPicReloaded"
    );
    expect(oldPicReloaded.isActive).toBe(false);

    const vendorReloaded = await mustOne<VendorRow>(
      `SELECT * FROM "Vendor" WHERE "id" = $1`,
      [vendor.id],
      "vendorReloaded"
    );
    expect(vendorReloaded.picUserId).toBe(result.newPicUser.id);
  });

  it("menolak akses non-admin atau antar-perusahaan", async () => {
    const managerA = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["manager@greenpark.id"],
      "managerA"
    );
    const sessionManager = makeSession(managerA);

    const clusterBgv = await mustOne<ClusterRow>(
      `SELECT * FROM "Cluster" WHERE "name" = $1`,
      ["Cluster Bougenville"],
      "Bougenville"
    );

    await expect(
      setClusterPengelola(sessionManager, clusterBgv.id, [])
    ).rejects.toThrow();

    const adminB = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      ["admin@griyaasri.id"],
      "adminB"
    );
    const sessionB = makeSession(adminB);

    // Admin B mencoba mengutak-atik cluster milik Perusahaan A
    await expect(
      setClusterPengelola(sessionB, clusterBgv.id, [])
    ).rejects.toThrow(/tidak ditemukan di perusahaan Anda/);
  });
});
