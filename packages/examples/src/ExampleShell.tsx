// ExampleShell — layout/navigation glue for every example.
//
//   left         = scenario-specific miniature target app
//   right top    = typed graph state (the DAG)
//   right bottom = state transition trail (WorkflowEvent evidence)
//
// Runtime state lives in useDemoRuntime. Workflow definitions and
// scenario metadata live outside the shell so demos do not depend on
// the UI component.

import { useEffect, useState } from "react";
import { Graph } from "./Graph.js";
import { EventLog } from "./EventLog.js";
import { RenderedPanel } from "./RenderedPanel.js";
import { StatusPill } from "./StatusPill.js";
import { allDemos } from "./workflows.js";
import { useDemoRuntime } from "./useDemoRuntime.js";
import type { Demo } from "./demo-types.js";

const allDemosList = allDemos;

export function ExampleShell<PathMap extends Record<string, unknown>>({
  demo,
  onSelectDemo,
  demoIdx,
}: {
  demo: Demo<PathMap>;
  onSelectDemo?: (i: number) => void;
  demoIdx?: number;
}) {
  const [scrollToKey, setScrollToKey] = useState<string | null>(null);
  const {
    state,
    events,
    input,
    setInput,
    run,
    writeHumanInput,
    isPaused,
    lastEvent,
  } = useDemoRuntime(demo);

  useEffect(() => {
    setScrollToKey(null);
  }, [demo]);

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
                onHumanInputChange={writeHumanInput}
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
