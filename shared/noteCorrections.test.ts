import { describe, expect, it } from "vitest";
import {
  attendanceNoteToPlain,
  keepPlaceableProposals,
  proposeNameReplacements,
  resolvePassage,
} from "./noteCorrections";

const note = `The meeting was attended by Jaz Dennis on behalf of the client, Tyanna Davey.

The client's partner was not present at the time of the birth.

Jazz Dennis confirmed the account.`;

describe("note corrections", () => {
  it("replaces Jaz and leaves Jazz alone", () => {
    const proposals = proposeNameReplacements(note, "Jaz", "Jazz");
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.original).toBe("Jaz");
    expect(proposals[0]?.replacement).toBe("Jazz");
    expect(note.slice(note.indexOf("Jazz"))).toContain("Jazz Dennis confirmed");
  });

  it("drops a quote that is not in the note and keeps one that is", () => {
    const { kept, unplaced } = keepPlaceableProposals(note, [
      {
        original: "The client's partner was not present at the time of the birth.",
        replacement: "Jazz was present at the delivery. His partner was absent afterwards.",
        reason: "Presence",
      },
      {
        original: "The client underwent an elective procedure.",
        replacement: "The client underwent an emergency C-section.",
        reason: "Not in the note",
      },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.original).toContain("partner was not present");
    expect(unplaced).toHaveLength(1);
  });

  it("keeps the longer quote when a shorter one sits inside it", () => {
    const { kept } = keepPlaceableProposals(note, [
      {
        original: "The client's partner was not present at the time of the birth.",
        replacement: "Jazz was present at the delivery.",
        reason: "Sentence",
      },
      {
        original: "partner was not present",
        replacement: "partner was present",
        reason: "Clause",
      },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.reason).toBe("Sentence");
  });

  it("matches a selected passage despite curly quotes and page chrome", () => {
    const plain = "The client was not present. Her partner attended and spoke on her behalf.";
    expect(resolvePassage(plain, "The client was not present.")).toBe("The client was not present.");
    expect(
      resolvePassage(plain, "The client was not present. Page 2"),
    ).toBe("The client was not present.");
    expect(
      resolvePassage(plain, "Reasoning needed — The client was not present. Her partner attended"),
    ).toContain("The client was not present.");
    expect(resolvePassage(plain, "This sentence is not in the note at all.")).toBeNull();
  });

  it("strips emphasis so a quote can match the words on the page", () => {
    const plain = attendanceNoteToPlain("**What was discussed:**\n\nThe client was absent.");
    expect(plain).toContain("What was discussed:");
    expect(plain).not.toContain("**");
  });
});
