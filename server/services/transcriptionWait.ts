/**
 * How long Meeting-to-Matter waits for AssemblyAI after a recording ends.
 *
 * Meeting length is capped at 4 hours (insertAudioRecordingSchema). Transcription
 * is a separate wait: diarized Universal-3 Pro under load can take a large
 * fraction of the recording's length. A fixed 10-minute poll drops any meeting
 * that is still transcribing at that point, including ordinary 45-minute calls.
 */

export const MAX_RECORDING_DURATION_SEC = 4 * 60 * 60;

/** Queue plus upload before AssemblyAI has meaningful progress. */
const QUEUE_OVERHEAD_MS = 15 * 60 * 1000;
/** Short calls still need room for a slow queue. */
const MIN_TRANSCRIPTION_WAIT_MS = 20 * 60 * 1000;
/** 4-hour meeting, plus headroom if the provider runs slower than real time. */
const MAX_TRANSCRIPTION_WAIT_MS = 5 * 60 * 60 * 1000;

export const AI_PROCESSING_MAX_ATTEMPTS = 2;

const POLL_INTERVAL_MS = 3_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 8;

export class TranscriptNotFoundError extends Error {
  constructor() {
    super("Transcript not found");
    this.name = "TranscriptNotFoundError";
  }
}

export function transcriptionWaitMs(audioDurationSec: number): number {
  const durationMs = Math.max(0, Number.isFinite(audioDurationSec) ? audioDurationSec : 0) * 1000;
  // Wait at least as long as the recording itself. A 47-minute diarized file
  // has already exceeded a 10-minute ceiling in production.
  const scaled = QUEUE_OVERHEAD_MS + durationMs;
  return Math.min(MAX_TRANSCRIPTION_WAIT_MS, Math.max(MIN_TRANSCRIPTION_WAIT_MS, scaled));
}

export function uploadTimeoutMs(byteLength: number): number {
  const min = 2 * 60 * 1000;
  const max = 30 * 60 * 1000;
  const bytes = Math.max(0, Number.isFinite(byteLength) ? byteLength : 0);
  // 256 KB/s keeps a slow link from being treated as a hang.
  const seconds = Math.ceil(bytes / (256 * 1024));
  return Math.min(max, Math.max(min, seconds * 1000));
}

export function downloadTimeoutMs(audioDurationSec: number): number {
  const min = 5 * 60 * 1000;
  const max = 30 * 60 * 1000;
  const duration = Math.max(0, Number.isFinite(audioDurationSec) ? audioDurationSec : 0);
  return Math.min(max, Math.max(min, min + duration * 500));
}

export function isTransientPollError(error: unknown): boolean {
  if (error instanceof TranscriptNotFoundError) return false;
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  const message = error.message.toLowerCase();
  if (message.startsWith("transcription error:")) return false;
  if (message.startsWith("failed to poll transcript:")) {
    // 4xx bodies are permanent. Timeouts and 5xx are not.
    if (message.includes("404") || message.includes("400") || message.includes("401") || message.includes("422")) {
      return false;
    }
  }
  return true;
}

type PollableTranscript = {
  status: "queued" | "processing" | "completed" | "error";
  error?: string | null;
};

/**
 * Poll until AssemblyAI finishes, the wait budget for this recording ends,
 * or the provider returns a permanent error. A single hung or aborted request
 * does not end the wait.
 */
export async function pollTranscriptUntilDone<T extends PollableTranscript>(options: {
  audioDurationSec: number;
  poll: () => Promise<T>;
  onTick?: (elapsedMs: number, waitMs: number) => Promise<void> | void;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxWaitTime = options.maxWaitMs ?? transcriptionWaitMs(options.audioDurationSec);
  const start = now();
  let consecutiveErrors = 0;

  while (now() - start < maxWaitTime) {
    try {
      const result = await options.poll();
      consecutiveErrors = 0;

      if (result.status === "completed") return result;
      if (result.status === "error") {
        throw new Error(`Transcription error: ${result.error || "unknown error"}`);
      }

      const elapsed = now() - start;
      try {
        await options.onTick?.(elapsed, maxWaitTime);
      } catch (tickError) {
        console.warn("[AssemblyAI] Progress update failed:", tickError);
      }
    } catch (error) {
      if (!isTransientPollError(error)) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to poll transcript: ${message}`);
      }
    }

    const remaining = maxWaitTime - (now() - start);
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_INTERVAL_MS, remaining));
  }

  const minutes = Math.max(1, Math.round(maxWaitTime / 60_000));
  throw new Error(
    `Transcription timed out after ${minutes} minutes. The recording is saved - retry to continue it.`,
  );
}
