// @underwai/schema public entry point.
//
// The canonical API is the named import:
//
//   import { z } from "zod"
//   import { human, getHumanMode } from "@underwai/schema"
//   const s = human(z.string())  // -> HumanSchema<ZodString>
//
// We do NOT mutate zod's z namespace. Zod 3 freezes the namespace
// object (Object.isFrozen(z) === true), so the standard zod-
// extension pattern (zod-prisma, tRPC) doesn't work without
// forks. The named import is the canonical spelling; this matches
// the principle "minimal API surface" — no surprise mutations of
// the consumer's z object.

export { human, getHumanMode } from "./human.js"
export type { HumanMode, HumanSchema } from "./human.js"
