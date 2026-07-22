import crypto from "crypto";
import { getAuditSigningKey } from "./auditChain";

export type KeyTerms = {
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  /** Unix seconds — mandatory on every minted link. */
  expiresAtUnix: number;
};

/**
 * Stable pipe-delimited payload. Integers only — UI adds "days" wording.
 * Format: evaluationPeriodDays|feeEarnerCount|expiresAtUnix
 */
export function buildKeyTermsPayload(terms: KeyTerms): string {
  return `${terms.evaluationPeriodDays}|${terms.feeEarnerCount}|${terms.expiresAtUnix}`;
}

/** Offline / ops helper to mint acceptance-link signatures. */
export function signKeyTerms(terms: KeyTerms): string {
  const payload = buildKeyTermsPayload(terms);
  return crypto
    .createHmac("sha256", getAuditSigningKey())
    .update(payload)
    .digest("hex");
}

export type KeyTermsVerification =
  | { ok: true; terms: KeyTerms }
  | { ok: false; code: "INVALID_KEY_TERMS_SIGNATURE" | "KEY_TERMS_EXPIRED" | "KEY_TERMS_MALFORMED" };

/**
 * Verify signed Key Terms at POST /api/dpa/request.
 * Rejects tampered or expired offers.
 */
export function verifyKeyTermsSignature(input: {
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  ktExp: number;
  keyTermsSig: string;
  nowUnix?: number;
}): KeyTermsVerification {
  const { evaluationPeriodDays, feeEarnerCount, ktExp, keyTermsSig } = input;

  if (
    !Number.isInteger(evaluationPeriodDays) ||
    !Number.isInteger(feeEarnerCount) ||
    !Number.isInteger(ktExp) ||
    evaluationPeriodDays < 1 ||
    feeEarnerCount < 1 ||
    ktExp < 1 ||
    typeof keyTermsSig !== "string" ||
    keyTermsSig.length === 0
  ) {
    return { ok: false, code: "KEY_TERMS_MALFORMED" };
  }

  const terms: KeyTerms = {
    evaluationPeriodDays,
    feeEarnerCount,
    expiresAtUnix: ktExp,
  };

  const expected = signKeyTerms(terms);
  let sigOk = false;
  try {
    sigOk = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(keyTermsSig, "hex"),
    );
  } catch {
    sigOk = false;
  }

  if (!sigOk) {
    return { ok: false, code: "INVALID_KEY_TERMS_SIGNATURE" };
  }

  const now = input.nowUnix ?? Math.floor(Date.now() / 1000);
  if (now > ktExp) {
    return { ok: false, code: "KEY_TERMS_EXPIRED" };
  }

  return { ok: true, terms };
}

/** Build a query string for /dpa acceptance links. */
export function buildSignedKeyTermsQuery(terms: KeyTerms, extra?: { ref?: string }): string {
  const sig = signKeyTerms(terms);
  const params = new URLSearchParams({
    evaluationPeriodDays: String(terms.evaluationPeriodDays),
    feeEarnerCount: String(terms.feeEarnerCount),
    ktExp: String(terms.expiresAtUnix),
    keyTermsSig: sig,
  });
  if (extra?.ref) params.set("ref", extra.ref);
  return params.toString();
}
