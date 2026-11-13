import { describe, expect, it } from "vitest";
import type { ReportStatus } from "../db-types";
import {
  REPORT_STAGES,
  buildActivityLog,
  buildReportProgress,
  formatDurationId,
  formatRelativeId,
  type StatusLogInput,
} from "../report-progress";

const T0 = new Date("2026-11-01T08:00:00+07:00");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);

function log(
  id: string,
  from: ReportStatus | null,
  to: ReportStatus,
  atHours: number,
  note: string | null = null
): StatusLogInput {
  return { id, fromStatus: from, toStatus: to, note, createdAt: hours(atHours) };
}

const HAPPY_PATH: StatusLogInput[] = [
  log("1", null, "BARU", 0),
  log("2", "BARU", "MENUNGGU_KEPUTUSAN", 2),
  log("3", "MENUNGGU_KEPUTUSAN", "DISETUJUI", 6),
  log("4", "DISETUJUI", "DIKERJAKAN", 8),
  log("5", "DIKERJAKAN", "MENUNGGU_KONFIRMASI", 24),
  log("6", "MENUNGGU_KONFIRMASI", "SELESAI", 49),
];

describe("buildReportProgress", () => {
  it("memiliki 6 tahap jalur normal", () => {
    expect(REPORT_STAGES.map((s) => s.status)).toEqual([
      "BARU",
      "MENUNGGU_KEPUTUSAN",
      "DISETUJUI",
      "DIKERJAKAN",
      "MENUNGGU_KONFIRMASI",
      "SELESAI",
    ]);
  });

  it("laporan baru: tahap 1 dari 6 aktif, tahap berikutnya verifikasi", () => {
    const p = buildReportProgress({
      status: "BARU",
      logs: [log("1", null, "BARU", 0)],
      createdAt: T0,
      stageEnteredAt: T0,
    });
    expect(p.outcome).toBe("ongoing");
    expect(p.stageNumber).toBe(1);
    expect(p.totalStages).toBe(6);
    expect(p.percent).toBe(17);
    expect(p.stages.map((s) => s.state)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(p.nextStage?.status).toBe("MENUNGGU_KEPUTUSAN");
    expect(p.currentStage.handler).toBe("Pengelola Cluster");
  });

  it("sedang dikerjakan: tahap 4 aktif dengan tanggal dari log", () => {
    const p = buildReportProgress({
      status: "DIKERJAKAN",
      logs: HAPPY_PATH.slice(0, 4),
      createdAt: T0,
      stageEnteredAt: hours(8),
    });
    expect(p.stageNumber).toBe(4);
    expect(p.stages.slice(0, 3).every((s) => s.state === "done")).toBe(true);
    expect(p.currentStage.state).toBe("current");
    expect(p.currentStage.reachedAt).toEqual(hours(8));
    expect(p.stages[1].reachedAt).toEqual(hours(2));
    expect(p.stages[4].reachedAt).toBeNull();
    expect(p.nextStage?.status).toBe("MENUNGGU_KONFIRMASI");
  });

  it("selesai: semua tahap done, 100%, durasi total dari log", () => {
    const p = buildReportProgress({
      status: "SELESAI",
      logs: HAPPY_PATH,
      createdAt: T0,
      stageEnteredAt: hours(49),
    });
    expect(p.outcome).toBe("completed");
    expect(p.percent).toBe(100);
    expect(p.stages.every((s) => s.state === "done")).toBe(true);
    expect(p.nextStage).toBeNull();
    expect(p.finishedAt).toEqual(hours(49));
    expect(p.startedAt).toEqual(T0);
  });

  it("ditolak Manager: berhenti setelah tahap 2, sisanya dilewati", () => {
    const p = buildReportProgress({
      status: "DITOLAK",
      logs: [
        log("1", null, "BARU", 0),
        log("2", "BARU", "MENUNGGU_KEPUTUSAN", 2),
        log("3", "MENUNGGU_KEPUTUSAN", "DITOLAK", 5, "Anggaran belum tersedia"),
      ],
      createdAt: T0,
      stageEnteredAt: hours(5),
    });
    expect(p.outcome).toBe("stopped");
    expect(p.stageNumber).toBe(2);
    expect(p.stoppedStatus).toBe("DITOLAK");
    expect(p.stoppedAt).toEqual(hours(5));
    expect(p.stages.map((s) => s.state)).toEqual([
      "done",
      "done",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
    ]);
    expect(p.nextStage).toBeNull();
  });

  it("tidak valid / digabung / dibatalkan: berhenti setelah tahap 1", () => {
    for (const status of ["TIDAK_VALID", "DIGABUNG", "DIBATALKAN"] as const) {
      const p = buildReportProgress({
        status,
        logs: [log("1", null, "BARU", 0), log("2", "BARU", status, 1)],
        createdAt: T0,
        stageEnteredAt: hours(1),
      });
      expect(p.stageNumber).toBe(1);
      expect(p.stages[0].state).toBe("done");
      expect(p.stages[1].state).toBe("skipped");
    }
  });

  it("perbaikan ulang: dihitung sebagai revisi, tanggal tahap memakai kedatangan terakhir", () => {
    const p = buildReportProgress({
      status: "DIKERJAKAN",
      logs: [
        ...HAPPY_PATH.slice(0, 5),
        log("6", "MENUNGGU_KONFIRMASI", "DIKERJAKAN", 30, "Cat belum rata"),
      ],
      createdAt: T0,
      stageEnteredAt: hours(30),
    });
    expect(p.revisionCount).toBe(1);
    expect(p.stageNumber).toBe(4);
    expect(p.currentStage.reachedAt).toEqual(hours(30));
  });

  it("tanpa log (data lama): tetap tampil, tanggal dari createdAt / stageEnteredAt", () => {
    const p = buildReportProgress({
      status: "MENUNGGU_KEPUTUSAN",
      logs: [],
      createdAt: T0,
      stageEnteredAt: hours(3),
    });
    expect(p.stageNumber).toBe(2);
    expect(p.stages[0].reachedAt).toEqual(T0);
    expect(p.currentStage.reachedAt).toEqual(hours(3));
  });
});

describe("buildActivityLog", () => {
  it("urut terbaru di atas, dengan judul & peran pelaku", () => {
    const entries = buildActivityLog(HAPPY_PATH);
    expect(entries.map((e) => e.id)).toEqual(["6", "5", "4", "3", "2", "1"]);
    expect(entries[0].title).toBe("Perbaikan dikonfirmasi selesai");
    expect(entries[0].actorLabel).toBe("Manager");
    expect(entries[2].actorLabel).toBe("PIC Vendor");
    expect(entries[5].actorLabel).toBe("Pelapor");
    expect(entries[0].tone).toBe("success");
  });

  it("catatan internal disembunyikan; alasan tolak & revisi ditampilkan", () => {
    const entries = buildActivityLog([
      log("1", null, "BARU", 0, "Laporan dikirim melalui saluran QR"),
      log("2", "BARU", "MENUNGGU_KEPUTUSAN", 1, "Prioritas TINGGI"),
      log("3", "MENUNGGU_KEPUTUSAN", "DISETUJUI", 2, "SPK diterbitkan kepada vendor X"),
      log("4", "DISETUJUI", "DIKERJAKAN", 3),
      log("5", "DIKERJAKAN", "MENUNGGU_KONFIRMASI", 4),
      log("6", "MENUNGGU_KONFIRMASI", "DIKERJAKAN", 5, "Cat belum rata"),
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId["1"].note).toBeNull();
    expect(byId["2"].note).toBeNull();
    expect(byId["3"].note).toBeNull();
    expect(byId["6"].note).toBe("Cat belum rata");
    expect(byId["6"].title).toBe("Hasil belum sesuai, perbaikan diulang");
    expect(byId["6"].tone).toBe("warning");
  });

  it("menampilkan alasan Tidak Valid", () => {
    const [latest] = buildActivityLog([
      log("1", null, "BARU", 0),
      log("2", "BARU", "TIDAK_VALID", 1, "Foto tidak menunjukkan kerusakan"),
    ]);
    expect(latest.note).toBe("Foto tidak menunjukkan kerusakan");
    expect(latest.actorLabel).toBe("Pengelola Cluster");
    expect(latest.tone).toBe("danger");
  });
});

describe("format waktu", () => {
  it("formatDurationId", () => {
    expect(formatDurationId(30_000)).toBe("kurang dari 1 menit");
    expect(formatDurationId(45 * 60_000)).toBe("45 menit");
    expect(formatDurationId(2 * 3_600_000)).toBe("2 jam");
    expect(formatDurationId(2 * 3_600_000 + 15 * 60_000)).toBe("2 jam 15 menit");
    expect(formatDurationId(49 * 3_600_000)).toBe("2 hari 1 jam");
    expect(formatDurationId(3 * 86_400_000)).toBe("3 hari");
  });

  it("formatRelativeId", () => {
    const now = hours(100);
    expect(formatRelativeId(now, now)).toBe("baru saja");
    expect(formatRelativeId(new Date(now.getTime() - 5 * 60_000), now)).toMatch(/5 menit/);
    expect(formatRelativeId(new Date(now.getTime() - 3 * 86_400_000), now)).toMatch(/3 hari/);
  });
});
