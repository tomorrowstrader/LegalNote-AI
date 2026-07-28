import { describe, expect, it } from "vitest";
import {
  enrichContentWithGapEvidence,
  evidenceForGap,
  parseGapsWithEvidence,
  replaceGapMarkerAndEvidence,
  resolveGapTranscriptEvidence,
  stripGapEvidenceComments,
  utterancesHaveRealTimestamps,
} from "./reasoningGapEvidence";

const UTTERANCES = [
  { speaker: "Priya", text: "That is not the law and I'd rather you heard that from me now.", start: 10000, end: 15000 },
  { speaker: "Priya", text: "No. Right. Stop paying the mortgage.", start: 60000, end: 65000 },
  { speaker: "Adam", text: "Stop paying it?", start: 66000, end: 68000 },
  { speaker: "Priya", text: "Stop paying it. We'll write to the other side this week and tell them.", start: 69000, end: 75000 },
  {
    speaker: "Priya",
    text: "You need one, and you need to do it now, not in six months. I'll tell you exactly why in a minute.",
    start: 90000,
    end: 98000,
  },
  { speaker: "Adam", text: "Can you do them?", start: 99000, end: 100000 },
];

describe("resolveGapTranscriptEvidence", () => {
  it("matches mortgage advice to the stop-paying utterance", () => {
    const evidence = resolveGapTranscriptEvidence(
      "MORTGAGE CONTRIBUTIONS: stop paying the mortgage",
      UTTERANCES,
    );
    expect(evidence).not.toBeNull();
    expect(evidence!.utteranceIndex).toBe(1);
    expect(evidence!.quote.toLowerCase()).toContain("mortgage");
    expect(evidence!.startMs).toBe(60000);
    expect(evidence!.contextStart).toBe(0);
    expect(evidence!.contextEnd).toBe(3);
  });

  it("matches will advice to the now-not-six-months utterance", () => {
    const evidence = resolveGapTranscriptEvidence(
      "WILLS, LASTING POWER OF ATTORNEY AND SEVERANCE: need for a will now, not in six months",
      UTTERANCES,
    );
    expect(evidence).not.toBeNull();
    expect(evidence!.utteranceIndex).toBe(4);
    expect(evidence!.quote.toLowerCase()).toContain("six months");
  });

  it("returns null when nothing relevant appears in the transcript", () => {
    const evidence = resolveGapTranscriptEvidence(
      "PENSION SHARING: transfer of the railway pot",
      UTTERANCES,
    );
    expect(evidence).toBeNull();
  });
});

describe("utterancesHaveRealTimestamps", () => {
  it("detects ordinal upload indices as non-real", () => {
    expect(
      utterancesHaveRealTimestamps([
        { text: "a", start: 0, end: 1 },
        { text: "b", start: 1, end: 2 },
        { text: "c", start: 2, end: 3 },
      ]),
    ).toBe(false);
  });

  it("detects recording milliseconds as real", () => {
    expect(utterancesHaveRealTimestamps(UTTERANCES)).toBe(true);
  });
});

describe("enrich / parse / replace", () => {
  const note = `
Reasoning behind advice and decisions:
<!-- REASONING_GAP: MORTGAGE CONTRIBUTIONS: stop paying the mortgage -->

Client's instructions.
<!-- REASONING_GAP: WILLS: need for a will now, not in six months -->
`;

  it("writes evidence comments beside gap markers", () => {
    const enriched = enrichContentWithGapEvidence(note, UTTERANCES);
    const gaps = parseGapsWithEvidence(enriched);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].evidence?.utteranceIndex).toBe(1);
    expect(gaps[1].evidence?.utteranceIndex).toBe(4);
    expect(enriched).toContain("RGAP_EVIDENCE");
  });

  it("replaceGapMarkerAndEvidence removes the evidence comment with the marker", () => {
    const enriched = enrichContentWithGapEvidence(note, UTTERANCES);
    const replaced = replaceGapMarkerAndEvidence(
      enriched,
      0,
      "I advised stopping the mortgage having regard to the risk of voluntary payments being characterised as maintenance.",
    );
    const gaps = parseGapsWithEvidence(replaced);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].label).toMatch(/WILLS/);
    expect(replaced).not.toContain("stop paying the mortgage -->");
  });

  it("stripGapEvidenceComments leaves gap markers intact", () => {
    const enriched = enrichContentWithGapEvidence(note, UTTERANCES);
    const stripped = stripGapEvidenceComments(enriched);
    expect(stripped).not.toContain("RGAP_EVIDENCE");
    expect(parseGapsWithEvidence(stripped)).toHaveLength(2);
    expect(parseGapsWithEvidence(stripped)[0].evidence).toBeNull();
  });
});

describe("evidenceForGap", () => {
  it("prefers stored evidence over live resolution", () => {
    const stored = {
      utteranceIndex: 99,
      contextStart: 98,
      contextEnd: 99,
      quote: "stored",
      startMs: 1,
      endMs: 2,
      score: 1,
    };
    expect(evidenceForGap(stored, "MORTGAGE: stop paying", UTTERANCES)?.quote).toBe("stored");
  });

  it("falls back to live resolution", () => {
    const live = evidenceForGap(null, "MORTGAGE CONTRIBUTIONS: stop paying the mortgage", UTTERANCES);
    expect(live?.utteranceIndex).toBe(1);
  });
});
