import { describe, expect, it } from "vitest";
import {
  downloadTimeoutMs,
  isTransientPollError,
  pollTranscriptUntilDone,
  transcriptionWaitMs,
  TranscriptNotFoundError,
  uploadTimeoutMs,
} from "./transcriptionWait";
import { isJobRunnable } from "./jobQueue";
import {
  estimateTranscriptionSeconds,
  formatEtaCountdown,
  milestoneRemainingSeconds,
} from "../../client/src/lib/processingEta";

describe("transcriptionWaitMs", () => {
  it("gives a short recording the minimum queue budget", () => {
    expect(transcriptionWaitMs(0)).toBe(20 * 60 * 1000);
    expect(transcriptionWaitMs(5 * 60)).toBe(20 * 60 * 1000);
  });

  it("waits longer than the recording for a 47-minute meeting", () => {
    const wait = transcriptionWaitMs(47 * 60);
    expect(wait).toBe((15 + 47) * 60 * 1000);
    expect(wait).toBeGreaterThan(47 * 60 * 1000);
    expect(wait).toBeGreaterThan(10 * 60 * 1000);
  });

  it("covers a 4-hour meeting and caps pathological durations", () => {
    expect(transcriptionWaitMs(4 * 60 * 60)).toBe((15 + 4 * 60) * 60 * 1000);
    expect(transcriptionWaitMs(24 * 60 * 60)).toBe(5 * 60 * 60 * 1000);
    expect(transcriptionWaitMs(Number.NaN)).toBe(20 * 60 * 1000);
  });
});

describe("transfer timeouts", () => {
  it("scales upload time with file size and stays bounded", () => {
    expect(uploadTimeoutMs(0)).toBe(2 * 60 * 1000);
    // One minute of bytes at the assumed rate stays on the 2-minute floor.
    expect(uploadTimeoutMs(256 * 1024 * 60)).toBe(2 * 60 * 1000);
    expect(uploadTimeoutMs(256 * 1024 * 180)).toBe(180 * 1000);
    expect(uploadTimeoutMs(1024 * 1024 * 1024)).toBe(30 * 60 * 1000);
  });

  it("gives long recordings more time to download", () => {
    expect(downloadTimeoutMs(60)).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(downloadTimeoutMs(4 * 60 * 60)).toBe(30 * 60 * 1000);
  });
});

describe("pollTranscriptUntilDone", () => {
  it("keeps waiting past 10 minutes until the provider finishes", async () => {
    let clock = 0;
    let polls = 0;
    const result = await pollTranscriptUntilDone({
      audioDurationSec: 47 * 60,
      maxWaitMs: 20 * 60 * 1000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      poll: async () => {
        polls += 1;
        if (clock < 12 * 60 * 1000) return { status: "processing" as const };
        return { status: "completed" as const };
      },
    });

    expect(result.status).toBe("completed");
    expect(clock).toBeGreaterThan(10 * 60 * 1000);
    expect(polls).toBeGreaterThan(1);
  });

  it("reports the real wait when the budget runs out", async () => {
    let clock = 0;
    await expect(
      pollTranscriptUntilDone({
        audioDurationSec: 4 * 60 * 60,
        maxWaitMs: 62 * 60 * 1000,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
        poll: async () => ({ status: "processing" as const }),
      }),
    ).rejects.toThrow(/timed out after 62 minutes/);
  });

  it("treats an aborted request as transient and keeps polling", async () => {
    let clock = 0;
    let polls = 0;
    const result = await pollTranscriptUntilDone({
      audioDurationSec: 60 * 60,
      maxWaitMs: 5 * 60 * 1000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      poll: async () => {
        polls += 1;
        if (polls < 3) {
          const error = new Error("The operation was aborted");
          error.name = "TimeoutError";
          throw error;
        }
        return { status: "completed" as const };
      },
    });
    expect(result.status).toBe("completed");
  });

  it("stops on a provider transcription error", async () => {
    await expect(
      pollTranscriptUntilDone({
        audioDurationSec: 60 * 60,
        maxWaitMs: 20 * 60 * 1000,
        now: () => 0,
        sleep: async () => {},
        poll: async () => ({ status: "error" as const, error: "language detection failed" }),
      }),
    ).rejects.toThrow(/language detection failed/);
  });

  it("does not treat a missing transcript as a blip", () => {
    expect(isTransientPollError(new TranscriptNotFoundError())).toBe(false);
    const timeout = new Error("aborted");
    timeout.name = "AbortError";
    expect(isTransientPollError(timeout)).toBe(true);
  });
});

describe("isJobRunnable", () => {
  const base = { attempts: 1, maxAttempts: 2 };

  it("does not pick up a job that is waiting for backoff", () => {
    const retryAt = new Date(Date.now() + 10_000);
    expect(isJobRunnable({ ...base, status: "pending", retryAt }, Date.now())).toBe(false);
    expect(isJobRunnable({ ...base, status: "pending", retryAt }, retryAt.getTime() + 1)).toBe(true);
  });

  it("runs a pending job and stops after the last attempt", () => {
    expect(isJobRunnable({ ...base, status: "pending" })).toBe(true);
    expect(isJobRunnable({ status: "failed", attempts: 2, maxAttempts: 2 })).toBe(false);
    expect(isJobRunnable({ status: "processing", attempts: 1, maxAttempts: 2 })).toBe(false);
  });
});

describe("transcription ETA", () => {
  it("does not cap a long recording at four minutes", () => {
    expect(estimateTranscriptionSeconds(47 * 60)).toBeGreaterThan(10 * 60);
    expect(estimateTranscriptionSeconds(4 * 60 * 60)).toBeGreaterThan(60 * 60);
    const remaining = milestoneRemainingSeconds(20, { audioDurationSec: 47 * 60 });
    expect(remaining).toBeGreaterThan(10 * 60);
  });

  it("formats waits longer than an hour", () => {
    expect(formatEtaCountdown(90)).toBe("1:30");
    expect(formatEtaCountdown(90 * 60)).toBe("1h 30m");
  });
});
