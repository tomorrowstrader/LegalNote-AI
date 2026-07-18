import { and, eq, sql } from "drizzle-orm";
import { cases } from "@shared/schema";
import { db } from "../db";
import { jobQueue } from "./jobQueue";
import type { IStorage } from "../storage";

/** Further-version jobs with timestamps, stuck longer than this, are treated as orphaned. */
const STUCK_PRODUCE_MS = 20 * 60 * 1000;
/** Grace period before treating a queued job with no in-memory worker as lost. */
const ORPHAN_GRACE_MS = 2 * 60 * 1000;

type AiProcessingMetadata = {
  status?: string;
  progress?: number;
  currentStep?: string;
  error?: string;
  statusBeforeProduce?: string;
  progressUpdatedAt?: string;
  produceStartedAt?: string;
  produceVersionFailed?: boolean;
  produceVersionError?: string;
  [key: string]: unknown;
};

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function lastProgressMs(meta: AiProcessingMetadata): number | null {
  return parseIsoMs(meta.progressUpdatedAt) ?? parseIsoMs(meta.produceStartedAt);
}

function hasActiveProduceJob(caseId: string): boolean {
  return jobQueue.getJobsByType("produce-document-version").some((job) => {
    const data = job.data as { caseId?: string } | undefined;
    if (data?.caseId !== caseId) return false;
    return job.status === "pending" || job.status === "processing";
  });
}

async function restoreProduceFailure(
  storage: IStorage,
  caseId: string,
  userId: string,
  meta: AiProcessingMetadata,
  reason: string,
): Promise<void> {
  const restored =
    meta.statusBeforeProduce === "completed" || meta.statusBeforeProduce === "review_required"
      ? meta.statusBeforeProduce
      : "review_required";

  await storage.updateCase(
    caseId,
    {
      status: restored,
      aiProcessingMetadata: {
        ...meta,
        status: "failed",
        progress: 0,
        currentStep: "Production failed",
        error: reason,
        produceVersionFailed: true,
        produceVersionError: reason,
        statusBeforeProduce: undefined,
        progressUpdatedAt: undefined,
        produceStartedAt: undefined,
      },
    },
    userId,
  );

  console.warn(
    `[PRODUCE-VERSION-RECOVERY] Restored stuck further-version case ${caseId} to status=${restored}`,
  );
}

/**
 * Restore a matter left mid further-version production after a process restart
 * or a hung LLM call — keeps prior documents on file.
 */
export async function recoverStuckProduceVersionCase(
  storage: IStorage,
  caseId: string,
  userId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) return false;
  if (caseData.status !== "processing") return false;

  const meta = (caseData.aiProcessingMetadata as AiProcessingMetadata) || {};
  if (typeof meta.statusBeforeProduce !== "string" || !meta.statusBeforeProduce) {
    return false;
  }

  const errorMessage =
    "Further version production timed out or was interrupted. The previous version is still on file — try Produce new version again.";

  // In-memory queue was lost (deploy/restart) — no active job for this matter.
  if (!hasActiveProduceJob(caseId)) {
    const startedAt = lastProgressMs(meta);
    // Brief grace so we don't race a just-enqueued job before the worker claims it
    if (startedAt != null && nowMs - startedAt < ORPHAN_GRACE_MS) {
      return false;
    }
    await restoreProduceFailure(storage, caseId, userId, meta, errorMessage);
    return true;
  }

  // Job still in memory but hung past the stuck threshold
  const startedAt = lastProgressMs(meta);
  if (startedAt == null || nowMs - startedAt < STUCK_PRODUCE_MS) {
    return false;
  }

  await restoreProduceFailure(storage, caseId, userId, meta, errorMessage);
  return true;
}

/**
 * Sweep matters stuck mid further-version production (in-memory job lost after
 * deploy/restart, or hung derivation call).
 */
export async function recoverStuckProduceVersionCases(
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
        sql`${cases.aiProcessingMetadata}->>'statusBeforeProduce' IS NOT NULL`,
      ),
    );

  let recovered = 0;
  for (const row of candidates) {
    const userId = row.assignedToUserId || row.createdBy;
    if (!userId) continue;
    try {
      if (await recoverStuckProduceVersionCase(storage, row.id, userId, nowMs)) {
        recovered++;
      }
    } catch (err) {
      console.error(`[PRODUCE-VERSION-RECOVERY] Failed for case ${row.id}:`, err);
    }
  }

  if (recovered > 0) {
    console.log(`[PRODUCE-VERSION-RECOVERY] Recovered ${recovered} stuck further-version matter(s)`);
  }
  return recovered;
}
