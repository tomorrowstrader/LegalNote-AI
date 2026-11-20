import { describe, expect, it } from "vitest";
import { documentBelongsToOtherSession, documentForSession, sessionIdentityLabel } from "./sessionDocuments";

const docs = [
  { id: "n3", type: "attendance_note", meetingSessionId: "s3" },
  { id: "l3", type: "client_letter", meetingSessionId: "s3" },
  { id: "n1", type: "attendance_note", meetingSessionId: "s1" },
  { id: "care", type: "client_care_letter", meetingSessionId: null },
];

describe("documentForSession", () => {
  it("shows a session its own note", () => {
    expect(documentForSession(docs, "attendance_note", { focusSessionId: "s1", sessionCount: 4 })?.id).toBe("n1");
  });

  it("never borrows another session's note for an unprocessed session (the session 4 trap)", () => {
    expect(documentForSession(docs, "attendance_note", { focusSessionId: "s4", sessionCount: 4 })).toBeUndefined();
    expect(documentForSession(docs, "client_letter", { focusSessionId: "s4", sessionCount: 4 })).toBeUndefined();
  });

  it("still shows the matter's client care letter under any session", () => {
    expect(documentForSession(docs, "client_care_letter", { focusSessionId: "s4", sessionCount: 4 })?.id).toBe("care");
  });

  it("shows an older unattached note on a single-session matter", () => {
    const legacy = [{ id: "old", type: "attendance_note", meetingSessionId: null }];
    expect(documentForSession(legacy, "attendance_note", { focusSessionId: "s1", sessionCount: 1 })?.id).toBe("old");
    expect(documentForSession(legacy, "attendance_note", { focusSessionId: "s2", sessionCount: 2 })).toBeUndefined();
  });

  it("keeps the latest document when no session is selected", () => {
    expect(documentForSession(docs, "attendance_note", { focusSessionId: null, sessionCount: 4 })?.id).toBe("n3");
  });
});

describe("documentBelongsToOtherSession", () => {
  it("flags a document from a different session", () => {
    expect(documentBelongsToOtherSession({ type: "attendance_note", meetingSessionId: "s3" }, "s4")).toBe(true);
    expect(documentBelongsToOtherSession({ type: "attendance_note", meetingSessionId: "s4" }, "s4")).toBe(false);
    expect(documentBelongsToOtherSession({ type: "client_care_letter", meetingSessionId: null }, "s4")).toBe(false);
  });
});

describe("sessionIdentityLabel", () => {
  const sessions = [
    { id: "s4", startedAt: "2026-11-10T16:05:47Z", recordingType: "internal_meeting" },
    { id: "s1", startedAt: "2026-10-06T14:05:30Z", recordingType: "full_meeting" },
    { id: "s3", startedAt: "2026-11-10T15:12:51Z", recordingType: "full_meeting" },
    { id: "s2", startedAt: "2026-11-05T15:00:00Z", recordingType: "full_meeting" },
  ];
  const labels = { full_meeting: "Full meeting", internal_meeting: "Internal meeting" };

  it("numbers by meeting date and names type and UK time", () => {
    expect(sessionIdentityLabel("s3", sessions, labels)).toBe("Session 3 of 4 · Full meeting · 10 Nov, 15:12");
    expect(sessionIdentityLabel("s4", sessions, labels)).toBe("Session 4 of 4 · Internal meeting · 10 Nov, 16:05");
  });

  it("returns null for a document with no session", () => {
    expect(sessionIdentityLabel(null, sessions, labels)).toBeNull();
  });
});
