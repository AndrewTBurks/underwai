# Join workflow fixes + per-app concurrency

## Context

The join (parallel merge) demo has three user-visible defects and one missing feature:

1. **Render order is wrong.** The consumer-view cards walk `state.nodes` in Map insertion order, which is DFS from the builder. For the join workflow the panel shows `render` before `fetchAvatar` because `render` was appended last in the builder chain. The user reads top-to-bottom and expects the visual order to follow the DAG: parallel branches at the same level, with their parent above and their join child below.

2. **Graph edge routing is messy for fan-in.** The graph layout draws straight lines from every source to its target. When two parallel branches converge at a join, the two incoming edges overlap into the join node's left side. The graph should distinguish the fan-in visually so the reader can see the diamond shape.

3. **No runtime concurrency.** The runtime loop in `packages/runner/src/runtime.ts` processes ready nodes strictly sequentially via `for (const key of ready) { yield* program(...) }`. The `findReadyNodesLocal` helper returns a batch, but the inner loop awaits each program before starting the next. For the join workflow, `fetchAvatar` and `fetchProfile` are both ready after `trigger` resolves, but they run one after the other. The wall-clock runtime is the sum, not the max.

4. **The app attaching the runner has no knob for concurrency.** Today the app calls `rt.run({ state })` with no way to say "I want up to N parallel programs." The user is asking for this knob to be part of the public API, so different apps can pick a tolerance.

The runtime is a single-fiber Effect, so "concurrency" here means: within a single ready wave, run up to N programs in parallel using `Effect.forEach` with `{ concurrency: N }`, then commit the state transitions in a batch. The wall-clock for a fan-out branch becomes the slowest sibling rather than the sum.

## Scope

**In scope:**
- The four numbered items above.
- Tests that prove each fix on the real surface (the join demo in the browser).
- Updates to the public type signature for `RunOptions` and the `WorkflowRuntime` service.

**Explicitly out:**
- Rewriting the Effect-runtime fiber model. Concurrency stays within a single ready wave; the outer `while` loop still drives ready-set recomputation.
- Changing the builder's `join()` semantics. The join builder already produces the right edges; the rendering and scheduling layers are where the fixes land.
- Adding a new transport. The concurrency knob is a runtime option, not an SSE/WS protocol field.
- Cross-package rewrites of unrelated demos. Only the join demo needs a re-render; linear pipeline and human-in-the-loop keep their current order (DFS = topological for a chain, so the fix is a no-op for them).

## Constraints

- The runtime must remain deterministic. A re-run of the same workflow with the same `RunOptions` must produce the same final state in the same order. `Effect.forEach` with `{ concurrency: N }` preserves the input array's order, so the ordering guarantee holds as long as we commit in `forEach` output order, not fiber-completion order.
- `currentKey` (the single-key global used by `publish()`) must become a per-fiber map, or the `publish()` path needs to know which node each fiber is working on. Cleanest: pass the key into the per-node effect scope.
- The `RunOptions` type is part of the public API. Adding a field is backwards-compatible; removing or renaming one is not.
- The graph layout's straight-line edges are correct for the linear pipeline; the fix should only change rendering when an edge is part of a fan-in (multiple incoming edges to the same target).

## Alternatives

**Render order — three options:**

(a) Stable topological sort by DAG level. Group nodes by longest-path-from-root, sort each level by `node.id`. The join panel then reads: `trigger`, then `fetchAvatar` + `fetchProfile` side by side, then `validateAvatar` + `validateProfile` side by side, then `merge`, then `render`. This matches the graph exactly. *(Recommended.)*

(b) Keep insertion order, just reorder the `joinAvatarDefs` so the avatar branch is added before the profile branch in `setup()`. Hacky; depends on the demo, not the renderer.

(c) Add a `topologicalOrder` field to `WorkflowState` computed at `init()` time. Stored, not derived. Extra invariant; the runner would need to keep it in sync on every mutation. More code for the same result.

**Graph fan-in — three options:**

(a) Curve the incoming edges into the join node. Two edges from different sources to the same target get different control points (one bends up, one bends down) so they don't overlap. *(Recommended.)*

(b) Use a single merge dot on the left of the join node and draw the two edges to the dot. Visually clean but adds a new glyph.

(c) Leave straight lines, add a "fan-in count" badge. Communicates the structure without changing the line.

**Concurrency — two options:**

(a) Add `maxConcurrent?: number` to `RunOptions`. The inner loop becomes `Effect.forEach(ready, (key) => program(key), { concurrency: maxConcurrent ?? 1 })`. The default of 1 preserves the current sequential behavior. *(Recommended.)*

(b) Add a `concurrency: "sequential" | "parallel"` string. Less expressive, forces a binary choice; the number gives more control for free.

## Applicable skills

- **how** — over the runtime's `run()` loop and `findReadyNodesLocal` before changing them.
- **architect** — for the render-ordering change (touches `RenderedPanel`, the `useRows` hook, and the test file) before implementing.
- **interrogate** — for the concurrency knob's API shape (default value, behavior under `concurrency: 0`, behavior when `maxConcurrent > ready.length`).
- **deslop** — over each diff before commit.
- **unslop** — over this plan and any prose.
- **show-me-your-work** — keep a decision trail because the runtime change is non-trivial.

## Phases

1. [Phase 1: Stable topological render order](./phase-1-topological-render.md)
2. [Phase 2: Curved edges for graph fan-in](./phase-2-graph-fanin.md)
3. [Phase 3: Runtime concurrency knob + per-wave parallel execution](./phase-3-runtime-concurrency.md)
4. [Phase 4: App-level option wiring + tests for the new path](./phase-4-app-option.md)
5. [Testing & verification](./testing.md)

## Verification

- `pnpm -r typecheck`
- `pnpm test`
- `pnpm lint` (must be 0 errors)
- Browser visual: load the join demo, click Run, confirm the panel and graph match the diamond shape, confirm `fetchAvatar` and `fetchProfile` run concurrently (event log shows both `running` events before either `resolved`).

## Implementation guidance

The implementer must apply:

- **principle-foundational-thinking** — the runtime's `currentKey` global is the wrong data shape; replace it with a per-fiber key map. The renderer's `useRows` hook is reading from the wrong source (`state.nodes` insertion order); the right source is a derived `topologicalOrder` from the DAG.
- **principle-redesign-from-first-principles** — the `findReadyNodesLocal` + sequential `for...of` pattern was correct for a single-fiber runtime. With per-wave concurrency the right shape is `Effect.forEach` with `concurrency: N`, with the per-fiber state updates collected into a batched `Ref.update` so a single notify fires per wave rather than per fiber.
- **principle-type-system-discipline** — `RunOptions.maxConcurrent` should be a positive integer, branded or constrained. An `as`-cast or `Math.max(1, n)` guard at the boundary, not at every call site.
- **principle-experience-first** — the panel and graph should match the user's mental model (diamond = parallel branches). The concurrency knob's default should not change the linear pipeline's behavior.
- **principle-prove-it-works** — visual verification in the browser is the only way to confirm the render order and graph layout. Type-check is necessary but not sufficient.
- **principle-laziness-protocol** — the render-order fix is a 5-line change in `useRows`. The graph-curve fix is one helper. The concurrency fix touches the inner loop and `currentKey` but nothing else. Don't add abstractions.
