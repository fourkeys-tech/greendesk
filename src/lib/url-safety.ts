/**
 * Helper validasi & sanitasi URL upload/tautan untuk mencegah XSS (javascript:/data:)
 * serta injeksi path traversal maupun host eksternal tak terpercaya.
 */

const SAFE_LOCAL_UPLOAD_RE = /^\/uploads\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/;
const SAFE_LOCAL_STATIC_RE = /^\/(?:uploads|images|assets)\/[a-zA-Z0-9._%/-]+$/;

export function isSafeLocalUploadUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) {
    return false;
  }
  return SAFE_LOCAL_UPLOAD_RE.test(trimmed);
}

export function assertSafeUploadUrl(url: string, label = "URL berkas"): string {
  const trimmed = url.trim();
  if (!isSafeLocalUploadUrl(trimmed)) {
    throw new Error(
      `${label} tidak valid. Hanya berkas unggahan lokal (/uploads/...) yang diizinkan.`
    );
  }
  return trimmed;
}

export function assertSafeUploadUrls(
  urls: string[],
  label = "URL berkas"
): string[] {
  return urls
    .map((u) => u?.trim())
    .filter((u): u is string => Boolean(u))
    .map((u) => assertSafeUploadUrl(u, label));
}

/**
 * Sanitasi URL sebelum dirender ke `<a href>` atau `<img src>`.
 * Hanya mengizinkan path lokal terverifikasi (`/uploads/...`, `/images/...`, `/assets/...`)
 * atau URL `https://` / `http://` yang valid (memblokir `javascript:`, `data:`, `vbscript:`, `//`).
 */
export function sanitizeMediaHref(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) {
    return null;
  }
  if (SAFE_LOCAL_STATIC_RE.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Sanitasi tautan internal (misal Notification.linkUrl) agar hanya menerima
 * relative path satu slash (`/dashboard/...`), memblokir `//evil.com` dan `javascript:`.
 */
export function sanitizeInternalHref(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("..") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}
