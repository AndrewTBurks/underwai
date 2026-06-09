// StatusPill — the small dot+label indicator for a status.
// Extracted so the header and the meta strip share the same
// markup.
import * as React from "react";
export function StatusPill({ status }: { status: string }) {
  void React;
  return (
    <span className="status-pill" data-status={status}>
      <span className="status-pill__dot" />
      {status}
    </span>
  );
}
