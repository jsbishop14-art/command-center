// Frontmatter parse and serialize for kanban card and pending-note files (handoff §4.2, §4.4).
// The files are plain Markdown with a flat YAML frontmatter block between `---` fences. This is a
// deliberately small, flat parser — no third-party YAML dependency — because the card format is
// flat key/value with simple flow lists. It preserves unknown fields and their order so a rewrite
// never drops them (handoff §4.7 rule 6).

export type FMValue = string | string[] | null;

export type Doc = {
  // All frontmatter keys in file order, with parsed values.
  data: Record<string, FMValue>;
  order: string[];
  body: string;
  // Raw frontmatter text (used to detect byte-level changes if needed).
  hadFrontmatter: boolean;
};

const FENCE = "---";

function unquote(raw: string): string {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (raw.length >= 2 && raw[0] === "'" && raw[raw.length - 1] === "'") {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

function parseValue(raw: string): FMValue {
  const v = raw.trim();
  if (v === "") return null;
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((p) => unquote(p.trim()));
  }
  return unquote(v);
}

// Parse a Markdown file into frontmatter data + body. A file with no leading `---` fence has no
// frontmatter (data empty, whole text is body).
export function parse(text: string): Doc {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== FENCE) {
    return { data: {}, order: [], body: normalized, hadFrontmatter: false };
  }
  const data: Record<string, FMValue> = {};
  const order: string[] = [];
  let i = 1;
  let closed = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === FENCE) {
      closed = true;
      i++;
      break;
    }
    if (line.trim() === "") continue;
    const m = /^([A-Za-z0-9_]+):(.*)$/.exec(line);
    if (!m) {
      // A line that is not key: value inside frontmatter makes the block invalid.
      throw new Error(`frontmatter line is not "key: value": ${JSON.stringify(line)}`);
    }
    const key = m[1];
    if (!(key in data)) order.push(key);
    data[key] = parseValue(m[2]);
  }
  if (!closed) throw new Error("frontmatter is not closed with ---");
  // The body is everything after the closing fence; drop one leading blank line if present.
  let bodyLines = lines.slice(i);
  if (bodyLines[0] === "") bodyLines = bodyLines.slice(1);
  // Normalise trailing newlines so parse(serialize(x)) is stable (serialize emits one trailing \n).
  const body = bodyLines.join("\n").replace(/\n+$/, "");
  return { data, order, body, hadFrontmatter: true };
}

function needsQuote(s: string): boolean {
  // Quote when the scalar could be misread: colons, leading/trailing space, or flow/comment chars.
  return (
    /[:#]/.test(s) ||
    /^[\s\[\]{}>|&*!%@`'"]/.test(s) ||
    /\s$/.test(s) ||
    s === "" ||
    /^(true|false|null|yes|no|~)$/i.test(s)
  );
}

function serializeScalar(s: string): string {
  if (!needsQuote(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeValue(v: FMValue): string {
  if (v === null) return "";
  if (Array.isArray(v)) return `[${v.map(serializeScalar).join(", ")}]`;
  return serializeScalar(v);
}

// Serialize data + body back to a Markdown file. `keyOrder` controls the leading keys; any key in
// `data` not named there is appended afterwards in its existing order (unknown fields survive —
// handoff §4.7 rule 6).
export function serialize(doc: { data: Record<string, FMValue>; order?: string[]; body: string }, keyOrder: string[]): string {
  const emitted = new Set<string>();
  const out: string[] = [FENCE];
  const emit = (key: string) => {
    if (emitted.has(key) || !(key in doc.data)) return;
    emitted.add(key);
    out.push(`${key}:${doc.data[key] === null || doc.data[key] === "" ? "" : " " + serializeValue(doc.data[key])}`);
  };
  for (const key of keyOrder) emit(key);
  // Preserve any remaining keys (unknowns) in their original file order, then any leftover.
  for (const key of doc.order ?? Object.keys(doc.data)) emit(key);
  for (const key of Object.keys(doc.data)) emit(key);
  out.push(FENCE);
  const body = doc.body ?? "";
  return out.join("\n") + "\n" + (body.length ? "\n" + body.replace(/\n+$/, "") + "\n" : "");
}
