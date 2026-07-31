export type VoiceIntent =
  | { type: "navigate"; path: string; label: string }
  | { type: "open_matter"; query: string }
  | { type: "case_view"; view: CaseView; label: string }
  | { type: "start_recording" }
  | { type: "start_livebot" }
  | { type: "unknown"; raw: string };

export type CaseView =
  | "transcript"
  | "attendance"
  | "summary"
  | "obligations"
  | "notes"
  | "documents";

const NAV_PATTERNS: Array<{ re: RegExp; path: string; label: string }> = [
  { re: /\b(go to |open |show )?(the )?(dashboard|home)\b/i, path: "/", label: "Dashboard" },
  { re: /\b(go to |open |show )?(all )?cases\b/i, path: "/cases", label: "Cases" },
  { re: /\b(go to |open |show )?settings\b/i, path: "/settings", label: "Settings" },
  { re: /\b(go to |open |show )?(my )?(actions|obligations)\b/i, path: "/my-actions", label: "My Actions" },
  { re: /\b(go to |open |show )?clients?\b/i, path: "/clients", label: "Clients" },
  { re: /\b(go to |open |show )?capture\b/i, path: "/capture", label: "Capture" },
  { re: /\b(go to |open |show )?profile\b/i, path: "/profile", label: "Profile" },
];

const CASE_VIEW_PATTERNS: Array<{ re: RegExp; view: CaseView; label: string }> = [
  { re: /\b(show |open )?(the )?transcript\b/i, view: "transcript", label: "Transcript" },
  { re: /\b(show |open )?(the )?attendance( note)?\b/i, view: "attendance", label: "Attendance note" },
  { re: /\b(show |open )?(the )?summary\b/i, view: "summary", label: "Summary" },
  { re: /\b(show |open )?(the )?(action items|obligations)\b/i, view: "obligations", label: "Obligations" },
  { re: /\b(show |open )?(the )?notes?\b/i, view: "notes", label: "Notes" },
  { re: /\b(show |open )?(the )?documents?\b/i, view: "documents", label: "Documents" },
];

/**
 * Lightweight rule parser for v1 voice commands.
 * Prefer specific open-matter phrasing before generic navigation.
 */
export function parseVoiceCommand(transcript: string): VoiceIntent {
  const raw = transcript.trim().replace(/\s+/g, " ");
  if (!raw) return { type: "unknown", raw: "" };

  const lower = raw.toLowerCase();

  if (/\b(start|begin)\b.*\b(recording|record)\b/i.test(lower) || /\bquick record\b/i.test(lower)) {
    return { type: "start_recording" };
  }
  if (/\b(join|start)\b.*\b(meeting|live ?bot|video)\b/i.test(lower)) {
    return { type: "start_livebot" };
  }

  // "open adam reeves", "open matter Patterson", "go to the Smith case"
  const openMatter = raw.match(
    /^(?:please\s+)?(?:open|go to|show|find|bring up)\s+(?:the\s+)?(?:matter|case|client)?\s*(.+)$/i,
  );
  if (openMatter?.[1]) {
    const query = cleanMatterQuery(openMatter[1]);
    // If the remainder is a pure nav word, treat as navigation instead
    for (const nav of NAV_PATTERNS) {
      if (nav.re.test(query) && query.split(/\s+/).length <= 2) {
        return { type: "navigate", path: nav.path, label: nav.label };
      }
    }
    for (const view of CASE_VIEW_PATTERNS) {
      if (view.re.test(`show ${query}`) || view.re.test(query)) {
        return { type: "case_view", view: view.view, label: view.label };
      }
    }
    if (query.length >= 2) {
      return { type: "open_matter", query };
    }
  }

  for (const view of CASE_VIEW_PATTERNS) {
    if (view.re.test(raw)) {
      return { type: "case_view", view: view.view, label: view.label };
    }
  }

  for (const nav of NAV_PATTERNS) {
    if (nav.re.test(raw)) {
      return { type: "navigate", path: nav.path, label: nav.label };
    }
  }

  // Bare name fallback: "adam reeves" with no verb → treat as open matter
  if (/^[a-z0-9][a-z0-9 &'./-]{1,80}$/i.test(raw) && !/\b(please|hello|hi|thanks)\b/i.test(lower)) {
    return { type: "open_matter", query: cleanMatterQuery(raw) };
  }

  return { type: "unknown", raw };
}

function cleanMatterQuery(q: string): string {
  return q
    .replace(/\b(matter|case|client|please|for me)\b/gi, " ")
    .replace(/[?.!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function caseViewPath(caseId: string, view: CaseView): string {
  switch (view) {
    case "transcript":
      return `/case/${caseId}?tab=transcript`;
    case "attendance":
      return `/case/${caseId}?tab=attendance`;
    case "summary":
      return `/case/${caseId}?tab=summary`;
    case "obligations":
      return `/case/${caseId}?section=obligations`;
    case "notes":
      return `/case/${caseId}?section=notes`;
    case "documents":
      return `/case/${caseId}?section=documents`;
  }
}
