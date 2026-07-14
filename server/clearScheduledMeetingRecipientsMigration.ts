import { or, isNotNull, eq } from "drizzle-orm";
import { db } from "./db";
import { scheduledMeetings } from "@shared/schema";

/** Clear scraped consent recipients and disarm auto-record (idempotent). */
export async function clearScheduledMeetingGuessedRecipients(): Promise<void> {
  const clearedRecipients = await db
    .update(scheduledMeetings)
    .set({ clientEmail: null, clientName: null })
    .where(
      or(
        isNotNull(scheduledMeetings.clientEmail),
        isNotNull(scheduledMeetings.clientName),
      ),
    )
    .returning({ id: scheduledMeetings.id });

  if (clearedRecipients.length > 0) {
    console.log(
      `[MIGRATION] Cleared guessed consent recipient on ${clearedRecipients.length} scheduled meeting(s)`,
    );
  }

  const disarmed = await db
    .update(scheduledMeetings)
    .set({ autoRecordEnabled: false })
    .where(eq(scheduledMeetings.autoRecordEnabled, true))
    .returning({ id: scheduledMeetings.id });

  if (disarmed.length > 0) {
    console.log(
      `[MIGRATION] Disarmed auto-record on ${disarmed.length} scheduled meeting(s)`,
    );
  }
}
