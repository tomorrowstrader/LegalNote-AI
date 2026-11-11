import { describe, expect, it, vi } from "vitest";
import { getRecoveredMoveStatus, moveRecoveredRecording, type MoveRecoveredRecordingDeps } from "./moveRecoveredRecording";

const USER = "user-1";
const AREAS = ["clinical_negligence", "family"] as const;

function setup(options: {
  sourceHold?: boolean;
  targetHold?: boolean;
  consentLogs?: number;
  sessions?: number;
  recovered?: boolean;
  recordConsentFails?: boolean;
  audioUpdateFails?: boolean;
} = {}) {
  const cases = new Map<string, any>([
    ["src", {
      id: "src",
      title: "Recovered Recording - 08/11/2026",
      status: "pending",
      matterKind: "client",
      litigationHold: !!options.sourceHold,
      litigationHoldReason: options.sourceHold ? "Anticipated claim" : null,
      archived: false,
    }],
    ["dst", {
      id: "dst",
      title: "Matter",
      status: "completed",
      matterKind: "client",
      practiceArea: "clinical_negligence",
      hasExternalAttendees: false,
      litigationHold: !!options.targetHold,
      archived: false,
    }],
  ]);
  const sessions = new Map<string, any>();
  for (let i = 0; i < (options.sessions ?? 1); i++) {
    sessions.set(`sess-${i}`, { id: `sess-${i}`, caseId: "src", recordingType: "full_meeting", status: "completed" });
  }
  const audio = {
    id: "aud-1",
    caseId: "src",
    meetingSessionId: "sess-0",
    filePath: "/objects/a.webm",
    duration: 11290,
    consentSegmentPath: "/objects/consent.webm",
    deletedAt: null,
    expiresAt: new Date("2026-11-15T08:42:00Z"),
    recordedAt: new Date("2026-11-08T08:42:00Z"),
  };
  const audit: any[] = [];

  const storage = {
    getCase: vi.fn(async (id: string) => cases.get(id)),
    updateCase: vi.fn(async (id: string, updates: any) => {
      cases.set(id, { ...cases.get(id), ...updates });
      return cases.get(id);
    }),
    archiveCase: vi.fn(async (id: string, archived: boolean) => {
      cases.set(id, { ...cases.get(id), archived });
      return cases.get(id);
    }),
    getMeetingSessionsByCase: vi.fn(async (caseId: string) => [...sessions.values()].filter((s) => s.caseId === caseId)),
    createMeetingSession: vi.fn(async (data: any) => {
      const s = { ...data, id: "sess-new" };
      sessions.set(s.id, s);
      return s;
    }),
    updateMeetingSession: vi.fn(async (id: string, updates: any) => {
      sessions.set(id, { ...sessions.get(id), ...updates });
      return sessions.get(id);
    }),
    getAudioRecordingsByCaseId: vi.fn(async (caseId: string) => (audio.caseId === caseId ? [audio] : [])),
    updateAudioRecording: vi.fn(async (_id: string, updates: any) => {
      if (options.audioUpdateFails) throw new Error("db down");
      Object.assign(audio, updates);
      return audio;
    }),
    getTranscriptByCase: vi.fn(async () => undefined),
    getDocumentsByCase: vi.fn(async () => []),
    getConsentLogsByCase: vi.fn(async () => Array.from({ length: options.consentLogs ?? 0 }, (_, i) => ({ id: `c${i}` }))),
    createAuditLog: vi.fn(async (entry: any) => {
      audit.push(entry);
      return entry;
    }),
  };

  const deps = {
    storage,
    findRecoveredSession: vi.fn(async () => (options.recovered === false ? null : { id: "rec-1" })),
    relinkRecoveredSession: vi.fn(async () => undefined),
    recordConsent: vi.fn(async () => {
      if (options.recordConsentFails) throw new Error("seal failed");
      return {};
    }),
    syncObjectHolds: vi.fn(async () => undefined),
    clearGraceWindow: vi.fn(async () => undefined),
    now: () => new Date("2026-11-09T10:00:00Z"),
  } as unknown as MoveRecoveredRecordingDeps & { [k: string]: any };

  return { deps, storage, cases, sessions, audio, audit };
}

const move = (deps: MoveRecoveredRecordingDeps, overrides: Record<string, unknown> = {}) =>
  moveRecoveredRecording(deps, {
    sourceCaseId: "src",
    targetCaseId: "dst",
    recordingType: "full_meeting",
    consentConfirmed: true,
    userId: USER,
    practiceAreas: AREAS,
    ...overrides,
  });

describe("moveRecoveredRecording", () => {
  it("moves the session and audio, seals consent on the matter and archives the recovered case", async () => {
    const { deps, cases, sessions, audio, audit } = setup();
    const result = await move(deps, { recordingType: "telephone_call" });

    expect(result).toMatchObject({ ok: true, targetCaseId: "dst", sessionId: "sess-0", consentSealed: true, holdCarried: false });
    expect(sessions.get("sess-0")).toMatchObject({ caseId: "dst", recordingType: "telephone_call", status: "pending" });
    expect(audio).toMatchObject({ caseId: "dst", meetingSessionId: "sess-0" });
    expect(deps.relinkRecoveredSession).toHaveBeenCalledWith("rec-1", "dst");
    expect(cases.get("src").archived).toBe(true);
    expect(audit.filter((e) => e.eventType === "recovered_recording_moved").map((e) => e.caseId)).toEqual(["dst", "src"]);
    expect(deps.recordConsent).toHaveBeenCalledWith(expect.objectContaining({
      caseId: "dst",
      audioRecordingId: "aud-1",
      consentModality: "verbal_attested",
      source: "recovered_recording_move",
    }));
  });

  it("carries a litigation hold to the matter before the audio moves", async () => {
    const { deps, storage, cases, audit } = setup({ sourceHold: true });
    const result = await move(deps);

    expect(result).toMatchObject({ ok: true, holdCarried: true });
    expect(cases.get("dst")).toMatchObject({ litigationHold: true, litigationHoldAppliedBy: USER });
    expect(cases.get("dst").litigationHoldReason).toContain("Anticipated claim");
    expect(audit.find((e) => e.eventType === "litigation_hold_applied")).toMatchObject({ caseId: "dst", severity: "critical" });
    expect(deps.syncObjectHolds).toHaveBeenCalledWith("dst", USER, undefined);
    const holdOrder = storage.updateCase.mock.invocationCallOrder[0];
    const audioOrder = storage.updateAudioRecording.mock.invocationCallOrder[0];
    expect(holdOrder).toBeLessThan(audioOrder);
  });

  it("keeps an existing hold on the matter and still locks the moved audio", async () => {
    const { deps } = setup({ targetHold: true });
    const result = await move(deps);
    expect(result).toMatchObject({ ok: true, holdCarried: false });
    expect(deps.syncObjectHolds).toHaveBeenCalledWith("dst", USER, undefined);
  });

  it("does not seal consent when the user has not confirmed it", async () => {
    const { deps } = setup();
    const result = await move(deps, { consentConfirmed: false });
    expect(result).toMatchObject({ ok: true, consentSealed: false, consentError: null });
    expect(deps.recordConsent).not.toHaveBeenCalled();
  });

  it("still completes the move when sealing consent fails, and says so", async () => {
    const { deps } = setup({ recordConsentFails: true });
    const result = await move(deps);
    expect(result).toMatchObject({ ok: true, consentSealed: false });
    expect(result.ok && result.consentError).toMatch(/consent could not be sealed/);
  });

  it("creates a session on the matter when the recovered case has none", async () => {
    const { deps, audio } = setup({ sessions: 0 });
    const result = await move(deps);
    expect(result).toMatchObject({ ok: true, sessionId: "sess-new" });
    expect(audio.meetingSessionId).toBe("sess-new");
  });

  it("puts the session back when the audio cannot move", async () => {
    const { deps, sessions, cases } = setup({ audioUpdateFails: true });
    const result = await move(deps);
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(sessions.get("sess-0")).toMatchObject({ caseId: "src", recordingType: "full_meeting", status: "completed" });
    expect(cases.get("src").archived).toBe(false);
  });

  it("refuses once consent is sealed on the recovered case", async () => {
    const { deps, storage } = setup({ consentLogs: 1 });
    const result = await move(deps);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(storage.updateMeetingSession).not.toHaveBeenCalled();
  });

  it("refuses an ordinary case", async () => {
    const { deps } = setup({ recovered: false });
    expect(await move(deps)).toMatchObject({ ok: false, status: 400 });
  });

  it("needs the consent answer and a matter", async () => {
    const { deps } = setup();
    expect(await move(deps, { consentConfirmed: undefined })).toMatchObject({ ok: false, status: 400 });
    expect(await move(deps, { targetCaseId: "" })).toMatchObject({ ok: false, status: 400 });
    expect(await move(deps, { targetCaseId: "nope" })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("getRecoveredMoveStatus", () => {
  it("reports a movable recovered recording with its deletion date and consent clip", async () => {
    const { deps } = setup();
    expect(await getRecoveredMoveStatus(deps, "src", USER)).toMatchObject({
      recovered: true,
      block: null,
      audioRecordingId: "aud-1",
      hasConsentClip: true,
      litigationHold: false,
    });
  });

  it("explains why a recovered recording cannot move", async () => {
    const { deps } = setup({ consentLogs: 1 });
    expect(await getRecoveredMoveStatus(deps, "src", USER)).toMatchObject({ recovered: true, block: "has_consent" });
  });

  it("dates a newly created session from when the recording began, not when it was moved", async () => {
    const { deps, sessions } = setup({ sessions: 0 });
    const result = await move(deps);

    expect(result).toMatchObject({ ok: true, sessionId: "sess-new" });
    expect(sessions.get("sess-new").startedAt).toEqual(new Date("2026-11-08T08:42:00Z"));
  });

  it("moves an existing session back to the recording's start when it was dated later", async () => {
    const { deps, sessions } = setup();
    sessions.get("sess-0").startedAt = new Date("2026-11-09T09:59:00Z");
    await move(deps);

    expect(sessions.get("sess-0").startedAt).toEqual(new Date("2026-11-08T08:42:00Z"));
  });
});
