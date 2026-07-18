import { z } from "zod";

export const VERIFICATION_WARNING_CATEGORIES = [
  "unsupported_content",
  "unsupported_attribution",
  "contradiction",
  "advice_without_reasoning",
  "verification_failure",
] as const;

export type VerificationWarningCategory = (typeof VERIFICATION_WARNING_CATEGORIES)[number];

export const VERIFICATION_RESOLVE_DISPOSITIONS = [
  "confirmed_professionally_derived",
  "dismissed",
] as const;

export type VerificationResolveDisposition = (typeof VERIFICATION_RESOLVE_DISPOSITIONS)[number];

export const verificationWarningLocationSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const verificationWarningResolutionSchema = z.object({
  disposition: z.enum(VERIFICATION_RESOLVE_DISPOSITIONS),
  reason: z.string().trim().min(1).max(2000),
  resolvedAt: z.string(),
  resolvedBy: z.string().min(1),
});

export const verificationWarningSchema = z.object({
  id: z.string().min(1),
  category: z.enum(VERIFICATION_WARNING_CATEGORIES),
  documentQuote: z.string(),
  explanation: z.string(),
  severity: z.literal("review_required").default("review_required"),
  documentLocation: verificationWarningLocationSchema.nullable().optional(),
  transcriptQuote: z.string().nullable().optional(),
  transcriptLocation: verificationWarningLocationSchema.nullable().optional(),
  resolution: verificationWarningResolutionSchema.nullable().optional(),
});

export type VerificationWarning = z.infer<typeof verificationWarningSchema>;

export const resolveVerificationWarningBodySchema = z.object({
  disposition: z.enum(VERIFICATION_RESOLVE_DISPOSITIONS),
  reason: z.string().trim().min(1, "A reason is required").max(2000),
});

/** Human-readable title for a single warning category. */
export function verificationCategoryTitle(category: VerificationWarningCategory): string {
  switch (category) {
    case "unsupported_attribution":
      return "Unsupported attribution";
    case "contradiction":
      return "Contradiction with meeting record";
    case "advice_without_reasoning":
      return "Advice without recorded reasoning";
    case "verification_failure":
      return "Automated verification incomplete";
    case "unsupported_content":
    default:
      return "Unsupported content";
  }
}

/** Panel headline summarizing open warnings by kind. */
export function summarizeOpenVerificationWarnings(warnings: VerificationWarning[]): string {
  const open = warnings.filter((w) => !w.resolution);
  if (open.length === 0) return "All flagged statements have been reviewed.";

  const unsupported = open.filter(
    (w) =>
      w.category === "unsupported_content" ||
      w.category === "unsupported_attribution" ||
      w.category === "contradiction",
  ).length;
  const advice = open.filter((w) => w.category === "advice_without_reasoning").length;
  const failures = open.filter((w) => w.category === "verification_failure").length;

  const parts: string[] = [];
  if (unsupported > 0) {
    parts.push(
      `${unsupported} statement${unsupported !== 1 ? "s" : ""} may introduce content that was not established at the meeting`,
    );
  }
  if (advice > 0) {
    parts.push(
      `${advice} advice passage${advice !== 1 ? "s" : ""} may be missing recorded reasoning`,
    );
  }
  if (failures > 0) {
    parts.push(
      `${failures} automated check${failures !== 1 ? "s" : ""} could not be completed`,
    );
  }
  return parts.join("; ") + ".";
}

export function findQuoteLocation(
  haystack: string,
  quote: string,
): { start: number; end: number } | null {
  const trimmed = quote.trim();
  if (!trimmed || !haystack) return null;

  const exact = haystack.indexOf(trimmed);
  if (exact >= 0) return { start: exact, end: exact + trimmed.length };

  // Soften curly quotes / dashes then retry
  const soften = (s: string) =>
    s
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-");
  const softHay = soften(haystack);
  const softQuote = soften(trimmed);
  const softIdx = softHay.indexOf(softQuote);
  if (softIdx >= 0) return { start: softIdx, end: softIdx + softQuote.length };

  // Whitespace-normalized search (offsets map only approximately)
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const nHay = norm(haystack);
  const nQuote = norm(trimmed);
  const nIdx = nHay.indexOf(nQuote);
  if (nIdx < 0) return null;
  return { start: nIdx, end: nIdx + nQuote.length };
}

/** Split legacy "quote — explanation" strings into parts. */
export function splitLegacyWarningText(text: string): { documentQuote: string; explanation: string } {
  const separators = [" — ", " – ", " - "];
  for (const sep of separators) {
    const idx = text.indexOf(sep);
    if (idx > 0) {
      return {
        documentQuote: text.slice(0, idx).trim(),
        explanation: text.slice(idx + sep.length).trim(),
      };
    }
  }
  return {
    documentQuote: text.trim(),
    explanation: "This statement could not be verified against the meeting record.",
  };
}

function inferCategoryFromText(text: string): VerificationWarningCategory {
  const lower = text.toLowerCase();
  if (lower.includes("[advice without reasoning]")) return "advice_without_reasoning";
  if (
    lower.includes("verification response could not be parsed") ||
    lower.includes("automated verification failed")
  ) {
    return "verification_failure";
  }
  if (
    lower.includes("i noted") ||
    lower.includes("i advised") ||
    lower.includes("attribution") ||
    lower.includes("attributes the use")
  ) {
    return "unsupported_attribution";
  }
  if (lower.includes("contradict")) return "contradiction";
  return "unsupported_content";
}

function newWarningId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `vw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Coerce DB / API values (legacy plain strings, partial objects, or structured warnings)
 * into VerificationWarning[].
 */
export function coerceVerificationWarnings(raw: unknown): VerificationWarning[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];

  const out: VerificationWarning[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      // JSON-encoded structured warning stored in a text[] cell
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          out.push(...coerceVerificationWarnings([parsed]));
          continue;
        } catch {
          // fall through as legacy prose
        }
      }
      const stripped = trimmed.replace(/^\[Advice without reasoning\]\s*/i, "");
      const { documentQuote, explanation } = splitLegacyWarningText(stripped);
      out.push({
        id: newWarningId(),
        category: inferCategoryFromText(trimmed),
        documentQuote,
        explanation,
        severity: "review_required",
        documentLocation: null,
        transcriptQuote: null,
        transcriptLocation: null,
        resolution: null,
      });
      continue;
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const parsed = verificationWarningSchema.safeParse({
        id: typeof record.id === "string" && record.id ? record.id : newWarningId(),
        category:
          typeof record.category === "string" &&
          (VERIFICATION_WARNING_CATEGORIES as readonly string[]).includes(record.category)
            ? record.category
            : inferCategoryFromText(
                [
                  record.documentQuote,
                  record.document_quote,
                  record.explanation,
                  record.statement,
                ]
                  .filter((v) => typeof v === "string")
                  .join(" "),
              ),
        documentQuote:
          (typeof record.documentQuote === "string" && record.documentQuote) ||
          (typeof record.document_quote === "string" && record.document_quote) ||
          (typeof record.offending_statement === "string" && record.offending_statement) ||
          (typeof record.statement === "string" && record.statement) ||
          (typeof record.quote === "string" && record.quote) ||
          "",
        explanation:
          (typeof record.explanation === "string" && record.explanation) ||
          (typeof record.issue === "string" && record.issue) ||
          (typeof record.reason === "string" && record.reason) ||
          (typeof record.rationale === "string" && record.rationale) ||
          "This statement could not be verified against the meeting record.",
        severity: "review_required",
        documentLocation: record.documentLocation ?? record.document_location ?? null,
        transcriptQuote:
          (typeof record.transcriptQuote === "string" && record.transcriptQuote) ||
          (typeof record.transcript_quote === "string" && record.transcript_quote) ||
          null,
        transcriptLocation: record.transcriptLocation ?? record.transcript_location ?? null,
        resolution: record.resolution ?? null,
      });
      if (parsed.success) {
        out.push(parsed.data);
      }
    }
  }
  return out;
}

/** Flatten a warning to searchable text (for harness / detection). */
export function verificationWarningSearchText(warning: VerificationWarning): string {
  return [warning.documentQuote, warning.explanation, warning.transcriptQuote ?? ""]
    .filter(Boolean)
    .join(" — ");
}

export function createVerificationWarning(
  partial: Omit<VerificationWarning, "id" | "severity"> &
    Partial<Pick<VerificationWarning, "id" | "severity">>,
): VerificationWarning {
  return {
    id: partial.id ?? newWarningId(),
    category: partial.category,
    documentQuote: partial.documentQuote,
    explanation: partial.explanation,
    severity: partial.severity ?? "review_required",
    documentLocation: partial.documentLocation ?? null,
    transcriptQuote: partial.transcriptQuote ?? null,
    transcriptLocation: partial.transcriptLocation ?? null,
    resolution: partial.resolution ?? null,
  };
}
