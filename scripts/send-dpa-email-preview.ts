/**
 * One-off: send branded DPA confirmation + certificate preview emails.
 * Usage: npx tsx scripts/send-dpa-email-preview.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env before importing email (provider is read at module init).
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

// Prefer SES locally — RESEND_API_KEY in .env is not a real key.
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "ses";
process.env.APP_URL = process.env.APP_URL || "https://legalnote.ai";

const TO = process.argv[2] || "jazz.dennis@legalnote.ai";

async function main() {
  const { sendDpaConfirmationEmail, sendLegalAgreementAcceptedEmail } =
    await import("../server/email");

  console.log(`[preview] provider=${process.env.EMAIL_PROVIDER} to=${TO}`);

  const confirm = await sendDpaConfirmationEmail({
    to: TO,
    firmName: "Acme Solicitors LLP (TEST)",
    signerName: "Jazz Dennis",
    confirmationToken: "preview-token-not-valid",
    evaluationPeriodDays: 90,
    feeEarnerCount: 5,
  });
  console.log("[preview] confirmation:", confirm);

  const accepted = await sendLegalAgreementAcceptedEmail({
    to: TO,
    firmName: "Acme Solicitors LLP (TEST)",
    signerName: "Jazz Dennis",
    signerTitle: "Managing Partner",
    evaluationPeriodDays: 90,
    feeEarnerCount: 5,
    acceptedAt: new Date(),
    acceptanceId: "00000000-0000-4000-8000-000000000001",
    dpaContentHash:
      "4395fe00a6f056fe24591a43c7b9370d327350792949cd6e3aece1c2fa2ddcc2",
    evaluationContentHash:
      "0eb5eb8cc21558c3cbdb83ac7bab0698599a26565088c1b6a0cf44f3d7d3e017",
    verifyToken: "preview-verify-token-not-valid",
  });
  console.log("[preview] certificate:", accepted);

  if (!confirm.success || !accepted.success) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[preview] fatal:", err);
  process.exit(1);
});
