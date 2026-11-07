/**
 * Read-only: lists meeting-bot recordings that were filed without their own
 * session, so their transcript and documents sit under an earlier session.
 * Prints ids, dates and counts only, never transcript or note content.
 * Nothing is changed. The repair is a separate, approved step.
 *
 * Usage: npx tsx scripts/report-bot-recordings-without-session.ts
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { db, pool } from "../server/db";
import { audioRecordings, documents, meetingImports, meetingSessions, transcripts } from "../shared/schema";

async function main() {
  const imports = await db
    .select({
      importId: meetingImports.id,
      caseId: meetingImports.caseId,
      createdAt: meetingImports.createdAt,
      meetingStartTime: meetingImports.meetingStartTime,
      audioStoragePath: meetingImports.audioStoragePath,
      status: meetingImports.status,
    })
    .from(meetingImports)
    .where(and(isNotNull(meetingImports.caseId), isNotNull(meetingImports.audioStoragePath)));

  let affected = 0;
  for (const imp of imports) {
    const [audio] = await db
      .select({ id: audioRecordings.id, meetingSessionId: audioRecordings.meetingSessionId, recordedAt: audioRecordings.recordedAt })
      .from(audioRecordings)
      .where(and(eq(audioRecordings.caseId, imp.caseId!), eq(audioRecordings.filePath, imp.audioStoragePath!)));
    if (!audio || audio.meetingSessionId) continue;
    affected += 1;

    const sessions = await db
      .select({ id: meetingSessions.id, startedAt: meetingSessions.startedAt })
      .from(meetingSessions)
      .where(eq(meetingSessions.caseId, imp.caseId!));

    // Transcripts created for this recording: on the same matter, after the audio row.
    const caseTranscripts = await db
      .select({ id: transcripts.id, createdAt: transcripts.createdAt, meetingSessionId: transcripts.meetingSessionId })
      .from(transcripts)
      .where(eq(transcripts.caseId, imp.caseId!));
    const candidates = caseTranscripts.filter((t) => t.createdAt >= audio.recordedAt);

    const docs = [];
    for (const t of candidates) {
      const rows = await db
        .select({ id: documents.id, type: documents.type, version: documents.version, meetingSessionId: documents.meetingSessionId })
        .from(documents)
        .where(eq(documents.transcriptSnapshotId, t.id));
      docs.push(...rows.map((d) => ({ ...d, transcriptId: t.id })));
    }

    console.log(
      JSON.stringify({
        importId: imp.importId,
        caseId: imp.caseId,
        importStatus: imp.status,
        botSentAt: imp.createdAt,
        meetingStart: imp.meetingStartTime,
        audioId: audio.id,
        audioRecordedAt: audio.recordedAt,
        sessionsOnMatter: sessions.map((s) => ({ id: s.id, startedAt: s.startedAt })),
        transcriptsFiledUnder: candidates.map((t) => ({ id: t.id, createdAt: t.createdAt, sessionId: t.meetingSessionId })),
        documentsFiledUnder: docs,
      }),
    );
  }
  console.log(`${affected} bot recording(s) have no session of their own.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Report failed");
  process.exit(1);
});
