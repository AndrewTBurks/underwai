// Type-level test for the data structure. The contract is that
// `Node["status"]` is a discriminated union, and per-status data
// lives on the variants that own it. We assert the discriminant and
// the per-variant field shapes via the type system.
import { describe, expectTypeOf, it } from "vitest"
import type { Node, NodeStatus } from "./types.js"

describe("Node['status']", () => {
  it("is a discriminated union with kind as the discriminant", () => {
    type Kinds = NodeStatus["kind"]
    expectTypeOf<Kinds>().toEqualTypeOf<
      "pending" | "running" | "streaming" | "resolved" | "failed" | "paused" | "stale"
    >()
  })

  it("running variant carries startedAt", () => {
    type S = Extract<NodeStatus, { kind: "running" }>
    expectTypeOf<S["startedAt"]>().toEqualTypeOf<string>()
  })

  it("streaming variant carries output and outputPartial", () => {
    type S = Extract<NodeStatus, { kind: "streaming" }>
    expectTypeOf<S["output"]>().toEqualTypeOf<unknown>()
    expectTypeOf<S["outputPartial"]>().toEqualTypeOf<boolean>()
  })

  it("resolved variant carries finalOutput and resolvedAt", () => {
    type S = Extract<NodeStatus, { kind: "resolved" }>
    expectTypeOf<S["finalOutput"]>().toEqualTypeOf<unknown>()
    expectTypeOf<S["resolvedAt"]>().toEqualTypeOf<string>()
  })

  it("failed variant carries error and failedAt", () => {
    type S = Extract<NodeStatus, { kind: "failed" }>
    type E = S["error"]
    expectTypeOf<E["nodeId"]>().toEqualTypeOf<import("./keys.js").NodeKey>()
    expectTypeOf<S["failedAt"]>().toEqualTypeOf<string>()
  })

  it("paused variant carries pausedAt", () => {
    type S = Extract<NodeStatus, { kind: "paused" }>
    expectTypeOf<S["pausedAt"]>().toEqualTypeOf<string>()
  })

  it("stale variant carries optional previousOutput", () => {
    type S = Extract<NodeStatus, { kind: "stale" }>
    expectTypeOf<S["previousOutput"]>().toEqualTypeOf<unknown | undefined>()
  })

  it("pending variant carries no extra fields", () => {
    type S = Extract<NodeStatus, { kind: "pending" }>
    expectTypeOf<keyof S>().toEqualTypeOf<"kind">()
  })
})

describe("Node", () => {
  it("has shared fields plus a status discriminant", () => {
    type K = keyof Node
    expectTypeOf<K>().toMatchTypeOf<
      "id" | "kind" | "label" | "inputSchema" | "input" | "outputSchema" | "status" | "actor" | "createdAt" | "updatedAt"
    >()
  })
})
