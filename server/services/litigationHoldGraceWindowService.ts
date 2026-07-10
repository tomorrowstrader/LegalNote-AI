import type { Request } from "express";
import { logAuditEvent } from "../auditMiddleware";
import { storage } from "../storage";

export const GRACE_WINDOW_DAYS = 30;

export type GraceWindowSetResult = {
  graceUntil: Date;
  recordingCount: number;
};

/**
 * On hold release: set a 30-day app-level grace buffer on each non-deleted recording.
 * colpReviewStatus = 'awaiting_review' is the internal grace-window marker. There is
 * deliberately NO COLP review workflow (Option 2a); it simply marks audio as being in
 * the 30-day post-release grace buffer before auto-deletion. The colp* field names
 * are retained for forward-compatibility.
 */
export async function setCaseGraceWindowOnRelease(params: {
  caseId: string;
  userId: string;
  req?: Request;
  clientName?: string | null;
  caseTitle?: string | null;
}): Promise<GraceWindowSetResult> {
  const recordings = await storage.getAudioRecordingsByCaseId(params.caseId);
  const graceUntil = new Date(Date.now() + GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let recordingCount = 0;

  for (const recording of recordings) {
    if (recording.deletedAt) continue;
    await storage.updateAudioRecording(recording.id, {
      holdReleaseGraceUntil: graceUntil,
      colpReviewStatus: "awaiting_review",
    });
    recordingCount++;
  }

  await logAuditEvent(params.userId, "litigation_hold_grace_window_set", {
    caseId: params.caseId,
    metadata: {
      graceUntil: graceUntil.toISOString(),
      recordingCount,
      clientName: params.clientName ?? null,
      caseTitle: params.caseTitle ?? null,
    },
    severity: "info",
    req: params.req,
  });

  return { graceUntil, recordingCount };
}

/** On hold apply/re-apply: clear grace fields so no ticking grace window remains. */
export async function clearCaseGraceWindow(params: {
  caseId: string;
  userId: string;
  req?: Request;
}): Promise<{ recordingCount: number }> {
  const recordings = await storage.getAudioRecordingsByCaseId(params.caseId);
  let recordingCount = 0;

  for (const recording of recordings) {
    await storage.updateAudioRecording(recording.id, {
      holdReleaseGraceUntil: null,
      colpReviewStatus: null,
    });
    recordingCount++;
  }

  await logAuditEvent(params.userId, "litigation_hold_grace_window_cleared", {
    caseId: params.caseId,
    metadata: { recordingCount },
    severity: "info",
    req: params.req,
  });

  return { recordingCount };
}
