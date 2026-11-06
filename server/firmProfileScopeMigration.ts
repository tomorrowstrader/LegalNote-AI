import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * firm_profile used to be one row shared by every firm. Give each row an owning firm
 * (firm_profile.firm_id, unique) and attach any unowned row to the firm of the person
 * who last saved it. Unowned rows that cannot be attached are left in place but are
 * never read, since every lookup now filters on firm_id.
 */
export async function ensureFirmProfileScopedToFirm(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE firm_profile
      ADD COLUMN IF NOT EXISTS firm_id varchar
    `);
    // Constraint names match what drizzle-kit generates, so a later db:push sees no diff.
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'firm_profile_firm_id_firms_id_fk') THEN
          ALTER TABLE firm_profile
          ADD CONSTRAINT firm_profile_firm_id_firms_id_fk FOREIGN KEY (firm_id) REFERENCES firms(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'firm_profile_firm_id_unique') THEN
          ALTER TABLE firm_profile
          ADD CONSTRAINT firm_profile_firm_id_unique UNIQUE (firm_id);
        END IF;
      END $$
    `);

    // Newest first, so if two unowned rows map to the same firm the latest save wins.
    const unowned = await db.execute(sql`
      SELECT fp.id, fp.firm_name, u.firm_id AS saver_firm_id, f.name AS saver_firm_name
      FROM firm_profile fp
      LEFT JOIN users u ON u.id = fp.updated_by
      LEFT JOIN firms f ON f.id = u.firm_id
      WHERE fp.firm_id IS NULL
      ORDER BY fp.updated_at DESC
    `);

    for (const row of unowned.rows as Array<{
      id: string;
      firm_name: string | null;
      saver_firm_id: string | null;
      saver_firm_name: string | null;
    }>) {
      if (!row.saver_firm_id) {
        console.warn(`[FIRM_PROFILE_SCOPE] Profile ${row.id} ("${row.firm_name}") has no saver firm; left unowned and unread`);
        continue;
      }
      const attached = await db.execute(sql`
        UPDATE firm_profile SET firm_id = ${row.saver_firm_id}
        WHERE id = ${row.id}
          AND firm_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM firm_profile WHERE firm_id = ${row.saver_firm_id})
      `);
      if (attached.rowCount) {
        console.log(`[FIRM_PROFILE_SCOPE] Attached profile ${row.id} ("${row.firm_name}") to firm ${row.saver_firm_id} ("${row.saver_firm_name}")`);
      } else {
        console.warn(`[FIRM_PROFILE_SCOPE] Firm ${row.saver_firm_id} already has a profile; profile ${row.id} ("${row.firm_name}") left unowned and unread`);
      }
    }

    console.log("[FIRM_PROFILE_SCOPE] Firm profiles scoped per firm");
  } catch (error) {
    console.error("[FIRM_PROFILE_SCOPE] Failed to scope firm profiles:", error);
    throw error;
  }
}
