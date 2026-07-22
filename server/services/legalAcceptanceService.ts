import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { db } from "../db";
import {
  legalAgreementAcceptances,
  legalDocumentSnapshots,
  type LegalAgreementAcceptance,
  type LegalDocumentSnapshot,
} from "@shared/schema";
import { SYSTEM_USER_ID } from "../systemUser";
import { storage } from "../storage";
import {
  loadLegalDocument,
  type LegalDocumentSlug,
  type LoadedLegalDocument,
} from "./legalDocumentLoader";
import {
  buildLegalAcceptanceCanonicalPayload,
  hashLegalAcceptancePayload,
  signLegalAcceptanceHash,
  verifyLegalAcceptanceRecord,
} from "./legalAcceptanceCanonical";
import { verifyKeyTermsSignature } from "./keyTermsSign";

const CONFIRMATION_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function clientIp(req?: Request): string | null {
  if (!req) return null;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.ip || req.socket?.remoteAddress || null;
}

function clientUa(req?: Request): string | null {
  return req?.get?.("user-agent") ?? null;
}

export async function upsertLegalDocumentSnapshot(
  loaded: LoadedLegalDocument,
): Promise<void> {
  await db
    .insert(legalDocumentSnapshots)
    .values({
      contentHash: loaded.contentHash,
      documentSlug: loaded.slug,
      text: loaded.text,
      byteLength: loaded.bytes.length,
    })
    .onConflictDoNothing({ target: legalDocumentSnapshots.contentHash });
}

export async function getLegalDocumentSnapshotByHash(
  contentHash: string,
): Promise<LegalDocumentSnapshot | undefined> {
  const rows = await db
    .select()
    .from(legalDocumentSnapshots)
    .where(eq(legalDocumentSnapshots.contentHash, contentHash))
    .limit(1);
  return rows[0];
}

export type RequestAcceptanceInput = {
  firmName: string;
  signerName: string;
  signerTitle: string;
  email: string;
  sraNumber?: string;
  ref?: string;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  ktExp: number;
  keyTermsSig: string;
  req?: Request;
};

export class LegalAcceptanceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LegalAcceptanceError";
  }
}

export async function createPendingAcceptance(
  input: RequestAcceptanceInput,
): Promise<{ acceptance: LegalAgreementAcceptance; confirmationToken: string }> {
  const verified = verifyKeyTermsSignature({
    evaluationPeriodDays: input.evaluationPeriodDays,
    feeEarnerCount: input.feeEarnerCount,
    ktExp: input.ktExp,
    keyTermsSig: input.keyTermsSig,
  });

  if (!verified.ok) {
    throw new LegalAcceptanceError(
      400,
      verified.code,
      verified.code === "KEY_TERMS_EXPIRED"
        ? "This acceptance offer has expired. Please request a new link from LegalNote."
        : "Invalid Key Terms signature. The evaluation terms cannot be altered.",
    );
  }

  const confirmationToken = crypto.randomBytes(32).toString("hex");
  const confirmationExpiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  const inserted = await db
    .insert(legalAgreementAcceptances)
    .values({
      status: "pending_email",
      confirmationToken,
      confirmationExpiresAt,
      firmName: input.firmName,
      signerName: input.signerName,
      signerTitle: input.signerTitle,
      email: input.email,
      sraNumber: input.sraNumber ?? null,
      ref: input.ref ?? null,
      evaluationPeriodDays: verified.terms.evaluationPeriodDays,
      feeEarnerCount: verified.terms.feeEarnerCount,
      identityMethod: "email_confirmed",
      requestIpAddress: clientIp(input.req),
      requestUserAgent: clientUa(input.req),
    })
    .returning();

  return { acceptance: inserted[0], confirmationToken };
}

export async function getPendingAcceptanceByToken(
  token: string,
): Promise<LegalAgreementAcceptance> {
  const rows = await db
    .select()
    .from(legalAgreementAcceptances)
    .where(eq(legalAgreementAcceptances.confirmationToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new LegalAcceptanceError(404, "TOKEN_NOT_FOUND", "Confirmation link is invalid.");
  }

  if (row.status === "accepted") {
    throw new LegalAcceptanceError(
      400,
      "ALREADY_ACCEPTED",
      "These agreements have already been accepted.",
    );
  }

  if (row.status !== "pending_email") {
    throw new LegalAcceptanceError(
      400,
      "INVALID_STATUS",
      "This confirmation link is no longer valid.",
    );
  }

  if (new Date() > row.confirmationExpiresAt) {
    await db
      .update(legalAgreementAcceptances)
      .set({ status: "expired" })
      .where(eq(legalAgreementAcceptances.id, row.id));
    throw new LegalAcceptanceError(
      400,
      "TOKEN_EXPIRED",
      "This confirmation link has expired. Please start again from the DPA page.",
    );
  }

  return row;
}

export type ConfirmAcceptanceInput = {
  token: string;
  dpaAccepted: boolean;
  evaluationAccepted: boolean;
  req?: Request;
  authenticatedUserId?: string | null;
  authenticatedUserEmail?: string | null;
};

/**
 * Seal sequence: load masters (one Buffer each) → snapshot → seal row → audit.
 * Same Buffer/bytes used for hash and snapshot throughout.
 */
export async function confirmAcceptance(
  input: ConfirmAcceptanceInput,
): Promise<LegalAgreementAcceptance> {
  if (input.dpaAccepted !== true || input.evaluationAccepted !== true) {
    throw new LegalAcceptanceError(
      400,
      "ASSENT_REQUIRED",
      "Both agreements must be accepted. Tick both checkboxes to continue.",
    );
  }

  const pending = await getPendingAcceptanceByToken(input.token);

  const dpa = loadLegalDocument("dpa");
  const evaluation = loadLegalDocument("evaluation");

  const acceptedAt = new Date();
  const confirmIp = clientIp(input.req);
  const confirmUa = clientUa(input.req);
  const verifyToken = crypto.randomBytes(32).toString("hex");

  let acceptedByUserId: string | null = null;
  if (
    input.authenticatedUserId &&
    input.authenticatedUserEmail &&
    input.authenticatedUserEmail.toLowerCase() === pending.email.toLowerCase()
  ) {
    acceptedByUserId = input.authenticatedUserId;
  }

  const sealed = await db.transaction(async (tx) => {
    await tx
      .insert(legalDocumentSnapshots)
      .values({
        contentHash: dpa.contentHash,
        documentSlug: dpa.slug,
        text: dpa.text,
        byteLength: dpa.bytes.length,
      })
      .onConflictDoNothing({ target: legalDocumentSnapshots.contentHash });

    await tx
      .insert(legalDocumentSnapshots)
      .values({
        contentHash: evaluation.contentHash,
        documentSlug: evaluation.slug,
        text: evaluation.text,
        byteLength: evaluation.bytes.length,
      })
      .onConflictDoNothing({ target: legalDocumentSnapshots.contentHash });

    const canonical = buildLegalAcceptanceCanonicalPayload({
      acceptanceId: pending.id,
      firmName: pending.firmName,
      signerName: pending.signerName,
      signerTitle: pending.signerTitle,
      email: pending.email,
      sraNumber: pending.sraNumber,
      ref: pending.ref,
      evaluationPeriodDays: pending.evaluationPeriodDays,
      feeEarnerCount: pending.feeEarnerCount,
      acceptedAt,
      affirmativeAssent: true,
      dpaAccepted: true,
      evaluationAccepted: true,
      dpaContentHash: dpa.contentHash,
      evaluationContentHash: evaluation.contentHash,
      identityMethod: "email_confirmed",
      requestIpAddress: pending.requestIpAddress,
      confirmIpAddress: confirmIp,
    });

    const acceptancePayloadHash = hashLegalAcceptancePayload(canonical);
    const acceptanceContentSignature = signLegalAcceptanceHash(acceptancePayloadHash);

    const updated = await tx
      .update(legalAgreementAcceptances)
      .set({
        status: "accepted",
        confirmedAt: acceptedAt,
        acceptedAt,
        affirmativeAssent: true,
        dpaAccepted: true,
        evaluationAccepted: true,
        dpaContentHash: dpa.contentHash,
        evaluationContentHash: evaluation.contentHash,
        acceptancePayloadHash,
        acceptanceContentSignature,
        confirmIpAddress: confirmIp,
        confirmUserAgent: confirmUa,
        acceptedByUserId,
        verifyToken,
      })
      .where(
        and(
          eq(legalAgreementAcceptances.id, pending.id),
          eq(legalAgreementAcceptances.status, "pending_email"),
        ),
      )
      .returning();

    if (!updated[0]) {
      throw new LegalAcceptanceError(
        409,
        "CONCURRENT_ACCEPTANCE",
        "Acceptance could not be completed. Please try again.",
      );
    }

    return updated[0];
  });

  try {
    const auditEntry = await storage.createAuditLog({
      eventType: "legal_agreement_accepted",
      userId: SYSTEM_USER_ID,
      severity: "info",
      ipAddress: confirmIp ?? undefined,
      userAgent: confirmUa ?? undefined,
      metadata: {
        acceptanceId: sealed.id,
        firmName: sealed.firmName,
        signerName: sealed.signerName,
        signerTitle: sealed.signerTitle,
        email: sealed.email,
        sraNumber: sealed.sraNumber,
        ref: sealed.ref,
        evaluationPeriodDays: sealed.evaluationPeriodDays,
        feeEarnerCount: sealed.feeEarnerCount,
        identityMethod: sealed.identityMethod,
        affirmativeAssent: true,
        assentedAt: acceptedAt.toISOString(),
        dpaContentHash: sealed.dpaContentHash,
        evaluationContentHash: sealed.evaluationContentHash,
        acceptancePayloadHash: sealed.acceptancePayloadHash,
        acceptanceContentSignature: sealed.acceptanceContentSignature,
      },
    });

    const withAudit = await db
      .update(legalAgreementAcceptances)
      .set({ auditTrailEntryId: auditEntry.id })
      .where(eq(legalAgreementAcceptances.id, sealed.id))
      .returning();

    return withAudit[0] ?? sealed;
  } catch (auditErr) {
    // Row seal is primary evidence — acceptance stands. Chain write must not be silent.
    console.error(
      `[AUDIT-FAILURE-CRITICAL] legal_agreement_accepted chain write failed after row seal — ` +
        `acceptanceId=${sealed.id} email=${sealed.email} firm=${sealed.firmName} ` +
        `dpaHash=${sealed.dpaContentHash} evaluationHash=${sealed.evaluationContentHash} ` +
        `payloadHash=${sealed.acceptancePayloadHash}`,
      auditErr,
    );
    return sealed;
  }
}

export async function getAcceptanceById(
  id: string,
): Promise<LegalAgreementAcceptance | undefined> {
  const rows = await db
    .select()
    .from(legalAgreementAcceptances)
    .where(eq(legalAgreementAcceptances.id, id))
    .limit(1);
  return rows[0];
}

export async function verifyAcceptanceAccess(
  id: string,
  opts: { verifyToken?: string | null; isAuthenticated?: boolean },
): Promise<LegalAgreementAcceptance> {
  const row = await getAcceptanceById(id);
  if (!row || row.status !== "accepted") {
    throw new LegalAcceptanceError(404, "NOT_FOUND", "Acceptance not found.");
  }

  if (opts.isAuthenticated) {
    return row;
  }

  if (opts.verifyToken && row.verifyToken) {
    try {
      const a = Buffer.from(opts.verifyToken);
      const b = Buffer.from(row.verifyToken);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return row;
      }
    } catch {
      // fall through
    }
  }

  throw new LegalAcceptanceError(
    401,
    "VERIFY_UNAUTHORIZED",
    "Authentication or a valid verification token is required.",
  );
}

export async function buildVerifyResponse(row: LegalAgreementAcceptance) {
  const dpaSnap = row.dpaContentHash
    ? await getLegalDocumentSnapshotByHash(row.dpaContentHash)
    : undefined;
  const evalSnap = row.evaluationContentHash
    ? await getLegalDocumentSnapshotByHash(row.evaluationContentHash)
    : undefined;

  const result = verifyLegalAcceptanceRecord(
    row,
    dpaSnap?.text ?? null,
    evalSnap?.text ?? null,
  );

  return {
    valid: result.valid,
    recordSealValid: result.recordSealValid,
    dpaHashValid: result.dpaHashValid,
    evaluationHashValid: result.evaluationHashValid,
    reasons: result.reasons,
    acceptanceId: row.id,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    evaluationPeriodDays: row.evaluationPeriodDays,
    feeEarnerCount: row.feeEarnerCount,
    dpaContentHash: row.dpaContentHash,
    evaluationContentHash: row.evaluationContentHash,
    // Non-sensitive only — firm/signer PII omitted from verify response body
    // (certificate page uses gated full fetch).
  };
}

export async function getDocumentsForAcceptance(row: LegalAgreementAcceptance): Promise<{
  dpa: { text: string; contentHash: string; documentSlug: LegalDocumentSlug } | null;
  evaluation: { text: string; contentHash: string; documentSlug: LegalDocumentSlug } | null;
}> {
  const dpaSnap = row.dpaContentHash
    ? await getLegalDocumentSnapshotByHash(row.dpaContentHash)
    : undefined;
  const evalSnap = row.evaluationContentHash
    ? await getLegalDocumentSnapshotByHash(row.evaluationContentHash)
    : undefined;

  return {
    dpa: dpaSnap
      ? {
          text: dpaSnap.text,
          contentHash: dpaSnap.contentHash,
          documentSlug: dpaSnap.documentSlug as LegalDocumentSlug,
        }
      : null,
    evaluation: evalSnap
      ? {
          text: evalSnap.text,
          contentHash: evalSnap.contentHash,
          documentSlug: evalSnap.documentSlug as LegalDocumentSlug,
        }
      : null,
  };
}
