import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // The engine is pure TypeScript, so tests run in Node with no browser DOM.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "out/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["engine/**/*.ts"],
      exclude: ["engine/__tests__/**"],
      // Definition of done: engine coverage stays at or above 90%.
      thresholds: { statements: 90, lines: 90, functions: 90 },
    },
  },
});
