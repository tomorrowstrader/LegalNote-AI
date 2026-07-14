import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { audioRecordings, auditTrail, cases, consentLogs, users } from "@shared/schema";
import { recordConsentEvent } from "./recordConsentEvent";
import { assertSealedConsent } from "./assertSealedConsent";
import { SEAL_BYPASS_DB_ROLE, withSealBypass } from "../sealTriggerAssertion";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TEST_KEY = process.env.AUDIT_SIGNING_KEY || "integration-test-audit-signing-key";

describe.skipIf(!hasDatabase)("sealed consent DB tamper gate", () => {
  const userId = `tamper-test-user-${randomUUID()}`;
  let caseId: string;
  let audioRecordingId: string;
  let consentLogId: string;
  let sealBypassRole = false;

  beforeAll(async () => {
    process.env.AUDIT_SIGNING_KEY = TEST_KEY;

    const who = await db.execute(sql`SELECT current_user AS role`);
    const rows = (who.rows ?? who) as Array<{ role: string }>;
    sealBypassRole = rows[0]?.role === SEAL_BYPASS_DB_ROLE;

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
    if (sealBypassRole) {
      await withSealBypass(async (tx) => {
        await tx.delete(auditTrail).where(eq(auditTrail.caseId, caseId));
        await tx.delete(consentLogs).where(eq(consentLogs.caseId, caseId));
        await tx.delete(audioRecordings).where(eq(audioRecordings.caseId, caseId));
        await tx.delete(cases).where(eq(cases.id, caseId));
        await tx.delete(users).where(eq(users.id, userId));
      });
    } else {
      console.warn(
        `[SEAL] Tamper-test cleanup skipped — connect as ${SEAL_BYPASS_DB_ROLE} to remove sealed fixtures.`,
      );
    }
    await pool.end();
  });

  it("refuses processing gate after consent_given is tampered in the database", async function () {
    if (!sealBypassRole) {
      console.warn(
        `[SEAL] Forge test skipped — requires DB role ${SEAL_BYPASS_DB_ROLE}.`,
      );
      return;
    }

    await withSealBypass(async (tx) => {
      await tx
        .update(consentLogs)
        .set({ consentGiven: false })
        .where(eq(consentLogs.id, consentLogId));
    });

    await expect(assertSealedConsent(caseId, userId, audioRecordingId)).rejects.toMatchObject({
      name: "SealedConsentError",
      reason: "no_sealed_consent",
    });
  });

  it("refuses processing gate after content_hash is tampered in the database", async function () {
    if (!sealBypassRole) {
      console.warn(
        `[SEAL] Forge test skipped — requires DB role ${SEAL_BYPASS_DB_ROLE}.`,
      );
      return;
    }

    await withSealBypass(async (tx) => {
      await tx
        .update(consentLogs)
        .set({ consentGiven: true, contentHash: "deadbeef" })
        .where(eq(consentLogs.id, consentLogId));
    });

    await expect(assertSealedConsent(caseId, userId, audioRecordingId)).rejects.toMatchObject({
      name: "SealedConsentError",
      reason: "audit_hash_mismatch",
    });
  });
});
