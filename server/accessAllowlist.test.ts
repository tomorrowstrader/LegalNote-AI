import { afterEach, describe, expect, it } from "vitest";
import {
  getAccessAllowlist,
  isAccessAllowlistEnforced,
  isUserAccessAllowed,
  isUserOnStaticAllowlist,
} from "./accessAllowlist";

const ORIGINAL = {
  ACCESS_ALLOWLIST: process.env.ACCESS_ALLOWLIST,
  ACCESS_ALLOWLIST_ENFORCE: process.env.ACCESS_ALLOWLIST_ENFORCE,
  ADMIN_USER_ID: process.env.ADMIN_USER_ID,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("invite-only access allowlist", () => {
  it("is off unless ACCESS_ALLOWLIST_ENFORCE=true", () => {
    process.env.ACCESS_ALLOWLIST_ENFORCE = "false";
    process.env.ACCESS_ALLOWLIST = "someone@example.com";
    expect(isAccessAllowlistEnforced()).toBe(false);
    expect(isUserAccessAllowed("any-user", "stranger@example.com")).toBe(true);
  });

  it("fail-closes when enforce is on and caller is not listed", () => {
    process.env.ACCESS_ALLOWLIST_ENFORCE = "true";
    process.env.ADMIN_USER_ID = "admin-1";
    process.env.ACCESS_ALLOWLIST = "jazz.dennis@legalnote.ai,jazzdennis@hotmail.com";

    expect(isUserOnStaticAllowlist("admin-1", null)).toBe(true);
    expect(isUserOnStaticAllowlist("ms-user", "jazzdennis@hotmail.com")).toBe(true);
    expect(isUserOnStaticAllowlist("g-user", "Jazz.Dennis@LegalNote.ai")).toBe(true);
    expect(isUserOnStaticAllowlist("rando", "stranger@example.com")).toBe(false);
    expect(isUserAccessAllowed("rando", "stranger@example.com")).toBe(false);
  });

  it("parses mixed id and email entries case-insensitively", () => {
    process.env.ACCESS_ALLOWLIST = " AbC123 ,  Person@Firm.COM ";
    const list = getAccessAllowlist();
    expect(list.has("abc123")).toBe(true);
    expect(list.has("person@firm.com")).toBe(true);
  });
});
