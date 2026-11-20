import { describe, expect, it } from "vitest";
import { liveDatabaseDecision } from "./liveDatabaseGuard";

describe("liveDatabaseDecision", () => {
  it("lets a local server start on the marked test database", () => {
    expect(liveDatabaseDecision({ nodeEnv: "development", marker: "legalnote.environment=development" }).ok).toBe(true);
  });

  it("refuses a local server on a database without the marker (the live one)", () => {
    const decision = liveDatabaseDecision({ nodeEnv: "development", marker: null });
    expect(decision.ok).toBe(false);
  });

  it("refuses when the marker cannot be read", () => {
    expect(liveDatabaseDecision({ nodeEnv: "development", marker: undefined }).ok).toBe(false);
    expect(liveDatabaseDecision({ nodeEnv: undefined, marker: "" }).ok).toBe(false);
  });

  it("refuses any other marker value", () => {
    expect(liveDatabaseDecision({ nodeEnv: "development", marker: "production" }).ok).toBe(false);
  });

  it("never blocks production", () => {
    expect(liveDatabaseDecision({ nodeEnv: "production", marker: null }).ok).toBe(true);
  });
});
