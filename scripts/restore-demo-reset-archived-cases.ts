/**
 * Restore real (non-demo) matters that "Reset Demo Data" archived.
 *
 * Before fix/demo-reset-scope, the demo reset/seed/clear archived EVERY active
 * case the user had created, not just demo matters. Nothing was deleted - this
 * script lists the archived cases that look like real matters and, only when
 * given an explicit list of IDs, un-archives them.
 *
 * A case is a candidate when it:
 *   - was created by the user,
 *   - is archived,
 *   - does NOT have a demo matter reference (HART_...),
 *   - was NOT archived deliberately (its latest manual archive audit entry,
 *     written by POST /api/cases/:id/archive, is not `archived: true`).
 *
 * Usage:
 *   # Dry run (default) - lists candidates, changes nothing
 *   npx tsx scripts/restore-demo-reset-archived-cases.ts --email jazz.dennis@legalnote.ai
 *
 *   # Restore exactly the IDs you approved from the dry-run list
 *   npx tsx scripts/restore-demo-reset-archived-cases.ts --email jazz.dennis@legalnote.ai --apply --ids id1,id2
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { auditTrail, cases, users } from "../shared/schema";

// Other known sample matters (not HART_). Flagged in the list so you can decide.
const KNOWN_SAMPLE_REFERENCES = new Set(["REE/FAM26-01188"]);

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const email = argValue(args, "--email");
  const apply = args.includes("--apply");
  const approvedIds = (argValue(args, "--ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!email) {
    console.error("--email is required");
    process.exit(1);
  }
  if (apply && approvedIds.length === 0) {
    console.error("--apply requires --ids <comma-separated case IDs from the dry-run list>");
    process.exit(1);
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const archived = await db
    .select({
      id: cases.id,
      title: cases.title,
      clientName: cases.clientName,
      matterReference: cases.matterReference,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .where(
      and(
        eq(cases.createdBy, user.id),
        eq(cases.archived, true),
        sql`(${cases.matterReference} IS NULL OR ${cases.matterReference} NOT LIKE 'HART\\_%')`,
      ),
    )
    .orderBy(cases.createdAt);

  // Latest manual archive/unarchive event per case (POST /api/cases/:id/archive).
  const manualEvents = archived.length
    ? await db
        .select({ caseId: auditTrail.caseId, metadata: auditTrail.metadata, timestamp: auditTrail.timestamp })
        .from(auditTrail)
        .where(
          and(
            inArray(auditTrail.caseId, archived.map((c) => c.id)),
            eq(auditTrail.eventType, "case_updated"),
            sql`${auditTrail.metadata}->>'action' = 'archive'`,
          ),
        )
        .orderBy(auditTrail.timestamp)
    : [];
  const latestManual = new Map<string, { archived: boolean; at: Date }>();
  for (const e of manualEvents) {
    if (!e.caseId) continue;
    latestManual.set(e.caseId, { archived: (e.metadata as any)?.archived === true, at: e.timestamp });
  }

  const candidates = archived.filter((c) => latestManual.get(c.id)?.archived !== true);
  const deliberatelyArchived = archived.filter((c) => latestManual.get(c.id)?.archived === true);

  console.log(`\nUser: ${email} (${user.id})`);
  console.log(`\nCANDIDATES TO RESTORE (${candidates.length}) - archived without a manual archive action:`);
  for (const c of candidates) {
    const flag = c.matterReference && KNOWN_SAMPLE_REFERENCES.has(c.matterReference) ? "  [SAMPLE MATTER]" : "";
    console.log(
      `  ${c.id}  | ${c.clientName ?? "-"} | ${c.title} | ref ${c.matterReference ?? "-"} | created ${c.createdAt.toISOString().slice(0, 10)}${flag}`,
    );
  }
  console.log(`\nLEFT ARCHIVED (${deliberatelyArchived.length}) - you archived these yourself:`);
  for (const c of deliberatelyArchived) {
    console.log(
      `  ${c.id}  | ${c.clientName ?? "-"} | ${c.title} | archived ${latestManual.get(c.id)!.at.toISOString().slice(0, 10)}`,
    );
  }

  if (!apply) {
    console.log(`\nDry run - nothing changed. To restore, re-run with --apply --ids <ids you approve>.`);
    process.exit(0);
  }

  const candidateIds = new Set(candidates.map((c) => c.id));
  const notCandidates = approvedIds.filter((id) => !candidateIds.has(id));
  if (notCandidates.length > 0) {
    console.error(`Refusing to apply - these IDs are not in the candidate list: ${notCandidates.join(", ")}`);
    process.exit(1);
  }

  const restored = await db
    .update(cases)
    .set({ archived: false })
    .where(and(inArray(cases.id, approvedIds), eq(cases.createdBy, user.id), eq(cases.archived, true)))
    .returning({ id: cases.id });

  for (const { id } of restored) {
    await storage.createAuditLog({
      eventType: "case_updated",
      userId: user.id,
      caseId: id,
      metadata: { action: "archive", archived: false, reason: "restore_after_demo_reset" },
      severity: "info",
    });
  }

  console.log(`\nRestored ${restored.length} case(s): ${restored.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
