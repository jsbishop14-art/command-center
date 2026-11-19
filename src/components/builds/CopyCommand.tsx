"use client";

import { useState } from "react";

// The runner command with a Copy button (mockup: "Paste this at the plain terminal prompt"). The app
// never starts the runner itself (spec §3, process.md §11); Josh pastes this at a plain terminal.
export default function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="builds-cmd">
      <code className="mono" data-testid="runner-command">{command}</code>
      <button className="btn dark" type="button" onClick={copy} data-testid="runner-copy">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
