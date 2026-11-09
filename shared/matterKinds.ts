export const MATTER_KINDS = ["client", "internal"] as const;

export type MatterKind = (typeof MATTER_KINDS)[number];

/** Legacy value stored before firm was collapsed into internal. */
const LEGACY_FIRM_KIND = "firm";

export const MATTER_KIND_LABELS: Record<MatterKind, string> = {
  client: "Client matter",
  internal: "Non-client meeting",
};

/** Denormalised party label stored in cases.clientName when there is no client. */
export const MATTER_KIND_PARTY_LABELS: Record<MatterKind, string> = {
  client: "",
  internal: "Non-client",
};

export function isMatterKind(value: unknown): value is MatterKind {
  return typeof value === "string" && (MATTER_KINDS as readonly string[]).includes(value);
}

/** Normalise stored/API values. Legacy `firm` collapses to `internal`. */
export function normalizeMatterKind(value: unknown): MatterKind {
  if (value === LEGACY_FIRM_KIND || value === "internal") return "internal";
  if (value === "client") return "client";
  return isMatterKind(value) ? value : "client";
}

export function isClientMatterKind(kind: string | null | undefined): boolean {
  return normalizeMatterKind(kind) === "client";
}

export function requiresClientForMatter(kind: string | null | undefined): boolean {
  return isClientMatterKind(kind);
}

/**
 * A conversation on a client matter that the client is not part of, such as a
 * case discussion with colleagues, counsel or a witness. The client consent
 * script would be wrong here, so the participant notice is used instead.
 */
function isClientAbsentSession(
  kind: string | null | undefined,
  recordingType: string | null | undefined,
): boolean {
  return isClientMatterKind(kind) && recordingType === "internal_meeting";
}

/** Client-facing GDPR consent script - client matters only, when the client takes part. */
export function requiresClientConsent(
  kind: string | null | undefined,
  recordingType?: string | null,
): boolean {
  return isClientMatterKind(kind) && !isClientAbsentSession(kind, recordingType);
}

/**
 * Participant recording notice for non-client meetings with people outside the firm
 * (e.g. chambers, vendors, BD). Firm-only internal meetings skip this.
 */
export function requiresParticipantConsent(
  kind: string | null | undefined,
  hasExternalAttendees: boolean | null | undefined,
  recordingType?: string | null,
): boolean {
  if (isClientAbsentSession(kind, recordingType)) return true;
  return !isClientMatterKind(kind) && !!hasExternalAttendees;
}

/** Sealed consent must be recorded before processing audio. */
export function requiresSealedConsentForProcessing(
  kind: string | null | undefined,
  hasExternalAttendees: boolean | null | undefined,
  recordingType?: string | null,
): boolean {
  // Every client matter still needs sealed consent; only the script changes.
  return (
    requiresClientConsent(kind, recordingType) ||
    requiresParticipantConsent(kind, hasExternalAttendees, recordingType)
  );
}

export function partyLabelForMatterKind(kind: string | null | undefined): string {
  const normalized = normalizeMatterKind(kind);
  return MATTER_KIND_PARTY_LABELS[normalized] || "Non-client";
}

/** Written when a matter is opened from a call before a conflict check is confirmed. */
export const CAPTURE_CONFLICT_DEFERRAL_NOTE =
  "Deferred at capture - complete before the note is approved";
