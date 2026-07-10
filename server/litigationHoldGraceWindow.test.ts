import { describe, it, expect, vi, beforeEach } from "vitest";

const { testStorageRef, logAuditEventMock } = vi.hoisted(() => ({
  testStorageRef: { current: null as import("./storage").MemStorage | null },
  logAuditEventMock: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {},
  pool: {},
}));

vi.mock("./auditMiddleware", () => ({
  logAuditEvent: logAuditEventMock,
}));

vi.mock("./storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("./storage")>();
  return {
    ...original,
    get storage() {
      if (!testStorageRef.current) {
        testStorageRef.current = new original.MemStorage();
      }
      return testStorageRef.current;
    },
  };
});

import { MemStorage } from "./storage";
import { storage } from "./storage";
import {
  GRACE_WINDOW_DAYS,
  clearCaseGraceWindow,
  setCaseGraceWindowOnRelease,
} from "./services/litigationHoldGraceWindowService";

const USER_ID = "test-user-1";

async function seedCase() {
  return storage.createCase(
    {
      title: "Test Matter",
      clientName: "Test Client",
      sourceType: "audio",
      litigationHold: true,
    },
    USER_ID,
  );
}

async function seedRecording(
  caseId: string,
  overrides: {
    deletedAt?: Date | null;
    holdReleaseGraceUntil?: Date | null;
    colpReviewStatus?: string | null;
  } = {},
) {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recording = await storage.createAudioRecording({
    caseId,
    filePath: "audio/test-recording.webm",
    expiresAt: past,
    holdReleaseGraceUntil: overrides.holdReleaseGraceUntil ?? null,
    colpReviewStatus: overrides.colpReviewStatus ?? null,
  });
  if (overrides.deletedAt) {
    await storage.updateAudioRecording(recording.id, { deletedAt: overrides.deletedAt });
  }
  return storage.getAudioRecording(recording.id);
}

describe("litigationHoldGraceWindowService", () => {
  beforeEach(() => {
    testStorageRef.current = new MemStorage();
    logAuditEventMock.mockReset();
    logAuditEventMock.mockResolvedValue(undefined);
  });

  it("setCaseGraceWindowOnRelease sets grace fields on non-deleted recordings", async () => {
    const caseRecord = await seedCase();
    const recording = await seedRecording(caseRecord.id);
    const before = Date.now();

    const result = await setCaseGraceWindowOnRelease({
      caseId: caseRecord.id,
      userId: USER_ID,
      clientName: caseRecord.clientName,
      caseTitle: caseRecord.title,
    });

    expect(result.recordingCount).toBe(1);
    const expectedMs = GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    expect(result.graceUntil.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
    expect(result.graceUntil.getTime()).toBeLessThanOrEqual(Date.now() + expectedMs + 1000);

    const updated = await storage.getAudioRecording(recording!.id);
    expect(updated?.colpReviewStatus).toBe("awaiting_review");
    expect(updated?.holdReleaseGraceUntil?.getTime()).toBe(result.graceUntil.getTime());

    expect(logAuditEventMock).toHaveBeenCalledWith(
      USER_ID,
      "litigation_hold_grace_window_set",
      expect.objectContaining({
        caseId: caseRecord.id,
        severity: "info",
        metadata: expect.objectContaining({
          recordingCount: 1,
          clientName: "Test Client",
          caseTitle: "Test Matter",
        }),
      }),
    );
  });

  it("setCaseGraceWindowOnRelease skips soft-deleted recordings", async () => {
    const caseRecord = await seedCase();
    const active = await seedRecording(caseRecord.id);
    await seedRecording(caseRecord.id, { deletedAt: new Date() });

    const result = await setCaseGraceWindowOnRelease({
      caseId: caseRecord.id,
      userId: USER_ID,
    });

    expect(result.recordingCount).toBe(1);
    const activeUpdated = await storage.getAudioRecording(active!.id);
    expect(activeUpdated?.colpReviewStatus).toBe("awaiting_review");
  });

  it("setCaseGraceWindowOnRelease on empty case returns recordingCount 0", async () => {
    const caseRecord = await seedCase();

    const result = await setCaseGraceWindowOnRelease({
      caseId: caseRecord.id,
      userId: USER_ID,
    });

    expect(result.recordingCount).toBe(0);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      USER_ID,
      "litigation_hold_grace_window_set",
      expect.objectContaining({
        metadata: expect.objectContaining({ recordingCount: 0 }),
      }),
    );
  });

  it("clearCaseGraceWindow clears grace fields on all recordings", async () => {
    const caseRecord = await seedCase();
    const futureGrace = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const recording = await seedRecording(caseRecord.id, {
      holdReleaseGraceUntil: futureGrace,
      colpReviewStatus: "awaiting_review",
    });
    await seedRecording(caseRecord.id, {
      deletedAt: new Date(),
      holdReleaseGraceUntil: futureGrace,
      colpReviewStatus: "awaiting_review",
    });

    const result = await clearCaseGraceWindow({
      caseId: caseRecord.id,
      userId: USER_ID,
    });

    expect(result.recordingCount).toBe(2);
    const updated = await storage.getAudioRecording(recording!.id);
    expect(updated?.holdReleaseGraceUntil).toBeNull();
    expect(updated?.colpReviewStatus).toBeNull();

    expect(logAuditEventMock).toHaveBeenCalledWith(
      USER_ID,
      "litigation_hold_grace_window_cleared",
      expect.objectContaining({
        caseId: caseRecord.id,
        severity: "info",
        metadata: { recordingCount: 2 },
      }),
    );
  });

  it("active grace excludes recording from getExpiredAudioRecordings (Stage 2)", async () => {
    const caseRecord = await seedCase();
    await seedRecording(caseRecord.id);

    await setCaseGraceWindowOnRelease({ caseId: caseRecord.id, userId: USER_ID });

    const expired = await storage.getExpiredAudioRecordings();
    expect(expired).toHaveLength(0);
  });

  it("lapsed grace includes recording in getGraceExpiredAudioRecordings (Stage 2)", async () => {
    const caseRecord = await seedCase();
    const pastGrace = new Date(Date.now() - 60 * 60 * 1000);
    const recording = await seedRecording(caseRecord.id, {
      holdReleaseGraceUntil: pastGrace,
      colpReviewStatus: "awaiting_review",
    });

    const graceExpired = await storage.getGraceExpiredAudioRecordings();
    expect(graceExpired).toHaveLength(1);
    expect(graceExpired[0].id).toBe(recording!.id);
  });
});
