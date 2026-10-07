import {
  quoteAppearsInPassage,
  selectSuggestionPassages,
  suggestionDraftIsGrounded,
  suggestionSourceLabel,
  type GapSuggestionCandidate,
  type GapSuggestionPassage,
} from "@shared/reasoningGapSuggestion";
import type { GapTranscriptUtterance } from "@shared/reasoningGapEvidence";
import {
  privilegedComplete,
  type PrivilegedCompleteRequest,
  type PrivilegedCompleteResult,
} from "./llm/privilegedComplete";

export type ReasoningGapSuggestion =
  | { status: "insufficient" }
  | { status: "proposed"; text: string; sourceLabel: string; passage: GapSuggestionPassage };

type CompleteFn = (request: PrivilegedCompleteRequest) => Promise<PrivilegedCompleteResult>;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function noteParagraphs(content: string): GapTranscriptUtterance[] {
  const plain = content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\{\{RGAP:[\s\S]*?\}\}/g, " ");
  return plain
    .split(/\n+/)
    .map((line) => line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim())
    .filter((line) => line.length >= 40)
    .map((text, index) => ({ text, start: index, end: index }));
}

export function normaliseUtterances(raw: unknown): GapTranscriptUtterance[] {
  if (!Array.isArray(raw)) return [];
  const utterances: GapTranscriptUtterance[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as { speaker?: unknown; text?: unknown; start?: unknown; end?: unknown };
    const text = typeof record.text === "string" ? record.text.trim() : "";
    if (!text) continue;
    utterances.push({
      speaker: typeof record.speaker === "string" ? record.speaker : undefined,
      text,
      start: typeof record.start === "number" ? record.start : utterances.length,
      end: typeof record.end === "number" ? record.end : utterances.length,
    });
  }
  return utterances;
}

/**
 * Draft a reason from passages already chosen on this matter.
 * Returns insufficient when there is nothing to draft from, or when the draft
 * is not supported by those passages.
 */
export async function draftReasoningFromPassages(
  gapLabel: string,
  candidates: GapSuggestionCandidate[],
  complete: CompleteFn = privilegedComplete,
): Promise<ReasoningGapSuggestion> {
  const passages = selectSuggestionPassages(gapLabel, candidates);
  if (passages.length === 0) return { status: "insufficient" };

  const listed = passages
    .map((passage, index) => {
      const when = passage.earlier
        ? `Earlier meeting, ${passage.dateLabel}. ${passage.kind === "attendance_note" ? "Attendance note." : "What was said."}`
        : "This meeting. What was said.";
      return `SOURCE ${index}\n${when}\n${passage.text}`;
    })
    .join("\n\n");

  let content: string;
  try {
    const result = await complete({
      systemPrompt: `You draft the reasoning a solicitor might record for one advice point. You may only restate a reason that a SOURCE already states. A passage that only repeats the advice, or only discusses the topic, is not a reason. Do not add a factor, a risk, a case, or a legal conclusion that is not in a source. If no source states why the advice was given, return {"status":"insufficient"}. If one does, return {"status":"proposed","text":"one or two sentences","quote":"an exact phrase of at least 12 characters copied from that source","sourceIndex":0}. Write in the first person, as the fee earner. Do not mention a transcript, a recording, or software. When the source is an earlier meeting, the sentences must say that this advice follows the reasoning given at that meeting and must include that meeting's date exactly as written in the source heading.`,
      userPrompt: `ADVICE POINT\n${gapLabel}\n\n${listed}`,
      maxTokens: 400,
      temperature: 0,
      responseFormat: "json_object",
    });
    content = result.content;
  } catch (error) {
    console.error("[REASONING_GAP_SUGGESTION] Draft failed", error);
    return { status: "insufficient" };
  }

  const parsed = parseJsonObject(content);
  if (!parsed || parsed.status !== "proposed") return { status: "insufficient" };
  const text = typeof parsed.text === "string" ? parsed.text.replace(/\s+/g, " ").trim() : "";
  const quote = typeof parsed.quote === "string" ? parsed.quote.trim() : "";
  const sourceIndex = typeof parsed.sourceIndex === "number" ? parsed.sourceIndex : -1;
  const passage = passages[sourceIndex];
  if (!text || !passage || !quoteAppearsInPassage(quote, passage.text)) {
    return { status: "insufficient" };
  }
  if (!suggestionDraftIsGrounded(text, [passage])) return { status: "insufficient" };
  if (passage.earlier && !text.includes(passage.dateLabel)) return { status: "insufficient" };

  return {
    status: "proposed",
    text,
    sourceLabel: suggestionSourceLabel(passage),
    passage,
  };
}
