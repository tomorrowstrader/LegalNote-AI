import type { Request } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { auditTrail, cases, consentLogs, type ConsentLog } from "@shared/schema";
import {
  AUDIT_PAYLOAD_V2,
  buildAuditEntryContent,
  computeAuditChainHash,
  getAuditSigningKey,
} from "./auditChain";
import {
  buildConsentCanonicalPayload,
  hashConsentPayload,
  signConsentHash,
  type ConsentCanonicalPayload,
} from "./consentCanonical";

export type RecordConsentEventInput = {
  caseId: string;
  audioRecordingId?: string | null;
  solicitorId: string;
  consentGiven: boolean;
  disclaimerScriptVersion: string;
  disclaimerWordingText?: string | null;
  consentModality: "verbal_recorded" | "verbal_attested" | "electronic";
  lawfulBasis?: "consent" | "contract" | "legitimate_interests" | "legal_obligation" | null;
  recordingPurpose?: string | null;
  ipAddress?: string | null;
  source: string;
  req?: Request;
  auditMetadataExtras?: Record<string, unknown>;
};

export type RecordConsentEventResult = {
  consentLog: ConsentLog;
  auditEntryId: string;
  contentHash: string;
};

async function lockCaseAuditChain(tx: typeof db, caseId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${caseId}))`);
}

export async function recordConsentEvent(
  input: RecordConsentEventInput,
): Promise<RecordConsentEventResult> {
  const signingKey = getAuditSigningKey();
  void signingKey;

  const caseRows = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, input.caseId), eq(cases.createdBy, input.solicitorId)));
  if (!caseRows[0]) {
    throw new Error("Case not found or unauthorized");
  }

  const consentTimestamp = new Date();
  const canonical: ConsentCanonicalPayload = buildConsentCanonicalPayload({
    ...input,
    consentTimestamp,
  });
  const contentHash = hashConsentPayload(canonical);
  const contentSignature = signConsentHash(contentHash);

  const auditEventType = input.consentGiven ? "consent_given" : "consent_declined";
  const ipAddress = input.req?.ip || input.req?.socket?.remoteAddress || input.ipAddress || null;
  const userAgent = input.req?.get("user-agent") ?? null;

  return db.transaction(async (tx) => {
    await lockCaseAuditChain(tx, input.caseId);

    const consentInsert = await tx
      .insert(consentLogs)
      .values({
        caseId: input.caseId,
        audioRecordingId: input.audioRecordingId ?? null,
        solicitorId: input.solicitorId,
        consentGiven: input.consentGiven,
        consentTimestamp,
        disclaimerScriptVersion: input.disclaimerScriptVersion,
        disclaimerWordingText: input.disclaimerWordingText ?? null,
        consentModality: input.consentModality,
        ipAddress,
        lawfulBasis: input.lawfulBasis ?? null,
        recordingPurpose: input.recordingPurpose ?? null,
        contentHash,
        contentSignature,
        sealingStatus: "sealed",
      })
      .returning();

    const consentLog = consentInsert[0];

    const prevQuery = await tx
      .select()
      .from(auditTrail)
      .where(eq(auditTrail.caseId, input.caseId))
      .orderBy(desc(auditTrail.timestamp))
      .limit(1);
    const previousEntry = prevQuery[0] ?? null;
    const previousChainHash = previousEntry?.chainHash ?? "GENESIS";

    const auditTimestamp = new Date().toISOString();
    const metadata = {
      ...canonical,
      consentLogId: consentLog.id,
      contentHash,
      ...(input.auditMetadataExtras ?? {}),
    };

    const entryContent = buildAuditEntryContent(AUDIT_PAYLOAD_V2, {
      eventType: auditEventType,
      userId: input.solicitorId,
      caseId: input.caseId,
      documentId: null,
      transcriptId: null,
      audioRecordingId: input.audioRecordingId ?? null,
      metadata,
      severity: "info",
      timestamp: auditTimestamp,
    });

    const chainHash = computeAuditChainHash(entryContent, previousChainHash, getAuditSigningKey());

    const auditInsert = await tx
      .insert(auditTrail)
      .values({
        eventType: auditEventType,
        userId: input.solicitorId,
        caseId: input.caseId,
        audioRecordingId: input.audioRecordingId ?? null,
        ipAddress,
        userAgent,
        metadata,
        severity: "info",
        previousEntryId: previousEntry?.id ?? null,
        chainHash,
        payloadVersion: AUDIT_PAYLOAD_V2,
      })
      .returning();

    return {
      consentLog,
      auditEntryId: auditInsert[0].id,
      contentHash,
    };
  });
}
