import { describe, expect, it } from "vitest";
import {
  carriedHoldReason,
  checkRecoveredMoveTarget,
  recoveredMoveSourceBlock,
  type RecoveredMoveSourceFacts,
} from "./recoveredRecordingMove";

const movable: RecoveredMoveSourceFacts = {
  recovered: true,
  caseStatus: "pending",
  hasTranscript: false,
  documentCount: 0,
  consentLogCount: 0,
  recordingCount: 1,
  sessionCount: 1,
  audioDeleted: false,
};

describe("recoveredMoveSourceBlock", () => {
  it("allows an untouched recovered recording", () => {
    expect(recoveredMoveSourceBlock(movable)).toBeNull();
    expect(recoveredMoveSourceBlock({ ...movable, sessionCount: 0 })).toBeNull();
  });

  it("refuses a case that did not come from recovery", () => {
    expect(recoveredMoveSourceBlock({ ...movable, recovered: false })).toBe("not_recovered");
  });

  it("refuses once sealed consent exists, because it cannot move", () => {
    expect(recoveredMoveSourceBlock({ ...movable, consentLogCount: 1 })).toBe("has_consent");
  });

  it("refuses once anything has been produced or is being produced", () => {
    expect(recoveredMoveSourceBlock({ ...movable, caseStatus: "processing" })).toBe("processing");
    expect(recoveredMoveSourceBlock({ ...movable, hasTranscript: true })).toBe("has_transcript");
    expect(recoveredMoveSourceBlock({ ...movable, documentCount: 2 })).toBe("has_documents");
  });

  it("refuses when there is not exactly one live recording and session", () => {
    expect(recoveredMoveSourceBlock({ ...movable, recordingCount: 0 })).toBe("no_recording");
    expect(recoveredMoveSourceBlock({ ...movable, recordingCount: 2 })).toBe("several_recordings");
    expect(recoveredMoveSourceBlock({ ...movable, sessionCount: 2 })).toBe("several_sessions");
    expect(recoveredMoveSourceBlock({ ...movable, audioDeleted: true })).toBe("audio_deleted");
  });
});

describe("checkRecoveredMoveTarget", () => {
  const areas = ["clinical_negligence", "family"] as const;
  const clientMatter = { id: "t1", matterKind: "client", practiceArea: "clinical_negligence", archived: false };

  it("accepts a client matter and a client type", () => {
    expect(
      checkRecoveredMoveTarget({ sourceCaseId: "s1", target: clientMatter, recordingType: "full_meeting", practiceAreas: areas }),
    ).toEqual({ ok: true, recordingType: "full_meeting", setPracticeArea: null });
  });

  it("refuses a missing, archived or same matter", () => {
    expect(checkRecoveredMoveTarget({ sourceCaseId: "s1", target: null, recordingType: "full_meeting", practiceAreas: areas }))
      .toMatchObject({ ok: false, status: 404 });
    expect(checkRecoveredMoveTarget({ sourceCaseId: "t1", target: clientMatter, recordingType: "full_meeting", practiceAreas: areas }))
      .toMatchObject({ ok: false, status: 400 });
    expect(checkRecoveredMoveTarget({ sourceCaseId: "s1", target: { ...clientMatter, archived: true }, recordingType: "full_meeting", practiceAreas: areas }))
      .toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a type the matter does not allow", () => {
    const internal = { id: "t2", matterKind: "internal", archived: false };
    expect(checkRecoveredMoveTarget({ sourceCaseId: "s1", target: internal, recordingType: "full_meeting", practiceAreas: areas }))
      .toMatchObject({ ok: false, status: 400 });
  });

  it("needs a practice area for a client matter that has none", () => {
    const bare = { ...clientMatter, practiceArea: null };
    expect(checkRecoveredMoveTarget({ sourceCaseId: "s1", target: bare, recordingType: "full_meeting", practiceAreas: areas }))
      .toMatchObject({ ok: false, status: 400 });
    expect(checkRecoveredMoveTarget({ sourceCaseId: "s1", target: bare, recordingType: "full_meeting", practiceArea: "family", practiceAreas: areas }))
      .toEqual({ ok: true, recordingType: "full_meeting", setPracticeArea: "family" });
  });
});

describe("carriedHoldReason", () => {
  it("names where the hold came from and keeps the original reason", () => {
    expect(carriedHoldReason("Recovered Recording - 08/11/2026", "Anticipated claim"))
      .toBe('Carried over with a recovered recording moved from "Recovered Recording - 08/11/2026". Original reason: Anticipated claim');
    expect(carriedHoldReason("R", "  ")).toBe('Carried over with a recovered recording moved from "R".');
  });
});
