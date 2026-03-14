import { db } from "./db";
import { cases, meetingSessions, transcripts, documents, audioRecordings } from "@shared/schema";
import { eq, isNull, sql, and, not, inArray } from "drizzle-orm";

export async function backfillSessions(): Promise<void> {
  try {
    const casesWithSessions = await db
      .select({ caseId: meetingSessions.caseId })
      .from(meetingSessions);
    const caseIdsWithSessions = new Set(casesWithSessions.map(r => r.caseId));

    const allCases = await db
      .select({ id: cases.id, sourceType: cases.sourceType, createdBy: cases.createdBy })
      .from(cases);

    const casesNeedingSessions = allCases.filter(c => !caseIdsWithSessions.has(c.id));

    if (casesNeedingSessions.length === 0) {
      console.log("[SESSION_MIGRATION] No cases without sessions, skipping");
      return;
    }

    console.log(`[SESSION_MIGRATION] Found ${casesNeedingSessions.length} cases without sessions, backfilling...`);

    let created = 0;
    let transcriptsLinked = 0;
    let documentsLinked = 0;

    for (const c of casesNeedingSessions) {
      const recordingType = c.sourceType === "text" ? "file_note" : "full_meeting";

      const [newSession] = await db
        .insert(meetingSessions)
        .values({
          caseId: c.id,
          recordingType,
          status: "completed",
          createdBy: c.createdBy,
        })
        .returning({ id: meetingSessions.id });

      const unlinkedTranscripts = await db
        .select({ id: transcripts.id })
        .from(transcripts)
        .where(and(eq(transcripts.caseId, c.id), isNull(transcripts.meetingSessionId)));

      if (unlinkedTranscripts.length > 0) {
        await db
          .update(transcripts)
          .set({ meetingSessionId: newSession.id })
          .where(and(eq(transcripts.caseId, c.id), isNull(transcripts.meetingSessionId)));
        transcriptsLinked += unlinkedTranscripts.length;
      }

      const unlinkedDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.caseId, c.id), isNull(documents.meetingSessionId)));

      if (unlinkedDocs.length > 0) {
        await db
          .update(documents)
          .set({ meetingSessionId: newSession.id })
          .where(and(eq(documents.caseId, c.id), isNull(documents.meetingSessionId)));
        documentsLinked += unlinkedDocs.length;
      }

      const unlinkedAudio = await db
        .select({ id: audioRecordings.id })
        .from(audioRecordings)
        .where(and(eq(audioRecordings.caseId, c.id), isNull(audioRecordings.meetingSessionId)));

      if (unlinkedAudio.length > 0) {
        await db
          .update(audioRecordings)
          .set({ meetingSessionId: newSession.id })
          .where(and(eq(audioRecordings.caseId, c.id), isNull(audioRecordings.meetingSessionId)));
      }

      created++;
    }

    console.log(`[SESSION_MIGRATION] Complete: created ${created} sessions, linked ${transcriptsLinked} transcripts, ${documentsLinked} documents`);
  } catch (error) {
    console.error("[SESSION_MIGRATION] Error during migration:", error);
  }
}
