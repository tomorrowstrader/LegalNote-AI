import { describe, it, expect, vi, beforeEach } from "vitest";

const { testStorageRef, deleteCaseAudioRecordingMock } = vi.hoisted(() => ({
  testStorageRef: { current: null as import("./storage").MemStorage | null },
  deleteCaseAudioRecordingMock: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {},
  pool: {},
}));

vi.mock("./auditMiddleware", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
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

vi.mock("./services/audioDeletionService", async (importOriginal) => {
  const original = await importOriginal<typeof import("./services/audioDeletionService")>();
  return {
    ...original,
    deleteCaseAudioRecording: deleteCaseAudioRecordingMock,
  };
});

import { MemStorage } from "./storage";
import { storage } from "./storage";
import { deleteExpiredAudioRecording } from "./services/expiredAudioRecordingDeletion";
import { LitigationHoldDeletionBlockedError } from "./services/audioDeletionService";
import { cleanupExpiredAudioRecordings } from "./services/dataRetentionCleanup";

const USER_ID = "test-user-1";

async function seedCase(overrides: { litigationHold?: boolean } = {}) {
  return storage.createCase(
    {
      title: "Test Matter",
      clientName: "Test Client",
      sourceType: "audio",
      litigationHold: overrides.litigationHold ?? false,
    },
    USER_ID,
  );
}

async function seedExpiredRecording(
  caseId: string,
  overrides: {
    holdReleaseGraceUntil?: Date | null;
    colpReviewStatus?: string | null;
    filePath?: string;
    expiresAt?: Date;
  } = {},
) {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return storage.createAudioRecording({
    caseId,
    filePath: overrides.filePath ?? "audio/test-recording.webm",
    expiresAt: overrides.expiresAt ?? past,
    holdReleaseGraceUntil: overrides.holdReleaseGraceUntil ?? null,
    colpReviewStatus: overrides.colpReviewStatus ?? null,
  });
}

describe("expired audio retention queries (MemStorage)", () => {
  beforeEach(() => {
    testStorageRef.current = new MemStorage();
    deleteCaseAudioRecordingMock.mockReset();
  });

  it("getGraceExpiredAudioRecordings returns nothing when grace fields are null", async () => {
    const caseRecord = await seedCase();
    await seedExpiredRecording(caseRecord.id);

    const graceExpired = await storage.getGraceExpiredAudioRecordings();
    expect(graceExpired).toHaveLength(0);
  });

  it("getExpiredAudioRecordings excludes active COLP grace windows", async () => {
    const caseRecord = await seedCase();
    const futureGrace = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await seedExpiredRecording(caseRecord.id, {
      holdReleaseGraceUntil: futureGrace,
      colpReviewStatus: "awaiting_review",
    });

    const expired = await storage.getExpiredAudioRecordings();
    expect(expired).toHaveLength(0);
  });

  it("getGraceExpiredAudioRecordings includes lapsed grace windows", async () => {
    const caseRecord = await seedCase();
    const pastGrace = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recording = await seedExpiredRecording(caseRecord.id, {
      holdReleaseGraceUntil: pastGrace,
      colpReviewStatus: "awaiting_review",
    });

    const graceExpired = await storage.getGraceExpiredAudioRecordings();
    expect(graceExpired).toHaveLength(1);
    expect(graceExpired[0].id).toBe(recording.id);
  });

  it("getExpiredAudioRecordings includes normal expired recordings without grace fields", async () => {
    const caseRecord = await seedCase();
    const recording = await seedExpiredRecording(caseRecord.id);

    const expired = await storage.getExpiredAudioRecordings();
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe(recording.id);
  });
});

describe("deleteExpiredAudioRecording helper", () => {
  beforeEach(() => {
    testStorageRef.current = new MemStorage();
    deleteCaseAudioRecordingMock.mockReset();
  });

  it("deletes a non-held expired recording through the wrapper", async () => {
    const caseRecord = await seedCase();
    const recording = await seedExpiredRecording(caseRecord.id);

    deleteCaseAudioRecordingMock.mockResolvedValue(undefined);

    const result = await deleteExpiredAudioRecording({
      recording,
      trigger: "cron_retention",
      auditReason: "cron_retention_7day_retention_policy",
    });

    expect(result.outcome).toBe("deleted");
    expect(deleteCaseAudioRecordingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: caseRecord.id,
        audioRecordingId: recording.id,
        trigger: "cron_retention",
      }),
    );

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).not.toBeNull();
  });

  it("skips a held expired recording (blocked + not soft-deleted)", async () => {
    const caseRecord = await seedCase({ litigationHold: true });
    const recording = await seedExpiredRecording(caseRecord.id);

    deleteCaseAudioRecordingMock.mockRejectedValue(
      new LitigationHoldDeletionBlockedError({
        caseId: caseRecord.id,
        audioRecordingId: recording.id,
        holdStatus: {
          litigationHold: true,
          litigationHoldAppliedAt: null,
          litigationHoldAppliedBy: null,
          litigationHoldReason: null,
        },
      }),
    );

    const result = await deleteExpiredAudioRecording({
      recording,
      trigger: "cron_retention",
      auditReason: "cron_retention_7day_retention_policy",
    });

    expect(result.outcome).toBe("skipped_hold");

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).toBeNull();
  });
});

describe("cleanupExpiredAudioRecordings (cron global audio path)", () => {
  beforeEach(() => {
    testStorageRef.current = new MemStorage();
    deleteCaseAudioRecordingMock.mockReset();
  });

  it("deletes non-held expired recordings via cron_retention", async () => {
    const caseRecord = await seedCase();
    const recording = await seedExpiredRecording(caseRecord.id);

    deleteCaseAudioRecordingMock.mockResolvedValue(undefined);

    const result = await cleanupExpiredAudioRecordings();

    expect(result.deleted).toBe(1);
    expect(result.expiryDeleted).toBe(1);
    expect(result.graceDeleted).toBe(0);
    expect(result.skippedLitigationHold).toBe(0);

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).not.toBeNull();
  });

  it("counts held recordings as skippedLitigationHold", async () => {
    const caseRecord = await seedCase({ litigationHold: true });
    await seedExpiredRecording(caseRecord.id);

    deleteCaseAudioRecordingMock.mockRejectedValue(
      new LitigationHoldDeletionBlockedError({
        caseId: caseRecord.id,
        audioRecordingId: "any",
        holdStatus: {
          litigationHold: true,
          litigationHoldAppliedAt: null,
          litigationHoldAppliedBy: null,
          litigationHoldReason: null,
        },
      }),
    );

    const result = await cleanupExpiredAudioRecordings();

    expect(result.deleted).toBe(0);
    expect(result.skippedLitigationHold).toBe(1);
  });

  it("does not delete recordings in active grace windows", async () => {
    const caseRecord = await seedCase();
    const futureGrace = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const recording = await seedExpiredRecording(caseRecord.id, {
      holdReleaseGraceUntil: futureGrace,
      colpReviewStatus: "awaiting_review",
    });

    deleteCaseAudioRecordingMock.mockResolvedValue(undefined);

    const result = await cleanupExpiredAudioRecordings();

    expect(result.deleted).toBe(0);
    expect(deleteCaseAudioRecordingMock).not.toHaveBeenCalled();

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).toBeNull();
  });

  it("deletes lapsed grace-window recordings (also expired) via cron_retention when deduped", async () => {
    const caseRecord = await seedCase();
    const pastGrace = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recording = await seedExpiredRecording(caseRecord.id, {
      holdReleaseGraceUntil: pastGrace,
      colpReviewStatus: "awaiting_review",
    });

    deleteCaseAudioRecordingMock.mockResolvedValue(undefined);

    const result = await cleanupExpiredAudioRecordings();

    // Lapsed-grace recordings with past expiresAt appear in both lists; expiry path runs first.
    expect(result.deleted).toBe(1);
    expect(result.expiryDeleted).toBe(1);
    expect(result.graceDeleted).toBe(0);
    expect(deleteCaseAudioRecordingMock).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "cron_retention" }),
    );

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).not.toBeNull();
  });

  it("deletes grace-lapsed recordings via cron_grace_expiry when not in expiry set", async () => {
    const caseRecord = await seedCase();
    const pastGrace = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const recording = await seedExpiredRecording(caseRecord.id, {
      holdReleaseGraceUntil: pastGrace,
      colpReviewStatus: "awaiting_review",
      expiresAt: futureExpiry,
    });

    deleteCaseAudioRecordingMock.mockResolvedValue(undefined);

    const result = await cleanupExpiredAudioRecordings();

    expect(result.deleted).toBe(1);
    expect(result.graceDeleted).toBe(1);
    expect(result.expiryDeleted).toBe(0);
    expect(deleteCaseAudioRecordingMock).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "cron_grace_expiry" }),
    );

    const updated = await storage.getAudioRecording(recording.id);
    expect(updated?.deletedAt).not.toBeNull();
  });
});
