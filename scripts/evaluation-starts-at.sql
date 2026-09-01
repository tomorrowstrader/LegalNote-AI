-- Governed evaluation configuration start date (admin-set; confirmed to firm in writing)
ALTER TABLE firms ADD COLUMN IF NOT EXISTS evaluation_starts_at timestamp;
