import { describe, expect, it } from "vitest";
import {
  normalizeUploadedTranscript,
  parseSpeakerUtterances,
  sanitizeTranscriptText,
} from "./normalizeUploadedTranscript";

describe("sanitizeTranscriptText", () => {
  it("strips BOM and normalizes newlines", () => {
    expect(sanitizeTranscriptText("\uFEFFhello\r\nworld\r")).toBe("hello\nworld");
  });

  it("strips RTF markup from TextEdit-style exports", () => {
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252\\pard Solicitor: Good morning.\\par Client: Hello there, this is long enough.\\par}";
    const plain = sanitizeTranscriptText(rtf);
    expect(plain).toContain("Solicitor: Good morning.");
    expect(plain).toContain("Client: Hello there");
    expect(plain).not.toContain("\\rtf");
  });
});

describe("parseSpeakerUtterances", () => {
  it("parses bracketed speaker labels", () => {
    const text = `[Solicitor]: Good morning.\n[Client]: Hello.`;
    const utterances = parseSpeakerUtterances(text);
    expect(utterances).toHaveLength(2);
    expect(utterances[0].speaker).toBe("Solicitor");
    expect(utterances[1].text).toBe("Hello.");
    expect(utterances[0].start).toBe(0);
    expect(utterances[1].start).toBe(1);
  });

  it("parses TextEdit-style speaker-only lines", () => {
    const text = `Priya:\nAdam, can you hear me?\nAdam:\nYes, sorry — is that better?`;
    const utterances = parseSpeakerUtterances(text);
    expect(utterances).toHaveLength(2);
    expect(utterances[0].speaker).toBe("Priya");
    expect(utterances[0].text).toContain("Adam, can you hear me?");
    expect(utterances[1].speaker).toBe("Adam");
    expect(utterances[1].text).toContain("Yes, sorry");
  });

  it("returns empty when only one speaker", () => {
    expect(parseSpeakerUtterances("[A]: Only me talking throughout.")).toEqual([]);
  });
});

describe("normalizeUploadedTranscript", () => {
  it("keeps plain prose without fabricating speakers", () => {
    const prose =
      "We discussed the proposed settlement and the client confirmed they wished to proceed subject to costs advice.";
    const result = normalizeUploadedTranscript(prose);
    expect(result.utterances).toBeUndefined();
    expect(result.content).toContain("settlement");
  });

  it("rejects short transcripts", () => {
    expect(() => normalizeUploadedTranscript("too short")).toThrow(/too short/i);
  });

  it("accepts RTF that expands to sufficient plain text", () => {
    const rtf =
      "{\\rtf1\\ansi\\pard We discussed the proposed settlement and the client confirmed they wished to proceed subject to costs advice.\\par}";
    const result = normalizeUploadedTranscript(rtf);
    expect(result.content).toContain("settlement");
    expect(result.content).not.toContain("\\pard");
  });
});
