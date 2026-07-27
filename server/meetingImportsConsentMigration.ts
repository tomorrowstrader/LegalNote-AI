import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure older databases have the consent-tracking columns now used by the
 * live Recall meeting workflow. Safe to re-run on every boot.
 */
export async function ensureMeetingImportsConsentColumns(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'meeting_imports'
        AND column_name IN (
          'consent_confirmed',
          'consent_mode',
          'consent_elapsed_seconds',
          'pre_consent_email_id',
          'recall_cost_usd'
        )
    `);

    const rows = (result.rows ?? result) as Array<{ column_name: string }>;
    const existing = new Set(rows.map((row) => row.column_name));

    if (!existing.has("consent_confirmed")) {
      await db.execute(sql`
        ALTER TABLE meeting_imports
        ADD COLUMN consent_confirmed boolean NOT NULL DEFAULT false
      `);
    }

    if (!existing.has("consent_mode")) {
      await db.execute(sql`
        ALTER TABLE meeting_imports
        ADD COLUMN consent_mode text NOT NULL DEFAULT 'pre_confirmed'
      `);
    }

    if (!existing.has("consent_elapsed_seconds")) {
      await db.execute(sql`
        ALTER TABLE meeting_imports
        ADD COLUMN consent_elapsed_seconds integer
      `);
    }

    if (!existing.has("pre_consent_email_id")) {
      await db.execute(sql`
        ALTER TABLE meeting_imports
        ADD COLUMN pre_consent_email_id varchar
      `);
    }

    if (!existing.has("recall_cost_usd")) {
      await db.execute(sql`
        ALTER TABLE meeting_imports
        ADD COLUMN recall_cost_usd text
      `);
    }

    await db.execute(sql`
      UPDATE meeting_imports
      SET consent_mode = 'pre_confirmed'
      WHERE consent_mode IS NULL
    `);

    console.log("[MEETING_IMPORTS_MIGRATION] Consent columns verified");
  } catch (error) {
    console.error("[MEETING_IMPORTS_MIGRATION] Error ensuring meeting_imports consent columns:", error);
  }
}
