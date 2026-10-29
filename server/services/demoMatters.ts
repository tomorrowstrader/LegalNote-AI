import { and, eq, not, sql } from "drizzle-orm";
import { cases } from "../../shared/schema";

/**
 * Every seeded demo matter uses a matter reference starting "HART_". This is
 * the only marker that separates demo matters from a user's real matters, so
 * every archive/lookup of demo data MUST be scoped by it. The underscore is
 * escaped because "_" is a single-character wildcard in LIKE.
 */
export const DEMO_MATTER_REFERENCE_PREFIX = "HART_";

// COALESCE keeps this strictly true/false: a NULL reference must never make the
// negated filter below evaluate to NULL and silently hide a real matter.
export const isDemoMatter = sql`COALESCE(${cases.matterReference}, '') LIKE ${DEMO_MATTER_REFERENCE_PREFIX.replace(/_/g, "\\_") + "%"}`;

/**
 * Demo reset archives the previous demo set rather than deleting it (sealed
 * audit/consent rows reference those cases). Those superseded copies are hidden
 * from case lists so a reset looks like a clean return to the original demo.
 */
export const isNotSupersededDemoMatter = not(and(eq(cases.archived, true), isDemoMatter)!);

export function isSupersededDemoMatter(c: { archived: boolean; matterReference: string | null }): boolean {
  return c.archived && !!c.matterReference?.startsWith(DEMO_MATTER_REFERENCE_PREFIX);
}
