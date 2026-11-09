import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingImport, MeetingSession } from "@shared/schema";
import { chosenRecordingType, resolveBotMeetingStart, resolveBotRecordingSession } from "./botRecordingSession";

const CASE = "case-1";
const USER = "user-1";

function makeImport(overrides: Partial<MeetingImport> = {}): MeetingImport {
  return {
    id: "imp-1",
    userId: USER,
    caseId: CASE,
    recallBotId: "bot-1",
    meetingTitle: "Call with client",
    meetingStartTime: null,
    durationSeconds: 6143,
    createdAt: new Date("2026-11-05T09:58:00Z"),
    ...overrides,
  } as MeetingImport;
}

function makeStorage(existing: Array<Partial<MeetingSession>> = []) {
  const sessions = new Map<string, Partial<MeetingSession>>(existing.map((s) => [s.id!, s]));
  let n = 0;
  return {
    sessions,
    getCase: vi.fn(async () => ({ id: CASE, matterKind: "client" })),
    getMeetingSession: vi.fn(async (id: string) => sessions.get(id)),
    createMeetingSession: vi.fn(async (data: Partial<MeetingSession>) => {
      const s = { ...data, id: `new-${++n}` };
      sessions.set(s.id, s);
      return s;
    }),
    updateMeetingSession: vi.fn(async (id: string, updates: Partial<MeetingSession>) => {
      const s = { ...sessions.get(id), ...updates };
      sessions.set(id, s);
      return s;
    }),
    getScheduledMeetingByBotId: vi.fn(async () => undefined as { startTime: Date } | undefined),
  };
}

const october = { id: "oct", caseId: CASE, startedAt: new Date("2026-10-06T10:00:00Z") };

beforeEach(() => vi.clearAllMocks());

describe("resolveBotRecordingSession", () => {
  it("adds a bot recording on a matter with an earlier session as a new session", async () => {
    const storage = makeStorage([october]);
    const result = await resolveBotRecordingSession({
      storage: storage as never,
      importRecord: makeImport({ meetingStartTime: new Date("2026-11-05T10:00:00Z") }),
      caseId: CASE,
      userId: USER,
    });

    expect(result.created).toBe(true);
    expect(result.sessionId).not.toBe("oct");
    expect(storage.sessions.size).toBe(2);
    const created = storage.sessions.get(result.sessionId)!;
    expect(created).toMatchObject({ caseId: CASE, recordingType: "full_meeting", durationSeconds: 6143 });
    expect(created.startedAt).toEqual(new Date("2026-11-05T10:00:00Z"));
    // The October session is left alone.
    expect(storage.sessions.get("oct")).toEqual(october);
  });

  it("reuses the session already linked to the recording on a retry", async () => {
    const storage = makeStorage([october, { id: "nov", caseId: CASE }]);
    const result = await resolveBotRecordingSession({
      storage: storage as never,
      importRecord: makeImport(),
      caseId: CASE,
      userId: USER,
      linkedSessionId: "nov",
    });
    expect(result).toMatchObject({ sessionId: "nov", created: false });
    expect(storage.createMeetingSession).not.toHaveBeenCalled();
  });

  it("uses the session the assign step created and dates it to the meeting", async () => {
    const storage = makeStorage([october, { id: "assigned", caseId: CASE }]);
    const result = await resolveBotRecordingSession({
      storage: storage as never,
      importRecord: makeImport({ meetingStartTime: new Date("2026-11-05T10:00:00Z") }),
      caseId: CASE,
      userId: USER,
      assignedSessionId: "assigned",
    });
    expect(result).toMatchObject({ sessionId: "assigned", created: false });
    expect(storage.createMeetingSession).not.toHaveBeenCalled();
    expect(storage.sessions.get("assigned")!.startedAt).toEqual(new Date("2026-11-05T10:00:00Z"));
  });

  it("ignores a session that belongs to another matter", async () => {
    const storage = makeStorage([{ id: "elsewhere", caseId: "case-2" }]);
    const result = await resolveBotRecordingSession({
      storage: storage as never,
      importRecord: makeImport(),
      caseId: CASE,
      userId: USER,
      assignedSessionId: "elsewhere",
      linkedSessionId: "elsewhere",
    });
    expect(result.created).toBe(true);
    expect(result.sessionId).not.toBe("elsewhere");
  });

  it("fails rather than guessing when the matter cannot be found", async () => {
    const storage = makeStorage();
    storage.getCase.mockResolvedValueOnce(undefined as never);
    await expect(
      resolveBotRecordingSession({ storage: storage as never, importRecord: makeImport(), caseId: CASE, userId: USER }),
    ).rejects.toThrow(/Matter not found/);
  });
});

describe("resolveBotMeetingStart", () => {
  it("prefers the recording start, then the scheduled time, then when the bot was sent", async () => {
    const storage = makeStorage();
    const recorded = new Date("2026-11-05T10:01:00Z");
    expect(await resolveBotMeetingStart(storage as never, makeImport({ meetingStartTime: recorded }))).toEqual(recorded);

    const scheduled = new Date("2026-11-05T10:00:00Z");
    storage.getScheduledMeetingByBotId.mockResolvedValueOnce({ startTime: scheduled });
    expect(await resolveBotMeetingStart(storage as never, makeImport())).toEqual(scheduled);

    expect(await resolveBotMeetingStart(storage as never, makeImport())).toEqual(new Date("2026-11-05T09:58:00Z"));
  });
});

describe("chosenRecordingType", () => {
  it("uses the type chosen on the upcoming meeting when the matter allows it", async () => {
    const storage = makeStorage();
    storage.getScheduledMeetingByBotId.mockResolvedValueOnce({ recordingType: "internal_meeting" } as never);
    expect(await chosenRecordingType(storage as never, makeImport(), "client")).toBe("internal_meeting");
  });

  it("falls back to the matter default when nothing was chosen or the choice does not fit", async () => {
    const storage = makeStorage();
    expect(await chosenRecordingType(storage as never, makeImport(), "client")).toBe("full_meeting");
    storage.getScheduledMeetingByBotId.mockResolvedValueOnce({ recordingType: "court_hearing" } as never);
    expect(await chosenRecordingType(storage as never, makeImport(), "internal")).toBe("internal_meeting");
  });
});
