import { defineConfig } from "oxlint";

export default defineConfig({
  // Enable built-in plugin ecosystems
  plugins: ["typescript", "react", "import", "unicorn"],

  options: {
    // Enables type-aware linting for deeper TypeScript static analysis
    typeAware: true,
    // Emits native TypeScript compiler diagnostics alongside lint errors
    typeCheck: true,
  },

  categories: {
    // Turn on baseline lint groups
    correctness: "error",
    suspicious: "warn",
    pedantic: "off", // Usually too noisy for libraries, manage rules explicitly
  },

  rules: {
    // === TypeScript & Library Reliability ===
    "typescript/no-explicit-any": "warn", // Discourage 'any' in public library APIs
    "typescript/no-unused-vars": "error", // Keep library bundle clean
    "typescript/consistent-type-imports": "error", // Optimizes bundling/tree-shaking
    "typescript/no-require-imports": "error", // Force modern ESM syntax
    "typescript/strict-boolean-expressions": "warn", // Avoid truthy/falsy bugs in library logic

    // === React & TSX Robustness ===
    "react/jsx-no-duplicate-props": "error", // Prevents broken UI components
    "react/jsx-key": "error", // Catches missing keys in dynamic arrays
    "react/no-string-refs": "error", // Forces modern ref patterns
    "react-hooks/rules-of-hooks": "error", // Enforces valid hook calls
    "react-hooks/exhaustive-deps": "warn", // Validates dependency arrays

    // === Module Resolution & Import Control ===
    "import/no-cycle": "error", // Prevents circular dependencies (kills library bundle trees)
    "import/no-duplicates": "error", // Merges identical imports
    "import/no-self-import": "error", // Self-explanatory

    // === General Code Health (Unicorn) ===
    "unicorn/no-instanceof-array": "error", // Force Array.isArray over instanceof
    "unicorn/prefer-includes": "error", // Cleaner modern JS syntax
  },

  // Strip test/dev configs from stricter library rules
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      rules: {
        "typescript/no-explicit-any": "off", // Lax type checks for testing mock data
        "typescript/no-unused-vars": "warn",
      },
    },
  ],
});
