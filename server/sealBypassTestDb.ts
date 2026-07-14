/**
 * Test-only DB client for seal bypass (SEAL_BYPASS_DATABASE_URL).
 *
 * MUST only be imported by:
 *   - server/services/consentTamperGate.test.ts
 *   - server/upsertUserSignedIdRemap.test.ts
 *
 * Nothing else under server/ may import this module.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@shared/schema";
import { SEAL_BYPASS_DB_ROLE } from "./sealTriggerAssertion";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.SEAL_BYPASS_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SEAL_BYPASS_DATABASE_URL must be set for seal bypass tests " +
      `(role ${SEAL_BYPASS_DB_ROLE}). Never point DATABASE_URL at that role.`,
  );
}

export const sealBypassPool = new Pool({ connectionString });
export const sealBypassDb = drizzle({ client: sealBypassPool, schema });

/**
 * Run fn inside a transaction as the seal-bypass role with the bypass GUC set.
 * Application DATABASE_URL connections cannot use this effectively — the trigger
 * also requires current_user = legalnote_seal_bypass.
 */
export async function withSealBypass<T>(
  fn: (tx: Parameters<Parameters<typeof sealBypassDb.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return sealBypassDb.transaction(async (tx) => {
    const who = await tx.execute(sql`SELECT current_user AS role`);
    const rows = (who.rows ?? who) as Array<{ role: string }>;
    const role = rows[0]?.role;
    if (role !== SEAL_BYPASS_DB_ROLE) {
      throw new Error(
        `SEAL_BYPASS_DATABASE_URL must connect as ${SEAL_BYPASS_DB_ROLE} (got ${role ?? "unknown"}).`,
      );
    }
    await tx.execute(sql`SELECT set_config('legalnote.seal_bypass', 'true', true)`);
    return fn(tx);
  });
}
