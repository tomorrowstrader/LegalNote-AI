import crypto from "crypto";
import { getAuditSigningKey } from "./auditChain";
import type { LegalAgreementAcceptance } from "@shared/schema";

/**
 * Canonical acceptance payload — fixed key order for stable JSON.stringify hashing.
 * Mirrors consentCanonical.ts. This is what acceptancePayloadHash seals.
 */
export type LegalAcceptanceCanonicalPayload = {
  acceptanceId: string;
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  sraNumber: string | null;
  ref: string | null;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  acceptedAt: string;
  affirmativeAssent: boolean;
  dpaAccepted: boolean;
  evaluationAccepted: boolean;
  dpaContentHash: string;
  evaluationContentHash: string;
  identityMethod: string;
  requestIpAddress: string | null;
  confirmIpAddress: string | null;
};

export function buildLegalAcceptanceCanonicalPayload(input: {
  acceptanceId: string;
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  sraNumber?: string | null;
  ref?: string | null;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  acceptedAt: Date;
  affirmativeAssent: boolean;
  dpaAccepted: boolean;
  evaluationAccepted: boolean;
  dpaContentHash: string;
  evaluationContentHash: string;
  identityMethod: string;
  requestIpAddress?: string | null;
  confirmIpAddress?: string | null;
}): LegalAcceptanceCanonicalPayload {
  // Key order is the contract — do not reorder without a payload version bump.
  return {
    acceptanceId: input.acceptanceId,
    firmName: input.firmName,
    signerName: input.signerName,
    signerTitle: input.signerTitle,
    email: input.email,
    sraNumber: input.sraNumber ?? null,
    ref: input.ref ?? null,
    evaluationPeriodDays: input.evaluationPeriodDays,
    feeEarnerCount: input.feeEarnerCount,
    acceptedAt: input.acceptedAt.toISOString(),
    affirmativeAssent: input.affirmativeAssent,
    dpaAccepted: input.dpaAccepted,
    evaluationAccepted: input.evaluationAccepted,
    dpaContentHash: input.dpaContentHash,
    evaluationContentHash: input.evaluationContentHash,
    identityMethod: input.identityMethod,
    requestIpAddress: input.requestIpAddress ?? null,
    confirmIpAddress: input.confirmIpAddress ?? null,
  };
}

export function hashLegalAcceptancePayload(
  payload: LegalAcceptanceCanonicalPayload,
): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function signLegalAcceptanceHash(payloadHash: string): string {
  const signingKey = getAuditSigningKey();
  return crypto.createHmac("sha256", signingKey).update(payloadHash).digest("hex");
}

export function verifyLegalAcceptanceSignature(
  payloadHash: string,
  contentSignature: string,
): boolean {
  try {
    const expected = signLegalAcceptanceHash(payloadHash);
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(contentSignature, "hex"),
    );
  } catch {
    return false;
  }
}

/** SHA-256 of UTF-8 bytes of stored snapshot text — must equal contentHash. */
export function hashSnapshotText(text: string): string {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

export type VerifyLegalAcceptanceResult = {
  valid: boolean;
  recordSealValid: boolean;
  dpaHashValid: boolean;
  evaluationHashValid: boolean;
  reasons: string[];
};

/**
 * Recompute row seal from stored fields and confirm snapshot bytes re-hash
 * to the stored content hashes. Independent of the audit chain.
 */
export function verifyLegalAcceptanceRecord(
  row: LegalAgreementAcceptance,
  dpaSnapshotText: string | null,
  evaluationSnapshotText: string | null,
): VerifyLegalAcceptanceResult {
  const reasons: string[] = [];

  if (row.status !== "accepted") {
    reasons.push("status_not_accepted");
  }
  if (!row.acceptedAt || !row.dpaContentHash || !row.evaluationContentHash) {
    reasons.push("missing_seal_fields");
  }
  if (!row.acceptancePayloadHash || !row.acceptanceContentSignature) {
    reasons.push("missing_row_seal");
  }
  if (!row.affirmativeAssent || !row.dpaAccepted || !row.evaluationAccepted) {
    reasons.push("assent_incomplete");
  }

  let recordSealValid = false;
  if (
    row.acceptedAt &&
    row.dpaContentHash &&
    row.evaluationContentHash &&
    row.acceptancePayloadHash &&
    row.acceptanceContentSignature
  ) {
    const canonical = buildLegalAcceptanceCanonicalPayload({
      acceptanceId: row.id,
      firmName: row.firmName,
      signerName: row.signerName,
      signerTitle: row.signerTitle,
      email: row.email,
      sraNumber: row.sraNumber,
      ref: row.ref,
      evaluationPeriodDays: row.evaluationPeriodDays,
      feeEarnerCount: row.feeEarnerCount,
      acceptedAt: row.acceptedAt,
      affirmativeAssent: row.affirmativeAssent,
      dpaAccepted: row.dpaAccepted,
      evaluationAccepted: row.evaluationAccepted,
      dpaContentHash: row.dpaContentHash,
      evaluationContentHash: row.evaluationContentHash,
      identityMethod: row.identityMethod,
      requestIpAddress: row.requestIpAddress,
      confirmIpAddress: row.confirmIpAddress,
    });
    const expectedHash = hashLegalAcceptancePayload(canonical);
    const hashMatches = expectedHash === row.acceptancePayloadHash;
    const sigMatches = verifyLegalAcceptanceSignature(
      row.acceptancePayloadHash,
      row.acceptanceContentSignature,
    );
    recordSealValid = hashMatches && sigMatches;
    if (!hashMatches) reasons.push("payload_hash_mismatch");
    if (!sigMatches) reasons.push("payload_signature_mismatch");
  }

  let dpaHashValid = false;
  if (dpaSnapshotText != null && row.dpaContentHash) {
    dpaHashValid = hashSnapshotText(dpaSnapshotText) === row.dpaContentHash;
    if (!dpaHashValid) reasons.push("dpa_snapshot_hash_mismatch");
  } else {
    reasons.push("dpa_snapshot_missing");
  }

  let evaluationHashValid = false;
  if (evaluationSnapshotText != null && row.evaluationContentHash) {
    evaluationHashValid =
      hashSnapshotText(evaluationSnapshotText) === row.evaluationContentHash;
    if (!evaluationHashValid) reasons.push("evaluation_snapshot_hash_mismatch");
  } else {
    reasons.push("evaluation_snapshot_missing");
  }

  const valid =
    reasons.length === 0 &&
    recordSealValid &&
    dpaHashValid &&
    evaluationHashValid;

  return {
    valid,
    recordSealValid,
    dpaHashValid,
    evaluationHashValid,
    reasons,
  };
}
