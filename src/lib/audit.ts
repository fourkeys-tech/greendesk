import type { AuditAction, Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
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

/**
 * Mencatat perubahan data master ke tabel AuditLog (siapa, apa, kapan, nilai lama dan baru).
 * Sesuai PRD Bagian 11: Riwayat perubahan tidak bisa diubah atau dihapus oleh role mana pun.
 */
export async function recordAuditLog(params: RecordAuditParams) {
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

  return prisma.auditLog.create({
    data: {
      companyId: companyId ?? actor.companyId ?? null,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      entityName,
      entityId,
      action,
      summary,
      oldValues: oldValues
        ? (JSON.parse(JSON.stringify(oldValues)) as Prisma.InputJsonValue)
        : undefined,
      newValues: newValues
        ? (JSON.parse(JSON.stringify(newValues)) as Prisma.InputJsonValue)
        : undefined,
    },
  });
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
  const where: Prisma.AuditLogWhereInput = {
    companyId: actor.companyId,
    ...(options.entityName ? { entityName: options.entityName } : {}),
    ...(options.action ? { action: options.action } : {}),
  };

  const [total, entityGroups] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["entityName"],
      where: { companyId: actor.companyId },
      orderBy: { entityName: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Number.isFinite(options.page) ? Math.floor(options.page ?? 1) : 1;
  const page = Math.min(Math.max(requestedPage, 1), totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
    entityNames: entityGroups.map((g) => g.entityName),
  };
}

