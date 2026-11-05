import { describe, expect, it, vi } from "vitest";

vi.mock("./email", () => ({
  legalNoteEmailWordmarkLightUrl: () => "https://legalnote.ai/assets/email/wordmark.png",
}));

import {
  renderConsentAlreadyRespondedPage,
  renderConsentDecisionPage,
  renderConsentExpiredPage,
  renderConsentNotFoundPage,
} from "./consentPublicPage";

const pages = {
  decision: renderConsentDecisionPage("token-1", "Test Firm"),
  notFound: renderConsentNotFoundPage(),
  responded: renderConsentAlreadyRespondedPage("Consent granted", "1 Jan 2026"),
  expired: renderConsentExpiredPage("Test Firm"),
};

describe("consent pages under the production security policy", () => {
  it.each(Object.entries(pages))("%s has nothing inline that the policy would block", (_name, html) => {
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('href="/assets/consent/consent-page.css');
  });

  it("gives the buttons what the script file needs", () => {
    expect(pages.decision).toContain('src="/assets/consent/consent-page.js');
    expect(pages.decision).toContain('data-token="token-1"');
    expect(pages.decision).toContain('data-response="granted"');
    expect(pages.decision).toContain('data-response="declined"');
    expect(pages.decision).toContain("an attendance note, a written record of what was discussed");
  });

  it("escapes the sender and token", () => {
    const html = renderConsentDecisionPage('"><img src=x>', "<b>Firm</b>");
    expect(html).not.toContain("<b>Firm</b>");
    expect(html).not.toContain('"><img src=x>');
  });
});
