/**
 * Convert RTF (including TextEdit exports renamed to .txt) to plain text.
 * Returns the input unchanged when it is not RTF.
 */
export function stripRtfToPlainText(raw: string): string {
  const trimmed = raw.replace(/^\uFEFF/, "").trimStart();
  if (!trimmed.startsWith("{\\rtf")) return raw;

  let text = trimmed;
  // Drop binary / picture / font destination groups
  text = text.replace(/\{\\\*\\[^{}]*\}/g, " ");
  text = text.replace(/\{\\fonttbl[^{}]*\}/gi, " ");
  text = text.replace(/\{\\colortbl[^{}]*\}/gi, " ");
  text = text.replace(/\{\\stylesheet[^{}]*\}/gi, " ");
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
    .filter((line) => line.length > 0 && !/^(?:;+)$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
