import { describe, expect, it } from "vitest"
import { z } from "zod"
import { getHumanMode, human } from "./human.js"

describe("human()", () => {
  it("attaches the writeable marker to _def at runtime", () => {
    const s = human(z.string())
    expect(getHumanMode(s)).toBe("writeable")
  })

  it("does not mutate the input schema's _def", () => {
    const input = z.string()
    human(input)
    expect(getHumanMode(input)).toBeUndefined()
  })

  it("preserves the input schema's parse behavior", () => {
    const s = human(z.string())
    expect(s.parse("hello")).toBe("hello")
    expect(() => s.parse(123)).toThrow()
  })
})

describe("verified()", () => {
  it("returns a schema with the verified marker", () => {
    const s = human(z.string()).verified()
    expect(getHumanMode(s)).toBe("verified")
  })

  it("does not mutate the input human schema", () => {
    const input = human(z.string())
    input.verified()
    expect(getHumanMode(input)).toBe("writeable")
  })

  it("preserves the input schema's parse behavior", () => {
    const s = human(z.string()).verified()
    expect(s.parse("hello")).toBe("hello")
  })
})

describe("getHumanMode()", () => {
  it("returns undefined for a plain Zod schema", () => {
    expect(getHumanMode(z.string())).toBeUndefined()
    expect(getHumanMode(z.number())).toBeUndefined()
    expect(getHumanMode(z.object({ x: z.number() }))).toBeUndefined()
  })

  it("returns 'writeable' for a human() wrapper", () => {
    expect(getHumanMode(human(z.string()))).toBe("writeable")
  })

  it("returns 'verified' for a verified() chain", () => {
    expect(getHumanMode(human(z.string()).verified())).toBe("verified")
  })

  it("works on nested ZodObject fields independently", () => {
    const schema = z.object({
      name: human(z.string()),
      age: z.number(),
      email: human(z.string()).verified(),
    })
    expect(getHumanMode(schema.shape.name)).toBe("writeable")
    expect(getHumanMode(schema.shape.age)).toBeUndefined()
    expect(getHumanMode(schema.shape.email)).toBe("verified")
  })
})
