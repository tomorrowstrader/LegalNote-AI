import crypto from "crypto";
import { getAuditSigningKey } from "./auditChain";

export type ConsentCanonicalPayload = {
  caseId: string;
  audioRecordingId: string | null;
  solicitorId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  disclaimerScriptVersion: string;
  disclaimerWordingText: string | null;
  consentModality: string;
  lawfulBasis: string | null;
  recordingPurpose: string | null;
  ipAddress: string | null;
  source: string;
};

export function buildConsentCanonicalPayload(input: {
  caseId: string;
  audioRecordingId?: string | null;
  solicitorId: string;
  consentGiven: boolean;
  consentTimestamp: Date;
  disclaimerScriptVersion: string;
  disclaimerWordingText?: string | null;
  consentModality: string;
  lawfulBasis?: string | null;
  recordingPurpose?: string | null;
  ipAddress?: string | null;
  source: string;
}): ConsentCanonicalPayload {
  return {
    caseId: input.caseId,
    audioRecordingId: input.audioRecordingId ?? null,
    solicitorId: input.solicitorId,
    consentGiven: input.consentGiven,
    consentTimestamp: input.consentTimestamp.toISOString(),
    disclaimerScriptVersion: input.disclaimerScriptVersion,
    disclaimerWordingText: input.disclaimerWordingText ?? null,
    consentModality: input.consentModality,
    lawfulBasis: input.lawfulBasis ?? null,
    recordingPurpose: input.recordingPurpose ?? null,
    ipAddress: input.ipAddress ?? null,
    source: input.source,
  };
}

export function hashConsentPayload(payload: ConsentCanonicalPayload): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function signConsentHash(contentHash: string): string {
  const signingKey = getAuditSigningKey();
  return crypto.createHmac("sha256", signingKey).update(contentHash).digest("hex");
}

export function verifyConsentSignature(contentHash: string, contentSignature: string): boolean {
  try {
    const expected = signConsentHash(contentHash);
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(contentSignature, "hex"),
    );
  } catch {
    return false;
  }
}
