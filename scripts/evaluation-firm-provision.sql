-- Evaluation firm provisioning columns (admin pre-provision for governed onboarding)
ALTER TABLE firms ADD COLUMN IF NOT EXISTS seat_limit integer;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS is_evaluation boolean NOT NULL DEFAULT false;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS provisioned_lead_email text;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS provisioned_lead_user_id varchar;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS provisioned_by_user_id varchar;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS provisioned_at timestamp;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS evaluation_ends_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS firms_provisioned_lead_email_unique
  ON firms (lower(provisioned_lead_email))
  WHERE provisioned_lead_email IS NOT NULL AND provisioned_lead_user_id IS NULL;
