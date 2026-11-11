import { describe, expect, it, vi } from "vitest";
import { fileParkedRecording, type FileParkedRecordingDeps } from "./fileParkedRecording";

const USER = "user-1";
const AREAS = ["clinical_negligence", "family"] as const;
const RECORDED = new Date("2026-11-08T09:30:00Z");

function setup(options: { parked?: boolean; assembleFails?: boolean; noPracticeArea?: boolean; archived?: boolean } = {}) {
  const cases = new Map<string, any>([
    ["dst", {
      id: "dst",
      title: "Matter",
      matterKind: "client",
      practiceArea: options.noPracticeArea ? null : "family",
      archived: !!options.archived,
    }],
  ]);
  const sessions = new Map<string, any>();
  const audio = new Map<string, any>();
  const audit: any[] = [];

  const storage = {
    getCase: vi.fn(async (id: string) => cases.get(id)),
    updateCase: vi.fn(async (id: string, updates: any) => {
      cases.set(id, { ...cases.get(id), ...updates });
      return cases.get(id);
    }),
    createMeetingSession: vi.fn(async (data: any) => {
      // The database stamps the filing time.
      const s = { ...data, id: `sess-${sessions.size + 1}`, startedAt: new Date("2026-11-10T11:00:00Z") };
      sessions.set(s.id, s);
      return s;
    }),
    getMeetingSession: vi.fn(async (id: string) => sessions.get(id)),
    updateMeetingSession: vi.fn(async (id: string, updates: any) => {
      sessions.set(id, { ...sessions.get(id), ...updates });
      return sessions.get(id);
    }),
    getAudioRecording: vi.fn(async (id: string) => audio.get(id)),
    updateAudioRecording: vi.fn(async (id: string, updates: any) => {
      audio.set(id, { ...audio.get(id), ...updates });
      return audio.get(id);
    }),
    createAuditLog: vi.fn(async (entry: any) => {
      audit.push(entry);
      return entry;
    }),
  };

  const deps = {
    storage,
    getParked: vi.fn(async () =>
      options.parked === false
        ? null
        : { id: "rec-1", startedAt: RECORDED, durationSeconds: 1200, hasConsent: true, expiresAt: new Date("2026-11-15T09:30:00Z") },
    ),
    assemble: vi.fn(async (_id: string, _uid: string, target: { caseId: string }) => {
      if (options.assembleFails) return { ok: false as const, message: "Missing audio chunks" };
      audio.set("aud-1", { id: "aud-1", caseId: target.caseId, recordedAt: RECORDED });
      return {
        ok: true as const,
        audioRecordingId: "aud-1",
        filePath: "/objects/a.webm",
        consentSegmentPath: "/objects/c.webm",
        startedAt: RECORDED,
        durationSeconds: 1200,
      };
    }),
    recordConsent: vi.fn(async () => ({})),
    applyObjectHold: vi.fn(async () => null),
  } as unknown as FileParkedRecordingDeps & { [k: string]: any };

  return { deps, storage, cases, sessions, audio, audit };
}

const file = (deps: FileParkedRecordingDeps, overrides: Record<string, unknown> = {}) =>
  fileParkedRecording(deps, {
    recordingSessionId: "rec-1",
    targetCaseId: "dst",
    recordingType: "full_meeting",
    consentConfirmed: true,
    userId: USER,
    practiceAreas: AREAS,
    ...overrides,
  });

describe("fileParkedRecording", () => {
  it("files the recording on the matter, dated from when it was recorded, and seals consent", async () => {
    const { deps, sessions, audio, audit } = setup();
    const result = await file(deps);

    expect(result).toMatchObject({ ok: true, caseId: "dst", sessionId: "sess-1", consentSealed: true });
    expect(sessions.get("sess-1").startedAt).toEqual(RECORDED);
    expect(audio.get("aud-1").meetingSessionId).toBe("sess-1");
    expect(deps.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: "dst", audioRecordingId: "aud-1", source: "quick_record_filed_later" }),
    );
    expect(audit.map((a) => a.eventType)).toEqual(["session_dated_from_recording", "parked_recording_filed"]);
  });

  it("leaves consent for the matter when the user has not confirmed it", async () => {
    const { deps } = setup();
    const result = await file(deps, { consentConfirmed: false });

    expect(result).toMatchObject({ ok: true, consentSealed: false });
    expect(deps.recordConsent).not.toHaveBeenCalled();
  });

  it("creates no session when the audio cannot be assembled", async () => {
    const { deps, storage } = setup({ assembleFails: true });
    const result = await file(deps);

    expect(result).toEqual({ ok: false, status: 409, message: "Missing audio chunks" });
    expect(storage.createMeetingSession).not.toHaveBeenCalled();
  });

  it("asks for a practice area on a client matter that has none, and sets it", async () => {
    const { deps, cases } = setup({ noPracticeArea: true });
    expect(await file(deps)).toMatchObject({ ok: false, status: 400 });
    expect(await file(deps, { practiceArea: "family" })).toMatchObject({ ok: true });
    expect(cases.get("dst").practiceArea).toBe("family");
  });

  it("refuses an archived matter, a missing consent answer, and a recording no longer parked", async () => {
    expect(await file(setup({ archived: true }).deps)).toMatchObject({ ok: false, status: 400 });
    expect(await file(setup().deps, { consentConfirmed: undefined })).toMatchObject({ ok: false, status: 400 });
    expect(await file(setup({ parked: false }).deps)).toMatchObject({ ok: false, status: 404 });
  });
});
