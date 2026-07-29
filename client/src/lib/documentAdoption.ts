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

export type AdoptionTab = "attendance" | "summary" | "care_letter";

const ADOPTION_TAB_ORDER: AdoptionTab[] = ["attendance", "summary", "care_letter"];

export function documentTypeToAdoptionTab(type: string): AdoptionTab | null {
  if (type === "attendance_note" || type === "meeting_notes") return "attendance";
  if (type === "summary" || type === "client_letter") return "summary";
  if (type === "client_care_letter") return "care_letter";
  return null;
}

/** Next adoptable tab after approving `justApprovedId`, in solicitor review order. */
export function getNextAdoptionTab(
  docs: Array<{ id: string; type: string; status: string } | null | undefined>,
  justApprovedId: string,
): AdoptionTab | null {
  const byTab = new Map<AdoptionTab, { id: string; status: string }>();
  for (const doc of docs) {
    if (!doc) continue;
    const tab = documentTypeToAdoptionTab(doc.type);
    if (!tab || byTab.has(tab)) continue;
    byTab.set(tab, { id: doc.id, status: doc.status });
  }
  for (const tab of ADOPTION_TAB_ORDER) {
    const entry = byTab.get(tab);
    if (!entry) continue;
    if (entry.id === justApprovedId) continue;
    if (entry.status !== "approved") return tab;
  }
  return null;
}

/**
 * First unadopted tab in review order, optionally skipping the tab already open
 * (so Ctrl+. advances when you're already on a pending doc).
 */
export function getFirstPendingAdoptionTab(
  pending: Array<{ tab: AdoptionTab }>,
  currentTab?: string,
): AdoptionTab | null {
  if (pending.length === 0) return null;
  const ordered = ADOPTION_TAB_ORDER.filter((tab) =>
    pending.some((p) => p.tab === tab),
  );
  if (ordered.length === 0) return null;
  if (!currentTab) return ordered[0];
  const idx = ordered.indexOf(currentTab as AdoptionTab);
  if (idx < 0) return ordered[0];
  return ordered[(idx + 1) % ordered.length] ?? ordered[0];
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
