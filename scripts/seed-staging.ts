/**
 * Staging (or the local test database) only. Puts testers into a test firm and gives each one
 * a complete sample matter, so a QA tester has realistic, entirely fictional data from day one.
 *
 * Each tester signs in to staging once with Google first (that creates their user), then:
 *
 *   npx tsx scripts/seed-staging.ts --emails lead@example.com,qa@example.com[,third@example.com]
 *       [--other-firm-email second-account@example.com]
 *
 * Roles, in the order given: 1st managing partner (firm admin, COLP, MLRO), 2nd solicitor, 3rd paralegal,
 * any more solicitor. --other-firm-email puts one account in a second firm, to test that one firm
 * can never see another's data.
 *
 * Refuses to run unless the database carries the test-database marker. Needs the staging
 * AUDIT_SIGNING_KEY (run it inside the staging environment) so the audit chain it writes verifies.
 * Safe to run again: the firms are reused, and each tester's old sample matter is archived and replaced.
 */
import "../server/loadEnv";
import { eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import { firms, users } from "@shared/schema";
import { DEV_DATABASE_MARKER, readDatabaseMarker } from "../server/liveDatabaseGuard";
import { seedReeveSampleMatter } from "../server/services/seedReeveSampleMatter";

const TEST_FIRM = { name: "Staging Test Firm LLP (fictional)", sraNumber: "000000", city: "Testford", postcode: "TE1 1ST" };
const OTHER_FIRM = { name: "Second Test Firm (fictional)", sraNumber: "000001", city: "Testford", postcode: "TE2 2ND" };

const ROLES: Array<{ primaryRole: string; role: string; designations: string[] }> = [
  { primaryRole: "managing_partner", role: "partner", designations: ["is_firm_admin", "is_colp", "is_mlro"] },
  { primaryRole: "solicitor", role: "solicitor", designations: [] },
  { primaryRole: "paralegal", role: "solicitor", designations: [] },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function findOrCreateFirm(details: typeof TEST_FIRM): Promise<string> {
  const [existing] = await db.select({ id: firms.id }).from(firms).where(eq(firms.name, details.name)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(firms).values({ ...details, country: "United Kingdom" }).returning({ id: firms.id });
  return created.id;
}

async function placeUser(email: string, firmId: string, slot: (typeof ROLES)[number]) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  if (!user) throw new Error(`No user for ${email}. Sign in to staging with that Google account once, then run this again.`);
  await db
    .update(users)
    .set({
      firmId,
      primaryRole: slot.primaryRole,
      role: slot.role,
      regulatoryDesignations: slot.designations,
      inviteStatus: "active",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  const seeded = await seedReeveSampleMatter({ userId: user.id });
  console.log(`${email}: ${slot.primaryRole} at firm ${firmId}; sample matter: ${seeded.success ? "ready" : seeded.message}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const marker = await readDatabaseMarker(process.env.DATABASE_URL);
  if (marker?.trim() !== DEV_DATABASE_MARKER) {
    throw new Error(`Refusing to seed: this is not a test database (its comment must be '${DEV_DATABASE_MARKER}').`);
  }
  if (!process.env.AUDIT_SIGNING_KEY) {
    throw new Error("AUDIT_SIGNING_KEY is not set. Run this inside the staging environment so the audit chain verifies.");
  }

  const emails = (arg("--emails") ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) throw new Error("Usage: npx tsx scripts/seed-staging.ts --emails a@example.com,b@example.com");

  const firmId = await findOrCreateFirm(TEST_FIRM);
  for (const [i, email] of emails.entries()) {
    await placeUser(email, firmId, ROLES[i] ?? ROLES[1]);
  }

  const otherEmail = arg("--other-firm-email");
  if (otherEmail) {
    const otherFirmId = await findOrCreateFirm(OTHER_FIRM);
    await placeUser(otherEmail, otherFirmId, ROLES[0]);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
