import { defineConfig } from "vitest/config";
import path from "path";
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
