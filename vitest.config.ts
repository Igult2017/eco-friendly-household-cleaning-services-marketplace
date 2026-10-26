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
    // Vitest's 5s default is far too tight for this suite on a BUSY machine, and a test that only
    // fails under load is worse than no test — it teaches people to re-run and ignore failures.
    //
    // Two separate things are slow, both measured on 2026-10-26 while a production build ran
    // alongside the tests:
    //   - the first test to format a non-English locale waits on Node loading that locale's data,
    //     which alone took 5.7s and failed an assertion as trivial as "19,00 €";
    //   - the database tests run Postgres compiled to WebAssembly (PGlite), so they are pure CPU
    //     and starve when something else saturates the machine — one took 31s that normally
    //     finishes in milliseconds.
    // Idle, the whole suite is ~23s for 155 tests, so these limits are nowhere near normal timings
    // and still catch anything genuinely hung.
    testTimeout: 60_000,
    // Building the whole production schema inside PGlite happens in beforeAll and is the single
    // most expensive step in the suite.
    hookTimeout: 120_000,
  },
})
