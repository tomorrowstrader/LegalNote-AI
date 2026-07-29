/** Canonical GDPR consent disclaimer shown to solicitors and stored in consent logs. */
export const CONSENT_DISCLAIMER_TEXT =
  "I'm recording this meeting to create accurate attendance notes and evidence proper client care. The audio stays confidential in your case file only, used by me or my direct team if needed, and is retained for 7 days, then deleted. Do you consent?";

/** Version identifier for the canonical disclaimer wording (bump when text changes). */
export const CONSENT_DISCLAIMER_VERSION = "v1.1";

/**
 * Participant notice for non-client meetings with people outside the firm
 * (BD, chambers, vendors, etc.) — not the client-care attendance-note script.
 */
export const PARTICIPANT_CONSENT_DISCLAIMER_TEXT =
  "I'd like to record this meeting to produce accurate minutes and action points for our records. The recording is stored securely and deleted after 7 days. Are you happy for me to proceed?";

export const PARTICIPANT_CONSENT_DISCLAIMER_VERSION = "participant-v1.0";
