import { stripRtfToPlainText } from "@shared/stripRtf";

export interface ParsedUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

const MAX_TRANSCRIPT_CHARS = 1_000_000;
const MIN_TRANSCRIPT_CHARS = 40;

/** Strip RTF if present, then BOM / newlines / trailing whitespace. */
export function sanitizeTranscriptText(raw: string): string {
  return stripRtfToPlainText(raw)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function formatParsedUtterances(utterances: ParsedUtterance[]): string {
  return utterances.map((u) => `[${u.speaker}]: ${u.text}`).join("\n\n");
}

/**
 * Parse common speaker-labelled transcript formats into utterances.
 * Timestamps are left at 0 when absent — never fabricate timing from wall-clock.
 */
export function parseSpeakerUtterances(content: string): ParsedUtterance[] {
  const lines = content.split("\n");
  const utterances: ParsedUtterance[] = [];

  // [Speaker A]: text  |  Speaker A: text  |  A: text (single letter/digit label)
  // Optional leading timestamp: 00:01:02 or [00:01]
  const labelled =
    /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+)?(?:\[([^\]]+)\]|([A-Za-z][A-Za-z0-9 _.-]{0,40})):\s*(.+)$/;

  let current: { speaker: string; text: string } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    if (text) {
      utterances.push({
        speaker: current.speaker,
        text,
        start: 0,
        end: 0,
        confidence: 1,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const match = trimmed.match(labelled);
    if (match) {
      flush();
      const speaker = (match[2] || match[3] || "Speaker").trim();
      current = { speaker, text: match[4] || "" };
      continue;
    }

    if (current) {
      current.text += ` ${trimmed}`;
    } else {
      current = { speaker: "Speaker", text: trimmed };
    }
  }
  flush();

  const distinctSpeakers = new Set(utterances.map((u) => u.speaker));
  if (utterances.length < 2 || distinctSpeakers.size < 2) {
    return [];
  }

  return utterances;
}

export interface NormalizedTranscript {
  content: string;
  utterances: ParsedUtterance[] | undefined;
  speakerCount: number | undefined;
  characterCount: number;
}

export function normalizeUploadedTranscript(raw: string): NormalizedTranscript {
  const sanitized = sanitizeTranscriptText(raw);
  if (sanitized.length < MIN_TRANSCRIPT_CHARS) {
    throw new Error(
      `Transcript is too short (minimum ${MIN_TRANSCRIPT_CHARS} characters after normalisation)`,
    );
  }
  if (sanitized.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(
      `Transcript exceeds the maximum length of ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters`,
    );
  }

  const utterances = parseSpeakerUtterances(sanitized);
  if (utterances.length > 0) {
    const speakers = new Set(utterances.map((u) => u.speaker));
    return {
      content: formatParsedUtterances(utterances),
      utterances,
      speakerCount: speakers.size,
      characterCount: sanitized.length,
    };
  }

  return {
    content: sanitized,
    utterances: undefined,
    speakerCount: undefined,
    characterCount: sanitized.length,
  };
}

export { MAX_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS };
