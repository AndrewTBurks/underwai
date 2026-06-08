// @underwai/examples — main entry point.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { LinearPipeline } from "./linear-pipeline.js";
import { HumanInTheLoop } from "./human-in-the-loop.js";
import { WallDisplay } from "./wall-display.js";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <BrowserRouter>
      <nav>
        <Link to="/linear">linear pipeline</Link> | <Link to="/human">human-in-the-loop</Link> |{" "}
        <Link to="/wall">wall display</Link>
      </nav>
      <Routes>
        <Route path="/linear" element={<LinearPipeline />} />
        <Route path="/human" element={<HumanInTheLoop />} />
        <Route path="/wall" element={<WallDisplay />} />
        <Route path="*" element={<LinearPipeline />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
