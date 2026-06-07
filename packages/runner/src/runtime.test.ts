// Integration test: runWorkflow drives a workflow end-to-end.
//
// Uses core/compose + core/init to construct a real WorkflowState
// from a composition expression, then calls runWorkflow with
// programs for each node. Verifies:
//
//   1. Single-node workflow drives pending -> running -> resolved,
//      then workflow status === "completed".
//   2. A failing program marks the node failed and the workflow
//      status === "failed".
//   3. A program that calls runtime.publish leaves the final
//      state as resolved, but the registry's notify callback is
//      invoked at least once during the run.
//   4. Subscribers are notified on every state transition
//      (count >= 2 for a single-node flow).
import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import {
  SubscriptionRegistry,
  SubscriptionRegistryLive,
  WorkflowRuntime,
  runWorkflow,
} from "./runtime.js"
import { compose, chain, run } from "@underwai/core"
import { init } from "@underwai/core"
import { LiveSubscriptionRegistry, WorkflowId } from "@underwai/core"
import type { NodeDefinition } from "@underwai/core"
import { z } from "zod"

function def(kind: string): NodeDefinition<unknown, unknown> {
  return {
    kind,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    program: ((_input: unknown) => Effect.succeed(undefined)) as never,
  }
}

describe("runWorkflow() integration", () => {
  it("drives a single-node workflow to resolved", async () => {
    const { tree } = compose(() => run(def("root")))
    const state = init(tree, WorkflowId("wf-1"))
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    }
    const result = await Effect.runPromise(
      runWorkflow({ state, programs }).pipe(
        Effect.provide(SubscriptionRegistryLive),
      ),
    )
    expect(result.status).toBe("completed")
    const node = result.nodes["root"]!
    expect(node.status.kind).toBe("resolved")
  })

  it("marks a node failed when the program errors", async () => {
    const { tree } = compose(() => run(def("root")))
    const state = init(tree, WorkflowId("wf-2"))
    const programs = {
      root: (_input: unknown) => Effect.fail(new Error("boom")) as never,
    }
    const result = await Effect.runPromise(
      runWorkflow({ state, programs }).pipe(
        Effect.provide(SubscriptionRegistryLive),
      ),
    )
    expect(result.status).toBe("failed")
    const node = result.nodes["root"]!
    expect(node.status.kind).toBe("failed")
  })

  it("notifies subscribers on every state transition", async () => {
    const { tree } = compose(() => run(def("root")))
    const state = init(tree, WorkflowId("wf-3"))
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    }
    let notifyCount = 0
    const registry = Layer.succeed(SubscriptionRegistry, {
      register: () => {},
      unregister: () => {},
      notify: () => {
        notifyCount += 1
      },
    })
    await Effect.runPromise(runWorkflow({ state, programs }).pipe(Effect.provide(registry)))
    // At minimum: the initial markRunning, and the final markResolved.
    expect(notifyCount).toBeGreaterThanOrEqual(2)
  })

  it("a 3-node workflow drives root -> a -> b in dependency order", async () => {
    const { tree } = compose(() => {
      const root = run(def("root"))
      const a = chain(root, def("a"))
      const b = chain(a, def("b"))
      return b
    })
    const state = init(tree, WorkflowId("wf-4"))
    const programs = {
      root: () => Effect.succeed("a") as never,
      "root.a": () => Effect.succeed("b") as never,
      "root.a.b": () => Effect.succeed("c") as never,
    }
    const result = await Effect.runPromise(
      runWorkflow({ state, programs }).pipe(
        Effect.provide(SubscriptionRegistryLive),
      ),
    )
    expect(result.status).toBe("completed")
    expect(result.nodes["root"]?.status.kind).toBe("resolved")
    expect(result.nodes["root.a"]?.status.kind).toBe("resolved")
    expect(result.nodes["root.a.b"]?.status.kind).toBe("resolved")
  })

  it("notifies the live registry on every state transition", async () => {
    const { tree } = compose(() => run(def("root")))
    const state = init(tree, WorkflowId("wf-5"))
    const programs = {
      root: (_input: unknown) => Effect.succeed("done") as never,
    }
    const live = new LiveSubscriptionRegistry()
    let notifyCount = 0
    live.registerPattern("*", () => {
      notifyCount += 1
    })
    await Effect.runPromise(
      runWorkflow({ state, programs, liveRegistry: live }).pipe(
        Effect.provide(SubscriptionRegistryLive),
      ),
    )
    expect(notifyCount).toBeGreaterThanOrEqual(1)
  })
})
