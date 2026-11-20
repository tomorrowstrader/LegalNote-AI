// Read-only check of one case's recovered-recording state. Prints ids, statuses and
// dates only: no titles, names, transcripts or document text. Runs in a READ ONLY
// transaction, so it cannot change anything.
// Usage: railway run node scripts/inspect-recovered-case.cjs <caseId>
const { Client } = require("pg");

const caseId = process.argv[2];
if (!caseId) {
  console.error("Usage: node scripts/inspect-recovered-case.cjs <caseId>");
  process.exit(1);
}

const short = (id) => (id ? String(id).slice(0, 8) : null);
const iso = (d) => (d ? new Date(d).toISOString().replace(".000Z", "Z") : null);

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN READ ONLY");
    await c.query("SET LOCAL TimeZone = 'UTC'");

    const cs = await c.query(
      `SELECT id, status, source_type, archived, litigation_hold, created_at,
              (title LIKE 'Recovered Recording%') AS is_recovered_case
       FROM cases WHERE id = $1`, [caseId]);
    console.log("CASE", cs.rows.map((r) => ({
      id: short(r.id), status: r.status, sourceType: r.source_type, archived: r.archived,
      litigationHold: r.litigation_hold, createdAt: iso(r.created_at), isRecoveredCase: r.is_recovered_case,
    })));

    const rs = await c.query(
      `SELECT id, status, started_at, completed_at, recovered_at
       FROM recording_sessions WHERE case_id = $1 ORDER BY started_at`, [caseId]);
    console.log("UPLOAD SESSIONS LINKED TO THIS CASE", rs.rows.map((r) => ({
      id: short(r.id), status: r.status, startedAt: iso(r.started_at),
      completedAt: iso(r.completed_at), recoveredAt: iso(r.recovered_at),
    })));

    const ms = await c.query(
      `SELECT id, status, started_at, recording_type
       FROM meeting_sessions WHERE case_id = $1 ORDER BY started_at`, [caseId]);
    console.log("MEETING SESSIONS (in number order)", ms.rows.map((r, i) => ({
      number: i + 1, id: short(r.id), status: r.status, recordingType: r.recording_type,
      startedAt: iso(r.started_at),
    })));

    const ar = await c.query(
      `SELECT id, meeting_session_id, recorded_at, expires_at, deleted_at,
              duration, (file_path IS NOT NULL) AS has_file
       FROM audio_recordings WHERE case_id = $1 ORDER BY recorded_at`, [caseId]);
    console.log("AUDIO RECORDINGS (oldest recorded first)", ar.rows.map((r) => ({
      id: short(r.id), session: short(r.meeting_session_id), recordedAt: iso(r.recorded_at),
      expiresAt: iso(r.expires_at), deletedAt: iso(r.deleted_at),
      durationMin: r.duration ? Math.round(r.duration / 60) : null, hasFile: r.has_file,
    })));

    const au = await c.query(
      `SELECT event_type, "timestamp" AS created_at, metadata
       FROM audit_trail
       WHERE case_id = $1
         AND event_type IN ('recording_recovered','recovered_recording_moved','session_dated_from_recording',
                            'audio_deleted','audio_permanently_deleted')
       ORDER BY "timestamp"`, [caseId]);
    console.log("RELEVANT AUDIT EVENTS", au.rows.map((r) => ({
      event: r.event_type, at: iso(r.created_at),
      sessionId: short(r.metadata?.sessionId), audioRecordingId: short(r.metadata?.audioRecordingId),
      fromCase: short(r.metadata?.fromCaseId), toCase: short(r.metadata?.toCaseId), direction: r.metadata?.direction ?? null,
      previousStartedAt: r.metadata?.previousStartedAt ?? null, startedAt: r.metadata?.startedAt ?? null,
    })));

    const types = await c.query(
      `SELECT event_type, count(*)::int AS n FROM audit_trail WHERE case_id = $1
       GROUP BY event_type ORDER BY n DESC`, [caseId]);
    console.log("ALL AUDIT EVENT TYPES ON THIS CASE", Object.fromEntries(types.rows.map((r) => [r.event_type, r.n])));

    const corr = await c.query(
      `SELECT count(*)::int AS n, min("timestamp") AS first
       FROM audit_trail WHERE event_type = 'session_dated_from_recording'`);
    console.log("SESSION RE-DATING ACROSS ALL CASES", { entries: corr.rows[0].n, first: iso(corr.rows[0].first) });

    await c.query("ROLLBACK");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
