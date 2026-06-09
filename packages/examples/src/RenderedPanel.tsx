// RenderedPanel — the left column of the example shell.
//
// Renders all intermediate states of the workflow as a
// vertical list of rows, ordered top to bottom by DAG level
// (longest path from any root). Siblings at the same level
// are sorted by node id for stable rendering. For a linear
// chain this matches the builder's declaration order; for a
// diamond or join it groups the parallel branches at the
// same vertical position with their parent above and their
// join child below.
//
// Each row shows:
//   - the node's kind (e.g. "greet", "askName")
//   - the node's path (small, dim, e.g. "root.askName")
//   - a status pill (pending, running, resolved, paused, failed)
//   - the node's output if resolved, or "—" if pending
//
// When the workflow is paused on a human-marked node, that
// node's row is the form (HumanForm). The form is the
// consumer's input to the workflow — its emphasis is
// intentional. Submitting the form calls the shell's
// onHumanSubmit, which writes the value back to the runtime.
//
// The panel also surfaces the workflow's external input
// (a text field + run button for "input" demos, or just a
// run button for "none" demos) at the top.

import { useEffect } from "react";
import type { ZodTypeAny } from "zod";
import { getHumanMode } from "@underwai/schema";
import { topologicalLevels, type NodeKey, type WorkflowState } from "@underwai/core";
import type { Demo } from "./ExampleShell.js";
import { StatusPill } from "./StatusPill.js";
import { HumanForm } from "./HumanForm.js";

export function RenderedPanel<PathMap extends Record<string, unknown>>({
  demo,
  state,
  input,
  onInputChange,
  onRerun,
  onHumanSubmit,
  isPaused,
  scrollToKey,
  onScrolled,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  input: string;
  onInputChange: (s: string) => void;
  onRerun: () => void;
  onHumanSubmit: (key: NodeKey, value: unknown) => void;
  isPaused: boolean;
  scrollToKey: string | null;
  onScrolled: () => void;
}) {
  // Collect all node rows in declaration order. The
  // state's nodes Map preserves insertion order (root
  // first, then chain children, then join siblings). For
  // each node, we call the typed view to get the
  // declared output type. The view is a type-narrowing
  // helper; at runtime it's a Map lookup.
  const rows = useRows(demo, state);

  // When the graph sets scrollToKey, find the matching
  // row and scroll it into view. The row has id
  // "rendered-stage-{key}". After scrolling, call
  // onScrolled to clear the scrollToKey state so the
  // scroll doesn't re-fire on re-renders.
  useEffect(() => {
    if (!scrollToKey) return;
    const el = document.getElementById(`rendered-stage-${scrollToKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    onScrolled();
  }, [scrollToKey, onScrolled]);

  return (
    <div className="rendered">
      <div className="rendered__intro">
        <h1 className="rendered__title">{demo.title}</h1>
        <p className="rendered__description">{demo.description}</p>
      </div>

      {demo.panel.kind === "input" && !isPaused && (
        <div className="rendered__actions">
          <input
            className="rendered__input"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRerun();
            }}
            placeholder={demo.panel.label}
          />
          <button className="rendered__button" onClick={onRerun}>
            run
          </button>
        </div>
      )}

      {demo.panel.kind === "none" && !isPaused && !state && (
        <div className="rendered__actions">
          <button className="rendered__button" onClick={onRerun}>
            run
          </button>
        </div>
      )}

      <div className="rendered__stages">
        {rows.length === 0 && (
          <div className="rendered__stage-output rendered__stage-output--empty">
            (no stages yet — press run)
          </div>
        )}
        {rows.map((row) => (
          <StageRow
            key={row.key}
            row={row}
            isPausedHuman={
              row.status === "paused" && getHumanMode(row.inputSchema) !== undefined
            }
            onHumanSubmit={(v) => onHumanSubmit(row.nodeKey, v)}
            isTarget={scrollToKey === row.key}
          />
        ))}
      </div>
    </div>
  );
}

type Row = {
  key: string;
  kind: string;
  path: string;
  status: string;
  output: string | null;
  inputSchema: ZodTypeAny;
  nodeKey: NodeKey;
};

function useRows<PathMap extends Record<string, unknown>>(
  demo: Demo<PathMap>,
  state: WorkflowState | null,
): Row[] {
  if (!state) return [];
  const rows: Row[] = [];
  const levels = topologicalLevels(state);
  for (const level of levels) {
    for (const key of level) {
      const node = state.nodes.get(key);
      if (!node) continue;
      const keyStr = key as unknown as string;
    // The view method is a type-narrowing helper. At runtime
    // it reads the node from the state and narrows the output
    // type. We cast the key to the path-map key type — all
    // node keys in the state are in the path map because the
    // builder created them.
    const view = demo.built.view(
      state,
      keyStr as keyof PathMap & string,
    );
    const segments = keyStr.split(".");
    const displayPath: string =
      segments.length > 1 ? (segments[segments.length - 1] as string) : keyStr;
    rows.push({
      key: keyStr,
      kind: node.kind,
      path: displayPath,
      status: node.status.kind,
      output: readOutput(view),
      inputSchema: node.inputSchema,
      nodeKey: key,
    });
    }
  }
  return rows;
}

function StageRow({
  row,
  isPausedHuman,
  onHumanSubmit,
  isTarget,
}: {
  row: Row;
  isPausedHuman: boolean;
  onHumanSubmit: (v: unknown) => void;
  isTarget: boolean;
}) {
  const outputClass = `rendered__stage-output${
    row.status === "resolved" ? " rendered__stage-output--resolved" : ""
  }${row.status === "pending" ? " rendered__stage-output--pending" : ""}${
    isTarget ? " rendered__stage-output--target" : ""
  }`;
  return (
    <div className="rendered__stage" id={`rendered-stage-${row.key}`}>
      <div className="rendered__stage-header">
        <span className="rendered__stage-kind">{row.kind}</span>
        <span className="rendered__stage-path">{row.path}</span>
        <StatusPill status={row.status} />
      </div>
      {isPausedHuman ? (
        <div className={outputClass}>
          <HumanForm
            schema={row.inputSchema}
            label={`${row.kind} — value`}
            onSubmit={onHumanSubmit}
          />
        </div>
      ) : (
        <div className={outputClass}>
          {row.output === null ? (
            <span className="rendered__stage-placeholder">
              {row.status === "running" ? "running…" : "—"}
            </span>
          ) : (
            row.output
          )}
        </div>
      )}
    </div>
  );
}

function readOutput(
  view: { status: { kind: string; finalOutput?: unknown; output?: unknown; error?: unknown } } | null,
): string | null {
  if (!view) return null;
  const s = view.status;
  if (s.kind === "resolved") {
    return formatValue(s.finalOutput);
  }
  if (s.kind === "streaming") {
    return formatValue(s.output);
  }
  if (s.kind === "failed") {
    return `failed: ${formatValue(s.error)}`;
  }
  return null;
}

function formatValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "<unserializable>";
  }
}
