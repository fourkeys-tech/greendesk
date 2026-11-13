import { afterEach, describe, expect, it, vi } from "vitest";
import { pool, queryCount, queryOne, withTransaction } from "../db";
import type {
  AssetRow,
  CategoryRow,
  ClusterRow,
  ComplexRow,
  EmailLogRow,
  OtpCodeRow,
  ParkRow,
  ReportRow,
  UserRow,
  VendorRow,
} from "../db-types";

const mockCookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      mockCookieStore.set(name, value);
    },
    delete: (name: string) => {
      mockCookieStore.delete(name);
    },
  }),
}));

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createSessionToken,
  getCurrentSession,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "../auth";
import { recordAuditLog } from "../audit";
import {
  buildReportStatusEmail,
  enqueueEmail,
  enqueueReportStatusEmail,
  processEmailOutbox,
} from "../email";
import { __setMailerForTests } from "../mailer";
import { nextTicketNumber } from "../numbering";
import { hasPermission } from "../permissions";
import { transitionReport } from "../report-transition";
import { archiveReportById } from "../services/foundation";
import { hashOtpCode } from "../services/otp";
import { submitCitizenReport } from "../services/phase3-reporting";
import {
  mergeDuplicateReport,
  verifyReportAsValid,
} from "../services/phase4-verification";
import { decideManagerReport } from "../services/phase5-decision";
import {
  requestRegistrationOtpAction,
  verifyRegistrationOtpAction,
} from "@/app/actions/phase3-actions";

async function mustOne<T extends object>(
  sql: string,
  params: unknown[],
  label: string
): Promise<T> {
  const row = await queryOne<T>(sql, params);
  if (!row) throw new Error(`Record tidak ditemukan: ${label}`);
  return row;
}

async function getActorByEmail(email: string): Promise<SessionUser> {
  const u = await mustOne<UserRow & { companyName: string | null }>(
    `SELECT u.*, c."name" AS "companyName"
     FROM "User" u
     LEFT JOIN "Company" c ON c."id" = u."companyId"
     WHERE u."email" = $1`,
    [email],
    email
  );
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName ?? null,
    staffClusterId: u.staffClusterId,
  };
}

describe("Hardening P0 + P1 – Keamanan, Penomoran, Konkurensi, Merge, OTP & Outbox", () => {
  afterEach(() => {
    mockCookieStore.clear();
    __setMailerForTests(null);
  });

  it("P1-B: dua perusahaan membuat SPK di bulan yang sama tetap unik, dan 5 tiket Promise.all semuanya unik", async () => {
    const suffix = Date.now().toString().slice(-6);
    const [pengelolaA, managerA, vendorA, adminB] = await Promise.all([
      getActorByEmail("pengelola.bgv@greenpark.id"),
      getActorByEmail("manager@greenpark.id"),
      mustOne<VendorRow>(
        `SELECT * FROM "Vendor" WHERE "name" = $1 LIMIT 1`,
        ["PT Teknik Taman Jaya"],
        "Vendor A"
      ),
      mustOne<UserRow>(
        `SELECT * FROM "User" WHERE "email" = $1`,
        ["admin@griyaasri.id"],
        "Admin B"
      ),
    ]);

    const companyBId = adminB.companyId!;

    // Siapkan hierarki minimal + vendor + manager + pelapor di Perusahaan B
    const complexB = await mustOne<ComplexRow>(
      `INSERT INTO "Complex" ("companyId", "name", "address", "updatedAt")
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [companyBId, `Komplek Uji B ${suffix}`, "Jl. Uji B No. 1"],
      "complexB"
    );
    const clusterB = await mustOne<ClusterRow>(
      `INSERT INTO "Cluster" ("companyId", "complexId", "name", "updatedAt")
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [companyBId, complexB.id, `Cluster Uji B ${suffix}`],
      "clusterB"
    );
    const parkB = await mustOne<ParkRow>(
      `INSERT INTO "Park" ("companyId", "clusterId", "name", "updatedAt")
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [companyBId, clusterB.id, `Taman Uji B ${suffix}`],
      "parkB"
    );
    const catB = await mustOne<CategoryRow>(
      `INSERT INTO "Category" ("companyId", "name", "damageTypes", "updatedAt")
       VALUES ($1, $2, $3::text[], NOW())
       RETURNING *`,
      [companyBId, `Kategori B ${suffix}`, ["Rusak"]],
      "catB"
    );
    const assetB = await mustOne<AssetRow>(
      `INSERT INTO "Asset" ("companyId", "code", "parkId", "categoryId", "name", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [companyBId, `AST-GAP-${suffix}`, parkB.id, catB.id, `Lampu B ${suffix}`],
      "assetB"
    );
    const [picBUser, managerBUser, pengelolaBUser, pelaporBUser] =
      await Promise.all([
        mustOne<UserRow>(
          `INSERT INTO "User" ("companyId", "name", "email", "role", "updatedAt")
           VALUES ($1, $2, $3, 'PIC_VENDOR'::"Role", NOW())
           RETURNING *`,
          [companyBId, `PIC B ${suffix}`, `pic.b.${suffix}@griyaasri.id`],
          "picBUser"
        ),
        mustOne<UserRow>(
          `INSERT INTO "User" ("companyId", "name", "email", "role", "updatedAt")
           VALUES ($1, $2, $3, 'MANAGER'::"Role", NOW())
           RETURNING *`,
          [companyBId, `Manager B ${suffix}`, `manager.b.${suffix}@griyaasri.id`],
          "managerBUser"
        ),
        mustOne<UserRow>(
          `INSERT INTO "User" ("companyId", "name", "email", "role", "staffClusterId", "updatedAt")
           VALUES ($1, $2, $3, 'PENGELOLA'::"Role", $4, NOW())
           RETURNING *`,
          [
            companyBId,
            `Pengelola B ${suffix}`,
            `pengelola.b.${suffix}@griyaasri.id`,
            clusterB.id,
          ],
          "pengelolaBUser"
        ),
        mustOne<UserRow>(
          `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
           VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
           RETURNING *`,
          [companyBId, `Pelapor B ${suffix}`, `pelapor.b.${suffix}@griyaasri.id`],
          "pelaporBUser"
        ),
      ]);

    await queryOne(
      `INSERT INTO "ClusterManagerAssignment" ("userId", "clusterId", "isTemporary")
       VALUES ($1, $2, false)
       RETURNING "id"`,
      [managerBUser.id, clusterB.id]
    );

    const vendorB = await mustOne<VendorRow>(
      `INSERT INTO "Vendor" ("companyId", "name", "type", "skills", "picUserId", "updatedAt")
       VALUES ($1, $2, 'EXTERNAL'::"VendorType", $3::text[], $4, NOW())
       RETURNING *`,
      [companyBId, `Vendor B ${suffix}`, ["Lampu"], picBUser.id],
      "vendorB"
    );
    await queryOne(
      `INSERT INTO "VendorServiceArea" ("vendorId", "clusterId")
       VALUES ($1, $2)
       RETURNING "id"`,
      [vendorB.id, clusterB.id]
    );

    const pelaporAActorUser = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
       RETURNING *`,
      [pengelolaA.companyId, `Pelapor A ${suffix}`, `pelapor.a.${suffix}@greenpark.id`],
      "pelaporAActorUser"
    );

    const pelaporAActor: SessionUser = {
      id: pelaporAActorUser.id,
      name: pelaporAActorUser.name,
      email: pelaporAActorUser.email,
      role: "PENGGUNA",
      companyId: pelaporAActorUser.companyId,
      companyName: null,
      staffClusterId: null,
    };
    const pelaporBActor: SessionUser = {
      id: pelaporBUser.id,
      name: pelaporBUser.name,
      email: pelaporBUser.email,
      role: "PENGGUNA",
      companyId: pelaporBUser.companyId,
      companyName: null,
      staffClusterId: null,
    };
    const pengelolaBActor: SessionUser = {
      id: pengelolaBUser.id,
      name: pengelolaBUser.name,
      email: pengelolaBUser.email,
      role: "PENGELOLA",
      companyId: pengelolaBUser.companyId,
      companyName: null,
      staffClusterId: clusterB.id,
    };
    const managerBActor: SessionUser = {
      id: managerBUser.id,
      name: managerBUser.name,
      email: managerBUser.email,
      role: "MANAGER",
      companyId: managerBUser.companyId,
      companyName: null,
      staffClusterId: null,
    };

    // 5 tiket bersamaan via Promise.all → semuanya harus berhasil & nomor tiket unik
    const concurrentTickets = await Promise.all(
      Array.from({ length: 5 }, (_, idx) =>
        submitCitizenReport(pelaporAActor, {
          assetCode: "AST-BGV-001",
          channel: "QR",
          description: `Uji tiket paralel #${idx + 1} (${suffix})`,
          photoUrls: [`/uploads/reports/par-${suffix}-${idx}.jpg`],
        })
      )
    );
    const ticketNumbers = concurrentTickets.map((r) => r.ticketNo);
    expect(new Set(ticketNumbers).size).toBe(5);
    for (const no of ticketNumbers) {
      expect(no).toMatch(/^TKT-\d{6}-\d{4}$/);
    }

    // Buat laporan untuk SPK di Perusahaan A dan Perusahaan B pada bulan yang sama
    const repB = await submitCitizenReport(pelaporBActor, {
      assetCode: assetB.code,
      channel: "QR",
      description: `Kerusakan lampu perusahaan B (${suffix})`,
      photoUrls: [`/uploads/reports/b-${suffix}.jpg`],
    });

    await verifyReportAsValid(pengelolaA, {
      reportId: concurrentTickets[0].id,
      priority: "NORMAL",
    });
    await verifyReportAsValid(pengelolaBActor, {
      reportId: repB.id,
      priority: "NORMAL",
    });

    const [decA, decB] = await Promise.all([
      decideManagerReport(managerA, {
        reportId: concurrentTickets[0].id,
        decision: "SETUJU",
        spkInput: {
          vendorId: vendorA.id,
          spkFileUrl: "private://spk/a.pdf",
          spkFileName: "spk-a.pdf",
        },
      }),
      decideManagerReport(managerBActor, {
        reportId: repB.id,
        decision: "SETUJU",
        spkInput: {
          vendorId: vendorB.id,
          spkFileUrl: "private://spk/b.pdf",
          spkFileName: "spk-b.pdf",
        },
      }),
    ]);

    expect(decA.spkNo).toMatch(/^SPK-\d{6}-\d{4}$/);
    expect(decB.spkNo).toMatch(/^SPK-\d{6}-\d{4}$/);
    expect(decA.workOrder?.companyId).toBe(pengelolaA.companyId);
    expect(decB.workOrder?.companyId).toBe(companyBId);
  });

  it("P1-C: dua approve bersamaan hanya meloloskan satu, dan kegagalan di tengah transaksi me-rollback semua log", async () => {
    const suffix = Date.now().toString().slice(-6);
    const [pengelolaA, managerA, vendorA] = await Promise.all([
      getActorByEmail("pengelola.bgv@greenpark.id"),
      getActorByEmail("manager@greenpark.id"),
      mustOne<VendorRow>(
        `SELECT * FROM "Vendor" WHERE "name" = $1 LIMIT 1`,
        ["PT Teknik Taman Jaya"],
        "Vendor A"
      ),
    ]);

    const pelapor = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
       VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
       RETURNING *`,
      [
        pengelolaA.companyId,
        `Pelapor Konkuren ${suffix}`,
        `pelapor.konkuren.${suffix}@greenpark.id`,
      ],
      "pelapor konkuren"
    );
    const pelaporActor: SessionUser = {
      id: pelapor.id,
      name: pelapor.name,
      email: pelapor.email,
      role: "PENGGUNA",
      companyId: pelapor.companyId,
      companyName: null,
      staffClusterId: null,
    };

    const rep = await submitCitizenReport(pelaporActor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: `Uji double approve (${suffix})`,
      photoUrls: ["/uploads/reports/double.jpg"],
    });
    await verifyReportAsValid(pengelolaA, {
      reportId: rep.id,
      priority: "TINGGI",
    });

    const settled = await Promise.allSettled([
      decideManagerReport(managerA, {
        reportId: rep.id,
        decision: "SETUJU",
        spkInput: {
          vendorId: vendorA.id,
          spkFileUrl: "private://spk/race-1.pdf",
          spkFileName: "race-1.pdf",
        },
      }),
      decideManagerReport(managerA, {
        reportId: rep.id,
        decision: "SETUJU",
        spkInput: {
          vendorId: vendorA.id,
          spkFileUrl: "private://spk/race-2.pdf",
          spkFileName: "race-2.pdf",
        },
      }),
    ]);

    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    const rejected = settled.filter((s) => s.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === "rejected") {
      expect(String(rejected[0].reason)).toMatch(
        /sudah berubah|Menunggu Keputusan/i
      );
    }

    const workOrderCount = await queryCount(
      `SELECT COUNT(*)::int AS count FROM "WorkOrder" WHERE "reportId" = $1`,
      [rep.id]
    );
    expect(workOrderCount).toBe(1);

    // Uji rollback transisi gagal di tengah transaksi
    const repRollback = await submitCitizenReport(pelaporActor, {
      assetCode: "AST-BGV-001",
      channel: "QR",
      description: `Uji rollback transaksi (${suffix})`,
      photoUrls: ["/uploads/reports/rollback.jpg"],
    });

    const [logsBefore, auditsBefore, emailsBefore] = await Promise.all([
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "ReportStatusLog" WHERE "reportId" = $1`,
        [repRollback.id]
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "entityName" = 'Report' AND "entityId" = $1`,
        [repRollback.id]
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "EmailLog" WHERE "ticketNo" = $1`,
        [repRollback.ticketNo]
      ),
    ]);

    await expect(
      withTransaction(async (tx) => {
        await transitionReport(tx, {
          reportId: repRollback.id,
          from: "BARU",
          to: "MENUNGGU_KEPUTUSAN",
          actor: { id: pengelolaA.id, role: pengelolaA.role },
          data: { priority: "NORMAL" },
          note: "Seharusnya ter-rollback",
        });

        await recordAuditLog(
          {
            companyId: repRollback.companyId,
            actor: pengelolaA,
            entityName: "Report",
            entityId: repRollback.id,
            action: "UPDATE",
            summary: "Audit yang harusnya ter-rollback",
          },
          tx
        );

        await enqueueReportStatusEmail(tx, {
          companyId: repRollback.companyId,
          toEmail: pelapor.email,
          reporterName: pelapor.name,
          ticketNo: repRollback.ticketNo,
          statusToken: repRollback.statusToken,
          assetName: "Lampu Taman Solar LED #01",
          triggerType: "VALID_MENUNGGU_KEPUTUSAN",
        });

        throw new Error("SIMULATED_MID_TX_FAILURE");
      })
    ).rejects.toThrow("SIMULATED_MID_TX_FAILURE");

    const [repAfter, logsAfter, auditsAfter, emailsAfter] = await Promise.all([
      mustOne<ReportRow>(
        `SELECT * FROM "Report" WHERE "id" = $1`,
        [repRollback.id],
        "repRollback"
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "ReportStatusLog" WHERE "reportId" = $1`,
        [repRollback.id]
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "AuditLog" WHERE "entityName" = 'Report' AND "entityId" = $1`,
        [repRollback.id]
      ),
      queryCount(
        `SELECT COUNT(*)::int AS count FROM "EmailLog" WHERE "ticketNo" = $1`,
        [repRollback.ticketNo]
      ),
    ]);

    expect(repAfter.status).toBe("BARU");
    expect(logsAfter).toBe(logsBefore);
    expect(auditsAfter).toBe(auditsBefore);
    expect(emailsAfter).toBe(emailsBefore);
  });

  it("P1-D: menolak merge ke induk SELESAI, memindahkan cucu ke induk baru, dan fan-out EmailLog QUEUED dengan token anak", async () => {
    const suffix = Date.now().toString().slice(-6);
    const pengelolaA = await getActorByEmail("pengelola.bgv@greenpark.id");
    const assetBgv = await mustOne<AssetRow>(
      `SELECT * FROM "Asset" WHERE "code" = $1`,
      ["AST-BGV-001"],
      "AST-BGV-001"
    );

    const [uParent, uChild, uGrandchild] = await Promise.all([
      mustOne<UserRow>(
        `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
         RETURNING *`,
        [pengelolaA.companyId, `Parent ${suffix}`, `parent.${suffix}@greenpark.id`],
        "uParent"
      ),
      mustOne<UserRow>(
        `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
         RETURNING *`,
        [pengelolaA.companyId, `Child ${suffix}`, `child.${suffix}@greenpark.id`],
        "uChild"
      ),
      mustOne<UserRow>(
        `INSERT INTO "User" ("companyId", "name", "email", "role", "dataConsentAt", "updatedAt")
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", NOW(), NOW())
         RETURNING *`,
        [
          pengelolaA.companyId,
          `Grandchild ${suffix}`,
          `grandchild.${suffix}@greenpark.id`,
        ],
        "uGrandchild"
      ),
    ]);

    const toActor = (u: UserRow): SessionUser => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: "PENGGUNA",
      companyId: u.companyId,
      companyName: null,
      staffClusterId: null,
    });

    // 1. Induk berstatus SELESAI -> merge harus ditolak
    const finishedParent = await withTransaction(async (tx) => {
      const ticketNo = await nextTicketNumber(tx);
      const inserted = await queryOne<ReportRow>(
        `INSERT INTO "Report" ("companyId", "ticketNo", "assetId", "reporterId", "channel", "description", "status", "updatedAt")
         VALUES ($1, $2, $3, $4, 'QR'::"Channel", $5, 'SELESAI'::"ReportStatus", NOW())
         RETURNING *`,
        [assetBgv.companyId, ticketNo, assetBgv.id, uParent.id, `Induk selesai ${suffix}`],
        tx
      );
      if (!inserted) throw new Error("Gagal membuat finishedParent");
      return inserted;
    });
    const repForFinished = await submitCitizenReport(toActor(uChild), {
      assetCode: assetBgv.code,
      channel: "QR",
      description: `Anak menuju induk selesai (${suffix})`,
      photoUrls: ["/uploads/reports/m-fin.jpg"],
    });

    await expect(
      mergeDuplicateReport(pengelolaA, {
        childReportId: repForFinished.id,
        parentReportId: finishedParent.id,
      })
    ).rejects.toThrow(/tidak aktif untuk penggabungan/i);

    // 2. Cucu ikut pindah ke induk baru saat child digabung ke parent
    const [repParent, repChild, repGrandchild] = await Promise.all([
      submitCitizenReport(toActor(uParent), {
        assetCode: assetBgv.code,
        channel: "QR",
        description: `Laporan induk aktif (${suffix})`,
        photoUrls: ["/uploads/reports/m-1.jpg"],
      }),
      submitCitizenReport(toActor(uChild), {
        assetCode: assetBgv.code,
        channel: "QR",
        description: `Laporan anak (${suffix})`,
        photoUrls: ["/uploads/reports/m-2.jpg"],
      }),
      submitCitizenReport(toActor(uGrandchild), {
        assetCode: assetBgv.code,
        channel: "QR",
        description: `Laporan cucu (${suffix})`,
        photoUrls: ["/uploads/reports/m-3.jpg"],
      }),
    ]);

    await mergeDuplicateReport(pengelolaA, {
      childReportId: repGrandchild.id,
      parentReportId: repChild.id,
    });
    await mergeDuplicateReport(pengelolaA, {
      childReportId: repChild.id,
      parentReportId: repParent.id,
    });

    const repGrandchildUpdated = await mustOne<{ parentReportId: string | null }>(
      `SELECT "parentReportId" FROM "Report" WHERE "id" = $1`,
      [repGrandchild.id],
      "repGrandchildUpdated"
    );
    expect(repGrandchildUpdated.parentReportId).toBe(repParent.id);

    // 3. Saat induk dinyatakan VALID -> EmailLog QUEUED tercipta untuk induk, anak, dan cucu (membawa token masing-masing)
    await verifyReportAsValid(pengelolaA, {
      reportId: repParent.id,
      priority: "TINGGI",
    });

    const [mailParent, mailChild, mailGrandchild] = await Promise.all([
      queryOne<EmailLogRow>(
        `SELECT * FROM "EmailLog"
         WHERE "toEmail" = $1 AND "ticketNo" = $2 AND "triggerType" = 'VALID_MENUNGGU_KEPUTUSAN'
         LIMIT 1`,
        [uParent.email, repParent.ticketNo]
      ),
      queryOne<EmailLogRow>(
        `SELECT * FROM "EmailLog"
         WHERE "toEmail" = $1 AND "ticketNo" = $2 AND "triggerType" = 'VALID_MENUNGGU_KEPUTUSAN'
         LIMIT 1`,
        [uChild.email, repChild.ticketNo]
      ),
      queryOne<EmailLogRow>(
        `SELECT * FROM "EmailLog"
         WHERE "toEmail" = $1 AND "ticketNo" = $2 AND "triggerType" = 'VALID_MENUNGGU_KEPUTUSAN'
         LIMIT 1`,
        [uGrandchild.email, repGrandchild.ticketNo]
      ),
    ]);

    expect(mailParent?.status).toBe("QUEUED");
    expect(mailChild?.status).toBe("QUEUED");
    expect(mailGrandchild?.status).toBe("QUEUED");

    expect(mailChild?.bodyHtml).toContain(
      `/status/${encodeURIComponent(repChild.ticketNo)}?k=${encodeURIComponent(repChild.statusToken)}`
    );
    expect(mailGrandchild?.bodyHtml).toContain(
      `/status/${encodeURIComponent(repGrandchild.ticketNo)}?k=${encodeURIComponent(repGrandchild.statusToken)}`
    );
  });

  it("P0-2: OTP disimpan sebagai sha256, menunda pembuatan user hingga verifikasi, dan menolak percobaan ke-6", async () => {
    const suffix = Date.now().toString().slice(-6);
    const emailLock = `otp.lock.${suffix}@greenpark.id`;
    const assetBgv = await mustOne<{ companyId: string }>(
      `SELECT "companyId" FROM "Asset" WHERE "code" = $1`,
      ["AST-BGV-001"],
      "AST-BGV-001 companyId"
    );

    const reqLock = await requestRegistrationOtpAction({
      name: "Calon Warga Terkunci",
      email: emailLock,
      reporterStatus: "WARGA",
      blockHouseNo: "A1/01",
      dataConsent: true,
      assetCode: "AST-BGV-001",
    });

    expect(reqLock.success).toBe(true);
    expect(reqLock.debugOtpHint).toMatch(/^\d{6}$/);

    // User baru BELUM boleh dibuat sebelum verifikasi OTP
    expect(
      await queryOne(`SELECT "id" FROM "User" WHERE "email" = $1`, [emailLock])
    ).toBeNull();

    // OTP di DB tersimpan sebagai sha256(email:kode), bukan plaintext
    const otpRow = await mustOne<OtpCodeRow>(
      `SELECT * FROM "OtpCode" WHERE "email" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [emailLock],
      "otpRow"
    );
    expect(otpRow.code).not.toBe(reqLock.debugOtpHint);
    expect(otpRow.code).toBe(hashOtpCode(emailLock, reqLock.debugOtpHint!));
    expect((otpRow.payload as { companyId?: string } | null)?.companyId).toBe(
      assetBgv.companyId
    );

    const wrongCode =
      reqLock.debugOtpHint === "999999" ? "888888" : "999999";

    for (let i = 0; i < 5; i++) {
      const attempt = await verifyRegistrationOtpAction({
        email: emailLock,
        code: wrongCode,
      });
      expect(attempt).toHaveProperty("error");
    }

    // Percobaan ke-6 dengan kode YANG BENAR tetap ditolak karena kode hangus
    const sixthWithCorrect = await verifyRegistrationOtpAction({
      email: emailLock,
      code: reqLock.debugOtpHint!,
    });
    expect(sixthWithCorrect).toHaveProperty("error");
    expect(
      await queryOne(`SELECT "id" FROM "User" WHERE "email" = $1`, [emailLock])
    ).toBeNull();

    // Verifikasi kode valid pada akun baru kedua baru menciptakan user dengan companyId milik aset
    const emailSuccess = `otp.sukses.${suffix}@greenpark.id`;
    const reqSuccess = await requestRegistrationOtpAction({
      name: "Calon Warga Lolos",
      email: emailSuccess,
      reporterStatus: "WARGA",
      blockHouseNo: "B2/05",
      dataConsent: true,
      assetCode: "AST-BGV-001",
    });
    expect(reqSuccess.debugOtpHint).toMatch(/^\d{6}$/);
    expect(
      await queryOne(`SELECT "id" FROM "User" WHERE "email" = $1`, [emailSuccess])
    ).toBeNull();

    const verified = await verifyRegistrationOtpAction({
      email: emailSuccess,
      code: reqSuccess.debugOtpHint!,
    });
    expect(verified).toMatchObject({
      success: true,
      user: { email: emailSuccess, companyId: assetBgv.companyId },
    });

    const createdUser = await mustOne<UserRow>(
      `SELECT * FROM "User" WHERE "email" = $1`,
      [emailSuccess],
      "createdUser"
    );
    expect(createdUser.companyId).toBe(assetBgv.companyId);
  });

  it("P1-E: outbox menandai SENT pada transport console dan FAILED (retryCount=1, nextAttemptAt masa depan) bila transport gagal", async () => {
    const suffix = Date.now().toString().slice(-6);

    // Pastikan antrean sebelumnya bersih lewat console transport
    __setMailerForTests(null);
    await processEmailOutbox(200);

    // 1. Transport console -> SENT
    const okRow = await enqueueEmail(pool, {
      toEmail: `outbox.ok.${suffix}@greenpark.id`,
      subject: "Uji Outbox Console",
      bodyHtml: "<p>Berhasil</p>",
      triggerType: "LAPORAN_TERKIRIM",
    });
    await processEmailOutbox(200);

    const okAfter = await mustOne<EmailLogRow>(
      `SELECT * FROM "EmailLog" WHERE "id" = $1`,
      [okRow.id],
      "okAfter"
    );
    expect(okAfter.status).toBe("SENT");
    expect(okAfter.sentAt).not.toBeNull();

    // 2. Transport gagal -> FAILED, retryCount = 1, nextAttemptAt di masa depan
    __setMailerForTests({
      kind: "smtp",
      send: async () => {
        throw new Error("SMTP connection refused");
      },
    });

    const beforeMs = Date.now();
    const failRow = await enqueueEmail(pool, {
      toEmail: `outbox.fail.${suffix}@greenpark.id`,
      subject: "Uji Outbox Gagal",
      bodyHtml: "<p>Gagal</p>",
      triggerType: "LAPORAN_TERKIRIM",
    });
    await processEmailOutbox(200);

    const failAfter = await mustOne<EmailLogRow>(
      `SELECT * FROM "EmailLog" WHERE "id" = $1`,
      [failRow.id],
      "failAfter"
    );
    expect(failAfter.status).toBe("FAILED");
    expect(failAfter.retryCount).toBe(1);
    expect(failAfter.nextAttemptAt.getTime()).toBeGreaterThan(beforeMs);
    expect(failAfter.errorMessage).toContain("SMTP connection refused");
  });

  it("P0-5, P0-3 & §10: menolak submitCitizenReport oleh MANAGER, menolak archiveReportById oleh ADMIN, sesi fail-closed, dan escape HTML email", async () => {
    const suffix = Date.now().toString().slice(-6);
    const [managerA, adminA, pengelolaBgv] = await Promise.all([
      getActorByEmail("manager@greenpark.id"),
      getActorByEmail("admin@greenpark.id"),
      getActorByEmail("pengelola.bgv@greenpark.id"),
    ]);

    // 1. submitCitizenReport oleh MANAGER ditolak
    await expect(
      submitCitizenReport(managerA, {
        assetCode: "AST-BGV-001",
        channel: "DASHBOARD",
        description: "Manager mencoba lapor langsung",
        photoUrls: ["/uploads/reports/mgr.jpg"],
      })
    ).rejects.toThrow(/Akses ditolak/i);

    // 2. ARCHIVE_REPORT dicabut dari ADMIN & arsip lintas cluster ditolak
    expect(hasPermission("ADMIN", "ARCHIVE_REPORT")).toBe(false);

    const reportInBgv = await mustOne<{ id: string }>(
      `SELECT "id" FROM "Report" WHERE "ticketNo" = $1 AND "archivedAt" IS NULL LIMIT 1`,
      ["TKT-202611-0001"],
      "reportInBgv"
    );
    await expect(archiveReportById(adminA, reportInBgv.id)).rejects.toThrow(
      /Akses ditolak/i
    );

    const reportInEdw = await mustOne<{ id: string }>(
      `SELECT r."id"
       FROM "Report" r
       INNER JOIN "Asset" a ON a."id" = r."assetId"
       WHERE a."code" = $1 AND r."archivedAt" IS NULL
       LIMIT 1`,
      ["AST-EDW-001"],
      "reportInEdw"
    );
    await expect(archiveReportById(pengelolaBgv, reportInEdw.id)).rejects.toThrow(
      /Akses ditolak/i
    );

    // 3. Sesi fail-closed: user fiktif ditolak, teknisi INACTIVE ditolak, teknisi ON_LEAVE tetap lolos
    const fakeToken = await createSessionToken({
      id: "demo-fiktif-tidak-ada-di-db",
      name: "Demo Palsu",
      email: "fiktif@greenpark.id",
      role: "ADMIN",
      companyId: adminA.companyId,
      companyName: null,
      staffClusterId: null,
    });
    mockCookieStore.set(SESSION_COOKIE_NAME, fakeToken);
    expect(await getCurrentSession()).toBeNull();

    const vendorJaya = await mustOne<VendorRow>(
      `SELECT * FROM "Vendor" WHERE "name" = $1 LIMIT 1`,
      ["PT Teknik Taman Jaya"],
      "vendorJaya"
    );
    const inactiveUser = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "isActive", "updatedAt")
       VALUES ($1, $2, $3, 'TEKNISI'::"Role", true, NOW())
       RETURNING *`,
      [
        adminA.companyId,
        `Teknisi Nonaktif ${suffix}`,
        `tech.inactive.${suffix}@vendorjaya.id`,
      ],
      "inactiveUser"
    );
    await queryOne(
      `INSERT INTO "Technician" (
         "companyId", "vendorId", "userId", "fullName", "whatsapp", "email",
         "skills", "status", "approvalStatus", "deactivationReason", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], 'INACTIVE'::"TechnicianStatus", 'APPROVED'::"ApprovalStatus", $8, NOW())
       RETURNING "id"`,
      [
        adminA.companyId!,
        vendorJaya.id,
        inactiveUser.id,
        inactiveUser.name,
        "081200000001",
        inactiveUser.email,
        ["Lampu"],
        "AUTO_60_DAYS",
      ]
    );
    const inactiveTechToken = await createSessionToken({
      id: inactiveUser.id,
      name: inactiveUser.name,
      email: inactiveUser.email,
      role: "TEKNISI",
      companyId: inactiveUser.companyId,
      companyName: null,
      staffClusterId: null,
    });
    mockCookieStore.set(SESSION_COOKIE_NAME, inactiveTechToken);
    expect(await getCurrentSession()).toBeNull();

    const onLeaveUser = await mustOne<UserRow>(
      `INSERT INTO "User" ("companyId", "name", "email", "role", "isActive", "updatedAt")
       VALUES ($1, $2, $3, 'TEKNISI'::"Role", true, NOW())
       RETURNING *`,
      [
        adminA.companyId,
        `Teknisi Cuti ${suffix}`,
        `tech.leave.${suffix}@vendorjaya.id`,
      ],
      "onLeaveUser"
    );
    await queryOne(
      `INSERT INTO "Technician" (
         "companyId", "vendorId", "userId", "fullName", "whatsapp", "email",
         "skills", "status", "approvalStatus", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], 'ON_LEAVE'::"TechnicianStatus", 'APPROVED'::"ApprovalStatus", NOW())
       RETURNING "id"`,
      [
        adminA.companyId!,
        vendorJaya.id,
        onLeaveUser.id,
        onLeaveUser.name,
        "081200000002",
        onLeaveUser.email,
        ["Lampu"],
      ]
    );
    const onLeaveToken = await createSessionToken({
      id: onLeaveUser.id,
      name: onLeaveUser.name,
      email: onLeaveUser.email,
      role: "TEKNISI",
      companyId: onLeaveUser.companyId,
      companyName: null,
      staffClusterId: null,
    });
    mockCookieStore.set(SESSION_COOKIE_NAME, onLeaveToken);
    const activeLeaveSession = await getCurrentSession();
    expect(activeLeaveSession?.id).toBe(onLeaveUser.id);

    // 4. Template email HTML escape & URL status absolut bertoken
    const mail = buildReportStatusEmail({
      reporterName: `<script>alert("xss")</script>`,
      ticketNo: "TKT-202611-0099",
      statusToken: "tok-abc-123",
      assetName: `Lampu <img src=x onerror=1>`,
      triggerType: "TIDAK_VALID",
      reason: `"Alasan" & <tag>`,
    });
    expect(mail.bodyHtml).not.toContain("<script>");
    expect(mail.bodyHtml).toContain("&lt;script&gt;");
    expect(mail.bodyHtml).toContain("&lt;img src=x onerror=1&gt;");
    expect(mail.bodyHtml).toContain(
      "http://localhost:3000/status/TKT-202611-0099?k=tok-abc-123"
    );
  });
});
