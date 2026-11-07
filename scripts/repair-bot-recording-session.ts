/**
 * Repair one meeting-bot recording that was filed under an earlier session.
 * Creates the recording's own session and moves only that recording's audio,
 * transcript and documents onto it. The earlier session keeps its own records.
 * Nothing is regenerated and no text is changed. Prints ids and dates only.
 *
 * Dry run (default, writes nothing):
 *   npx tsx scripts/repair-bot-recording-session.ts <meetingImportId>
 * Apply:
 *   npx tsx scripts/repair-bot-recording-session.ts <meetingImportId> --apply
 * Optional, when the stored data lacks them: --start=<ISO time> --duration=<seconds>
 * Optional, when the script cannot tell which one: --audio=<id or prefix> --transcript=<id or prefix>
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { audioRecordings, documents, meetingImports, meetingSessions, scheduledMeetings, transcripts } from "../shared/schema";
import { defaultRecordingTypeForMatterKind } from "../shared/recordingTypes";

const sh = (v: string | null | undefined) => (v ? v.slice(0, 8) : "-");
const dt = (v: Date | null | undefined) => (v ? new Date(v).toISOString().slice(0, 16) : "-");

async function main() {
  const importId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const startFlag = flag("start");
  const durationFlag = flag("duration");
  const audioFlag = flag("audio");
  const transcriptFlag = flag("transcript");
  if (!importId) throw new Error("meetingImportId required");

  const { storage } = await import("../server/storage");
  const { resolveBotMeetingStart } = await import("../server/services/botRecordingSession");

  const [imp] = await db.select().from(meetingImports).where(eq(meetingImports.id, importId));
  if (!imp?.caseId || !imp.audioStoragePath) throw new Error("Import has no matter or stored recording");
  const caseId = imp.caseId;

  // A retried import can leave several audio rows for the same file. All of them
  // belong to this recording; --audio picks the one whose processing made the transcript.
  const fileAudio = await db
    .select()
    .from(audioRecordings)
    .where(and(eq(audioRecordings.caseId, caseId), eq(audioRecordings.filePath, imp.audioStoragePath)));
  if (!fileAudio.length) throw new Error("No audio record for this recording");
  const unlinkedAudio = fileAudio.filter((a) => !a.meetingSessionId);
  if (!unlinkedAudio.length) throw new Error(`Audio is already linked to session ${sh(fileAudio[0].meetingSessionId)}; nothing to repair`);
  let audio = unlinkedAudio[0];
  if (audioFlag) {
    const picked = unlinkedAudio.filter((a) => a.id.startsWith(audioFlag));
    if (picked.length !== 1) throw new Error("--audio does not match exactly one unlinked audio record for this recording");
    audio = picked[0];
  } else if (unlinkedAudio.length > 1) {
    throw new Error(`Several audio records for this recording (${unlinkedAudio.map((a) => sh(a.id)).join(", ")}); pass --audio=<id>`);
  }
  const duplicateAudio = unlinkedAudio.filter((a) => a.id !== audio.id);

  // The transcript made from this recording: the first one on the matter created
  // after the audio row, and before any later recording on the matter.
  const caseAudio = await db.select().from(audioRecordings).where(eq(audioRecordings.caseId, caseId));
  const nextAudioAt = caseAudio
    .map((a) => new Date(a.recordedAt).getTime())
    .filter((t) => t > new Date(audio.recordedAt).getTime())
    .sort((a, b) => a - b)[0] ?? Infinity;
  let caseTranscripts = (await db.select().from(transcripts).where(eq(transcripts.caseId, caseId)))
    .filter((t) => {
      const at = new Date(t.createdAt).getTime();
      return at >= new Date(audio.recordedAt).getTime() && at < nextAudioAt;
    });
  if (transcriptFlag) {
    // The named transcript must still fall inside this recording's window.
    caseTranscripts = caseTranscripts.filter((t) => t.id.startsWith(transcriptFlag));
  }
  if (caseTranscripts.length !== 1) {
    throw new Error(`Expected exactly one transcript for this recording, found ${caseTranscripts.length}; stopping`);
  }
  const transcript = caseTranscripts[0];
  const oldSessionId = transcript.meetingSessionId;

  const docs = await db.select().from(documents).where(eq(documents.transcriptSnapshotId, transcript.id));
  if (docs.some((d) => d.caseId !== caseId)) throw new Error("A document belongs to another matter; stopping");

  const caseData = await storage.getCase(caseId, imp.userId);
  if (!caseData) throw new Error("Matter not found");
  const [scheduled] = await db.select().from(scheduledMeetings).where(eq(scheduledMeetings.meetingImportId, imp.id));
  let startSource = "given";
  let meetingStart: Date;
  if (startFlag) {
    meetingStart = new Date(startFlag);
    if (Number.isNaN(meetingStart.getTime())) throw new Error("--start is not a valid time");
  } else if (imp.meetingStartTime) {
    meetingStart = new Date(imp.meetingStartTime);
    startSource = "recording start";
  } else if (scheduled?.startTime) {
    meetingStart = new Date(scheduled.startTime);
    startSource = "scheduled meeting";
  } else {
    meetingStart = await resolveBotMeetingStart(storage, imp);
    startSource = "bot sent (fallback)";
  }
  const durationSeconds = durationFlag ? Number(durationFlag) : imp.durationSeconds ?? audio.duration ?? null;
  if (durationSeconds != null && !(durationSeconds > 0)) throw new Error("--duration must be a positive number of seconds");

  console.log(`Matter ${sh(caseId)}, recording ${sh(imp.id)}`);
  console.log(`  scheduled meeting: ${scheduled ? `found, starts ${dt(scheduled.startTime)}, ends ${dt((scheduled as { endTime?: Date | null }).endTime ?? null)}` : "not found"}`);
  console.log(`  new session: starts ${dt(meetingStart)} (${startSource}), length ${durationSeconds ?? "unknown"}s, type ${defaultRecordingTypeForMatterKind(caseData.matterKind)}`);
  console.log(`  move audio ${sh(audio.id)}: no session -> new session`);
  for (const a of duplicateAudio) console.log(`  move duplicate audio ${sh(a.id)} (same file): no session -> new session`);
  console.log(`  move transcript ${sh(transcript.id)}: session ${sh(oldSessionId)} -> new session`);
  for (const d of docs) console.log(`  move document ${sh(d.id)} ${d.type} v${d.version} (${d.status}): session ${sh(d.meetingSessionId)} -> new session`);
  console.log(`  session ${sh(oldSessionId)} keeps everything else`);

  if (!apply) {
    console.log("Dry run: nothing written. Add --apply to make these changes.");
    await pool.end();
    return;
  }

  const sessionId = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(meetingSessions)
      .values({
        caseId,
        createdBy: imp.userId,
        recordingType: defaultRecordingTypeForMatterKind(caseData.matterKind),
        sessionTitle: imp.meetingTitle?.trim().slice(0, 200) || null,
        startedAt: meetingStart,
        durationSeconds,
        status: "completed",
      })
      .returning();
    await tx
      .update(audioRecordings)
      .set({ meetingSessionId: session.id })
      .where(inArray(audioRecordings.id, [audio.id, ...duplicateAudio.map((a) => a.id)]));
    await tx.update(transcripts).set({ meetingSessionId: session.id }).where(eq(transcripts.id, transcript.id));
    if (docs.length) {
      await tx.update(documents).set({ meetingSessionId: session.id }).where(inArray(documents.id, docs.map((d) => d.id)));
    }
    return session.id;
  });

  await storage.createAuditLog({
    eventType: "meeting_session_reattributed",
    userId: imp.userId,
    caseId,
    ipAddress: "server-process",
    metadata: {
      reason: "Meeting-bot recording was filed under an earlier session; moved to its own session",
      importId: imp.id,
      newSessionId: sessionId,
      previousSessionId: oldSessionId,
      audioRecordingId: audio.id,
      duplicateAudioRecordingIds: duplicateAudio.map((a) => a.id),
      transcriptId: transcript.id,
      documentIds: docs.map((d) => d.id),
    },
    severity: "info",
  });

  const { ensureDraftTimeEntryForSession } = await import("../server/services/timeEntryDraftService");
  const draft = await ensureDraftTimeEntryForSession({ caseId, userId: imp.userId, sessionId, durationSeconds });

  console.log(`Applied. New session ${sh(sessionId)}. Time draft ${draft ? `${draft.durationMinutes} min` : "not created (length unknown)"}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Repair failed");
  process.exit(1);
});
