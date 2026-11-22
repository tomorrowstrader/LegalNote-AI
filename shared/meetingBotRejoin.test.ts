import { describe, expect, it } from "vitest";
import {
  combineRecordingParts,
  consentCutPoints,
  holdForRejoinUntil,
  isInMeetingLiveWindow,
  meetingIsOverForSubCode,
  rejoinHoldDeadline,
  secondsIntoRecording,
} from "./meetingBotRejoin";

const start = new Date("2026-11-20T10:00:00Z");
const end = new Date("2026-11-20T11:00:00Z");
const at = (iso: string) => new Date(`2026-11-20T${iso}Z`).getTime();

describe("isInMeetingLiveWindow", () => {
  const meeting = { startTime: start, endTime: end };
  it("opens 5 minutes before the start", () => {
    expect(isInMeetingLiveWindow(meeting, at("09:54:59"))).toBe(false);
    expect(isInMeetingLiveWindow(meeting, at("09:55:00"))).toBe(true);
  });
  it("stays open through the meeting, not just 15 minutes after the start", () => {
    expect(isInMeetingLiveWindow(meeting, at("10:40:00"))).toBe(true);
  });
  it("closes 15 minutes after the scheduled end", () => {
    expect(isInMeetingLiveWindow(meeting, at("11:15:00"))).toBe(true);
    expect(isInMeetingLiveWindow(meeting, at("11:15:01"))).toBe(false);
  });
  it("assumes an hour when there is no end time", () => {
    expect(isInMeetingLiveWindow({ startTime: start, endTime: null }, at("11:10:00"))).toBe(true);
    expect(isInMeetingLiveWindow({ startTime: start, endTime: null }, at("11:16:00"))).toBe(false);
  });
});

describe("holdForRejoinUntil", () => {
  const meeting = { startTime: start, endTime: end };
  it("holds a bot that was removed mid-meeting until 15 minutes after the end", () => {
    const hold = holdForRejoinUntil({ meeting, subCode: "bot_kicked_from_call", now: at("10:20:00") });
    expect(hold?.toISOString()).toBe(rejoinHoldDeadline(meeting).toISOString());
  });
  it("does not hold when the host ended the meeting or everyone left", () => {
    expect(holdForRejoinUntil({ meeting, subCode: "call_ended_by_host", now: at("10:20:00") })).toBeNull();
    expect(holdForRejoinUntil({ meeting, subCode: "timeout_exceeded_everyone_left", now: at("10:20:00") })).toBeNull();
  });
  it("does not hold when the solicitor told LegalNote to leave", () => {
    expect(meetingIsOverForSubCode("bot_received_leave_call")).toBe(true);
  });
  it("does not hold a bot sent without a meeting card", () => {
    expect(holdForRejoinUntil({ meeting: null, subCode: "bot_kicked_from_call" })).toBeNull();
  });
  it("does not hold once the window has passed", () => {
    expect(holdForRejoinUntil({ meeting, subCode: null, now: at("11:30:00") })).toBeNull();
  });
});

describe("secondsIntoRecording", () => {
  it("measures from Recall's recording start, not when a browser tab noticed", () => {
    expect(secondsIntoRecording("2026-11-20T10:00:00Z", "2026-11-20T10:06:30Z")).toBe(390);
  });
  it("treats a press a moment before the start as the start", () => {
    expect(secondsIntoRecording("2026-11-20T10:00:03Z", "2026-11-20T10:00:00Z")).toBe(0);
  });
  it("is null when either time is missing", () => {
    expect(secondsIntoRecording(null, "2026-11-20T10:00:00Z")).toBeNull();
  });
});

describe("combineRecordingParts", () => {
  it("uses server times for a single part", () => {
    const t = combineRecordingParts([
      {
        durationSeconds: 1800,
        recordingStartedAt: "2026-11-20T10:00:00Z",
        consentScriptStartedAt: "2026-11-20T10:05:00Z",
        consentConfirmedAt: "2026-11-20T10:06:00Z",
        consentElapsedSeconds: 12,
      },
    ]);
    expect(t).toMatchObject({ totalSeconds: 1800, scriptStartSecond: 300, consentSecond: 360 });
  });

  it("falls back to the browser count when there is no server consent time", () => {
    const t = combineRecordingParts([{ durationSeconds: 600, consentElapsedSeconds: 45 }]);
    expect(t.consentSecond).toBe(45);
  });

  it("places consent given after a rejoin after the first part", () => {
    const t = combineRecordingParts([
      { durationSeconds: 300, recordingStartedAt: "2026-11-20T10:00:00Z" },
      {
        durationSeconds: 900,
        recordingStartedAt: "2026-11-20T10:08:00Z",
        consentScriptStartedAt: "2026-11-20T10:08:20Z",
        consentConfirmedAt: "2026-11-20T10:09:00Z",
      },
    ]);
    expect(t.partOffsets).toEqual([0, 300]);
    expect(t.scriptStartSecond).toBe(320);
    expect(t.consentSecond).toBe(360);
    expect(t.totalSeconds).toBe(1200);
  });

  it("keeps the first part's consent when a rejoin carries it over", () => {
    const t = combineRecordingParts([
      { durationSeconds: 300, recordingStartedAt: "2026-11-20T10:00:00Z", consentConfirmedAt: "2026-11-20T10:02:00Z" },
      { durationSeconds: 900, recordingStartedAt: "2026-11-20T10:08:00Z", consentConfirmedAt: "2026-11-20T10:08:01Z" },
    ]);
    expect(t.consentSecond).toBe(120);
  });

  it("cannot place a later part when an earlier length is unknown", () => {
    const t = combineRecordingParts([
      { durationSeconds: null },
      { durationSeconds: 600, recordingStartedAt: "2026-11-20T10:08:00Z", consentConfirmedAt: "2026-11-20T10:09:00Z" },
    ]);
    expect(t.consentSecond).toBeNull();
    expect(t.totalSeconds).toBeNull();
  });

  it("ignores a script mark pressed after consent", () => {
    const t = combineRecordingParts([
      {
        durationSeconds: 600,
        recordingStartedAt: "2026-11-20T10:00:00Z",
        consentConfirmedAt: "2026-11-20T10:01:00Z",
        consentScriptStartedAt: "2026-11-20T10:02:00Z",
      },
    ]);
    expect(t.scriptStartSecond).toBeNull();
  });
});

describe("consentCutPoints", () => {
  it("drops the small talk before the script and clips script to consent", () => {
    expect(consentCutPoints({ scriptStartSecond: 300, consentSecond: 360 })).toEqual({
      trimStartSecond: 297,
      consentClipSeconds: 66,
    });
  });
  it("keeps everything from the start when the script was never marked", () => {
    expect(consentCutPoints({ scriptStartSecond: null, consentSecond: 90 })).toEqual({
      trimStartSecond: 0,
      consentClipSeconds: 93,
    });
  });
  it("has no clip without consent", () => {
    expect(consentCutPoints({ scriptStartSecond: 10, consentSecond: null }).consentClipSeconds).toBeNull();
  });
});
