import { DEV_DATABASE_MARKER, readDatabaseMarker } from "./liveDatabaseGuard";

/**
 * Staging: the production build, run for QA testers against test-only services.
 *
 * Staging runs with NODE_ENV=production, so the local database guard does not apply to it.
 * This module is its replacement, and it works in both directions:
 *   - a server set to staging (LEGALNOTE_ENVIRONMENT=staging) refuses to start unless every
 *     setting it can check points away from live: the database marker, the web address,
 *     Stripe test keys, a staging storage bucket and no live document signing;
 *   - a production server that finds itself on the marked test database without staging mode
 *     also refuses, so a half-configured staging service can never behave like live
 *     (sending real emails, for example).
 */

export const STAGING_ENVIRONMENT = "staging";

/** Addresses that only the live service may use. */
export const LIVE_HOSTS = ["legalnote.ai", "www.legalnote.ai", "app.legalnote.ai"];

type Env = Record<string, string | undefined>;

export function isStaging(env: Env = process.env): boolean {
  return env.LEGALNOTE_ENVIRONMENT?.trim().toLowerCase() === STAGING_ENVIRONMENT;
}

function hostOf(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Every reason a staging server must not start. Empty means it may start.
 * `marker` is the database comment, read before anything else touches the database.
 */
export function stagingIsolationProblems(input: { env: Env; marker: string | null | undefined }): string[] {
  const { env, marker } = input;
  const problems: string[] = [];

  if (marker?.trim() !== DEV_DATABASE_MARKER) {
    problems.push(
      `DATABASE_URL is not a test database (its database comment must be '${DEV_DATABASE_MARKER}').`,
    );
  }

  const appHost = hostOf(env.APP_URL);
  if (!appHost) {
    problems.push("APP_URL must be set to the staging web address.");
  } else if (LIVE_HOSTS.includes(appHost)) {
    problems.push(`APP_URL points at the live address (${appHost}).`);
  }

  for (const name of ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"]) {
    const value = env[name]?.trim() ?? "";
    if (/^(sk|pk|rk)_live_/.test(value)) problems.push(`${name} is a live Stripe key; staging needs test-mode keys.`);
  }

  const bucket = env.BACKBLAZE_BUCKET_NAME?.trim() ?? "";
  if (bucket && !/staging/i.test(bucket)) {
    problems.push(`BACKBLAZE_BUCKET_NAME must be the staging bucket (its name must contain "staging"); got "${bucket}".`);
  }

  if (env.DPA_SIGNING_ENABLED === "true") {
    const base = env.DOCUSIGN_BASE_PATH?.trim() || "https://demo.docusign.net/restapi";
    if (!/demo\.docusign\.net/i.test(base)) {
      problems.push("DPA signing is on with a live DocuSign account; turn it off or use the DocuSign demo account.");
    }
  }

  if (env.SEAL_BYPASS_DATABASE_URL?.trim()) {
    problems.push("SEAL_BYPASS_DATABASE_URL must not be set on staging.");
  }

  return problems;
}

/** A production server on the test database without staging mode: half-configured staging. */
export function unmarkedStagingProblem(input: { env: Env; marker: string | null | undefined }): string | null {
  if (input.env.NODE_ENV !== "production" || isStaging(input.env)) return null;
  if (input.marker?.trim() !== DEV_DATABASE_MARKER) return null;
  return (
    "This production server is connected to a test database but LEGALNOTE_ENVIRONMENT is not 'staging'. " +
    "Set LEGALNOTE_ENVIRONMENT=staging so emails, SMS and the staging checks are switched on."
  );
}

/**
 * Runs at boot in production builds (live and staging). Live is only stopped if it is on the
 * test database; if the marker cannot be read there, live carries on as before.
 */
export async function assertStagingIsolation(): Promise<void> {
  if (process.env.NODE_ENV !== "production" && !isStaging()) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return; // Other startup checks report the missing setting.

  let marker: string | null = null;
  try {
    marker = await readDatabaseMarker(databaseUrl);
  } catch (error) {
    console.error("[STAGING GUARD] Could not check which database this is:", error instanceof Error ? error.message : error);
  }

  if (isStaging()) {
    const problems = stagingIsolationProblems({ env: process.env, marker });
    if (problems.length > 0) {
      console.error("[STAGING GUARD] Refusing to start staging. It must never touch live data or people:");
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log("[STAGING GUARD] Staging checks passed: test database, staging address, test keys.");
    return;
  }

  const problem = unmarkedStagingProblem({ env: process.env, marker });
  if (problem) {
    console.error(`[STAGING GUARD] ${problem}`);
    process.exit(1);
  }
}

/**
 * Outbound messages on staging. Nothing leaves unless the recipient is on STAGING_EMAIL_ALLOWLIST
 * (comma-separated addresses, or "@domain" for a whole domain). Off staging, everything passes.
 */
export function stagingAllowedRecipients(recipients: string[], env: Env = process.env): {
  allowed: string[];
  suppressed: string[];
} {
  if (!isStaging(env)) return { allowed: recipients, suppressed: [] };
  const entries = (env.STAGING_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const recipient of recipients) {
    const address = (recipient.match(/<([^>]+)>/)?.[1] ?? recipient).trim().toLowerCase();
    const domain = address.includes("@") ? address.slice(address.lastIndexOf("@")) : null;
    if (entries.includes(address) || (domain && entries.includes(domain))) allowed.push(recipient);
    else suppressed.push(recipient);
  }
  return { allowed, suppressed };
}

/** SMS never leaves staging: a phone number cannot be checked against a tester list reliably. */
export function stagingBlocksSms(env: Env = process.env): boolean {
  return isStaging(env);
}
