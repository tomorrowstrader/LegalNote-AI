import { sql } from "drizzle-orm";
import { db } from "./db";

/** Client-facing meeting reminder dedupe columns on scheduled_meetings. */
export async function ensureScheduledMeetingClientReminderColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE scheduled_meetings
    ADD COLUMN IF NOT EXISTS client_reminder_30m_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS client_reminder_10m_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS client_reminder_start_sent_at timestamp
  `);
  console.log("[MIGRATION] scheduled_meetings client reminder columns ensured");
}
