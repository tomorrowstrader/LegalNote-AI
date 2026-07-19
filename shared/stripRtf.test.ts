import { describe, expect, it } from "vitest";
import { looksLikeRtf, stripRtfToPlainText } from "./stripRtf";

describe("stripRtfToPlainText", () => {
  it("returns plain text unchanged", () => {
    expect(stripRtfToPlainText("Hello client.")).toBe("Hello client.");
  });

  it("detects RTF payloads", () => {
    expect(looksLikeRtf("{\\rtf1\\ansi hi}")).toBe(true);
    expect(looksLikeRtf("Solicitor: Hello")).toBe(false);
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

  it("strips nested TextEdit fonttbl without leaving font names or control words", () => {
    const rtf = `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2761
\\cocoatextscaling0\\cocoaplatform0{\\fonttbl{\\f0\\froman\\fcharset0 Times-Bold;}{\\f1\\froman\\fcharset0 Times-Roman;}}
{\\colortbl;\\red255\\green255\\blue255;\\red0\\green0\\blue0;}
{\\*\\expandedcolortbl;;\\cssrgb\\c0\\c0\\c0;}
\\pard\\tx560\\pardirnatural\\partightenfactor0

\\f0\\b\\fs24 \\strokec2 Priya:\\
\\f1\\b0 \\strokec2 Adam, can you hear me all right? Your video's frozen a bit.\\
\\f0\\b \\strokec2 Adam:\\
\\f1\\b0 \\strokec2 Yes, sorry — is that better now?\\
}`;
    const plain = stripRtfToPlainText(rtf);
    expect(plain).toContain("Priya:");
    expect(plain).toContain("Adam, can you hear me all right?");
    expect(plain).toContain("Adam:");
    expect(plain).toContain("Yes, sorry");
    expect(plain).not.toContain("\\rtf");
    expect(plain).not.toContain("cocoartf");
    expect(plain).not.toContain("Times-Bold");
    expect(plain).not.toContain("Times-Roman");
    expect(plain).not.toContain("{");
  });
});
