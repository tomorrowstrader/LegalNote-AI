import { describe, expect, it } from "vitest";
import { earliestMeetingTime, formatUkLongDate, toUkIsoDate } from "./meetingTime";

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
