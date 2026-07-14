import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditTrail, consentLogs } from "@shared/schema";
import {
  buildConsentCanonicalPayload,
  hashConsentPayload,
  verifyConsentSignature,
} from "./consentCanonical";

export type SealedConsentFailureReason =
  | "no_sealed_consent"
  | "consent_not_given"
  | "consent_withdrawn"
  | "invalid_signature"
  | "audit_entry_missing"
  | "audit_hash_mismatch";

export class SealedConsentError extends Error {
  readonly reason: SealedConsentFailureReason;

  constructor(reason: SealedConsentFailureReason, message: string) {
    super(message);
    this.name = "SealedConsentError";
    this.reason = reason;
  }
}

export async function assertSealedConsent(
  caseId: string,
  userId: string,
  audioRecordingId?: string | null,
): Promise<{ consentLogId: string; contentHash: string }> {
  const logs = await db
    .select()
    .from(consentLogs)
    .where(eq(consentLogs.caseId, caseId))
    .orderBy(desc(consentLogs.consentTimestamp));

  const candidates = logs.filter((log) => {
    if (log.sealingStatus !== "sealed") return false;
    if (!log.consentGiven) return false;
    if (log.consentWithdrawn) return false;
    if (!log.contentHash || !log.contentSignature) return false;
    if (audioRecordingId && log.audioRecordingId && log.audioRecordingId !== audioRecordingId) {
      return false;
    }
    return true;
  });

  const consentLog = candidates[0];
  if (!consentLog) {
    const hasPreSealing = logs.some((l) => l.sealingStatus === "pre_sealing");
    throw new SealedConsentError(
      "no_sealed_consent",
      hasPreSealing
        ? "Sealed client consent is required before processing. Historic consent records are marked pre_sealing and cannot authorize privileged processing."
        : "Sealed client consent must be recorded before processing audio recordings.",
    );
  }

  const auditRows = await db
    .select()
    .from(auditTrail)
    .where(
      and(
        eq(auditTrail.caseId, caseId),
        eq(auditTrail.eventType, "consent_given"),
      ),
    )
    .orderBy(desc(auditTrail.timestamp));

  const linked = auditRows.find((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    return meta?.consentLogId === consentLog.id;
  });

  if (!linked) {
    throw new SealedConsentError(
      "audit_entry_missing",
      "Consent record is not linked to a chained audit trail entry.",
    );
  }

  const meta = linked.metadata as Record<string, unknown>;
  const canonicalFromAudit = buildConsentCanonicalPayload({
    caseId: String(meta.caseId),
    audioRecordingId: (meta.audioRecordingId as string | null) ?? null,
    solicitorId: String(meta.solicitorId),
    consentGiven: Boolean(meta.consentGiven),
    consentTimestamp: new Date(String(meta.consentTimestamp)),
    disclaimerScriptVersion: String(meta.disclaimerScriptVersion),
    disclaimerWordingText: (meta.disclaimerWordingText as string | null) ?? null,
    consentModality: String(meta.consentModality),
    lawfulBasis: (meta.lawfulBasis as string | null) ?? null,
    recordingPurpose: (meta.recordingPurpose as string | null) ?? null,
    ipAddress: (meta.ipAddress as string | null) ?? null,
    source: String(meta.source),
  });

  const expectedHash = hashConsentPayload(canonicalFromAudit);
  if (expectedHash !== consentLog.contentHash) {
    throw new SealedConsentError(
      "audit_hash_mismatch",
      "Consent log hash does not match chained audit metadata.",
    );
  }

  if (!verifyConsentSignature(consentLog.contentHash, consentLog.contentSignature)) {
    throw new SealedConsentError(
      "invalid_signature",
      "Consent record integrity check failed (invalid signature).",
    );
  }

  const metaHash = meta.contentHash as string | undefined;
  if (metaHash && metaHash !== consentLog.contentHash) {
    throw new SealedConsentError(
      "audit_hash_mismatch",
      "Audit metadata contentHash does not match consent log.",
    );
  }

  return { consentLogId: consentLog.id, contentHash: consentLog.contentHash };
}

export async function verifyCaseConsentSealing(caseId: string): Promise<{
  preSealingCount: number;
  sealedLogs: Array<{
    consentLogId: string;
    signatureValid: boolean;
    auditEntryLinked: boolean;
    hashMatches: boolean;
  }>;
  consentSealingIntact: boolean;
}> {
  const logs = await db.select().from(consentLogs).where(eq(consentLogs.caseId, caseId));

  const preSealingCount = logs.filter((l) => l.sealingStatus === "pre_sealing").length;
  const sealed = logs.filter((l) => l.sealingStatus === "sealed");

  const auditRows = await db
    .select()
    .from(auditTrail)
    .where(eq(auditTrail.caseId, caseId));

  const sealedLogs = sealed.map((log) => {
    const linkedAudit = auditRows.find((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      return meta?.consentLogId === log.id;
    });

    let hashMatches = false;
    let signatureValid = false;

    if (linkedAudit && log.contentHash && log.contentSignature) {
      const meta = linkedAudit.metadata as Record<string, unknown>;
      const canonicalFromAudit = buildConsentCanonicalPayload({
        caseId: String(meta.caseId),
        audioRecordingId: (meta.audioRecordingId as string | null) ?? null,
        solicitorId: String(meta.solicitorId),
        consentGiven: Boolean(meta.consentGiven),
        consentTimestamp: new Date(String(meta.consentTimestamp)),
        disclaimerScriptVersion: String(meta.disclaimerScriptVersion),
        disclaimerWordingText: (meta.disclaimerWordingText as string | null) ?? null,
        consentModality: String(meta.consentModality),
        lawfulBasis: (meta.lawfulBasis as string | null) ?? null,
        recordingPurpose: (meta.recordingPurpose as string | null) ?? null,
        ipAddress: (meta.ipAddress as string | null) ?? null,
        source: String(meta.source),
      });
      const expectedHash = hashConsentPayload(canonicalFromAudit);
      hashMatches = expectedHash === log.contentHash;
      signatureValid = hashMatches && verifyConsentSignature(log.contentHash, log.contentSignature);
    }

    const auditEntryLinked = !!linkedAudit;

    return {
      consentLogId: log.id,
      signatureValid,
      auditEntryLinked,
      hashMatches,
    };
  });

  const consentSealingIntact =
    sealedLogs.length === 0 ||
    sealedLogs.every((s) => s.signatureValid && s.auditEntryLinked && s.hashMatches);

  return { preSealingCount, sealedLogs, consentSealingIntact };
}
