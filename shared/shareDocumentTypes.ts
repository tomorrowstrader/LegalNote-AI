/** Shared document-type matching for secure share (client + server). */

export const CLIENT_LETTER_SHARE_TYPES = new Set(["summary", "client_letter"]);
export const ATTENDANCE_NOTE_SHARE_TYPES = new Set(["attendance_note", "meeting_notes"]);

export function documentMatchesSharedType(docType: string, sharedType: string): boolean {
  if (docType === sharedType) return true;
  if (CLIENT_LETTER_SHARE_TYPES.has(docType) && CLIENT_LETTER_SHARE_TYPES.has(sharedType)) {
    return true;
  }
  if (ATTENDANCE_NOTE_SHARE_TYPES.has(docType) && ATTENDANCE_NOTE_SHARE_TYPES.has(sharedType)) {
    return true;
  }
  return false;
}

export type ShareableDocument = {
  type: string;
  status: string;
  isActive?: boolean | null;
};

export function getUnadoptedSharedDocumentTypes(
  selectedTypes: readonly string[],
  documents: readonly ShareableDocument[],
): string[] {
  const activeDocuments = documents.filter((document) => document.isActive !== false);
  return selectedTypes.filter((type) => {
    const selectedDocument = activeDocuments.find((document) =>
      documentMatchesSharedType(document.type, type),
    );
    return !selectedDocument || selectedDocument.status !== "approved";
  });
}

export function shareDocumentTypeLabel(sharedType: string): string {
  switch (sharedType) {
    case "attendance_note":
    case "meeting_notes":
      return "Attendance Note";
    case "summary":
    case "client_letter":
      return "Client Letter";
    case "transcript":
      return "Transcript";
    case "client_care_letter":
      return "Client Care Letter";
    default:
      return sharedType;
  }
}
