import { sql } from "drizzle-orm";
import { db } from "./db";

/** Governed evaluation configuration start date — required by firms queries after 61644f4. */
export async function ensureEvaluationStartsAtColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE firms
      ADD COLUMN IF NOT EXISTS evaluation_starts_at timestamp
    `);
    console.log("[EVAL_STARTS_AT] Column ready");
  } catch (error) {
    console.error("[EVAL_STARTS_AT] Failed to ensure column:", error);
    throw error;
  }
}
