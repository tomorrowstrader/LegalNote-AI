/**
 * One-shot: create product_insights if missing (Moment A/B).
 * Usage: npx tsx scripts/create-product-insights-table.ts
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
    CREATE TABLE IF NOT EXISTS product_insights (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id),
      firm_id varchar REFERENCES firms(id),
      case_id varchar REFERENCES cases(id),
      event_type text NOT NULL,
      accuracy text,
      speed text,
      comment text,
      meeting_duration_seconds integer,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  console.log("product_insights ready");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
