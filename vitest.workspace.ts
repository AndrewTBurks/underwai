// Vitest workspace config. One root command runs all tests across packages.
// Vitest 4 replaced `defineWorkspace` with `test.projects` in a single config.
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
    ],
  },
})
