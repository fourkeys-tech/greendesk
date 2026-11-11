import crypto from "crypto";
import bcrypt from "bcryptjs";
import { execute, query, queryCount, queryOne, withTransaction } from "../db";
import type {
  ApprovalStatus,
  ClusterRow,
  TechnicianRow,
  TechnicianStatus,
  UserRow,
  VendorRow,
  VendorType,
} from "../db-types";
import { assertPermission } from "../permissions";
import { recordAuditLog, SYSTEM_AUDIT_ACTOR_NAME } from "../audit";
import { enqueueEmail, escapeHtml } from "../email";
import type { SessionUser } from "../auth";

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Status laporan yang berarti SPK masih berjalan (vendor/teknisi sedang memegang pekerjaan). */
export const OPEN_WORK_ORDER_REPORT_STATUSES = [
  "DISETUJUI",
  "DIKERJAKAN",
  "MENUNGGU_KONFIRMASI",
] as const;

function auditActorOf(actor: SessionUser, companyId: string) {
  return { id: actor.id, name: actor.name, role: actor.role, companyId };
}

function requireCompany(actor: SessionUser): string {
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }
  return actor.companyId;
}

function assertContractRange(start: Date | null, end: Date | null) {
  if (start && Number.isNaN(start.getTime())) {
    throw new Error("Tanggal mulai kontrak tidak valid.");
  }
  if (end && Number.isNaN(end.getTime())) {
    throw new Error("Tanggal selesai kontrak tidak valid.");
  }
  if (start && end && end < start) {
    throw new Error("Tanggal selesai kontrak tidak boleh sebelum tanggal mulai.");
  }
}

/**
 * 1. Admin menginput data Vendor beserta Area Layanan Cluster & membuat akun PIC Vendor.
 * Mengirim email undangan ke PIC Vendor dan mencatat ke AuditLog.
 */
export async function createVendorWithPic(
  actor: SessionUser,
  input: {
    name: string;
    type: VendorType;
    skills: string[];
    cooperationScheme?: string;
    contractStart?: Date | null;
    contractEnd?: Date | null;
    warrantyDays: number;
    address?: string;
    npwp?: string;
    clusterIds: string[];
    picName: string;
    picEmail: string;
    picPassword?: string;
  }
) {
  assertPermission(actor.role, "MANAGE_VENDORS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }

  const companyId = actor.companyId;
  const vendorName = input.name.trim();
  const picName = input.picName.trim();
  const picEmail = input.picEmail.trim().toLowerCase();
  const cleanSkills = input.skills
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (!vendorName || !picName || !picEmail) {
    throw new Error("Nama vendor, nama PIC, dan email PIC wajib diisi.");
  }
  if (cleanSkills.length === 0) {
    throw new Error("Minimal satu keahlian vendor wajib diisi.");
  }
  if (input.clusterIds.length === 0) {
    throw new Error(
      "Pilih minimal satu cluster sebagai area layanan vendor."
    );
  }

  assertContractRange(input.contractStart ?? null, input.contractEnd ?? null);

  const uniqueClusterIds = Array.from(new Set(input.clusterIds));
  const [validClusters, existingUser] = await Promise.all([
    query<ClusterRow>(
      `SELECT *
       FROM "Cluster"
       WHERE "id" = ANY($1::text[]) AND "companyId" = $2 AND "isActive" = true`,
      [uniqueClusterIds, companyId]
    ),
    queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "email" = $1`,
      [picEmail]
    ),
  ]);

  if (validClusters.length !== uniqueClusterIds.length) {
    throw new Error(
      "Satu atau lebih cluster area layanan tidak valid atau sedang nonaktif."
    );
  }
  if (existingUser) {
    throw new Error(`Email PIC ${picEmail} sudah terdaftar.`);
  }

  const suppliedPassword = input.picPassword?.trim();
  const temporaryPassword = suppliedPassword ? null : generateTemporaryPassword();
  const rawPassword = suppliedPassword || temporaryPassword!;
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // Akun PIC, data vendor, email outbox, dan audit dibuat dalam satu transaksi atomik.
  const { picUser, vendor } = await withTransaction(async (tx) => {
    const picUser = await queryOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "isActive")
       VALUES ($1, $2, $3, $4, 'PIC_VENDOR'::"Role", true)
       RETURNING *`,
      [companyId, picName, picEmail, passwordHash],
      tx
    );
    if (!picUser) throw new Error("Gagal membuat akun PIC Vendor.");

    const now = new Date();
    const vendor = await queryOne<VendorRow>(
      `INSERT INTO "Vendor" (
         "companyId", "name", "type", "skills", "picUserId",
         "cooperationScheme", "contractStart", "contractEnd",
         "warrantyDays", "address", "npwp", "lastTechnicianConfirmedAt"
       )
       VALUES ($1, $2, $3::"VendorType", $4::text[], $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        companyId,
        vendorName,
        input.type,
        cleanSkills,
        picUser.id,
        input.cooperationScheme?.trim() || null,
        input.contractStart || null,
        input.contractEnd || null,
        input.warrantyDays > 0 ? input.warrantyDays : 30,
        input.address?.trim() || null,
        input.npwp?.trim() || null,
        now,
      ],
      tx
    );
    if (!vendor) throw new Error("Gagal membuat vendor.");

    await execute(
      `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
       SELECT $1, cid FROM unnest($2::text[]) AS cid`,
      [vendor.id, validClusters.map((c) => c.id)],
      tx
    );

    await enqueueEmail(tx, {
      companyId,
      toEmail: picEmail,
      subject: `Undangan Aktivasi Akun PIC Vendor – ${vendorName}`,
      bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p>Halo <strong>${escapeHtml(picName)}</strong>,</p>
        <p>Perusahaan Anda (<strong>${escapeHtml(vendorName)}</strong>) telah didaftarkan sebagai vendor rekanan di platform GreenPark.</p>
        <p>Area Layanan Cluster: <strong>${validClusters
          .map((c) => escapeHtml(c.name))
          .join(", ")}</strong></p>
        <p>Silakan masuk menggunakan email <strong>${escapeHtml(picEmail)}</strong> untuk mendaftarkan teknisi lapangan Anda dan menerima SPK.</p>
      </div>
    `.trim(),
      triggerType: "VENDOR_INVITE",
    });

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "Vendor",
        entityId: vendor.id,
        action: "CREATE",
        summary: `Mendaftarkan vendor baru ${vendor.name} (${vendor.type}) dengan PIC ${picUser.name}`,
        oldValues: null,
        newValues: {
          vendorName: vendor.name,
          type: vendor.type,
          skills: vendor.skills,
          warrantyDays: vendor.warrantyDays,
          picEmail: picUser.email,
          serviceClusters: validClusters.map((c) => c.name),
        },
      },
      tx
    );

    return { picUser, vendor };
  });

  return { vendor, picUser, temporaryPassword };
}

/**
 * 2. PIC Vendor mendaftarkan Teknisi baru (status awal persetujuan: PENDING).
 * Memicu notifikasi web ke semua Admin di perusahaan tersebut.
 */
export async function registerTechnicianByPic(
  actor: SessionUser,
  input: {
    fullName: string;
    whatsapp: string;
    email: string;
    facePhotoUrl?: string | null;
    skills: string[];
    password?: string;
  }
) {
  assertPermission(actor.role, "MANAGE_OWN_TECHNICIANS");
  if (!actor.companyId) {
    throw new Error("Akun PIC tidak terhubung ke perusahaan.");
  }

  const companyId = actor.companyId;
  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1`,
    [actor.id]
  );
  if (!vendor) {
    throw new Error("Data perusahaan vendor Anda tidak ditemukan.");
  }
  if (!vendor.isActive) {
    throw new Error(
      "Vendor Anda sedang dinonaktifkan Admin. Teknisi baru tidak dapat didaftarkan."
    );
  }

  const fullName = input.fullName.trim();
  const whatsapp = input.whatsapp.trim();
  const email = input.email.trim().toLowerCase();
  const cleanSkills = input.skills
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (!fullName || !whatsapp || !email || cleanSkills.length === 0) {
    throw new Error(
      "Nama lengkap, nomor WhatsApp, email, dan minimal satu keahlian wajib diisi."
    );
  }

  const existingUser = await queryOne<{ id: string }>(
    `SELECT "id" FROM "User" WHERE "email" = $1`,
    [email]
  );
  if (existingUser) {
    throw new Error(`Email teknisi ${email} sudah terdaftar.`);
  }

  const suppliedPassword = input.password?.trim();
  const temporaryPassword = suppliedPassword ? null : generateTemporaryPassword();
  const rawPassword = suppliedPassword || temporaryPassword!;
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const technician = await withTransaction(async (tx) => {
    const techUser = await queryOne<{ id: string }>(
      `INSERT INTO "User" ("companyId", "name", "email", "passwordHash", "role", "isActive")
       VALUES ($1, $2, $3, $4, 'TEKNISI'::"Role", true)
       RETURNING "id"`,
      [companyId, fullName, email, passwordHash],
      tx
    );
    if (!techUser) throw new Error("Gagal membuat akun teknisi.");

    const createdTech = await queryOne<TechnicianRow>(
      `INSERT INTO "Technician" (
         "companyId", "vendorId", "userId", "fullName", "whatsapp",
         "email", "facePhotoUrl", "skills", "status", "approvalStatus"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], 'ACTIVE'::"TechnicianStatus", 'PENDING'::"ApprovalStatus")
       RETURNING *`,
      [
        companyId,
        vendor.id,
        techUser.id,
        fullName,
        whatsapp,
        email,
        input.facePhotoUrl || null,
        cleanSkills,
      ],
      tx
    );
    if (!createdTech) throw new Error("Gagal menyimpan profil teknisi.");

    // Notifikasi web ke Admin & audit ikut transaksi
    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "companyId" = $1 AND "role" = 'ADMIN'::"Role" AND "isActive" = true`,
      [companyId],
      tx
    );

    if (admins.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, uid, $2, $3, $4 FROM unnest($5::text[]) AS uid`,
        [
          companyId,
          "Teknisi Baru Menunggu Persetujuan",
          `PIC Vendor ${vendor.name} mendaftarkan teknisi baru: ${fullName} (${email}). Setujui agar teknisi dapat login dan menerima SPK.`,
          "/dashboard/vendor",
          admins.map((a) => a.id),
        ],
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
        entityName: "Technician",
        entityId: createdTech.id,
        action: "CREATE",
        summary: `PIC ${vendor.name} mendaftarkan teknisi baru: ${createdTech.fullName} (Menunggu Persetujuan Admin)`,
        oldValues: null,
        newValues: {
          fullName: createdTech.fullName,
          email: createdTech.email,
          whatsapp: createdTech.whatsapp,
          vendorName: vendor.name,
          approvalStatus: createdTech.approvalStatus,
        },
      },
      tx
    );

    return createdTech;
  });

  return { ...technician, temporaryPassword };
}

/**
 * 3. PIC Vendor mengelola status teknisinya (ACTIVE / ON_LEAVE / INACTIVE)
 * Mengikuti aturan PRD v0.2 Bagian 5:
 * - Cuti tidak dihitung dalam batas 60 hari.
 * - Nonaktif manual oleh PIC dapat diaktifkan kembali langsung oleh PIC tanpa Admin.
 * - Nonaktif otomatis sistem (60 hari) memerlukan pengajuan aktif kembali ke Admin.
 */
export async function updateTechnicianStatusByPic(
  actor: SessionUser,
  technicianId: string,
  newStatus: TechnicianStatus
) {
  assertPermission(actor.role, "MANAGE_OWN_TECHNICIANS");
  if (!actor.companyId) {
    throw new Error("Akun PIC tidak terhubung ke perusahaan.");
  }

  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1`,
    [actor.id]
  );
  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const tech = await queryOne<TechnicianRow>(
    `SELECT * FROM "Technician" WHERE "id" = $1 AND "vendorId" = $2`,
    [technicianId, vendor.id]
  );
  if (!tech) {
    throw new Error("Teknisi tidak ditemukan di vendor Anda.");
  }
  if (tech.approvalStatus !== "APPROVED") {
    throw new Error(
      tech.approvalStatus === "PENDING"
        ? "Teknisi masih menunggu persetujuan Admin. Status kerja belum bisa diubah."
        : "Pendaftaran teknisi ini ditolak Admin. Status kerja tidak bisa diubah."
    );
  }
  if (tech.status === newStatus) {
    throw new Error("Status teknisi sudah sama dengan pilihan Anda.");
  }

  // PRD 5.3: Aktif kembali dibedakan menurut penyebab nonaktif
  if (newStatus === "ACTIVE" && tech.status === "INACTIVE") {
    if (tech.deactivationReason === "AUTO_60_DAYS") {
      throw new Error(
        "Teknisi dinonaktifkan otomatis oleh sistem (60 hari). PIC harus mengajukan aktif kembali ke Admin untuk disetujui ulang (PRD Bagian 5.3)."
      );
    }
    if (tech.deactivationReason === "MANUAL_BY_ADMIN") {
      throw new Error(
        "Teknisi dinonaktifkan oleh Admin dan hanya dapat diaktifkan kembali oleh Admin."
      );
    }
  }

  const deactivationReason =
    newStatus === "INACTIVE" ? "MANUAL_BY_PIC" : null;
  const nextDeactivationReason =
    newStatus === "ACTIVE" || newStatus === "ON_LEAVE"
      ? null
      : deactivationReason;
  const nextLastActiveAt = newStatus === "ACTIVE" ? new Date() : tech.lastActiveAt;
  const companyId = actor.companyId;

  return withTransaction(async (tx) => {
    const updated = await queryOne<TechnicianRow>(
      `UPDATE "Technician"
       SET "status" = $2::"TechnicianStatus",
           "deactivationReason" = $3,
           "reactivationRequested" = false,
           "lastActiveAt" = $4,
           "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [tech.id, newStatus, nextDeactivationReason, nextLastActiveAt],
      tx
    );
    if (!updated) throw new Error("Gagal mengubah status teknisi.");

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId,
        },
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `PIC mengubah status teknisi ${tech.fullName} menjadi ${newStatus}${
          newStatus === "INACTIVE" ? " (Manual oleh PIC)" : ""
        }`,
        oldValues: { status: tech.status, deactivationReason: tech.deactivationReason },
        newValues: { status: updated.status, deactivationReason: updated.deactivationReason },
      },
      tx
    );

    return updated;
  });
}

/**
 * 3b. PIC mengajukan pengaktifan kembali teknisi yang dinonaktifkan otomatis (60 hari).
 * Menunggu persetujuan ulang Admin (PRD 5.3).
 */
export async function requestTechnicianReactivationByPic(
  actor: SessionUser,
  technicianId: string,
  note?: string
) {
  assertPermission(actor.role, "MANAGE_OWN_TECHNICIANS");
  if (!actor.companyId) {
    throw new Error("Akun PIC tidak terhubung ke perusahaan.");
  }

  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1`,
    [actor.id]
  );
  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const tech = await queryOne<TechnicianRow>(
    `SELECT * FROM "Technician" WHERE "id" = $1 AND "vendorId" = $2`,
    [technicianId, vendor.id]
  );
  if (!tech) {
    throw new Error("Teknisi tidak ditemukan di vendor Anda.");
  }
  if (tech.approvalStatus !== "APPROVED" || tech.status !== "INACTIVE") {
    throw new Error("Hanya teknisi yang sedang nonaktif yang bisa diajukan aktif kembali.");
  }
  if (tech.reactivationRequested) {
    throw new Error("Pengajuan aktif kembali teknisi ini masih menunggu keputusan Admin.");
  }

  const companyId = actor.companyId;
  const cleanNote = note?.trim() || "Pengajuan aktif kembali oleh PIC Vendor";

  return withTransaction(async (tx) => {
    const updatedCount = await execute(
      `UPDATE "Technician"
       SET "reactivationRequested" = true, "reactivationNote" = $2, "updatedAt" = NOW()
       WHERE "id" = $1 AND "reactivationRequested" = false AND "status" = 'INACTIVE'::"TechnicianStatus"`,
      [tech.id, cleanNote],
      tx
    );
    if (updatedCount !== 1) {
      throw new Error("Status pengajuan aktif kembali teknisi sudah berubah, muat ulang halaman.");
    }

    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "companyId" = $1 AND "role" = 'ADMIN'::"Role" AND "isActive" = true`,
      [companyId],
      tx
    );

    if (admins.length > 0) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         SELECT $1, uid, $2, $3, $4 FROM unnest($5::text[]) AS uid`,
        [
          companyId,
          "Pengajuan Aktif Kembali Teknisi",
          `PIC Vendor ${vendor.name} mengajukan pengaktifan kembali teknisi ${tech.fullName} yang dinonaktifkan sistem. Catatan: ${
            note?.trim() || "-"
          }`,
          "/dashboard/vendor",
          admins.map((a) => a.id),
        ],
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
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `PIC mengajukan aktif kembali teknisi ${tech.fullName} ke Admin`,
        oldValues: { reactivationRequested: false },
        newValues: { reactivationRequested: true, reactivationNote: note },
      },
      tx
    );

    const updated = await queryOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "id" = $1`,
      [tech.id],
      tx
    );
    if (!updated) throw new Error("Data teknisi tidak ditemukan.");
    return updated;
  });
}

/**
 * 4. Admin menyetujui atau menolak teknisi (Teknisi baru aktif setelah disetujui Admin).
 */
export async function approveOrRejectTechnicianByAdmin(
  actor: SessionUser,
  technicianId: string,
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED">,
  reason?: string
) {
  assertPermission(actor.role, "APPROVE_TECHNICIANS");
  const companyId = requireCompany(actor);

  const tech = await queryOne<
    TechnicianRow & { vendorName: string; vendorPicUserId: string | null }
  >(
    `SELECT t.*, v."name" AS "vendorName", v."picUserId" AS "vendorPicUserId"
     FROM "Technician" t
     JOIN "Vendor" v ON v."id" = t."vendorId"
     WHERE t."id" = $1 AND t."companyId" = $2`,
    [technicianId, companyId]
  );
  if (!tech) {
    throw new Error("Data teknisi tidak ditemukan di perusahaan Anda.");
  }
  if (tech.approvalStatus !== "PENDING") {
    throw new Error(
      `Teknisi ${tech.fullName} sudah diproses sebelumnya (${
        tech.approvalStatus === "APPROVED" ? "disetujui" : "ditolak"
      }).`
    );
  }
  const cleanReason = reason?.trim() ?? "";
  if (decision === "REJECTED" && !cleanReason) {
    throw new Error("Alasan penolakan wajib diisi agar PIC Vendor tahu apa yang perlu diperbaiki.");
  }

  const now = new Date();
  return withTransaction(async (tx) => {
    const nextStatus = decision === "REJECTED" ? "INACTIVE" : tech.status;
    const nextLastActive = decision === "APPROVED" ? now : tech.lastActiveAt;

    const guardCount = await execute(
      `UPDATE "Technician"
       SET "approvalStatus" = $2::"ApprovalStatus",
           "approvedById" = $3,
           "approvedAt" = $4,
           "rejectionReason" = $5,
           "status" = $6::"TechnicianStatus",
           "lastActiveAt" = $7,
           "updatedAt" = $4
       WHERE "id" = $1 AND "approvalStatus" = 'PENDING'::"ApprovalStatus"`,
      [
        tech.id,
        decision,
        actor.id,
        now,
        decision === "REJECTED" ? cleanReason : null,
        nextStatus,
        nextLastActive,
      ],
      tx
    );
    if (guardCount !== 1) {
      throw new Error("Persetujuan teknisi sudah diproses sebelumnya.");
    }

    if (decision === "REJECTED") {
      await execute(
        `UPDATE "User" SET "isActive" = false, "updatedAt" = NOW() WHERE "id" = $1`,
        [tech.userId],
        tx
      );
    }

    if (tech.vendorPicUserId) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          tech.vendorPicUserId,
          decision === "APPROVED"
            ? "Teknisi Disetujui Admin"
            : "Pendaftaran Teknisi Ditolak",
          decision === "APPROVED"
            ? `Teknisi ${tech.fullName} disetujui dan kini bisa login serta menerima SPK.`
            : `Pendaftaran teknisi ${tech.fullName} ditolak Admin. Alasan: ${cleanReason}`,
          "/dashboard/teknisi",
        ],
        tx
      );
    }

    const updated = await queryOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "id" = $1`,
      [tech.id],
      tx
    );
    if (!updated) throw new Error("Data teknisi tidak ditemukan.");

    await recordAuditLog(
      {
        actor: auditActorOf(actor, companyId),
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `Admin ${decision === "APPROVED" ? "menyetujui" : "menolak"} teknisi ${tech.fullName} (${tech.vendorName})${
          decision === "REJECTED" ? `: ${cleanReason}` : ""
        }`,
        oldValues: { approvalStatus: tech.approvalStatus },
        newValues: {
          approvalStatus: updated.approvalStatus,
          approvedBy: actor.name,
          ...(decision === "REJECTED" ? { rejectionReason: cleanReason } : {}),
        },
      },
      tx
    );

    return updated;
  });
}

/**
 * 4c. Admin menolak pengajuan aktif kembali dari PIC (teknisi tetap nonaktif).
 */
export async function rejectTechnicianReactivationByAdmin(
  actor: SessionUser,
  technicianId: string,
  note: string
) {
  assertPermission(actor.role, "APPROVE_TECHNICIANS");
  const companyId = requireCompany(actor);
  const cleanNote = note.trim();
  if (!cleanNote) {
    throw new Error("Alasan penolakan pengajuan aktif kembali wajib diisi.");
  }

  const tech = await queryOne<
    TechnicianRow & { vendorPicUserId: string | null }
  >(
    `SELECT t.*, v."picUserId" AS "vendorPicUserId"
     FROM "Technician" t
     JOIN "Vendor" v ON v."id" = t."vendorId"
     WHERE t."id" = $1 AND t."companyId" = $2`,
    [technicianId, companyId]
  );
  if (!tech) throw new Error("Data teknisi tidak ditemukan.");
  if (!tech.reactivationRequested) {
    throw new Error("Tidak ada pengajuan aktif kembali yang menunggu untuk teknisi ini.");
  }

  return withTransaction(async (tx) => {
    const guardCount = await execute(
      `UPDATE "Technician"
       SET "reactivationRequested" = false, "reactivationNote" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "reactivationRequested" = true`,
      [tech.id],
      tx
    );
    if (guardCount !== 1) {
      throw new Error("Status pengajuan aktif kembali sudah berubah, muat ulang halaman.");
    }

    if (tech.vendorPicUserId) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          tech.vendorPicUserId,
          "Pengajuan Aktif Kembali Ditolak",
          `Admin menolak pengajuan aktif kembali teknisi ${tech.fullName}. Alasan: ${cleanNote}`,
          "/dashboard/teknisi",
        ],
        tx
      );
    }

    await recordAuditLog(
      {
        actor: auditActorOf(actor, companyId),
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `Admin menolak pengajuan aktif kembali teknisi ${tech.fullName}: ${cleanNote}`,
        oldValues: { reactivationRequested: true, reactivationNote: tech.reactivationNote },
        newValues: { reactivationRequested: false, rejectionNote: cleanNote },
      },
      tx
    );

    const updated = await queryOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "id" = $1`,
      [tech.id],
      tx
    );
    if (!updated) throw new Error("Data teknisi tidak ditemukan.");
    return updated;
  });
}

/**
 * 4d. Admin menonaktifkan teknisi secara manual (mis. pelanggaran). Hanya Admin yang dapat
 * mengaktifkannya kembali. Ditolak bila teknisi masih memegang SPK berjalan.
 */
export async function deactivateTechnicianByAdmin(
  actor: SessionUser,
  technicianId: string,
  reason: string
) {
  assertPermission(actor.role, "APPROVE_TECHNICIANS");
  const companyId = requireCompany(actor);
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Alasan penonaktifan wajib diisi.");

  const tech = await queryOne<
    TechnicianRow & { vendorName: string; vendorPicUserId: string | null }
  >(
    `SELECT t.*, v."name" AS "vendorName", v."picUserId" AS "vendorPicUserId"
     FROM "Technician" t
     JOIN "Vendor" v ON v."id" = t."vendorId"
     WHERE t."id" = $1 AND t."companyId" = $2`,
    [technicianId, companyId]
  );
  if (!tech) throw new Error("Data teknisi tidak ditemukan.");
  if (tech.approvalStatus !== "APPROVED") {
    throw new Error("Hanya teknisi yang sudah disetujui yang bisa dinonaktifkan.");
  }
  if (tech.status === "INACTIVE") {
    throw new Error("Teknisi ini sudah nonaktif.");
  }

  const openWorkOrders = await query<{ spkNo: string }>(
    `SELECT wo."spkNo"
     FROM "WorkOrder" wo
     JOIN "Report" r ON r."id" = wo."reportId"
     WHERE wo."technicianId" = $1
       AND r."archivedAt" IS NULL
       AND r."status" = ANY($2::"ReportStatus"[])`,
    [tech.id, [...OPEN_WORK_ORDER_REPORT_STATUSES]]
  );
  if (openWorkOrders.length > 0) {
    throw new Error(
      `Teknisi masih memegang SPK berjalan (${openWorkOrders
        .map((w) => w.spkNo)
        .join(", ")}). Selesaikan atau alihkan SPK terlebih dahulu.`
    );
  }

  return withTransaction(async (tx) => {
    const guardCount = await execute(
      `UPDATE "Technician"
       SET "status" = 'INACTIVE'::"TechnicianStatus",
           "deactivationReason" = 'MANUAL_BY_ADMIN',
           "reactivationRequested" = false,
           "reactivationNote" = $2,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" <> 'INACTIVE'::"TechnicianStatus"`,
      [tech.id, cleanReason],
      tx
    );
    if (guardCount !== 1) {
      throw new Error("Status teknisi sudah berubah, muat ulang halaman.");
    }

    if (tech.vendorPicUserId) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          tech.vendorPicUserId,
          "Teknisi Dinonaktifkan Admin",
          `Admin menonaktifkan teknisi ${tech.fullName}. Alasan: ${cleanReason}`,
          "/dashboard/teknisi",
        ],
        tx
      );
    }

    await recordAuditLog(
      {
        actor: auditActorOf(actor, companyId),
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `Admin menonaktifkan teknisi ${tech.fullName} (${tech.vendorName}): ${cleanReason}`,
        oldValues: { status: tech.status, deactivationReason: tech.deactivationReason },
        newValues: { status: "INACTIVE", deactivationReason: "MANUAL_BY_ADMIN", reason: cleanReason },
      },
      tx
    );

    const updated = await queryOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "id" = $1`,
      [tech.id],
      tx
    );
    if (!updated) throw new Error("Data teknisi tidak ditemukan.");
    return updated;
  });
}

/**
 * 4e. Admin memperbarui data vendor (kontrak, garansi, area layanan, dll).
 */
export async function updateVendor(
  actor: SessionUser,
  vendorId: string,
  input: {
    name: string;
    type: VendorType;
    skills: string[];
    cooperationScheme?: string | null;
    contractStart?: Date | null;
    contractEnd?: Date | null;
    warrantyDays: number;
    address?: string | null;
    npwp?: string | null;
    clusterIds: string[];
  }
) {
  assertPermission(actor.role, "MANAGE_VENDORS");
  const companyId = requireCompany(actor);

  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "id" = $1 AND "companyId" = $2`,
    [vendorId, companyId]
  );
  if (!vendor) throw new Error("Vendor tidak ditemukan di perusahaan Anda.");

  const serviceAreas = await query<{
    id: string;
    clusterId: string;
    clusterName: string;
  }>(
    `SELECT vsa."id", vsa."clusterId", cl."name" AS "clusterName"
     FROM "VendorServiceArea" vsa
     JOIN "Cluster" cl ON cl."id" = vsa."clusterId"
     WHERE vsa."vendorId" = $1`,
    [vendor.id]
  );

  const name = input.name.trim();
  const skills = input.skills.map((s) => s.trim()).filter(Boolean);
  if (!name) throw new Error("Nama vendor wajib diisi.");
  if (skills.length === 0) throw new Error("Minimal satu keahlian vendor wajib diisi.");
  if (!Number.isFinite(input.warrantyDays) || input.warrantyDays <= 0) {
    throw new Error("Masa garansi harus lebih dari 0 hari.");
  }
  assertContractRange(input.contractStart ?? null, input.contractEnd ?? null);

  const clusterIds = Array.from(new Set(input.clusterIds));
  if (clusterIds.length === 0) {
    throw new Error("Pilih minimal satu cluster sebagai area layanan vendor.");
  }
  const existingClusterIds = new Set(serviceAreas.map((a) => a.clusterId));
  const clusters = await query<ClusterRow>(
    `SELECT * FROM "Cluster" WHERE "id" = ANY($1::text[]) AND "companyId" = $2`,
    [clusterIds, companyId]
  );
  if (clusters.length !== clusterIds.length) {
    throw new Error("Satu atau lebih cluster area layanan tidak valid.");
  }
  const newlyAddedInactive = clusters.filter(
    (c) => !c.isActive && !existingClusterIds.has(c.id)
  );
  if (newlyAddedInactive.length > 0) {
    throw new Error(
      `Cluster nonaktif tidak bisa ditambahkan sebagai area layanan: ${newlyAddedInactive
        .map((c) => c.name)
        .join(", ")}.`
    );
  }

  const toRemoveIds = serviceAreas
    .filter((a) => !clusterIds.includes(a.clusterId))
    .map((a) => a.id);
  const toAdd = clusterIds.filter((id) => !existingClusterIds.has(id));
  const clusterNameById = new Map(clusters.map((c) => [c.id, c.name]));

  return withTransaction(async (tx) => {
    if (toRemoveIds.length > 0) {
      await execute(
        `DELETE FROM "VendorServiceArea" WHERE "id" = ANY($1::text[])`,
        [toRemoveIds],
        tx
      );
    }
    if (toAdd.length > 0) {
      await execute(
        `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
         SELECT $1, cid FROM unnest($2::text[]) AS cid`,
        [vendor.id, toAdd],
        tx
      );
    }

    const updated = await queryOne<VendorRow>(
      `UPDATE "Vendor"
       SET "name" = $2,
           "type" = $3::"VendorType",
           "skills" = $4::text[],
           "cooperationScheme" = $5,
           "contractStart" = $6,
           "contractEnd" = $7,
           "warrantyDays" = $8,
           "address" = $9,
           "npwp" = $10,
           "updatedAt" = NOW()
       WHERE "id" = $1
       RETURNING *`,
      [
        vendor.id,
        name,
        input.type,
        skills,
        input.cooperationScheme?.trim() || null,
        input.contractStart ?? null,
        input.contractEnd ?? null,
        Math.round(input.warrantyDays),
        input.address?.trim() || null,
        input.npwp?.trim() || null,
      ],
      tx
    );
    if (!updated) throw new Error("Gagal memperbarui vendor.");

    await recordAuditLog(
      {
        actor: auditActorOf(actor, companyId),
        entityName: "Vendor",
        entityId: vendor.id,
        action: "UPDATE",
        summary: `Memperbarui data vendor ${updated.name}`,
        oldValues: {
          name: vendor.name,
          type: vendor.type,
          skills: vendor.skills,
          cooperationScheme: vendor.cooperationScheme,
          contractStart: vendor.contractStart?.toISOString() ?? null,
          contractEnd: vendor.contractEnd?.toISOString() ?? null,
          warrantyDays: vendor.warrantyDays,
          address: vendor.address,
          npwp: vendor.npwp,
          serviceClusters: serviceAreas.map((a) => a.clusterName),
        },
        newValues: {
          name: updated.name,
          type: updated.type,
          skills: updated.skills,
          cooperationScheme: updated.cooperationScheme,
          contractStart: updated.contractStart?.toISOString() ?? null,
          contractEnd: updated.contractEnd?.toISOString() ?? null,
          warrantyDays: updated.warrantyDays,
          address: updated.address,
          npwp: updated.npwp,
          serviceClusters: clusterIds.map((id) => clusterNameById.get(id) ?? id),
        },
      },
      tx
    );

    return updated;
  });
}

/**
 * 4f. Admin mengaktifkan/menonaktifkan vendor. Vendor nonaktif tidak bisa dipilih untuk SPK baru.
 * Ditolak bila vendor masih memegang SPK berjalan.
 */
export async function setVendorActive(
  actor: SessionUser,
  vendorId: string,
  isActive: boolean
) {
  assertPermission(actor.role, "MANAGE_VENDORS");
  const companyId = requireCompany(actor);

  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "id" = $1 AND "companyId" = $2`,
    [vendorId, companyId]
  );
  if (!vendor) throw new Error("Vendor tidak ditemukan di perusahaan Anda.");
  if (vendor.isActive === isActive) {
    throw new Error(`Vendor ini sudah ${isActive ? "aktif" : "nonaktif"}.`);
  }

  if (!isActive) {
    const openCount = await queryCount(
      `SELECT COUNT(*)::int AS count
       FROM "WorkOrder" wo
       JOIN "Report" r ON r."id" = wo."reportId"
       WHERE wo."vendorId" = $1
         AND r."archivedAt" IS NULL
         AND r."status" = ANY($2::"ReportStatus"[])`,
      [vendor.id, [...OPEN_WORK_ORDER_REPORT_STATUSES]]
    );
    if (openCount > 0) {
      throw new Error(
        `Vendor masih memegang ${openCount} SPK berjalan. Selesaikan atau alihkan SPK terlebih dahulu.`
      );
    }
  }

  return withTransaction(async (tx) => {
    const updated = await queryOne<VendorRow>(
      `UPDATE "Vendor" SET "isActive" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *`,
      [vendor.id, isActive],
      tx
    );
    if (!updated) throw new Error("Gagal mengubah status vendor.");

    if (vendor.picUserId) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          vendor.picUserId,
          isActive ? "Vendor Diaktifkan Kembali" : "Vendor Dinonaktifkan",
          isActive
            ? `Admin mengaktifkan kembali ${vendor.name}. Vendor dapat menerima SPK lagi.`
            : `Admin menonaktifkan ${vendor.name}. Vendor tidak akan menerima SPK baru.`,
          "/dashboard/teknisi",
        ],
        tx
      );
    }

    await recordAuditLog(
      {
        actor: auditActorOf(actor, companyId),
        entityName: "Vendor",
        entityId: vendor.id,
        action: "UPDATE",
        summary: `${isActive ? "Mengaktifkan" : "Menonaktifkan"} vendor ${vendor.name}`,
        oldValues: { isActive: vendor.isActive },
        newValues: { isActive },
      },
      tx
    );

    return updated;
  });
}

/**
 * 4b. Admin menyetujui pengaktifan kembali teknisi yang dinonaktifkan otomatis.
 */
export async function approveTechnicianReactivationByAdmin(
  actor: SessionUser,
  technicianId: string
) {
  assertPermission(actor.role, "APPROVE_TECHNICIANS");
  if (!actor.companyId) {
    throw new Error("Akun Admin tidak terhubung ke perusahaan.");
  }

  const tech = await queryOne<
    TechnicianRow & { vendorPicUserId: string | null }
  >(
    `SELECT t.*, v."picUserId" AS "vendorPicUserId"
     FROM "Technician" t
     JOIN "Vendor" v ON v."id" = t."vendorId"
     WHERE t."id" = $1 AND t."companyId" = $2`,
    [technicianId, actor.companyId]
  );
  if (!tech) {
    throw new Error("Data teknisi tidak ditemukan.");
  }
  if (tech.approvalStatus === "REJECTED") {
    throw new Error(
      "Pendaftaran teknisi ini ditolak. Teknisi harus didaftarkan ulang oleh PIC Vendor."
    );
  }
  if (tech.approvalStatus === "PENDING") {
    throw new Error("Teknisi masih menunggu persetujuan pendaftaran, bukan pengaktifan kembali.");
  }
  if (tech.status !== "INACTIVE") {
    throw new Error("Teknisi ini tidak sedang nonaktif.");
  }

  const companyId = actor.companyId;
  const now = new Date();
  return withTransaction(async (tx) => {
    const guardCount = await execute(
      `UPDATE "Technician"
       SET "status" = 'ACTIVE'::"TechnicianStatus",
           "approvalStatus" = 'APPROVED'::"ApprovalStatus",
           "reactivationRequested" = false,
           "reactivationNote" = NULL,
           "deactivationReason" = NULL,
           "lastActiveAt" = $2,
           "updatedAt" = $2
       WHERE "id" = $1 AND "status" = 'INACTIVE'::"TechnicianStatus"`,
      [tech.id, now],
      tx
    );
    if (guardCount !== 1) {
      throw new Error("Status teknisi sudah berubah, muat ulang halaman.");
    }

    await execute(
      `UPDATE "User" SET "isActive" = true, "updatedAt" = NOW() WHERE "id" = $1`,
      [tech.userId],
      tx
    );

    if (tech.vendorPicUserId) {
      await execute(
        `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          tech.vendorPicUserId,
          "Pengaktifan Kembali Teknisi Disetujui",
          `Admin ${actor.name} menyetujui pengaktifan kembali teknisi ${tech.fullName}. Teknisi kini aktif dan dapat ditugaskan kembali.`,
          "/dashboard/teknisi",
        ],
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
        entityName: "Technician",
        entityId: tech.id,
        action: "UPDATE",
        summary: `Admin ${actor.name} menyetujui pengaktifan kembali teknisi ${tech.fullName}`,
        oldValues: { status: tech.status, reactivationRequested: true },
        newValues: { status: "ACTIVE", reactivationRequested: false },
      },
      tx
    );

    const updated = await queryOne<TechnicianRow>(
      `SELECT * FROM "Technician" WHERE "id" = $1`,
      [tech.id],
      tx
    );
    if (!updated) throw new Error("Data teknisi tidak ditemukan.");
    return updated;
  });
}

/**
 * 5. PIC Vendor mengonfirmasi daftar teknisinya (Permintaan tiap 3 bulan).
 */
export async function confirmTechnicianRosterByPic(actor: SessionUser) {
  assertPermission(actor.role, "MANAGE_OWN_TECHNICIANS");
  const vendor = await queryOne<VendorRow>(
    `SELECT * FROM "Vendor" WHERE "picUserId" = $1`,
    [actor.id]
  );
  if (!vendor) {
    throw new Error("Data vendor tidak ditemukan.");
  }

  const now = new Date();
  return withTransaction(async (tx) => {
    const updated = await queryOne<VendorRow>(
      `UPDATE "Vendor" SET "lastTechnicianConfirmedAt" = $2, "updatedAt" = $2 WHERE "id" = $1 RETURNING *`,
      [vendor.id, now],
      tx
    );
    if (!updated) throw new Error("Data vendor tidak ditemukan.");

    await recordAuditLog(
      {
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          companyId: actor.companyId,
        },
        entityName: "Vendor",
        entityId: vendor.id,
        action: "UPDATE",
        summary: `PIC ${vendor.name} mengonfirmasi daftar teknisi berkala (3 bulanan)`,
        oldValues: {
          lastTechnicianConfirmedAt:
            vendor.lastTechnicianConfirmedAt?.toISOString() ?? null,
        },
        newValues: {
          lastTechnicianConfirmedAt:
            updated.lastTechnicianConfirmedAt?.toISOString() ?? null,
        },
      },
      tx
    );

    return updated;
  });
}

/**
 * 6. Job Terjadwal Sistem (Fase 2):
 * - Menonaktifkan teknisi yang tidak login atau tidak mendapat tugas selama 60 hari.
 * - Setiap 3 bulan (90 hari) meminta PIC Vendor mengonfirmasi daftar teknisinya via Notifikasi Web.
 */
export async function runPhase2MaintenanceJobAsAdmin(actor: SessionUser) {
  assertPermission(actor.role, "APPROVE_TECHNICIANS");
  const companyId = requireCompany(actor);
  return runPhase2MaintenanceJob(companyId);
}

export async function runPhase2MaintenanceJob(companyId: string) {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // PRD 5.2: Cari teknisi ACTIVE yang lastActiveAt < 60 hari lalu (status ON_LEAVE tidak dihitung)
  const staleTechnicians = await query<
    TechnicianRow & { vendorName: string; vendorPicUserId: string | null }
  >(
    `SELECT t.*, v."name" AS "vendorName", v."picUserId" AS "vendorPicUserId"
     FROM "Technician" t
     JOIN "Vendor" v ON v."id" = t."vendorId"
     WHERE t."companyId" = $1
       AND t."status" = 'ACTIVE'::"TechnicianStatus"
       AND t."approvalStatus" = 'APPROVED'::"ApprovalStatus"
       AND t."lastActiveAt" < $2`,
    [companyId, sixtyDaysAgo]
  );

  let deactivatedCount = 0;
  for (const tech of staleTechnicians) {
    // Keputusan 7: Sistem TIDAK menonaktifkan teknisi yang masih memegang SPK aktif
    const openWoCount = await queryCount(
      `SELECT COUNT(*)::int AS count
       FROM "WorkOrder" wo
       JOIN "Report" r ON r."id" = wo."reportId"
       WHERE wo."technicianId" = $1
         AND r."archivedAt" IS NULL
         AND r."status" = ANY($2::"ReportStatus"[])`,
      [tech.id, [...OPEN_WORK_ORDER_REPORT_STATUSES]]
    );
    if (openWoCount > 0) {
      continue;
    }

    const recentWorkOrder = await queryOne<{ id: string }>(
      `SELECT "id" FROM "WorkOrder" WHERE "technicianId" = $1 AND "assignedAt" >= $2 LIMIT 1`,
      [tech.id, sixtyDaysAgo]
    );

    if (!recentWorkOrder) {
      const didDeactivate = await withTransaction(async (tx) => {
        const guardCount = await execute(
          `UPDATE "Technician"
           SET "status" = 'INACTIVE'::"TechnicianStatus",
               "deactivationReason" = 'AUTO_60_DAYS',
               "updatedAt" = NOW()
           WHERE "id" = $1 AND "status" = 'ACTIVE'::"TechnicianStatus"`,
          [tech.id],
          tx
        );
        if (guardCount !== 1) return false;

        if (tech.vendorPicUserId) {
          await execute(
            `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
             VALUES ($1, $2, $3, $4, $5)`,
            [
              companyId,
              tech.vendorPicUserId,
              "Teknisi Dinonaktifkan Otomatis (60 Hari)",
              `Teknisi ${tech.fullName} dinonaktifkan otomatis oleh sistem karena tidak aktif atau tidak menerima tugas selama 60 hari. Anda dapat mengajukan aktif kembali ke Admin melalui menu Teknisi Saya.`,
              "/dashboard/teknisi",
            ],
            tx
          );
        }

        await recordAuditLog(
          {
            companyId,
            actor: {
              id: "",
              name: SYSTEM_AUDIT_ACTOR_NAME,
              role: "ADMIN",
              companyId,
            },
            entityName: "Technician",
            entityId: tech.id,
            action: "UPDATE",
            summary: `Sistem menonaktifkan otomatis teknisi ${tech.fullName} (${tech.vendorName}) karena tidak aktif >= 60 hari`,
            oldValues: { status: "ACTIVE" },
            newValues: { status: "INACTIVE", deactivationReason: "AUTO_60_DAYS" },
          },
          tx
        );

        return true;
      });

      if (didDeactivate) deactivatedCount++;
    }
  }

  // Cari vendor yang belum konfirmasi daftar teknisi >= 90 hari (3 bulan)
  const vendorsNeedingConfirmation = await query<VendorRow>(
    `SELECT *
     FROM "Vendor"
     WHERE "companyId" = $1
       AND "isActive" = true
       AND "picUserId" IS NOT NULL
       AND ("lastTechnicianConfirmedAt" IS NULL OR "lastTechnicianConfirmedAt" < $2)`,
    [companyId, ninetyDaysAgo]
  );

  const reminderTargets = vendorsNeedingConfirmation.filter(
    (v): v is VendorRow & { picUserId: string } => Boolean(v.picUserId)
  );

  if (reminderTargets.length > 0) {
    await execute(
      `INSERT INTO "Notification" ("companyId", "recipientId", "title", "message", "linkUrl")
       SELECT $1, rec_id, $2, msg, $3
       FROM unnest($4::text[], $5::text[]) AS t(rec_id, msg)`,
      [
        companyId,
        "Pengingat 3 Bulanan: Konfirmasi Daftar Teknisi",
        "/dashboard/teknisi",
        reminderTargets.map((v) => v.picUserId),
        reminderTargets.map(
          (v) =>
            `Mohon periksa dan konfirmasi daftar teknisi aktif untuk ${v.name} (pemeriksaan rutin tiap 3 bulan).`
        ),
      ]
    );
  }

  return {
    deactivatedCount,
    reminderSentCount: reminderTargets.length,
  };
}

