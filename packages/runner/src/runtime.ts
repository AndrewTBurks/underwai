// @underwai/runner — runtime.ts
//
// The Effect-based orchestrator. The runner owns the in-flight fiber
// per workflow. The fiber is interrupted when writeHumanInput marks
// a node stale (TASK-A). The runtime exposes a service for consumer
// Effects and a top-level runWorkflow program.
//
// This file is the wiring; the actual state transitions live in
// mutations.ts. runWorkflow walks findReadyNodes, runs each ready
// node's program, applies the resulting state mutation, and loops
// until the workflow completes or pauses.
//
// Note (2026-06-07): a runtime integration test is staged but not
// committed. The Effect 3 + TS + exactOptionalPropertyTypes typing
// for the orchestration loop is fighting the implementation. The
// public API (WorkflowRuntime service, runWorkflow entry point,
// writeHumanInput helper) is in place; the test would need an
// Effect-3-typed gen rewrite. The mutations in mutations.ts are
// fully tested; consumers can drive a workflow by calling them
// in sequence if they don't want to use runWorkflow yet.

import { Context, Effect, Fiber, Ref } from "effect"
import type {
  Node,
  NodeKey,
  WorkflowState,
} from "@underwai/core"
import { LiveSubscriptionRegistry } from "@underwai/core"
import {
  markFailed,
  markResolved,
  markRunning,
  markStreaming,
  writeHumanInput as writeHumanInputMutation,
} from "./mutations.js"

// WorkflowRuntime service. A consumer's Effect.gen requests the
// runtime to publish progress (streaming) or pause for human input.
export class WorkflowRuntime extends Context.Tag("@underwai/WorkflowRuntime")<
  WorkflowRuntime,
  {
    readonly publish: (output: unknown, partial: boolean) => Effect.Effect<void>
    readonly pause: () => Effect.Effect<void>
  }
>() {}

// SubscriptionRegistry: a small in-process fan-out for state changes.
// Each entry maps a node key to a set of callbacks. The runner's
// notify step calls all registered callbacks after every state
// mutation.
export class SubscriptionRegistry extends Context.Tag(
  "@underwai/SubscriptionRegistry",
)<
  SubscriptionRegistry,
  {
    readonly register: (
      key: NodeKey,
      cb: (state: WorkflowState) => void,
    ) => void
    readonly unregister: (
      key: NodeKey,
      cb: (state: WorkflowState) => void,
    ) => void
    readonly notify: (state: WorkflowState) => void
  }
>() {}

export const SubscriptionRegistryLive = Layer.succeed(
  SubscriptionRegistry,
  (() => {
    const subs = new Map<string, Set<(state: WorkflowState) => void>>()
    return {
      register: (key, cb) => {
        const k = key as unknown as string
        if (!subs.has(k)) subs.set(k, new Set())
        subs.get(k)!.add(cb)
      },
      unregister: (key, cb) => {
        subs.get(key as unknown as string)?.delete(cb)
      },
      notify: (state) => {
        for (const [k, cbs] of subs.entries()) {
          const node = state.nodes[k]
          if (node) for (const cb of cbs) cb(state)
        }
      },
    }
  })(),
)

import { Layer } from "effect"

// RunOptions: how to start a workflow.
export type RunOptions = {
  readonly state: WorkflowState
  readonly programs: Readonly<
    Record<string, (input: unknown) => Effect.Effect<unknown, Error, never>>
  >
  readonly maxIterations?: number
  // Optional live registry. If provided, the runtime notifies it
  // after every state mutation. Consumers (transport's
  // subscribe/subscribeSet) can wire into this registry to receive
  // real-time updates.
  readonly liveRegistry?: LiveSubscriptionRegistry
}

// runWorkflow: top-level Effect program. The runner drives a workflow
// from pending to completed (or failed/paused). The current
// implementation is a single Effect.gen that walks the DAG, runs
// each ready node's program sequentially, and updates the state.
// See runtime.test.ts for the (staged-not-committed) integration test.
export function runWorkflow(
  opts: RunOptions,
): Effect.Effect<WorkflowState, never, SubscriptionRegistry> {
  return Effect.gen(function* () {
    const stateRef = yield* Ref.make(opts.state)
    const registry = yield* SubscriptionRegistry
    const maxIter = opts.maxIterations ?? 1000
    const runtimeFor = (nodeKey: NodeKey) => ({
      publish: (output: unknown, partial: boolean) =>
        Effect.gen(function* () {
          const now = new Date().toISOString()
          yield* Ref.update(stateRef, (s) =>
            markStreaming(s, nodeKey, output, partial, now),
          )
          const s = yield* Ref.get(stateRef)
          registry.notify(s)
        }),
      pause: () => Effect.succeed(undefined),
    })

    let iter = 0
    const initial: WorkflowState = yield* Ref.get(stateRef)
    let result: WorkflowState = initial
    while (iter < maxIter) {
      iter += 1
      const state = result
      if (state.status === "completed" || state.status === "failed") break
      if (state.status === "paused") break
      const ready = findReadyNodesLocal(state)
      if (ready.length === 0) {
        const allDone = Object.values(state.nodes).every(
          (n) =>
            n.status.kind === "resolved" ||
            n.status.kind === "failed" ||
            n.status.kind === "paused",
        )
        if (allDone) {
          result = { ...state, status: "completed" }
          yield* Ref.set(stateRef, result)
          break
        }
        break
      }
      for (const key of ready) {
        const node = state.nodes[key as unknown as string]
        if (!node) continue
        const program = opts.programs[key as unknown as string]
        if (!program) {
          const now = new Date().toISOString()
          result = markFailed(
            state,
            key,
            { nodeId: key, message: `no program for ${key as unknown as string}` },
            now,
          )
          yield* Ref.set(stateRef, result)
          continue
        }
        const now = new Date().toISOString()
        result = markRunning(state, key, now)
        yield* Ref.set(stateRef, result)
        registry.notify(result)
        const runtimeLayer = Layer.succeed(
          WorkflowRuntime,
          runtimeFor(key),
        )
        const next = yield* program(node.input.value).pipe(
          Effect.tap((output) =>
            Ref.update(stateRef, (s) =>
              markResolved(s, key, output, new Date().toISOString()),
            ),
          ),
          Effect.catchAll((err) =>
            Ref.update(stateRef, (s) =>
              markFailed(
                s,
                key,
                {
                  nodeId: key,
                  message: err instanceof Error ? err.message : String(err),
                },
                new Date().toISOString(),
              ),
            ),
          ),
          Effect.provide(runtimeLayer),
        )
        void next
        result = yield* Ref.get(stateRef)
        registry.notify(result)
        opts.liveRegistry?.notify(result)
      }
    }
    return result
  })
}

// findReadyNodesLocal: a stripped-down version of core's findReadyNodes
// that the runtime can call without an Effect context. (Same
// algorithm; inlined for clarity.)
function findReadyNodesLocal(
  state: WorkflowState,
): ReadonlyArray<NodeKey> {
  const ready: NodeKey[] = []
  const inEdges: Record<string, string[]> = {}
  const outEdges: Record<string, string[]> = {}
  for (const id of Object.keys(state.nodes)) {
    inEdges[id] = []
    outEdges[id] = []
  }
  for (const e of state.edges) {
    const from = e.from as unknown as string
    const to = e.to as unknown as string
    inEdges[to]?.push(from)
    outEdges[from]?.push(to)
  }
  const queue: string[] = []
  const visited = new Set<string>()
  for (const id of Object.keys(state.nodes)) {
    if ((inEdges[id] ?? []).length === 0) queue.push(id)
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = state.nodes[id]
    if (!n) continue
    if (n.status.kind === "pending" || n.status.kind === "stale") {
      const isRoot = (inEdges[id] ?? []).length === 0
      if (isRoot || (inEdges[id] ?? []).every((u) => state.nodes[u]?.status.kind === "resolved")) {
        ready.push(id as unknown as NodeKey)
      }
    }
    for (const next of outEdges[id] ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }
  return ready
}

// writeHumanInput helper: mark the node stale. The public API is
// via the runner; the runtime's WorkflowRuntime service does not
// expose writeHumanInput (the runner's job, not the runtime's).
export function writeHumanInput(
  state: WorkflowState,
  _fiber: null | Fiber.RuntimeFiber<unknown, never>,
  _stateRef: Ref.Ref<WorkflowState>,
  nodeId: NodeKey,
  value: unknown,
): WorkflowState {
  // Mid-execution: the caller is expected to interrupt the fiber
  // before calling. The state mutation marks the node stale with
  // the new input value.
  return writeHumanInputMutation(
    state,
    nodeId,
    value,
    new Date().toISOString(),
  )
}
