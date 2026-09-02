import { sql } from "drizzle-orm";
import { db } from "./db";

/** Outbound admin emails queued for future delivery (evaluation confirmations, etc.). */
export async function ensureScheduledEmailsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        email_type text NOT NULL,
        firm_id varchar NOT NULL REFERENCES firms(id),
        to_email text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        send_at timestamptz NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        sent_at timestamp,
        last_error text,
        created_by varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS scheduled_emails_pending_send_at_idx
      ON scheduled_emails (send_at)
      WHERE status = 'pending'
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS scheduled_emails_firm_pending_idx
      ON scheduled_emails (firm_id)
      WHERE status = 'pending'
    `);
    await db.execute(sql`
      ALTER TABLE scheduled_emails
      ALTER COLUMN send_at TYPE timestamptz
      USING send_at AT TIME ZONE 'UTC'
    `).catch(() => {});
    console.log("[SCHEDULED_EMAILS] Table ready");
  } catch (error) {
    console.error("[SCHEDULED_EMAILS] Failed to ensure table:", error);
    throw error;
  }
}
