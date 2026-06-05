import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true } as any,
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.test.ts", "**/node_modules/**"],
    },
    setupFiles: ["./tests/setup.ts"],
  },
})
