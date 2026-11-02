/**
 * Read-only: lists existing documents that would now be stopped before release.
 * Prints ids and issue types only, never note content. Nothing is changed, because a
 * filed note must be corrected by the responsible fee earner.
 *
 * Usage: npx tsx scripts/report-note-release-issues.ts
 */
import { db, pool } from "../server/db";
import { documents } from "../shared/schema";
import { findReleaseBlockers } from "../server/services/documentGovernanceGate";

async function main() {
  const rows = await db.select().from(documents);
  let affected = 0;
  for (const doc of rows) {
    const blockers = findReleaseBlockers(doc.content ?? "");
    if (blockers.length === 0) continue;
    affected += 1;
    console.log(JSON.stringify({ documentId: doc.id, caseId: doc.caseId, issues: Array.from(new Set(blockers.map((b) => b.type))) }));
  }
  console.log(`${affected} of ${rows.length} documents have an issue.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Report failed");
  process.exit(1);
});
