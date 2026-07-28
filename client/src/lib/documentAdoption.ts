/** Document types that require fee-earner adoption before print/download/share. */
const ADOPTION_REQUIRED_TYPES = new Set([
  "attendance_note",
  "meeting_notes",
  "summary",
  "client_letter",
  "client_care_letter",
]);

const TYPE_ALIASES: Record<string, readonly string[]> = {
  attendance_note: ["attendance_note", "meeting_notes"],
  meeting_notes: ["attendance_note", "meeting_notes"],
  summary: ["summary", "client_letter"],
  client_letter: ["summary", "client_letter"],
  client_care_letter: ["client_care_letter"],
};

export function getDocumentTypeLabel(type: string): string {
  switch (type) {
    case "attendance_note":
      return "Attendance Note";
    case "meeting_notes":
      return "Meeting Notes";
    case "summary":
    case "client_letter":
      return "Client Letter";
    case "client_care_letter":
      return "Client Care Letter";
    case "transcript":
      return "Full Transcript";
    default:
      return type;
  }
}

/**
 * Returns selected document types that still require adoption before export/print.
 * Transcript is not adoption-gated (no "I Adopt" flow).
 */
export function getUnadoptedDocumentTypes(
  selectedTypes: readonly string[],
  documents: Array<{ type: string; status: string; isActive?: boolean | null }>,
): string[] {
  const active = documents.filter((d) => d.isActive !== false);
  return selectedTypes.filter((type) => {
    if (!ADOPTION_REQUIRED_TYPES.has(type)) return false;
    const aliases = TYPE_ALIASES[type] ?? [type];
    const doc = active.find((d) => aliases.includes(d.type));
    return !doc || doc.status !== "approved";
  });
}

/** True when any active adoption-gated document is not yet approved. */
export function hasDocumentsAwaitingAdoption(
  documents: Array<{ type: string; status: string; isActive?: boolean | null }>,
): boolean {
  return documents.some(
    (d) =>
      d.isActive !== false &&
      ADOPTION_REQUIRED_TYPES.has(d.type) &&
      d.status !== "approved",
  );
}

export function adoptionRequiredMessage(
  unadoptedTypes: readonly string[],
  action: "print" | "download",
): string {
  const labels = [...new Set(unadoptedTypes.map(getDocumentTypeLabel))];
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  const verb = action === "print" ? "printed" : "downloaded";
  return `${list} must be reviewed and adopted by a fee earner before it can be ${verb}.`;
}
