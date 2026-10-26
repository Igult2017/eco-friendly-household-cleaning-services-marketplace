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
    // Vitest's 5s default is too tight for the FIRST test that formats a non-English locale: Node
    // loads that locale's data on first use, and on a busy machine that alone took 5.7s and failed
    // an assertion as trivial as "19,00 €" (seen 2026-10-26, 1 run in 4 while a build was running).
    // A test that only fails under load is worse than no test — it teaches people to re-run and
    // ignore it. 20s still catches anything genuinely hung.
    testTimeout: 20_000,
  },
})
