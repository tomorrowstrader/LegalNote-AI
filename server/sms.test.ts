import { describe, expect, it } from "vitest";
import { formatUKPhoneNumber, isValidUKPhoneNumber, phoneLastFour } from "./sms";

describe("formatUKPhoneNumber", () => {
  it("normalises common UK mobile formats to E.164", () => {
    expect(formatUKPhoneNumber("07539371964")).toBe("+447539371964");
    expect(formatUKPhoneNumber("07539 371964")).toBe("+447539371964");
    expect(formatUKPhoneNumber("+44 7539 371964")).toBe("+447539371964");
    expect(formatUKPhoneNumber("447539371964")).toBe("+447539371964");
    expect(formatUKPhoneNumber("00447539371964")).toBe("+447539371964");
    expect(formatUKPhoneNumber("7539371964")).toBe("+447539371964");
  });
});

describe("isValidUKPhoneNumber", () => {
  it("accepts only +447 mobiles", () => {
    expect(isValidUKPhoneNumber("+447539371964")).toBe(true);
    expect(isValidUKPhoneNumber("07539371964")).toBe(false);
    expect(isValidUKPhoneNumber("+441234567890")).toBe(false);
  });
});

describe("phoneLastFour", () => {
  it("returns the last four digits", () => {
    expect(phoneLastFour("07539371964")).toBe("1964");
    expect(phoneLastFour("+447539371964")).toBe("1964");
  });
});
