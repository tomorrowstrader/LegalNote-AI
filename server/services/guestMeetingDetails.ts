const GUEST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lower-cased email, or null when missing or not a single address. */
export function normalizeGuestEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 255 || !GUEST_EMAIL_RE.test(email)) return null;
  return email;
}

/** Trimmed display name, or null when blank. */
export function normalizeGuestName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().slice(0, 200);
  return name || null;
}

/** True once the scheduled window is over. Missing end time allows three hours from the start. */
export function meetingWindowEnded(
  startTime: Date,
  endTime: Date | null | undefined,
  now = new Date(),
): boolean {
  const end = endTime ?? new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
  return end.getTime() <= now.getTime();
}
