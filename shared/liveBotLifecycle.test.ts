import { describe, expect, it } from "vitest";
import {
  BOT_DEPLOY_GRACE_AFTER_START_MINUTES,
  BOT_DEPLOY_LEAD_MINUTES,
  ABANDONED_MEETING_SUB_CODES,
  consentDeclinedBlocksBot,
  isAbandonedMeetingSubCode,
  isConsentDeclinedImportMessage,
  isTerminalImportFailureMessage,
  isUserCancelledImportMessage,
  isWithinBotDeployWindow,
  messageForAbandonedSubCode,
  WAITING_ROOM_TIMEOUT_SEC,
} from "./liveBotLifecycle";

describe("liveBotLifecycle deploy window", () => {
  const start = new Date("2026-08-22T15:00:00.000Z");

  it("allows deploy within lead minutes before start", () => {
    const now = new Date(start.getTime() - BOT_DEPLOY_LEAD_MINUTES * 60 * 1000);
    expect(isWithinBotDeployWindow(start, now)).toBe(true);
  });

  it("allows deploy within grace minutes after start", () => {
    const now = new Date(start.getTime() + BOT_DEPLOY_GRACE_AFTER_START_MINUTES * 60 * 1000);
    expect(isWithinBotDeployWindow(start, now)).toBe(true);
  });

  it("rejects deploy too early", () => {
    const now = new Date(start.getTime() - (BOT_DEPLOY_LEAD_MINUTES + 1) * 60 * 1000);
    expect(isWithinBotDeployWindow(start, now)).toBe(false);
  });

  it("rejects deploy too late", () => {
    const now = new Date(start.getTime() + (BOT_DEPLOY_GRACE_AFTER_START_MINUTES + 1) * 60 * 1000);
    expect(isWithinBotDeployWindow(start, now)).toBe(false);
  });

  it("keeps waiting room timeout wider than deploy window", () => {
    const windowMinutes = BOT_DEPLOY_LEAD_MINUTES + BOT_DEPLOY_GRACE_AFTER_START_MINUTES;
    expect(WAITING_ROOM_TIMEOUT_SEC).toBeGreaterThanOrEqual(windowMinutes * 60);
  });
});

describe("consentDeclinedBlocksBot", () => {
  it("blocks the bot only when consent was declined", () => {
    expect(consentDeclinedBlocksBot("declined")).toBe(true);
    for (const status of ["pending", "sent", "approved", "expired", null, undefined]) {
      expect(consentDeclinedBlocksBot(status)).toBe(false);
    }
  });
});

describe("bot join failure messages", () => {
  it("treats every listed code as never having recorded, and gives a next step", () => {
    for (const code of ABANDONED_MEETING_SUB_CODES) {
      expect(isAbandonedMeetingSubCode(code)).toBe(true);
      const message = messageForAbandonedSubCode(code);
      expect(message).toContain("No recording was captured.");
      expect(isTerminalImportFailureMessage(message)).toBe(true);
      expect(isUserCancelledImportMessage(message)).toBe(false);
      expect(isConsentDeclinedImportMessage(message)).toBe(false);
    }
  });

  it("does not stop processing for codes that can happen during a recording", () => {
    expect(isAbandonedMeetingSubCode("bot_errored")).toBe(false);
    expect(isAbandonedMeetingSubCode("bot_kicked_from_call")).toBe(false);
    expect(isAbandonedMeetingSubCode("call_ended_by_host")).toBe(false);
  });

  it("explains blocks by the host's firm, and captchas on any platform", () => {
    expect(messageForAbandonedSubCode("meeting_requires_sign_in")).toContain("signed-in users");
    expect(messageForAbandonedSubCode("zoom_captcha_required")).toContain("security check");
    expect(messageForAbandonedSubCode("something_new")).toContain("Try again");
  });
});
