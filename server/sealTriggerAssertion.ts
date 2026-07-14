import { sql } from "drizzle-orm";
import { db } from "./db";

/** Trigger names installed by scripts/seal-triggers.sql — must match exactly. */
export const SEAL_TRIGGER_NAMES = [
  "trg_audit_trail_seal_immutable",
  "trg_consent_logs_seal_immutable",
] as const;

/** Session GUC checked by seal triggers. Never set in application or production paths. */
export const SEAL_BYPASS_GUC = "legalnote.seal_bypass";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Test-only / cleanup bypass inside one transaction (safe with pooled connections).
 * Callers must use the provided `tx` for any UPDATE/DELETE of sealed tables.
 * Production application code must never call this.
 */
export async function withSealBypass<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('legalnote.seal_bypass', 'true', true)`);
    return fn(tx);
  });
}

/**
 * Production refuses to boot if seal triggers are missing or disabled.
 * drizzle-kit push does not know about these triggers and can drop them silently.
 */
export async function assertSealTriggersInstalled(): Promise<void> {
  const result = await db.execute(sql`
    SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname IN (
        'trg_audit_trail_seal_immutable',
        'trg_consent_logs_seal_immutable'
      )
  `);

  const rows = (result.rows ?? result) as Array<{
    table_name: string;
    trigger_name: string;
    enabled: string;
  }>;

  const byName = new Map(rows.map((r) => [r.trigger_name, r]));
  const missing: string[] = [];
  const disabled: string[] = [];

  for (const name of SEAL_TRIGGER_NAMES) {
    const row = byName.get(name);
    if (!row) {
      missing.push(name);
      continue;
    }
    // O = origin (normal enabled), A = always. D = disabled.
    if (row.enabled !== "O" && row.enabled !== "A") {
      disabled.push(`${name} (tgenabled=${row.enabled})`);
    }
  }

  if (missing.length === 0 && disabled.length === 0) {
    console.log("[SEAL] Seal triggers present and enabled ✓");
    return;
  }

  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`missing: ${missing.join(", ")}`);
  }
  if (disabled.length > 0) {
    parts.push(`disabled: ${disabled.join(", ")}`);
  }
  const message =
    `Seal triggers required but not healthy (${parts.join("; ")}). ` +
    `Run scripts/seal-triggers.sql against this database.`;

  if (isProduction()) {
    throw new Error(message);
  }
  console.warn(`[SEAL] ${message}`);
}
