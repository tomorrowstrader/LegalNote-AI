/**
 * Which document the page shows for a session. A session only ever shows its own documents,
 * so a solicitor can never read or adopt one session's note under another session's label.
 */

/** Documents that belong to the matter as a whole rather than to one meeting. */
export const MATTER_LEVEL_DOCUMENT_TYPES = new Set<string>(["client_care_letter"]);

interface DocLike {
  type: string;
  meetingSessionId?: string | null;
}

export function documentForSession<T extends DocLike>(
  documents: readonly T[],
  type: string,
  options: { focusSessionId?: string | null; sessionCount: number },
): T | undefined {
  const ofType = documents.filter((d) => d.type === type);
  if (!options.focusSessionId) return ofType[0];

  const own = ofType.find((d) => d.meetingSessionId === options.focusSessionId);
  if (own) return own;

  // A matter-level document (or one from before sessions were tracked on a matter with a
  // single session) has no session of its own, so it cannot belong to a different one.
  const unattached = ofType.find((d) => !d.meetingSessionId);
  if (unattached && (MATTER_LEVEL_DOCUMENT_TYPES.has(type) || options.sessionCount <= 1)) return unattached;

  return undefined;
}

/** True when a document is tied to a session other than the one on screen. */
export function documentBelongsToOtherSession(
  document: DocLike | undefined,
  focusSessionId: string | null | undefined,
): boolean {
  return !!document?.meetingSessionId && !!focusSessionId && document.meetingSessionId !== focusSessionId;
}

export interface SessionLabelInput {
  id: string;
  startedAt?: string | Date | null;
  recordingType?: string | null;
  sessionTitle?: string | null;
}

/** "Session 3 of 4 · Full meeting · 10 Nov, 15:12", numbered by meeting date. */
export function sessionIdentityLabel(
  sessionId: string | null | undefined,
  sessions: readonly SessionLabelInput[],
  typeLabels: Record<string, string>,
): string | null {
  if (!sessionId) return null;
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime(),
  );
  const index = ordered.findIndex((s) => s.id === sessionId);
  if (index < 0) return null;
  const session = ordered[index];
  const kind = session.sessionTitle || (session.recordingType ? typeLabels[session.recordingType] ?? session.recordingType : null);
  const when = session.startedAt
    ? new Date(session.startedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      })
    : null;
  return [`Session ${index + 1} of ${ordered.length}`, kind, when].filter(Boolean).join(" · ");
}
