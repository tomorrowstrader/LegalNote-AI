import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure cases.matter_kind exists for internal / firm (non-client) matters.
 * Safe to re-run.
 */
export async function ensureMatterKindColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE cases
      ADD COLUMN IF NOT EXISTS matter_kind text NOT NULL DEFAULT 'client'
    `);
    console.log("[MATTER_KIND] Column ready");
  } catch (error) {
    console.error("[MATTER_KIND] Failed to ensure column:", error);
  }
}
