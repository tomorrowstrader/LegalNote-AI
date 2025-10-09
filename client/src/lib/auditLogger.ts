import { apiRequest } from "./queryClient";

interface AuditLogParams {
  eventType: string;
  caseId?: string;
  documentId?: string;
  transcriptId?: string;
  audioRecordingId?: string;
  metadata?: Record<string, any>;
  severity?: "info" | "warning" | "critical";
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await apiRequest("POST", "/api/audit/log", {
      eventType: params.eventType,
      caseId: params.caseId,
      documentId: params.documentId,
      transcriptId: params.transcriptId,
      audioRecordingId: params.audioRecordingId,
      metadata: params.metadata || {},
      severity: params.severity || "info",
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
