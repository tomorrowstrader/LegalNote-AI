import { describe, expect, it } from "vitest";
import { meetingWindowEnded, normalizeGuestEmail, normalizeGuestName } from "./guestMeetingDetails";

describe("guest meeting details", () => {
  it("accepts a normal email and rejects blanks", () => {
    expect(normalizeGuestEmail("  Ada@Firm.co.uk ")).toBe("ada@firm.co.uk");
    expect(normalizeGuestEmail("")).toBeNull();
    expect(normalizeGuestEmail("not-an-email")).toBeNull();
    expect(normalizeGuestEmail(null)).toBeNull();
  });

  it("trims a name and drops an empty one", () => {
    expect(normalizeGuestName("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(normalizeGuestName("   ")).toBeNull();
  });

  it("treats a meeting as over only after its end", () => {
    const start = new Date("2026-10-09T10:00:00.000Z");
    const end = new Date("2026-10-09T10:30:00.000Z");
    expect(meetingWindowEnded(start, end, new Date("2026-10-09T10:15:00.000Z"))).toBe(false);
    expect(meetingWindowEnded(start, end, new Date("2026-10-09T10:30:00.000Z"))).toBe(true);
    expect(meetingWindowEnded(start, null, new Date("2026-10-09T12:59:00.000Z"))).toBe(false);
    expect(meetingWindowEnded(start, null, new Date("2026-10-09T13:00:00.000Z"))).toBe(true);
  });
});