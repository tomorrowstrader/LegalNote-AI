/**
 * Create a test evaluation onboarding setup (or reuse latest acceptance) and email the link.
 * Usage: npx tsx scripts/send-evaluation-setup-preview.ts [email]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

const envPath = resolve(process.cwd(), ".env");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const eq = trimmed.indexOf("=");
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = val;
}

process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "ses";
process.env.APP_URL = process.env.APP_URL || "https://legalnote.ai";

const TO = process.argv[2] || "jazz.dennis@legalnote.ai";

async function main() {
  const { ensureEvaluationOnboardingSetupsTable } = await import(
    "../server/evaluationOnboardingMigration"
  );
  await ensureEvaluationOnboardingSetupsTable();

  const { db } = await import("../server/db");
  const { eq, desc } = await import("drizzle-orm");
  const { legalAgreementAcceptances, evaluationOnboardingSetups } = await import(
    "@shared/schema"
  );
  const { sendEvaluationSetupEmail } = await import("../server/email");

  const accepted = await db
    .select()
    .from(legalAgreementAcceptances)
    .where(eq(legalAgreementAcceptances.status, "accepted"))
    .orderBy(desc(legalAgreementAcceptances.acceptedAt))
    .limit(1);

  let acceptance = accepted[0];

  if (!acceptance) {
    console.log("[preview] No accepted row found — inserting a temporary accepted acceptance for preview.");
    const token = crypto.randomBytes(16).toString("hex");
    const [created] = await db
      .insert(legalAgreementAcceptances)
      .values({
        status: "accepted",
        confirmationToken: `preview-${token}`,
        confirmationExpiresAt: new Date(Date.now() + 86400000),
        confirmedAt: new Date(),
        acceptedAt: new Date(),
        firmName: "Acme Solicitors LLP (TEST)",
        signerName: "Jazz Dennis",
        signerTitle: "Managing Partner",
        email: TO,
        sraNumber: "123456",
        evaluationPeriodDays: 90,
        feeEarnerCount: 5,
        identityMethod: "email_confirmed",
        affirmativeAssent: true,
        dpaAccepted: true,
        evaluationAccepted: true,
        dpaContentHash:
          "4395fe00a6f056fe24591a43c7b9370d327350792949cd6e3aece1c2fa2ddcc2",
        evaluationContentHash:
          "0eb5eb8cc21558c3cbdb83ac7bab0698599a26565088c1b6a0cf44f3d7d3e017",
        verifyToken: `preview-verify-${token}`,
      })
      .returning();
    acceptance = created;
  }

  const setupToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  // Always mint a fresh pending setup for this preview so the link works.
  const [setup] = await db
    .insert(evaluationOnboardingSetups)
    .values({
      acceptanceId: acceptance.id,
      setupToken,
      status: "pending",
      expiresAt,
      firmName: acceptance.firmName,
      signerName: acceptance.signerName,
      signerEmail: TO,
      feeEarnerCount: acceptance.feeEarnerCount,
      evaluationPeriodDays: acceptance.evaluationPeriodDays,
      sraNumberFromAcceptance: acceptance.sraNumber,
    })
    .returning();

  const result = await sendEvaluationSetupEmail({
    to: TO,
    firmName: setup.firmName,
    signerName: setup.signerName,
    setupToken: setup.setupToken,
    feeEarnerCount: setup.feeEarnerCount,
    evaluationPeriodDays: setup.evaluationPeriodDays,
    expiresAt: setup.expiresAt,
  });

  const url = `${process.env.APP_URL}/evaluation/setup/${setup.setupToken}`;
  console.log("[preview] email:", result);
  console.log("[preview] setup URL (works after deploy, or against local server):");
  console.log(url);
  console.log("[preview] local URL:");
  console.log(`http://localhost:5000/evaluation/setup/${setup.setupToken}`);
}

main().catch((err) => {
  console.error("[preview] fatal:", err);
  process.exit(1);
});
