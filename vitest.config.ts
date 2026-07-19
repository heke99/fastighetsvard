import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false, // delad testdatabas
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: "postgresql://app:app@localhost:5432/fastighet_test?schema=public",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      APP_URL: "http://localhost:3000",
    },
  },
});
