/**
 * Payment safety: the client-facing payment-fraud warning in client care letters and
 * the Secure Message channel for sensitive information such as payment details.
 *
 * The warning is firm-controlled text inserted word for word after generation. It is
 * never written or paraphrased by the model, so a fraud warning cannot drift, and it
 * records what the firm told the client rather than offering advice.
 */

export const PAYMENT_SAFETY_NOTICE_MAX_LENGTH = 2000;
export const SECURE_MESSAGE_MAX_LENGTH = 5000;

export const PAYMENT_SAFETY_HEADING = "Protecting Your Money from Fraud";

export function defaultPaymentSafetyNotice(firmName: string): string {
  const firm = firmName.trim() || "We";
  return [
    `${firm} will never tell you by email that our bank details have changed.`,
    "Before you send us any money, please call us on a telephone number you already know is ours, such as the number at the top of this letter, to confirm the account details. Do not use a telephone number or link given in an email asking you to pay.",
    "If you receive a message that appears to come from us saying our bank details have changed, do not act on it. Call us straight away.",
  ].join(" ");
}

/** The firm's own wording if set, otherwise the default. */
export function resolvePaymentSafetyNotice(firmNotice: string | null | undefined, firmName: string): string {
  const trimmed = firmNotice?.trim();
  return trimmed ? trimmed : defaultPaymentSafetyNotice(firmName);
}

const NEXT_STEPS_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:\d+\.\s*)?next steps\b/im;
const SIGN_OFF = /^\s*(?:\*\*)?\s*yours (?:sincerely|faithfully)\b/im;

/**
 * Insert the notice as its own section: before "Next Steps" when present, otherwise
 * before the sign-off, otherwise at the end. Idempotent: a letter that already carries
 * the section is returned unchanged.
 */
export function insertPaymentSafetySection(letter: string, notice: string): string {
  if (letter.includes(PAYMENT_SAFETY_HEADING)) return letter;
  const section = `**${PAYMENT_SAFETY_HEADING}**\n\n${notice.trim()}\n\n`;
  const anchor = letter.match(NEXT_STEPS_HEADING) ?? letter.match(SIGN_OFF);
  if (anchor && anchor.index !== undefined) {
    // Keep the anchor's own leading newline; insert at the start of its line.
    const lineStart = letter.lastIndexOf("\n", anchor.index) + 1;
    return letter.slice(0, lineStart) + section + letter.slice(lineStart);
  }
  return `${letter.trimEnd()}\n\n${section.trimEnd()}\n`;
}
