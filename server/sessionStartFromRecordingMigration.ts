import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";

/** A finalised upload belongs to the audio row created just before it. */
const UPLOAD_MATCH_WINDOW_MINUTES = 10;
/**
 * Only re-date a session filed well after its meeting ended. Older rows can carry an
 * hour of difference between columns written by the database and by the app in summer
 * time, so small gaps are not trusted. A meeting filed after a later meeting is always
 * further out than this.
 */
const LATE_FILING_MARGIN_HOURS = 2;

interface Corrected {
  session_id: string;
  case_id: string;
  created_by: string;
  audio_id: string;
  source: string;
  previous_started_at: string;
  started_at: string;
}

/**
 * Sessions filed some time after their meeting were dated by filing time, so they were
 * numbered out of order. Re-date them from when the recording began. Idempotent: a
 * session only ever moves earlier, and each change is written to the audit trail.
 *
 * Two server-held sources are used:
 * - the audio's own recorded time (recovered recordings, video);
 * - the Quick Record upload finalised into the audio, when exactly one upload by the same
 *   person finished within minutes of the audio row being created.
 *
 * Only sessions filed more than the recording's length plus two hours after it began are
 * touched. The update runs inside the database, so times never pass through the Node
 * clock, which reads summer-time values inconsistently on a UK machine.
 */
export async function dateSessionsFromRecordings(): Promise<void> {
  try {
    const result = await db.execute(sql`
      WITH candidates AS (
        SELECT ms.id AS session_id, ar.id AS audio_id, ar.recorded_at AS recording_start,
               'audio_recorded_time' AS source
        FROM meeting_sessions ms
        JOIN audio_recordings ar ON ar.meeting_session_id = ms.id
        WHERE ar.recorded_at < ms.started_at
              - make_interval(secs => COALESCE(ar.duration, ms.duration_seconds, 0))
              - make_interval(hours => ${LATE_FILING_MARGIN_HOURS})
        UNION ALL
        SELECT ms.id, ar.id, rs.started_at, 'chunked_upload'
        FROM meeting_sessions ms
        JOIN audio_recordings ar ON ar.meeting_session_id = ms.id
        JOIN recording_sessions rs
          ON rs.user_id = ms.created_by
         AND rs.status = 'completed'
         AND rs.completed_at BETWEEN ar.recorded_at
                                 AND ar.recorded_at + make_interval(mins => ${UPLOAD_MATCH_WINDOW_MINUTES})
        WHERE rs.started_at < ms.started_at
              - make_interval(secs => COALESCE(ar.duration, ms.duration_seconds, 0))
              - make_interval(hours => ${LATE_FILING_MARGIN_HOURS})
          AND (
            SELECT count(*) FROM recording_sessions rs2
            WHERE rs2.user_id = ms.created_by
              AND rs2.status = 'completed'
              AND rs2.completed_at BETWEEN ar.recorded_at
                                       AND ar.recorded_at + make_interval(mins => ${UPLOAD_MATCH_WINDOW_MINUTES})
          ) = 1
      ),
      earliest AS (
        SELECT DISTINCT ON (session_id) session_id, audio_id, recording_start, source
        FROM candidates
        ORDER BY session_id, recording_start
      ),
      before AS (
        SELECT ms.id, ms.started_at AS previous_started_at
        FROM meeting_sessions ms JOIN earliest e ON e.session_id = ms.id
      ),
      updated_audio AS (
        UPDATE audio_recordings ar
        SET recorded_at = e.recording_start
        FROM earliest e
        WHERE ar.id = e.audio_id AND e.recording_start < ar.recorded_at
        RETURNING ar.id
      )
      UPDATE meeting_sessions ms
      SET started_at = e.recording_start
      FROM earliest e, before b
      WHERE ms.id = e.session_id AND b.id = ms.id AND e.recording_start < ms.started_at
      RETURNING ms.id AS session_id, ms.case_id, ms.created_by, e.audio_id, e.source,
                to_char(b.previous_started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS previous_started_at,
                to_char(ms.started_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at
    `);

    const rows = result.rows as unknown as Corrected[];
    if (rows.length === 0) {
      console.log("[SESSION_DATES] All sessions already dated from their recordings");
      return;
    }

    for (const row of rows) {
      await storage.createAuditLog({
        eventType: "session_dated_from_recording",
        userId: row.created_by,
        caseId: row.case_id,
        metadata: {
          sessionId: row.session_id,
          audioRecordingId: row.audio_id,
          previousStartedAt: row.previous_started_at,
          startedAt: row.started_at,
          source: row.source,
          correction: "startup",
        },
        severity: "info",
      });
    }
    console.log(`[SESSION_DATES] Re-dated ${rows.length} session(s) from when their recordings began`);
  } catch (error) {
    // Never block startup over ordering; the next boot retries.
    console.error("[SESSION_DATES] Could not re-date sessions:", error);
  }
}
