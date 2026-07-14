import { describe, expect, it } from "vitest";
import { validateRecordingType } from "./recordingTypes";

describe("validateRecordingType", () => {
  it("accepts the five client-facing recording types", () => {
    for (const type of [
      "full_meeting",
      "telephone_call",
      "file_note",
      "court_hearing",
      "police_station",
    ] as const) {
      expect(validateRecordingType(type)).toEqual({ ok: true, recordingType: type });
    }
  });

  it("rejects removed recording types with permitted list", () => {
    expect(validateRecordingType("internal_meeting")).toEqual({
      ok: false,
      message:
        "Invalid recording type. Permitted types: full_meeting, telephone_call, file_note, court_hearing, police_station",
    });
    expect(validateRecordingType("supervision")).toEqual({
      ok: false,
      message:
        "Invalid recording type. Permitted types: full_meeting, telephone_call, file_note, court_hearing, police_station",
    });
  });
});
