import { describe, expect, it } from "vitest";
import {
  PAYMENT_SAFETY_HEADING,
  defaultPaymentSafetyNotice,
  insertPaymentSafetySection,
  resolvePaymentSafetyNotice,
} from "./paymentSafety";

describe("resolvePaymentSafetyNotice", () => {
  it("uses the firm's own wording when set", () => {
    expect(resolvePaymentSafetyNotice("  Call us first.  ", "Acme LLP")).toBe("Call us first.");
  });

  it("falls back to the default wording naming the firm", () => {
    expect(resolvePaymentSafetyNotice("   ", "Acme LLP")).toBe(defaultPaymentSafetyNotice("Acme LLP"));
    expect(resolvePaymentSafetyNotice(null, "Acme LLP")).toMatch(/^Acme LLP will never/);
  });
});

describe("insertPaymentSafetySection", () => {
  const notice = "Our bank details never change by email.";

  it("inserts before a numbered Next Steps heading", () => {
    const letter = "**9. Data Protection**\n\nText.\n\n**10. Next Steps**\n\nWe will call you.\n\nYours sincerely,";
    const out = insertPaymentSafetySection(letter, notice);
    expect(out).toBe(
      `**9. Data Protection**\n\nText.\n\n**${PAYMENT_SAFETY_HEADING}**\n\n${notice}\n\n**10. Next Steps**\n\nWe will call you.\n\nYours sincerely,`,
    );
  });

  it("inserts before the sign-off when there is no Next Steps heading", () => {
    const letter = "Dear Client,\n\nBody.\n\nYours sincerely,\nA Solicitor";
    const out = insertPaymentSafetySection(letter, notice);
    expect(out.indexOf(PAYMENT_SAFETY_HEADING)).toBeLessThan(out.indexOf("Yours sincerely"));
    expect(out).toContain(notice);
  });

  it("appends when there is no anchor", () => {
    const out = insertPaymentSafetySection("Dear Client,\n\nBody.", notice);
    expect(out.endsWith(`**${PAYMENT_SAFETY_HEADING}**\n\n${notice}\n`)).toBe(true);
  });

  it("does not add the section twice", () => {
    const once = insertPaymentSafetySection("Body.\n\n**Next Steps**\n\nX", notice);
    expect(insertPaymentSafetySection(once, notice)).toBe(once);
  });

  it("does not anchor on 'next steps' inside body prose", () => {
    const letter = "We discussed next steps briefly.\n\n**Next Steps**\n\nX";
    const out = insertPaymentSafetySection(letter, notice);
    expect(out.indexOf(PAYMENT_SAFETY_HEADING)).toBeGreaterThan(out.indexOf("briefly"));
  });
});
