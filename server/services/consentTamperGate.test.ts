import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db, pool } from "../db";
import { audioRecordings, auditTrail, cases, consentLogs, users } from "@shared/schema";
import { recordConsentEvent } from "./recordConsentEvent";
import { assertSealedConsent } from "./assertSealedConsent";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const hasSealBypassUrl = Boolean(process.env.SEAL_BYPASS_DATABASE_URL);
const TEST_KEY = process.env.AUDIT_SIGNING_KEY || "integration-test-audit-signing-key";

describe("sealBypassTestDb import isolation", () => {
  it("is only imported by the two seal integration test files", () => {
    const serverDir = path.resolve(__dirname, "..");
    const allowed = new Set([
      path.join(serverDir, "services/consentTamperGate.test.ts"),
      path.join(serverDir, "upsertUserSignedIdRemap.test.ts"),
      path.join(serverDir, "sealBypassTestDb.ts"),
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (allowed.has(full)) continue;
          const content = fs.readFileSync(full, "utf8");
          if (
            content.includes("sealBypassTestDb") ||
            content.includes("SEAL_BYPASS_DATABASE_URL")
          ) {
            offenders.push(path.relative(serverDir, full));
          }
        }
      }
    };
    walk(serverDir);
    expect(offenders).toEqual([]);
  });
});

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
    if (hasSealBypassUrl) {
      const { withSealBypass, sealBypassPool } = await import("../sealBypassTestDb");
      await withSealBypass(async (tx) => {
        await tx.delete(auditTrail).where(eq(auditTrail.caseId, caseId));
        await tx.delete(consentLogs).where(eq(consentLogs.caseId, caseId));
        await tx.delete(audioRecordings).where(eq(audioRecordings.caseId, caseId));
        await tx.delete(cases).where(eq(cases.id, caseId));
        await tx.delete(users).where(eq(users.id, userId));
      });
      await sealBypassPool.end();
    } else {
      console.warn(
        "[SEAL] Tamper-test cleanup skipped — set SEAL_BYPASS_DATABASE_URL (role legalnote_seal_bypass).",
      );
    }
    await pool.end();
  });

  it("refuses processing gate after consent_given is tampered in the database", async function () {
    if (!hasSealBypassUrl) {
      console.warn(
        "[SEAL] Forge test skipped — set SEAL_BYPASS_DATABASE_URL (role legalnote_seal_bypass).",
      );
      return;
    }

    const { withSealBypass } = await import("../sealBypassTestDb");
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
    if (!hasSealBypassUrl) {
      console.warn(
        "[SEAL] Forge test skipped — set SEAL_BYPASS_DATABASE_URL (role legalnote_seal_bypass).",
      );
      return;
    }

    const { withSealBypass } = await import("../sealBypassTestDb");
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
