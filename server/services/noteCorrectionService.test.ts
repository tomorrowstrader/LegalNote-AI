import { describe, expect, it } from "vitest";
import { NoteCorrectionError, proposeNoteCorrection } from "./noteCorrectionService";
import type { PrivilegedCompleteRequest, PrivilegedCompleteResult } from "./llm/privilegedComplete";

const note = `**Client Name:** Sam Reid

**MATTERS DISCUSSED**

**What was discussed:**

The client instructed that a claim be brought. I advised the client to wait. A client care letter will follow.`;

function completeWith(body: unknown) {
  return async (request: PrivilegedCompleteRequest): Promise<PrivilegedCompleteResult> => {
    expect(request.systemPrompt).toContain("do not rewrite the note");
    expect(request.systemPrompt).toContain("the prospective client");
    expect(request.userPrompt).toContain("Alex Morgan");
    expect(request.userPrompt).toContain("Sam Reid");
    return {
      content: JSON.stringify(body),
      inputTokens: 1,
      outputTokens: 1,
      cost: 0,
    };
  };
}

describe("proposeNoteCorrection role", () => {
  it("returns tracked changes for who the note is about and drops a sentence that is not in the note", async () => {
    const result = await proposeNoteCorrection(
      {
        mode: "role",
        content: note,
        role: {
          clientName: "Alex Morgan",
          instructionsTaken: false,
          clientPresent: false,
          representativeName: "Sam Reid",
          adviserIsFeeEarner: true,
          adviserName: "",
          attendees: "",
        },
      },
      completeWith({
        proposals: [
          {
            original: "The client instructed that a claim be brought.",
            replacement: "Sam Reid stated that a claim be brought. That was Sam Reid's account, and not instructions from Alex Morgan.",
            reason: "Account",
          },
          {
            original: "This sentence is not in the note.",
            replacement: "This sentence was invented.",
            reason: "Dropped",
          },
        ],
      }),
    );

    expect(result.unplacedCount).toBe(1);
    expect(result.proposals.some((proposal) => proposal.placement === "before" && proposal.replacement.includes("prospective client"))).toBe(true);
    expect(result.proposals.some((proposal) => proposal.reason === "Account")).toBe(true);
    expect(result.proposals.some((proposal) => proposal.original === "the client" && proposal.replacement === "the prospective client")).toBe(true);
    expect(result.proposals.some((proposal) => /client care/i.test(proposal.original))).toBe(false);
    expect(result.proposals.every((proposal) => proposal.id.length > 0)).toBe(true);
  });

  it("still proposes the opening line when the model call fails", async () => {
    const result = await proposeNoteCorrection(
      {
        mode: "role",
        content: note,
        role: {
          clientName: "Alex Morgan",
          instructionsTaken: false,
          clientPresent: false,
          representativeName: "Sam Reid",
          adviserIsFeeEarner: true,
          adviserName: "",
          attendees: "",
        },
      },
      async () => {
        throw new Error("model unavailable");
      },
    );
    expect(result.proposals.some((proposal) => proposal.placement === "before")).toBe(true);
  });

  it("rejects a role that does not change who the note is about", async () => {
    await expect(
      proposeNoteCorrection({
        mode: "role",
        content: note,
        role: {
          clientName: "Alex Morgan",
          instructionsTaken: true,
          clientPresent: true,
          representativeName: "",
          adviserIsFeeEarner: true,
          adviserName: "",
          attendees: "",
        },
      }),
    ).rejects.toBeInstanceOf(NoteCorrectionError);
  });
});
