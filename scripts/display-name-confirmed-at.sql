-- Display name confirmation lock (run manually on Neon before/after deploy).
-- Once set, OAuth logins must not overwrite first_name / last_name; changes need an admin.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name_confirmed_at timestamp;
