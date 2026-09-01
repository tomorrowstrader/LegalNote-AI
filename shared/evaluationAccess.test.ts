import { describe, expect, it } from "vitest";
import {
  getEvaluationDaysRemaining,
  isEvaluationExpired,
  parseEvaluationEndsAtInput,
  parseEvaluationStartsAtInput,
} from "./evaluationAccess";

describe("evaluationAccess", () => {
  it("parses YYYY-MM-DD start as start of that UTC day", () => {
    const startsAt = parseEvaluationStartsAtInput("2026-09-01");
    expect(startsAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("parses YYYY-MM-DD as end of that UTC day", () => {
    const endsAt = parseEvaluationEndsAtInput("2026-09-15");
    expect(endsAt?.toISOString()).toBe("2026-09-15T23:59:59.000Z");
  });

  it("detects expiry after the end timestamp", () => {
    const endsAt = new Date("2026-09-15T23:59:59.000Z");
    expect(isEvaluationExpired(endsAt, new Date("2026-09-15T23:59:00.000Z"))).toBe(false);
    expect(isEvaluationExpired(endsAt, new Date("2026-09-16T00:00:00.000Z"))).toBe(true);
  });

  it("returns whole days remaining", () => {
    const endsAt = new Date("2026-09-15T23:59:59.000Z");
    expect(getEvaluationDaysRemaining(endsAt, new Date("2026-09-10T12:00:00.000Z"))).toBe(6);
    expect(getEvaluationDaysRemaining(endsAt, new Date("2026-09-16T00:00:00.000Z"))).toBe(0);
  });
});
