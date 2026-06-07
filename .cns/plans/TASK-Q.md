---
task: TASK-Q
status: resolved
source: interrogate-2026-06-06
severity: warning
finding_refs: [D7]
decision_required: false
---

# TASK-Q: Stale UX reference behavior

## Source finding

> **D7. [warning] The `stale` status has no prescribed renderer behavior**
>
> *Location*: `docs/design.md` state machine
>
> *Finding*: `stale` is a real node status, but the design says "what the renderer shows for it is the renderer's call. The lib doesn't ship a 're-deriving...' component." That's a non-decision.
>
> *Evidence*: the design's "Open questions for v1.1+" section explicitly says "Renderer-supplied `stale` UX... is the renderer's call."
>
> *Suggestion*: provide *one* reference behavior in the docs. A reasonable default: "when a node is `stale`, the renderer shows the previous `output` or `finalOutput` with a 're-deriving' indicator. When the new value arrives, the indicator is replaced with the new value." This is the wall-display's natural behavior. Document it as the suggested default; renderers can override.

## Problem statement

`stale` is a real node status. The design punts on the renderer behavior. Without a reference, every consumer reinvents the wheel.

## Recommendation

**Document one reference behavior: "show previous output with 're-deriving' indicator; replace when new value arrives."**

```markdown
## Stale UX (reference)

When a node's status is `stale`:
- The renderer shows the previous `output` (if streaming) or `finalOutput` (if resolved) with a "re-deriving" indicator.
- When the new value arrives, the indicator is replaced with the new value.
- If the node was `paused` (verified gate), the renderer shows the pause UI; the staleness doesn't override the pause.

This is the suggested default. Renderers can override (e.g., some renderers might want to hide stale nodes entirely).
```

The wall-display's natural behavior is this default. The chat-embedded case might want different UX (e.g., gray out the stale value entirely), but that's a v1.1 renderer-supplied option.

## What "done" looks like

### Patches

1. **`docs/design.md`** — runtime or subscription section. Add a "Stale UX (reference)" subsection. State the rule.

### Verification

- `tsc --noEmit` exit 0.
- `docs/design.md` has a "Stale UX (reference)" subsection.

## Session state

**2026-06-06 — resolved (doc-only).** Documented the reference behavior for stale UX: a `stale` node shows its previous output with a "re-deriving" indicator. This is one reference, not a lib mandate — the lib's contract is the state machine, not the UI. Patch: `docs/design.md` runtime section gains a "Stale UX reference behavior" paragraph.
