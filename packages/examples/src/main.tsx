// @underwai/examples — main entry point.
//
// Hash-based routing. The URL hash carries the demo id; the
// app reads the hash on mount and listens for hashchange
// events. Clicking a chip in the shell updates the hash
// (which triggers a re-render), so deep links work and the
// back button restores prior demos.

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExampleShell } from "./ExampleShell.js";
import { allDemos } from "./workflows.js";
// Side-effect import: Vite bundles the CSS into the page.
// oxlint-disable-next-line import(no-unassigned-import)
import "./styles.css";

function readDemoFromHash(): number {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const idx = allDemos.findIndex((d) => d.id === hash);
  return idx === -1 ? 0 : idx;
}

function writeDemoToHash(idx: number) {
  const demo = allDemos[idx];
  if (!demo) return;
  const nextHash = `#/${demo.id}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function App() {
  const [demoIdx, setDemoIdx] = useState(() => readDemoFromHash());

  // Sync URL → state on hashchange (back/forward, manual
  // edits, deep links).
  useEffect(() => {
    const onHash = () => setDemoIdx(readDemoFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Sync state → URL when the user picks a chip.
  useEffect(() => {
    writeDemoToHash(demoIdx);
  }, [demoIdx]);

  const demo = allDemos[demoIdx] ?? allDemos[0];
  if (!demo) return null;

  return (
    <ExampleShell
      demo={demo}
      onSelectDemo={setDemoIdx}
      demoIdx={demoIdx}
    />
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
