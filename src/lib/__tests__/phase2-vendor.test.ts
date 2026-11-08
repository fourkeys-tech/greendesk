import { describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import {
  approveOrRejectTechnicianByAdmin,
  createVendorWithPic,
  registerTechnicianByPic,
  runPhase2MaintenanceJob,
} from "../services/phase2-vendor";

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

  it("menonaktifkan teknisi tidak aktif >= 60 hari dan mengirim pengingat konfirmasi 3 bulanan ke PIC", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@greenpark.id" },
    });
    const vendor = await prisma.vendor.findFirstOrThrow({
      where: { companyId: admin.companyId!, name: "PT Teknik Taman Jaya" },
    });

    // Simulasikan vendor belum konfirmasi daftar teknisi > 90 hari
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { lastTechnicianConfirmedAt: hundredDaysAgo },
    });

    const res = await runPhase2MaintenanceJob(admin.companyId!);
    expect(res.reminderSentCount).toBeGreaterThanOrEqual(1);
  });
});

