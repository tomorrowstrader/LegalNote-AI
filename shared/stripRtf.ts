/**
 * Convert RTF (including TextEdit exports renamed to .txt) to plain text.
 * Returns the input unchanged when it is not RTF.
 */

export function looksLikeRtf(raw: string): boolean {
  return raw.replace(/^\uFEFF/, "").trimStart().startsWith("{\\rtf");
}

/** Remove a destination group (e.g. {\fonttbl ...}) including nested braces. */
function removeDestinationGroups(text: string, destination: string): string {
  const markers = [`{\\${destination}`, `{\\*\\${destination}`];
  let result = text;
  for (const marker of markers) {
    let searchFrom = 0;
    while (true) {
      const start = result.indexOf(marker, searchFrom);
      if (start < 0) break;
      let depth = 0;
      let end = -1;
      for (let i = start; i < result.length; i++) {
        const ch = result[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) break;
      result = `${result.slice(0, start)} ${result.slice(end + 1)}`;
      searchFrom = start;
    }
  }
  return result;
}

/** Remove all {\*...} destination groups with nested braces. */
function removeStarDestinations(text: string): string {
  let result = text;
  let searchFrom = 0;
  while (true) {
    const start = result.indexOf("{\\*", searchFrom);
    if (start < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < result.length; i++) {
      if (result[i] === "{") depth++;
      else if (result[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    result = `${result.slice(0, start)} ${result.slice(end + 1)}`;
    searchFrom = start;
  }
  return result;
}

export function stripRtfToPlainText(raw: string): string {
  const trimmed = raw.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed.startsWith("{\\rtf")) return raw;

  let text = trimmed;

  // Drop binary / picture / font / colour / stylesheet / info destination groups (nested-safe)
  for (const dest of [
    "fonttbl",
    "colortbl",
    "stylesheet",
    "info",
    "expandedcolortbl",
    "listtable",
    "listoverridetable",
    "generator",
  ]) {
    text = removeDestinationGroups(text, dest);
  }
  text = removeStarDestinations(text);

  // Line / paragraph breaks (\par / \pard only — not \pardirnatural / \partightenfactor)
  text = text.replace(/\\pard?\b/gi, "\n");
  text = text.replace(/\\line\b/gi, "\n");
  text = text.replace(/\\\n/g, "\n");
  // Hex-encoded characters (\'hh) — Windows-1252 common for UK TextEdit exports
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex: string) => {
    const code = parseInt(hex, 16);
    if (Number.isNaN(code)) return "";
    if (code >= 0x80 && code <= 0xff) {
      try {
        return new TextDecoder("windows-1252").decode(Uint8Array.of(code));
      } catch {
        return String.fromCharCode(code);
      }
    }
    return String.fromCharCode(code);
  });
  // Unicode escapes \uN?
  text = text.replace(/\\u(-?\d+)\??/g, (_m, n: string) => {
    const code = parseInt(n, 10);
    if (Number.isNaN(code)) return "";
    return String.fromCharCode(code < 0 ? 65536 + code : code);
  });
  // Control words and symbols
  text = text.replace(/\\[a-z]+(-?\d+)?[ ]?/gi, "");
  text = text.replace(/\\[^a-zA-Z]/g, "");
  text = text.replace(/[{}]/g, "");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(?:;+)$/.test(line) &&
        // Drop leftover font-table residue (e.g. "Times-Bold;Times-Roman;")
        !/^[A-Za-z0-9-]+(?:;[A-Za-z0-9-]*)*;?$/.test(line),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
