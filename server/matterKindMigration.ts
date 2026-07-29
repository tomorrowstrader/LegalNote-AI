import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure cases.matter_kind / has_external_attendees exist.
 * Collapses legacy `firm` into `internal`. Safe to re-run.
 */
export async function ensureMatterKindColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE cases
      ADD COLUMN IF NOT EXISTS matter_kind text NOT NULL DEFAULT 'client'
    `);
    await db.execute(sql`
      UPDATE cases
      SET matter_kind = 'internal'
      WHERE matter_kind = 'firm'
    `);
    await db.execute(sql`
      ALTER TABLE cases
      ADD COLUMN IF NOT EXISTS has_external_attendees boolean NOT NULL DEFAULT false
    `);
    console.log("[MATTER_KIND] Column ready (firm→internal, has_external_attendees)");
  } catch (error) {
    console.error("[MATTER_KIND] Failed to ensure column:", error);
  }
}
