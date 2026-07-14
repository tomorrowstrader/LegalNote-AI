import { isNull } from "drizzle-orm";
import { db } from "./db";
import { consentLogs } from "@shared/schema";

/** Mark historic unsigned consent rows as pre_sealing (idempotent). */
export async function markPreSealingConsentLogs(): Promise<void> {
  const result = await db
    .update(consentLogs)
    .set({ sealingStatus: "pre_sealing" })
    .where(isNull(consentLogs.contentHash))
    .returning({ id: consentLogs.id });

  if (result.length > 0) {
    console.log(`[MIGRATION] Marked ${result.length} consent log(s) as pre_sealing`);
  }
}
