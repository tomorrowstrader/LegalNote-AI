-- Seal-bypass test role grants.
-- Preferred: create role "legalnote_seal_bypass" (LOGIN) in the Neon console, set a password,
-- then run this script as the table owner.
--
-- Do NOT use this role for application DATABASE_URL.
-- Do NOT GRANT legalnote_seal_bypass TO the application role (SET ROLE would defeat the gate).
--
-- Tests only: set SEAL_BYPASS_DATABASE_URL to a connection string as this role.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legalnote_seal_bypass') THEN
    -- Password must be set before connecting (Neon console or ALTER ROLE ... PASSWORD).
    CREATE ROLE legalnote_seal_bypass NOINHERIT LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO legalnote_seal_bypass;

-- Minimal DML for consentTamperGate.test.ts and upsertUserSignedIdRemap.test.ts only.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  users,
  cases,
  audio_recordings,
  consent_logs,
  audit_trail
TO legalnote_seal_bypass;

COMMIT;
