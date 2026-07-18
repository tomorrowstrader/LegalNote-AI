import { describe, expect, it } from "vitest";
import {
  coerceVerificationWarnings,
  findQuoteLocation,
  summarizeOpenVerificationWarnings,
  splitLegacyWarningText,
} from "./verificationWarnings";

describe("verificationWarnings", () => {
  it("splits legacy quote — explanation strings", () => {
    const { documentQuote, explanation } = splitLegacyWarningText(
      "I noted this is a Mesher order. — The term was not used at the meeting.",
    );
    expect(documentQuote).toContain("Mesher");
    expect(explanation).toContain("not used");
  });

  it("coerces legacy string arrays into structured warnings", () => {
    const warnings = coerceVerificationWarnings([
      "I noted this is sometimes referred to as a Mesher order. — The term 'Mesher order' was not used at the meeting.",
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].category).toBe("unsupported_attribution");
    expect(warnings[0].documentQuote).toContain("Mesher");
    expect(warnings[0].explanation).toContain("not used");
    expect(warnings[0].id).toBeTruthy();
  });

  it("finds quote locations in document text", () => {
    const doc = "Intro.\nI noted this is sometimes referred to as a Mesher order.\nNext.";
    const loc = findQuoteLocation(doc, "I noted this is sometimes referred to as a Mesher order.");
    expect(loc).not.toBeNull();
    expect(doc.slice(loc!.start, loc!.end)).toContain("Mesher");
  });

  it("summarizes open warnings by category", () => {
    const warnings = coerceVerificationWarnings([
      {
        id: "1",
        category: "unsupported_attribution",
        documentQuote: "I noted X",
        explanation: "not said",
        severity: "review_required",
      },
      {
        id: "2",
        category: "advice_without_reasoning",
        documentQuote: "I advised Y",
        explanation: "no reasoning",
        severity: "review_required",
      },
    ]);
    const summary = summarizeOpenVerificationWarnings(warnings);
    expect(summary).toContain("may introduce content");
    expect(summary).toContain("missing recorded reasoning");
  });
});
