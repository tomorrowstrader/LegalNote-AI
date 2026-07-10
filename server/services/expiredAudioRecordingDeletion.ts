import type { AudioRecording } from "@shared/schema";
import { logAuditEvent } from "../auditMiddleware";
import { storage } from "../storage";
import {
  deleteCaseAudioRecording,
  LitigationHoldDeletionBlockedError,
  type AudioDeletionTrigger,
} from "./audioDeletionService";

const AUDIO_RETENTION_DAYS = 7;

export type ExpiredAudioDeletionOutcome =
  | "deleted"
  | "skipped_hold"
  | "skipped_no_path"
  | "error";

export type ExpiredAudioDeletionResult = {
  outcome: ExpiredAudioDeletionOutcome;
  error?: unknown;
};

/**
 * Hold-aware per-recording deletion for expired audio (startup cleanup + retention cron).
 * Resolves auditUserId, calls deleteCaseAudioRecording, sets deletedAt + audit events on success.
 */
export async function deleteExpiredAudioRecording(params: {
  recording: AudioRecording;
  trigger: AudioDeletionTrigger;
  auditReason: string;
}): Promise<ExpiredAudioDeletionResult> {
  const { recording, trigger, auditReason } = params;

  if (!recording.filePath) {
    return { outcome: "skipped_no_path" };
  }

  try {
    const caseRecord = await storage.getCaseById(recording.caseId);
    const holdStatus = await storage.getCaseLitigationHoldStatus(recording.caseId);
    const auditUserId =
      holdStatus?.litigationHoldAppliedBy ||
      caseRecord?.createdBy ||
      process.env.ADMIN_USER_ID ||
      "system";

    try {
      await deleteCaseAudioRecording({
        caseId: recording.caseId,
        audioRecordingId: recording.id,
        filePath: recording.filePath,
        trigger,
        userId: auditUserId,
        expiresAt: recording.expiresAt,
      });
    } catch (deleteError) {
      if (deleteError instanceof LitigationHoldDeletionBlockedError) {
        return { outcome: "skipped_hold" };
      }
      throw deleteError;
    }

    const deletionTimestamp = new Date();
    await storage.updateAudioRecording(recording.id, { deletedAt: deletionTimestamp });

    await logAuditEvent("system", "audio_deleted", {
      caseId: recording.caseId,
      audioRecordingId: recording.id,
      ipAddress: "server-process",
      metadata: {
        reason: auditReason,
        trigger,
        filePath: recording.filePath,
        expiresAt: recording.expiresAt.toISOString(),
        deletedAt: deletionTimestamp.toISOString(),
        storage: "backblaze_b2",
        consentSegmentPreserved: !!recording.consentSegmentPath,
      },
      severity: "warning",
    });

    await logAuditEvent("system", "audio_permanently_deleted", {
      caseId: recording.caseId,
      audioRecordingId: recording.id,
      ipAddress: "server-process",
      metadata: {
        matterReference: caseRecord?.matterReference || "N/A",
        deletionTimestamp: deletionTimestamp.toISOString(),
        audioDurationSeconds: recording.duration || null,
        gdprBasis: "retention_period_expired",
        retentionDays: AUDIO_RETENTION_DAYS,
        consentSegmentPreserved: !!recording.consentSegmentPath,
        trigger,
      },
      severity: "warning",
    });

    return { outcome: "deleted" };
  } catch (error) {
    return { outcome: "error", error };
  }
}
