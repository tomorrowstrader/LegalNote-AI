import { describe, expect, it } from "vitest";
import { stripRtfToPlainText } from "./stripRtf";

describe("stripRtfToPlainText", () => {
  it("returns plain text unchanged", () => {
    expect(stripRtfToPlainText("Hello client.")).toBe("Hello client.");
  });

  it("extracts readable prose from minimal RTF", () => {
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252\\pard\\f0\\fs24 Solicitor: Good morning.\\par Client: Hello.\\par}";
    const plain = stripRtfToPlainText(rtf);
    expect(plain).toContain("Solicitor: Good morning.");
    expect(plain).toContain("Client: Hello.");
    expect(plain).not.toContain("\\rtf");
    expect(plain).not.toContain("{");
  });

  it("decodes hex escapes", () => {
    // \'93 / \'94 are curly quotes in windows-1252
    const rtf = "{\\rtf1\\ansi The client said \\'93yes\\'94.}";
    const plain = stripRtfToPlainText(rtf);
    expect(plain.toLowerCase()).toContain("yes");
  });
});
