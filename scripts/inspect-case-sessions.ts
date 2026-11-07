/**
 * Read-only: shows how one matter's records are split across sessions.
 * Prints ids, types, versions, dates and links only, never content.
 * Usage: npx tsx scripts/inspect-case-sessions.ts <caseId>
 */
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { audioRecordings, documents, meetingImports, meetingSessions, scheduledMeetings, timeEntries, transcripts, undertakings } from "../shared/schema";

async function main() {
  const caseId = process.argv[2];
  if (!caseId) throw new Error("caseId required");
  const sh = (v: string | null | undefined) => (v ? v.slice(0, 8) : "-");
  const dt = (v: Date | null | undefined) => (v ? new Date(v).toISOString().slice(0, 16) : "-");

  for (const s of await db.select().from(meetingSessions).where(eq(meetingSessions.caseId, caseId)))
    console.log(`session ${sh(s.id)} started ${dt(s.startedAt)} type ${s.recordingType} title ${s.sessionTitle ? "set" : "-"} dur ${s.durationSeconds ?? "-"} status ${s.status} cast ${s.meetingCast ? "set" : "-"} instr ${s.instructionsTaken ?? "-"}`);
  for (const a of await db.select().from(audioRecordings).where(eq(audioRecordings.caseId, caseId)))
    console.log(`audio ${sh(a.id)} session ${sh(a.meetingSessionId)} recorded ${dt(a.recordedAt)} dur ${a.duration ?? "-"} deleted ${a.deletedAt ? "yes" : "no"} path ${a.filePath?.startsWith(".private/imports/") ? "bot-import" : "app"}`);
  for (const t of await db.select().from(transcripts).where(eq(transcripts.caseId, caseId)))
    console.log(`transcript ${sh(t.id)} session ${sh(t.meetingSessionId)} created ${dt(t.createdAt)}`);
  const docs = await db.select().from(documents).where(eq(documents.caseId, caseId));
  for (const d of docs.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)))
    console.log(`doc ${sh(d.id)} ${d.type} v${d.version} session ${sh(d.meetingSessionId)} transcript ${sh(d.transcriptSnapshotId)} parent ${sh(d.parentVersionId)} active ${d.isActive} status ${d.status} created ${dt(d.createdAt)} approved ${dt(d.approvedAt)}`);
  for (const e of await db.select().from(timeEntries).where(eq(timeEntries.caseId, caseId)))
    console.log(`time ${sh(e.id)} session ${sh(e.meetingSessionId)} mins ${e.durationMinutes} status ${e.status}`);
  for (const u of await db.select().from(undertakings).where(eq(undertakings.caseId, caseId)))
    console.log(`undertaking ${sh(u.id)} session ${sh(u.meetingSessionId)}`);
  for (const i of await db.select().from(meetingImports).where(eq(meetingImports.caseId, caseId)))
    console.log(`bot-import ${sh(i.id)} bot ${sh(i.recallBotId)} status ${i.status} consentMode ${i.consentMode} sent ${dt(i.createdAt)} start ${dt(i.meetingStartTime)} end ${dt(i.meetingEndTime)} dur ${i.durationSeconds ?? "-"} imported ${dt(i.importedAt)}`);
  for (const m of await db.select().from(scheduledMeetings).where(eq(scheduledMeetings.caseId, caseId)))
    console.log(`scheduled ${sh(m.id)} start ${dt(m.startTime)} end ${dt(m.endTime)} bot ${sh(m.recallBotId)} import ${sh(m.meetingImportId)} botStatus ${m.botStatus ?? "-"}`);
  await pool.end();
}
main().catch((err) => { console.error(err instanceof Error ? err.message : "Inspect failed"); process.exit(1); });
