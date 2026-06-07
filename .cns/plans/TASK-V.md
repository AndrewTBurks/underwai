---
task: TASK-V
status: cancelled
cancellation_reason: cut from v1 per 2026-06-06 review
source: interrogate-2026-06-06
severity: warning
finding_refs: [A5]
decision_required: false
---

# TASK-V: Delta-based subscription callback — CANCELLED

**Status: cut from v1. The default `(node: Node) => void` callback is the only v1 contract. Renderers that want to skip re-renders on irrelevant changes shallow-compare inside their callback.**

## Cancellation reason

A `delta?: boolean` option that swaps the callback shape from `(node) => void` to `(prev, next) => void` is a second option whose only job is to suppress re-render noise. The review found three reasons to cut:

1. v1 has one callback shape: `(node: Node) => void`. Adding a second shape (with a flag) is a branching contract a consumer has to read. The default shape is the only one to learn.

2. Renderers that need to skip re-renders on irrelevant changes (e.g., a status-only change when only `output` matters) can shallow-compare inside their callback: `if (prev.status === next.status && shallowEqual(prev.output, next.output)) return`. The lib doesn't need to know about this.

3. A richer `SubscribeDelta` union (the harder option the plan considered and rejected) is a *third* shape, with its own taxonomy of change kinds. That's an API the lib would have to design against, document, and extend every time a new field is added to `Node`. Wrong cost.

## What replaces this plan in v1

A single sentence in the subscription section of `docs/design.md`:

```
The callback receives the full updated Node. Renderers that want
to skip re-renders on irrelevant changes shallow-compare fields
they care about. The lib does not provide a delta API in v1.
```

No new option. No new type. No test.

## Verification of cancellation

- `src/stub.ts` does *not* add `delta?: boolean` to `SubscribeOptions`.
- `docs/design.md` subscription section has the one-line note above.
- TASK-P is also cut (see `/Users/andrew/.cns/plans/TASK-P.md` for the matching cancellation).

## Source finding (preserved for context)

> **A5. [warning] `subscribe` callback receives the full Node, but the consumer can't tell *what changed***
>
> *Location*: `docs/design.md` line ~340, `src/stub.ts` `subscribe`
>
> *Finding*: ... For a wall-display rendering 50 nodes, that's 50 re-renders per status transition.
>
> *Suggestion*: ... (rejected; see cancellation reason above)

## Session state

*(cancelled; no design session held)*
