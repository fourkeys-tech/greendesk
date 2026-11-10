import { describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import {
  approveOrRejectTechnicianByAdmin,
  approveTechnicianReactivationByAdmin,
  createVendorWithPic,
  deactivateTechnicianByAdmin,
  registerTechnicianByPic,
  rejectTechnicianReactivationByAdmin,
  requestTechnicianReactivationByPic,
  runPhase2MaintenanceJob,
  runPhase2MaintenanceJobAsAdmin,
  updateTechnicianStatusByPic,
} from "../services/phase2-vendor";
import type { SessionUser } from "../auth";

describe("Fase 2 – Onboarding Vendor, Persetujuan Teknisi & Job Terjadwal", () => {
  it("memungkinkan Admin membuat Vendor + Akun PIC dan mengirim email undangan", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const cluster = await prisma.cluster.findFirstOrThrow({
      where: { companyId: admin.companyId! },
    });

    const uniqueSuffix = Date.now().toString().slice(-5);
    const picEmail = `pic.vendor.${uniqueSuffix}@greenpark.id`;

    const { vendor, picUser } = await createVendorWithPic(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId,
        companyName: null,
        staffClusterId: null,
      },
      {
        name: `PT Mitra Taman Sejahtera ${uniqueSuffix}`,
        type: "EXTERNAL",
        skills: ["Sipil", "Lanskap"],
        cooperationScheme: "Kontrak Tahunan",
        warrantyDays: 45,
        clusterIds: [cluster.id],
        picName: `PIC Mitra ${uniqueSuffix}`,
        picEmail,
      }
    );

    expect(vendor.picUserId).toBe(picUser.id);
    expect(picUser.role).toBe("PIC_VENDOR");

    // Pastikan email undangan VENDOR_INVITE tercatat di EmailLog
    const inviteMail = await prisma.emailLog.findFirst({
      where: { toEmail: picEmail, triggerType: "VENDOR_INVITE" },
    });
    expect(inviteMail).not.toBeNull();
  });

  it("mendaftarkan teknisi baru (PENDING), mengirim notifikasi web ke Admin, lalu mengaktifkan setelah disetujui Admin", async () => {
    const pic = await prisma.user.findUniqueOrThrow({
      where: { email: "pic@vendorjaya.id" },
    });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });

    const notifBefore = await prisma.notification.count({
      where: { recipientId: admin.id },
    });

    const uniqueSuffix = Date.now().toString().slice(-5);
    const techEmail = `teknisi.baru.${uniqueSuffix}@vendorjaya.id`;

    const tech = await registerTechnicianByPic(
      {
        id: pic.id,
        name: pic.name,
        email: pic.email,
        role: pic.role,
        companyId: pic.companyId,
        companyName: null,
        staffClusterId: null,
      },
      {
        fullName: `Andi Wijaya ${uniqueSuffix}`,
        whatsapp: "081200011122",
        email: techEmail,
        skills: ["Las Besi", "Cat"],
      }
    );

    expect(tech.approvalStatus).toBe("PENDING");

    // Kriteria Penerimaan: Notifikasi web ke Admin muncul saat ada teknisi baru menunggu persetujuan
    const notifAfter = await prisma.notification.count({
      where: { recipientId: admin.id },
    });
    expect(notifAfter).toBeGreaterThan(notifBefore);

    // Admin menyetujui teknisi
    const approved = await approveOrRejectTechnicianByAdmin(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId,
        companyName: null,
        staffClusterId: null,
      },
      tech.id,
      "APPROVED"
    );

    expect(approved.approvalStatus).toBe("APPROVED");
    expect(approved.approvedById).toBe(admin.id);
  });

  it("menolak pendaftaran teknisi dengan alasan wajib serta menyimpan alasan penolakan", async () => {
    const pic = await prisma.user.findUniqueOrThrow({
      where: { email: "pic@vendorjaya.id" },
    });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });

    const picActor: SessionUser = {
      id: pic.id,
      name: pic.name,
      email: pic.email,
      role: "PIC_VENDOR",
      companyId: pic.companyId,
      companyName: null,
      staffClusterId: null,
    };
    const adminActor: SessionUser = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const suffix = Date.now().toString().slice(-6);
    const tech = await registerTechnicianByPic(picActor, {
      fullName: `Teknisi Ditolak ${suffix}`,
      whatsapp: "081311223344",
      email: `teknisi.ditolak.${suffix}@vendorjaya.id`,
      skills: ["Cat"],
    });

    await expect(
      approveOrRejectTechnicianByAdmin(adminActor, tech.id, "REJECTED", "")
    ).rejects.toThrow(/Alasan penolakan wajib diisi/);

    const rejected = await approveOrRejectTechnicianByAdmin(
      adminActor,
      tech.id,
      "REJECTED",
      "Foto wajah tidak jelas"
    );
    expect(rejected.approvalStatus).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Foto wajah tidak jelas");
    expect(rejected.status).toBe("INACTIVE");

    const techUser = await prisma.user.findUniqueOrThrow({
      where: { id: tech.userId },
    });
    expect(techUser.isActive).toBe(false);
  });

  it("menonaktifkan teknisi tidak aktif >= 60 hari, mengirim pengingat 3 bulanan, serta memblokir cron untuk role non-Admin", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const pic = await prisma.user.findUniqueOrThrow({
      where: { email: "pic@vendorjaya.id" },
    });
    const vendor = await prisma.vendor.findFirstOrThrow({
      where: { companyId: admin.companyId!, name: "PT Teknik Taman Jaya" },
    });

    // Role non-Admin ditolak memanggil wrapper cron
    await expect(
      runPhase2MaintenanceJobAsAdmin({
        id: pic.id,
        name: pic.name,
        email: pic.email,
        role: pic.role,
        companyId: pic.companyId,
        companyName: null,
        staffClusterId: null,
      })
    ).rejects.toThrow(/Akses ditolak/);

    // Simulasikan vendor belum konfirmasi daftar teknisi > 90 hari
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { lastTechnicianConfirmedAt: hundredDaysAgo },
    });

    const res = await runPhase2MaintenanceJob(admin.companyId!);
    expect(res.reminderSentCount).toBeGreaterThanOrEqual(1);
  });

  it("mengelola siklus status teknisi (Cuti, Nonaktif Manual, Nonaktif Admin, Penolakan Aktif Kembali & Persetujuan Ulang)", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const pic = await prisma.user.findUniqueOrThrow({
      where: { email: "pic@vendorjaya.id" },
    });

    const picActor: SessionUser = {
      id: pic.id,
      name: pic.name,
      email: pic.email,
      role: "PIC_VENDOR",
      companyId: pic.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const adminActor: SessionUser = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      companyId: admin.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const suffix = Date.now().toString().slice(-5);
    const tech = await registerTechnicianByPic(picActor, {
      fullName: `Teknisi Uji ${suffix}`,
      whatsapp: "081999888777",
      email: `uji.teknisi.${suffix}@vendorjaya.id`,
      skills: ["Sipil"],
    });

    // Admin approve
    await approveOrRejectTechnicianByAdmin(adminActor, tech.id, "APPROVED");

    // 1. PIC set CUTI (ON_LEAVE)
    const cutiTech = await updateTechnicianStatusByPic(picActor, tech.id, "ON_LEAVE");
    expect(cutiTech.status).toBe("ON_LEAVE");

    // 2. PIC set aktif kembali dari cuti (langsung aktif)
    const activeAgain = await updateTechnicianStatusByPic(picActor, tech.id, "ACTIVE");
    expect(activeAgain.status).toBe("ACTIVE");

    // 3. PIC set Nonaktif manual (deactivationReason: MANUAL_BY_PIC)
    const manualInactive = await updateTechnicianStatusByPic(picActor, tech.id, "INACTIVE");
    expect(manualInactive.status).toBe("INACTIVE");
    expect(manualInactive.deactivationReason).toBe("MANUAL_BY_PIC");

    // 4. PIC aktifkan kembali dari nonaktif manual (tidak perlu admin approval)
    const reactivatedManual = await updateTechnicianStatusByPic(picActor, tech.id, "ACTIVE");
    expect(reactivatedManual.status).toBe("ACTIVE");

    // 4b. Admin menonaktifkan teknisi secara manual, PIC ajukan aktif kembali, lalu Admin menolak permintaan tersebut
    const deactivatedByAdmin = await deactivateTechnicianByAdmin(
      adminActor,
      tech.id,
      "Pelanggaran SOP keselamatan kerja"
    );
    expect(deactivatedByAdmin.status).toBe("INACTIVE");
    expect(deactivatedByAdmin.deactivationReason).toBe("MANUAL_BY_ADMIN");

    await expect(
      updateTechnicianStatusByPic(picActor, tech.id, "ACTIVE")
    ).rejects.toThrow(/Admin/i);

    await requestTechnicianReactivationByPic(
      picActor,
      tech.id,
      "Sudah menjalani pembinaan"
    );
    const rejectedReactivation = await rejectTechnicianReactivationByAdmin(
      adminActor,
      tech.id,
      "Belum melampirkan sertifikat K3"
    );
    expect(rejectedReactivation.reactivationRequested).toBe(false);
    expect(rejectedReactivation.status).toBe("INACTIVE");

    // 5. Simulasikan nonaktif otomatis 60 hari oleh cron
    await prisma.technician.update({
      where: { id: tech.id },
      data: {
        status: "ACTIVE",
        deactivationReason: null,
        lastActiveAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
      },
    });
    await runPhase2MaintenanceJob(admin.companyId!);

    const autoInactive = await prisma.technician.findUniqueOrThrow({
      where: { id: tech.id },
    });
    expect(autoInactive.status).toBe("INACTIVE");
    expect(autoInactive.deactivationReason).toBe("AUTO_60_DAYS");

    // 6. PIC mencoba aktifkan langsung tanpa admin -> harus ditolak
    await expect(
      updateTechnicianStatusByPic(picActor, tech.id, "ACTIVE")
    ).rejects.toThrow(/harus mengajukan aktif kembali ke Admin/i);

    // 7. PIC mengajukan aktif kembali
    const requested = await requestTechnicianReactivationByPic(
      picActor,
      tech.id,
      "Teknisi sudah aktif kembali dan sehat."
    );
    expect(requested.reactivationRequested).toBe(true);

    // 8. Admin menyetujui aktif kembali
    const adminApproved = await approveTechnicianReactivationByAdmin(
      adminActor,
      tech.id
    );
    expect(adminApproved.status).toBe("ACTIVE");
    expect(adminApproved.reactivationRequested).toBe(false);
    expect(adminApproved.deactivationReason).toBeNull();
  });
});
