/**
 * Relationship-duration arithmetic — code-owned, never model-computed.
 * Rounding: floor completed years (never round up).
 * Partial dates use conservative bounds so fuzzy sources cannot overstate duration.
 */

export type DatePrecision = 'year' | 'year-month' | 'day';

export interface PartialDate {
  precision: DatePrecision;
  year: number;
  /** 1–12 when precision is year-month or day */
  month?: number;
  /** 1–31 when precision is day */
  day?: number;
}

export interface RelationshipDateInput {
  marriageDate: PartialDate | null;
  separationDate: PartialDate | null;
  cohabitationStartDate: PartialDate | null;
}

export interface RelationshipDurationResult {
  /** Floor of completed calendar years; null if either endpoint missing */
  marriageYears: number | null;
  cohabitationYears: number | null;
  /** Earliest of marriage / cohabitation start → separation */
  totalYears: number | null;
  /** Prompt-ready facts, e.g. "approximately 10 years", or null */
  marriageDurationFact: string | null;
  cohabitationDurationFact: string | null;
  totalDurationFact: string | null;
}

export const DURATION_COULD_NOT_BE_ESTABLISHED = 'could not be established';

interface Ymd {
  year: number;
  month: number;
  day: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Latest instant in the stated precision — minimises duration from this start. */
function startBound(d: PartialDate): Ymd {
  if (d.precision === 'day' && d.month != null && d.day != null) {
    return { year: d.year, month: d.month, day: d.day };
  }
  if (d.precision === 'year-month' && d.month != null) {
    return { year: d.year, month: d.month, day: daysInMonth(d.year, d.month) };
  }
  return { year: d.year, month: 12, day: 31 };
}

/** Earliest instant in the stated precision — minimises duration to this end. */
function endBound(d: PartialDate): Ymd {
  if (d.precision === 'day' && d.month != null && d.day != null) {
    return { year: d.year, month: d.month, day: d.day };
  }
  if (d.precision === 'year-month' && d.month != null) {
    return { year: d.year, month: d.month, day: 1 };
  }
  return { year: d.year, month: 1, day: 1 };
}

function compareYmd(a: Ymd, b: Ymd): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Floor of completed calendar years from start → end.
 * Never rounds up. Returns null if end is before start.
 */
export function floorCompletedYears(start: PartialDate, end: PartialDate): number | null {
  const s = startBound(start);
  const e = endBound(end);
  if (compareYmd(e, s) < 0) return null;

  let years = e.year - s.year;
  if (e.month < s.month || (e.month === s.month && e.day < s.day)) {
    years -= 1;
  }
  return years < 0 ? null : years;
}

function formatApproxYears(years: number): string {
  return `approximately ${years} ${years === 1 ? 'year' : 'years'}`;
}

function earlierStart(
  a: PartialDate | null,
  b: PartialDate | null,
): PartialDate | null {
  if (!a) return b;
  if (!b) return a;
  return compareYmd(startBound(a), startBound(b)) <= 0 ? a : b;
}

export function computeRelationshipDurations(
  input: RelationshipDateInput,
): RelationshipDurationResult {
  const marriageYears =
    input.marriageDate && input.separationDate
      ? floorCompletedYears(input.marriageDate, input.separationDate)
      : null;

  const cohabitationYears =
    input.cohabitationStartDate && input.separationDate
      ? floorCompletedYears(input.cohabitationStartDate, input.separationDate)
      : null;

  // Total span requires a stated cohabitation/relationship-start date. Marriage
  // alone is not a substitute — falling back to marriage years under a "total
  // relationship span" label invents a figure the dates do not support.
  const totalYears =
    input.cohabitationStartDate && input.separationDate
      ? floorCompletedYears(
          earlierStart(input.marriageDate, input.cohabitationStartDate)!,
          input.separationDate,
        )
      : null;

  return {
    marriageYears,
    cohabitationYears,
    totalYears,
    marriageDurationFact: marriageYears != null ? formatApproxYears(marriageYears) : null,
    cohabitationDurationFact:
      cohabitationYears != null ? formatApproxYears(cohabitationYears) : null,
    totalDurationFact: totalYears != null ? formatApproxYears(totalYears) : null,
  };
}

/** Fact line for prompt injection when a duration could not be computed. */
export function durationFactOrUnset(fact: string | null): string {
  return fact ?? DURATION_COULD_NOT_BE_ESTABLISHED;
}

/**
 * Authoritative block appended to note-generation (and verifier) prompts.
 * Always lists all three durations so nulls surface as "could not be established".
 */
export function formatRelationshipDurationFactsBlock(
  result: RelationshipDurationResult,
): string {
  return `SYSTEM-COMPUTED RELATIONSHIP DURATION FACTS (authoritative — use these figures; do not recalculate):
- Marriage duration: ${durationFactOrUnset(result.marriageDurationFact)}
- Cohabitation duration: ${durationFactOrUnset(result.cohabitationDurationFact)}
- Total relationship / cohabitation span: ${durationFactOrUnset(result.totalDurationFact)}`;
}
