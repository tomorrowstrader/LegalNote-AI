/** View of a video recording that still needs a matter, plus the fields needed to recognise it. */
export interface SuggestedMatter {
  caseId: string;
  title: string;
  clientName: string | null;
}

export interface AssignableRecording {
  id: string;
  meetingTitle: string | null;
  meetingPlatform: string | null;
  meetingUrl: string | null;
  meetingStartTime: string | null;
  createdAt: string;
  durationSeconds: number | null;
  participantNames: string[];
  participantCount: number;
  hasAudio: boolean;
  suggestedMatter: SuggestedMatter | null;
  status: string;
}

/** Reconnect attempts of the same call usually land within a few hours of the calendar event. */
export const ASSIGNMENT_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface MatterSuggestionSource {
  caseId: string | null;
  recallBotId: string | null;
  meetingImportId: string | null;
  meetingUrl: string | null;
  startTime: Date | string | null;
  title: string | null;
}

export interface ImportSuggestionInput {
  id: string;
  recallBotId: string | null;
  meetingUrl: string | null;
  meetingStartTime: Date | string | null;
  createdAt: Date | string;
}

/**
 * Compare meeting links without join tokens. Teams, Zoom, and Meet put the
 * meeting identity in the path and put a fresh token in the query string.
 */
export function normalizeMeetingUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

export function participantNamesFrom(participants: unknown): string[] {
  if (!Array.isArray(participants)) return [];
  const names: string[] = [];
  for (const entry of participants) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed) names.push(trimmed);
  }
  return names;
}

export function participantCountFrom(participants: unknown): number {
  if (!Array.isArray(participants)) return 0;
  return participants.filter((entry) => !!entry && typeof entry === "object").length;
}

export function suggestMatter(
  imp: ImportSuggestionInput,
  meetings: MatterSuggestionSource[],
  caseById: Map<string, { title: string; clientName: string | null }>,
): SuggestedMatter | null {
  const candidates = meetings.filter((meeting) => !!meeting.caseId && caseById.has(meeting.caseId));

  const byBot = imp.recallBotId
    ? candidates.find((meeting) => meeting.recallBotId && meeting.recallBotId === imp.recallBotId)
    : undefined;
  const byImport = candidates.find((meeting) => meeting.meetingImportId && meeting.meetingImportId === imp.id);

  const importUrl = normalizeMeetingUrl(imp.meetingUrl);
  const importTime = new Date(imp.meetingStartTime || imp.createdAt).getTime();
  let byUrl: MatterSuggestionSource | undefined;
  if (importUrl && Number.isFinite(importTime)) {
    let bestDelta = Infinity;
    for (const meeting of candidates) {
      if (normalizeMeetingUrl(meeting.meetingUrl) !== importUrl) continue;
      const start = meeting.startTime ? new Date(meeting.startTime).getTime() : NaN;
      if (!Number.isFinite(start)) continue;
      const delta = Math.abs(start - importTime);
      if (delta <= ASSIGNMENT_MATCH_WINDOW_MS && delta < bestDelta) {
        bestDelta = delta;
        byUrl = meeting;
      }
    }
  }

  const match = byBot || byImport || byUrl;
  if (!match?.caseId) return null;
  const matter = caseById.get(match.caseId);
  if (!matter) return null;
  return {
    caseId: match.caseId,
    title: matter.title,
    clientName: matter.clientName,
  };
}

export function recordingListenHints(input: {
  durationSeconds: number | null;
  participantCount: number;
}): string[] {
  const hints: string[] = [];
  if (input.durationSeconds != null && input.durationSeconds > 0 && input.durationSeconds < 90) {
    hints.push("Very short - often a failed join or an empty waiting room.");
  }
  if (input.participantCount > 0 && input.participantCount <= 1) {
    hints.push("Only one person was detected. Listen before assigning - the other side may never have joined.");
  }
  return hints;
}

export function sameCallCount(
  recording: { meetingUrl: string | null },
  all: Array<{ meetingUrl: string | null }>,
): number {
  const url = normalizeMeetingUrl(recording.meetingUrl);
  if (!url) return 1;
  return all.filter((other) => normalizeMeetingUrl(other.meetingUrl) === url).length;
}

export function formatRecordingClock(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return "Video call";
  if (platform === "zoom") return "Zoom";
  if (platform === "teams") return "Teams";
  if (platform === "meet") return "Google Meet";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function withoutEmDash(value: string): string {
  return value.replaceAll("\u2014", "-");
}

export function matterChoiceLabel(title: string, clientName: string | null | undefined): string {
  const cleanTitle = withoutEmDash(title);
  const client = clientName?.trim();
  if (!client || client === cleanTitle || client === "Non-client") return cleanTitle;
  return `${withoutEmDash(client)} - ${cleanTitle}`;
}
