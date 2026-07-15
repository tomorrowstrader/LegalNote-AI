-- Meeting reminder dedupe timestamps (30m / 10m solicitor alerts).
-- Required after deploy of meeting-reminder support; without these columns
-- GET /api/scheduled-meetings fails because Drizzle SELECTs every schema column.

ALTER TABLE scheduled_meetings
  ADD COLUMN IF NOT EXISTS reminder_30m_sent_at timestamp;

ALTER TABLE scheduled_meetings
  ADD COLUMN IF NOT EXISTS reminder_10m_sent_at timestamp;
