import bcrypt from "bcryptjs";
import type { ApprovalStatus, TechnicianStatus, VendorType } from "@prisma/client";
import { prisma } from "../prisma";
import { assertPermission } from "../permissions";
import { recordAuditLog } from "../audit";
import { sendTransactionalEmail } from "../email";
import type { SessionUser } from "../auth";

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
    prisma.cluster.findMany({
      where: { id: { in: uniqueClusterIds }, companyId, isActive: true },
    }),
    prisma.user.findUnique({ where: { email: picEmail } }),
  ]);

  if (validClusters.length !== uniqueClusterIds.length) {
    throw new Error(
      "Satu atau lebih cluster area layanan tidak valid atau sedang nonaktif."
    );
  }
  if (existingUser) {
    throw new Error(`Email PIC ${picEmail} sudah terdaftar.`);
  }

  const rawPassword =
    input.picPassword?.trim() || process.env.SEED_DEFAULT_PASSWORD;
  if (!rawPassword) {
    throw new Error("Kata sandi awal PIC wajib diisi.");
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // Akun PIC dan data vendor dibuat bersamaan: jika salah satu gagal, keduanya batal.
  const { picUser, vendor } = await prisma.$transaction(async (tx) => {
    const picUser = await tx.user.create({
      data: {
        companyId,
        name: picName,
        email: picEmail,
        passwordHash,
        role: "PIC_VENDOR",
        isActive: true,
      },
    });

    const vendor = await tx.vendor.create({
      data: {
        companyId,
        name: vendorName,
        type: input.type,
        skills: cleanSkills,
        picUserId: picUser.id,
        cooperationScheme: input.cooperationScheme?.trim() || null,
        contractStart: input.contractStart || null,
        contractEnd: input.contractEnd || null,
        warrantyDays: input.warrantyDays > 0 ? input.warrantyDays : 30,
        address: input.address?.trim() || null,
        npwp: input.npwp?.trim() || null,
        lastTechnicianConfirmedAt: new Date(),
        serviceAreas: {
          create: validClusters.map((c) => ({ clusterId: c.id })),
        },
      },
    });
    return { picUser, vendor };
  });

  // Kirim email undangan ke PIC Vendor (User story Fase 2)
  await sendTransactionalEmail({
    companyId,
    toEmail: picEmail,
    subject: `Undangan Aktivasi Akun PIC Vendor – ${vendorName}`,
    bodyHtml: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p>Halo <strong>${picName}</strong>,</p>
        <p>Perusahaan Anda (<strong>${vendorName}</strong>) telah didaftarkan sebagai vendor rekanan di platform GreenPark.</p>
        <p>Area Layanan Cluster: <strong>${validClusters
          .map((c) => c.name)
          .join(", ")}</strong></p>
        <p>Silakan masuk menggunakan email <strong>${picEmail}</strong> untuk mendaftarkan teknisi lapangan Anda dan menerima SPK.</p>
      </div>
    `.trim(),
    triggerType: "VENDOR_INVITE",
  });

  await recordAuditLog({
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
  });

  return { vendor, picUser };
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
  const vendor = await prisma.vendor.findUnique({
    where: { picUserId: actor.id },
  });
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

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error(`Email teknisi ${email} sudah terdaftar.`);
  }

  const rawPassword =
    input.password?.trim() || process.env.SEED_DEFAULT_PASSWORD;
  if (!rawPassword) {
    throw new Error("Kata sandi awal teknisi wajib diisi.");
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const technician = await prisma.$transaction(async (tx) => {
    const techUser = await tx.user.create({
      data: {
        companyId,
        name: fullName,
        email,
        passwordHash,
        role: "TEKNISI",
        isActive: true,
      },
    });

    return tx.technician.create({
      data: {
        companyId,
        vendorId: vendor.id,
        userId: techUser.id,
        fullName,
        whatsapp,
        email,
        facePhotoUrl: input.facePhotoUrl || null,
        skills: cleanSkills,
        status: "ACTIVE",
        approvalStatus: "PENDING",
      },
    });
  });

  // Kriteria Penerimaan Fase 2: Notifikasi web ke Admin muncul saat ada teknisi baru menunggu persetujuan
  const admins = await prisma.user.findMany({
    where: { companyId, role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((adm) => ({
        companyId,
        recipientId: adm.id,
        title: "Teknisi Baru Menunggu Persetujuan",
        message: `PIC Vendor ${vendor.name} mendaftarkan teknisi baru: ${fullName} (${email}). Setujui agar teknisi dapat login dan menerima SPK.`,
        linkUrl: "/dashboard/vendor",
      })),
    });
  }

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId,
    },
    entityName: "Technician",
    entityId: technician.id,
    action: "CREATE",
    summary: `PIC ${vendor.name} mendaftarkan teknisi baru: ${technician.fullName} (Menunggu Persetujuan Admin)`,
    oldValues: null,
    newValues: {
      fullName: technician.fullName,
      email: technician.email,
      whatsapp: technician.whatsapp,
      vendorName: vendor.name,
      approvalStatus: technician.approvalStatus,
    },
  });

  return technician;
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

  const vendor = await prisma.vendor.findUnique({
    where: { picUserId: actor.id },
  });
  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, vendorId: vendor.id },
  });
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

  const updated = await prisma.technician.update({
    where: { id: tech.id },
    data: {
      status: newStatus,
      deactivationReason:
        newStatus === "ACTIVE" || newStatus === "ON_LEAVE"
          ? null
          : deactivationReason,
      reactivationRequested: false,
      lastActiveAt: newStatus === "ACTIVE" ? new Date() : tech.lastActiveAt,
    },
  });

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId: actor.companyId,
    },
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `PIC mengubah status teknisi ${tech.fullName} menjadi ${newStatus}${
      newStatus === "INACTIVE" ? " (Manual oleh PIC)" : ""
    }`,
    oldValues: { status: tech.status, deactivationReason: tech.deactivationReason },
    newValues: { status: updated.status, deactivationReason: updated.deactivationReason },
  });

  return updated;
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

  const vendor = await prisma.vendor.findUnique({
    where: { picUserId: actor.id },
  });
  if (!vendor) {
    throw new Error("Vendor tidak ditemukan.");
  }

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, vendorId: vendor.id },
  });
  if (!tech) {
    throw new Error("Teknisi tidak ditemukan di vendor Anda.");
  }
  if (tech.approvalStatus !== "APPROVED" || tech.status !== "INACTIVE") {
    throw new Error("Hanya teknisi yang sedang nonaktif yang bisa diajukan aktif kembali.");
  }
  if (tech.reactivationRequested) {
    throw new Error("Pengajuan aktif kembali teknisi ini masih menunggu keputusan Admin.");
  }

  const updated = await prisma.technician.update({
    where: { id: tech.id },
    data: {
      reactivationRequested: true,
      reactivationNote: note?.trim() || "Pengajuan aktif kembali oleh PIC Vendor",
    },
  });

  // Notifikasi ke seluruh Admin di perusahaan (PRD 7.1)
  const admins = await prisma.user.findMany({
    where: { companyId: actor.companyId, role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((adm) => ({
        companyId: actor.companyId!,
        recipientId: adm.id,
        title: "Pengajuan Aktif Kembali Teknisi",
        message: `PIC Vendor ${vendor.name} mengajukan pengaktifan kembali teknisi ${tech.fullName} yang dinonaktifkan sistem. Catatan: ${
          note?.trim() || "-"
        }`,
        linkUrl: "/dashboard/vendor",
      })),
    });
  }

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId: actor.companyId,
    },
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `PIC mengajukan aktif kembali teknisi ${tech.fullName} ke Admin`,
    oldValues: { reactivationRequested: false },
    newValues: { reactivationRequested: true, reactivationNote: note },
  });

  return updated;
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

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, companyId },
    include: { vendor: true },
  });
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

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.technician.update({
      where: { id: tech.id },
      data: {
        approvalStatus: decision,
        approvedById: actor.id,
        approvedAt: new Date(),
        rejectionReason: decision === "REJECTED" ? cleanReason : null,
        status: decision === "REJECTED" ? "INACTIVE" : tech.status,
        lastActiveAt: decision === "APPROVED" ? new Date() : tech.lastActiveAt,
      },
    });
    if (decision === "REJECTED") {
      await tx.user.update({
        where: { id: tech.userId },
        data: { isActive: false },
      });
    }
    return res;
  });

  if (tech.vendor.picUserId) {
    await prisma.notification.create({
      data: {
        companyId,
        recipientId: tech.vendor.picUserId,
        title:
          decision === "APPROVED"
            ? "Teknisi Disetujui Admin"
            : "Pendaftaran Teknisi Ditolak",
        message:
          decision === "APPROVED"
            ? `Teknisi ${tech.fullName} disetujui dan kini bisa login serta menerima SPK.`
            : `Pendaftaran teknisi ${tech.fullName} ditolak Admin. Alasan: ${cleanReason}`,
        linkUrl: "/dashboard/teknisi",
      },
    });
  }

  await recordAuditLog({
    actor: auditActorOf(actor, companyId),
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `Admin ${decision === "APPROVED" ? "menyetujui" : "menolak"} teknisi ${tech.fullName} (${tech.vendor.name})${
      decision === "REJECTED" ? `: ${cleanReason}` : ""
    }`,
    oldValues: { approvalStatus: tech.approvalStatus },
    newValues: {
      approvalStatus: updated.approvalStatus,
      approvedBy: actor.name,
      ...(decision === "REJECTED" ? { rejectionReason: cleanReason } : {}),
    },
  });

  return updated;
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

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, companyId },
    include: { vendor: true },
  });
  if (!tech) throw new Error("Data teknisi tidak ditemukan.");
  if (!tech.reactivationRequested) {
    throw new Error("Tidak ada pengajuan aktif kembali yang menunggu untuk teknisi ini.");
  }

  const updated = await prisma.technician.update({
    where: { id: tech.id },
    data: { reactivationRequested: false, reactivationNote: null },
  });

  if (tech.vendor.picUserId) {
    await prisma.notification.create({
      data: {
        companyId,
        recipientId: tech.vendor.picUserId,
        title: "Pengajuan Aktif Kembali Ditolak",
        message: `Admin menolak pengajuan aktif kembali teknisi ${tech.fullName}. Alasan: ${cleanNote}`,
        linkUrl: "/dashboard/teknisi",
      },
    });
  }

  await recordAuditLog({
    actor: auditActorOf(actor, companyId),
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `Admin menolak pengajuan aktif kembali teknisi ${tech.fullName}: ${cleanNote}`,
    oldValues: { reactivationRequested: true, reactivationNote: tech.reactivationNote },
    newValues: { reactivationRequested: false, rejectionNote: cleanNote },
  });

  return updated;
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

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, companyId },
    include: {
      vendor: true,
      workOrders: {
        where: { report: { status: { in: [...OPEN_WORK_ORDER_REPORT_STATUSES] } } },
        select: { spkNo: true },
      },
    },
  });
  if (!tech) throw new Error("Data teknisi tidak ditemukan.");
  if (tech.approvalStatus !== "APPROVED") {
    throw new Error("Hanya teknisi yang sudah disetujui yang bisa dinonaktifkan.");
  }
  if (tech.status === "INACTIVE") {
    throw new Error("Teknisi ini sudah nonaktif.");
  }
  if (tech.workOrders.length > 0) {
    throw new Error(
      `Teknisi masih memegang SPK berjalan (${tech.workOrders
        .map((w) => w.spkNo)
        .join(", ")}). Selesaikan atau alihkan SPK terlebih dahulu.`
    );
  }

  const updated = await prisma.technician.update({
    where: { id: tech.id },
    data: {
      status: "INACTIVE",
      deactivationReason: "MANUAL_BY_ADMIN",
      reactivationRequested: false,
      reactivationNote: cleanReason,
    },
  });

  if (tech.vendor.picUserId) {
    await prisma.notification.create({
      data: {
        companyId,
        recipientId: tech.vendor.picUserId,
        title: "Teknisi Dinonaktifkan Admin",
        message: `Admin menonaktifkan teknisi ${tech.fullName}. Alasan: ${cleanReason}`,
        linkUrl: "/dashboard/teknisi",
      },
    });
  }

  await recordAuditLog({
    actor: auditActorOf(actor, companyId),
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `Admin menonaktifkan teknisi ${tech.fullName} (${tech.vendor.name}): ${cleanReason}`,
    oldValues: { status: tech.status, deactivationReason: tech.deactivationReason },
    newValues: { status: "INACTIVE", deactivationReason: "MANUAL_BY_ADMIN", reason: cleanReason },
  });

  return updated;
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

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
    include: { serviceAreas: { include: { cluster: true } } },
  });
  if (!vendor) throw new Error("Vendor tidak ditemukan di perusahaan Anda.");

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
  const existingClusterIds = new Set(vendor.serviceAreas.map((a) => a.clusterId));
  const clusters = await prisma.cluster.findMany({
    where: { id: { in: clusterIds }, companyId },
  });
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

  const toRemove = vendor.serviceAreas.filter((a) => !clusterIds.includes(a.clusterId));
  const toAdd = clusterIds.filter((id) => !existingClusterIds.has(id));

  const updated = await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.vendorServiceArea.deleteMany({
        where: { id: { in: toRemove.map((a) => a.id) } },
      });
    }
    if (toAdd.length > 0) {
      await tx.vendorServiceArea.createMany({
        data: toAdd.map((clusterId) => ({ vendorId: vendor.id, clusterId })),
      });
    }
    return tx.vendor.update({
      where: { id: vendor.id },
      data: {
        name,
        type: input.type,
        skills,
        cooperationScheme: input.cooperationScheme?.trim() || null,
        contractStart: input.contractStart ?? null,
        contractEnd: input.contractEnd ?? null,
        warrantyDays: Math.round(input.warrantyDays),
        address: input.address?.trim() || null,
        npwp: input.npwp?.trim() || null,
      },
    });
  });

  const clusterNameById = new Map(clusters.map((c) => [c.id, c.name]));
  await recordAuditLog({
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
      serviceClusters: vendor.serviceAreas.map((a) => a.cluster.name),
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
  });

  return updated;
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

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
  });
  if (!vendor) throw new Error("Vendor tidak ditemukan di perusahaan Anda.");
  if (vendor.isActive === isActive) {
    throw new Error(`Vendor ini sudah ${isActive ? "aktif" : "nonaktif"}.`);
  }

  if (!isActive) {
    const openCount = await prisma.workOrder.count({
      where: {
        vendorId: vendor.id,
        report: { status: { in: [...OPEN_WORK_ORDER_REPORT_STATUSES] } },
      },
    });
    if (openCount > 0) {
      throw new Error(
        `Vendor masih memegang ${openCount} SPK berjalan. Selesaikan atau alihkan SPK terlebih dahulu.`
      );
    }
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: { isActive },
  });

  if (vendor.picUserId) {
    await prisma.notification.create({
      data: {
        companyId,
        recipientId: vendor.picUserId,
        title: isActive ? "Vendor Diaktifkan Kembali" : "Vendor Dinonaktifkan",
        message: isActive
          ? `Admin mengaktifkan kembali ${vendor.name}. Vendor dapat menerima SPK lagi.`
          : `Admin menonaktifkan ${vendor.name}. Vendor tidak akan menerima SPK baru.`,
        linkUrl: "/dashboard/teknisi",
      },
    });
  }

  await recordAuditLog({
    actor: auditActorOf(actor, companyId),
    entityName: "Vendor",
    entityId: vendor.id,
    action: "UPDATE",
    summary: `${isActive ? "Mengaktifkan" : "Menonaktifkan"} vendor ${vendor.name}`,
    oldValues: { isActive: vendor.isActive },
    newValues: { isActive },
  });

  return updated;
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

  const tech = await prisma.technician.findFirst({
    where: { id: technicianId, companyId: actor.companyId },
    include: { vendor: true },
  });
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

  const updated = await prisma.technician.update({
    where: { id: tech.id },
    data: {
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      reactivationRequested: false,
      reactivationNote: null,
      deactivationReason: null,
      lastActiveAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: tech.userId },
    data: { isActive: true },
  });

  // Notifikasi Web ke PIC Vendor (PRD 7.1)
  if (tech.vendor.picUserId) {
    await prisma.notification.create({
      data: {
        companyId: actor.companyId,
        recipientId: tech.vendor.picUserId,
        title: "Pengaktifan Kembali Teknisi Disetujui",
        message: `Admin ${actor.name} menyetujui pengaktifan kembali teknisi ${tech.fullName}. Teknisi kini aktif dan dapat ditugaskan kembali.`,
        linkUrl: "/dashboard/teknisi",
      },
    });
  }

  await recordAuditLog({
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      companyId: actor.companyId,
    },
    entityName: "Technician",
    entityId: tech.id,
    action: "UPDATE",
    summary: `Admin ${actor.name} menyetujui pengaktifan kembali teknisi ${tech.fullName}`,
    oldValues: { status: tech.status, reactivationRequested: true },
    newValues: { status: "ACTIVE", reactivationRequested: false },
  });

  return updated;
}

/**
 * 5. PIC Vendor mengonfirmasi daftar teknisinya (Permintaan tiap 3 bulan).
 */
export async function confirmTechnicianRosterByPic(actor: SessionUser) {
  assertPermission(actor.role, "MANAGE_OWN_TECHNICIANS");
  const vendor = await prisma.vendor.findUnique({
    where: { picUserId: actor.id },
  });
  if (!vendor) {
    throw new Error("Data vendor tidak ditemukan.");
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: { lastTechnicianConfirmedAt: new Date() },
  });

  await recordAuditLog({
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
  });

  return updated;
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
  const staleTechnicians = await prisma.technician.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      lastActiveAt: { lt: sixtyDaysAgo },
    },
    include: {
      vendor: true,
      workOrders: {
        where: {
          report: {
            status: { in: [...OPEN_WORK_ORDER_REPORT_STATUSES] },
          },
        },
      },
    },
  });

  let deactivatedCount = 0;
  for (const tech of staleTechnicians) {
    // Keputusan 7: Sistem TIDAK menonaktifkan teknisi yang masih memegang SPK aktif
    if (tech.workOrders && tech.workOrders.length > 0) {
      continue;
    }

    const recentWorkOrder = await prisma.workOrder.findFirst({
      where: {
        technicianId: tech.id,
        assignedAt: { gte: sixtyDaysAgo },
      },
    });

    if (!recentWorkOrder) {
      await prisma.technician.update({
        where: { id: tech.id },
        data: {
          status: "INACTIVE",
          deactivationReason: "AUTO_60_DAYS",
        },
      });

      // Kirim pemberitahuan ke PIC Vendor
      if (tech.vendor.picUserId) {
        await prisma.notification.create({
          data: {
            companyId,
            recipientId: tech.vendor.picUserId,
            title: "Teknisi Dinonaktifkan Otomatis (60 Hari)",
            message: `Teknisi ${tech.fullName} dinonaktifkan otomatis oleh sistem karena tidak aktif atau tidak menerima tugas selama 60 hari. Anda dapat mengajukan aktif kembali ke Admin melalui menu Teknisi Saya.`,
            linkUrl: "/dashboard/teknisi",
          },
        });
      }

      deactivatedCount++;
    }
  }

  // Cari vendor yang belum konfirmasi daftar teknisi >= 90 hari (3 bulan)
  const vendorsNeedingConfirmation = await prisma.vendor.findMany({
    where: {
      companyId,
      isActive: true,
      picUserId: { not: null },
      OR: [
        { lastTechnicianConfirmedAt: null },
        { lastTechnicianConfirmedAt: { lt: ninetyDaysAgo } },
      ],
    },
  });

  let reminderSentCount = 0;
  for (const v of vendorsNeedingConfirmation) {
    if (v.picUserId) {
      await prisma.notification.create({
        data: {
          companyId,
          recipientId: v.picUserId,
          title: "Pengingat 3 Bulanan: Konfirmasi Daftar Teknisi",
          message: `Mohon periksa dan konfirmasi daftar teknisi aktif untuk ${v.name} (pemeriksaan rutin tiap 3 bulan).`,
          linkUrl: "/dashboard/teknisi",
        },
      });
      reminderSentCount++;
    }
  }

  return {
    deactivatedCount,
    reminderSentCount,
  };
}

