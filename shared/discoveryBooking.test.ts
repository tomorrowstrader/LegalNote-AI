import { describe, expect, it } from "vitest";
import {
  DISCOVERY_BOOKING,
  computeAvailableSlots,
  generateCandidateSlots,
  isOfferedSlot,
  localDateKey,
  zonedTimeToUtc,
  type DiscoveryBookingConfig,
} from "./discoveryBooking";

const config: DiscoveryBookingConfig = { ...DISCOVERY_BOOKING, closedDates: [] };

describe("zonedTimeToUtc", () => {
  it("handles GMT and BST", () => {
    expect(zonedTimeToUtc("2026-12-01", "09:30", "Europe/London").toISOString()).toBe("2026-12-01T09:30:00.000Z");
    expect(zonedTimeToUtc("2027-06-01", "09:30", "Europe/London").toISOString()).toBe("2027-06-01T08:30:00.000Z");
  });

  it("handles the day the clocks go forward", () => {
    expect(zonedTimeToUtc("2027-03-28", "13:30", "Europe/London").toISOString()).toBe("2027-03-28T12:30:00.000Z");
  });
});

describe("generateCandidateSlots", () => {
  // Monday 30 Nov 2026, 08:00 UK time
  const now = new Date("2026-11-30T08:00:00Z");

  it("offers weekday times only, after the notice period", () => {
    const slots = generateCandidateSlots(now, config);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.getTime()).toBeGreaterThanOrEqual(now.getTime() + 12 * 3600_000);
      const day = new Date(localDateKey(s, "Europe/London") + "T12:00:00Z").getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
    // 08:00 + 12h = 20:00 Monday, so the first slot is Tuesday 09:30
    expect(slots[0].toISOString()).toBe("2026-12-01T09:30:00.000Z");
  });

  it("keeps a 20-minute call inside each window", () => {
    const tuesday = generateCandidateSlots(now, config)
      .filter((s) => localDateKey(s, "Europe/London") === "2026-12-01")
      .map((s) => s.toISOString().slice(11, 16));
    expect(tuesday).toEqual(["09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);
  });

  it("skips closed dates", () => {
    const slots = generateCandidateSlots(now, { ...config, closedDates: ["2026-12-01"] });
    expect(slots.some((s) => localDateKey(s, "Europe/London") === "2026-12-01")).toBe(false);
  });
});

describe("computeAvailableSlots", () => {
  const now = new Date("2026-11-30T08:00:00Z");

  it("removes times that clash with the diary, including the buffer", () => {
    const busy = [{ start: new Date("2026-12-01T10:00:00Z"), end: new Date("2026-12-01T11:00:00Z") }];
    const tuesday = computeAvailableSlots({ now, busy, bookedStarts: [], config })
      .filter((s) => localDateKey(s, "Europe/London") === "2026-12-01")
      .map((s) => s.toISOString().slice(11, 16));
    // 09:30 ends 09:50, exactly 10 minutes clear, so it stays. 10:00 to 11:00 goes,
    // and so does 11:00, which starts inside the 10-minute buffer after the meeting.
    expect(tuesday.slice(0, 3)).toEqual(["09:30", "11:30", "12:00"]);
  });

  it("stops offering a day once it reaches the daily cap", () => {
    const bookedStarts = ["09:30", "11:00", "14:00"].map((t) => new Date(`2026-12-01T${t}:00Z`));
    const slots = computeAvailableSlots({ now, busy: [], bookedStarts, config });
    expect(slots.some((s) => localDateKey(s, "Europe/London") === "2026-12-01")).toBe(false);
    expect(slots.some((s) => localDateKey(s, "Europe/London") === "2026-12-02")).toBe(true);
  });

  it("checks a requested time against what is offered", () => {
    const slots = computeAvailableSlots({ now, busy: [], bookedStarts: [], config });
    expect(isOfferedSlot(new Date("2026-12-01T09:30:00Z"), slots)).toBe(true);
    expect(isOfferedSlot(new Date("2026-12-01T09:45:00Z"), slots)).toBe(false);
  });
});
