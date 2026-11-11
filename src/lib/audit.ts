import type { AuditAction, AuditLogRow, Role } from "./db-types";
import { pool, query, queryCount, queryOne, type DbClient } from "./db";
import { assertPermission } from "./permissions";

export interface AuditActor {
  id: string;
  name: string;
  role: Role;
  companyId?: string | null;
}

export interface RecordAuditParams {
  actor: AuditActor;
  entityName: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  companyId?: string | null;
}

/** Aktor sistem untuk aksi otomatis (cron/maintenance). actorId null karena bukan user nyata. */
export const SYSTEM_AUDIT_ACTOR_NAME = "Sistem";

/**
 * Mencatat perubahan data master ke tabel AuditLog (siapa, apa, kapan, nilai lama dan baru).
 * Sesuai PRD Bagian 11: Riwayat perubahan tidak bisa diubah atau dihapus oleh role mana pun.
 *
 * Teruskan `db = tx` saat dipanggil di dalam `withTransaction` agar audit ikut commit/rollback
 * bersama perubahan datanya.
 */
export async function recordAuditLog(
  params: RecordAuditParams,
  db: DbClient = pool
): Promise<AuditLogRow> {
  const {
    actor,
    entityName,
    entityId,
    action,
    summary,
    oldValues,
    newValues,
    companyId,
  } = params;

  const row = await queryOne<AuditLogRow>(
    `INSERT INTO "AuditLog" (
       "companyId", "actorId", "actorName", "actorRole",
       "entityName", "entityId", "action", "summary",
       "oldValues", "newValues"
     )
     VALUES ($1, $2, $3, $4::"Role", $5, $6, $7::"AuditAction", $8, $9::jsonb, $10::jsonb)
     RETURNING *`,
    [
      companyId ?? actor.companyId ?? null,
      actor.id || null,
      actor.name,
      actor.role,
      entityName,
      entityId,
      action,
      summary,
      oldValues == null ? null : JSON.stringify(oldValues),
      newValues == null ? null : JSON.stringify(newValues),
    ],
    db
  );

  if (!row) {
    throw new Error("Gagal mencatat AuditLog.");
  }
  return row;
}

export const AUDIT_PAGE_SIZE = 50;

/**
 * Mengambil riwayat perubahan data untuk perusahaan terkait, dengan filter & pagination.
 * Hanya bisa diakses oleh role ADMIN dan OWNER sesuai matriks hak akses.
 */
export async function getCompanyAuditLogs(
  actor: AuditActor,
  options: {
    entityName?: string | null;
    action?: AuditAction | null;
    page?: number;
    pageSize?: number;
  } = {}
) {
  assertPermission(actor.role, "VIEW_AUDIT_LOGS");

  if (!actor.companyId) {
    throw new Error("Akses ditolak: Akun tidak terhubung ke perusahaan.");
  }

  const pageSize = Math.min(Math.max(options.pageSize ?? AUDIT_PAGE_SIZE, 1), 200);
  const conditions: string[] = [`"companyId" = $1`];
  const params: unknown[] = [actor.companyId];

  if (options.entityName) {
    params.push(options.entityName);
    conditions.push(`"entityName" = $${params.length}`);
  }
  if (options.action) {
    params.push(options.action);
    conditions.push(`"action" = $${params.length}::"AuditAction"`);
  }

  const whereSql = conditions.join(" AND ");

  const [total, entityGroups] = await Promise.all([
    queryCount(`SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE ${whereSql}`, params),
    query<{ entityName: string }>(
      `SELECT DISTINCT "entityName" FROM "AuditLog" WHERE "companyId" = $1 ORDER BY "entityName" ASC`,
      [actor.companyId]
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number.isFinite(options.page) ? Math.floor(options.page ?? 1) : 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const offset = (page - 1) * pageSize;

  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;
  const logs = await query<AuditLogRow>(
    `SELECT * FROM "AuditLog"
     WHERE ${whereSql}
     ORDER BY "createdAt" DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    [...params, pageSize, offset]
  );

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
    entityNames: entityGroups.map((g) => g.entityName),
  };
}

