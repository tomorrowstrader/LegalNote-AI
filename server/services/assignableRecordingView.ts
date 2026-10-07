import type { MeetingImport } from "@shared/schema";
import {
  participantCountFrom,
  participantNamesFrom,
  suggestMatter,
  type AssignableRecording,
  type MatterSuggestionSource,
} from "@shared/assignableRecording";
import { storage } from "../storage";

const SUGGESTION_LOOKBACK_MS = 21 * 24 * 60 * 60 * 1000;

export async function toAssignableRecordings(
  userId: string,
  imports: MeetingImport[],
): Promise<AssignableRecording[]> {
  if (imports.length === 0) return [];

  const meetings = await storage.getScheduledMeetingsByUser(userId);
  const cutoff = Date.now() - SUGGESTION_LOOKBACK_MS;
  const relevant = meetings.filter((meeting) => {
    if (!meeting.caseId) return false;
    const start = new Date(meeting.startTime).getTime();
    if (Number.isFinite(start) && start >= cutoff) return true;
    return imports.some(
      (imp) =>
        (!!imp.recallBotId && meeting.recallBotId === imp.recallBotId) ||
        meeting.meetingImportId === imp.id,
    );
  });

  const caseIds = Array.from(new Set(relevant.map((meeting) => meeting.caseId).filter((id): id is string => !!id)));
  const caseById = new Map<string, { title: string; clientName: string | null }>();
  await Promise.all(
    caseIds.map(async (caseId) => {
      const matter = await storage.getCase(caseId, userId);
      if (matter?.title) {
        caseById.set(caseId, { title: matter.title, clientName: matter.clientName || null });
      }
    }),
  );

  const sources: MatterSuggestionSource[] = relevant.map((meeting) => ({
    caseId: meeting.caseId,
    recallBotId: meeting.recallBotId,
    meetingImportId: meeting.meetingImportId,
    meetingUrl: meeting.meetingUrl,
    startTime: meeting.startTime,
    title: meeting.title,
  }));

  return imports.map((imp) => ({
    id: imp.id,
    meetingTitle: imp.meetingTitle,
    meetingPlatform: imp.meetingPlatform,
    meetingUrl: imp.meetingUrl,
    meetingStartTime: imp.meetingStartTime ? new Date(imp.meetingStartTime).toISOString() : null,
    createdAt: new Date(imp.createdAt).toISOString(),
    durationSeconds: imp.durationSeconds ?? null,
    participantNames: participantNamesFrom(imp.participants),
    participantCount: participantCountFrom(imp.participants),
    hasAudio: !!imp.audioStoragePath,
    suggestedMatter: suggestMatter(
      {
        id: imp.id,
        recallBotId: imp.recallBotId,
        meetingUrl: imp.meetingUrl,
        meetingStartTime: imp.meetingStartTime,
        createdAt: imp.createdAt,
      },
      sources,
      caseById,
    ),
    status: imp.status,
  }));
}
