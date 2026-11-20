import { sql } from "drizzle-orm";
import { db } from "./db";
import { MOVED_STATUS } from "./services/chunkedUploadService";

/**
 * Recordings moved off a recovered case before moves were marked kept the "recovered"
 * status, so the matter they were moved to showed the "recovered into its own case" card.
 * Marks them as moved. Idempotent; only rows whose move is in the audit trail change.
 */
export async function markMovedRecoveredRecordings(): Promise<void> {
  try {
    const result = await db.execute(sql`
      UPDATE recording_sessions rs
      SET status = ${MOVED_STATUS}
      WHERE rs.status = 'recovered'
        AND EXISTS (
          SELECT 1 FROM audit_trail a
          WHERE a.event_type = 'recovered_recording_moved'
            AND a.metadata->>'direction' = 'in'
            AND a.case_id = rs.case_id
        )
      RETURNING rs.id
    `);
    const count = result.rows.length;
    console.log(count
      ? `[RECOVERED_MOVES] Marked ${count} moved recording(s) so their matters no longer show as recovered`
      : "[RECOVERED_MOVES] Nothing to mark");
  } catch (error) {
    console.error("[RECOVERED_MOVES] Could not mark moved recordings:", error);
  }
}
