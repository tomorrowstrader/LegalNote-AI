/**
 * Attendee helpers for calendar-synced meetings. Pure so both the sync job and
 * the Edit Meeting dialog share one definition of who can be asked for consent.
 */

export type CalendarAttendee = {
  email: string;
  name?: string;
  responseStatus?: string;
  /** Set when this person organised an invitation the user received. */
  organizer?: boolean;
};

export type CalendarOrganizer = {
  email?: string | null;
  name?: string | null;
  /** True when the connected calendar's own user organised the event. */
  self?: boolean | null;
};

/** Google shared calendars organise events under an address nobody reads. */
const NON_PERSON_ORGANIZER = /@(group|resource)\.calendar\.google\.com$/i;

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Calendars can leave the organiser off the attendee list, which would stop them
 * being chosen as the consent recipient. Add them and flag them. Events the user
 * organised stay unflagged, which is how a received invitation is told apart.
 */
export function withCalendarOrganizer(
  attendees: CalendarAttendee[],
  organizer: CalendarOrganizer | null | undefined,
): CalendarAttendee[] {
  const email = organizer?.email?.trim();
  if (!email || organizer?.self || NON_PERSON_ORGANIZER.test(email)) {
    return attendees;
  }

  const target = normalise(email);
  if (attendees.some((a) => normalise(a.email) === target)) {
    return attendees.map((a) =>
      normalise(a.email) === target ? { ...a, organizer: true } : a,
    );
  }

  return [
    { email, ...(organizer?.name ? { name: organizer.name } : {}), organizer: true },
    ...attendees,
  ];
}

function readAttendees(value: unknown): CalendarAttendee[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is CalendarAttendee =>
      typeof a === "object" && a !== null && typeof (a as CalendarAttendee).email === "string",
  );
}

/** True when someone else organised this meeting and the user was invited. */
export function isReceivedCalendarMeeting(attendees: unknown): boolean {
  return readAttendees(attendees).some((a) => a.organizer === true);
}

/** People the user can ask for consent: organiser first, without duplicates or the user. */
export function consentRecipientOptions(
  attendees: unknown,
  ownEmail?: string | null,
): CalendarAttendee[] {
  const own = ownEmail ? normalise(ownEmail) : null;
  const seen = new Set<string>();
  const options: CalendarAttendee[] = [];

  for (const attendee of readAttendees(attendees)) {
    const key = normalise(attendee.email);
    if (!key || key === own || seen.has(key)) continue;
    seen.add(key);
    options.push(attendee);
  }

  return options.sort((a, b) => Number(b.organizer === true) - Number(a.organizer === true));
}

/** Calendars often use the address as the display name, sometimes in quotes. */
export function attendeeDisplayName(name: string | null | undefined): string | undefined {
  const cleaned = name?.trim().replace(/^['"]+|['"]+$/g, "").trim();
  return cleaned && !cleaned.includes("@") ? cleaned : undefined;
}

type ConsentEmailRef = {
  recipientEmail: string;
  meetingUrl: string | null;
  scheduledMeetingTime: Date | string | null;
  consentResponseStatus: string;
  emailStatus: string;
};

/** A meeting can have one consent email per person, linked by its join link and start time. */
export function consentEmailsForMeeting<T extends ConsentEmailRef>(
  emails: T[],
  meeting: { meetingUrl: string | null; startTime: Date | string },
): T[] {
  if (!meeting.meetingUrl) return [];
  const start = new Date(meeting.startTime).getTime();
  return emails.filter(
    (e) =>
      e.meetingUrl === meeting.meetingUrl &&
      e.scheduledMeetingTime != null &&
      new Date(e.scheduledMeetingTime).getTime() === start,
  );
}

/**
 * One person can't agree for everyone: the meeting is approved only when everyone
 * asked has agreed, and any refusal stops the recording for that meeting.
 */
export function meetingConsentStatus(
  emails: Array<Pick<ConsentEmailRef, "consentResponseStatus" | "emailStatus">>,
): "approved" | "declined" | "sent" {
  const delivered = emails.filter((e) => e.emailStatus !== "failed");
  if (delivered.some((e) => !["awaiting", "granted"].includes(e.consentResponseStatus))) {
    return "declined";
  }
  return delivered.length > 0 && delivered.every((e) => e.consentResponseStatus === "granted")
    ? "approved"
    : "sent";
}
