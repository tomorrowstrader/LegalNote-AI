import { sql } from "drizzle-orm";
import { db } from "./db";

/** Matter relationship and the per-meeting answer, used before a note is produced. */
export async function ensureInstructionStatusColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE cases
      ADD COLUMN IF NOT EXISTS instruction_status text NOT NULL DEFAULT 'instructed'
    `);
    await db.execute(sql`
      ALTER TABLE meeting_sessions
      ADD COLUMN IF NOT EXISTS instructions_taken boolean
    `);
    console.log("[INSTRUCTION_STATUS] Columns ready");
  } catch (error) {
    console.error("[INSTRUCTION_STATUS] Failed to ensure columns:", error);
  }
}
