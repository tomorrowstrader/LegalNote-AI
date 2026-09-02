import { describe, expect, it } from "vitest";
import {
  formatEvaluationCalendarDate,
  getEvaluationDaysRemaining,
  getEvaluationEndLondon,
  isEvaluationExpired,
  parseEvaluationEndsAtInput,
  parseEvaluationStartsAtInput,
} from "./evaluationAccess";

describe("evaluationAccess", () => {
  it("parses YYYY-MM-DD start as start of that London calendar day", () => {
    const startsAt = parseEvaluationStartsAtInput("2026-09-01");
    expect(startsAt).not.toBeNull();
    expect(startsAt!.toISOString()).toBe("2026-08-31T23:00:00.000Z"); // BST start of 1 Sep
  });

  it("parses YYYY-MM-DD end as end of that London calendar day", () => {
    const endsAt = parseEvaluationEndsAtInput("2026-09-03");
    expect(endsAt).not.toBeNull();
    expect(getEvaluationEndLondon(endsAt!).toFormat("d MMMM yyyy")).toBe("3 September 2026");
  });

  it("formats legacy UTC end-of-day storage as the intended UK calendar date", () => {
    const legacy = new Date("2026-09-03T23:59:59.000Z");
    expect(formatEvaluationCalendarDate(legacy, "end")).toBe("3 September 2026");
  });

  it("detects expiry after the London end calendar day", () => {
    const endsAt = parseEvaluationEndsAtInput("2026-09-03");
    expect(isEvaluationExpired(endsAt!, new Date("2026-09-03T20:00:00.000Z"))).toBe(false);
    expect(isEvaluationExpired(endsAt!, new Date("2026-09-04T00:30:00.000Z"))).toBe(true);
  });

  it("returns whole London calendar days remaining", () => {
    const endsAt = parseEvaluationEndsAtInput("2026-09-03");
    expect(getEvaluationDaysRemaining(endsAt!, new Date("2026-09-01T12:00:00.000Z"))).toBe(2);
    expect(getEvaluationDaysRemaining(endsAt!, new Date("2026-09-02T12:00:00.000Z"))).toBe(1);
    expect(getEvaluationDaysRemaining(endsAt!, new Date("2026-09-04T00:30:00.000Z"))).toBe(0);
  });
});
