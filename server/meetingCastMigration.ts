import { sql } from "drizzle-orm";
import { db } from "./db";

/** Meeting cast on a session, used when the attendance note is written. */
export async function ensureMeetingCastColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE meeting_sessions
      ADD COLUMN IF NOT EXISTS meeting_cast jsonb
    `);
    console.log("[MEETING_CAST] Column ready");
  } catch (error) {
    console.error("[MEETING_CAST] Failed to ensure column:", error);
  }
}
