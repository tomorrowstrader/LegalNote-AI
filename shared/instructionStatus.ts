/**
 * Whether the firm has been instructed on a client matter.
 * Existing matters stay instructed. A new matter opens as an enquiry until
 * the fee earner says instructions have been received.
 */

export type InstructionStatus = "enquiry" | "instructed";

export function parseInstructionStatus(value: unknown): InstructionStatus {
  return value === "enquiry" ? "enquiry" : "instructed";
}

/**
 * A session answer wins. With no answer, an enquiry matter is not instructed
 * and an instructed matter is.
 */
export function resolveInstructionsTaken(
  matterStatus: InstructionStatus,
  sessionOverride: boolean | null | undefined,
): boolean {
  if (typeof sessionOverride === "boolean") return sessionOverride;
  return matterStatus === "instructed";
}

/** Appended to the attendance-note prompt when this meeting is still an enquiry. */
export function attendanceEnquiryRule(instructionsTaken: boolean | null | undefined): string {
  if (instructionsTaken !== false) return "";
  return [
    "THE FIRM HAS NOT BEEN INSTRUCTED",
    "",
    "The fee earner has confirmed that this meeting is an enquiry and that instructions have not been taken. This prevails over every instruction to treat the other speaker as the client, over every example that says \"I advised the client\" or \"The client stated\", and over a meeting cast that calls them the client.",
    "",
    "- The person this meeting concerns is the prospective client. Refer to them as \"the prospective client\".",
    "- Say once, near the start of MATTERS DISCUSSED, that they are the prospective client and that instructions have not been taken.",
    "- Any advice is preliminary and was given on the account actually heard. Nothing is to be done until that person has been spoken to and instructions have been received from them.",
    "- If someone attended for them, that person is not the prospective client. Record what they said as their account, not as instructions.",
    "- Do not write the note as though the firm has been retained.",
  ].join("\n");
}
