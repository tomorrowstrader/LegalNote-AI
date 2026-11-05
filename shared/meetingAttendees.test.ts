import { describe, expect, it } from "vitest";
import {
  consentRecipientOptions,
  isReceivedCalendarMeeting,
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
