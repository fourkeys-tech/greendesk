import { prisma } from "../prisma";
import { assertPermission, validateStatusTransition } from "../permissions";
import { sendReportStatusEmailWithMergedChildren } from "../email";
import { recordAuditLog } from "../audit";
import { getManagerAssignedClusterIds } from "./phase5-decision";
import type { SessionUser } from "../auth";

/**
 * 1. PIC Vendor menugaskan Teknisi pelaksana pada SPK yang berstatus DISETUJUI.
 * - Mengubah status laporan: DISETUJUI -> DIKERJAKAN
 * - Mengirim email ke pelapor: DIKERJAKAN ("Teknisi Sedang Menangani Perbaikan")
 */
export async function assignTechnicianToWorkOrder(
  actor: SessionUser,
  input: {
    workOrderId: string;
    technicianId: string;
  }
) {
  assertPermission(actor.role, "ASSIGN_TECHNICIAN");

  // Cari vendor milik PIC
  const vendor = await prisma.vendor.findFirst({
    where: {
      picUserId: actor.id,
      isActive: true,
    },
  });

  if (!vendor) {
    throw new Error("Akun Anda tidak terdaftar sebagai PIC Vendor aktif.");
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      vendorId: vendor.id,
    },
    include: {
      report: {
        include: {
          asset: true,
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("Surat Perintah Kerja (SPK) tidak ditemukan untuk vendor Anda.");
  }

  // Teknisi harus milik vendor ini, berstatus ACTIVE dan disetujui (APPROVED)
  const technician = await prisma.technician.findFirst({
    where: {
      id: input.technicianId,
      vendorId: vendor.id,
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (!technician) {
    throw new Error(
      "Teknisi tidak valid, tidak aktif, atau belum disetujui oleh Admin."
    );
  }

  const check = validateStatusTransition(
    workOrder.report.status,
    "DIKERJAKAN",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update WorkOrder
    const updatedWo = await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        technicianId: technician.id,
        assignedAt: new Date(),
      },
    });

    await tx.technician.update({
      where: { id: technician.id },
      data: { lastActiveAt: new Date() },
    });

    // 2. Update status Laporan ke DIKERJAKAN
    const updatedRep = await tx.report.update({
      where: { id: workOrder.report.id },
      data: {
        status: "DIKERJAKAN",
        stageEnteredAt: new Date(),
        statusLogs: {
          create: {
            fromStatus: workOrder.report.status,
            toStatus: "DIKERJAKAN",
            changedById: actor.id,
            note: `Teknisi ${technician.fullName} ditugaskan oleh PIC Vendor ${vendor.name}`,
          },
        },
      },
    });

    // 3. Notifikasi Web ke Teknisi
    await tx.notification.create({
      data: {
        companyId: actor.companyId,
        recipientId: technician.userId,
        title: `Tugas Baru: ${workOrder.spkNo}`,
        message: `Anda ditugaskan oleh PIC untuk perbaikan aset ${workOrder.report.asset.name}.`,
        linkUrl: `/dashboard/laporan`,
      },
    });

    return { workOrder: updatedWo, report: updatedRep };
  });

  // 4. Catat riwayat audit
  await recordAuditLog({
    companyId: actor.companyId,
    actor,
    entityName: "WorkOrder",
    entityId: workOrder.id,
    action: "UPDATE",
    summary: `PIC ${actor.name} menunjuk teknisi ${technician.fullName} untuk ${workOrder.spkNo}`,
    oldValues: {
      reportStatus: workOrder.report.status,
      technicianId: workOrder.technicianId,
    },
    newValues: {
      reportStatus: "DIKERJAKAN",
      technicianId: technician.id,
      technicianName: technician.fullName,
    },
  });

  // Kirim email ke pelapor (identitas teknisi tidak dibagikan demi privasi)
  await sendReportStatusEmailWithMergedChildren({
    reportId: workOrder.report.id,
    triggerType: "DIKERJAKAN",
  });

  return { success: true, workOrder: result.workOrder, report: result.report };
}

/**
 * 1b. PIC Vendor mengganti teknisi pelaksana pada SPK yang sedang berjalan (DIKERJAKAN atau revisi).
 * - Foto sebelum yang sudah diunggah tetap melekat pada SPK (PRD v0.2 Keputusan 4 & 5).
 * - Tidak ada email ke pelapor (PRD Bagian 7.2).
 * - Notifikasi web dikirim ke teknisi baru.
 */
export async function replaceTechnicianForWorkOrder(
  actor: SessionUser,
  input: {
    workOrderId: string;
    newTechnicianId: string;
    reason?: string;
  }
) {
  assertPermission(actor.role, "ASSIGN_TECHNICIAN");

  const vendor = await prisma.vendor.findFirst({
    where: {
      picUserId: actor.id,
      isActive: true,
    },
  });

  if (!vendor) {
    throw new Error("Akun Anda tidak terdaftar sebagai PIC Vendor aktif.");
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      vendorId: vendor.id,
    },
    include: {
      technician: true,
      report: {
        include: {
          asset: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan untuk vendor Anda.");
  }

  // Teknisi baru harus aktif dan disetujui Admin (PRD 3.3)
  const newTechnician = await prisma.technician.findFirst({
    where: {
      id: input.newTechnicianId,
      vendorId: vendor.id,
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (!newTechnician) {
    throw new Error(
      "Teknisi pengganti tidak valid, tidak aktif, atau belum disetujui oleh Admin."
    );
  }

  if (workOrder.technicianId === newTechnician.id) {
    throw new Error("Teknisi yang dipilih sama dengan teknisi yang saat ini ditugaskan.");
  }

  const oldTechName = workOrder.technician?.fullName || "Belum ada teknisi";

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update WorkOrder ke teknisi baru (foto sebelum/sesudah yang ada tetap melekat)
    const updatedWo = await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        technicianId: newTechnician.id,
        assignedAt: new Date(),
      },
    });

    await tx.technician.update({
      where: { id: newTechnician.id },
      data: { lastActiveAt: new Date() },
    });

    // 2. Tambah catatan log pergantian teknisi
    await tx.reportStatusLog.create({
      data: {
        reportId: workOrder.report.id,
        fromStatus: workOrder.report.status,
        toStatus: workOrder.report.status,
        changedById: actor.id,
        note: `PIC Vendor mengganti teknisi dari ${oldTechName} ke ${newTechnician.fullName}.${
          input.reason ? ` Alasan: ${input.reason}` : ""
        } Foto sebelum yang ada tetap melekat pada SPK.`,
      },
    });

    // 3. Notifikasi Web ke Teknisi baru
    await tx.notification.create({
      data: {
        companyId: actor.companyId,
        recipientId: newTechnician.userId,
        title: `Penugasan SPK Pengganti (${workOrder.spkNo})`,
        message: `Anda ditugaskan oleh PIC menggantikan ${oldTechName} untuk perbaikan aset ${workOrder.report.asset.name}.`,
        linkUrl: `/dashboard/laporan`,
      },
    });

    return updatedWo;
  });

  // 4. Catat AuditLog
  await recordAuditLog({
    companyId: actor.companyId,
    actor,
    entityName: "WorkOrder",
    entityId: workOrder.id,
    action: "UPDATE",
    summary: `PIC ${actor.name} mengganti teknisi ${oldTechName} ke ${newTechnician.fullName} untuk ${workOrder.spkNo}`,
    oldValues: { technicianId: workOrder.technicianId, technicianName: oldTechName },
    newValues: {
      technicianId: newTechnician.id,
      technicianName: newTechnician.fullName,
      reason: input.reason || null,
    },
  });

  return { success: true, workOrder: result };
}

/**
 * 2. Teknisi menyelesaikan pekerjaan dan mengunggah foto SEBELUM & SESUDAH perbaikan.
 * - Mengubah status laporan: DIKERJAKAN -> MENUNGGU_KONFIRMASI
 * - Mengirim Notifikasi Web ke Manager cluster
 */
export async function submitWorkResultByTechnician(
  actor: SessionUser,
  input: {
    workOrderId: string;
    beforePhotoUrls: string[];
    afterPhotoUrls: string[];
    notes?: string;
  }
) {
  assertPermission(actor.role, "SUBMIT_WORK_RESULT");

  const technician = await prisma.technician.findUnique({
    where: { userId: actor.id },
  });

  if (!technician) {
    throw new Error("Profil teknisi Anda tidak ditemukan.");
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      technicianId: technician.id,
    },
    include: {
      report: {
        include: {
          asset: {
            include: {
              park: {
                include: { cluster: true },
              },
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan atau bukan ditugaskan kepada Anda.");
  }

  // PRD 4.3 & Keputusan 6: Foto sebelum dan sesudah wajib ada sebelum Lapor Selesai.
  // Bila perbaikan ulang atau sudah ada foto sebelum yang tersimpan, foto sebelum sebelumnya tetap dipertahankan.
  const existingBeforeCount = await prisma.workPhoto.count({
    where: { workOrderId: workOrder.id, type: "BEFORE" },
  });
  const totalBefore = existingBeforeCount + (input.beforePhotoUrls?.length || 0);
  const totalAfter = input.afterPhotoUrls?.length || 0;

  if (totalBefore === 0 || totalAfter === 0) {
    throw new Error(
      "Foto sebelum (before) dan foto sesudah (after) perbaikan wajib dilampirkan sebelum lapor selesai."
    );
  }

  const check = validateStatusTransition(
    workOrder.report.status,
    "MENUNGGU_KONFIRMASI",
    actor.role
  );
  if (!check.valid) {
    throw new Error(check.error);
  }

  const clusterId = workOrder.report.asset.park.clusterId;

  const result = await prisma.$transaction(async (tx) => {
    // 0. Update lastActiveAt teknisi
    await tx.technician.update({
      where: { id: technician.id },
      data: { lastActiveAt: new Date() },
    });

    // 1. Simpan foto-foto pekerjaan
    if (input.beforePhotoUrls) {
      for (const url of input.beforePhotoUrls) {
        await tx.workPhoto.create({
          data: {
            workOrderId: workOrder.id,
            type: "BEFORE",
            url,
            uploadedById: actor.id,
          },
        });
      }
    }

    for (const url of input.afterPhotoUrls) {
      await tx.workPhoto.create({
        data: {
          workOrderId: workOrder.id,
          type: "AFTER",
          url,
          uploadedById: actor.id,
        },
      });
    }

    // 2. Update status laporan ke MENUNGGU_KONFIRMASI
    const updatedRep = await tx.report.update({
      where: { id: workOrder.report.id },
      data: {
        status: "MENUNGGU_KONFIRMASI",
        stageEnteredAt: new Date(),
        statusLogs: {
          create: {
            fromStatus: workOrder.report.status,
            toStatus: "MENUNGGU_KONFIRMASI",
            changedById: actor.id,
            note:
              input.notes?.trim() ||
              `Teknisi ${technician.fullName} telah merampungkan perbaikan dan mengunggah foto sebelum/sesudah.`,
          },
        },
      },
    });

    // 3. Notifikasi Web ke seluruh Manager yang bertugas di cluster ini
    const now = new Date();
    const managerAssignments = await tx.clusterManagerAssignment.findMany({
      where: {
        clusterId,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { userId: true },
    });

    for (const ma of managerAssignments) {
      await tx.notification.create({
        data: {
          companyId: actor.companyId,
          recipientId: ma.userId,
          title: `Hasil Perbaikan Menunggu Konfirmasi (${workOrder.spkNo})`,
          message: `Teknisi ${technician.fullName} telah menyelesaikan perbaikan pada aset ${workOrder.report.asset.name}. Silakan tinjau foto sebelum dan sesudah.`,
          linkUrl: `/dashboard/laporan`,
        },
      });
    }

    return { report: updatedRep };
  });

  // 4. Catat riwayat audit
  await recordAuditLog({
    companyId: actor.companyId,
    actor,
    entityName: "WorkOrder",
    entityId: workOrder.id,
    action: "UPDATE",
    summary: `Teknisi ${technician.fullName} mengunggah hasil kerja untuk ${workOrder.spkNo}`,
    oldValues: { reportStatus: workOrder.report.status },
    newValues: {
      reportStatus: "MENUNGGU_KONFIRMASI",
      beforeCount: input.beforePhotoUrls.length,
      afterCount: input.afterPhotoUrls.length,
    },
  });

  return { success: true, report: result.report };
}

/**
 * 3. MGR-M4: Konfirmasi Hasil Perbaikan oleh Manager
 * Memeriksa foto sebelum dan sesudah berdampingan.
 * - Jika SESUAI:
 *   - Status laporan -> SELESAI
 *   - SPK ditutup (completedAt, confirmedAt terisi)
 *   - Email dikirim ke pelapor dengan melampirkan foto hasil akhir
 * - Jika BELUM SESUAI:
 *   - Wajib menyertakan catatan perbaikan ulang (RevisionNote)
 *   - Status laporan kembali ke DIKERJAKAN
 *   - Notifikasi web dikirim ke Teknisi pelaksana
 */
export async function confirmWorkResultByManager(
  actor: SessionUser,
  input: {
    workOrderId: string;
    decision: "SESUAI" | "BELUM_SESUAI";
    revisionNote?: string;
  }
) {
  assertPermission(actor.role, "CONFIRM_COMPLETION");

  const clusterIds = await getManagerAssignedClusterIds(actor.id);

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      companyId: actor.companyId || undefined,
    },
    include: {
      photos: true,
      technician: {
        include: { user: true },
      },
      report: {
        include: {
          asset: {
            include: {
              park: {
                include: { cluster: true },
              },
            },
          },
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error("SPK tidak ditemukan.");
  }

  const clusterId = workOrder.report.asset.park.clusterId;
  if (!clusterIds.includes(clusterId)) {
    throw new Error(
      `Akses ditolak: Anda tidak memiliki wewenang pada cluster ${workOrder.report.asset.park.cluster.name}.`
    );
  }

  if (workOrder.report.status !== "MENUNGGU_KONFIRMASI") {
    throw new Error(
      `Laporan berstatus ${workOrder.report.status}. Hanya laporan Menunggu Konfirmasi yang dapat ditinjau hasil kerjanya.`
    );
  }

  // Aturan Bisnis 5.7 no 3: Foto sebelum dan sesudah wajib ada sebelum konfirmasi
  const beforePhotos = workOrder.photos.filter((p) => p.type === "BEFORE");
  const afterPhotos = workOrder.photos.filter((p) => p.type === "AFTER");
  if (beforePhotos.length === 0 || afterPhotos.length === 0) {
    throw new Error(
      "Pemeriksaan foto tidak lengkap: Foto sebelum dan sesudah wajib ada sebelum konfirmasi."
    );
  }

  // 1. Cabang BELUM SESUAI (Revisi Pekerjaan)
  if (input.decision === "BELUM_SESUAI") {
    const revisionNote = input.revisionNote?.trim();
    if (!revisionNote) {
      throw new Error(
        "Konfirmasi Belum Sesuai wajib menyertakan catatan perbaikan ulang."
      );
    }

    const check = validateStatusTransition(
      workOrder.report.status,
      "DIKERJAKAN",
      actor.role,
      revisionNote
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tambah RevisionNote
      await tx.revisionNote.create({
        data: {
          workOrderId: workOrder.id,
          note: revisionNote,
          createdById: actor.id,
        },
      });

      // 2. Kembalikan status ke DIKERJAKAN
      const rep = await tx.report.update({
        where: { id: workOrder.report.id },
        data: {
          status: "DIKERJAKAN",
          stageEnteredAt: new Date(),
          statusLogs: {
            create: {
              fromStatus: "MENUNGGU_KONFIRMASI",
              toStatus: "DIKERJAKAN",
              changedById: actor.id,
              note: `Manager menyatakan hasil belum sesuai. Catatan perbaikan: ${revisionNote}`,
            },
          },
        },
      });

      // 3. Notifikasi Web ke Teknisi
      if (workOrder.technician?.userId) {
        await tx.notification.create({
          data: {
            companyId: actor.companyId,
            recipientId: workOrder.technician.userId,
            title: `Perbaikan Perlu Revisi (${workOrder.spkNo})`,
            message: `Manager ${actor.name} meminta perbaikan ulang untuk ${workOrder.report.asset.name}. Catatan: ${revisionNote}`,
            linkUrl: `/dashboard/laporan`,
          },
        });
      }

      return rep;
    });

    // 4. Catat AuditLog
    await recordAuditLog({
      companyId: actor.companyId,
      actor,
      entityName: "WorkOrder",
      entityId: workOrder.id,
      action: "UPDATE",
      summary: `Manager ${actor.name} mengembalikan ${workOrder.spkNo} untuk perbaikan ulang. Catatan: ${revisionNote}`,
      oldValues: { status: "MENUNGGU_KONFIRMASI" },
      newValues: { status: "DIKERJAKAN", revisionNote },
    });

    return {
      success: true,
      decision: "BELUM_SESUAI",
      report: result,
    };
  }

  // 2. Cabang SESUAI (Selesai Akhir)
  if (input.decision === "SESUAI") {
    const check = validateStatusTransition(
      workOrder.report.status,
      "SELESAI",
      actor.role
    );
    if (!check.valid) {
      throw new Error(check.error);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tutup WorkOrder
      const updatedWo = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          completedAt: now,
          confirmedAt: now,
        },
      });

      // 2. Ubah status laporan ke SELESAI
      const updatedRep = await tx.report.update({
        where: { id: workOrder.report.id },
        data: {
          status: "SELESAI",
          stageEnteredAt: now,
          statusLogs: {
            create: {
              fromStatus: "MENUNGGU_KONFIRMASI",
              toStatus: "SELESAI",
              changedById: actor.id,
              note: `Manager ${actor.name} telah mengonfirmasi bahwa hasil perbaikan telah sesuai.`,
            },
          },
        },
      });

      return { workOrder: updatedWo, report: updatedRep };
    });

    // 3. Catat riwayat audit
    await recordAuditLog({
      companyId: actor.companyId,
      actor,
      entityName: "Report",
      entityId: workOrder.report.id,
      action: "UPDATE",
      summary: `Manager ${actor.name} mengonfirmasi penyelesaian perbaikan tiket ${workOrder.report.ticketNo} (${workOrder.spkNo})`,
      oldValues: { status: "MENUNGGU_KONFIRMASI" },
      newValues: { status: "SELESAI" },
    });

    // 4. Kirim email SELESAI ke pelapor utama & semua pelapor yang laporannya digabung,
    // lengkap dengan foto hasil (AFTER)
    const afterPhotoUrls = afterPhotos.map((p) => p.url);
    await sendReportStatusEmailWithMergedChildren({
      reportId: workOrder.report.id,
      triggerType: "SELESAI",
      afterPhotoUrls,
    });

    return {
      success: true,
      decision: "SESUAI",
      workOrder: result.workOrder,
      report: result.report,
    };
  }

  throw new Error("Keputusan tidak valid. Pilih SESUAI atau BELUM_SESUAI.");
}
