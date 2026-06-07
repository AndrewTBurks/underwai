---
task: TASK-P
status: cancelled
cancellation_reason: cut from v1 per 2026-06-06 review
source: interrogate-2026-06-06
severity: warning
finding_refs: [D2]
decision_required: false
---

# TASK-P: Batched subscription — CANCELLED

**Status: cut from v1. Replaced by a one-line note in the subscription section of `docs/design.md` describing the v1 batching story for the reference React adapter and the wall-display.**

## Cancellation reason

A `{ batched: true }` option on `subscribe` and `subscribeAll` would change the `onUpdate` callback shape (one `Node` vs. `ReadonlyArray<Node>`). That's a real reader-load cost for a feature with no current consumer. The review found three reasons to cut:

1. The current v1 target is ThreadWeaver + a reference React adapter. React's `setState` is already batched, so a parallel `all` with 50 nodes triggers 50 `setState` calls inside one microtask, which React collapses. The reference renderer doesn't need a lib-level batch option.

2. The wall-display case (the consumer TASK-P named as the primary beneficiary) is the same consumer that TASK-D's `subscribeAll` is being built for. The wall-display's renderer can debounce in five lines inside its own `useEffect` / setInterval cycle. A lib-level flag is overkill.

3. The batched-option shape overlaps with the delta-option shape in TASK-V (both exist to suppress re-render noise). v1 has no `SubscribeDelta` union; the simpler `(node: Node) => void` is the only callback shape. Adding a `batched: true` that *changes* the callback shape is a new surface the lib then has to maintain forever.

## What replaces this plan in v1

A single sentence in the subscription section of `docs/design.md`:

```
For the wall-display case, debounce inside the renderer. The lib's
contract is "one callback per node update." A renderer that wants
"one callback per frame" buffers updates in its own subscriber.
```

No new API. No `batched` option. No test beyond what TASK-D's `subscribeAll` test already covers.

## Verification of cancellation

- `src/stub.ts` does *not* add `batched?: boolean` to `SubscribeOptions`.
- `docs/design.md` subscription section has the one-line batching note.
- TASK-V is also cut (see `/Users/andrew/.cns/plans/TASK-V.md` for the matching cancellation).

## Source finding (preserved for context)

The original D2 finding from `interrogate-2026-06-06` is preserved below for the project log.

> **D2. [warning] The `subscribe` callback gets called once per node update, but a render frame might want batched updates**
>
> *Location*: `docs/design.md` line ~340
>
> *Finding*: if 50 nodes all transition from `ready` to `running` to `resolved` in the same step (a parallel `all`), the `onUpdate` callback fires 150 times. The renderer's `setState` is called 150 times in a tight loop. React would batch these, but a different framework might not.
>
> *Evidence*: the design says "the consumer re-renders on every status change." For a parallel fan-out, this is 3× the work per node.
>
> *Suggestion*: provide a batched subscription option. ... (rejected; see cancellation reason above)

## Session state

*(cancelled; no design session held)*
