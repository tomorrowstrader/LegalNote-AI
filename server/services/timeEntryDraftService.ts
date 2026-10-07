import { storage } from "../storage";
import type { TimeEntry } from "@shared/schema";

const SIX_MINUTE_UNIT = 6;

/**
 * Create a draft time entry from a completed session when none exists yet.
 * Idempotent per meetingSessionId.
 */
export async function ensureDraftTimeEntryForSession(params: {
  caseId: string;
  userId: string;
  sessionId: string;
  durationSeconds?: number | null;
  description?: string;
}): Promise<TimeEntry | null> {
  const { caseId, userId, sessionId, durationSeconds, description } = params;

  const existing = await storage.getTimeEntriesByCase(caseId);
  const alreadyLinked = existing.some((e) => e.meetingSessionId === sessionId);
  if (alreadyLinked) {
    return existing.find((e) => e.meetingSessionId === sessionId) ?? null;
  }

  const session = await storage.getMeetingSession(sessionId);
  if (!session || session.caseId !== caseId) {
    return null;
  }

  const seconds = durationSeconds ?? session.durationSeconds ?? 0;
  const durationMinutes = Math.max(1, Math.ceil(seconds / 60));

  const user = await storage.getUser(userId);
  const hourlyRate = user?.hourlyRate ?? "0.00";

  const sessionTitle = session.title?.trim();
  const entryDescription =
    description?.trim() ||
    (sessionTitle ? `Meeting: ${sessionTitle}` : "Meeting time (auto-drafted from session)");

  const entry = await storage.createTimeEntry({
    caseId,
    userId,
    meetingSessionId: sessionId,
    durationMinutes,
    description: entryDescription,
    hourlyRate,
    status: "draft",
  });

  await storage.createAuditLog({
    eventType: "time_entry_created",
    userId,
    caseId,
    ipAddress: "server-process",
    metadata: {
      timeEntryId: entry.id,
      meetingSessionId: sessionId,
      durationMinutes: entry.durationMinutes,
      units: Math.ceil(entry.durationMinutes / SIX_MINUTE_UNIT),
      sourceDurationSeconds: seconds,
      action: "auto_draft",
      status: "draft",
    },
    severity: "info",
  });

  return entry;
}
