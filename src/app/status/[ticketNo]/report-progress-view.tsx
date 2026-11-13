import { Fragment } from "react";
import { ArrowRight, Check, Clock, UserRound, X } from "lucide-react";
import { formatWibDate, formatWibDateTime } from "@/lib/dates";
import { STATUS_METADATA } from "@/lib/permissions";
import {
  formatDurationId,
  formatRelativeId,
  type ActivityEntry,
  type ActivityTone,
  type ReportProgress,
  type StageView,
} from "@/lib/report-progress";

const cardClass =
  "bg-white rounded-2xl shadow-sm border border-slate-200/70 p-5";

function CardTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
    >
      {children}
    </h2>
  );
}

/* ================= Status Penanganan (tahapan) ================= */

function segmentClass(stage: StageView, outcome: ReportProgress["outcome"]) {
  if (stage.state === "done") {
    return outcome === "stopped" ? "bg-slate-400" : "bg-emerald-800";
  }
  if (stage.state === "current") return "bg-emerald-500";
  return "bg-slate-200";
}

function StageDot({ stage }: { stage: StageView }) {
  const base =
    "relative z-10 mt-1.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold";

  if (stage.state === "done") {
    return (
      <span className={`${base} bg-emerald-900 text-white`}>
        <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (stage.state === "current") {
    return (
      <span
        className={`${base} bg-white border-2 border-emerald-600 ring-4 ring-emerald-100`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
        </span>
      </span>
    );
  }
  if (stage.state === "skipped") {
    return (
      <span
        className={`${base} bg-slate-50 border border-dashed border-slate-300 text-slate-300`}
      >
        {stage.number}
      </span>
    );
  }
  return (
    <span className={`${base} bg-white border-2 border-slate-200 text-slate-400`}>
      {stage.number}
    </span>
  );
}

function StopItem({
  progress,
  hasNext,
}: {
  progress: ReportProgress;
  hasNext: boolean;
}) {
  const status = progress.stoppedStatus;
  if (!status) return null;
  const meta = STATUS_METADATA[status];
  const isNeutral = status === "DIGABUNG" || status === "DIBATALKAN";

  return (
    <li className="relative flex gap-3 pb-2">
      {hasNext && (
        <span
          aria-hidden="true"
          className="absolute left-[13px] top-9 -bottom-1.5 w-0.5 bg-slate-200"
        />
      )}
      <span
        className={`relative z-10 mt-1.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
          isNeutral ? "bg-slate-500" : "bg-rose-600"
        }`}
      >
        <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <div
        className={`flex-1 min-w-0 rounded-xl border px-3 py-2 ${
          isNeutral ? "bg-slate-50 border-slate-200" : "bg-rose-50 border-rose-200"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-bold ${isNeutral ? "text-slate-800" : "text-rose-800"}`}
          >
            {meta.label}
          </span>
          {progress.stoppedAt && (
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              {formatWibDate(progress.stoppedAt)}
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${isNeutral ? "text-slate-600" : "text-rose-700"}`}>
          {meta.description} Proses tidak dilanjutkan.
        </p>
      </div>
    </li>
  );
}

function StageItem({
  stage,
  isLast,
  lineActive,
  isNext,
  now,
}: {
  stage: StageView;
  isLast: boolean;
  lineActive: boolean;
  isNext: boolean;
  now: Date;
}) {
  const isCurrent = stage.state === "current";
  const isSkipped = stage.state === "skipped";
  const isUpcoming = stage.state === "upcoming";

  return (
    <li
      className="relative flex gap-3 pb-2 last:pb-0"
      aria-current={isCurrent ? "step" : undefined}
    >
      {!isLast && (
        <span
          aria-hidden="true"
          className={`absolute left-[13px] top-9 -bottom-1.5 w-0.5 ${
            lineActive ? "bg-emerald-900" : "bg-slate-200"
          }`}
        />
      )}
      <StageDot stage={stage} />

      <div
        className={`flex-1 min-w-0 rounded-xl border px-3 py-2 ${
          isCurrent
            ? "bg-emerald-50 border-emerald-200"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-bold ${
              isSkipped
                ? "text-slate-300"
                : isUpcoming
                  ? "text-slate-500"
                  : isCurrent
                    ? "text-emerald-900"
                    : "text-slate-900"
            }`}
          >
            <span className="sr-only">Tahap {stage.number}: </span>
            {stage.title}
          </span>

          {stage.reachedAt && !isUpcoming && !isSkipped ? (
            <time
              dateTime={stage.reachedAt.toISOString()}
              className="text-[10px] text-slate-400 whitespace-nowrap"
            >
              {formatWibDate(stage.reachedAt)}
            </time>
          ) : isNext ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-white border border-emerald-200 rounded-md px-1.5 py-0.5 whitespace-nowrap">
              Berikutnya
            </span>
          ) : isSkipped ? (
            <span className="text-[10px] text-slate-300 whitespace-nowrap">
              Tidak dilanjutkan
            </span>
          ) : null}
        </div>

        <p
          className={`text-xs mt-0.5 ${
            isSkipped
              ? "text-slate-300"
              : isCurrent
                ? "text-emerald-900/80"
                : "text-slate-500"
          }`}
        >
          {isCurrent ? stage.currentText : stage.description}
        </p>

        {isCurrent && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {stage.handler && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-900">
                <UserRound className="w-3 h-3" aria-hidden="true" />
                Ditangani {stage.handler}
              </span>
            )}
            {stage.reachedAt && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-emerald-900">
                <Clock className="w-3 h-3" aria-hidden="true" />
                Di tahap ini {formatDurationId(now.getTime() - stage.reachedAt.getTime())}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function ReportProgressCard({
  progress,
  now,
}: {
  progress: ReportProgress;
  now: Date;
}) {
  const { outcome, stages, totalStages, stageNumber, currentStage, nextStage } =
    progress;
  const stoppedMeta = progress.stoppedStatus
    ? STATUS_METADATA[progress.stoppedStatus]
    : null;

  const headline =
    outcome === "completed"
      ? "Perbaikan Selesai"
      : stoppedMeta
        ? `Laporan ${stoppedMeta.label}`
        : currentStage.title;

  const subline =
    outcome === "completed"
      ? `Semua ${totalStages} tahap selesai`
      : outcome === "stopped"
        ? `Berhenti di tahap ${stageNumber} dari ${totalStages}`
        : `Tahap ${stageNumber} dari ${totalStages}`;

  return (
    <section className={cardClass} aria-labelledby="progress-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id="progress-title">Status Penanganan</CardTitle>
          <p className="mt-1.5 text-lg font-extrabold text-slate-900 leading-tight">
            {headline}
          </p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">{subline}</p>
        </div>
        {outcome !== "stopped" && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold text-emerald-900 leading-none">
              {progress.percent}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">progres</div>
          </div>
        )}
      </div>

      {/* Bar progres bersegmen: satu segmen per tahap */}
      <div
        className="mt-4 flex gap-1.5"
        role="progressbar"
        aria-label="Progres penanganan laporan"
        aria-valuemin={0}
        aria-valuemax={totalStages}
        aria-valuenow={stageNumber}
        aria-valuetext={subline}
      >
        {stages.map((s) => (
          <span
            key={s.status}
            className={`h-2 flex-1 rounded-full ${segmentClass(s, outcome)}`}
          />
        ))}
      </div>

      {/* Ringkasan singkat sesuai kondisi laporan */}
      <div className="mt-3 text-xs text-slate-600">
        {outcome === "ongoing" && nextStage && (
          <p className="flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              Langkah berikutnya:{" "}
              <span className="font-bold text-slate-900">{nextStage.title}</span>
            </span>
          </p>
        )}
        {outcome === "completed" && progress.finishedAt && (
          <p className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={3} aria-hidden="true" />
            <span>
              Diselesaikan dalam{" "}
              <span className="font-bold text-slate-900">
                {formatDurationId(
                  progress.finishedAt.getTime() - progress.startedAt.getTime()
                )}
              </span>{" "}
              sejak dilaporkan.
            </span>
          </p>
        )}
        {outcome === "stopped" && (
          <p>Laporan tidak diproses lebih lanjut. Lihat alasan pada catatan di bawah.</p>
        )}
      </div>

      {progress.revisionCount > 0 && (
        <p className="mt-3 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Hasil perbaikan pernah dikembalikan {progress.revisionCount}x ke teknisi
          untuk diperbaiki ulang.
        </p>
      )}

      {/* Daftar tahapan */}
      <ol className="mt-5" aria-label="Tahapan penanganan laporan">
        {stages.map((stage, i) => {
          const next = stages[i + 1];
          // Laporan yang berhenti: penanda "berhenti" disisipkan tepat setelah tahap terakhir yang dicapai.
          const stopHere =
            outcome === "stopped" && stage.number === stageNumber;
          return (
            <Fragment key={stage.status}>
              <StageItem
                stage={stage}
                isLast={i === stages.length - 1 && !stopHere}
                lineActive={
                  !stopHere &&
                  (next?.state === "done" || next?.state === "current")
                }
                isNext={nextStage?.status === stage.status}
                now={now}
              />
              {stopHere && (
                <StopItem progress={progress} hasNext={i < stages.length - 1} />
              )}
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

/* ================= Riwayat Aktivitas ================= */

const TONE_DOT: Record<ActivityTone, string> = {
  info: "bg-sky-500 ring-sky-100",
  progress: "bg-emerald-600 ring-emerald-100",
  success: "bg-emerald-700 ring-emerald-200",
  danger: "bg-rose-500 ring-rose-100",
  warning: "bg-amber-500 ring-amber-100",
  neutral: "bg-slate-400 ring-slate-100",
};

const TONE_NOTE: Record<ActivityTone, string> = {
  info: "bg-slate-50 border-slate-200 text-slate-700",
  progress: "bg-slate-50 border-slate-200 text-slate-700",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  danger: "bg-rose-50 border-rose-200 text-rose-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  neutral: "bg-slate-50 border-slate-200 text-slate-700",
};

export function ReportActivityCard({
  entries,
  now,
}: {
  entries: ActivityEntry[];
  now: Date;
}) {
  return (
    <section className={cardClass} aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-2">
        <CardTitle id="activity-title">Riwayat Aktivitas</CardTitle>
        {entries.length > 0 && (
          <span className="text-[10px] font-semibold text-slate-400">
            {entries.length} aktivitas · terbaru di atas
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-4 text-center">
          Belum ada aktivitas tercatat untuk laporan ini.
        </p>
      ) : (
        <ol className="mt-4">
          {entries.map((entry, i) => {
            const isLatest = i === 0;
            return (
              <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < entries.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] top-5 bottom-0 w-px bg-slate-200"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-1.5 w-[11px] h-[11px] rounded-full ring-4 shrink-0 ${TONE_DOT[entry.tone]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`text-sm font-bold ${isLatest ? "text-slate-900" : "text-slate-700"}`}
                    >
                      {entry.title}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-900 text-white rounded px-1.5 py-0.5">
                        Terbaru
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
                    <time dateTime={entry.at.toISOString()}>
                      {formatWibDateTime(entry.at)} WIB
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeId(entry.at, now)}</span>
                    {entry.actorLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>oleh {entry.actorLabel}</span>
                      </>
                    )}
                  </div>

                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${entry.badgeColor}`}
                  >
                    Status: {entry.statusLabel}
                  </span>

                  {entry.note && (
                    <p
                      className={`mt-2 text-xs rounded-lg border px-3 py-2 ${TONE_NOTE[entry.tone]}`}
                    >
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
