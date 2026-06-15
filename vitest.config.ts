import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      exclude: ["src/runtime/types.ts"],
      include: ["src/graph/**/*.ts", "src/runtime/**/*.ts"],
      provider: "v8",
      reporter: ["text"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  }
});
