/**
 * Utilitas tanggal zona WIB (UTC+7) untuk input <input type="date">.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function isDateOnly(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

/** "2026-11-10" -> 2026-11-10T00:00:00+07:00 */
export function parseWibDateStart(raw: string | null | undefined): Date | null {
  const v = raw?.trim();
  if (!v) return null;
  const d = isDateOnly(v) ? new Date(`${v}T00:00:00+07:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-11-10" -> 2026-11-10T23:59:59.999+07:00 */
export function parseWibDateEnd(raw: string | null | undefined): Date | null {
  const v = raw?.trim();
  if (!v) return null;
  const d = isDateOnly(v) ? new Date(`${v}T23:59:59.999+07:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Tanggal hari ini (WIB) + offset hari, format YYYY-MM-DD untuk value input date. */
export function wibDateInputValue(offsetDays = 0, base: Date = new Date()): string {
  const shifted = new Date(
    base.getTime() + WIB_OFFSET_MS + offsetDays * 86400000
  );
  return shifted.toISOString().slice(0, 10);
}

export function formatWibDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function formatWibDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
