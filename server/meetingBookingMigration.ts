import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure meeting booking proposal tables exist when drizzle-kit push has not yet been run.
 * Safe to re-run.
 */
export async function ensureMeetingBookingTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meeting_booking_proposals (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        case_id varchar REFERENCES cases(id),
        token text NOT NULL UNIQUE,
        title text NOT NULL,
        description text,
        client_email text NOT NULL,
        client_name text,
        duration_minutes integer NOT NULL DEFAULT 30,
        calendar_provider text NOT NULL DEFAULT 'google',
        status text NOT NULL DEFAULT 'pending',
        selected_slot_id varchar,
        scheduled_meeting_id varchar REFERENCES scheduled_meetings(id),
        decline_note text,
        email_sent_at timestamp,
        email_status text NOT NULL DEFAULT 'pending',
        responded_at timestamp,
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meeting_booking_slots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_id varchar NOT NULL REFERENCES meeting_booking_proposals(id) ON DELETE CASCADE,
        starts_at timestamp NOT NULL,
        ends_at timestamp NOT NULL,
        status text NOT NULL DEFAULT 'available',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS meeting_booking_proposals_user_status_idx
      ON meeting_booking_proposals (user_id, status)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS meeting_booking_slots_proposal_idx
      ON meeting_booking_slots (proposal_id)
    `);

    console.log("[MEETING_BOOKING] Tables ready");
  } catch (error) {
    console.error("[MEETING_BOOKING] Failed to ensure tables:", error);
  }
}
