/**
 * Preview the governed evaluation confirmation email.
 * Usage: npx tsx scripts/send-evaluation-confirmation-preview.ts [email]
 */
import { readFileSync } from "fs";
import { resolve } from "path";

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
  const { sendGovernedEvaluationConfirmedEmail } = await import("../server/email");

  console.log(`[preview] provider=${process.env.EMAIL_PROVIDER} to=${TO}`);

  const result = await sendGovernedEvaluationConfirmedEmail({
    to: TO,
    firmName: "Penn Chambers",
    evaluationStartsAt: new Date("2026-09-01T00:00:00.000Z"),
    evaluationEndsAt: new Date("2026-09-22T23:59:59.000Z"),
  });

  console.log("[preview] evaluation confirmation:", result);
  if (!result.success) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[preview] fatal:", err);
  process.exit(1);
});
