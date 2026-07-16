import type { Request } from "express";
import { isLegalNotePersonnel } from "./accessAllowlist";
import { logAuditEvent } from "./auditMiddleware";

export type PersonnelAccessResource =
  | "case"
  | "transcript"
  | "document"
  | "audio"
  | "consent"
  | "export";

/**
 * DPA 4.3 / Annex 3: every LegalNote personnel access to Firm Data content
 * is recorded in the matter audit trail and visible to the Firm.
 * No-op for firm users and firm-admins.
 */
export async function logPersonnelMatterAccess(params: {
  userId: string;
  caseId: string;
  resource: PersonnelAccessResource;
  req?: Request;
  documentId?: string;
  transcriptId?: string;
  audioRecordingId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isLegalNotePersonnel(params.userId)) return;

  await logAuditEvent(params.userId, "personnel_matter_accessed", {
    caseId: params.caseId,
    documentId: params.documentId,
    transcriptId: params.transcriptId,
    audioRecordingId: params.audioRecordingId,
    severity: "warning",
    req: params.req,
    metadata: {
      actorType: "legalnote_personnel",
      resource: params.resource,
      ...(params.reason ? { reason: params.reason } : {}),
      ...(params.metadata || {}),
    },
  });
}
