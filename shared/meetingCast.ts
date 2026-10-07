/**
 * Who was in the meeting, supplied before an attendance note is written.
 * A default cast (the fee earner advised, the matter client was present)
 * leaves the derivation prompt unchanged.
 */
export interface MeetingCast {
  /** False when someone other than the fee earner gave the advice. */
  adviserIsFeeEarner: boolean;
  /** Name of the adviser when the fee earner did not give the advice. */
  adviserName: string;
  /** Overrides the matter client for this meeting. Empty uses the matter client. */
  clientName: string;
  clientPresent: boolean;
  /** Who attended for the client when the client was not there. */
  representativeName: string;
  /** Anyone else whose presence the note should record. */
  attendees: string;
}

export function emptyMeetingCast(): MeetingCast {
  return {
    adviserIsFeeEarner: true,
    adviserName: "",
    clientName: "",
    clientPresent: true,
    representativeName: "",
    attendees: "",
  };
}

function asTrimmed(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseMeetingCast(value: unknown): MeetingCast | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    adviserIsFeeEarner: raw.adviserIsFeeEarner !== false,
    adviserName: asTrimmed(raw.adviserName, 200),
    clientName: asTrimmed(raw.clientName, 200),
    clientPresent: raw.clientPresent !== false,
    representativeName: asTrimmed(raw.representativeName, 200),
    attendees: asTrimmed(raw.attendees, 500),
  };
}

export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function meetingCastError(cast: MeetingCast): string | null {
  if (!cast.adviserIsFeeEarner && !cast.adviserName.trim()) {
    return "Name the person who gave the advice.";
  }
  if (!cast.clientPresent && !cast.representativeName.trim()) {
    return "Name who attended for the client.";
  }
  return null;
}

/** True when the cast would not change how the note is written. */
export function meetingCastIsDefault(
  cast: MeetingCast | null | undefined,
  matterClientName?: string,
): boolean {
  if (!cast) return true;
  const clientOverride =
    cast.clientName.trim().length > 0 &&
    normalizePersonName(cast.clientName) !== normalizePersonName(matterClientName ?? "");
  const adviserIsSomeoneElse = !cast.adviserIsFeeEarner;
  return (
    !adviserIsSomeoneElse &&
    !clientOverride &&
    cast.clientPresent &&
    !cast.representativeName.trim() &&
    !cast.attendees.trim()
  );
}

export function clientNameForNote(
  matterClientName: string,
  cast: MeetingCast | null | undefined,
): string {
  const override = cast?.clientName?.trim() ?? "";
  if (!override) return matterClientName;
  if (normalizePersonName(override) === normalizePersonName(matterClientName)) {
    return matterClientName;
  }
  return override;
}

/**
 * Accept a cast from an API body. A default cast is stored as null so an
 * untouched meeting keeps the existing derivation prompt.
 */
export function normalizeMeetingCastInput(
  value: unknown,
): { ok: true; cast: MeetingCast | null } | { ok: false; message: string } {
  if (value == null) return { ok: true, cast: null };
  const cast = parseMeetingCast(value);
  if (!cast) return { ok: false, message: "The meeting cast is not valid." };
  const error = meetingCastError(cast);
  if (error) return { ok: false, message: error };
  if (meetingCastIsDefault(cast)) return { ok: true, cast: null };
  return { ok: true, cast };
}

export function attendanceFeeEarnerLead(
  feeEarnerName: string | undefined,
  cast: MeetingCast | null | undefined,
  matterClientName?: string,
): string {
  const name = feeEarnerName?.trim() || "the fee earner";
  if (meetingCastIsDefault(cast, matterClientName)) {
    return `YOU ARE THE FEE EARNER. You were present at this meeting. Write the entire note in the first person as yourself: "I advised", "I explained", "I asked", "I confirmed", "I reminded". NEVER refer to yourself in the third person. Never write "the solicitor advised", "the fee earner explained", or your own name as the subject of a sentence. Your name is ${name}; it appears in the header, never in the body as a third party. Refer to the client as "the client". Use the client's name only where necessary to disambiguate. If the conversation shows that the other person attended for someone who was not there, or that instructions have not been taken, follow READ THE CONVERSATION — WHO WAS THERE instead of treating that person as the client.`;
  }
  return `A meeting cast appears at the end of these instructions. It states who gave the advice and who the client is, and it prevails over every instruction to write "I advised" and over every instruction to treat the other speaker as the client. The fee earner preparing this note is ${name}. That name appears in the header. Do not assume the fee earner gave the advice, and do not treat the fee earner as the client.`;
}

export function attendanceSpeakerAttribution(
  cast: MeetingCast | null | undefined,
  matterClientName?: string,
): string {
  if (meetingCastIsDefault(cast, matterClientName)) {
    return "- You are the fee earner who was present. Treat the other party as the client unless the conversation shows they attended for someone who was not there, or that instructions have not been taken";
  }
  return "- Attribute each speaker from the meeting cast at the end of these instructions. Do not treat the fee earner as the client. Do not treat the person who attended for the client as the client.";
}

/**
 * Used only when the fee earner has not set a meeting cast.
 * The conversation can show a preliminary enquiry, or that the speaker
 * attended for someone who was not in the room. An ordinary client
 * meeting is unchanged.
 */
export function attendanceTranscriptPresenceRule(
  cast: MeetingCast | null | undefined,
  matterClientName?: string,
  options?: { instructionsTaken?: boolean | null },
): string {
  if (!meetingCastIsDefault(cast, matterClientName)) return "";
  if (options?.instructionsTaken === false) return "";
  if (options?.instructionsTaken === true) {
    return [
      "READ THE CONVERSATION — WHO WAS THERE",
      "",
      "The firm has been instructed. Do not describe this meeting as a preliminary enquiry, and do not call the client the prospective client.",
      "",
      "Write the usual note unless the conversation itself shows that someone attended for a person who was not in the meeting. Do not infer that from silence, from a file name, or from the header.",
      "",
      "Someone attended for a person who was not in the meeting. The conversation says so: they were speaking on that person's behalf, that person was absent, or they are a partner, relative, or other representative rather than the client.",
      "- The absent person is the client.",
      "- The person who attended is not the client. Do not write their words as the client speaking.",
      "- State once, near the start of MATTERS DISCUSSED, that the client was not present, who attended, and in what capacity.",
      "- Record what the attendee said as their account. Do not record it as the client's instructions.",
      "",
      "When that situation applies, it prevails over an instruction to treat the other speaker as the client and over an example that says \"I advised the client\" or \"The client stated\".",
    ].join("\n");
  }
  return [
    "READ THE CONVERSATION — WHO WAS THERE",
    "",
    "Write the usual note unless the conversation itself establishes one of the two situations below. Do not infer either from silence, from a file name, or from the header. If neither is established, do not mention them, and follow the examples that say \"I advised the client\" and \"The client stated\".",
    "",
    "Someone attended for a person who was not in the meeting. The conversation says so: they were speaking on that person's behalf, that person was absent, or they are a partner, relative, or other representative rather than the client.",
    "- The absent person is the client. If the conversation also shows that instructions have not been taken, they are the prospective client.",
    "- The person who attended is not the client. Do not write their words as the client speaking.",
    "- State once, near the start of MATTERS DISCUSSED, that the client was not present, who attended, and in what capacity.",
    "- Record what the attendee said as their account. Do not record it as the client's instructions.",
    "",
    "The discussion is preliminary. The conversation shows that instructions have not been taken, or that the firm has not been retained.",
    "- Say that once, near the start.",
    "- The person the discussion concerns is the prospective client.",
    "- Any advice is preliminary and was given on the attendee's account. Nothing is to be done until that person has been spoken to and instructions have been received from them.",
    "",
    "When either situation applies, it prevails over an instruction to treat the other speaker as the client and over an example that says \"I advised the client\" or \"The client stated\".",
  ].join("\n");
}

export function formatMeetingCastInstructions(
  cast: MeetingCast | null | undefined,
  options: { feeEarnerName?: string; matterClientName?: string },
): string {
  if (!cast || meetingCastIsDefault(cast, options.matterClientName)) return "";

  const feeEarner = options.feeEarnerName?.trim() || "the fee earner";
  const client = cast.clientName.trim() || options.matterClientName?.trim() || "the client";
  const adviser = cast.adviserIsFeeEarner
    ? feeEarner
    : cast.adviserName.trim();

  const lines = [
    "MEETING CAST",
    "",
    "The fee earner supplied this cast before the note was written. It prevails over any earlier instruction about who gave the advice and who the client is, including any instruction to write \"I advised\" or to treat the other speaker as the client. Where a format example says \"I advised\", follow this cast instead.",
    "",
    `Fee earner preparing the note: ${feeEarner}`,
    `Adviser: ${adviser}`,
    `Client: ${client}`,
    `Client present at the meeting: ${cast.clientPresent ? "yes" : "no"}`,
  ];

  if (!cast.clientPresent) {
    lines.push(`Attended for the client: ${cast.representativeName.trim()}`);
  }
  if (cast.attendees.trim()) {
    lines.push(`Also present: ${cast.attendees.trim()}`);
  }

  lines.push(
    "",
    `The client is ${client}. Do not treat ${feeEarner} as the client.`,
  );

  if (!cast.clientPresent) {
    lines.push(
      `${cast.representativeName.trim()} attended for the client. Record what they said as the representative's account. Do not write it as the client speaking, and do not treat the representative as the client.`,
    );
  }

  if (cast.adviserIsFeeEarner) {
    lines.push(
      `The fee earner gave the advice. Write that advice in the first person ("I advised").`,
    );
  } else {
    lines.push(
      `${adviser} gave the advice. Attribute that advice to ${adviser} by name ("${adviser} advised"). Do not write it as "I advised". The header still names ${feeEarner} as the fee earner who prepared the note.`,
    );
    if (!cast.clientPresent) {
      lines.push(
        `${feeEarner}'s own contributions, if ${feeEarner} is also ${cast.representativeName.trim()}, are the representative's account of the client's position, not the advice.`,
      );
    }
  }

  if (!cast.clientPresent) {
    lines.push(
      "State once, near the start of the note, that the client was not present.",
    );
  }

  return lines.join("\n");
}
