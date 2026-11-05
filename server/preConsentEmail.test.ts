import { describe, expect, it } from "vitest";
import { buildPreConsentEmailHtml } from "./email";

const base = { to: "a@example.com", consentUrl: "https://legalnote.ai/consent/t", senderLabel: "Test Firm" };

describe("buildPreConsentEmailHtml", () => {
  it("names the meeting once, in UK time", () => {
    const html = buildPreConsentEmailHtml({
      ...base,
      scheduledMeetingTime: new Date("2026-07-02T14:00:00.000Z"),
    });
    expect(html).toContain("consent to record your meeting on");
    expect(html).not.toContain("upcoming meeting for your meeting");
    expect(html).toContain("15:00");
  });

  it("falls back when there is no meeting time, and skips email-like names", () => {
    const html = buildPreConsentEmailHtml({ ...base, recipientName: "'a@example.com'" });
    expect(html).toContain("consent to record an upcoming meeting");
    expect(html).toContain("Hi,");
  });

  it("carries the admit request and link, with no matter details", () => {
    const html = buildPreConsentEmailHtml(base);
    expect(html).toContain("a participant called LegalNote");
    expect(html).toContain("https://legalnote.ai/consent/t");
    expect(html).toContain("No matter details are included");
    expect(html).toContain("an attendance note, a written record of what was discussed");
  });
});
