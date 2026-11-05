import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduledMeeting } from "@shared/schema";

const { storageMock, recallMock } = vi.hoisted(() => ({
  storageMock: {
    updateScheduledMeeting: vi.fn(),
    updateMeetingImport: vi.fn(),
    createMeetingImport: vi.fn(),
    createAuditLog: vi.fn(),
  },
  recallMock: {
    createBot: vi.fn(),
    leaveCall: vi.fn(),
    isConfigured: vi.fn(() => true),
    detectMeetingPlatform: vi.fn(() => "teams"),
    getBotStatusCode: vi.fn(() => "joining"),
  },
}));

vi.mock("../storage", () => ({ storage: storageMock }));
vi.mock("./recallService", () => ({ recallService: recallMock }));
vi.mock("../email", () => ({
  sendPreConsentEmail: vi.fn(),
  sendMeetingReminderEmail: vi.fn(),
  sendClientMeetingReminderEmail: vi.fn(),
  publicFacingDisplayName: vi.fn(),
}));
vi.mock("../clientFacingSender", () => ({ senderLabelForUser: vi.fn() }));
vi.mock("../oauth", () => ({ ensureFreshOutlookToken: vi.fn() }));

import { meetingSchedulerService } from "./meetingSchedulerService";

function meeting(overrides: Partial<ScheduledMeeting>): ScheduledMeeting {
  return {
    id: "meeting-1",
    userId: "user-1",
    caseId: "case-1",
    title: "Meeting",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
    startTime: new Date(),
    consentStatus: "pending",
    recallBotId: null,
    botStatus: null,
    meetingImportId: null,
    ...overrides,
  } as ScheduledMeeting;
}

describe("scheduled bot after an email decline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recallMock.createBot.mockResolvedValue({ id: "bot-1" });
    recallMock.leaveCall.mockResolvedValue({});
    storageMock.createMeetingImport.mockResolvedValue({ id: "import-1" });
  });

  it("does not deploy a bot once recording was declined", async () => {
    const deployed = await meetingSchedulerService.deployBotForMeeting(
      meeting({ consentStatus: "declined" }),
    );
    expect(deployed).toBe(false);
    expect(recallMock.createBot).not.toHaveBeenCalled();
    expect(storageMock.updateScheduledMeeting).not.toHaveBeenCalled();
  });

  it("still deploys when the person has not responded", async () => {
    const deployed = await meetingSchedulerService.deployBotForMeeting(
      meeting({ consentStatus: "sent" }),
    );
    expect(deployed).toBe(true);
    expect(recallMock.createBot).toHaveBeenCalledOnce();
  });

  it("removes a bot already in the call and stops its import", async () => {
    await meetingSchedulerService.removeBotAfterEmailDecline(
      meeting({ recallBotId: "bot-1", botStatus: "in_call", meetingImportId: "import-1" }),
    );
    expect(recallMock.leaveCall).toHaveBeenCalledWith("bot-1");
    expect(storageMock.updateMeetingImport).toHaveBeenCalledWith(
      "import-1",
      expect.objectContaining({ status: "failed", botStatus: "left_consent_declined", consentConfirmed: false }),
    );
    expect(storageMock.createAuditLog).toHaveBeenCalledOnce();
  });

  it("stops the import even if the bot cannot be removed", async () => {
    recallMock.leaveCall.mockRejectedValue(new Error("Recall unavailable"));
    await meetingSchedulerService.removeBotAfterEmailDecline(
      meeting({ recallBotId: "bot-1", botStatus: "in_call", meetingImportId: "import-1" }),
    );
    expect(storageMock.updateMeetingImport).toHaveBeenCalledWith(
      "import-1",
      expect.objectContaining({ status: "failed", botStatus: "consent_declined" }),
    );
  });

  it("does nothing when no bot was deployed or the recording has finished", async () => {
    await meetingSchedulerService.removeBotAfterEmailDecline(meeting({}));
    await meetingSchedulerService.removeBotAfterEmailDecline(
      meeting({ recallBotId: "bot-1", botStatus: "done" }),
    );
    expect(recallMock.leaveCall).not.toHaveBeenCalled();
    expect(storageMock.createAuditLog).not.toHaveBeenCalled();
  });
});
