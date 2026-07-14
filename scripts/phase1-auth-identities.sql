-- Phase 1: auth_identities
-- Run by hand against the production Neon branch. Do NOT use drizzle-kit push --force.
-- Does not alter users.id. Backfills existing Google subjects (users.id = Google sub today).

BEGIN;

CREATE TABLE IF NOT EXISTS auth_identities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email_at_link text,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT auth_identities_provider_provider_user_id_unique UNIQUE (provider, provider_user_id),
  CONSTRAINT auth_identities_user_id_provider_unique UNIQUE (user_id, provider)
);

-- Existing users: Google subject was stored as users.id. Link without renumbering.
-- Exclude synthetic system user — it never authenticated with Google.
INSERT INTO auth_identities (user_id, provider, provider_user_id, email_at_link)
SELECT u.id, 'google', u.id, u.email
FROM users u
WHERE u.id <> 'system'
  AND NOT EXISTS (
  SELECT 1
  FROM auth_identities ai
  WHERE ai.provider = 'google'
    AND ai.provider_user_id = u.id
);

COMMIT;
