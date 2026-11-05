import { describe, expect, it } from "vitest";
import {
  attendeeDisplayName,
  consentEmailsForMeeting,
  consentRecipientOptions,
  isReceivedCalendarMeeting,
  meetingConsentStatus,
  withCalendarOrganizer,
} from "./meetingAttendees";

describe("withCalendarOrganizer", () => {
  const guest = { email: "guest@example.com", name: "Guest" };

  it("adds an organiser missing from the attendee list", () => {
    expect(
      withCalendarOrganizer([guest], { email: "host@example.com", name: "Host" }),
    ).toEqual([{ email: "host@example.com", name: "Host", organizer: true }, guest]);
  });

  it("flags an organiser already listed, ignoring case", () => {
    expect(withCalendarOrganizer([guest], { email: "GUEST@example.com" })).toEqual([
      { ...guest, organizer: true },
    ]);
  });

  it("leaves events the user organised unflagged", () => {
    expect(withCalendarOrganizer([guest], { email: "me@example.com", self: true })).toEqual([guest]);
  });

  it("ignores missing organisers and shared calendar addresses", () => {
    expect(withCalendarOrganizer([guest], null)).toEqual([guest]);
    expect(withCalendarOrganizer([guest], { email: "abc@group.calendar.google.com" })).toEqual([guest]);
  });
});

describe("isReceivedCalendarMeeting", () => {
  it("is true only when an organiser was flagged", () => {
    expect(isReceivedCalendarMeeting([{ email: "a@example.com", organizer: true }])).toBe(true);
    expect(isReceivedCalendarMeeting([{ email: "a@example.com" }])).toBe(false);
    expect(isReceivedCalendarMeeting(null)).toBe(false);
  });
});

describe("consentRecipientOptions", () => {
  it("puts the organiser first and removes the user and duplicates", () => {
    const options = consentRecipientOptions(
      [
        { email: "me@example.com" },
        { email: "guest@example.com" },
        { email: "GUEST@example.com" },
        { email: "host@example.com", organizer: true },
      ],
      "ME@example.com",
    );
    expect(options.map((o) => o.email)).toEqual(["host@example.com", "guest@example.com"]);
  });

  it("handles stored values that are not attendee lists", () => {
    expect(consentRecipientOptions(undefined)).toEqual([]);
    expect(consentRecipientOptions([null, "x", {}])).toEqual([]);
  });
});

describe("attendeeDisplayName", () => {
  it("drops names that are really email addresses, quoted or not", () => {
    expect(attendeeDisplayName("'person@example.com'")).toBeUndefined();
    expect(attendeeDisplayName("person@example.com")).toBeUndefined();
    expect(attendeeDisplayName(null)).toBeUndefined();
  });

  it("keeps real names", () => {
    expect(attendeeDisplayName(" 'Test Person' ")).toBe("Test Person");
  });
});

describe("consentEmailsForMeeting", () => {
  const start = "2026-11-05T15:00:00.000Z";
  const email = (meetingUrl: string | null, scheduledMeetingTime: string | null) => ({
    recipientEmail: "a@example.com",
    meetingUrl,
    scheduledMeetingTime,
    consentResponseStatus: "awaiting",
    emailStatus: "sent",
  });

  it("matches on join link and start time", () => {
    const match = email("https://link", start);
    const emails = [match, email("https://other", start), email("https://link", "2026-11-06T15:00:00.000Z")];
    expect(consentEmailsForMeeting(emails, { meetingUrl: "https://link", startTime: new Date(start) })).toEqual([match]);
  });

  it("finds nothing for a meeting with no link", () => {
    expect(consentEmailsForMeeting([email(null, start)], { meetingUrl: null, startTime: start })).toEqual([]);
  });
});

describe("meetingConsentStatus", () => {
  const reply = (consentResponseStatus: string, emailStatus = "sent") => ({ consentResponseStatus, emailStatus });

  it("is approved only when everyone has agreed", () => {
    expect(meetingConsentStatus([reply("granted"), reply("granted")])).toBe("approved");
    expect(meetingConsentStatus([reply("granted"), reply("awaiting")])).toBe("sent");
  });

  it("is declined when anyone refuses or asks to reschedule", () => {
    expect(meetingConsentStatus([reply("granted"), reply("declined")])).toBe("declined");
    expect(meetingConsentStatus([reply("reschedule_requested")])).toBe("declined");
  });

  it("ignores emails that failed to send", () => {
    expect(meetingConsentStatus([reply("granted"), reply("awaiting", "failed")])).toBe("approved");
  });
});
