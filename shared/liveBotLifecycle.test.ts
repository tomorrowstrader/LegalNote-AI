import { describe, expect, it } from "vitest";
import {
  BOT_DEPLOY_GRACE_AFTER_START_MINUTES,
  BOT_DEPLOY_LEAD_MINUTES,
  isWithinBotDeployWindow,
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
