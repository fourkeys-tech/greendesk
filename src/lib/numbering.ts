import { execute, query, queryOne, type TxClient } from "./db";

/**
 * Penomoran sekuensial atomik berbasis tabel SequenceCounter.
 *
 * Menggunakan satu statement PostgreSQL:
 * `INSERT ... ON CONFLICT ("scope", "key") DO UPDATE SET "value" = "SequenceCounter"."value" + 1, "updatedAt" = NOW() RETURNING "value"`
 * sehingga dua request bersamaan tidak pernah mendapat nomor yang sama.
 *
 * Panggil di dalam `withTransaction(async (tx) => ...)` yang sama dengan pembuatan entitasnya:
 * bila transaksi gagal, kenaikan counter ikut di-rollback (nomor tidak bolong).
 */

export type SequenceScope = "TKT" | "SPK" | "PGV";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Tahun-bulan (YYYYMM) menurut WIB (UTC+7), bukan zona waktu server.
 * Server produksi biasanya UTC: tanpa ini, laporan tgl 1 pukul 00.00–06.59 WIB
 * akan mendapat prefix bulan sebelumnya.
 */
export function yearMonth(date = new Date()): string {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return `${wib.getUTCFullYear()}${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseTrailingSeq(value: string | null | undefined): number {
  if (!value) return 0;
  const num = parseInt(value.split("-").pop() ?? "", 10);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Mengambil nilai berikutnya untuk (scope, key). Bila baris counter belum ada,
 * nilai awal di-seed dari nomor maksimum yang sudah ada (`seedFromMax`), agar data lama
 * yang dibuat sebelum counter diperkenalkan tidak bentrok.
 */
async function nextSequence(
  tx: TxClient,
  scope: SequenceScope,
  key: string,
  seedFromMax: () => Promise<number>
): Promise<number> {
  const existing = await queryOne<{ value: number }>(
    `SELECT "value" FROM "SequenceCounter" WHERE "scope" = $1 AND "key" = $2`,
    [scope, key],
    tx
  );

  if (!existing) {
    const base = await seedFromMax();
    await execute(
      `INSERT INTO "SequenceCounter" ("scope", "key", "value", "updatedAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("scope", "key") DO NOTHING`,
      [scope, key, base],
      tx
    );
  }

  const row = await queryOne<{ value: number }>(
    `INSERT INTO "SequenceCounter" ("scope", "key", "value", "updatedAt")
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT ("scope", "key") DO UPDATE
       SET "value" = "SequenceCounter"."value" + 1, "updatedAt" = NOW()
     RETURNING "value"`,
    [scope, key],
    tx
  );

  if (!row) {
    throw new Error("Gagal menghasilkan nomor urut sekuensial.");
  }
  return row.value;
}

/** Nomor tiket laporan TKT-YYYYMM-XXXX (unik global, urut per bulan). */
export async function nextTicketNumber(tx: TxClient, now = new Date()): Promise<string> {
  const ym = yearMonth(now);
  const prefix = `TKT-${ym}-`;
  const seq = await nextSequence(tx, "TKT", `global:${ym}`, async () => {
    // Laporan arsip tetap ikut dihitung agar nomor tiket tidak pernah bentrok
    const rows = await query<{ ticketNo: string }>(
      `SELECT "ticketNo" FROM "Report" WHERE "ticketNo" LIKE $1`,
      [`${prefix}%`],
      tx
    );
    return rows.reduce(
      (max, r) => Math.max(max, parseTrailingSeqStrict(r.ticketNo, prefix)),
      0
    );
  });
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** Nomor SPK SPK-YYYYMM-XXXX (unik per perusahaan). */
export async function nextSpkNumber(
  tx: TxClient,
  companyId: string,
  now = new Date()
): Promise<string> {
  const ym = yearMonth(now);
  const prefix = `SPK-${ym}-`;
  const seq = await nextSequence(tx, "SPK", `${companyId}:${ym}`, async () => {
    const last = await queryOne<{ spkNo: string }>(
      `SELECT "spkNo" FROM "WorkOrder"
       WHERE "companyId" = $1 AND "spkNo" LIKE $2
       ORDER BY "spkNo" DESC
       LIMIT 1`,
      [companyId, `${prefix}%`],
      tx
    );
    return parseTrailingSeq(last?.spkNo);
  });
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** Nomor pengajuan ganti vendor PGV-YYYYMM-XXXX (unik per perusahaan). */
export async function nextReplacementRequestNumber(
  tx: TxClient,
  companyId: string,
  now = new Date()
): Promise<string> {
  const ym = yearMonth(now);
  const prefix = `PGV-${ym}-`;
  const seq = await nextSequence(tx, "PGV", `${companyId}:${ym}`, async () => {
    const last = await queryOne<{ requestNo: string }>(
      `SELECT "requestNo" FROM "VendorReplacementRequest"
       WHERE "companyId" = $1 AND "requestNo" LIKE $2
       ORDER BY "requestNo" DESC
       LIMIT 1`,
      [companyId, `${prefix}%`],
      tx
    );
    return parseTrailingSeq(last?.requestNo);
  });
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Tiket lama bisa berformat TKT-YYYYMM-XXXX-HEX (fallback lama). Ambil hanya segmen
 * urut tepat setelah prefix agar sufiks hex tidak terbaca sebagai nomor.
 */
function parseTrailingSeqStrict(ticketNo: string, prefix: string): number {
  const rest = ticketNo.slice(prefix.length);
  const num = parseInt(rest.split("-")[0] ?? "", 10);
  return Number.isFinite(num) ? num : 0;
}
