import { describe, expect, it } from "vitest";
import {
  normalizeMeetingUrl,
  recordingListenHints,
  sameCallCount,
  suggestMatter,
  type MatterSuggestionSource,
} from "./assignableRecording";

const matter = { title: "Reeve purchase", clientName: "Adam Reeve" };
const cases = new Map([["case-1", matter]]);

function meeting(overrides: Partial<MatterSuggestionSource> = {}): MatterSuggestionSource {
  return {
    caseId: "case-1",
    recallBotId: null,
    meetingImportId: null,
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?context=fresh",
    startTime: "2026-10-06T13:00:00.000Z",
    title: "Adam Reeve",
    ...overrides,
  };
}

describe("suggestMatter", () => {
  it("matches a calendar matter by bot id", () => {
    const suggested = suggestMatter(
      {
        id: "imp-1",
        recallBotId: "bot-9",
        meetingUrl: null,
        meetingStartTime: null,
        createdAt: "2026-10-06T13:05:00.000Z",
      },
      [meeting({ recallBotId: "bot-9", meetingUrl: null })],
      cases,
    );
    expect(suggested).toEqual({ caseId: "case-1", title: "Reeve purchase", clientName: "Adam Reeve" });
  });

  it("matches reconnect attempts of the same Teams link within a few hours", () => {
    const suggested = suggestMatter(
      {
        id: "imp-2",
        recallBotId: "bot-other",
        meetingUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?context=retry",
        meetingStartTime: "2026-10-06T13:40:00.000Z",
        createdAt: "2026-10-06T13:40:00.000Z",
      },
      [meeting()],
      cases,
    );
    expect(suggested?.caseId).toBe("case-1");
  });

  it("does not match a standing link used on a different day", () => {
    const suggested = suggestMatter(
      {
        id: "imp-3",
        recallBotId: "bot-later",
        meetingUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0",
        meetingStartTime: "2026-10-07T18:00:00.000Z",
        createdAt: "2026-10-07T18:00:00.000Z",
      },
      [meeting()],
      cases,
    );
    expect(suggested).toBeNull();
  });

  it("ignores a calendar event with no matter", () => {
    const suggested = suggestMatter(
      {
        id: "imp-4",
        recallBotId: "bot-9",
        meetingUrl: null,
        meetingStartTime: null,
        createdAt: "2026-10-06T13:05:00.000Z",
      },
      [meeting({ caseId: null, recallBotId: "bot-9" })],
      cases,
    );
    expect(suggested).toBeNull();
  });
});

describe("recording recognition", () => {
  it("strips join tokens from meeting links", () => {
    expect(normalizeMeetingUrl("https://zoom.us/j/123?pwd=secret")).toBe("zoom.us/j/123");
  });

  it("flags short and solo recordings", () => {
    expect(recordingListenHints({ durationSeconds: 18, participantCount: 1 })).toHaveLength(2);
    expect(recordingListenHints({ durationSeconds: 1800, participantCount: 2 })).toEqual([]);
  });

  it("counts reconnects of the same link", () => {
    const recordings = [
      { meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc?context=1" },
      { meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc?context=2" },
      { meetingUrl: "https://zoom.us/j/999" },
    ];
    expect(sameCallCount(recordings[0], recordings)).toBe(2);
    expect(sameCallCount(recordings[2], recordings)).toBe(1);
  });
});
