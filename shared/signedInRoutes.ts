/**
 * Pages that only exist for a signed-in user. When the session has ended
 * (idle timeout, or a link opened while signed out), these must send the
 * person to sign in and back again, never to the "page not found" screen.
 *
 * Keep in step with the signed-in routes in client/src/App.tsx.
 */
const SIGNED_IN_PREFIXES = [
  "/capture",
  "/new-note",
  "/case",
  "/cases",
  "/settings",
  "/profile",
  "/audit-logs",
  "/app/security",
  "/my-actions",
  "/clients",
  "/time-summary",
  "/undertakings",
  "/team",
  "/firm",
  "/subscribe",
  "/compliance",
  "/access-pending",
  "/pending-approval",
  "/waitlist",
] as const;

export function isSignedInAppPath(pathname: string): boolean {
  return SIGNED_IN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const SESSION_EXPIRED_REASON = "expired";

/**
 * Where a signed-out visitor on `pathname` should go, or null to leave them
 * on the page they asked for.
 *
 * `wasSignedIn` is true when this browser tab had a signed-in session that
 * has since ended, so the sign-in page can explain why it appeared.
 */
export function signInRedirectFor(
  pathname: string,
  search: string,
  wasSignedIn: boolean,
): string | null {
  const reason = wasSignedIn ? `&reason=${SESSION_EXPIRED_REASON}` : "";
  if (isSignedInAppPath(pathname)) {
    const returnTo = encodeURIComponent(`${pathname}${search}`);
    return `/login?returnTo=${returnTo}${reason}`;
  }
  // The dashboard lives at "/" too; signed-out visitors normally see the
  // public landing page there. Only redirect someone whose session just ended.
  if (pathname === "/" && wasSignedIn) {
    return `/login?reason=${SESSION_EXPIRED_REASON}`;
  }
  return null;
}
