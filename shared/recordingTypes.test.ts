import { describe, expect, it } from "vitest";
import {
  defaultRecordingTypeForMatterKind,
  shouldGenerateClientLetter,
  validateRecordingType,
} from "./recordingTypes";

describe("validateRecordingType", () => {
  it("accepts client-facing and internal recording types", () => {
    for (const type of [
      "full_meeting",
      "telephone_call",
      "file_note",
      "court_hearing",
      "police_station",
      "internal_meeting",
    ] as const) {
      expect(validateRecordingType(type)).toEqual({ ok: true, recordingType: type });
    }
  });

  it("rejects unknown recording types with permitted list", () => {
    expect(validateRecordingType("supervision")).toEqual({
      ok: false,
      message:
        "Invalid recording type. Permitted types: full_meeting, telephone_call, file_note, court_hearing, police_station, internal_meeting",
    });
  });

  it("restricts types by matter kind", () => {
    expect(validateRecordingType("internal_meeting", { matterKind: "client" }).ok).toBe(false);
    expect(validateRecordingType("full_meeting", { matterKind: "internal" }).ok).toBe(false);
    expect(validateRecordingType("internal_meeting", { matterKind: "internal" })).toEqual({
      ok: true,
      recordingType: "internal_meeting",
    });
  });
});

describe("shouldGenerateClientLetter", () => {
  it("skips letters for internal matters and internal recording types", () => {
    expect(shouldGenerateClientLetter({ matterKind: "internal" })).toBe(false);
    expect(shouldGenerateClientLetter({ matterKind: "firm" })).toBe(false);
    expect(shouldGenerateClientLetter({ recordingType: "internal_meeting" })).toBe(false);
    expect(shouldGenerateClientLetter({ matterKind: "client", recordingType: "full_meeting" })).toBe(
      true,
    );
  });
});

describe("defaultRecordingTypeForMatterKind", () => {
  it("defaults sensibly by kind", () => {
    expect(defaultRecordingTypeForMatterKind("client")).toBe("full_meeting");
    expect(defaultRecordingTypeForMatterKind("internal")).toBe("internal_meeting");
    expect(defaultRecordingTypeForMatterKind("firm")).toBe("internal_meeting");
  });
});
