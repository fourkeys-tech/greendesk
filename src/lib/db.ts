import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { buildPgPoolConfig } from "./pg-config";

export type TxClient = PoolClient;
export type DbClient = Pool | PoolClient;

const globalForPg = globalThis as unknown as {
  pgPool: Pool | undefined;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Konfigurasi DATABASE_URL belum diatur. Periksa file .env atau .env.test."
    );
  }
  const pool = new Pool({
    ...buildPgPoolConfig(connectionString, 10),
    // Default pg 10 detik: koneksi ditutup di sela klik, tiap navigasi bayar ulang TCP+TLS+auth (~300ms/koneksi).
    idleTimeoutMillis: 5 * 60 * 1000,
    keepAlive: true,
  });
  // Koneksi idle yang diputus server (pooler restart/jaringan) dibuang pool; tanpa listener, event 'error' mematikan proses.
  pool.on("error", (err) => {
    console.error("[db] koneksi idle PostgreSQL terputus:", err.message);
  });
  return pool;
}

export const pool: Pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

/** Menjalankan query SELECT dan mengembalikan semua baris bertipe `T`. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: DbClient = pool
): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

/** Menjalankan query SELECT dan mengembalikan baris pertama atau `null`. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: DbClient = pool
): Promise<T | null> {
  const result = await db.query<T>(sql, params);
  return result.rows[0] ?? null;
}

/** Menjalankan query COUNT/scalar (`SELECT COUNT(*)::int AS count ...`) sebagai number. */
export async function queryCount(
  sql: string,
  params: unknown[] = [],
  db: DbClient = pool
): Promise<number> {
  const row = await queryOne<{ count: number | string }>(sql, params, db);
  if (!row) return 0;
  return Number(row.count) || 0;
}

/** Menjalankan UPDATE / INSERT / DELETE dan mengembalikan `rowCount`. */
export async function execute(
  sql: string,
  params: unknown[] = [],
  db: DbClient = pool
): Promise<number> {
  const result = await db.query(sql, params);
  return result.rowCount ?? 0;
}

/**
 * Menjalankan callback di dalam transaksi PostgreSQL (`BEGIN` / `COMMIT` / `ROLLBACK`).
 * Seluruh operasi DB di dalam callback WAJIB memakai parameter `tx`, bukan `pool`.
 */
export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Abaikan error rollback agar error asli tetap dilempar
    }
    throw err;
  } finally {
    client.release();
  }
}
