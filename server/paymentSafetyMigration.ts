import { sql } from "drizzle-orm";
import { db } from "./db";

/** Payment safety: firm payment-fraud warning wording and Secure Message body on share links. */
export async function ensurePaymentSafetyColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE firm_profile
      ADD COLUMN IF NOT EXISTS payment_safety_notice text
    `);
    await db.execute(sql`
      ALTER TABLE share_links
      ADD COLUMN IF NOT EXISTS secure_message text
    `);
    console.log("[PAYMENT_SAFETY] Columns ready");
  } catch (error) {
    console.error("[PAYMENT_SAFETY] Failed to ensure columns:", error);
    throw error;
  }
}
