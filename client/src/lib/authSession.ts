/**
 * Remembers, for this browser tab only, that someone was signed in. If the
 * session later ends on its own (idle timeout), the sign-in page can say so
 * instead of the app showing "page not found".
 *
 * sessionStorage is used because it survives the browser discarding and
 * reloading a hidden tab, but not closing it.
 */
const WAS_SIGNED_IN_KEY = "ln_was_signed_in";

export function markSignedIn(): void {
  try {
    sessionStorage.setItem(WAS_SIGNED_IN_KEY, "1");
  } catch {
    /* storage blocked: fall back to a plain sign-in prompt */
  }
}

export function wasSignedInThisTab(): boolean {
  try {
    return sessionStorage.getItem(WAS_SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSignedInMarker(): void {
  try {
    sessionStorage.removeItem(WAS_SIGNED_IN_KEY);
  } catch {
    /* ignore */
  }
}

/** Deliberate sign-out: not a timeout, so forget the marker first. */
export function signOut(): void {
  clearSignedInMarker();
  window.location.href = "/api/logout";
}
