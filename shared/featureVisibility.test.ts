import { describe, expect, it } from "vitest";
import {
  EVAL_FIRM_ENABLED_FEATURES,
  isFeatureVisibleForContext,
} from "./featureVisibility";

describe("featureVisibility eval firms", () => {
  it("keeps global-off features hidden for non-eval users", () => {
    expect(isFeatureVisibleForContext("sraReadiness", null)).toBe(false);
    expect(isFeatureVisibleForContext("calendarAutoRecord", { firmIsEvaluation: false })).toBe(false);
  });

  it("enables trial features for active eval firms", () => {
    for (const key of EVAL_FIRM_ENABLED_FEATURES) {
      expect(
        isFeatureVisibleForContext(key, { firmIsEvaluation: true, evaluationActive: true }),
      ).toBe(true);
    }
  });

  it("hides trial features when eval period expired", () => {
    expect(
      isFeatureVisibleForContext("sraReadiness", {
        firmIsEvaluation: true,
        evaluationActive: false,
      }),
    ).toBe(false);
  });
});
