/** Document types that require fee-earner adoption before the matter is considered reviewed. */
export const ADOPTION_REQUIRED_TYPES = new Set([
  "attendance_note",
  "meeting_notes",
  "summary",
  "client_letter",
  "client_care_letter",
]);

export function isAdoptionRequiredType(type: string): boolean {
  return ADOPTION_REQUIRED_TYPES.has(type);
}

/** True when every active adoption-gated document is approved (or none exist yet). */
export function allAdoptionDocsApproved(
  documents: Array<{ type: string; status: string; isActive?: boolean | null }>,
): boolean {
  const gated = documents.filter(
    (d) => d.isActive !== false && ADOPTION_REQUIRED_TYPES.has(d.type),
  );
  if (gated.length === 0) return false;
  return gated.every((d) => d.status === "approved");
}
