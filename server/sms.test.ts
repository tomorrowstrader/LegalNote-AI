import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatUKPhoneNumber,
  isValidAlphaSenderId,
  isValidUKPhoneNumber,
  phoneLastFour,
  resolveOtpFromAddress,
  resolveSmsFromAddress,
} from "./sms";

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

describe("isValidAlphaSenderId", () => {
  it("accepts Twilio alphanumeric rules", () => {
    expect(isValidAlphaSenderId("LegalNote")).toBe(true);
    expect(isValidAlphaSenderId("LegalNote AI")).toBe(false);
    expect(isValidAlphaSenderId("")).toBe(false);
    expect(isValidAlphaSenderId("ThisIsTooLong")).toBe(false);
  });
});

describe("resolveSmsFromAddress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses phone number by default even when TWILIO_SENDER_NAME is set", () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+447700900000");
    vi.stubEnv("TWILIO_SENDER_NAME", "LegalNote");
    vi.stubEnv("TWILIO_USE_ALPHA_SENDER", "");

    expect(resolveSmsFromAddress()).toEqual({
      from: "+447700900000",
      usedAlpha: false,
    });
  });

  it("uses alpha sender only when explicitly opted in", () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+447700900000");
    vi.stubEnv("TWILIO_SENDER_NAME", "LegalNote");
    vi.stubEnv("TWILIO_USE_ALPHA_SENDER", "true");

    expect(resolveSmsFromAddress()).toEqual({
      from: "LegalNote",
      usedAlpha: true,
    });
  });

  it("falls back to phone when opted-in alpha sender is invalid", () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+447700900000");
    vi.stubEnv("TWILIO_SENDER_NAME", "LegalNote AI");
    vi.stubEnv("TWILIO_USE_ALPHA_SENDER", "true");

    expect(resolveSmsFromAddress()).toEqual({
      from: "+447700900000",
      usedAlpha: false,
    });
  });

  it("never uses alpha sender for OTP messages", () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+447700900000");
    vi.stubEnv("TWILIO_SENDER_NAME", "LegalNote");
    vi.stubEnv("TWILIO_USE_ALPHA_SENDER", "true");

    expect(resolveOtpFromAddress()).toEqual({
      from: "+447700900000",
      usedAlpha: false,
    });
  });
});
