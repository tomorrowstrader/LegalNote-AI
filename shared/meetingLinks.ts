/**
 * Reads meeting join links from calendar events and typed input. Formats follow
 * Recall.ai's documented meeting URL patterns, since the bot joins from this link.
 */

export type MeetingPlatform = "zoom" | "teams" | "meet" | "webex";

const TEAMS_HOST = /(^|\.)teams\.(microsoft\.com|cloud\.microsoft|microsoft\.us|live\.com)$/i;
const SAFE_LINK_IN_TEXT = /https?:\/\/[\w.-]*safelinks\.protection\.outlook\.com\/[^\s"'<>]+/gi;

const LINK_PATTERNS: Array<[MeetingPlatform, RegExp]> = [
  ["zoom", /https:\/\/[\w.-]*zoom\.(?:us|com)\/(?:j|my|s|w)\/[\w.?=&%+-]+/i],
  [
    "teams",
    /https:\/\/(?:[a-z0-9-]+\.)?teams\.(?:microsoft\.com|cloud\.microsoft|microsoft\.us|live\.com)\/(?:l\/meetup-join\/|meet\/)[^\s"'<>]+/i,
  ],
  ["meet", /https:\/\/meet\.google\.com\/[\w-]+/i],
  ["webex", /https:\/\/[\w.-]*webex\.com\/[\w/.-]+/i],
];

function decodeAmpersands(text: string): string {
  return text.replace(/&amp;/gi, "&");
}

/** Outlook's Safe Links hide the real address inside a query parameter. */
export function unwrapSafeLink(raw: string): string {
  try {
    const parsed = new URL(decodeAmpersands(raw.trim()));
    if (!/(^|\.)safelinks\.protection\.outlook\.com$/i.test(parsed.hostname)) return raw.trim();
    return parsed.searchParams.get("url") || raw.trim();
  } catch {
    return raw.trim();
  }
}

export function detectMeetingPlatform(url: string): MeetingPlatform | null {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)zoom\.(us|com)$/.test(host)) return "zoom";
  if (TEAMS_HOST.test(host)) return "teams";
  if (host === "meet.google.com") return "meet";
  if (/(^|\.)webex\.com$/.test(host)) return "webex";
  return null;
}

/** A typed or pasted link, or null if the bot couldn't use it. */
export function cleanMeetingLink(raw: unknown): { url: string; platform: MeetingPlatform } | null {
  if (typeof raw !== "string") return null;
  const url = unwrapSafeLink(decodeAmpersands(raw.trim()));
  if (!/^https:\/\//i.test(url)) return null;
  const platform = detectMeetingPlatform(url);
  return platform ? { url, platform } : null;
}

/** Finds the first join link in an invitation's text or HTML. */
export function extractMeetingLink(text: string): { url?: string; platform?: MeetingPlatform } {
  const readable = decodeAmpersands(text).replace(SAFE_LINK_IN_TEXT, (link) => unwrapSafeLink(link));
  for (const [platform, pattern] of LINK_PATTERNS) {
    const match = readable.match(pattern);
    if (match) return { url: match[0].replace(/[).,;]+$/, ""), platform };
  }
  return {};
}
