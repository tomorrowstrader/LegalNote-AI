import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure transcript_imports exists when drizzle-kit push has not yet been run.
 * Safe to re-run.
 */
export async function ensureTranscriptImportsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transcript_imports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        case_id varchar NOT NULL REFERENCES cases(id),
        meeting_session_id varchar REFERENCES meeting_sessions(id),
        transcript_id varchar REFERENCES transcripts(id),
        source text NOT NULL DEFAULT 'paste',
        original_filename text,
        mime_type text,
        byte_size integer,
        source_content_hash text,
        character_count integer,
        speaker_count integer,
        recording_type text NOT NULL DEFAULT 'full_meeting',
        session_title text,
        meeting_at timestamp,
        duration_seconds integer,
        generate_client_letter boolean NOT NULL DEFAULT true,
        authority_attested boolean NOT NULL DEFAULT false,
        authority_attested_at timestamp,
        status text NOT NULL DEFAULT 'pending',
        error_message text,
        job_id text,
        created_at timestamp NOT NULL DEFAULT now(),
        completed_at timestamp
      )
    `);
    console.log("[TRANSCRIPT_IMPORTS] Table ready");
  } catch (error) {
    console.error("[TRANSCRIPT_IMPORTS] Failed to ensure table:", error);
  }
}
