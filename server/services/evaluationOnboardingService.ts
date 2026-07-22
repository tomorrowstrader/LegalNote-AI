import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  evaluationOnboardingSetups,
  type EvaluationOnboardingSetup,
  type EvaluationOnboardingSubmit,
  type LegalAgreementAcceptance,
} from "@shared/schema";

const SETUP_TOKEN_BYTES = 32;
const SETUP_VALIDITY_DAYS = 14;

export class EvaluationOnboardingError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "EvaluationOnboardingError";
  }
}

function clientMeta(req: { ip?: string; headers?: Record<string, unknown> }) {
  const ua = req.headers?.["user-agent"];
  return {
    ip: typeof req.ip === "string" ? req.ip : null,
    userAgent: typeof ua === "string" ? ua.slice(0, 500) : null,
  };
}

export async function createEvaluationOnboardingSetup(
  acceptance: LegalAgreementAcceptance,
): Promise<EvaluationOnboardingSetup> {
  const existing = await db
    .select()
    .from(evaluationOnboardingSetups)
    .where(eq(evaluationOnboardingSetups.acceptanceId, acceptance.id))
    .limit(1);

  if (existing[0] && existing[0].status === "pending") {
    return existing[0];
  }
  if (existing[0] && existing[0].status === "submitted") {
    return existing[0];
  }

  const setupToken = crypto.randomBytes(SETUP_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SETUP_VALIDITY_DAYS);

  const [row] = await db
    .insert(evaluationOnboardingSetups)
    .values({
      acceptanceId: acceptance.id,
      setupToken,
      status: "pending",
      expiresAt,
      firmName: acceptance.firmName,
      signerName: acceptance.signerName,
      signerEmail: acceptance.email,
      feeEarnerCount: acceptance.feeEarnerCount,
      evaluationPeriodDays: acceptance.evaluationPeriodDays,
      sraNumberFromAcceptance: acceptance.sraNumber,
    })
    .returning();

  return row;
}

export async function getSetupByToken(token: string): Promise<EvaluationOnboardingSetup> {
  const [row] = await db
    .select()
    .from(evaluationOnboardingSetups)
    .where(eq(evaluationOnboardingSetups.setupToken, token))
    .limit(1);

  if (!row) {
    throw new EvaluationOnboardingError(404, "NOT_FOUND", "Setup link not found.");
  }

  if (row.status === "expired" || (row.status === "pending" && row.expiresAt < new Date())) {
    if (row.status === "pending") {
      await db
        .update(evaluationOnboardingSetups)
        .set({ status: "expired" })
        .where(eq(evaluationOnboardingSetups.id, row.id));
    }
    throw new EvaluationOnboardingError(410, "EXPIRED", "This setup link has expired.");
  }

  return row;
}

export function toPublicSetupPayload(row: EvaluationOnboardingSetup) {
  return {
    status: row.status,
    firmName: row.firmName,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    feeEarnerCount: row.feeEarnerCount,
    evaluationPeriodDays: row.evaluationPeriodDays,
    sraNumberFromAcceptance: row.sraNumberFromAcceptance,
    expiresAt: row.expiresAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}

export async function submitEvaluationOnboardingSetup(opts: {
  token: string;
  body: EvaluationOnboardingSubmit;
  req: { ip?: string; headers?: Record<string, unknown> };
}): Promise<EvaluationOnboardingSetup> {
  const row = await getSetupByToken(opts.token);

  if (row.status === "submitted") {
    throw new EvaluationOnboardingError(
      409,
      "ALREADY_SUBMITTED",
      "Setup details have already been submitted for this evaluation.",
    );
  }

  if (opts.body.feeEarners.length > row.feeEarnerCount) {
    throw new EvaluationOnboardingError(
      400,
      "TOO_MANY_FEE_EARNERS",
      `You may nominate up to ${row.feeEarnerCount} fee earners under the signed Key Terms.`,
    );
  }

  const meta = clientMeta(opts.req);
  const operationalSameAsOwner = opts.body.operationalSameAsOwner;

  const [updated] = await db
    .update(evaluationOnboardingSetups)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      submitIpAddress: meta.ip,
      submitUserAgent: meta.userAgent,
      onboardingOwnerName: opts.body.onboardingOwnerName,
      onboardingOwnerEmail: opts.body.onboardingOwnerEmail,
      onboardingOwnerPhone: opts.body.onboardingOwnerPhone,
      operationalSameAsOwner,
      operationalContactName: operationalSameAsOwner
        ? opts.body.onboardingOwnerName
        : opts.body.operationalContactName ?? null,
      operationalContactEmail: operationalSameAsOwner
        ? opts.body.onboardingOwnerEmail
        : opts.body.operationalContactEmail ?? null,
      dpContactName: opts.body.dpContactName,
      dpContactEmail: opts.body.dpContactEmail,
      dpContactRole: opts.body.dpContactRole,
      firmLegalName: opts.body.firmLegalName,
      companiesHouseNumber: opts.body.companiesHouseNumber,
      sraNumber: opts.body.sraNumber,
      feeEarners: opts.body.feeEarners,
      primaryAdminName: opts.body.primaryAdminName,
      primaryAdminEmail: opts.body.primaryAdminEmail,
      preferredGoLive: opts.body.preferredGoLive,
      authGoogle: opts.body.authGoogle,
      authMicrosoft: opts.body.authMicrosoft,
      practiceAreas: opts.body.practiceAreas ?? null,
      meetingTypes: opts.body.meetingTypes ?? [],
      letterheadPhone: opts.body.letterheadPhone ?? null,
      letterheadEmail: opts.body.letterheadEmail ?? null,
      letterheadAddress: opts.body.letterheadAddress ?? null,
      firstUseAttendeeName: opts.body.firstUseAttendeeName ?? null,
      firstUseCalendarPreference: opts.body.firstUseCalendarPreference ?? null,
      internalChecksConfirmed: true,
    })
    .where(eq(evaluationOnboardingSetups.id, row.id))
    .returning();

  return updated;
}
