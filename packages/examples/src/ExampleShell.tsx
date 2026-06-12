// ExampleShell — the 3-area UI for every example.
//
//   left         = scenario-specific miniature target app
//   right top    = typed graph state (the DAG)
//   right bottom = state transition trail (WorkflowEvent evidence)
//
// One shell, one runtime, one subscription. The shell takes a
// `Demo` object (built tree + setup + display metadata) and
// drives the workflow through Effect. Runs are user-initiated
// only — switching demos or mounting does not auto-run.

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

export type ScenarioKind =
  | "research-triage"
  | "incident-join"
  | "data-qa"
  | "human-loop"
  | "linear"
  | "streaming"
  | "wall";

export type Demo<PathMap extends Record<string, unknown> = Record<string, unknown>> = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly differentiator?: string;
  readonly keyMutation?: string;
  readonly scenario?: ScenarioKind;
  readonly built: TypedTree<string, PathMap>;
  readonly setup: () => WorkflowState;
  readonly leafKey: keyof PathMap & string;
  readonly panel:
    | { kind: "input"; label: string; default: string; writeTo: NodeKeyT }
    | { kind: "none" };
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
  const [scrollToKey, setScrollToKey] = useState<string | null>(null);
  const [input, setInput] = useState(
    demo.panel.kind === "input" ? demo.panel.default : "",
  );
  const [eventTick, setEventTick] = useState(0);
  const [runId, setRunId] = useState(0);
  const prevStateRef = useRef<WorkflowState | null>(null);
  const runtimeRef = useRef<{
    layer: ReturnType<typeof WorkflowRuntimeLive>;
    state: WorkflowState;
    cb: (s: WorkflowState) => void;
  } | null>(null);
  const cbRef = useRef<((s: WorkflowState) => void) | null>(null);

  useEffect(() => {
    setState(null);
    setEvents([]);
    prevStateRef.current = null;
    setInput(demo.panel.kind === "input" ? demo.panel.default : "");
    setRunId(0);
    runtimeRef.current = null;
    setScrollToKey(null);
  }, [demo]);

  useEffect(() => {
    if (runId === 0) return;
    void runDemo(demo, input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function runDemo(d: typeof demo, writeValue: string) {
    if (!runtimeRef.current) {
      const initial = d.setup();
      const layer = WorkflowRuntimeLive({ state: initial });
      const cb = (s: WorkflowState) => {
        if (cbRef.current !== cb) return;
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
      yield* rt.subscribe(cb);
      if (d.panel.kind === "input") {
        yield* rt.write(d.panel.writeTo, writeValue);
      }
      const current = runtimeRef.current?.state ?? d.setup();
      const opts: Parameters<typeof rt.run>[0] =
        d.maxConcurrent === undefined
          ? { state: current }
          : { state: current, maxConcurrent: d.maxConcurrent };
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

  function onHumanInputChange(key: NodeKeyT, value: unknown) {
    if (!runtimeRef.current) return;
    const { layer } = runtimeRef.current;
    const effect = Effect.gen(function* () {
      const rt = yield* WorkflowRuntime;
      const postWrite = yield* rt.writeHumanInput(key, value);
      const current = runtimeRef.current?.state ?? postWrite;
      const opts: Parameters<typeof rt.run>[0] =
        demo.maxConcurrent === undefined
          ? { state: current }
          : { state: current, maxConcurrent: demo.maxConcurrent };
      const result = yield* rt.run(opts);
      return result;
    });
    void Effect.runPromise(effect.pipe(Effect.provide(layer))).catch(
      (e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[ExampleShell] live edit failed", e);
      },
    );
  }

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
        <span className="app-header__id">typed graph-state examples</span>
        <span className="app-header__spacer" />
        <div className="app-header__examples" aria-label="Scenario examples">
          {onSelectDemo && demoIdx !== undefined
            ? allDemosList.map((d, i) => (
                <button
                  key={d.id}
                  className={`app-header__chip${i === demoIdx ? " app-header__chip--active" : ""}`}
                  onClick={() => onSelectDemo?.(i)}
                >
                  <span className="app-header__chip-kicker">{d.differentiator ?? d.id}</span>
                  <span>{d.title}</span>
                </button>
              ))
            : null}
        </div>
        <StatusPill status={state?.status ?? "pending"} />
      </header>
      <main className="app-body">
        <section className="app-body__left">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">product surface</span>
              <span>miniature target app</span>
            </div>
            <div className="panel__body">
              <RenderedPanel
                demo={demo}
                state={state}
                input={input}
                onInputChange={setInput}
                onRerun={run}
                onHumanInputChange={onHumanInputChange}
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
              <span className="panel__title">typed graph state</span>
              <span>{demo.keyMutation ?? "nodes / edges / values"}</span>
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              <Graph state={state} onNodeClick={setScrollToKey} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">state transition trail</span>
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
