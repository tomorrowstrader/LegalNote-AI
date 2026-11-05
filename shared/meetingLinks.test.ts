import { describe, expect, it } from "vitest";
import { cleanMeetingLink, detectMeetingPlatform, extractMeetingLink, unwrapSafeLink } from "./meetingLinks";

const classicTeams = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?context=x";
const safeLink = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(classicTeams)}&amp;data=abc`;

describe("extractMeetingLink", () => {
  it("reads the classic and newer Teams formats", () => {
    expect(extractMeetingLink(`Join: ${classicTeams}`)).toEqual({ url: classicTeams, platform: "teams" });
    expect(extractMeetingLink("Join https://teams.microsoft.com/meet/123456?p=abc.")).toEqual({
      url: "https://teams.microsoft.com/meet/123456?p=abc",
      platform: "teams",
    });
    expect(extractMeetingLink('<a href="https://teams.live.com/meet/999">Join</a>').url).toBe(
      "https://teams.live.com/meet/999",
    );
  });

  it("sees through Safe Links in invitation HTML", () => {
    expect(extractMeetingLink(`<a href="${safeLink}">Join</a>`)).toEqual({ url: classicTeams, platform: "teams" });
  });

  it("still reads Zoom, Meet and Webex links", () => {
    expect(extractMeetingLink("https://acme.zoom.us/j/123?pwd=x").platform).toBe("zoom");
    expect(extractMeetingLink("https://meet.google.com/abc-defg-hij").platform).toBe("meet");
    expect(extractMeetingLink("https://acme.webex.com/acme/j.php").platform).toBe("webex");
  });

  it("finds nothing in ordinary text", () => {
    expect(extractMeetingLink("See you at the office. https://example.com/meet/1")).toEqual({});
  });
});

describe("cleanMeetingLink", () => {
  it("accepts join links and unwraps Safe Links", () => {
    expect(cleanMeetingLink(` ${safeLink} `)).toEqual({ url: classicTeams, platform: "teams" });
  });

  it("rejects links the bot can't use", () => {
    expect(cleanMeetingLink("http://teams.microsoft.com/meet/1")).toBeNull();
    expect(cleanMeetingLink("https://example.com/teams.microsoft.com")).toBeNull();
    expect(cleanMeetingLink("not a link")).toBeNull();
    expect(cleanMeetingLink(undefined)).toBeNull();
  });
});

describe("detectMeetingPlatform", () => {
  it("checks the host, not the whole address", () => {
    expect(detectMeetingPlatform("https://evil.example/zoom.us/j/1")).toBeNull();
    expect(detectMeetingPlatform("https://teams.cloud.microsoft/meet/1")).toBe("teams");
    expect(detectMeetingPlatform("https://dod.teams.microsoft.us/meet/1")).toBe("teams");
  });
});

describe("unwrapSafeLink", () => {
  it("leaves other links alone", () => {
    expect(unwrapSafeLink(classicTeams)).toBe(classicTeams);
    expect(unwrapSafeLink("not a link")).toBe("not a link");
  });
});
