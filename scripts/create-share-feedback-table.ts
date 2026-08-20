/**
 * One-shot: create share_feedback if missing.
 * Usage: npx tsx scripts/create-share-feedback-table.ts
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
    CREATE TABLE IF NOT EXISTS share_feedback (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      share_link_id varchar NOT NULL REFERENCES share_links(id),
      case_id varchar NOT NULL REFERENCES cases(id),
      document_id varchar REFERENCES documents(id),
      document_type text,
      recipient_name text,
      recipient_email text,
      category text NOT NULL DEFAULT 'correction',
      selected_text text,
      message text NOT NULL,
      resolved boolean NOT NULL DEFAULT false,
      resolved_at timestamp,
      resolved_by varchar REFERENCES users(id),
      ip_address text,
      user_agent text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS share_feedback_case_id_idx ON share_feedback(case_id);
    CREATE INDEX IF NOT EXISTS share_feedback_share_link_id_idx ON share_feedback(share_link_id);
  `);
  console.log("share_feedback ready");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
