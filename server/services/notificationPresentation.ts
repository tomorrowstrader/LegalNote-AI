/**
 * Presentation helpers for in-app notifications (virtualized from audit trail).
 */

type CaseLike = {
  title?: string | null;
  clientName?: string | null;
  matterReference?: string | null;
} | null | undefined;

type AuditLike = {
  eventType: string;
  caseId?: string | null;
  documentId?: string | null;
  transcriptId?: string | null;
  metadata?: unknown;
};

function matterLabel(caseRecord: CaseLike): string {
  const title = caseRecord?.title?.trim();
  if (title) return title;
  const client = caseRecord?.clientName?.trim();
  if (client) return `${client} matter`;
  const ref = caseRecord?.matterReference?.trim();
  if (ref) return ref;
  return "your matter";
}

function metaOf(event: AuditLike): Record<string, unknown> {
  return (event.metadata && typeof event.metadata === "object"
    ? (event.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
}

export function resolveDocumentType(event: AuditLike): string | undefined {
  const meta = metaOf(event);
  const raw =
    (typeof meta.documentType === "string" && meta.documentType) ||
    (typeof meta.action === "string" && meta.action) ||
    undefined;

  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (
    normalized.includes("client_care") ||
    normalized.includes("care_letter") ||
    normalized === "auto_generate_client_care_letter"
  ) {
    return "client_care_letter";
  }
  if (normalized.includes("attendance") || normalized === "meeting_notes") {
    return "attendance_note";
  }
  if (normalized.includes("client_letter")) return "client_letter";
  if (normalized === "summary") return "summary";
  return raw;
}

function documentLabel(documentType?: string): string {
  switch (documentType) {
    case "attendance_note":
    case "meeting_notes":
      return "Attendance note";
    case "client_letter":
    case "summary":
      return "Client letter";
    case "client_care_letter":
      return "Client care letter";
    default:
      return "Document";
  }
}

function documentTab(documentType?: string): "attendance" | "summary" | "transcript" | "care_letter" | undefined {
  switch (documentType) {
    case "attendance_note":
    case "meeting_notes":
      return "attendance";
    case "client_letter":
    case "summary":
      return "summary";
    case "client_care_letter":
      return "care_letter";
    default:
      return undefined;
  }
}

export function buildNotificationHref(event: AuditLike): string | undefined {
  if (!event.caseId) {
    const meta = metaOf(event);
    if (event.eventType === "meeting_reminder" && typeof meta.meetingUrl === "string") {
      return meta.meetingUrl;
    }
    return undefined;
  }

  const base = `/case/${event.caseId}`;
  const documentType = resolveDocumentType(event);

  switch (event.eventType) {
    case "transcript_generated":
    case "transcription_completed":
      return `${base}?tab=transcript`;
    case "document_generated":
    case "document_regenerated": {
      const tab = documentTab(documentType);
      return tab ? `${base}?tab=${tab}` : base;
    }
    case "case_email_sent":
      return `${base}?tab=attendance`;
    case "consent_given":
    case "pre_consent_acknowledged":
    case "pre_consent_declined":
    case "pre_consent_reschedule_requested":
      return `${base}?tab=compliance`;
    case "meeting_reminder":
      return `${base}?section=briefing`;
    case "case_handover_received":
    case "audio_expiring_soon":
    case "deadline_approaching":
    default:
      return base;
  }
}

export function buildNotificationCopy(
  event: AuditLike,
  caseRecord: CaseLike,
): { title: string; message: string } {
  const matter = matterLabel(caseRecord);
  const meta = metaOf(event);
  const documentType = resolveDocumentType(event);
  const docLabel = documentLabel(documentType);

  switch (event.eventType) {
    case "transcript_generated":
    case "transcription_completed":
      return {
        title: "Transcript ready",
        message: `Transcript for “${matter}” is ready to review.`,
      };
    case "document_generated":
      return {
        title: `${docLabel} ready to adopt`,
        message: `${docLabel} for “${matter}” is ready to adopt.`,
      };
    case "document_regenerated":
      return {
        title: `Further ${docLabel.toLowerCase()} produced`,
        message: `A further ${docLabel.toLowerCase()} has been produced for “${matter}”.`,
      };
    case "case_email_sent":
      return {
        title: "Documents emailed",
        message: `Documents for “${matter}” were sent to the client.`,
      };
    case "consent_given":
      return {
        title: "Consent confirmed",
        message: `Client consent was confirmed for “${matter}”.`,
      };
    case "pre_consent_acknowledged":
      return {
        title: "Pre-meeting consent granted",
        message: `${(meta.recipientName as string) || "Your client"} granted recording consent for “${matter}”.`,
      };
    case "pre_consent_declined":
      return {
        title: "Pre-meeting consent declined",
        message: `${(meta.recipientName as string) || "Your client"} declined recording consent for “${matter}”. No recording will be attempted.`,
      };
    case "pre_consent_reschedule_requested":
      return {
        title: "Reschedule requested",
        message: `${(meta.recipientName as string) || "Your client"} requested to reschedule “${matter}”${
          meta.clientMessage ? `: “${meta.clientMessage}”` : "."
        }`,
      };
    case "audio_expiring_soon":
      return {
        title: "Audio expiring soon",
        message: `Recording for “${matter}” will be deleted when its 7-day retention period ends.`,
      };
    case "deadline_approaching":
      return {
        title: "Deadline approaching",
        message: `A deadline for “${matter}” is approaching.`,
      };
    case "meeting_reminder": {
      const mins = meta.minutesBefore;
      const meetingTitle = (meta.meetingTitle as string) || "Your meeting";
      return {
        title: mins === 10 ? "Meeting in 10 minutes" : "Meeting in 30 minutes",
        message: `${meetingTitle} starts soon${caseRecord?.title ? ` · ${matter}` : ""}.`,
      };
    }
    case "case_handover_received":
      return {
        title: "Case handed over to you",
        message: `“${matter}” has been handed over to you.`,
      };
    default:
      return {
        title: event.eventType.replace(/_/g, " "),
        message: caseRecord?.title ? `Update on “${matter}”.` : "",
      };
  }
}
