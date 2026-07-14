import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { audioRecordings, auditTrail, cases, consentLogs, users } from "@shared/schema";
import { recordConsentEvent } from "./recordConsentEvent";
import { assertSealedConsent } from "./assertSealedConsent";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TEST_KEY = process.env.AUDIT_SIGNING_KEY || "integration-test-audit-signing-key";

describe.skipIf(!hasDatabase)("sealed consent DB tamper gate", () => {
  const userId = `tamper-test-user-${randomUUID()}`;
  let caseId: string;
  let audioRecordingId: string;
  let consentLogId: string;

  beforeAll(async () => {
    process.env.AUDIT_SIGNING_KEY = TEST_KEY;

    await db.insert(users).values({
      id: userId,
      email: `${userId}@example.test`,
      firstName: "Tamper",
      lastName: "Test",
    });

    const [createdCase] = await db
      .insert(cases)
      .values({
        title: "Tamper gate test matter",
        clientName: "Tamper Client",
        sourceType: "audio",
        createdBy: userId,
      })
      .returning();
    caseId = createdCase.id;

    const [audio] = await db
      .insert(audioRecordings)
      .values({
        caseId,
        filePath: `.private/tamper-test/${randomUUID()}.webm`,
        mimeType: "audio/webm",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();
    audioRecordingId = audio.id;

    const sealed = await recordConsentEvent({
      caseId,
      audioRecordingId,
      solicitorId: userId,
      consentGiven: true,
      disclaimerScriptVersion: "v-test",
      disclaimerWordingText: "Test disclaimer",
      consentModality: "verbal_recorded",
      lawfulBasis: "consent",
      recordingPurpose: "Integration tamper test",
      source: "tamper_gate_test",
    });
    consentLogId = sealed.consentLog.id;

    await assertSealedConsent(caseId, userId, audioRecordingId);
  });

  afterAll(async () => {
    await db.delete(auditTrail).where(eq(auditTrail.caseId, caseId));
    await db.delete(consentLogs).where(eq(consentLogs.caseId, caseId));
    await db.delete(audioRecordings).where(eq(audioRecordings.caseId, caseId));
    await db.delete(cases).where(eq(cases.id, caseId));
    await db.delete(users).where(eq(users.id, userId));
    await pool.end();
  });

  it("refuses processing gate after consent_given is tampered in the database", async () => {
    await db
      .update(consentLogs)
      .set({ consentGiven: false })
      .where(eq(consentLogs.id, consentLogId));

    await expect(assertSealedConsent(caseId, userId, audioRecordingId)).rejects.toMatchObject({
      name: "SealedConsentError",
      reason: "no_sealed_consent",
    });
  });

  it("refuses processing gate after content_hash is tampered in the database", async () => {
    await db
      .update(consentLogs)
      .set({ consentGiven: true, contentHash: "deadbeef" })
      .where(eq(consentLogs.id, consentLogId));

    await expect(assertSealedConsent(caseId, userId, audioRecordingId)).rejects.toMatchObject({
      name: "SealedConsentError",
      reason: "audit_hash_mismatch",
    });
  });
});
