import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding data Fase 0 (Fondasi)...");

  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) {
    throw new Error(
      "SEED_DEFAULT_PASSWORD belum diatur di file .env. Lihat .env.example."
    );
  }
  const defaultPasswordHash = await bcrypt.hash(seedPassword, 10);

  // 1. Multi-Perusahaan: Buat 2 perusahaan klien untuk membuktikan isolasi data
  const companyA = await prisma.company.upsert({
    where: { code: "THN" },
    update: {},
    create: {
      code: "THN",
      name: "PT Taman Hijau Nusantara",
      contact: "021-5550199 / info@greenpark.id",
      address: "BSD Green Office Park, Tangerang Selatan",
    },
  });

  const companyB = await prisma.company.upsert({
    where: { code: "GAP" },
    update: {},
    create: {
      code: "GAP",
      name: "PT Griya Asri Properti (Perusahaan Lain)",
      contact: "021-8880123 / kontak@griyaasri.id",
      address: "Kawasan Cibubur, Jakarta Timur",
    },
  });

  // 2. Hierarki Wilayah 5 Tingkat untuk Perusahaan A
  let complex1 = await prisma.complex.findFirst({
    where: { companyId: companyA.id, name: "GreenPark Residence BSD" },
  });
  if (!complex1) {
    complex1 = await prisma.complex.create({
      data: {
        companyId: companyA.id,
        name: "GreenPark Residence BSD",
        address: "Jl. Boulevard Raya GreenPark No. 1, BSD City",
      },
    });
  }

  let clusterBougenville = await prisma.cluster.findFirst({
    where: { companyId: companyA.id, name: "Cluster Bougenville" },
  });
  if (!clusterBougenville) {
    clusterBougenville = await prisma.cluster.create({
      data: {
        companyId: companyA.id,
        complexId: complex1.id,
        name: "Cluster Bougenville",
      },
    });
  }

  let clusterEdelweiss = await prisma.cluster.findFirst({
    where: { companyId: companyA.id, name: "Cluster Edelweiss" },
  });
  if (!clusterEdelweiss) {
    clusterEdelweiss = await prisma.cluster.create({
      data: {
        companyId: companyA.id,
        complexId: complex1.id,
        name: "Cluster Edelweiss",
      },
    });
  }

  let parkBougenville = await prisma.park.findFirst({
    where: { companyId: companyA.id, name: "Taman Utama Bougenville" },
  });
  if (!parkBougenville) {
    parkBougenville = await prisma.park.create({
      data: {
        companyId: companyA.id,
        clusterId: clusterBougenville.id,
        name: "Taman Utama Bougenville",
        locationNote: "Depan Clubhouse Blok A",
      },
    });
  }

  let parkEdelweiss = await prisma.park.findFirst({
    where: { companyId: companyA.id, name: "Taman Jogging Edelweiss" },
  });
  if (!parkEdelweiss) {
    parkEdelweiss = await prisma.park.create({
      data: {
        companyId: companyA.id,
        clusterId: clusterEdelweiss.id,
        name: "Taman Jogging Edelweiss",
        locationNote: "Samping Danau Buatan Blok C",
      },
    });
  }

  // 3. Kategori Aset
  let catLampu = await prisma.category.findFirst({
    where: { companyId: companyA.id, name: "Penerangan & Lampu Taman" },
  });
  if (!catLampu) {
    catLampu = await prisma.category.create({
      data: {
        companyId: companyA.id,
        name: "Penerangan & Lampu Taman",
        damageTypes: ["Lampu mati", "Tiang miring", "Kabel terkelupas", "Kaca pecah"],
      },
    });
  }

  let catPlayground = await prisma.category.findFirst({
    where: { companyId: companyA.id, name: "Fasilitas Bermain Anak" },
  });
  if (!catPlayground) {
    catPlayground = await prisma.category.create({
      data: {
        companyId: companyA.id,
        name: "Fasilitas Bermain Anak",
        damageTypes: ["Rantai berkarat", "Pijakan patah", "Cat mengelupas", "Baut longgar"],
      },
    });
  }

  // 4. Aset
  const asset1 = await prisma.asset.upsert({
    where: { code: "AST-BGV-001" },
    update: {},
    create: {
      companyId: companyA.id,
      code: "AST-BGV-001",
      parkId: parkBougenville.id,
      categoryId: catLampu.id,
      name: "Lampu Taman Solar LED #01",
      locationNote: "Sudut Utara dekat Gazebo Bougenville",
      installedAt: new Date("2025-06-15"),
      isActive: true,
    },
  });

  const asset2 = await prisma.asset.upsert({
    where: { code: "AST-BGV-002" },
    update: {},
    create: {
      companyId: companyA.id,
      code: "AST-BGV-002",
      parkId: parkBougenville.id,
      categoryId: catPlayground.id,
      name: "Ayunan Ganda Besi Tempa",
      locationNote: "Area Playground Anak Zona Barat",
      installedAt: new Date("2025-08-10"),
      isActive: true,
    },
  });

  const asset3 = await prisma.asset.upsert({
    where: { code: "AST-EDW-001" },
    update: {},
    create: {
      companyId: companyA.id,
      code: "AST-EDW-001",
      parkId: parkEdelweiss.id,
      categoryId: catLampu.id,
      name: "Lampu Sorot Jalur Jogging #04",
      locationNote: "Dekat Jembatan Kayu Edelweiss",
      installedAt: new Date("2025-09-01"),
      isActive: true,
    },
  });

  // 5. Buat Akun untuk Ketujuh Role (Bagian 4 PRD)
  const userPengguna = await prisma.user.upsert({
    where: { email: "warga@greenpark.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Rina Kartika (Warga)",
      email: "warga@greenpark.id",
      passwordHash: defaultPasswordHash,
      role: "PENGGUNA",
      loginMethod: "EMAIL",
      reporterStatus: "WARGA",
      blockHouseNo: "Bougenville A2/15",
      dataConsentAt: new Date(),
      validReportCount: 2,
      invalidReportCount: 0,
    },
  });

  const userPengelola = await prisma.user.upsert({
    where: { email: "pengelola.bgv@greenpark.id" },
    update: { staffClusterId: clusterBougenville.id },
    create: {
      companyId: companyA.id,
      name: "Hendro Wibowo (Pengelola Bougenville)",
      email: "pengelola.bgv@greenpark.id",
      passwordHash: defaultPasswordHash,
      role: "PENGELOLA",
      staffClusterId: clusterBougenville.id,
    },
  });

  const userManager = await prisma.user.upsert({
    where: { email: "manager@greenpark.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Diana Kusuma (Manager Estate)",
      email: "manager@greenpark.id",
      passwordHash: defaultPasswordHash,
      role: "MANAGER",
    },
  });

  // Tautkan Manager ke Cluster Bougenville & Edelweiss (penugasan permanen, idempoten)
  async function ensurePermanentAssignment(userId: string, clusterId: string) {
    const existing = await prisma.clusterManagerAssignment.findFirst({
      where: { userId, clusterId, isTemporary: false },
    });
    if (existing) return existing;
    return prisma.clusterManagerAssignment.create({
      data: { userId, clusterId, isTemporary: false },
    });
  }

  await ensurePermanentAssignment(userManager.id, clusterBougenville.id);
  await ensurePermanentAssignment(userManager.id, clusterEdelweiss.id);

  const userPicVendor = await prisma.user.upsert({
    where: { email: "pic@vendorjaya.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Agus Pratama (PIC Vendor)",
      email: "pic@vendorjaya.id",
      passwordHash: defaultPasswordHash,
      role: "PIC_VENDOR",
    },
  });

  const userTeknisi = await prisma.user.upsert({
    where: { email: "teknisi.budi@vendorjaya.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Budi Santoso (Teknisi Lapangan)",
      email: "teknisi.budi@vendorjaya.id",
      passwordHash: defaultPasswordHash,
      role: "TEKNISI",
    },
  });

  const userAdmin = await prisma.user.upsert({
    where: { email: "admin@greenpark.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Arfin Mardiyanto (Admin Perusahaan)",
      email: "admin@greenpark.id",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
    },
  });

  const userOwner = await prisma.user.upsert({
    where: { email: "owner@greenpark.id" },
    update: {},
    create: {
      companyId: companyA.id,
      name: "Ir. Surya Darmawan (Owner / Direksi)",
      email: "owner@greenpark.id",
      passwordHash: defaultPasswordHash,
      role: "OWNER",
    },
  });

  // Akun Admin Perusahaan B untuk uji isolasi multi-perusahaan
  await prisma.user.upsert({
    where: { email: "admin@griyaasri.id" },
    update: {},
    create: {
      companyId: companyB.id,
      name: "Admin Griya Asri (Perusahaan B)",
      email: "admin@griyaasri.id",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
    },
  });

  // 6. Buat Vendor & Teknisi
  let vendor1 = await prisma.vendor.findUnique({
    where: { picUserId: userPicVendor.id },
  });
  if (!vendor1) {
    vendor1 = await prisma.vendor.create({
      data: {
        companyId: companyA.id,
        name: "PT Teknik Taman Jaya",
        type: "EXTERNAL",
        skills: ["Kelistrikan Taman", "Konstruksi Besi & Playground"],
        picUserId: userPicVendor.id,
        cooperationScheme: "Kontrak Tahunan & Per SPK",
        warrantyDays: 60,
        address: "Ruko Golden Madrid Blok G/12, BSD",
        npwp: "01.234.567.8-411.000",
      },
    });
  }

  await prisma.vendorServiceArea.upsert({
    where: {
      vendorId_clusterId: {
        vendorId: vendor1.id,
        clusterId: clusterBougenville.id,
      },
    },
    update: {},
    create: {
      vendorId: vendor1.id,
      clusterId: clusterBougenville.id,
    },
  });

  const tech1 = await prisma.technician.upsert({
    where: { userId: userTeknisi.id },
    update: {},
    create: {
      companyId: companyA.id,
      vendorId: vendor1.id,
      userId: userTeknisi.id,
      fullName: "Budi Santoso",
      whatsapp: "081234567890",
      email: userTeknisi.email,
      skills: ["Kelistrikan Taman", "Las & Besi"],
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      approvedById: userAdmin.id,
      approvedAt: new Date(),
    },
  });

  // 7. Buat Contoh Laporan & SPK untuk menguji visibilitas tiap role
  const report1 = await prisma.report.upsert({
    where: { ticketNo: "TKT-202611-0001" },
    update: {},
    create: {
      companyId: companyA.id,
      ticketNo: "TKT-202611-0001",
      assetId: asset1.id,
      reporterId: userPengguna.id,
      channel: "QR",
      description: "Lampu taman berkedip dan mati total saat malam hari.",
      status: "BARU",
    },
  });

  const report2 = await prisma.report.upsert({
    where: { ticketNo: "TKT-202611-0002" },
    update: {},
    create: {
      companyId: companyA.id,
      ticketNo: "TKT-202611-0002",
      assetId: asset2.id,
      reporterId: userPengguna.id,
      channel: "QR",
      description: "Rantai ayunan sebelah kanan berkarat dan berbunyi keras.",
      status: "DIKERJAKAN",
      priority: "TINGGI",
    },
  });

  await prisma.workOrder.upsert({
    where: { spkNo: "SPK-202611-0001" },
    update: {},
    create: {
      companyId: companyA.id,
      spkNo: "SPK-202611-0001",
      reportId: report2.id,
      vendorId: vendor1.id,
      technicianId: tech1.id,
      assignedAt: new Date(),
    },
  });

  // Laporan di Cluster Edelweiss (Pengelola Bougenville TIDAK boleh melihat ini, tapi Manager & Admin/Owner bisa)
  await prisma.report.upsert({
    where: { ticketNo: "TKT-202611-0003" },
    update: {},
    create: {
      companyId: companyA.id,
      ticketNo: "TKT-202611-0003",
      assetId: asset3.id,
      reporterId: userPengguna.id,
      channel: "DASHBOARD",
      description: "Kaca pelindung lampu sorot jalur jogging retak.",
      status: "MENUNGGU_KEPUTUSAN",
      priority: "NORMAL",
    },
  });

  // 8. Contoh AuditLog Awal
  const existingLogs = await prisma.auditLog.count({
    where: { companyId: companyA.id },
  });
  if (existingLogs === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          companyId: companyA.id,
          actorId: userAdmin.id,
          actorName: userAdmin.name,
          actorRole: "ADMIN",
          entityName: "Asset",
          entityId: asset1.id,
          action: "CREATE",
          summary: "Menambahkan aset baru AST-BGV-001 (Lampu Taman Solar LED #01)",
          oldValues: {},
          newValues: {
            code: "AST-BGV-001",
            name: "Lampu Taman Solar LED #01",
            park: "Taman Utama Bougenville",
            isActive: true,
          },
        },
        {
          companyId: companyA.id,
          actorId: userAdmin.id,
          actorName: userAdmin.name,
          actorRole: "ADMIN",
          entityName: "Technician",
          entityId: tech1.id,
          action: "UPDATE",
          summary: "Menyetujui akun teknisi Budi Santoso (PT Teknik Taman Jaya)",
          oldValues: { approvalStatus: "PENDING" },
          newValues: { approvalStatus: "APPROVED", approvedBy: userAdmin.name },
        },
      ],
    });
  }

  // 9. Contoh EmailLog Awal
  const existingEmails = await prisma.emailLog.count({
    where: { companyId: companyA.id },
  });
  if (existingEmails === 0) {
    await prisma.emailLog.create({
      data: {
        companyId: companyA.id,
        toEmail: userPengguna.email,
        subject: "[TKT-202611-0001] Laporan Kerusakan Diterima - Lampu Taman Solar LED #01",
        bodyHtml: `<p>Terima kasih ${userPengguna.name}, laporan Anda dengan nomor tiket <strong>TKT-202611-0001</strong> telah diterima.</p>`,
        triggerType: "LAPORAN_TERKIRIM",
        ticketNo: report1.ticketNo,
        status: "SENT",
      },
    });
  }

  console.log("✅ Seeding Fase 0 selesai!");
}

main()
  .catch((e) => {
    console.error("❌ Gagal melakukan seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

