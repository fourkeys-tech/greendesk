import { execSync } from "child_process";
import net from "net";
import path from "path";
import { loadTestEnv } from "./env-loader";

function checkTcpPort(
  host: string,
  port: number,
  timeoutMs = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "../../..");
  const testEnv = loadTestEnv(rootDir);

  const parsedUrl = new URL(testEnv.DATABASE_URL);
  const host = parsedUrl.hostname || "127.0.0.1";
  const port = Number(parsedUrl.port || 5432);

  const reachable = await checkTcpPort(host, port);
  if (!reachable) {
    throw new Error(
      `Database test PostgreSQL belum aktif di ${host}:${port}. ` +
        `Pastikan service PostgreSQL berjalan dan database sesuai .env.test sudah dibuat.`
    );
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...testEnv,
  };

  execSync("npx tsx db/migrate.ts", { cwd: rootDir, env, stdio: "inherit" });
  execSync("npx tsx db/seed.ts", { cwd: rootDir, env, stdio: "inherit" });
}
