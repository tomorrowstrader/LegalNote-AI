import { sql } from "drizzle-orm";
import { db } from "./db";

/** Firm-level Stripe billing columns for evaluation → paid conversion. */
export async function ensureFirmBillingColumns(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE firms
      ADD COLUMN IF NOT EXISTS stripe_customer_id varchar,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar,
      ADD COLUMN IF NOT EXISTS subscription_status varchar,
      ADD COLUMN IF NOT EXISTS subscription_plan varchar,
      ADD COLUMN IF NOT EXISTS subscription_seat_quantity integer,
      ADD COLUMN IF NOT EXISTS converted_at timestamp
    `);
    console.log("[FIRM_BILLING] Columns ready");
  } catch (error) {
    console.error("[FIRM_BILLING] Failed to ensure columns:", error);
    throw error;
  }
}
