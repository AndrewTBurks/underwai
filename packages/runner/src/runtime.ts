// @underwai/runner — runtime.ts
//
// The WorkflowRuntime service: owns the workflow state, exposes
// { run, publish, write, writeHumanInput, getState, subscribe }.
// Programs use publish to surface partial output. The workflow
// owner uses write / writeHumanInput to inject values from
// outside the program.
import { Context, Effect, Layer, Ref } from "effect";
import type { NodeKey, WorkflowState, LiveSubscriptionRegistry } from "@underwai/core";
import { resolveInput } from "@underwai/core";
import {
  markFailed,
  markResolved,
  markRunning,
  markStreaming,
  writeHumanInput as writeHumanInputMutation,
} from "./mutations.js";

// WorkflowRuntime service interface.
export interface WorkflowRuntimeShape {
  readonly run: (opts: RunOptions) => Effect.Effect<WorkflowState>;
  readonly publish: (output: unknown, partial: boolean) => Effect.Effect<WorkflowState>;
  readonly write: (key: NodeKey, value: unknown) => Effect.Effect<WorkflowState>;
  readonly writeHumanInput: (key: NodeKey, value: unknown) => Effect.Effect<WorkflowState>;
  readonly getState: () => Effect.Effect<WorkflowState>;
  readonly subscribe: (cb: (state: WorkflowState) => void) => Effect.Effect<void>;
}

// WorkflowRuntime Context.Tag. Identified by the underwai/ prefix
// in the runtime's effect graph.
export class WorkflowRuntime extends Context.Tag("@underwai/WorkflowRuntime")<
  WorkflowRuntime,
  WorkflowRuntimeShape
>() {}

// RunOptions: how to start a workflow.
export type RunOptions = {
  readonly state: WorkflowState;
  readonly programs: Readonly<Record<string, (input: unknown) => Effect.Effect<unknown, Error>>>;
  readonly maxIterations?: number;
  readonly liveRegistry?: LiveSubscriptionRegistry;
};

// WorkflowRuntimeLive: a Layer that constructs a fresh
// WorkflowRuntime service. Each call creates a new service with
// its own stateRef.
//
// Usage:
//   const program = Effect.gen(function*() {
//     const rt = yield* WorkflowRuntime
//     const final = yield* rt.run({ state, programs })
//   }).pipe(Effect.provide(WorkflowRuntimeLive({ state, programs })))
export const WorkflowRuntimeLive = (initialOpts: RunOptions): Layer.Layer<WorkflowRuntime> =>
  Layer.effect(
    WorkflowRuntime,
    Effect.gen(function* () {
      const stateRef = yield* Ref.make<WorkflowState>(initialOpts.state);
      const subs = new Set<(state: WorkflowState) => void>();

      const notify = (state: WorkflowState) => {
        for (const cb of subs) cb(state);
        initialOpts.liveRegistry?.notify(state);
      };

      const service: WorkflowRuntimeShape = {
        getState: () => Ref.get(stateRef),

        subscribe: (cb) =>
          Effect.sync(() => {
            subs.add(cb);
          }),

        publish: (output, partial) =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef);
            const key = currentKey;
            if (!key) return s;
            const next = markStreaming(s, key, output, partial, new Date().toISOString());
            yield* Ref.set(stateRef, next);
            notify(next);
            return next;
          }),

        write: (key, value) =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef);
            const next = markResolved(s, key, value, new Date().toISOString());
            yield* Ref.set(stateRef, next);
            notify(next);
            return next;
          }),

        writeHumanInput: (key, value) =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef);
            const next = writeHumanInputMutation(s, key, value, new Date().toISOString());
            yield* Ref.set(stateRef, next);
            notify(next);
            return next;
          }),

        run: (opts) =>
          Effect.gen(function* () {
            const initial = yield* Ref.get(stateRef);
            void opts;
            const maxIter = opts.maxIterations ?? 1000;

            currentKey = null;

            let iter = 0;
            let result = initial;
            while (iter < maxIter) {
              iter += 1;
              const state = result;
              if (state.status === "completed" || state.status === "failed") {
                break;
              }
              const ready = findReadyNodesLocal(state);
              if (ready.length === 0) {
                const allDone = Object.values(state.nodes).every(
                  (n) => n.status.kind === "resolved" || n.status.kind === "failed",
                );
                if (allDone) {
                  result = { ...state, status: "completed" };
                  yield* Ref.set(stateRef, result);
                  notify(result);
                  break;
                }
                break;
              }
              for (const key of ready) {
                const node = state.nodes[key as unknown as string];
                if (!node) continue;
                const program = opts.programs[key as unknown as string];
                if (!program) {
                  const now = new Date().toISOString();
                  result = markFailed(
                    state,
                    key,
                    {
                      nodeId: key,
                      message: `no program for ${key as unknown as string}`,
                    },
                    now,
                  );
                  yield* Ref.set(stateRef, result);
                  notify(result);
                  continue;
                }
                const now = new Date().toISOString();
                currentKey = key;
                result = markRunning(state, key, now);
                yield* Ref.set(stateRef, result);
                notify(result);

                const programResult = yield* program(
                  resolveInput(result, key) ?? node.input.value,
                ).pipe(
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
                );
                void programResult;
                result = yield* Ref.get(stateRef);
                notify(result);
                currentKey = null;
              }
            }
            return result;
          }),
      };

      return service;
    }),
  );

// currentKey: the node the runtime is currently executing. Set
// before each program call, cleared after. Used by publish() to
// know which node to mark streaming.
let currentKey: NodeKey | null = null;

// findReadyNodesLocal: a stripped-down version of core's
// findReadyNodes that the runtime can call without an Effect
// context. Same algorithm; inlined for clarity.
function findReadyNodesLocal(state: WorkflowState): ReadonlyArray<NodeKey> {
  const ready: NodeKey[] = [];
  const inEdges: Record<string, string[]> = {};
  const outEdges: Record<string, string[]> = {};
  for (const id of Object.keys(state.nodes)) {
    inEdges[id] = [];
    outEdges[id] = [];
  }
  for (const e of state.edges) {
    const from = e.from as unknown as string;
    const to = e.to as unknown as string;
    inEdges[to]?.push(from);
    outEdges[from]?.push(to);
  }
  const queue: string[] = [];
  const visited = new Set<string>();
  for (const id of Object.keys(state.nodes)) {
    if ((inEdges[id] ?? []).length === 0) queue.push(id);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const n = state.nodes[id];
    if (!n) continue;
    if (n.status.kind === "pending" || n.status.kind === "stale") {
      const isRoot = (inEdges[id] ?? []).length === 0;
      if (isRoot || (inEdges[id] ?? []).every((u) => state.nodes[u]?.status.kind === "resolved")) {
        ready.push(id as unknown as NodeKey);
      }
    }
    for (const next of outEdges[id] ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return ready;
}

// runWorkflow: convenience Effect. The service is the canonical
// API; this is a thin wrapper for the common case.
export function runWorkflow(
  opts: RunOptions,
): Effect.Effect<WorkflowState, never, WorkflowRuntime> {
  return Effect.gen(function* () {
    const rt = yield* WorkflowRuntime;
    return yield* rt.run(opts);
  });
}
