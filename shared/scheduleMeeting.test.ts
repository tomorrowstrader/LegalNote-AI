import { describe, expect, it } from "vitest";
import { nextHalfHourSlot, parseLocalDateTime, resolveScheduleProvider } from "./scheduleMeeting";

describe("resolveScheduleProvider", () => {
  it("keeps Google when that is the signed-in account and both calendars are connected", () => {
    expect(
      resolveScheduleProvider({
        preferred: "google",
        googleConnected: true,
        outlookConnected: true,
      }),
    ).toBe("google");
  });

  it("uses Outlook when they signed in with Microsoft", () => {
    expect(
      resolveScheduleProvider({
        preferred: "outlook",
        googleConnected: true,
        outlookConnected: true,
      }),
    ).toBe("outlook");
  });

  it("uses the calendar that is actually connected when the preferred one is not", () => {
    expect(
      resolveScheduleProvider({
        preferred: "google",
        googleConnected: false,
        outlookConnected: true,
      }),
    ).toBe("outlook");
  });

  it("uses Google when the login email is the connected Google calendar, even if a Microsoft login is also on the account", () => {
    expect(
      resolveScheduleProvider({
        preferred: "outlook",
        loginEmail: "jazz@gmail.com",
        googleEmail: "Jazz@gmail.com",
        outlookEmail: "jazz@outlook.com",
        googleConnected: true,
        outlookConnected: true,
      }),
    ).toBe("google");
  });

  it("uses Teams when this session signed in with Microsoft and Outlook is connected", () => {
    expect(
      resolveScheduleProvider({
        sessionProvider: "microsoft",
        preferred: "google",
        loginEmail: "jazz@firm.com",
        googleEmail: "jazz@firm.com",
        outlookEmail: "jazz@firm.com",
        googleConnected: true,
        outlookConnected: true,
      }),
    ).toBe("outlook");
  });
});

describe("parseLocalDateTime", () => {
  it("keeps the clock time the user picked", () => {
    const parsed = parseLocalDateTime("2026-10-12", "15:30");
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(9);
    expect(parsed!.getDate()).toBe(12);
    expect(parsed!.getHours()).toBe(15);
    expect(parsed!.getMinutes()).toBe(30);
  });

  it("rejects a time that does not exist", () => {
    expect(parseLocalDateTime("2026-10-11", "25:00")).toBeNull();
  });
});

describe("nextHalfHourSlot", () => {
  it("moves 14:50 to 15:00", () => {
    expect(nextHalfHourSlot(new Date(2026, 9, 11, 14, 50, 12))).toEqual({
      date: "2026-10-11",
      time: "15:00",
    });
  });

  it("moves an exact half-hour to the next one", () => {
    expect(nextHalfHourSlot(new Date(2026, 9, 11, 15, 0, 0))).toEqual({
      date: "2026-10-11",
      time: "15:30",
    });
  });
});
