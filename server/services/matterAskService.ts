import { privilegedComplete } from "./llm/privilegedComplete";
import type { IStorage } from "../storage";

export interface MatterAskCitation {
  source: "transcript" | "attendance_note" | "client_letter";
  label: string;
  /** Milliseconds into transcript audio/utterances when source is transcript. */
  timestampMs?: number;
  excerpt?: string;
}

export interface MatterAskResult {
  answer: string;
  citations: MatterAskCitation[];
  refused: boolean;
  refuseReason?: string;
}

export interface MatterCompareFinding {
  kind: "missing_from_note" | "mismatch" | "note_unsupported";
  label: string;
  severity: "info" | "review";
  transcriptExcerpt?: string;
  noteExcerpt?: string;
  timestampMs?: number;
}

export interface MatterCompareResult {
  summary: string;
  findings: MatterCompareFinding[];
  citations: MatterAskCitation[];
  refused: boolean;
  refuseReason?: string;
  noteStatus?: string;
  hasTranscript: boolean;
  hasNote: boolean;
}

type Utterance = { speaker?: string; text?: string; start?: number; end?: number };

const MAX_TRANSCRIPT_CHARS = 28000;
const MAX_DOC_CHARS = 14000;
const MAX_WARNINGS_CHARS = 4000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[…truncated for length…]`;
}

function formatUtterances(utterances: Utterance[]): string {
  return utterances
    .filter((u) => (u.text || "").trim())
    .map((u) => {
      const t = typeof u.start === "number" ? `[${Math.round(u.start)}ms]` : "";
      const sp = u.speaker || "Speaker";
      return `${t} ${sp}: ${(u.text || "").trim()}`;
    })
    .join("\n");
}

function parseCitations(raw: unknown): MatterAskCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any): MatterAskCitation | null => {
      const source = c?.source;
      if (
        source !== "transcript" &&
        source !== "attendance_note" &&
        source !== "client_letter"
      ) {
        return null;
      }
      const timestampMs =
        typeof c.timestampMs === "number" && Number.isFinite(c.timestampMs)
          ? Math.max(0, Math.round(c.timestampMs))
          : undefined;
      return {
        source,
        label:
          typeof c.label === "string" && c.label.trim()
            ? c.label.trim()
            : source === "transcript"
              ? "Transcript"
              : source === "attendance_note"
                ? "Attendance note"
                : "Client letter",
        timestampMs,
        excerpt:
          typeof c.excerpt === "string" && c.excerpt.trim()
            ? c.excerpt.trim().slice(0, 240)
            : undefined,
      };
    })
    .filter(Boolean) as MatterAskCitation[];
}

async function loadMatterFileContext(options: {
  storage: IStorage;
  caseId: string;
  userId: string;
}) {
  const { storage, caseId, userId } = options;
  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) {
    throw Object.assign(new Error("Not authorized"), { status: 403 });
  }

  const [transcript, documents] = await Promise.all([
    storage.getTranscriptByCase(caseId, userId),
    storage.getActiveDocumentsByCase(caseId, userId),
  ]);

  const attendance = documents.find(
    (d) =>
      (d.type === "attendance_note" || d.type === "meeting_notes") &&
      d.status === "approved",
  ) || documents.find(
    (d) => d.type === "attendance_note" || d.type === "meeting_notes",
  );

  const letter = documents.find(
    (d) =>
      (d.type === "client_letter" || d.type === "summary") &&
      d.status === "approved",
  ) || documents.find(
    (d) => d.type === "client_letter" || d.type === "summary",
  );

  const utterances = (transcript?.utterances || []) as Utterance[];
  const transcriptBody =
    utterances.length > 0
      ? formatUtterances(utterances)
      : (transcript?.content || "").trim();

  const matterLabel = [caseData.title, caseData.clientName, caseData.matterReference]
    .filter(Boolean)
    .join(" · ");

  const openWarnings = Array.isArray(attendance?.verificationWarnings)
    ? (attendance!.verificationWarnings as Array<{
        category?: string;
        documentQuote?: string;
        explanation?: string;
        transcriptQuote?: string | null;
        resolution?: unknown;
      }>).filter((w) => !w.resolution)
    : [];

  const warningsBlock =
    openWarnings.length > 0
      ? openWarnings
          .slice(0, 12)
          .map((w, i) => {
            const parts = [
              `${i + 1}. [${w.category || "warning"}] ${w.explanation || ""}`.trim(),
              w.documentQuote ? `Note: “${w.documentQuote}”` : null,
              w.transcriptQuote ? `Transcript: “${w.transcriptQuote}”` : null,
            ].filter(Boolean);
            return parts.join("\n");
          })
          .join("\n\n")
      : "";

  return {
    caseData,
    matterLabel,
    transcriptBody,
    attendance,
    letter,
    warningsBlock,
  };
}

/**
 * Grounded Q&A over one matter's transcript + adopted notes.
 * Uses EU Bedrock only. Soft-refuses advice/strategy.
 */
export async function askMatterQuestion(options: {
  storage: IStorage;
  caseId: string;
  userId: string;
  question: string;
}): Promise<MatterAskResult> {
  const { storage, caseId, userId, question } = options;
  const q = question.trim();
  if (q.length < 3) {
    return {
      answer: "Ask a fuller question about what’s on this matter’s file.",
      citations: [],
      refused: false,
    };
  }

  const ctx = await loadMatterFileContext({ storage, caseId, userId });
  const { matterLabel, transcriptBody, attendance, letter } = ctx;

  if (!transcriptBody && !attendance?.content && !letter?.content) {
    return {
      answer: "There’s no transcript or note on this matter to search yet.",
      citations: [],
      refused: false,
    };
  }

  const systemPrompt = `You are LegalNote’s file assistant for UK solicitors.
You answer ONLY from the provided matter file excerpts (transcript and documents).
You must NOT give legal advice, strategy, or recommendations about what the solicitor should advise or do.
If the user asks for advice or strategy, set refused=true and explain you can only report what is on the file.

Rules:
- Prefer short, precise answers grounded in the excerpts.
- If the file does not contain the answer, say so clearly — do not invent.
- Cite sources using the citation objects. For transcript, use timestampMs from the [Nms] markers when possible.
- Return JSON only.`;

  const userPrompt = `Matter: ${matterLabel || caseId}

QUESTION:
${q}

--- TRANSCRIPT EXCERPT ---
${transcriptBody ? truncate(transcriptBody, MAX_TRANSCRIPT_CHARS) : "(none)"}

--- ATTENDANCE NOTE ---
${attendance?.content ? truncate(attendance.content, MAX_DOC_CHARS) : "(none)"}
Status: ${attendance?.status || "n/a"}

--- CLIENT LETTER / SUMMARY ---
${letter?.content ? truncate(letter.content, MAX_DOC_CHARS) : "(none)"}
Status: ${letter?.status || "n/a"}

Respond with JSON:
{
  "refused": boolean,
  "refuseReason": string | null,
  "answer": string,
  "citations": [
    {
      "source": "transcript" | "attendance_note" | "client_letter",
      "label": string,
      "timestampMs": number | null,
      "excerpt": string | null
    }
  ]
}`;

  const completion = await privilegedComplete({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    maxTokens: 900,
    responseFormat: "json_object",
  });

  let parsed: any;
  try {
    parsed = JSON.parse(completion.content || "{}");
  } catch {
    return {
      answer: "I couldn’t parse a reliable answer from the file. Try a more specific question.",
      citations: [],
      refused: false,
    };
  }

  if (parsed.refused) {
    return {
      answer:
        parsed.refuseReason ||
        "I can’t advise on strategy — I can only report what’s on this matter’s file.",
      citations: [],
      refused: true,
      refuseReason: parsed.refuseReason || undefined,
    };
  }

  const citations = parseCitations(parsed.citations);
  const answer =
    typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : "I couldn’t find a clear answer in the file excerpts.";

  return { answer, citations, refused: false };
}

/**
 * Compare meeting transcript vs attendance note: omissions and mismatches.
 * Inverse of note→transcript verification — focuses on what the meeting covered
 * that the note may have missed. Soft-refuses advice/strategy.
 */
export async function compareMatterNote(options: {
  storage: IStorage;
  caseId: string;
  userId: string;
}): Promise<MatterCompareResult> {
  const { storage, caseId, userId } = options;
  const ctx = await loadMatterFileContext({ storage, caseId, userId });
  const { matterLabel, transcriptBody, attendance, warningsBlock } = ctx;

  const hasTranscript = Boolean(transcriptBody);
  const hasNote = Boolean(attendance?.content?.trim());

  if (!hasTranscript && !hasNote) {
    return {
      summary: "There’s no transcript or attendance note on this matter to compare yet.",
      findings: [],
      citations: [],
      refused: false,
      hasTranscript: false,
      hasNote: false,
    };
  }

  if (!hasTranscript) {
    return {
      summary: "No transcript on this matter yet — can’t compare the meeting to the note.",
      findings: [],
      citations: [],
      refused: false,
      noteStatus: attendance?.status,
      hasTranscript: false,
      hasNote,
    };
  }

  if (!hasNote) {
    return {
      summary: "No attendance note on this matter yet — generate or open one, then compare again.",
      findings: [],
      citations: [],
      refused: false,
      hasTranscript: true,
      hasNote: false,
    };
  }

  const systemPrompt = `You are LegalNote’s file assistant for UK solicitors.
Compare the MEETING TRANSCRIPT to the ATTENDANCE NOTE and report factual coverage gaps only.

You must NOT give legal advice, strategy, or recommendations about what the solicitor should advise or do.
If the request is really asking for advice, set refused=true.

Focus (priority order):
1. missing_from_note — substantive points clearly discussed in the transcript that are not reflected in the note (facts agreed, decisions, deadlines, undertakings, next steps, names/amounts that matter).
2. mismatch — where the note states something that conflicts with the transcript.
3. note_unsupported — optional: note content already flagged in stored verification warnings, if provided.

Rules:
- Do NOT invent gaps. Only report clear, material omissions or conflicts.
- Ignore trivial phrasing differences, filler, and small wording changes.
- Prefer at most 8 findings, most material first.
- For transcript findings, set timestampMs from [Nms] markers when available.
- Return JSON only.`;

  const userPrompt = `Matter: ${matterLabel || caseId}

Compare the transcript to the attendance note. What substantive points from the meeting are missing from the note, and are there clear mismatches?

--- TRANSCRIPT ---
${truncate(transcriptBody, MAX_TRANSCRIPT_CHARS)}

--- ATTENDANCE NOTE ---
${truncate(attendance!.content!, MAX_DOC_CHARS)}
Status: ${attendance!.status || "n/a"}

--- STORED NOTE VERIFICATION WARNINGS (optional context; note→transcript polarity) ---
${warningsBlock ? truncate(warningsBlock, MAX_WARNINGS_CHARS) : "(none)"}

Respond with JSON:
{
  "refused": boolean,
  "refuseReason": string | null,
  "summary": string,
  "findings": [
    {
      "kind": "missing_from_note" | "mismatch" | "note_unsupported",
      "label": string,
      "severity": "info" | "review",
      "transcriptExcerpt": string | null,
      "noteExcerpt": string | null,
      "timestampMs": number | null
    }
  ],
  "citations": [
    {
      "source": "transcript" | "attendance_note",
      "label": string,
      "timestampMs": number | null,
      "excerpt": string | null
    }
  ]
}`;

  const completion = await privilegedComplete({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    maxTokens: 1200,
    responseFormat: "json_object",
  });

  let parsed: any;
  try {
    parsed = JSON.parse(completion.content || "{}");
  } catch {
    return {
      summary: "I couldn’t complete a reliable compare. Try again, or open the transcript and note side by side.",
      findings: [],
      citations: [],
      refused: false,
      noteStatus: attendance?.status,
      hasTranscript: true,
      hasNote: true,
    };
  }

  if (parsed.refused) {
    return {
      summary:
        parsed.refuseReason ||
        "I can’t advise on strategy — I can only compare what’s on this matter’s file.",
      findings: [],
      citations: [],
      refused: true,
      refuseReason: parsed.refuseReason || undefined,
      noteStatus: attendance?.status,
      hasTranscript: true,
      hasNote: true,
    };
  }

  const findings: MatterCompareFinding[] = Array.isArray(parsed.findings)
    ? parsed.findings
        .map((f: any): MatterCompareFinding | null => {
          const kind = f?.kind;
          if (
            kind !== "missing_from_note" &&
            kind !== "mismatch" &&
            kind !== "note_unsupported"
          ) {
            return null;
          }
          const label =
            typeof f.label === "string" && f.label.trim()
              ? f.label.trim().slice(0, 200)
              : null;
          if (!label) return null;
          const timestampMs =
            typeof f.timestampMs === "number" && Number.isFinite(f.timestampMs)
              ? Math.max(0, Math.round(f.timestampMs))
              : undefined;
          return {
            kind,
            label,
            severity: f.severity === "review" ? "review" : "info",
            transcriptExcerpt:
              typeof f.transcriptExcerpt === "string" && f.transcriptExcerpt.trim()
                ? f.transcriptExcerpt.trim().slice(0, 240)
                : undefined,
            noteExcerpt:
              typeof f.noteExcerpt === "string" && f.noteExcerpt.trim()
                ? f.noteExcerpt.trim().slice(0, 240)
                : undefined,
            timestampMs,
          };
        })
        .filter(Boolean)
        .slice(0, 8) as MatterCompareFinding[]
    : [];

  const citations = parseCitations(parsed.citations).filter(
    (c) => c.source === "transcript" || c.source === "attendance_note",
  );

  // Ensure each finding with a transcript timestamp has a citation chip
  for (const f of findings) {
    if (typeof f.timestampMs === "number") {
      const already = citations.some(
        (c) => c.source === "transcript" && c.timestampMs === f.timestampMs,
      );
      if (!already) {
        citations.push({
          source: "transcript",
          label: f.label.slice(0, 40),
          timestampMs: f.timestampMs,
          excerpt: f.transcriptExcerpt,
        });
      }
    }
  }

  if (!citations.some((c) => c.source === "attendance_note")) {
    citations.push({
      source: "attendance_note",
      label: "Attendance note",
    });
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : findings.length === 0
        ? "No clear material gaps between the meeting and the attendance note from the file excerpts."
        : `Found ${findings.length} point${findings.length === 1 ? "" : "s"} to review.`;

  return {
    summary,
    findings,
    citations: citations.slice(0, 12),
    refused: false,
    noteStatus: attendance?.status,
    hasTranscript: true,
    hasNote: true,
  };
}
