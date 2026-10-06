import crypto from "crypto";
import {
  assembleRoleProposals,
  attendanceNoteToPlain,
  collapseWhitespace,
  findFlexibleSpan,
  keepPlaceableProposals,
  noteRoleError,
  proposeNameReplacements,
  resolvePassage,
  type NoteProposal,
  type NoteRole,
} from "@shared/noteCorrections";
import {
  privilegedComplete,
  type PrivilegedCompleteRequest,
  type PrivilegedCompleteResult,
} from "./llm/privilegedComplete";

export interface NoteCorrectionProposal extends NoteProposal {
  id: string;
}

export type NoteCorrectionMode = "selection" | "fact" | "replace" | "role";

export class NoteCorrectionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "NoteCorrectionError";
  }
}

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

function withIds(proposals: NoteProposal[]): NoteCorrectionProposal[] {
  return proposals.map((proposal) => ({
    ...proposal,
    id: crypto.randomUUID(),
  }));
}

function contextWindow(plain: string, selected: string): { before: string; after: string } {
  const span = findFlexibleSpan(plain, selected);
  if (!span) return { before: "", after: "" };
  return {
    before: plain.slice(Math.max(0, span.start - 500), span.start),
    after: plain.slice(span.end, span.end + 500),
  };
}

async function rewriteSelection(
  plain: string,
  selectedText: string,
  instruction: string,
  complete: CompleteFn,
): Promise<NoteProposal[]> {
  const { before, after } = contextWindow(plain, selectedText);
  const result = await complete({
    systemPrompt: `You revise one passage of a solicitor's attendance note. Change only what the instruction requires. Keep the same register and every fact the instruction does not correct. Return JSON only: {"replacement":"the revised passage"}. The replacement is the passage alone, not the surrounding context, and it contains no markdown headings that were not already in the passage.`,
    userPrompt: `PASSAGE:
${selectedText}

CONTEXT BEFORE:
${before || "(start of note)"}

CONTEXT AFTER:
${after || "(end of note)"}

INSTRUCTION:
${instruction}`,
    maxTokens: 1500,
    temperature: 0,
    responseFormat: "json_object",
  });

  const parsed = parseJsonObject(result.content);
  const replacement = typeof parsed?.replacement === "string"
    ? parsed.replacement.replace(/\s*\n\s*/g, " ").trim()
    : "";
  const original = selectedText.trim();
  if (!replacement || replacement.length > 4000) return [];
  if (collapseWhitespace(replacement) === collapseWhitespace(original)) return [];
  if (!findFlexibleSpan(plain, original)) return [];
  return [{ original, replacement, reason: instruction.slice(0, 300) }];
}

async function proposeFacts(
  plain: string,
  instruction: string,
  complete: CompleteFn,
): Promise<{ kept: NoteProposal[]; unplaced: NoteProposal[] }> {
  const note = plain.length > 80000 ? `${plain.slice(0, 80000)}\n\n[Note truncated for length]` : plain;
  const result = await complete({
    systemPrompt: `You propose the smallest set of exact replacements so an attendance note matches a correction from the fee earner. You do not rewrite the note.

Rules:
- original must be copied from the note, usually one sentence, and must appear in the note.
- Quote the shortest span that makes the correction true.
- Do not quote more than 500 characters.
- Leave a sentence out when it is already correct.
- Do not add sections.
- replacement is the corrected sentence only.

Return JSON only: {"proposals":[{"original":"...","replacement":"...","reason":"..."}]}`,
    userPrompt: `NOTE:
${note}

CORRECTION:
${instruction}`,
    maxTokens: 4000,
    temperature: 0,
    responseFormat: "json_object",
  });

  const parsed = parseJsonObject(result.content);
  const raw = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
  const proposals: NoteProposal[] = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.original !== "string" || typeof record.replacement !== "string") return [];
    return [{
      original: record.original,
      replacement: record.replacement,
      reason: typeof record.reason === "string" ? record.reason : "",
    }];
  });
  return keepPlaceableProposals(plain, proposals);
}

function roleSentenceRules(role: NoteRole): string {
  const client = role.clientName.trim() || "the person the note is about";
  const representative = role.representativeName.trim();
  const rules = [
    "Change a sentence only when it still does one of these:",
  ];
  if (!role.clientPresent && representative) {
    rules.push(`- treats ${representative} as the client`);
    rules.push(`- records what ${representative} said as instructions from ${client}`);
  }
  if (!role.instructionsTaken) {
    rules.push("- records that instructions have been taken, or that the firm has been retained");
  }
  if (!role.adviserIsFeeEarner && role.adviserName.trim()) {
    rules.push(`- attributes the advice to someone other than ${role.adviserName.trim()}`);
  }
  if (rules.length === 1) {
    rules.push("- records the wrong person as the client, or the wrong person as having given the advice");
  }
  return rules.join("\n");
}

async function proposeRoleSentences(
  plain: string,
  role: NoteRole,
  complete: CompleteFn,
): Promise<NoteProposal[]> {
  const note = plain.length > 80000 ? `${plain.slice(0, 80000)}\n\n[Note truncated for length]` : plain;
  const client = role.clientName.trim() || "not named";
  const adviser = role.adviserIsFeeEarner ? "the fee earner who prepared the note" : role.adviserName.trim();
  const result = await complete({
    systemPrompt: `You propose the smallest set of exact sentence replacements so an attendance note matches who the note is about. You do not rewrite the note. You do not add an opening sentence. You do not replace the words "the client" with "the prospective client"; that replacement is done separately.

${roleSentenceRules(role)}

Rules:
- original must be copied from the note, usually one sentence, and must appear in the note.
- Quote the shortest span that makes the correction true.
- Do not quote more than 500 characters.
- Leave a sentence out when it is already right.
- replacement is the corrected sentence only.

Return JSON only: {"proposals":[{"original":"...","replacement":"...","reason":"..."}]}`,
    userPrompt: `WHO THIS NOTE IS ABOUT:
Person the note is about: ${client}
Instructions taken: ${role.instructionsTaken ? "yes" : "no. They are the prospective client."}
Present at the meeting: ${role.clientPresent ? "yes" : "no"}
${role.clientPresent ? "" : `Attended and spoke on their behalf: ${role.representativeName.trim()}\n`}Adviser: ${adviser}
${role.attendees.trim() ? `Also present: ${role.attendees.trim()}\n` : ""}
NOTE:
${note}`,
    maxTokens: 4000,
    temperature: 0,
    responseFormat: "json_object",
  });

  const parsed = parseJsonObject(result.content);
  const raw = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.original !== "string" || typeof record.replacement !== "string") return [];
    return [{
      original: record.original,
      replacement: record.replacement,
      reason: typeof record.reason === "string" ? record.reason : "Who this note is about",
    }];
  });
}

export async function proposeNoteCorrection(
  input: {
    mode: NoteCorrectionMode;
    content: string;
    instruction?: string;
    selectedText?: string;
    find?: string;
    replaceWith?: string;
    role?: NoteRole;
  },
  complete: CompleteFn = privilegedComplete,
): Promise<{ proposals: NoteCorrectionProposal[]; unplacedCount: number }> {
  const plain = attendanceNoteToPlain(input.content);

  if (input.mode === "replace") {
    const proposals = proposeNameReplacements(plain, input.find ?? "", input.replaceWith ?? "");
    return { proposals: withIds(proposals), unplacedCount: 0 };
  }

  if (input.mode === "selection") {
    const selected = input.selectedText?.trim() ?? "";
    const instruction = input.instruction?.trim() ?? "";
    const passage = resolvePassage(plain, selected);
    if (!passage) {
      throw new NoteCorrectionError("That passage is not in the note.", 400);
    }
    const kept = await rewriteSelection(plain, passage, instruction, complete);
    return { proposals: withIds(kept), unplacedCount: 0 };
  }

  if (input.mode === "role") {
    const role = input.role;
    if (!role) throw new NoteCorrectionError("Say who this note is about.", 400);
    const roleError = noteRoleError(role);
    if (roleError) throw new NoteCorrectionError(roleError, 400);
    let modelSentences: NoteProposal[] = [];
    try {
      modelSentences = await proposeRoleSentences(plain, role, complete);
    } catch (modelError) {
      console.error("[NOTE_CORRECTION] Role sentences were not proposed", modelError);
    }
    const { kept, unplaced } = assembleRoleProposals(plain, role, modelSentences);
    return { proposals: withIds(kept), unplacedCount: unplaced.length };
  }

  const { kept, unplaced } = await proposeFacts(plain, input.instruction?.trim() ?? "", complete);
  return { proposals: withIds(kept), unplacedCount: unplaced.length };
}
