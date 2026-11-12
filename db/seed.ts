import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";
import { buildPgPoolConfig } from "../src/lib/pg-config";

function loadDotEnvFallback(rootDir: string) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function queryOneId(
  client: PoolClient,
  sql: string,
  params: unknown[]
): Promise<string | null> {
  const res = await client.query<{ id: string }>(sql, params);
  return res.rows[0]?.id ?? null;
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  loadDotEnvFallback(rootDir);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur di environment atau file .env.");
  }

  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) {
    throw new Error(
      "SEED_DEFAULT_PASSWORD belum diatur di file .env. Lihat .env.example."
    );
  }

  console.log("Memulai seeding data Fase 0 (Fondasi)...");
  const defaultPasswordHash = await bcrypt.hash(seedPassword, 10);

  const pool = new Pool(buildPgPoolConfig(connectionString, 2));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Multi-Perusahaan
    const companyA = await client.query<{ id: string }>(
      `INSERT INTO "Company" ("code", "name", "contact", "address")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
       RETURNING "id"`,
      [
        "THN",
        "PT Taman Hijau Nusantara",
        "021-5550199 / info@greenpark.id",
        "BSD Green Office Park, Tangerang Selatan",
      ]
    );
    const companyAId = companyA.rows[0].id;

    const companyB = await client.query<{ id: string }>(
      `INSERT INTO "Company" ("code", "name", "contact", "address")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
       RETURNING "id"`,
      [
        "GAP",
        "PT Griya Asri Properti (Perusahaan Lain)",
        "021-8880123 / kontak@griyaasri.id",
        "Kawasan Cibubur, Jakarta Timur",
      ]
    );
    const companyBId = companyB.rows[0].id;

    // 2. Hierarki Wilayah 5 Tingkat untuk Perusahaan A
    let complex1Id = await queryOneId(
      client,
      `SELECT "id" FROM "Complex" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "GreenPark Residence BSD"]
    );
    if (!complex1Id) {
      complex1Id = (
        await client.query<{ id: string }>(
          `INSERT INTO "Complex" ("companyId", "name", "address")
           VALUES ($1, $2, $3) RETURNING "id"`,
          [
            companyAId,
            "GreenPark Residence BSD",
            "Jl. Boulevard Raya GreenPark No. 1, BSD City",
          ]
        )
      ).rows[0].id;
    }

    let clusterBougenvilleId = await queryOneId(
      client,
      `SELECT "id" FROM "Cluster" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Cluster Bougenville"]
    );
    if (!clusterBougenvilleId) {
      clusterBougenvilleId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Cluster" ("companyId", "complexId", "name")
           VALUES ($1, $2, $3) RETURNING "id"`,
          [companyAId, complex1Id, "Cluster Bougenville"]
        )
      ).rows[0].id;
    }

    let clusterEdelweissId = await queryOneId(
      client,
      `SELECT "id" FROM "Cluster" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Cluster Edelweiss"]
    );
    if (!clusterEdelweissId) {
      clusterEdelweissId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Cluster" ("companyId", "complexId", "name")
           VALUES ($1, $2, $3) RETURNING "id"`,
          [companyAId, complex1Id, "Cluster Edelweiss"]
        )
      ).rows[0].id;
    }

    let parkBougenvilleId = await queryOneId(
      client,
      `SELECT "id" FROM "Park" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Taman Utama Bougenville"]
    );
    if (!parkBougenvilleId) {
      parkBougenvilleId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Park" ("companyId", "clusterId", "name", "locationNote")
           VALUES ($1, $2, $3, $4) RETURNING "id"`,
          [
            companyAId,
            clusterBougenvilleId,
            "Taman Utama Bougenville",
            "Depan Clubhouse Blok A",
          ]
        )
      ).rows[0].id;
    }

    let parkEdelweissId = await queryOneId(
      client,
      `SELECT "id" FROM "Park" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Taman Jogging Edelweiss"]
    );
    if (!parkEdelweissId) {
      parkEdelweissId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Park" ("companyId", "clusterId", "name", "locationNote")
           VALUES ($1, $2, $3, $4) RETURNING "id"`,
          [
            companyAId,
            clusterEdelweissId,
            "Taman Jogging Edelweiss",
            "Samping Danau Buatan Blok C",
          ]
        )
      ).rows[0].id;
    }

    // 3. Kategori Aset
    let catLampuId = await queryOneId(
      client,
      `SELECT "id" FROM "Category" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Penerangan & Lampu Taman"]
    );
    if (!catLampuId) {
      catLampuId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Category" ("companyId", "name", "damageTypes")
           VALUES ($1, $2, $3) RETURNING "id"`,
          [
            companyAId,
            "Penerangan & Lampu Taman",
            ["Lampu mati", "Tiang miring", "Kabel terkelupas", "Kaca pecah"],
          ]
        )
      ).rows[0].id;
    }

    let catPlaygroundId = await queryOneId(
      client,
      `SELECT "id" FROM "Category" WHERE "companyId" = $1 AND "name" = $2 LIMIT 1`,
      [companyAId, "Fasilitas Bermain Anak"]
    );
    if (!catPlaygroundId) {
      catPlaygroundId = (
        await client.query<{ id: string }>(
          `INSERT INTO "Category" ("companyId", "name", "damageTypes")
           VALUES ($1, $2, $3) RETURNING "id"`,
          [
            companyAId,
            "Fasilitas Bermain Anak",
            [
              "Rantai berkarat",
              "Pijakan patah",
              "Cat mengelupas",
              "Baut longgar",
            ],
          ]
        )
      ).rows[0].id;
    }

    // 4. Aset
    const asset1Id = (
      await client.query<{ id: string }>(
        `INSERT INTO "Asset" ("companyId", "code", "parkId", "categoryId", "name", "locationNote", "installedAt", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
         RETURNING "id"`,
        [
          companyAId,
          "AST-BGV-001",
          parkBougenvilleId,
          catLampuId,
          "Lampu Taman Solar LED #01",
          "Sudut Utara dekat Gazebo Bougenville",
          new Date("2025-06-15"),
        ]
      )
    ).rows[0].id;

    const asset2Id = (
      await client.query<{ id: string }>(
        `INSERT INTO "Asset" ("companyId", "code", "parkId", "categoryId", "name", "locationNote", "installedAt", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
         RETURNING "id"`,
        [
          companyAId,
          "AST-BGV-002",
          parkBougenvilleId,
          catPlaygroundId,
          "Ayunan Ganda Besi Tempa",
          "Area Playground Anak Zona Barat",
          new Date("2025-08-10"),
        ]
      )
    ).rows[0].id;

    const asset3Id = (
      await client.query<{ id: string }>(
        `INSERT INTO "Asset" ("companyId", "code", "parkId", "categoryId", "name", "locationNote", "installedAt", "isActive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
         RETURNING "id"`,
        [
          companyAId,
          "AST-EDW-001",
          parkEdelweissId,
          catLampuId,
          "Lampu Sorot Jalur Jogging #04",
          "Dekat Jembatan Kayu Edelweiss",
          new Date("2025-09-01"),
        ]
      )
    ).rows[0].id;

    // 5. Ketujuh Role + Admin Perusahaan B
    const userPenggunaId = (
      await client.query<{ id: string }>(
        `INSERT INTO "User" (
           "companyId", "name", "email", "passwordHash", "role", "loginMethod",
           "reporterStatus", "blockHouseNo", "dataConsentAt", "validReportCount", "invalidReportCount"
         )
         VALUES ($1, $2, $3, $4, 'PENGGUNA', 'EMAIL', 'WARGA', $5, NOW(), 2, 0)
         ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
         RETURNING "id"`,
        [
          companyAId,
          "Rina Kartika (Warga)",
          "warga@greenpark.id",
          defaultPasswordHash,
          "Bougenville A2/15",
        ]
      )
    ).rows[0].id;

    await client.query(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "staffClusterId")
       VALUES ($1, $2, $3, $4, 'PENGELOLA', $5)
       ON CONFLICT ("email") DO UPDATE SET "staffClusterId" = EXCLUDED."staffClusterId"`,
      [
        companyAId,
        "Hendro Wibowo (Pengelola Bougenville)",
        "pengelola.bgv@greenpark.id",
        defaultPasswordHash,
        clusterBougenvilleId,
      ]
    );

    const userManagerId = (
      await client.query<{ id: string }>(
        `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
         VALUES ($1, $2, $3, $4, 'MANAGER')
         ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
         RETURNING "id"`,
        [
          companyAId,
          "Diana Kusuma (Manager Estate)",
          "manager@greenpark.id",
          defaultPasswordHash,
        ]
      )
    ).rows[0].id;

    async function ensurePermanentAssignment(userId: string, clusterId: string) {
      const existing = await queryOneId(
        client,
        `SELECT "id" FROM "ClusterManagerAssignment"
         WHERE "userId" = $1 AND "clusterId" = $2 AND "isTemporary" = false
         LIMIT 1`,
        [userId, clusterId]
      );
      if (!existing) {
        await client.query(
          `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
           VALUES ($1, $2, false)`,
          [userId, clusterId]
        );
      }
    }

    await ensurePermanentAssignment(userManagerId, clusterBougenvilleId);
    await ensurePermanentAssignment(userManagerId, clusterEdelweissId);

    const userPicVendorId = (
      await client.query<{ id: string }>(
        `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
         VALUES ($1, $2, $3, $4, 'PIC_VENDOR')
         ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
         RETURNING "id"`,
        [
          companyAId,
          "Agus Pratama (PIC Vendor)",
          "pic@vendorjaya.id",
          defaultPasswordHash,
        ]
      )
    ).rows[0].id;

    const userTeknisiId = (
      await client.query<{ id: string }>(
        `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
         VALUES ($1, $2, $3, $4, 'TEKNISI')
         ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
         RETURNING "id"`,
        [
          companyAId,
          "Budi Santoso (Teknisi Lapangan)",
          "teknisi.budi@vendorjaya.id",
          defaultPasswordHash,
        ]
      )
    ).rows[0].id;

    const userAdminId = (
      await client.query<{ id: string }>(
        `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
         VALUES ($1, $2, $3, $4, 'ADMIN')
         ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
         RETURNING "id"`,
        [
          companyAId,
          "Arfin Mardiyanto (Admin Perusahaan)",
          "admin@greenpark.id",
          defaultPasswordHash,
        ]
      )
    ).rows[0].id;

    await client.query(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
       VALUES ($1, $2, $3, $4, 'OWNER')
       ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"`,
      [
        companyAId,
        "Ir. Surya Darmawan (Owner / Direksi)",
        "owner@greenpark.id",
        defaultPasswordHash,
      ]
    );

    await client.query(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role")
       VALUES ($1, $2, $3, $4, 'ADMIN')
       ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"`,
      [
        companyBId,
        "Admin Griya Asri (Perusahaan B)",
        "admin@griyaasri.id",
        defaultPasswordHash,
      ]
    );

    // 6. Vendor & Teknisi
    let vendor1Id = await queryOneId(
      client,
      `SELECT "id" FROM "Vendor" WHERE "picUserId" = $1 LIMIT 1`,
      [userPicVendorId]
    );
    if (!vendor1Id) {
      vendor1Id = (
        await client.query<{ id: string }>(
          `INSERT INTO "Vendor" (
             "companyId", "name", "type", "skills", "picUserId",
             "cooperationScheme", "warrantyDays", "address", "npwp"
           )
           VALUES ($1, $2, 'EXTERNAL', $3, $4, $5, $6, $7, $8)
           RETURNING "id"`,
          [
            companyAId,
            "PT Teknik Taman Jaya",
            ["Kelistrikan Taman", "Konstruksi Besi & Playground"],
            userPicVendorId,
            "Kontrak Tahunan & Per SPK",
            60,
            "Ruko Golden Madrid Blok G/12, BSD",
            "01.234.567.8-411.000",
          ]
        )
      ).rows[0].id;
    }

    await client.query(
      `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
       VALUES ($1, $2)
       ON CONFLICT ("vendorId", "clusterId") DO NOTHING`,
      [vendor1Id, clusterBougenvilleId]
    );

    const tech1Id = (
      await client.query<{ id: string }>(
        `INSERT INTO "Technician" (
           "companyId", "vendorId", "userId", "fullName", "whatsapp", "email",
           "skills", "status", "approvalStatus", "approvedById", "approvedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'APPROVED', $8, NOW())
         ON CONFLICT ("userId") DO UPDATE SET "userId" = EXCLUDED."userId"
         RETURNING "id"`,
        [
          companyAId,
          vendor1Id,
          userTeknisiId,
          "Budi Santoso",
          "081234567890",
          "teknisi.budi@vendorjaya.id",
          ["Kelistrikan Taman", "Las & Besi"],
          userAdminId,
        ]
      )
    ).rows[0].id;

    // 7. Contoh Laporan & SPK
    const report1 = (
      await client.query<{ id: string; ticketNo: string }>(
        `INSERT INTO "Report" ("companyId", "ticketNo", "assetId", "reporterId", "channel", "description", "status")
         VALUES ($1, $2, $3, $4, 'QR', $5, 'BARU')
         ON CONFLICT ("ticketNo") DO UPDATE SET "ticketNo" = EXCLUDED."ticketNo"
         RETURNING "id", "ticketNo"`,
        [
          companyAId,
          "TKT-202611-0001",
          asset1Id,
          userPenggunaId,
          "Lampu taman berkedip dan mati total saat malam hari.",
        ]
      )
    ).rows[0];

    const report2Id = (
      await client.query<{ id: string }>(
        `INSERT INTO "Report" ("companyId", "ticketNo", "assetId", "reporterId", "channel", "description", "status", "priority")
         VALUES ($1, $2, $3, $4, 'QR', $5, 'DIKERJAKAN', 'TINGGI')
         ON CONFLICT ("ticketNo") DO UPDATE SET "ticketNo" = EXCLUDED."ticketNo"
         RETURNING "id"`,
        [
          companyAId,
          "TKT-202611-0002",
          asset2Id,
          userPenggunaId,
          "Rantai ayunan sebelah kanan berkarat dan berbunyi keras.",
        ]
      )
    ).rows[0].id;

    await client.query(
      `INSERT INTO "WorkOrder" ("companyId", "spkNo", "reportId", "vendorId", "technicianId", "assignedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("companyId", "spkNo") DO NOTHING`,
      [companyAId, "SPK-202611-0001", report2Id, vendor1Id, tech1Id]
    );

    await client.query(
      `INSERT INTO "Report" ("companyId", "ticketNo", "assetId", "reporterId", "channel", "description", "status", "priority")
       VALUES ($1, $2, $3, $4, 'DASHBOARD', $5, 'MENUNGGU_KEPUTUSAN', 'NORMAL')
       ON CONFLICT ("ticketNo") DO NOTHING`,
      [
        companyAId,
        "TKT-202611-0003",
        asset3Id,
        userPenggunaId,
        "Kaca pelindung lampu sorot jalur jogging retak.",
      ]
    );

    // 8. Contoh AuditLog Awal
    const auditCountRes = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "companyId" = $1`,
      [companyAId]
    );
    if (auditCountRes.rows[0].count === 0) {
      await client.query(
        `INSERT INTO "AuditLog" ("companyId", "actorId", "actorName", "actorRole", "entityName", "entityId", "action", "summary", "oldValues", "newValues")
         VALUES ($1, $2, $3, 'ADMIN', 'Asset', $4, 'CREATE', $5, $6::jsonb, $7::jsonb)`,
        [
          companyAId,
          userAdminId,
          "Arfin Mardiyanto (Admin Perusahaan)",
          asset1Id,
          "Menambahkan aset baru AST-BGV-001 (Lampu Taman Solar LED #01)",
          JSON.stringify({}),
          JSON.stringify({
            code: "AST-BGV-001",
            name: "Lampu Taman Solar LED #01",
            park: "Taman Utama Bougenville",
            isActive: true,
          }),
        ]
      );

      await client.query(
        `INSERT INTO "AuditLog" ("companyId", "actorId", "actorName", "actorRole", "entityName", "entityId", "action", "summary", "oldValues", "newValues")
         VALUES ($1, $2, $3, 'ADMIN', 'Technician', $4, 'UPDATE', $5, $6::jsonb, $7::jsonb)`,
        [
          companyAId,
          userAdminId,
          "Arfin Mardiyanto (Admin Perusahaan)",
          tech1Id,
          "Menyetujui akun teknisi Budi Santoso (PT Teknik Taman Jaya)",
          JSON.stringify({ approvalStatus: "PENDING" }),
          JSON.stringify({
            approvalStatus: "APPROVED",
            approvedBy: "Arfin Mardiyanto (Admin Perusahaan)",
          }),
        ]
      );
    }

    // 9. Contoh EmailLog Awal
    const emailCountRes = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "EmailLog" WHERE "companyId" = $1`,
      [companyAId]
    );
    if (emailCountRes.rows[0].count === 0) {
      await client.query(
        `INSERT INTO "EmailLog" ("companyId", "toEmail", "subject", "bodyHtml", "triggerType", "ticketNo", "status")
         VALUES ($1, $2, $3, $4, 'LAPORAN_TERKIRIM', $5, 'SENT')`,
        [
          companyAId,
          "warga@greenpark.id",
          "[TKT-202611-0001] Laporan Kerusakan Diterima - Lampu Taman Solar LED #01",
          "<p>Terima kasih Rina Kartika (Warga), laporan Anda dengan nomor tiket <strong>TKT-202611-0001</strong> telah diterima.</p>",
          report1.ticketNo,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Seeding Fase 0 selesai!");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gagal melakukan seeding:", err);
  process.exit(1);
});
