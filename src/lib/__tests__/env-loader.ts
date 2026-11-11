import fs from "fs";
import path from "path";

export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed: Record<string, string> = {};

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }

  return parsed;
}

/**
 * Memuat `.env.test` dan memaksa `process.env` menggunakannya (override `.env` dev).
 * Sekaligus menolak bila `DATABASE_URL` test menunjuk ke port yang sama dengan `.env` dev.
 */
export function loadTestEnv(rootDir: string): Record<string, string> {
  const testEnvPath = path.join(rootDir, ".env.test");
  const devEnvPath = path.join(rootDir, ".env");

  const testVars = parseEnvFile(testEnvPath);
  if (!testVars.DATABASE_URL) {
    throw new Error(
      `File .env.test tidak ditemukan atau tidak mendefinisikan DATABASE_URL (${testEnvPath}).`
    );
  }

  const devVars = parseEnvFile(devEnvPath);
  if (devVars.DATABASE_URL && devVars.DATABASE_URL === testVars.DATABASE_URL) {
    throw new Error(
      "Isolasi test gagal: DATABASE_URL di .env.test identik dengan .env development."
    );
  }

  for (const [k, v] of Object.entries(testVars)) {
    process.env[k] = v;
  }

  return testVars;
}
