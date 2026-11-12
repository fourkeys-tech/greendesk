import type { PoolConfig } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Membangun konfigurasi Pool `pg` dengan dukungan SSL otomatis untuk host remote
 * (seperti Supabase), sementara koneksi lokal tetap berjalan tanpa SSL.
 */
export function buildPgPoolConfig(
  connectionString: string,
  max = 10
): PoolConfig {
  let cleanUrl = connectionString;
  let useSsl = false;

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const isLocal = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());

    if (sslMode === "disable") {
      useSsl = false;
    } else if (!isLocal || Boolean(sslMode)) {
      useSsl = true;
      if (
        sslMode === "require" ||
        sslMode === "prefer" ||
        sslMode === "no-verify"
      ) {
        parsed.searchParams.delete("sslmode");
        cleanUrl = parsed.toString();
      }
    }
  } catch {
    // Biarkan `pg` mem-parsing string koneksi non-URL secara langsung
  }

  return useSsl
    ? {
        connectionString: cleanUrl,
        max,
        ssl: { rejectUnauthorized: false },
      }
    : {
        connectionString: cleanUrl,
        max,
      };
}

