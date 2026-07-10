import type { Request } from "express";
import type { AudioRecording } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";
import { logAuditEvent } from "../auditMiddleware";

export type ObjectLockObjectKind = "main" | "consent_segment";

export type ObjectLockObjectResult = {
  audioRecordingId: string;
  path: string;
  resolvedKey: string;
  kind: ObjectLockObjectKind;
  status: "succeeded" | "failed" | "skipped";
  error?: string;
};

export type ObjectLockSyncResult = {
  status: "complete" | "partial" | "failed" | "empty";
  apply: boolean;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ObjectLockObjectResult[];
};

type ObjectTarget = {
  audioRecordingId: string;
  path: string | null | undefined;
  kind: ObjectLockObjectKind;
};

type AuditTrigger = "case_hold_sync" | "new_recording_on_held_case";

function buildWarning(apply: boolean, result: ObjectLockSyncResult): string | undefined {
  if (result.status === "complete" || result.status === "empty") {
    return undefined;
  }

  const count = result.failed;
  if (apply) {
    return `Litigation hold applied in database but storage-level protection failed for ${count} object(s). Case is protected by app guard only until resolved.`;
  }

  return `Litigation hold released in database but storage-level lock could NOT be removed for ${count} object(s) — these objects cannot be deleted until resolved. Manual intervention required.`;
}

function aggregateResults(apply: boolean, results: ObjectLockObjectResult[]): ObjectLockSyncResult {
  const succeeded = results.filter((result) => result.status === "succeeded").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const total = results.length;

  let status: ObjectLockSyncResult["status"];
  if (total === 0) {
    status = "empty";
  } else if (failed === 0) {
    status = "complete";
  } else if (succeeded === 0) {
    status = "failed";
  } else {
    status = "partial";
  }

  return { status, apply, total, succeeded, failed, skipped, results };
}

async function setLegalHoldOnObject(
  objectStorage: ObjectStorageService,
  target: ObjectTarget,
  apply: boolean,
): Promise<ObjectLockObjectResult> {
  const { audioRecordingId, path, kind } = target;

  if (!path || path.trim() === "") {
    return {
      audioRecordingId,
      path: path ?? "",
      resolvedKey: "",
      kind,
      status: "skipped",
    };
  }

  const resolvedKey = objectStorage.resolveS3KeyFromPath(path);

  try {
    await objectStorage.setObjectLegalHold(path, apply ? "ON" : "OFF");
    return {
      audioRecordingId,
      path,
      resolvedKey,
      kind,
      status: "succeeded",
    };
  } catch (error) {
    return {
      audioRecordingId,
      path,
      resolvedKey,
      kind,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function syncRecordingObjectLegalHolds(
  objectStorage: ObjectStorageService,
  recording: Pick<AudioRecording, "id" | "filePath" | "consentSegmentPath">,
  apply: boolean,
): Promise<ObjectLockObjectResult[]> {
  const results: ObjectLockObjectResult[] = [];

  results.push(
    await setLegalHoldOnObject(
      objectStorage,
      { audioRecordingId: recording.id, path: recording.filePath, kind: "main" },
      apply,
    ),
  );

  if (recording.consentSegmentPath) {
    results.push(
      await setLegalHoldOnObject(
        objectStorage,
        {
          audioRecordingId: recording.id,
          path: recording.consentSegmentPath,
          kind: "consent_segment",
        },
        apply,
      ),
    );
  }

  return results;
}

async function auditObjectLockSync(params: {
  caseId: string;
  audioRecordingId?: string;
  userId: string;
  req?: Request;
  trigger: AuditTrigger;
  syncResult: ObjectLockSyncResult;
}): Promise<void> {
  const { caseId, audioRecordingId, userId, req, trigger, syncResult } = params;
  const failures = syncResult.results.filter((result) => result.status === "failed");
  const metadata = {
    trigger,
    apply: syncResult.apply,
    status: syncResult.status,
    total: syncResult.total,
    succeeded: syncResult.succeeded,
    failed: syncResult.failed,
    skipped: syncResult.skipped,
    failures,
    attemptedAt: new Date().toISOString(),
  };

  if (trigger === "new_recording_on_held_case") {
    if (syncResult.status === "complete" || syncResult.status === "empty") {
      await logAuditEvent(userId, "litigation_hold_object_lock_new_recording", {
        caseId,
        audioRecordingId,
        metadata,
        severity: "info",
        req,
      });
      return;
    }

    await logAuditEvent(userId, "litigation_hold_object_lock_failed", {
      caseId,
      audioRecordingId,
      metadata: { ...metadata, trigger: "new_recording_on_held_case" },
      severity: "warning",
      req,
    });
    return;
  }

  if (!syncResult.apply) {
    if (syncResult.status === "complete" || syncResult.status === "empty") {
      await logAuditEvent(userId, "litigation_hold_object_lock_applied", {
        caseId,
        metadata: { ...metadata, action: "release" },
        severity: "info",
        req,
      });
      return;
    }

    await logAuditEvent(userId, "litigation_hold_object_lock_release_failed", {
      caseId,
      metadata,
      severity: "critical",
      req,
    });
    return;
  }

  if (syncResult.status === "complete" || syncResult.status === "empty") {
    await logAuditEvent(userId, "litigation_hold_object_lock_applied", {
      caseId,
      metadata: { ...metadata, action: "apply" },
      severity: "info",
      req,
    });
    return;
  }

  await logAuditEvent(userId, "litigation_hold_object_lock_failed", {
    caseId,
    metadata: { ...metadata, action: "apply" },
    severity: "warning",
    req,
  });
}

export function buildObjectLockResponse(syncResult: ObjectLockSyncResult): {
  objectLock: ObjectLockSyncResult;
  warning?: string;
} {
  const warning = buildWarning(syncResult.apply, syncResult);
  return {
    objectLock: syncResult,
    ...(warning ? { warning } : {}),
  };
}

export async function syncCaseObjectLegalHolds(params: {
  caseId: string;
  apply: boolean;
  userId: string;
  req?: Request;
}): Promise<ObjectLockSyncResult> {
  const recordings = await storage.getAudioRecordingsByCaseId(params.caseId);
  const objectStorage = new ObjectStorageService();
  const results: ObjectLockObjectResult[] = [];

  for (const recording of recordings) {
    const recordingResults = await syncRecordingObjectLegalHolds(
      objectStorage,
      recording,
      params.apply,
    );
    results.push(...recordingResults);
  }

  const syncResult = aggregateResults(params.apply, results);

  await auditObjectLockSync({
    caseId: params.caseId,
    userId: params.userId,
    req: params.req,
    trigger: "case_hold_sync",
    syncResult,
  });

  return syncResult;
}

export async function applyObjectLegalHoldForNewRecording(params: {
  caseId: string;
  audioRecordingId: string;
  filePath: string | null | undefined;
  consentSegmentPath?: string | null | undefined;
  userId: string;
  req?: Request;
}): Promise<ObjectLockSyncResult | null> {
  const holdStatus = await storage.getCaseLitigationHoldStatus(params.caseId);
  if (!holdStatus?.litigationHold) {
    return null;
  }

  const objectStorage = new ObjectStorageService();
  const results = await syncRecordingObjectLegalHolds(
    objectStorage,
    {
      id: params.audioRecordingId,
      filePath: params.filePath,
      consentSegmentPath: params.consentSegmentPath ?? null,
    },
    true,
  );

  const syncResult = aggregateResults(true, results);

  await auditObjectLockSync({
    caseId: params.caseId,
    audioRecordingId: params.audioRecordingId,
    userId: params.userId,
    req: params.req,
    trigger: "new_recording_on_held_case",
    syncResult,
  });

  return syncResult;
}
