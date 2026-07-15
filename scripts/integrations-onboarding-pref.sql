-- First-login integrations onboarding flag (run manually on Neon before/after deploy).
-- Replays until the user finishes the calendar + video + meeting sync wizard.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS completed_integrations_onboarding boolean NOT NULL DEFAULT false;

-- Existing accounts should not be forced through the new wizard.
UPDATE user_preferences
SET completed_integrations_onboarding = true
WHERE completed_integrations_onboarding = false;
