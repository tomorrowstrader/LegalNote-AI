import { describe, expect, it } from "vitest";
import { earliestMeetingTime, formatUkLongDate, sessionStartFromRecording, toUkIsoDate } from "./meetingTime";

describe("UK meeting dates", () => {
  it("uses the UK day for a late evening meeting in summer time", () => {
    const lateInUk = new Date("2026-07-10T23:30:00Z");
    expect(formatUkLongDate(lateInUk)).toBe("11 July 2026");
    expect(toUkIsoDate(lateInUk)).toBe("2026-07-11");
  });

  it("uses the same day in winter, when the UK matches UTC", () => {
    const lateInUk = new Date("2026-12-10T23:30:00Z");
    expect(formatUkLongDate(lateInUk)).toBe("10 December 2026");
    expect(toUkIsoDate(lateInUk)).toBe("2026-12-10");
  });
});

describe("earliestMeetingTime", () => {
  it("prefers the earlier time when a recording was filed after the meeting", () => {
    expect(earliestMeetingTime("2026-10-24T09:00:00Z", new Date("2026-10-23T14:00:00Z"))?.toISOString())
      .toBe("2026-10-23T14:00:00.000Z");
  });

  it("ignores missing and invalid times, and never makes one up", () => {
    expect(earliestMeetingTime(null, "not a date", "2026-10-23T14:00:00Z")?.toISOString())
      .toBe("2026-10-23T14:00:00.000Z");
    expect(earliestMeetingTime(null, undefined)).toBeUndefined();
  });
});

describe("sessionStartFromRecording", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("dates a late-filed session from when its recording began", () => {
    const filedToday = new Date("2026-11-10T11:00:00Z");
    const recordedTwoDaysAgo = new Date("2026-11-08T09:30:00Z");
    expect(sessionStartFromRecording(filedToday, recordedTwoDaysAgo, now)).toEqual(recordedTwoDaysAgo);
  });

  it("puts sessions filed out of order back into meeting order", () => {
    const sessions = [
      { id: "s1", startedAt: new Date("2026-11-01T10:00:00Z") },
      { id: "s2", startedAt: new Date("2026-11-04T10:00:00Z") },
      // Filed after today's meeting, though it happened two days ago
      { id: "late", startedAt: new Date("2026-11-10T11:30:00Z"), recordedAt: new Date("2026-11-08T14:00:00Z") },
      { id: "today", startedAt: new Date("2026-11-10T10:00:00Z") },
    ];
    const corrected = sessions.map((s) => ({
      id: s.id,
      startedAt: sessionStartFromRecording(s.startedAt, s.recordedAt, now) ?? s.startedAt,
    }));
    const order = [...corrected].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()).map((s) => s.id);
    expect(order).toEqual(["s1", "s2", "late", "today"]);
  });

  it("never moves a session later", () => {
    expect(sessionStartFromRecording("2026-11-08T09:00:00Z", "2026-11-08T09:05:00Z", now)).toBeNull();
  });

  it("ignores a recording start in the future", () => {
    expect(sessionStartFromRecording("2026-11-10T11:00:00Z", "2026-11-11T09:00:00Z", now)).toBeNull();
  });

  it("ignores a missing or unreadable recording start", () => {
    expect(sessionStartFromRecording("2026-11-10T11:00:00Z", null, now)).toBeNull();
    expect(sessionStartFromRecording("2026-11-10T11:00:00Z", "not a date", now)).toBeNull();
  });
});
