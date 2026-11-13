import type { ReportStatus, Role } from "./db-types";
import { ALLOWED_STATUS_TRANSITIONS, STATUS_METADATA } from "./permissions";

/**
 * Model progres laporan untuk halaman status publik (/status/[ticketNo]).
 * Jalur normal terdiri dari 6 tahap; status akhir lain (Tidak Valid, Ditolak,
 * Digabung, Dibatalkan) menghentikan proses di tahap tertentu.
 */

export interface ReportStage {
  status: ReportStatus;
  title: string;
  /** Arti tahap ini bagi pelapor (dipakai saat tahap sudah lewat / belum dimulai). */
  description: string;
  /** Apa yang sedang terjadi selama laporan berada di tahap ini. */
  currentText: string;
  /** Pihak yang menangani langkah berikutnya selama laporan berada di tahap ini. */
  handler: string | null;
}

export const REPORT_STAGES: readonly ReportStage[] = [
  {
    status: "BARU",
    title: "Laporan Diterima",
    description: "Laporan masuk ke sistem dan menunggu diperiksa Pengelola cluster.",
    currentText: "Laporan Anda sudah masuk dan sedang menunggu diperiksa Pengelola cluster.",
    handler: "Pengelola Cluster",
  },
  {
    status: "MENUNGGU_KEPUTUSAN",
    title: "Diverifikasi Pengelola",
    description: "Laporan dinyatakan valid dan diteruskan ke Manager untuk diputuskan.",
    currentText: "Laporan sudah valid. Manager sedang meninjau dan memutuskan perbaikan.",
    handler: "Manager",
  },
  {
    status: "DISETUJUI",
    title: "Perbaikan Disetujui",
    description: "Manager menyetujui perbaikan dan menerbitkan SPK ke vendor.",
    currentText: "Perbaikan disetujui dan SPK sudah terbit. Vendor sedang menunjuk teknisi.",
    handler: "PIC Vendor",
  },
  {
    status: "DIKERJAKAN",
    title: "Sedang Diperbaiki",
    description: "Teknisi vendor mengerjakan perbaikan di lapangan.",
    currentText: "Teknisi sedang memperbaiki fasilitas di lapangan.",
    handler: "Teknisi",
  },
  {
    status: "MENUNGGU_KONFIRMASI",
    title: "Pemeriksaan Hasil",
    description: "Teknisi mengunggah foto hasil, lalu Manager memeriksanya.",
    currentText: "Teknisi sudah mengunggah foto hasil. Manager sedang memeriksa hasil perbaikan.",
    handler: "Manager",
  },
  {
    status: "SELESAI",
    title: "Selesai",
    description: "Hasil perbaikan dikonfirmasi sesuai dan laporan ditutup.",
    currentText: "Hasil perbaikan dikonfirmasi sesuai dan laporan ditutup.",
    handler: null,
  },
];

/** Status akhir di luar jalur normal → indeks tahap terakhir yang sempat dicapai. */
const STOPPED_AFTER_STAGE: Partial<Record<ReportStatus, number>> = {
  DIBATALKAN: 0,
  DIGABUNG: 0,
  TIDAK_VALID: 0,
  DITOLAK: 1,
};

export type StageState = "done" | "current" | "upcoming" | "skipped";

export interface StatusLogInput {
  id: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  note: string | null;
  createdAt: Date | string;
}

export interface StageView extends ReportStage {
  number: number;
  state: StageState;
  /** Waktu (terakhir) laporan masuk ke tahap ini; null bila belum dicapai / tidak tercatat. */
  reachedAt: Date | null;
}

export interface ReportProgress {
  outcome: "ongoing" | "completed" | "stopped";
  totalStages: number;
  /** Nomor tahap (1-based) terakhir yang dicapai. */
  stageNumber: number;
  percent: number;
  stages: StageView[];
  /** Tahap terakhir yang dicapai. */
  currentStage: StageView;
  /** Tahap berikutnya (hanya bila proses masih berjalan). */
  nextStage: StageView | null;
  stoppedStatus: ReportStatus | null;
  stoppedAt: Date | null;
  /** Berapa kali Manager mengembalikan hasil perbaikan ke teknisi. */
  revisionCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function sortLogs(logs: StatusLogInput[]): StatusLogInput[] {
  return [...logs].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
  );
}

function lastLogTo(logs: StatusLogInput[], status: ReportStatus) {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].toStatus === status) return logs[i];
  }
  return undefined;
}

function isRevision(log: Pick<StatusLogInput, "fromStatus" | "toStatus">) {
  return log.fromStatus === "MENUNGGU_KONFIRMASI" && log.toStatus === "DIKERJAKAN";
}

export function buildReportProgress(input: {
  status: ReportStatus;
  logs: StatusLogInput[];
  createdAt: Date | string;
  stageEnteredAt: Date | string;
}): ReportProgress {
  const logs = sortLogs(input.logs);
  const totalStages = REPORT_STAGES.length;
  const happyIndex = REPORT_STAGES.findIndex((s) => s.status === input.status);
  const isStopped = happyIndex === -1;
  const reachedIndex = isStopped
    ? (STOPPED_AFTER_STAGE[input.status] ?? 0)
    : happyIndex;
  const outcome: ReportProgress["outcome"] = isStopped
    ? "stopped"
    : input.status === "SELESAI"
      ? "completed"
      : "ongoing";

  const stages: StageView[] = REPORT_STAGES.map((stage, i) => {
    let state: StageState;
    if (i < reachedIndex) state = "done";
    else if (i === reachedIndex) state = outcome === "ongoing" ? "current" : "done";
    else state = outcome === "stopped" ? "skipped" : "upcoming";

    let reachedAt: Date | null = null;
    if (i <= reachedIndex) {
      const log = lastLogTo(logs, stage.status);
      if (log) reachedAt = toDate(log.createdAt);
      else if (i === 0) reachedAt = toDate(input.createdAt);
      else if (i === reachedIndex && !isStopped) reachedAt = toDate(input.stageEnteredAt);
    }

    return { ...stage, number: i + 1, state, reachedAt };
  });

  const stoppedAt = isStopped
    ? toDate(lastLogTo(logs, input.status)?.createdAt ?? input.stageEnteredAt)
    : null;

  return {
    outcome,
    totalStages,
    stageNumber: reachedIndex + 1,
    percent:
      outcome === "completed"
        ? 100
        : Math.round(((reachedIndex + 1) / totalStages) * 100),
    stages,
    currentStage: stages[reachedIndex],
    nextStage: outcome === "ongoing" ? (stages[reachedIndex + 1] ?? null) : null,
    stoppedStatus: isStopped ? input.status : null,
    stoppedAt,
    revisionCount: logs.filter(isRevision).length,
    startedAt: stages[0].reachedAt ?? toDate(input.createdAt),
    finishedAt:
      outcome === "completed"
        ? stages[totalStages - 1].reachedAt
        : stoppedAt,
  };
}

/* ---------- Riwayat aktivitas (log status) ---------- */

export type ActivityTone = "info" | "progress" | "success" | "danger" | "warning" | "neutral";

export interface ActivityEntry {
  id: string;
  title: string;
  status: ReportStatus;
  statusLabel: string;
  badgeColor: string;
  /** Peran yang melakukan perubahan (tanpa nama, aman untuk link publik). */
  actorLabel: string | null;
  at: Date;
  /** Catatan hanya untuk alasan penolakan / tidak valid / perbaikan ulang. */
  note: string | null;
  tone: ActivityTone;
}

const ACTOR_LABEL: Record<Role, string> = {
  PENGGUNA: "Pelapor",
  PENGELOLA: "Pengelola Cluster",
  MANAGER: "Manager",
  PIC_VENDOR: "PIC Vendor",
  TEKNISI: "Teknisi",
  ADMIN: "Admin",
  OWNER: "Owner",
};

function actorFor(from: ReportStatus | null, to: ReportStatus): string | null {
  if (from === null) return ACTOR_LABEL.PENGGUNA;
  const rule = ALLOWED_STATUS_TRANSITIONS.find((r) => r.from === from && r.to === to);
  return rule ? ACTOR_LABEL[rule.allowedRole] : null;
}

function describeEvent(log: StatusLogInput): { title: string; tone: ActivityTone } {
  if (isRevision(log)) {
    return { title: "Hasil belum sesuai, perbaikan diulang", tone: "warning" };
  }
  switch (log.toStatus) {
    case "BARU":
      return { title: "Laporan dikirim", tone: "info" };
    case "MENUNGGU_KEPUTUSAN":
      return { title: "Diverifikasi & diteruskan ke Manager", tone: "progress" };
    case "DISETUJUI":
      return { title: "Perbaikan disetujui, SPK diterbitkan", tone: "progress" };
    case "DIKERJAKAN":
      return { title: "Teknisi ditugaskan & mulai bekerja", tone: "progress" };
    case "MENUNGGU_KONFIRMASI":
      return { title: "Teknisi mengunggah hasil perbaikan", tone: "progress" };
    case "SELESAI":
      return { title: "Perbaikan dikonfirmasi selesai", tone: "success" };
    case "TIDAK_VALID":
      return { title: "Laporan dinyatakan tidak valid", tone: "danger" };
    case "DITOLAK":
      return { title: "Perbaikan ditolak Manager", tone: "danger" };
    case "DIGABUNG":
      return { title: "Digabung ke laporan lain", tone: "neutral" };
    case "DIBATALKAN":
      return { title: "Laporan dibatalkan pelapor", tone: "neutral" };
  }
}

function showsNote(log: StatusLogInput): boolean {
  return log.toStatus === "TIDAK_VALID" || log.toStatus === "DITOLAK" || isRevision(log);
}

/** Riwayat aktivitas, terbaru di atas. */
export function buildActivityLog(logs: StatusLogInput[]): ActivityEntry[] {
  return sortLogs(logs)
    .reverse()
    .map((log) => {
      const meta = STATUS_METADATA[log.toStatus];
      const { title, tone } = describeEvent(log);
      return {
        id: log.id,
        title,
        status: log.toStatus,
        statusLabel: meta.label,
        badgeColor: meta.badgeColor,
        actorLabel: actorFor(log.fromStatus, log.toStatus),
        at: toDate(log.createdAt),
        note: showsNote(log) ? log.note?.trim() || null : null,
        tone,
      };
    });
}

/* ---------- Format waktu (bahasa Indonesia) ---------- */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 93_600_000 → "1 hari 2 jam" */
export function formatDurationId(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  if (minutes < 1) return "kurang dari 1 menit";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} hari ${rest} jam` : `${days} hari`;
}

/** Waktu relatif, mis. "2 hari yang lalu" / "kemarin" / "baru saja". */
export function formatRelativeId(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE) return "baru saja";
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), "month");
  return rtf.format(Math.round(diff / (365 * DAY)), "year");
}
