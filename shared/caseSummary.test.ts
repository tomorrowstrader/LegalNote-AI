import { describe, it, expect } from "vitest";
import { buildCaseSummary, formatDuration } from "./caseSummary";

const rec = (o: Partial<Parameters<typeof buildCaseSummary>[0]["recordings"][number]> = {}) => ({
  meetingSessionId: null,
  duration: null,
  recordedAt: "2026-11-08T08:31:00Z",
  expiresAt: "2026-11-15T08:31:00Z",
  deletedAt: null,
  ...o,
});

describe("buildCaseSummary", () => {
  it("prefers the session duration and does not double count its recordings", () => {
    const s = buildCaseSummary({
      sessions: [{ id: "s1", startedAt: "2026-11-08T08:00:00Z", durationSeconds: 1800, recordingType: "telephone_call" }],
      recordings: [rec({ meetingSessionId: "s1", duration: 1750 })],
      documents: [],
      actionItems: [],
    });
    expect(s.totalDurationSeconds).toBe(1800);
    expect(s.meetingCount).toBe(1);
    expect(s.latestMeetingTypeLabel).toBe("Telephone Call");
  });

  it("falls back to recording durations and counts recordings with no session", () => {
    const s = buildCaseSummary({
      sessions: [{ id: "s1", startedAt: "2026-11-01T08:00:00Z", durationSeconds: null, recordingType: "full_meeting" }],
      recordings: [rec({ meetingSessionId: "s1", duration: 600 }), rec({ duration: 300 })],
      documents: [],
      actionItems: [],
    });
    expect(s.totalDurationSeconds).toBe(900);
    expect(s.meetingCount).toBe(2);
    // The unattached recording is newer, so its date wins and type is unknown.
    expect(s.latestMeetingAt).toBe("2026-11-08T08:31:00.000Z");
    expect(s.latestMeetingTypeLabel).toBeNull();
  });

  it("returns null duration when nothing has one", () => {
    const s = buildCaseSummary({ sessions: [], recordings: [rec()], documents: [], actionItems: [] });
    expect(s.totalDurationSeconds).toBeNull();
  });

  it("reports document status from active versions only", () => {
    const s = buildCaseSummary({
      sessions: [],
      recordings: [],
      documents: [
        { type: "attendance_note", status: "approved", isActive: true },
        { type: "attendance_note", status: "draft", isActive: true },
        { type: "summary", status: "draft", isActive: false },
      ],
      actionItems: [],
    });
    expect(s.attendanceNote).toEqual({ status: "draft", total: 2, approved: 1 });
    expect(s.summary.status).toBe("none");
  });

  it("counts open action items and the earliest audio expiry", () => {
    const s = buildCaseSummary({
      sessions: [],
      recordings: [
        rec({ expiresAt: "2026-11-20T00:00:00Z" }),
        rec({ expiresAt: "2026-11-12T00:00:00Z" }),
        rec({ expiresAt: "2026-11-10T00:00:00Z", deletedAt: "2026-11-09T00:00:00Z" }),
      ],
      documents: [],
      actionItems: [
        { status: "draft", completed: false },
        { status: "approved", completed: true },
        { status: "rejected", completed: false },
      ],
    });
    expect(s.openActionItems).toBe(1);
    expect(s.audio.expiresAt).toBe("2026-11-12T00:00:00.000Z");
    expect(s.audio.allDeleted).toBe(false);
  });

  it("flags when all audio is deleted", () => {
    const s = buildCaseSummary({
      sessions: [],
      recordings: [rec({ deletedAt: "2026-11-09T00:00:00Z" })],
      documents: [],
      actionItems: [],
    });
    expect(s.audio).toEqual({ expiresAt: null, allDeleted: true, hasAudio: true });
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 sec"],
    [600, "10 min"],
    [3600, "1 hr"],
    [3725, "1 hr 2 min"],
    [7170, "2 hr"],
  ])("%i -> %s", (input, out) => {
    expect(formatDuration(input)).toBe(out);
  });
});
