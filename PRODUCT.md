# Product

## Register

product

## Users

underwAI is for developers and technical evaluators designing AI, human, and Effect-driven workflows that need to be inspectable, typed, editable, and renderable. They are not looking for another chat interface, and they are not primarily looking for a durable async workflow engine. They are trying to understand whether a typed workflow graph gives them a better product/UI substrate than either a transcript or a function-shaped workflow runner.

## Product Purpose

underWAI provides a typed DAG state protocol where AI steps, human inputs, and effectful programs resolve nodes into values. The example page should make that model obvious by showing graph-native behavior: downstream staleness after a human edit, typed branches joining into validated aggregates, repairable failed nodes, and UI panels rendered directly from workflow state. Success means a visitor understands the distinction: TanStack AI helps call models; TanStack Workflow runs durable async workflows; underWAI makes AI-human workflows inspectable, editable, and renderable as typed graph state.

## Brand Personality

Precise, infrastructural, and quietly dramatic. The interface should feel like a runtime console for serious work: dense enough to reward inspection, polished enough to trust, and visually distinct enough to be memorable.

## Anti-references

Do not make the examples look like a generic chat app, AI-agent dashboard, SaaS card grid, durable-job monitor, queue/retry dashboard, toy tutorial, or static documentation snippet. Avoid centering avatars, prompt bubbles, fake assistant messages, decorative metrics, generic retry/status tables, and diagram-only explanations that do not prove the graph state is doing work.

## Design Principles

1. **The graph is the product interface.** The UI should render dependencies, typed values, state changes, joins, stale recomputation, and human intervention directly from the workflow graph.
2. **Typed reactive graph state is the differentiator.** Do not lead with durable execution, retries, or long-running jobs; those are TanStack Workflow territory. Lead with graph editability, inspectability, and renderability.
3. **Human and AI resolve the same kind of thing.** A human edit, an AI result, and an Effect return all fill typed graph positions. The examples should make that equivalence visible.
4. **Typed state beats transcript theater.** Show schemas, validated values, node status, edge/bridge effects, stale subtrees, and derived outputs rather than simulated conversation.
5. **Complexity should become legible.** More complex examples are valuable only if the UI helps the viewer understand what changed, why it changed, what became stale, and what will run next.
6. **Developer trust comes from proof.** Every example should run, update, and render from real workflow state; no fake mock panels that merely imply behavior.

## Accessibility & Inclusion

Use accessible contrast, keyboard-operable controls, visible focus states, reduced-motion alternatives, and non-color-only status indicators. Motion may clarify runtime transitions, but the workflow must remain understandable with motion reduced or disabled.
