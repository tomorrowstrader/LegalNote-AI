import { describe, expect, it } from "vitest";
import {
  assembleRoleProposals,
  attendanceNoteToPlain,
  keepPlaceableProposals,
  noteRoleError,
  proposeNameReplacements,
  resolvePassage,
  type NoteRole,
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

const prospectiveRole: NoteRole = {
  clientName: "Alex Morgan",
  instructionsTaken: false,
  clientPresent: false,
  representativeName: "Sam Reid",
  adviserIsFeeEarner: true,
  adviserName: "",
  attendees: "",
};

const draftedNote = `**Client Name:** Sam Reid

**MATTERS DISCUSSED**

**What was discussed:**

The client instructed that a claim be brought. I advised the client to wait. A client care letter will follow.

The client's partner gave the account.`;

describe("who this note is about", () => {
  it("asks for the person, the attendee, or the adviser when that detail is missing", () => {
    expect(noteRoleError({ ...prospectiveRole, clientName: "" })).toMatch(/person this note is about/);
    expect(noteRoleError({ ...prospectiveRole, representativeName: "" })).toMatch(/who attended/);
    expect(
      noteRoleError({
        ...prospectiveRole,
        instructionsTaken: true,
        clientPresent: true,
        representativeName: "",
      }),
    ).toMatch(/what should change/);
    expect(
      noteRoleError({
        ...prospectiveRole,
        instructionsTaken: true,
        clientPresent: true,
        adviserIsFeeEarner: false,
        adviserName: "",
      }),
    ).toMatch(/gave the advice/);
  });

  it("inserts an opening line, renames the client, and leaves client care alone", () => {
    const plain = attendanceNoteToPlain(draftedNote);
    const { kept } = assembleRoleProposals(plain, prospectiveRole, []);
    const opening = kept.find((proposal) => proposal.placement === "before");
    expect(opening?.original).toBe("The client instructed that a claim be brought.");
    expect(opening?.replacement).toContain("Alex Morgan is the prospective client.");
    expect(opening?.replacement).toContain("Sam Reid attended and spoke on behalf of Alex Morgan.");
    expect(opening?.replacement).toContain("not instructions from Alex Morgan");

    const phrases = kept.filter((proposal) => proposal.reason === "Prospective client").map((proposal) => proposal.original);
    expect(phrases).toContain("The client");
    expect(phrases).toContain("the client");
    expect(phrases).toContain("The client's");
    expect(phrases.join(" ")).not.toMatch(/care/i);

    const header = kept.find((proposal) => proposal.original.startsWith("Client Name:"));
    expect(header?.replacement).toBe("Client Name: Alex Morgan (prospective client)");
    expect(kept.some((proposal) => proposal.original === "I advised")).toBe(false);

    const curly = assembleRoleProposals(
      "What was discussed:\n\nThe client\u2019s partner attended. A client care letter will follow.",
      prospectiveRole,
      [],
    );
    expect(curly.kept.some((proposal) => proposal.original === "The client\u2019s" && proposal.replacement === "The prospective client\u2019s")).toBe(true);
    expect(curly.kept.some((proposal) => /care/i.test(proposal.original))).toBe(false);
  });

  it("lets a corrected sentence stand in place of the role word inside it", () => {
    const plain = attendanceNoteToPlain(draftedNote);
    const { kept, unplaced } = assembleRoleProposals(plain, prospectiveRole, [
      {
        original: "The client instructed that a claim be brought.",
        replacement: "Sam Reid stated that a claim be brought. That was Sam Reid's account, and not instructions from Alex Morgan.",
        reason: "Account",
      },
      {
        original: "The firm has already been retained.",
        replacement: "The firm has not been retained.",
        reason: "Not in the note",
      },
    ]);
    expect(unplaced).toHaveLength(1);
    expect(kept.some((proposal) => proposal.reason === "Account")).toBe(true);
    expect(kept.filter((proposal) => proposal.original === "The client")).toHaveLength(0);
    expect(kept.some((proposal) => proposal.original === "the client")).toBe(true);
    expect(kept.some((proposal) => proposal.placement === "before")).toBe(true);
  });

  it("attributes advice when someone else gave it, and keeps an ordinary client reference when instructions have been taken", () => {
    const plain = attendanceNoteToPlain(draftedNote);
    const { kept } = assembleRoleProposals(plain, {
      ...prospectiveRole,
      instructionsTaken: true,
      clientPresent: true,
      representativeName: "",
      adviserIsFeeEarner: false,
      adviserName: "Jordan Lee",
    }, []);
    expect(kept.find((proposal) => proposal.placement === "before")?.replacement).toBe("Jordan Lee gave the advice.");
    expect(kept.some((proposal) => proposal.original === "I advised" && proposal.replacement === "Jordan Lee advised")).toBe(true);
    expect(kept.some((proposal) => proposal.reason === "Prospective client")).toBe(false);
    expect(kept.find((proposal) => proposal.original.startsWith("Client Name:"))?.replacement).toBe("Client Name: Alex Morgan");
  });
});
