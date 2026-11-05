import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageMock, getFileMock } = vi.hoisted(() => ({
  storageMock: { createAuditLog: vi.fn() },
  getFileMock: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: storageMock }));
vi.mock("../objectStorage", () => ({
  ObjectStorageService: class {
    getFile = getFileMock;
  },
}));
vi.mock("./litigationHoldObjectLockService", () => ({ applyObjectLegalHoldForNewRecording: vi.fn() }));
vi.mock("./consentSegmentService", () => ({ preserveConsentSegmentFromFullAudio: vi.fn() }));

import { removeRecallMediaAfterStorage } from "./recallProcessing";
import { recallService } from "./recallService";

const audio = Buffer.from("recording");
const params = { importId: "i1", botId: "b1", userId: "u1", audioPath: "p", audioBuffer: audio };

function mockRecall(body = "", status = 200) {
  const fetchMock = vi.fn(async () => new Response(body || null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RECALL_API_KEY = "test-key";
});

describe("removeRecallMediaAfterStorage", () => {
  it("deletes Recall's copy once the stored file matches, handling an empty response", async () => {
    getFileMock.mockResolvedValue(Buffer.from("recording"));
    const fetchMock = mockRecall("", 204);

    await expect(removeRecallMediaAfterStorage(params)).resolves.toBe(true);

    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/bot\/b1\/delete_media\/$/);
    expect(options.method).toBe("POST");
    expect(storageMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recall_media_deleted" }),
    );
  });

  it("keeps Recall's copy when the stored file differs", async () => {
    getFileMock.mockResolvedValue(Buffer.from("truncated"));
    const fetchMock = mockRecall();

    await expect(removeRecallMediaAfterStorage(params)).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(storageMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recall_media_delete_failed", severity: "warning" }),
    );
  });

  it("keeps Recall's copy when the stored file can't be read", async () => {
    getFileMock.mockRejectedValue(new Error("storage down"));
    const fetchMock = mockRecall();

    await expect(removeRecallMediaAfterStorage(params)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("doesn't throw when Recall or the audit log fails", async () => {
    getFileMock.mockResolvedValue(Buffer.from("recording"));
    mockRecall(JSON.stringify({ detail: "unavailable" }), 503);
    storageMock.createAuditLog.mockRejectedValueOnce(new Error("db down"));

    await expect(removeRecallMediaAfterStorage(params)).resolves.toBe(false);
  });
});

describe("createBot", () => {
  it("sets Recall's documented 7-day retention and keeps audio-only capture", async () => {
    const fetchMock = mockRecall(JSON.stringify({ id: "b1" }));

    await recallService.createBot("https://teams.microsoft.com/l/meetup-join/x");

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const { recording_config } = JSON.parse(String(options.body));
    expect(recording_config.retention).toEqual({ type: "timed", hours: 168 });
    expect(recording_config.video_mixed_layout).toBe("audio_only");
  });
});
