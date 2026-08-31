/**
 * One-shot: create support_tickets if missing.
 * Usage: npx tsx scripts/create-support-tickets-table.ts
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function loadLocalEnv(): void {
  const envPath = join(SCRIPT_DIR, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
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
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets(created_at DESC);
  `);
  console.log("support_tickets ready");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
