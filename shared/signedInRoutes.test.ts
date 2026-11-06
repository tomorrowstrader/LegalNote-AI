import { describe, expect, it } from "vitest";
import { isSignedInAppPath, signInRedirectFor } from "./signedInRoutes";

describe("isSignedInAppPath", () => {
  it("matches signed-in pages and their sub-pages", () => {
    expect(isSignedInAppPath("/case/cc75e10d-4036")).toBe(true);
    expect(isSignedInAppPath("/cases")).toBe(true);
    expect(isSignedInAppPath("/clients/abc")).toBe(true);
    expect(isSignedInAppPath("/settings")).toBe(true);
  });

  it("does not match public pages or lookalike prefixes", () => {
    expect(isSignedInAppPath("/")).toBe(false);
    expect(isSignedInAppPath("/login")).toBe(false);
    expect(isSignedInAppPath("/pricing")).toBe(false);
    expect(isSignedInAppPath("/security")).toBe(false);
    expect(isSignedInAppPath("/casement")).toBe(false);
    expect(isSignedInAppPath("/meeting-notes-popout")).toBe(false);
  });
});

describe("signInRedirectFor", () => {
  it("sends an expired session on a case back to sign in with the case kept", () => {
    expect(signInRedirectFor("/case/abc", "?tab=notes", true)).toBe(
      "/login?returnTo=%2Fcase%2Fabc%3Ftab%3Dnotes&reason=expired",
    );
  });

  it("does not claim a timeout for someone who was never signed in", () => {
    expect(signInRedirectFor("/case/abc", "", false)).toBe(
      "/login?returnTo=%2Fcase%2Fabc",
    );
  });

  it("only redirects the home page when a session just ended", () => {
    expect(signInRedirectFor("/", "", true)).toBe("/login?reason=expired");
    expect(signInRedirectFor("/", "", false)).toBeNull();
  });

  it("leaves unknown and public pages alone", () => {
    expect(signInRedirectFor("/no-such-page", "", true)).toBeNull();
    expect(signInRedirectFor("/pricing", "", true)).toBeNull();
  });
});
