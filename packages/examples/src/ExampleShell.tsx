// ExampleShell — the 3-area UI for every example.
//
//   left         = rendered UI (the consumer's view, including any human form)
//   right top    = graph topology (the DAG)
//   right bottom = event log (the WorkflowEvent trail)
//
// One shell, one runtime, one subscription. The shell takes a
// `Demo` object (built tree + setup + display metadata) and
// drives the workflow through Effect. Runs are user-initiated
// only — switching demos or mounting does not auto-run.
//
// When the runtime pauses on a human-marked node, the panel
// surfaces a form generated from the node's schema. The form
// is the consumer's input to the workflow — its emphasis is
// intentional.

import { useEffect, useMemo, useRef, useState } from "react";
import { Effect } from "effect";
import {
  type NodeKey as NodeKeyT,
  type TypedTree,
  type WorkflowState,
} from "@underwai/core";
import { WorkflowRuntime, WorkflowRuntimeLive } from "@underwai/runner";
import type { WorkflowEvent } from "@underwai/transport";
import { Graph } from "./Graph.js";
import { EventLog, capture } from "./EventLog.js";
import { RenderedPanel } from "./RenderedPanel.js";
import { StatusPill } from "./StatusPill.js";
import { allDemos } from "./workflows.js";

const allDemosList = allDemos;

// Demo metadata: the data the shell needs to run an example.
// The Demo is generic on the typed tree's path map so the
// view() call site narrows the leaf's output type.
export type Demo<PathMap extends Record<string, unknown> = Record<string, unknown>> = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly built: TypedTree<string, PathMap>;
  readonly setup: () => WorkflowState;
  readonly leafKey: keyof PathMap & string;
  // panel: "input" demos have a text input that writes the
  // typed value to a node (typically the root) before run.
  // "none" demos take no input from the panel — the form is
  // the input (for human-in-the-loop) or the workflow runs
  // from defaults.
  readonly panel:
    | { kind: "input"; label: string; default: string; writeTo: NodeKeyT }
    | { kind: "none" };
  // maxConcurrent: cap on parallel in-flight programs for
  // this demo. Default 1 (sequential) preserves the
  // original behavior. A value > 1 lets ready siblings
  // dispatch in parallel; the runtime's event-driven loop
  // will pick up the next ready node as soon as a slot
  // frees up. The join demo opts in to 4 to show that the
  // two parallel branches (fetchProfile / fetchAvatar) run
  // concurrently.
  readonly maxConcurrent?: number;
};

export function ExampleShell<PathMap extends Record<string, unknown>>({
  demo,
  onSelectDemo,
  demoIdx,
}: {
  demo: Demo<PathMap>;
  onSelectDemo?: (i: number) => void;
  demoIdx?: number;
}) {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  // scrollToKey: when set, the RenderedPanel scrolls the
  // matching row into view. Set by clicking a node in the
  // graph. Cleared by the panel after scrolling.
  const [scrollToKey, setScrollToKey] = useState<string | null>(null);
  const [input, setInput] = useState(
    demo.panel.kind === "input" ? demo.panel.default : "",
  );
  const [eventTick, setEventTick] = useState(0);
  // runId bumps on every explicit run. The run effect depends
  // on it so a user-triggered run fires a fresh Effect gen
  // with the current `input` state.
  const [runId, setRunId] = useState(0);
  // The "pending human submit" carries a value from the form
  // into the next run. When the form submits, the shell calls
  // writeHumanInput + run in the same Effect.gen.
  const pendingHumanRef = useRef<{ key: NodeKeyT; value: unknown } | null>(null);
  // prevStateRef tracks the previous state for diffing. The
  // capture() function reads the prior state to emit only
  // the events that represent the change.
  const prevStateRef = useRef<WorkflowState | null>(null);
  // runtimeRef holds the persistent runtime layer across
  // runs. The layer is created on the first run and reused
  // for subsequent runs (form submit, re-run). The stateRef
  // inside the layer persists across runs, so the second
  // run (after form submit) continues from the first run's
  // final state. The layer is recreated when the demo
  // changes (see the reset effect below).
  const runtimeRef = useRef<{
    layer: ReturnType<typeof WorkflowRuntimeLive>;
    state: WorkflowState;
    cb: (s: WorkflowState) => void;
  } | null>(null);
  // cbRef holds the live runtime subscription callback so
  // the cleanup can null it out (the runtime's subscribe is
  // fire-and-forget; no unsubscribe handle).
  const cbRef = useRef<((s: WorkflowState) => void) | null>(null);

  // Reset when the demo changes. The state and event log
  // clear; the input resets to the demo's default; the
  // persistent runtime layer is discarded so the next run
  // creates a fresh one. Critically, we do NOT auto-run —
  // the user clicks run, or types and hits Enter, or
  // submits a paused form.
  useEffect(() => {
    setState(null);
    setEvents([]);
    prevStateRef.current = null;
    setInput(demo.panel.kind === "input" ? demo.panel.default : "");
    runtimeRef.current = null;
    setScrollToKey(null);
  }, [demo]);

  // Drive the runtime. Fires on demo change (init) and on
  // runId bump (user re-run).
  useEffect(() => {
    void runDemo(demo, input, pendingHumanRef.current);
    pendingHumanRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, runId]);

  async function runDemo(
    d: typeof demo,
    writeValue: string,
    pendingHuman: { key: NodeKeyT; value: unknown } | null,
  ) {
    // Use the persistent runtime layer if it exists (for
    // re-runs and form submits). Create a fresh layer on
    // the first run. The layer's stateRef persists across
    // runs, so the second run (after form submit) continues
    // from the first run's final state. This is critical
    // for the human-in-the-loop flow: after the first run
    // pauses at askName, the second run must resume from
    // the paused state, not from all-pending.
    if (!runtimeRef.current) {
      const initial = d.setup();
      const layer = WorkflowRuntimeLive({ state: initial });
      // A single cb for the lifetime of the layer.
      // Subscribing once avoids accumulating stale cbs in
      // the runtime's `subs` set across re-runs.
      const cb = (s: WorkflowState) => {
        if (cbRef.current !== cb) return;
        // Capture the prev state synchronously. Reading
        // prevStateRef.current inside the setEvents closure
        // is wrong: React calls the closure at commit time,
        // by which point later notify calls have already
        // updated the ref, so every capture ends up diffing
        // against the latest state (no changes, no events).
        // The captured local `prevState` is the state that
        // existed at the time this notify fired.
        const prevState = prevStateRef.current;
        prevStateRef.current = s;
        setState(s);
        setEvents((prev) => capture(prev, s, prevState));
        setEventTick((t) => t + 1);
        runtimeRef.current = { layer, state: s, cb };
      };
      cbRef.current = cb;
      runtimeRef.current = { layer, state: initial, cb };
    }
    const { layer, cb } = runtimeRef.current;

    const setupSub = Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      // Subscribe the cb if not already subscribed. The
      // `subs` Set is idempotent for the same cb reference,
      // but we guard with a local flag to make the
      // intent explicit and avoid the async setup race.
      yield* rt.subscribe(cb);
      if (d.panel.kind === "input") {
        yield* rt.write(d.panel.writeTo, writeValue);
      }
      if (pendingHuman) {
        yield* rt.writeHumanInput(pendingHuman.key, pendingHuman.value);
      }
      const state = runtimeRef.current?.state ?? d.setup();
      const opts: Parameters<typeof rt.run>[0] =
        d.maxConcurrent === undefined
          ? { state }
          : { state, maxConcurrent: d.maxConcurrent };
      const s = yield* rt.run(opts);
      if (cbRef.current === cb) {
        const prevState = prevStateRef.current;
        prevStateRef.current = s;
        setState(s);
        setEvents((prev) => capture(prev, s, prevState));
        setEventTick((t) => t + 1);
        if (runtimeRef.current) {
          runtimeRef.current = { layer, state: s, cb };
        }
      }
    });
    await Effect.runPromise(setupSub.pipe(Effect.provide(layer))).catch(
      (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[ExampleShell] run failed", e);
      },
    );
  }

  function run() {
    setRunId((r) => r + 1);
  }

  // The form's submit handler. Captures the value and bumps
  // runId so the next effect tick writes it + runs.
  function onHumanSubmit(key: NodeKeyT, value: unknown) {
    pendingHumanRef.current = { key, value };
    setRunId((r) => r + 1);
  }

  // Detect whether any node is paused — used to suppress the
  // panel's "run" input when the form is the active UI.
  const isPaused = useMemo(() => {
    if (!state) return false;
    for (const node of state.nodes.values()) {
      if (node.status.kind === "paused") return true;
    }
    return false;
  }, [state, eventTick]);

  const lastEvent = useMemo<WorkflowEvent | null>(
    () => (events.length > 0 ? (events[0] as WorkflowEvent) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, eventTick],
  );

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header__brand">
          underw<span className="app-header__brand-ai">AI</span>
        </span>
        <span className="app-header__divider">/</span>
        <span className="app-header__id">examples</span>
        <span className="app-header__spacer" />
        <div className="app-header__examples">
          {onSelectDemo && demoIdx !== undefined
            ? allDemosList.map((d, i) => (
                <button
                  key={d.id}
                  className={`app-header__chip${i === demoIdx ? " app-header__chip--active" : ""}`}
                  onClick={() => onSelectDemo?.(i)}
                >
                  {d.title}
                </button>
              ))
            : null}
        </div>
        <span className="app-header__divider" />
        <span className="app-header__id">{demo.id}</span>
        <StatusPill status={state?.status ?? "pending"} />
      </header>
      <main className="app-body">
        <section className="app-body__left">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">rendered</span>
              <span>consumer view</span>
            </div>
            <div className="panel__body">
              <RenderedPanel
                demo={demo}
                state={state}
                input={input}
                onInputChange={setInput}
                onRerun={run}
                onHumanSubmit={onHumanSubmit}
                isPaused={isPaused}
                scrollToKey={scrollToKey}
                onScrolled={() => setScrollToKey(null)}
              />
            </div>
          </div>
        </section>
        <section className="app-body__right">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">graph</span>
              <span>topology</span>
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              <Graph state={state} onNodeClick={setScrollToKey} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">event log</span>
              <span>
                {events.length} event{events.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="panel__body" style={{ padding: "0 16px" }}>
              <EventLog events={events} lastEvent={lastEvent} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
