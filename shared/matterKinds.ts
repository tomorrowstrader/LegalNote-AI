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

/** Client-facing GDPR consent script — client matters only. */
export function requiresClientConsent(kind: string | null | undefined): boolean {
  return isClientMatterKind(kind);
}

/**
 * Participant recording notice for non-client meetings with people outside the firm
 * (e.g. chambers, vendors, BD). Firm-only internal meetings skip this.
 */
export function requiresParticipantConsent(
  kind: string | null | undefined,
  hasExternalAttendees: boolean | null | undefined,
): boolean {
  return !isClientMatterKind(kind) && !!hasExternalAttendees;
}

/** Sealed consent must be recorded before processing audio. */
export function requiresSealedConsentForProcessing(
  kind: string | null | undefined,
  hasExternalAttendees: boolean | null | undefined,
): boolean {
  return (
    requiresClientConsent(kind) || requiresParticipantConsent(kind, hasExternalAttendees)
  );
}

export function partyLabelForMatterKind(kind: string | null | undefined): string {
  const normalized = normalizeMatterKind(kind);
  return MATTER_KIND_PARTY_LABELS[normalized] || "Non-client";
}
