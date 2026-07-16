/** Returns a normalized https URL, or null if missing/malformed/non-https. */
export function getSafeHttpsMeetingUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}
