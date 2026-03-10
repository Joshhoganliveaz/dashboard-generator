import type { DashboardConfig } from "./types";

/**
 * Serialize a JS value as a JavaScript literal (not JSON).
 * - Strings use double quotes with robust escaping
 * - Arrays and objects are formatted readably
 */
export function serializeValue(val: unknown, indent: number = 2): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") {
    if (!isFinite(val)) return "0";
    return String(val);
  }
  if (typeof val === "string") {
    // Robust escaping for JS string literals
    const escaped = val
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\u2028/g, "\\u2028") // line separator
      .replace(/\u2029/g, "\\u2029") // paragraph separator
      .replace(/<\/(script)/gi, "<\\/$1") // prevent </script> breaking the HTML
      .replace(/`/g, "\\`"); // backticks
    return `"${escaped}"`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const items = val.map((v) => " ".repeat(indent + 2) + serializeValue(v, indent + 2));
    return `[\n${items.join(",\n")}\n${" ".repeat(indent)}]`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const items = entries.map(
      ([k, v]) => `${" ".repeat(indent + 2)}${k}: ${serializeValue(v, indent + 2)}`
    );
    return `{\n${items.join(",\n")}\n${" ".repeat(indent)}}`;
  }
  return String(val);
}

export function injectConfig(templateHtml: string, config: DashboardConfig): string {
  const startMarker = "// === CONFIG";
  const endMarker = "// === END CONFIG ===";

  const startIdx = templateHtml.indexOf(startMarker);
  const endIdx = templateHtml.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Could not find CONFIG markers in template.html");
  }

  // Find the start of the decorator line above the start marker
  let lineStart = templateHtml.lastIndexOf("\n", startIdx) + 1;
  // Check if the line before is also a decorator (// ===...)
  const prevLineEnd = lineStart - 1;
  if (prevLineEnd > 0) {
    const prevLineStart = templateHtml.lastIndexOf("\n", prevLineEnd - 1) + 1;
    const prevLine = templateHtml.slice(prevLineStart, prevLineEnd).trim();
    if (prevLine.startsWith("// ===")) {
      lineStart = prevLineStart;
    }
  }

  // Find the end of the end marker section (includes trailing decorator line)
  let lineEnd = templateHtml.indexOf("\n", endIdx);
  // Check if next line is a decorator too
  const nextLineEnd = templateHtml.indexOf("\n", lineEnd + 1);
  if (nextLineEnd > lineEnd) {
    const nextLine = templateHtml.slice(lineEnd + 1, nextLineEnd).trim();
    if (nextLine.startsWith("// ===")) {
      lineEnd = nextLineEnd;
    }
  }

  const configStr = serializeValue(config, 2);

  const newSection = `// ============================================================
// === CONFIG — The only section that changes per client ===
// ============================================================
var CONFIG = ${configStr};
// ============================================================
// === END CONFIG ===
// ============================================================`;

  return templateHtml.slice(0, lineStart) + newSection + "\n" + templateHtml.slice(lineEnd + 1);
}
