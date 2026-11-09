import { sql } from "drizzle-orm";
import { db } from "./db";

/** Meeting type chosen on an upcoming meeting, used for the bot recording's session. */
export async function ensureScheduledMeetingRecordingTypeColumn(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE scheduled_meetings
      ADD COLUMN IF NOT EXISTS recording_type text
    `);
    console.log("[SCHEDULED_MEETING_RECORDING_TYPE] Column ready");
  } catch (error) {
    console.error("[SCHEDULED_MEETING_RECORDING_TYPE] Failed to ensure column:", error);
  }
}
