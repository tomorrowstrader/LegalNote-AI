/**
 * Test database only. Seeds the Reeve sample matter for a signed-in local user, then adds
 * two more sessions so the matter reproduces the "session 4" situation:
 *   session 1: Reeve conference (full meeting, documents)
 *   session 2: follow-up call a week later (full meeting, its own documents)
 *   session 3: internal meeting the same afternoon, recorded but NOT processed
 * Refuses to run unless the database carries the test-database marker.
 *
 *   npx tsx scripts/seed-session-trap.ts --email you@example.com
 */
import "../server/loadEnv";
import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { audioRecordings, cases, documents, meetingSessions, transcripts } from "@shared/schema";
import { liveDatabaseDecision, readDatabaseMarker } from "../server/liveDatabaseGuard";
import { seedReeveSampleMatter } from "../server/services/seedReeveSampleMatter";
import { recordConsentEvent } from "../server/services/recordConsentEvent";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";

async function main() {
  const marker = await readDatabaseMarker(process.env.DATABASE_URL!);
  const decision = liveDatabaseDecision({ nodeEnv: "development", marker });
  if (!decision.ok) throw new Error(decision.message);
  // Same fallback the local server uses: a throwaway key, only ever on the test database.
  if (!process.env.AUDIT_SIGNING_KEY) process.env.AUDIT_SIGNING_KEY = (await import("crypto")).randomBytes(64).toString("hex");

  const emailIdx = process.argv.indexOf("--email");
  const email = emailIdx >= 0 ? process.argv[emailIdx + 1] : undefined;
  if (!email) throw new Error("Usage: npx tsx scripts/seed-session-trap.ts --email you@example.com");

  const seeded = await seedReeveSampleMatter({ userEmail: email });
  if (!seeded.success) throw new Error(seeded.message);
  const caseId = (seeded as { caseId?: string }).caseId;
  const [matter] = caseId
    ? await db.select().from(cases).where(eq(cases.id, caseId))
    : await db.select().from(cases).where(and(eq(cases.matterReference, "REE/FAM26-01188"), eq(cases.archived, false)));
  if (!matter) throw new Error("Seeded matter not found");
  const userId = matter.createdBy;

  const [first] = await db.select().from(meetingSessions).where(eq(meetingSessions.caseId, matter.id));
  const [firstNote] = await db.select().from(documents)
    .where(and(eq(documents.caseId, matter.id), eq(documents.type, "attendance_note")));
  const [firstLetter] = await db.select().from(documents)
    .where(and(eq(documents.caseId, matter.id), eq(documents.type, "client_letter")));

  // Session 2: a week later, processed, with its own (clearly labelled) documents.
  const followUp = new Date(first.startedAt.getTime() + 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000);
  const [s2] = await db.insert(meetingSessions).values({
    caseId: matter.id, recordingType: "full_meeting", sessionTitle: "Follow-up call (sample)",
    startedAt: followUp, durationSeconds: 48 * 60, status: "completed", createdBy: userId,
  }).returning();
  await db.insert(audioRecordings).values({
    caseId: matter.id, meetingSessionId: s2.id, duration: 48 * 60, recordedAt: followUp,
    expiresAt: new Date(followUp.getTime() + 7 * 864e5), deletedAt: new Date(followUp.getTime() + 7 * 864e5),
    mimeType: "audio/webm",
  });
  await db.insert(transcripts).values({
    caseId: matter.id, meetingSessionId: s2.id,
    content: "SAMPLE SESSION 2 TRANSCRIPT. Follow-up call with the client.",
    createdAt: new Date(followUp.getTime() + 60 * 60 * 1000),
  });
  for (const [type, source] of [["attendance_note", firstNote], ["client_letter", firstLetter]] as const) {
    await db.insert(documents).values({
      caseId: matter.id, meetingSessionId: s2.id, type,
      content: `<p><strong>SAMPLE SESSION 2 (follow-up call)</strong></p>${source?.content ?? ""}`,
      version: 1, versionType: "ai_generated", createdBy: userId, status: "draft",
      createdAt: new Date(followUp.getTime() + 70 * 60 * 1000),
    });
  }

  // Session 3: an internal meeting straight after, recorded but never processed.
  const internal = new Date(followUp.getTime() + 53 * 60 * 1000);
  const [s3] = await db.insert(meetingSessions).values({
    caseId: matter.id, recordingType: "internal_meeting", sessionTitle: null,
    startedAt: internal, durationSeconds: 90 * 60, status: "pending", createdBy: userId,
  }).returning();
  const [s3Audio] = await db.insert(audioRecordings).values({
    caseId: matter.id, meetingSessionId: s3.id, duration: 90 * 60, recordedAt: internal,
    expiresAt: new Date(Date.now() + 7 * 864e5), mimeType: "audio/webm",
    filePath: "/objects/sample-not-uploaded",
  }).returning();
  // Sealed the same way the app seals Quick Record consent, so processing is allowed.
  await recordConsentEvent({
    caseId: matter.id, audioRecordingId: s3Audio.id, solicitorId: userId, consentGiven: true,
    disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION, disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
    consentModality: "verbal_recorded", lawfulBasis: "consent",
    recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
    source: "sample_data",
  } as Parameters<typeof recordConsentEvent>[0]);

  console.log(`Seeded matter ${matter.id.slice(0, 8)}: session 1 and 2 processed, session 3 (internal meeting) not processed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
