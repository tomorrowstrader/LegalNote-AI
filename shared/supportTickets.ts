export const SUPPORT_TICKET_CATEGORIES = [
  { id: "record_meeting", label: "Record a meeting / session" },
  { id: "livebot", label: "Join with LegalNote (LiveBot)" },
  { id: "share", label: "Secure share with a client" },
  { id: "calendar", label: "Calendar sync" },
  { id: "documents", label: "Documents / attendance notes" },
  { id: "login", label: "Login or access" },
  { id: "other", label: "Something else" },
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number]["id"];

export const SUPPORT_TICKET_SEVERITIES = [
  { id: "blocked", label: "I can't work — blocked", description: "Urgent — I cannot continue my work" },
  { id: "annoying", label: "Something is wrong", description: "It's frustrating but I have a workaround" },
  { id: "question", label: "Question / how do I…", description: "Guidance only — not blocked" },
] as const;

export type SupportTicketSeverity = (typeof SUPPORT_TICKET_SEVERITIES)[number]["id"];

export const SUPPORT_TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export function supportCategoryLabel(id: string): string {
  return SUPPORT_TICKET_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function supportSeverityLabel(id: string): string {
  return SUPPORT_TICKET_SEVERITIES.find((s) => s.id === id)?.label ?? id;
}

export function supportStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}
