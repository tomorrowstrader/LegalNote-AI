import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Ensure evaluation_onboarding_setups exists when drizzle-kit push has not yet been run.
 * Safe to re-run.
 */
export async function ensureEvaluationOnboardingSetupsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS evaluation_onboarding_setups (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        acceptance_id varchar NOT NULL REFERENCES legal_agreement_acceptances(id),
        setup_token text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamp NOT NULL,
        firm_name text NOT NULL,
        signer_name text NOT NULL,
        signer_email text NOT NULL,
        fee_earner_count integer NOT NULL,
        evaluation_period_days integer NOT NULL,
        sra_number_from_acceptance text,
        onboarding_owner_name text,
        onboarding_owner_email text,
        onboarding_owner_phone text,
        operational_same_as_owner boolean,
        operational_contact_name text,
        operational_contact_email text,
        dp_contact_name text,
        dp_contact_email text,
        dp_contact_role text,
        firm_legal_name text,
        companies_house_number text,
        sra_number text,
        fee_earners jsonb,
        primary_admin_name text,
        primary_admin_email text,
        preferred_go_live text,
        auth_google boolean,
        auth_microsoft boolean,
        practice_areas text,
        meeting_types jsonb,
        letterhead_phone text,
        letterhead_email text,
        letterhead_address text,
        first_use_attendee_name text,
        first_use_calendar_preference text,
        internal_checks_confirmed boolean,
        submitted_at timestamp,
        submit_ip_address text,
        submit_user_agent text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("[EVAL_ONBOARDING] Table ready");
  } catch (error) {
    console.error("[EVAL_ONBOARDING] Failed to ensure table:", error);
  }
}
