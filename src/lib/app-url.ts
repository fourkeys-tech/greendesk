const DEVELOPMENT_APP_URL = "http://localhost:3000";

/** Canonical absolute URL used in emails and generated QR codes. */
export function getPublicAppBaseUrl(override?: string): string {
  const configured = override?.trim() || process.env.APP_BASE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_BASE_URL wajib dikonfigurasi pada production.");
    }
    return DEVELOPMENT_APP_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("APP_BASE_URL harus berupa URL absolut yang valid.");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("APP_BASE_URL hanya boleh memakai HTTP(S), tanpa kredensial/query/hash.");
  }

  return configured.replace(/\/+$/, "");
}
