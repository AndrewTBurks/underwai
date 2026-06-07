// Per-package vitest config. Each package can override; the default
// (used by schema, the first package) discovers tests in src/.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
