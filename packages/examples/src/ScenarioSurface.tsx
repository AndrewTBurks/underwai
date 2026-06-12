import type { Node, NodeKey, WorkflowState } from "@underwai/core";
import type { Demo } from "./ExampleShell.js";
import { MultiHumanForm } from "./HumanForm/index.js";

export function ScenarioSurface<PathMap extends Record<string, unknown>>({
  demo,
  state,
  input,
  onInputChange,
  onRerun,
  onHumanInputChange,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  input: string;
  onInputChange: (value: string) => void;
  onRerun: () => void;
  onHumanInputChange: (key: NodeKey, value: unknown) => void;
}) {
  if (demo.scenario === "research-triage" || demo.id === "wf-human") {
    return (
      <ResearchTriageApp
        demo={demo}
        state={state}
        onRerun={onRerun}
        onHumanInputChange={onHumanInputChange}
      />
    );
  }
  if (demo.scenario === "incident-join" || demo.id === "wf-join") {
    return (
      <IncidentJoinApp
        demo={demo}
        state={state}
        input={input}
        onInputChange={onInputChange}
        onRerun={onRerun}
      />
    );
  }
  if (demo.scenario === "data-qa" || demo.id === "wf-linear") {
    return (
      <DataQaApp
        demo={demo}
        state={state}
        input={input}
        onInputChange={onInputChange}
        onRerun={onRerun}
      />
    );
  }
  return <GenericMiniApp demo={demo} state={state} onRerun={onRerun} />;
}

function ResearchTriageApp<PathMap extends Record<string, unknown>>({
  demo,
  state,
  onRerun,
  onHumanInputChange,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  onRerun: () => void;
  onHumanInputChange: (key: NodeKey, value: unknown) => void;
}) {
  const source = node(state, "root");
  const verify = node(state, "root.askName");
  const synthesize = node(state, "root.askName.compose.polish");
  const brief = node(state, "root.askName.compose.polish.sign.display");
  return (
    <MiniAppFrame
      eyebrow="research triage"
      title="Claim verification desk"
      description="A human edit resolves one graph position; only the dependent brief region should recompute."
      demo={demo}
      onRun={onRerun}
    >
      <section className="mini-grid mini-grid--research">
        <UiRegion title="source note" node={source}>
          <p className="mini-copy">
            “Graph-state renderers make human review auditable, but the extracted author name and contact confidence need verification before this becomes a publishable brief.”
          </p>
        </UiRegion>
        <UiRegion title="extracted claims" node={source}>
          <ClaimList state={source?.status.kind ?? "pending"} />
        </UiRegion>
        <UiRegion title="human verification" node={verify} emphasis wide>
          {verify ? (
            <MultiHumanForm
              schema={verify.inputSchema}
              initialValue={verify.input.value}
              onChange={(value) => onHumanInputChange(verify.id, value)}
              paused={verify.status.kind === "paused"}
              labels={{ firstName: "claim owner", lastName: "source group", email: "contact" }}
            />
          ) : (
            <SkeletonLines count={3} />
          )}
        </UiRegion>
        <UiRegion title="verified brief" node={brief ?? synthesize} wide>
          <FinalBrief node={brief ?? synthesize} />
        </UiRegion>
      </section>
    </MiniAppFrame>
  );
}

function IncidentJoinApp<PathMap extends Record<string, unknown>>({
  demo,
  state,
  input,
  onInputChange,
  onRerun,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  input: string;
  onInputChange: (value: string) => void;
  onRerun: () => void;
}) {
  const signal = node(state, "root");
  const customer = node(state, "root.fetchProfile.validateProfile");
  const infra = node(state, "root.fetchAvatar.validateAvatar");
  const severity = node(state, "root.fetchProfile.validateProfile.merge");
  const plan = node(state, "root.fetchProfile.validateProfile.merge.render");
  return (
    <MiniAppFrame
      eyebrow="incident workspace"
      title="Severity join console"
      description="Branch evidence is normalized into one typed aggregate before the response plan renders."
      demo={demo}
      onRun={onRerun}
    >
      <div className="mini-inputbar">
        <label>
          Incident signal
          <input value={input} onChange={(e) => onInputChange(e.target.value)} />
        </label>
        <button onClick={onRerun}>run join</button>
      </div>
      <section className="mini-grid mini-grid--incident">
        <UiRegion title="signal" node={signal}>
          <p className="mini-copy">{input || "Awaiting signal"}</p>
        </UiRegion>
        <UiRegion title="customer impact" node={customer}>
          <EvidenceLane label="impact" node={customer} fallback="loading affected accounts" />
        </UiRegion>
        <UiRegion title="infra health" node={infra}>
          <EvidenceLane label="infra" node={infra} fallback="checking deploy + asset health" />
        </UiRegion>
        <UiRegion title="typed severity aggregate" node={severity} wide>
          <SeverityAggregate node={severity} />
        </UiRegion>
        <UiRegion title="response plan" node={plan} wide>
          <p className="mini-copy mini-copy--strong">{textOutput(plan) ?? "Response plan renders after the aggregate resolves."}</p>
        </UiRegion>
      </section>
    </MiniAppFrame>
  );
}

function DataQaApp<PathMap extends Record<string, unknown>>({
  demo,
  state,
  input,
  onInputChange,
  onRerun,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  input: string;
  onInputChange: (value: string) => void;
  onRerun: () => void;
}) {
  const raw = node(state, "root");
  const parse = node(state, "root.trim");
  const validate = node(state, "root.trim.upper");
  const normalize = node(state, "root.trim.upper.exclaim.display");
  return (
    <MiniAppFrame
      eyebrow="data qa"
      title="Import repair table"
      description="Pending, running, failed, stale, and resolved states render as local product UI, not debugger rows."
      demo={demo}
      onRun={onRerun}
    >
      <div className="mini-inputbar">
        <label>
          Raw row
          <input value={input} onChange={(e) => onInputChange(e.target.value)} />
          <span className="mini-inputbar__hint">Add <code>!!bad</code> to force a typed quality-check error; remove it and rerun to repair.</span>
        </label>
        <button onClick={onRerun}>validate row</button>
      </div>
      <section className="mini-grid mini-grid--data">
        <UiRegion title="raw payload" node={raw}>
          <DataTable node={raw} input={input} stage="raw" />
        </UiRegion>
        <UiRegion title="parsed rows" node={parse}>
          <DataTable node={parse} input={textOutput(parse) ?? input.trim()} stage="parsed" />
        </UiRegion>
        <UiRegion title="quality check" node={validate}>
          <DataTable node={validate} input={textOutput(validate) ?? input.trim().toUpperCase()} stage="validated" />
        </UiRegion>
        <UiRegion title="normalized output" node={normalize} wide>
          <DataTable node={normalize} input={textOutput(normalize) ?? ""} stage="normalized" />
        </UiRegion>
      </section>
    </MiniAppFrame>
  );
}

function GenericMiniApp<PathMap extends Record<string, unknown>>({
  demo,
  state,
  onRerun,
}: {
  demo: Demo<PathMap>;
  state: WorkflowState | null;
  onRerun: () => void;
}) {
  const nodes = state ? Array.from(state.nodes.values()) : [];
  return (
    <MiniAppFrame
      eyebrow="workflow surface"
      title={demo.title}
      description={demo.description}
      demo={demo}
      onRun={onRerun}
    >
      <section className="mini-grid">
        {nodes.length === 0 ? (
          <UiRegion title="empty state" node={null} wide>
            <SkeletonLines count={4} />
          </UiRegion>
        ) : (
          nodes.map((n) => (
            <UiRegion key={String(n.id)} title={n.kind} node={n}>
              <pre className="mini-code">{formatOutput(n)}</pre>
            </UiRegion>
          ))
        )}
      </section>
    </MiniAppFrame>
  );
}

function MiniAppFrame<PathMap extends Record<string, unknown>>({
  eyebrow,
  title,
  description,
  demo,
  onRun,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  demo: Demo<PathMap>;
  onRun: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mini-app">
      <header className="mini-app__header">
        <div>
          <span className="mini-app__eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="mini-app__proof">
          <span>proves</span>
          <strong>{demo.differentiator ?? "typed graph state"}</strong>
          {demo.keyMutation ? <code>{demo.keyMutation}</code> : null}
          <button onClick={onRun}>run</button>
        </div>
      </header>
      {children}
    </div>
  );
}

function UiRegion({
  title,
  node,
  children,
  wide = false,
  emphasis = false,
}: {
  title: string;
  node: Node | null | undefined;
  children: React.ReactNode;
  wide?: boolean;
  emphasis?: boolean;
}) {
  const status = node?.status.kind ?? "pending";
  return (
    <article
      className={`ui-region${wide ? " ui-region--wide" : ""}${emphasis ? " ui-region--emphasis" : ""}`}
      data-status={status}
    >
      <div className="ui-region__header">
        <span>{title}</span>
        <span className="ui-region__badge">{status}</span>
      </div>
      <div className="ui-region__body">{children}</div>
      {status === "stale" ? <div className="ui-region__overlay">recomputing from prior value</div> : null}
    </article>
  );
}

function ClaimList({ state }: { state: string }) {
  if (state === "pending") return <SkeletonLines count={4} />;
  return (
    <ul className="claim-list">
      <li><span>claim</span><strong>graph state can drive product UI</strong></li>
      <li><span>confidence</span><strong>0.82</strong></li>
      <li><span>needs human</span><strong>contact attribution</strong></li>
    </ul>
  );
}

function FinalBrief({ node }: { node: Node | null | undefined }) {
  const text = textOutput(node);
  if (!node || node.status.kind === "pending") return <SkeletonLines count={5} />;
  if (node.status.kind === "failed") return <ErrorBlock message={node.status.error.message} />;
  return (
    <div className="brief-card">
      <span>verified synthesis</span>
      <h2>{text ?? "Waiting for verified claim"}</h2>
      <p>The UI keeps resolved sibling regions intact while this downstream brief recomputes.</p>
    </div>
  );
}

function EvidenceLane({ node, label, fallback }: { node: Node | null | undefined; label: string; fallback: string }) {
  if (!node || node.status.kind === "pending") return <SkeletonLines count={3} />;
  if (node.status.kind === "running") return <ActiveSkeleton label={fallback} />;
  if (node.status.kind === "failed") return <ErrorBlock message={node.status.error.message} />;
  return (
    <div className="evidence-lane">
      <span>{label}</span>
      <strong>{formatOutput(node)}</strong>
    </div>
  );
}

function SeverityAggregate({ node }: { node: Node | null | undefined }) {
  if (!node || node.status.kind === "pending") return <SkeletonLines count={4} />;
  if (node.status.kind === "running") return <ActiveSkeleton label="normalizing branch outputs" />;
  if (node.status.kind === "failed") return <ErrorBlock message={node.status.error.message} />;
  return (
    <div className="severity-aggregate">
      <div><span>customer_impact</span><strong>profile evidence</strong></div>
      <div><span>infra_health</span><strong>asset branch</strong></div>
      <div><span>aggregate</span><strong>{textOutput(node) ?? "joined"}</strong></div>
    </div>
  );
}

function DataTable({ node, input, stage }: { node: Node | null | undefined; input: string; stage: string }) {
  if (!node || node.status.kind === "pending") return <SkeletonTable />;
  if (node.status.kind === "running") return <ActiveSkeleton label={`${stage} running`} />;
  if (node.status.kind === "failed") return <ErrorBlock message={node.status.error.message} />;
  return (
    <table className="mini-table">
      <tbody>
        <tr><th>field</th><th>value</th><th>state</th></tr>
        <tr><td>row</td><td>{input || "—"}</td><td>{node.status.kind}</td></tr>
        <tr><td>stage</td><td>{stage}</td><td>typed</td></tr>
      </tbody>
    </table>
  );
}

function SkeletonLines({ count }: { count: number }) {
  return (
    <div className="skeleton-lines" aria-label="pending content">
      {Array.from({ length: count }, (_, i) => <span key={i} />)}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="skeleton-table" aria-label="pending table">
      {Array.from({ length: 6 }, (_, i) => <span key={i} />)}
    </div>
  );
}

function ActiveSkeleton({ label }: { label: string }) {
  return (
    <div className="active-skeleton">
      <span />
      <strong>{label}</strong>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="error-block">
      <strong>local error fallback</strong>
      <span>{message}</span>
    </div>
  );
}

function node(state: WorkflowState | null, key: string): Node | null {
  return state?.nodes.get(key as unknown as NodeKey) ?? null;
}

function textOutput(node: Node | null | undefined): string | null {
  if (!node) return null;
  if (node.status.kind === "resolved") return stringify(node.status.finalOutput);
  if (node.status.kind === "streaming") return stringify(node.status.output);
  if (node.status.kind === "stale" && node.status.previousOutput !== undefined) {
    return stringify(node.status.previousOutput);
  }
  return null;
}

function formatOutput(node: Node): string {
  const out = textOutput(node);
  return out ?? node.status.kind;
}

function stringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "<unserializable>";
  }
}
