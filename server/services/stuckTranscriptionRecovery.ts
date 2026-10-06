import { and, eq, or, sql } from "drizzle-orm";
import { cases } from "@shared/schema";
import { db } from "../db";
import { jobQueue } from "./jobQueue";
import { AI_PROCESSING_MAX_ATTEMPTS } from "./transcriptionWait";
import type { IStorage } from "../storage";

/** Don't race a job that has just been queued and not yet claimed. */
const ORPHAN_GRACE_MS = 2 * 60 * 1000;

type AiProcessingMetadata = {
  status?: string;
  assemblyTranscriptId?: string;
  transcriptionStartedAt?: string;
  processingQueuedAt?: string;
  meetingSessionId?: string;
};

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function hasActiveTranscriptionJob(caseId: string): boolean {
  return jobQueue.getJobsByType("ai-processing").some((job) => {
    const data = job.data as { caseId?: string } | undefined;
    if (data?.caseId !== caseId) return false;
    return job.status === "pending" || job.status === "processing";
  });
}

/**
 * Re-queue a transcription whose in-memory worker disappeared (deploy or restart)
 * during a long AssemblyAI wait. The new job resumes the saved provider transcript.
 */
export async function recoverStuckTranscriptionCase(
  storage: IStorage,
  caseId: string,
  userId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (hasActiveTranscriptionJob(caseId)) return false;

  const caseData = await storage.getCase(caseId, userId);
  if (!caseData || caseData.status !== "processing") return false;

  const meta = (caseData.aiProcessingMetadata as AiProcessingMetadata) || {};
  if (meta.status !== "transcribing" && meta.status !== "processing") return false;

  const startedAt = parseIsoMs(meta.transcriptionStartedAt) ?? parseIsoMs(meta.processingQueuedAt);
  if (startedAt != null && nowMs - startedAt < ORPHAN_GRACE_MS) return false;
  // A brand-new queue write with no timestamp is left for the live worker.
  if (startedAt == null && meta.status === "processing") return false;

  await jobQueue.addJob(
    "ai-processing",
    { caseId, userId, sessionId: meta.meetingSessionId },
    { maxAttempts: AI_PROCESSING_MAX_ATTEMPTS },
  );
  console.warn(
    `[TRANSCRIPTION-RECOVERY] Re-queued transcription for case ${caseId}` +
      (meta.assemblyTranscriptId ? ` (resume ${meta.assemblyTranscriptId})` : ""),
  );
  return true;
}

export async function recoverStuckTranscriptionCases(
  storage: IStorage,
  nowMs: number = Date.now(),
): Promise<number> {
  const candidates = await db
    .select({
      id: cases.id,
      createdBy: cases.createdBy,
      assignedToUserId: cases.assignedToUserId,
    })
    .from(cases)
    .where(
      and(
        eq(cases.status, "processing"),
        or(
          sql`${cases.aiProcessingMetadata}->>'status' = 'transcribing'`,
          sql`${cases.aiProcessingMetadata}->>'status' = 'processing'`,
        ),
      ),
    );

  let recovered = 0;
  for (const row of candidates) {
    const userId = row.assignedToUserId || row.createdBy;
    if (!userId) continue;
    try {
      if (await recoverStuckTranscriptionCase(storage, row.id, userId, nowMs)) {
        recovered++;
      }
    } catch (err) {
      console.error(`[TRANSCRIPTION-RECOVERY] Failed for case ${row.id}:`, err);
    }
  }

  if (recovered > 0) {
    console.log(`[TRANSCRIPTION-RECOVERY] Re-queued ${recovered} transcription(s)`);
  }
  return recovered;
}
