// Logging that scrubs secrets (CLAUDE.md section 6: secrets never in logs). Any value registered
// as sensitive is replaced with [REDACTED] in every log line. The secret store registers each
// plaintext it handles, so an accidental log elsewhere is still scrubbed. Defence in depth: the
// code paths that handle secrets do not log the plaintext in the first place.

const redactions = new Set<string>();

export function registerSensitive(value: string): void {
  // Short values would over-redact ordinary text; only guard values worth hiding.
  if (value && value.length >= 6) redactions.add(value);
}

export function scrub(text: string): string {
  let out = text;
  for (const r of redactions) {
    if (out.includes(r)) out = out.split(r).join("[REDACTED]");
  }
  return out;
}

function render(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : (() => {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })()))
    .join(" ");
}

export function logInfo(...args: unknown[]): void {
  console.log(scrub(render(args)));
}

export function logError(...args: unknown[]): void {
  console.error(scrub(render(args)));
}

// For tests: clear the redaction set between cases.
export function __resetRedactionsForTest(): void {
  redactions.clear();
}
