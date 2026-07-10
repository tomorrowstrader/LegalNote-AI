import type { Request } from "express";
import { ObjectStorageService } from "../objectStorage";
import { storage, type CaseLitigationHoldStatus } from "../storage";
import { logAuditEvent } from "../auditMiddleware";

export type AudioDeletionTrigger =
  | "lazy_by_case"
  | "lazy_stream"
  | "lazy_objects"
  | "startup_cleanup"
  | "cron_retention"
  | "cron_grace_expiry";

export class LitigationHoldDeletionBlockedError extends Error {
  readonly caseId: string;
  readonly audioRecordingId: string;
  readonly holdStatus: CaseLitigationHoldStatus;

  constructor(params: {
    caseId: string;
    audioRecordingId: string;
    holdStatus: CaseLitigationHoldStatus;
  }) {
    super(`Audio deletion blocked: case ${params.caseId} is under litigation hold`);
    this.name = "LitigationHoldDeletionBlockedError";
    this.caseId = params.caseId;
    this.audioRecordingId = params.audioRecordingId;
    this.holdStatus = params.holdStatus;
  }
}

export async function deleteCaseAudioRecording(params: {
  caseId: string;
  audioRecordingId: string;
  filePath: string;
  trigger: AudioDeletionTrigger;
  userId: string;
  expiresAt?: Date;
  req?: Request;
}): Promise<void> {
  // Fresh read immediately before delete — honours a hold applied moments earlier.
  const holdStatus = await storage.getCaseLitigationHoldStatus(params.caseId);
  if (!holdStatus) {
    throw new Error(`Case not found: ${params.caseId}`);
  }

  if (holdStatus.litigationHold) {
    await logAuditEvent(params.userId, "audio_deletion_blocked_litigation_hold", {
      caseId: params.caseId,
      audioRecordingId: params.audioRecordingId,
      metadata: {
        trigger: params.trigger,
        filePath: params.filePath,
        expiresAt: params.expiresAt?.toISOString() ?? null,
        attemptedAt: new Date().toISOString(),
        litigationHoldAppliedAt: holdStatus.litigationHoldAppliedAt?.toISOString() ?? null,
        litigationHoldAppliedBy: holdStatus.litigationHoldAppliedBy ?? null,
        litigationHoldReason: holdStatus.litigationHoldReason ?? null,
      },
      severity: "warning",
      req: params.req,
      ipAddress: params.req ? undefined : "server-process",
    });
    throw new LitigationHoldDeletionBlockedError({
      caseId: params.caseId,
      audioRecordingId: params.audioRecordingId,
      holdStatus,
    });
  }

  // Residual race: a hold could be applied in the milliseconds between this
  // check and the B2 delete below. Acceptable for Stage 1a; Stage 1b+ may
  // wrap check + delete in a transactional guard or rely on Object Lock.
  const objectStorageService = new ObjectStorageService();
  await objectStorageService.deleteObjectEntity(params.filePath);
}
