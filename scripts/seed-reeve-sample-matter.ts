/**
 * Seed the Reeve family sample matter into a user account.
 *
 * Usage:
 *   npx tsx scripts/seed-reeve-sample-matter.ts
 *   npx tsx scripts/seed-reeve-sample-matter.ts --email jazz.dennis@legalnote.ai
 *   npx tsx scripts/seed-reeve-sample-matter.ts --email someone@example.com
 */
import { seedReeveSampleMatter } from "../server/services/seedReeveSampleMatter";

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const email =
    emailIdx >= 0 && args[emailIdx + 1]
      ? args[emailIdx + 1]
      : "jazz.dennis@legalnote.ai";

  console.log(`[seed-reeve] Seeding Reeve sample matter for ${email}...`);
  const result = await seedReeveSampleMatter({ userEmail: email });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
