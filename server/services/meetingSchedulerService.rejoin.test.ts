import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingImport, ScheduledMeeting } from "@shared/schema";

const { storageMock, recallMock } = vi.hoisted(() => ({
  storageMock: {
    updateScheduledMeeting: vi.fn(),
    updateMeetingImport: vi.fn(),
    createMeetingImport: vi.fn(),
    createAuditLog: vi.fn(),
    getMeetingImport: vi.fn(),
    getCase: vi.fn(),
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

const minutes = (n: number) => n * 60 * 1000;

function meeting(overrides: Partial<ScheduledMeeting> = {}): ScheduledMeeting {
  const start = new Date(Date.now() - minutes(25));
  return {
    id: "meeting-1",
    userId: "user-1",
    caseId: null,
    title: "Client meeting",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
    startTime: start,
    endTime: new Date(start.getTime() + minutes(60)),
    status: "scheduled",
    consentStatus: "pending",
    recallBotId: "bot-old",
    botStatus: "done",
    meetingImportId: "import-old",
    ...overrides,
  } as ScheduledMeeting;
}

function part(overrides: Partial<MeetingImport> = {}): MeetingImport {
  return {
    id: "import-old",
    userId: "user-1",
    caseId: "case-1",
    recallBotId: "bot-old",
    status: "live",
    botStatus: "done",
    recallRecordingId: "rec-1",
    errorMessage: null,
    consentConfirmed: true,
    consentScript: "client",
    ...overrides,
  } as MeetingImport;
}

describe("sending LegalNote back in from the meeting card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recallMock.createBot.mockResolvedValue({ id: "bot-new" });
    storageMock.createMeetingImport.mockResolvedValue({ id: "import-new" });
  });

  it("works 25 minutes in, after the old 10-minute limit", async () => {
    storageMock.getMeetingImport.mockResolvedValue(part());
    const result = await meetingSchedulerService.sendBotFromCard(meeting());
    expect(result).toMatchObject({ success: true, rejoin: true, importId: "import-new", botId: "bot-new" });
  });

  it("continues the earlier part, keeping its matter and the consent already given", async () => {
    storageMock.getMeetingImport.mockResolvedValue(part());
    await meetingSchedulerService.sendBotFromCard(meeting());
    expect(storageMock.createMeetingImport).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case-1",
        continuesImportId: "import-old",
        scheduledMeetingId: "meeting-1",
        consentConfirmed: true,
        consentScript: "client",
      }),
    );
    expect(storageMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "live_bot_rejoined" }),
    );
  });

  it("re-opens a meeting that was marked complete when the bot left", async () => {
    storageMock.getMeetingImport.mockResolvedValue(part());
    await meetingSchedulerService.sendBotFromCard(meeting({ status: "completed" }));
    expect(storageMock.updateScheduledMeeting).toHaveBeenCalledWith(
      "meeting-1",
      expect.objectContaining({ meetingImportId: "import-new", status: "scheduled" }),
    );
  });

  it("asks for consent again when none was given before the bot left", async () => {
    storageMock.getMeetingImport.mockResolvedValue(part({ consentConfirmed: false }));
    await meetingSchedulerService.sendBotFromCard(meeting());
    expect(storageMock.createMeetingImport).toHaveBeenCalledWith(
      expect.objectContaining({ consentConfirmed: false, continuesImportId: "import-old" }),
    );
  });

  it("starts fresh when the earlier bot never recorded", async () => {
    storageMock.getMeetingImport.mockResolvedValue(
      part({ status: "failed", recallRecordingId: null, botStatus: "call_ended", errorMessage: "LegalNote left the waiting room" }),
    );
    const result = await meetingSchedulerService.sendBotFromCard(meeting());
    expect(result).toMatchObject({ success: true, rejoin: false });
    expect(storageMock.createMeetingImport).toHaveBeenCalledWith(
      expect.objectContaining({ continuesImportId: undefined }),
    );
  });

  it("refuses while LegalNote is still in the meeting", async () => {
    storageMock.getMeetingImport.mockResolvedValue(part({ botStatus: "in_call_recording" }));
    const result = await meetingSchedulerService.sendBotFromCard(meeting());
    expect(result).toEqual({ success: false, reason: "LegalNote is already in this meeting." });
    expect(recallMock.createBot).not.toHaveBeenCalled();
  });

  it("refuses after the client declined in this meeting", async () => {
    storageMock.getMeetingImport.mockResolvedValue(
      part({ status: "failed", botStatus: "left_consent_declined", consentConfirmed: false }),
    );
    const result = await meetingSchedulerService.sendBotFromCard(meeting());
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/declined/);
    expect(recallMock.createBot).not.toHaveBeenCalled();
  });

  it("explains the time limit once the meeting is well over", async () => {
    const start = new Date(Date.now() - minutes(120));
    const result = await meetingSchedulerService.sendBotFromCard(
      meeting({ startTime: start, endTime: new Date(start.getTime() + minutes(60)) }),
    );
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/15 minutes after the scheduled end/);
  });

  it("still keeps the automatic deploy to its short window", async () => {
    storageMock.getMeetingImport.mockResolvedValue(undefined);
    const sent = await meetingSchedulerService.deployBotForMeeting(
      meeting({ recallBotId: null, meetingImportId: null, botStatus: null }),
    );
    expect(sent).toBe(false);
    expect(recallMock.createBot).not.toHaveBeenCalled();
  });
});
