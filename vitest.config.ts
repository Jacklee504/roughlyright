import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // PGlite (embedded Postgres WASM) is not safe to instantiate concurrently
    // across vitest workers — run test files sequentially.
    fileParallelism: false,
  },
});
