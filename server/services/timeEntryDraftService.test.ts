import { describe, it, expect, vi, beforeEach } from "vitest";

const { testStorageRef } = vi.hoisted(() => ({
  testStorageRef: { current: null as import("../storage").MemStorage | null },
}));

vi.mock("../db", () => ({
  db: {},
  pool: {},
}));

vi.mock("../storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("../storage")>();
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

import { MemStorage } from "../storage";
import { storage } from "../storage";
import { ensureDraftTimeEntryForSession } from "./timeEntryDraftService";

const USER_ID = "test-user-1";

async function seedCase(matterKind?: "client" | "internal") {
  return storage.createCase(
    {
      title: "Test Matter",
      clientName: "Test Client",
      sourceType: "audio",
      ...(matterKind ? { matterKind } : {}),
    } as any,
    USER_ID,
  );
}

async function seedSession(caseId: string, durationSeconds = 60) {
  return storage.createMeetingSession({
    caseId,
    createdBy: USER_ID,
    durationSeconds,
  } as any);
}

describe("ensureDraftTimeEntryForSession", () => {
  beforeEach(() => {
    testStorageRef.current = new MemStorage();
  });

  it("does not create a draft time entry for an internal (non-client) meeting", async () => {
    const caseRecord = await seedCase("internal");
    const session = await seedSession(caseRecord.id);
    const createTimeEntrySpy = vi.spyOn(storage, "createTimeEntry");

    const result = await ensureDraftTimeEntryForSession({
      caseId: caseRecord.id,
      userId: USER_ID,
      sessionId: session.id,
      durationSeconds: 60,
    });

    expect(result).toBeNull();
    expect(createTimeEntrySpy).not.toHaveBeenCalled();
  });

  it("still creates a draft time entry for a client matter", async () => {
    const caseRecord = await seedCase("client");
    const session = await seedSession(caseRecord.id);

    const fakeEntry = {
      id: "entry-1",
      caseId: caseRecord.id,
      userId: USER_ID,
      meetingSessionId: session.id,
      durationMinutes: 1,
      description: "Meeting time (auto-drafted from session)",
      hourlyRate: "0.00",
      status: "draft",
    };
    vi.spyOn(storage, "createTimeEntry").mockResolvedValue(fakeEntry as any);
    vi.spyOn(storage, "createAuditLog").mockResolvedValue({} as any);

    const result = await ensureDraftTimeEntryForSession({
      caseId: caseRecord.id,
      userId: USER_ID,
      sessionId: session.id,
      durationSeconds: 60,
    });

    expect(result).toEqual(fakeEntry);
    expect(storage.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: caseRecord.id, durationMinutes: 1 }),
    );
  });

  it("defaults to treating a case as a client matter when matterKind predates the column", async () => {
    const caseRecord = await seedCase(undefined);
    const session = await seedSession(caseRecord.id);

    vi.spyOn(storage, "createTimeEntry").mockResolvedValue({ id: "entry-2" } as any);
    vi.spyOn(storage, "createAuditLog").mockResolvedValue({} as any);

    const result = await ensureDraftTimeEntryForSession({
      caseId: caseRecord.id,
      userId: USER_ID,
      sessionId: session.id,
      durationSeconds: 60,
    });

    expect(result).not.toBeNull();
  });

  it("returns null when the session does not belong to the case", async () => {
    const caseRecord = await seedCase("client");
    const otherCase = await seedCase("client");
    const session = await seedSession(otherCase.id);

    const result = await ensureDraftTimeEntryForSession({
      caseId: caseRecord.id,
      userId: USER_ID,
      sessionId: session.id,
      durationSeconds: 60,
    });

    expect(result).toBeNull();
  });
});
