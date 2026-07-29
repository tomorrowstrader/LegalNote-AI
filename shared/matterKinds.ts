export const MATTER_KINDS = ["client", "internal", "firm"] as const;

export type MatterKind = (typeof MATTER_KINDS)[number];

export const MATTER_KIND_LABELS: Record<MatterKind, string> = {
  client: "Client matter",
  internal: "Internal meeting",
  firm: "Firm meeting",
};

/** Denormalised party label stored in cases.clientName when there is no client. */
export const MATTER_KIND_PARTY_LABELS: Record<MatterKind, string> = {
  client: "",
  internal: "Internal",
  firm: "Firm",
};

export function isMatterKind(value: unknown): value is MatterKind {
  return typeof value === "string" && (MATTER_KINDS as readonly string[]).includes(value);
}

export function normalizeMatterKind(value: unknown): MatterKind {
  return isMatterKind(value) ? value : "client";
}

export function isClientMatterKind(kind: string | null | undefined): boolean {
  return normalizeMatterKind(kind) === "client";
}

export function requiresClientForMatter(kind: string | null | undefined): boolean {
  return isClientMatterKind(kind);
}

export function partyLabelForMatterKind(kind: string | null | undefined): string {
  const normalized = normalizeMatterKind(kind);
  return MATTER_KIND_PARTY_LABELS[normalized] || "Internal";
}
