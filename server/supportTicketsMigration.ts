import { sql } from "drizzle-orm";
import { db } from "./db";

/** Ensure support_tickets exists on deploy (idempotent). */
export async function ensureSupportTicketsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_ref text NOT NULL,
        user_id varchar NOT NULL REFERENCES users(id),
        firm_id varchar REFERENCES firms(id),
        case_id varchar REFERENCES cases(id),
        category text NOT NULL,
        severity text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        raw_transcript text,
        ai_summary text,
        status text NOT NULL DEFAULT 'open',
        screenshot_path text,
        context_metadata jsonb DEFAULT '{}'::jsonb,
        admin_notes text,
        resolved_at timestamp,
        resolved_by varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets(created_at DESC)
    `);
    console.log("[SUPPORT_TICKETS] Table ready");
  } catch (error) {
    console.error("[SUPPORT_TICKETS] Failed to ensure table:", error);
  }
}
