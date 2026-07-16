/**
 * Pre-generation extraction of relationship dates from a transcript.
 * The model reads dates; it must not compute durations (that is code-owned).
 */

import { privilegedComplete } from './llm/privilegedComplete';
import {
  computeRelationshipDurations,
  type PartialDate,
  type RelationshipDateInput,
  type RelationshipDurationResult,
} from './relationshipDuration';

export interface RelationshipDateExtractionResult {
  dates: RelationshipDateInput;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface RelationshipDateExtractionContext {
  /** Meeting/recording date as YYYY-MM-DD — anchors relative phrases */
  asOfIso: string;
  clientName?: string;
  matterReference?: string;
  title?: string;
}

/** Calendar YYYY-MM-DD from a Date (local components, matching UK long-date headers). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePrecision(raw: unknown): PartialDate['precision'] | null {
  if (raw === 'year' || raw === 'year-month' || raw === 'day') return raw;
  return null;
}

/**
 * Normalise one extracted date field. Invalid or incomplete payloads become null
 * (never invent a date from bad JSON).
 */
export function parsePartialDate(raw: unknown): PartialDate | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) return null;

  const precision = parsePrecision(raw.precision);
  const year = typeof raw.year === 'number' ? raw.year : Number(raw.year);
  if (!precision || !Number.isInteger(year) || year < 1900 || year > 2100) {
    return null;
  }

  if (precision === 'year') {
    return { precision: 'year', year };
  }

  const month = typeof raw.month === 'number' ? raw.month : Number(raw.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;

  if (precision === 'year-month') {
    return { precision: 'year-month', year, month };
  }

  const day = typeof raw.day === 'number' ? raw.day : Number(raw.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  return { precision: 'day', year, month, day };
}

export function parseRelationshipDateExtractionPayload(
  raw: unknown,
): RelationshipDateInput {
  if (!isPlainObject(raw)) {
    return {
      marriageDate: null,
      separationDate: null,
      cohabitationStartDate: null,
    };
  }

  return {
    marriageDate: parsePartialDate(raw.marriageDate),
    separationDate: parsePartialDate(raw.separationDate),
    cohabitationStartDate: parsePartialDate(raw.cohabitationStartDate),
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You are extracting relationship dates from a UK legal meeting transcript for a financial-remedy / family matter attendance note pipeline.

TASK: Return structured dates only. Do NOT calculate durations, years married, or years cohabiting — that is done in code after you return.

FIELDS (each may be a partial date object or null):
- marriageDate: when the parties married
- separationDate: when the parties separated / one party moved out (as stated)
- cohabitationStartDate: when the parties began living together / sharing a household BEFORE or aside from marriage

PARTIAL DATE SHAPE:
{ "precision": "year" | "year-month" | "day", "year": number, "month"?: 1-12, "day"?: 1-31 }
- year-only when only a year is stated ("2010", "summer of 2010" → prefer year unless a month is clear)
- year-month when month and year are stated ("June 2015", "September 2025")
- day only when a specific calendar day is stated
- null when the date was not stated

AS-OF / RELATIVE DATES:
You will be given the meeting date as YYYY-MM-DD. Resolve relative expressions against it ("November last year", "two years ago", "just before Bonfire Night" with a month already stated). Emit the resolved calendar fields, not the relative phrase.

ABSOLUTE ANTI-FABRICATION (DERIVE-DON'T-INVENT):
1. Extract ONLY dates actually stated in the transcript. If a date is absent, return null for that field.
2. Never invent a date from context, practice area, or what is "usual" in family matters.
3. Never back-calculate a date from a spoken duration ("we've been married ten years" does NOT give you a marriageDate).
4. COHABITATION IS STRICT: "met in 2009", "been together ever since", "been a couple since", or similar relationship-start language is NOT a cohabitation start. Cohabitation for this field means sharing a household / living together. Only set cohabitationStartDate when the transcript states they began living together, moved in together, cohabited, or shared a home from a given time. Otherwise cohabitationStartDate MUST be null.
5. Separation: moving out of the matrimonial home / "things ended" with a date may count as separationDate when that is how separation was dated at the meeting.

OUTPUT: JSON object only, exactly:
{
  "marriageDate": <partial date or null>,
  "separationDate": <partial date or null>,
  "cohabitationStartDate": <partial date or null>
}`;

/**
 * Extract marriage / separation / cohabitation-start dates from a corrected transcript.
 * Non-throwing on model failure: returns all-null dates with zero cost fields filled from the call when possible.
 */
export async function extractRelationshipDates(
  transcript: string,
  context: RelationshipDateExtractionContext,
): Promise<RelationshipDateExtractionResult> {
  const contextLines = [
    `Meeting date (as-of for relative expressions): ${context.asOfIso}`,
    context.title ? `Matter: ${context.title}` : null,
    context.clientName ? `Client: ${context.clientName}` : null,
    context.matterReference ? `Reference: ${context.matterReference}` : null,
  ].filter(Boolean);

  const userPrompt = `${contextLines.join('\n')}

TRANSCRIPT:
${transcript}

Return the JSON object with marriageDate, separationDate, and cohabitationStartDate.`;

  try {
    console.log('[RelationshipDates] Extracting relationship dates...');

    const completion = await privilegedComplete({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
      maxTokens: 800,
      responseFormat: 'json_object',
    });

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(completion.content || '{}');
    } catch (parseError) {
      console.error('[RelationshipDates] Failed to parse extraction JSON:', parseError);
      parsed = {};
    }

    const dates = parseRelationshipDateExtractionPayload(parsed);
    console.log(
      `[RelationshipDates] Extracted marriage=${dates.marriageDate ? dates.marriageDate.precision : 'null'}, ` +
        `separation=${dates.separationDate ? dates.separationDate.precision : 'null'}, ` +
        `cohabitation=${dates.cohabitationStartDate ? dates.cohabitationStartDate.precision : 'null'}. ` +
        `Cost: $${completion.cost.toFixed(4)}`,
    );

    return {
      dates,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      cost: completion.cost,
    };
  } catch (error: unknown) {
    console.error('[RelationshipDates] Extraction failed:', error);
    return {
      dates: {
        marriageDate: null,
        separationDate: null,
        cohabitationStartDate: null,
      },
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
  }
}

/** Family practice areas where relationship durations are material to the note. */
export function practiceAreaNeedsRelationshipDurations(
  practiceArea?: string | null,
): boolean {
  return (
    practiceArea === 'family_divorce_financial' ||
    practiceArea === 'family_children_arrangements'
  );
}

/**
 * Extract dates then compute durations. Safe on extraction failure (all unset facts).
 */
export async function extractAndComputeRelationshipDurations(
  transcript: string,
  context: RelationshipDateExtractionContext,
): Promise<{
  durations: RelationshipDurationResult;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}> {
  const extraction = await extractRelationshipDates(transcript, context);
  return {
    durations: computeRelationshipDurations(extraction.dates),
    inputTokens: extraction.inputTokens,
    outputTokens: extraction.outputTokens,
    cost: extraction.cost,
  };
}
