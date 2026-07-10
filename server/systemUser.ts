import { db } from "./db";
import { users } from "@shared/schema";

export const SYSTEM_USER_ID = "system";

/**
 * Ensures the sentinel system user exists for automated audit events.
 * Idempotent — safe to call on every startup.
 */
export async function ensureSystemUser(): Promise<void> {
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      firstName: "System",
      email: null,
      role: "solicitor",
    })
    .onConflictDoNothing({ target: users.id });

  console.log("[SYSTEM_USER] Sentinel system user ensured");
}
