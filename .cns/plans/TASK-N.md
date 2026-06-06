---
task: TASK-N
status: pending
source: interrogate-2026-06-06
severity: warning
finding_refs: [B6]
decision_required: false
---

# TASK-N: Effect buy-in as a documented limitation

## Source finding

> **B6. [warning] The Effect buy-in is total — there's no plain-async escape hatch**
>
> *Location*: `docs/design.md` line ~414
>
> *Finding*: the consumer *must* write `Effect.Effect<TOutput, TError, TRequirements>` programs. The design says "the whole pitch is Effect. A plain-async adapter would be a contradiction." But this means a consumer who doesn't know Effect can't use the lib. The "optional Effect" framing was rejected, but that means the lib's addressable market is "TypeScript developers who already use Effect."
>
> *Evidence*: the design's "Tradeoffs accepted" section says "we accept that the consumer's program has to be Effect in exchange for the lib's composition story being Effect's composition story." This is a deliberate bet. But the design doc should *acknowledge* that this is a constraint, not just a tradeoff.
>
> *Suggestion*: add a "Limitations" section to the design doc that explicitly says: "Effect is required. There is no plain-async or plain-promise adapter. Consumers must learn Effect's composition primitives (`Effect.gen`, `Effect.tryPromise`, etc.) to use the lib." This is a deliberate choice, not an oversight; it should be documented as a constraint.

## Problem statement

The consumer must write `Effect.Effect<TOutput, TError, TRequirements>` programs. This is a deliberate bet (the lib's whole composition story is Effect's composition story), but it's a real constraint. The design doc mentions it in the "Tradeoffs accepted" section as a tradeoff; it should also be a "Limitations" section that says "this is the constraint, accept it or don't use the lib."

## Recommendation

**Add a "Limitations" section to the design doc.**

```markdown
## Limitations

The following are deliberate constraints of the v1 design, not oversights:

- **Effect is required.** The consumer's program must be an `Effect.Effect<TOutput, TError, TRequirements>`. There is no plain-async or plain-promise adapter. Consumers must learn Effect's composition primitives (`Effect.gen`, `Effect.tryPromise`, etc.) to use the lib. This is a deliberate bet: the lib's composition story is Effect's composition story, and a plain-async adapter would be a contradiction.

- **Zod is required.** The lib validates inputs and outputs against Zod schemas. There is no plain-type or other-schema adapter. Consumers must use Zod (3.x for v1; 4.x is a v1.1+ consideration).

- **The composition API is the only way to create nodes.** Consumers cannot add a node to the workflow by hand outside the composition API. The composition expression *is* the definition. This is what makes keys carry real type information.

- **The consumer must learn the lib's state machine.** `paused`, `stale`, `ready`, `running`, `streaming`, `resolved` are not optional. A consumer who wants to write a renderer or a transport must understand the state machine.
```

## What "done" looks like

### Patches

1. **`docs/design.md`** — add a "Limitations" section before the "Tradeoffs accepted" section. The "Limitations" section says "these are deliberate constraints, not oversights." The "Tradeoffs" section stays as the cost-benefit analysis.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` has a "Limitations" section.

## Session state

*(to be filled in during the design session)*
