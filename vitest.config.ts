import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js tillhandahåller `server-only` vid bygget. Aliaset gör att
      // serverkodens rena hjälpfunktioner kan enhetstestas i Node.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      APP_URL: "http://localhost:3000",
    },
  },
});
