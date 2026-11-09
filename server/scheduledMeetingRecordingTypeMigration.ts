import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Meeting type chosen on an upcoming meeting (used for the bot recording's session),
 * and the consent script shown for a bot recording (sealed with matching wording).
 */
export async function ensureScheduledMeetingRecordingTypeColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE scheduled_meetings
      ADD COLUMN IF NOT EXISTS recording_type text
    `);
    await db.execute(sql`
      ALTER TABLE meeting_imports
      ADD COLUMN IF NOT EXISTS consent_script text
    `);
    console.log("[MEETING_TYPE_COLUMNS] Columns ready");
  } catch (error) {
    console.error("[MEETING_TYPE_COLUMNS] Failed to ensure columns:", error);
  }
}
