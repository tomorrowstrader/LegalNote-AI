import { describe, expect, it } from "vitest";
import {
  CONSENT_DISCLAIMER_TEXT,
  PARTICIPANT_CONSENT_DISCLAIMER_TEXT,
  consentScriptWording,
  isConsentScript,
} from "./consent";

describe("consentScriptWording", () => {
  it("seals the wording that was shown", () => {
    expect(consentScriptWording("participant").text).toBe(PARTICIPANT_CONSENT_DISCLAIMER_TEXT);
    expect(consentScriptWording("client").text).toBe(CONSENT_DISCLAIMER_TEXT);
  });

  it("treats older recordings with no script as the client script", () => {
    expect(consentScriptWording(null).text).toBe(CONSENT_DISCLAIMER_TEXT);
    expect(isConsentScript("other")).toBe(false);
  });
});
