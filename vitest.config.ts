import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { loadTestEnv } from "./src/lib/__tests__/env-loader";

const testEnv = loadTestEnv(__dirname);

export default defineConfig({
  test: {
    env: testEnv,
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
