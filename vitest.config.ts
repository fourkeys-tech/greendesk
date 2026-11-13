import { configDefaults, defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { loadTestEnv } from "./src/lib/__tests__/env-loader";

const testEnv = loadTestEnv(__dirname);

export default defineConfig({
  test: {
    // Hint OTP hanya untuk test (non-production); dipakai test P0-2 alur registrasi OTP.
    env: { ALLOW_DEV_OTP_HINT: "true", ...testEnv },
    exclude: [...configDefaults.exclude, ".claude/**"],
    globalSetup: ["./src/lib/__tests__/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
