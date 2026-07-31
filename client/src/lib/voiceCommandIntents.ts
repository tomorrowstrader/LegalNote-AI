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

export interface VoiceMatterCandidate {
  id: string;
  title: string;
  clientName: string | null;
  matterReference: string | null;
}

export interface RankedMatterHit extends VoiceMatterCandidate {
  score: number;
}

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

  // STT often inserts "Open. Adam…" — normalize punctuation before matching verbs
  const spoken = raw.replace(/[.,!?…"“”‘’]+/g, " ").replace(/\s+/g, " ").trim();
  const lower = spoken.toLowerCase();

  if (/\b(start|begin)\b.*\b(recording|record)\b/i.test(lower) || /\bquick record\b/i.test(lower)) {
    return { type: "start_recording" };
  }
  if (/\b(join|start)\b.*\b(meeting|live ?bot|video)\b/i.test(lower)) {
    return { type: "start_livebot" };
  }

  // "open adam reeves", "open matter Patterson", "go to the Smith case"
  const openMatter = spoken.match(
    /^(?:please\s+)?(?:open|go to|show|find|bring up)\s+(?:the\s+)?(?:matter|case|client)?\s*(.+)$/i,
  );
  if (openMatter?.[1]) {
    const query = cleanMatterQuery(openMatter[1]);
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
    if (view.re.test(spoken)) {
      return { type: "case_view", view: view.view, label: view.label };
    }
  }

  for (const nav of NAV_PATTERNS) {
    if (nav.re.test(spoken)) {
      return { type: "navigate", path: nav.path, label: nav.label };
    }
  }

  // Bare name fallback: "adam reeves" with no verb → treat as open matter
  const cleanedBare = cleanMatterQuery(spoken);
  if (
    cleanedBare.length >= 2 &&
    /^[a-z0-9][a-z0-9 &'./-]{1,80}$/i.test(cleanedBare) &&
    !/\b(please|hello|hi|thanks)\b/i.test(cleanedBare)
  ) {
    return { type: "open_matter", query: cleanedBare };
  }

  return { type: "unknown", raw };
}

export function cleanMatterQuery(q: string): string {
  return q
    .replace(/[.,!?…"“”‘’]+/g, " ")
    .replace(/\bversus\b/gi, "v")
    .replace(/\bv\.\s*/gi, "v ")
    .replace(/\b(matter|case|client|please|for me|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize for fuzzy compare: lowercase, collapse space, light plural trim. */
export function normalizeMatterText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?…"“”‘’'/()-]+/g, " ")
    .replace(/\bversus\b/g, "v")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeMatterText(value)
    .split(" ")
    .filter((t) => t.length > 0);
}

/** Soft equality: reeve ≈ reeves */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/**
 * Score a case against a spoken matter query (client / title / ref only — not transcript body).
 */
export function scoreMatterAgainstQuery(matter: VoiceMatterCandidate, query: string): number {
  const q = normalizeMatterText(query);
  if (!q) return 0;

  const client = normalizeMatterText(matter.clientName || "");
  const title = normalizeMatterText(matter.title || "");
  const ref = normalizeMatterText(matter.matterReference || "");
  const qTokens = tokens(q);
  const clientTokens = tokens(client);
  const titleTokens = tokens(title);

  let score = 0;

  if (client && client === q) score += 120;
  else if (client && (client.includes(q) || q.includes(client))) score += 95;

  if (title && title === q) score += 110;
  else if (title && title.includes(q)) score += 85;

  if (ref && (ref === q || ref.includes(q) || q.includes(ref))) score += 90;

  // Token overlap — "adam reeves" vs "adam reeve"
  if (qTokens.length > 0 && clientTokens.length > 0) {
    const clientHits = qTokens.filter((qt) => clientTokens.some((ct) => tokensMatch(qt, ct))).length;
    score += (clientHits / qTokens.length) * 70;
  }
  if (qTokens.length > 0 && titleTokens.length > 0) {
    const titleHits = qTokens.filter((qt) => titleTokens.some((tt) => tokensMatch(qt, tt))).length;
    score += (titleHits / qTokens.length) * 55;
  }

  // "reeve v reeve" style titles
  if (qTokens.includes("v") && title.includes(" v ")) {
    const parties = qTokens.filter((t) => t !== "v");
    if (parties.length > 0 && parties.every((p) => titleTokens.some((tt) => tokensMatch(p, tt)))) {
      score += 40;
    }
  }

  return score;
}

/**
 * Rank matters for voice open. Returns only plausible hits, best first.
 * Auto-open when the top hit is clearly the intended matter.
 */
export function rankMattersForVoiceOpen(
  matters: VoiceMatterCandidate[],
  query: string,
): { ranked: RankedMatterHit[]; autoOpen: RankedMatterHit | null } {
  const ranked = matters
    .map((m) => ({ ...m, score: scoreMatterAgainstQuery(m, query) }))
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { ranked: [], autoOpen: null };

  const best = ranked[0];
  const second = ranked[1];

  // Strong unique match, or clearly ahead of the runner-up
  const clearWinner =
    best.score >= 70 &&
    (!second || best.score >= second.score + 18 || best.score >= 100);

  return {
    ranked: ranked.slice(0, 5),
    autoOpen: clearWinner ? best : null,
  };
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
