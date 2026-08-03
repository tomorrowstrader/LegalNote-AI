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

type Utterance = { speaker?: string; text?: string; start?: number; end?: number };

const MAX_TRANSCRIPT_CHARS = 28000;
const MAX_DOC_CHARS = 14000;

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

  if (!transcriptBody && !attendance?.content && !letter?.content) {
    return {
      answer: "There’s no transcript or note on this matter to search yet.",
      citations: [],
      refused: false,
    };
  }

  const matterLabel = [caseData.title, caseData.clientName, caseData.matterReference]
    .filter(Boolean)
    .join(" · ");

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

  const citations: MatterAskCitation[] = Array.isArray(parsed.citations)
    ? parsed.citations
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
        .filter(Boolean)
    : [];

  const answer =
    typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : "I couldn’t find a clear answer in the file excerpts.";

  return { answer, citations, refused: false };
}
