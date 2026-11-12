import fs from "fs";
import path from "path";
import { Pool } from "pg";
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

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  loadDotEnvFallback(rootDir);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur di environment atau file .env.");
  }

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Direktori migrasi tidak ditemukan: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pool = new Pool(buildPgPoolConfig(connectionString, 2));
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "filename" TEXT PRIMARY KEY,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRes = await client.query<{ filename: string }>(
      `SELECT "filename" FROM "_migrations"`
    );
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    let appliedCount = 0;
    for (const filename of files) {
      if (applied.has(filename)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      console.log(`Menerapkan migrasi ${filename}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_migrations" ("filename") VALUES ($1)`,
          [filename]
        );
        await client.query("COMMIT");
        appliedCount++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log("Semua migrasi SQL sudah diterapkan.");
    } else {
      console.log(`${appliedCount} migrasi SQL berhasil diterapkan.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gagal menjalankan migrasi:", err);
  process.exit(1);
});
