import { describe, expect, it, vi } from "vitest";
import type { GapSuggestionCandidate } from "@shared/reasoningGapSuggestion";
import { draftReasoningFromPassages } from "./reasoningGapSuggestionService";

const current: GapSuggestionCandidate = {
  sessionId: "s5",
  sessionLabel: "Meeting",
  dateLabel: "6 October 2026",
  earlier: false,
  kind: "transcript",
  utterances: [
    {
      speaker: "Solicitor",
      text: "I am advising you to postpone the carpal tunnel surgery because the NMC registration deadline is closer, and operating now would set that registration back.",
      start: 1000,
      end: 2000,
    },
  ],
};

const earlier: GapSuggestionCandidate = {
  sessionId: "s2",
  sessionLabel: "Meeting",
  dateLabel: "12 March 2026",
  earlier: true,
  kind: "attendance_note",
  utterances: [
    {
      text: "I advised postponing the carpal tunnel surgery, having considered that the NMC registration deadline was closer than the clinical need for the operation.",
      start: 0,
      end: 0,
    },
  ],
};

const topicOnly: GapSuggestionCandidate = {
  sessionId: "s5",
  sessionLabel: "Meeting",
  dateLabel: "6 October 2026",
  earlier: false,
  kind: "transcript",
  utterances: [
    { speaker: "Client", text: "We talked about the weather and the train.", start: 1, end: 2 },
  ],
};

describe("draftReasoningFromPassages", () => {
  it("does not call the model when nothing on the matter matches", async () => {
    const complete = vi.fn();
    const result = await draftReasoningFromPassages(
      "FERTILITY: impact on family planning",
      [topicOnly],
      complete,
    );
    expect(result.status).toBe("insufficient");
    expect(complete).not.toHaveBeenCalled();
  });

  it("drops a draft whose quote is not in the passage", async () => {
    const complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        status: "proposed",
        text: "I advised postponing surgery because the NMC deadline was closer.",
        quote: "this phrase was never said anywhere",
        sourceIndex: 0,
      }),
      inputTokens: 1,
      outputTokens: 1,
      cost: 0,
    });
    const result = await draftReasoningFromPassages(
      "SURGERY: postpone the carpal tunnel surgery",
      [current],
      complete,
    );
    expect(result.status).toBe("insufficient");
  });

  it("returns a grounded draft and names this meeting", async () => {
    const complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        status: "proposed",
        text: "I advised postponing the carpal tunnel surgery because the NMC registration deadline is closer.",
        quote: "postpone the carpal tunnel surgery because the NMC registration deadline is closer",
        sourceIndex: 0,
      }),
      inputTokens: 1,
      outputTokens: 1,
      cost: 0,
    });
    const result = await draftReasoningFromPassages(
      "SURGERY: postpone the carpal tunnel surgery",
      [current],
      complete,
    );
    expect(result.status).toBe("proposed");
    if (result.status === "proposed") {
      expect(result.sourceLabel).toBe("From this meeting.");
      expect(result.text).toContain("NMC registration deadline");
    }
  });

  it("requires the earlier meeting's date in the draft", async () => {
    const complete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        status: "proposed",
        text: "I advised postponing the carpal tunnel surgery because the NMC registration deadline was closer.",
        quote: "postponing the carpal tunnel surgery, having considered that the NMC registration deadline",
        sourceIndex: 0,
      }),
      inputTokens: 1,
      outputTokens: 1,
      cost: 0,
    });
    const missingDate = await draftReasoningFromPassages(
      "SURGERY: postpone the carpal tunnel surgery",
      [earlier],
      complete,
    );
    expect(missingDate.status).toBe("insufficient");

    complete.mockResolvedValue({
      content: JSON.stringify({
        status: "proposed",
        text: "This advice follows the reasoning I gave at the meeting on 12 March 2026, where I had considered that the NMC registration deadline was closer than the clinical need for the carpal tunnel surgery.",
        quote: "NMC registration deadline was closer than the clinical need",
        sourceIndex: 0,
      }),
      inputTokens: 1,
      outputTokens: 1,
      cost: 0,
    });
    const dated = await draftReasoningFromPassages(
      "SURGERY: postpone the carpal tunnel surgery",
      [earlier],
      complete,
    );
    expect(dated.status).toBe("proposed");
    if (dated.status === "proposed") {
      expect(dated.sourceLabel).toBe("From the attendance note of 12 March 2026.");
    }
  });
});
