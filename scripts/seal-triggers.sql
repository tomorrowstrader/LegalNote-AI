-- Seal triggers: make signed tables append-only at the database.
-- Run by hand against production Neon, then local-dev. Do NOT rely on drizzle-kit push.
--
-- Prerequisites: create role legalnote_seal_bypass first (see scripts/seal-bypass-role.sql).
-- Bypass (tests only): GUC legalnote.seal_bypass = true AND current_user = legalnote_seal_bypass.
-- Application DATABASE_URL must never use that role. Do not GRANT it to the app role.

BEGIN;

-- ─── Row-level: UPDATE / DELETE ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION legalnote_audit_trail_seal_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('legalnote.seal_bypass', true) = 'true'
     AND current_user = 'legalnote_seal_bypass' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'audit_trail is sealed (append-only): % is not permitted',
    TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE OR REPLACE FUNCTION legalnote_consent_logs_seal_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('legalnote.seal_bypass', true) = 'true'
     AND current_user = 'legalnote_seal_bypass' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'consent_logs is sealed: DELETE is not permitted'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Block everything; only withdrawal columns may change.
  -- New columns are automatically protected (jsonb row minus exceptions).
  IF (
    to_jsonb(NEW) - ARRAY[
      'consent_withdrawn',
      'withdrawal_timestamp',
      'withdrawal_reason',
      'withdrawn_by'
    ]
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY[
      'consent_withdrawn',
      'withdrawal_timestamp',
      'withdrawal_reason',
      'withdrawn_by'
    ]
  ) THEN
    RAISE EXCEPTION
      'consent_logs is sealed: only withdrawal columns may be updated'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_trail_seal_immutable ON audit_trail;
CREATE TRIGGER trg_audit_trail_seal_immutable
  BEFORE UPDATE OR DELETE ON audit_trail
  FOR EACH ROW
  EXECUTE FUNCTION legalnote_audit_trail_seal_guard();

DROP TRIGGER IF EXISTS trg_consent_logs_seal_immutable ON consent_logs;
CREATE TRIGGER trg_consent_logs_seal_immutable
  BEFORE UPDATE OR DELETE ON consent_logs
  FOR EACH ROW
  EXECUTE FUNCTION legalnote_consent_logs_seal_guard();

-- ─── Statement-level: TRUNCATE (incl. TRUNCATE … CASCADE from parents) ─────

CREATE OR REPLACE FUNCTION legalnote_sealed_table_truncate_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('legalnote.seal_bypass', true) = 'true'
     AND current_user = 'legalnote_seal_bypass' THEN
    RETURN NULL;
  END IF;

  RAISE EXCEPTION
    '% is sealed: TRUNCATE is not permitted',
    TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_trail_seal_truncate ON audit_trail;
CREATE TRIGGER trg_audit_trail_seal_truncate
  BEFORE TRUNCATE ON audit_trail
  FOR EACH STATEMENT
  EXECUTE FUNCTION legalnote_sealed_table_truncate_guard();

DROP TRIGGER IF EXISTS trg_consent_logs_seal_truncate ON consent_logs;
CREATE TRIGGER trg_consent_logs_seal_truncate
  BEFORE TRUNCATE ON consent_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION legalnote_sealed_table_truncate_guard();

COMMIT;
