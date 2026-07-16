import { describe, expect, it } from 'vitest';
import {
  computeRelationshipDurations,
  durationFactOrUnset,
  DURATION_COULD_NOT_BE_ESTABLISHED,
  floorCompletedYears,
  formatRelationshipDurationFactsBlock,
  type PartialDate,
} from './relationshipDuration';

const y = (year: number): PartialDate => ({ precision: 'year', year });
const ym = (year: number, month: number): PartialDate => ({
  precision: 'year-month',
  year,
  month,
});
const ymd = (year: number, month: number, day: number): PartialDate => ({
  precision: 'day',
  year,
  month,
  day,
});

describe('floorCompletedYears', () => {
  it('floors completed years and never rounds up (Bennett: Jun 2015 → Nov 2025 = 10)', () => {
    expect(floorCompletedYears(ym(2015, 6), ym(2025, 11))).toBe(10);
  });

  it('does not round up when months fall short of another year', () => {
    // Jun 2015 → May 2025 = 9 years 11 months → floor 9
    expect(floorCompletedYears(ym(2015, 6), ym(2025, 5))).toBe(9);
  });

  it('returns 0 when less than one completed year', () => {
    expect(floorCompletedYears(ym(2025, 1), ym(2025, 11))).toBe(0);
  });

  it('handles full-day precision with floor', () => {
    expect(floorCompletedYears(ymd(2015, 6, 15), ymd(2025, 11, 5))).toBe(10);
    expect(floorCompletedYears(ymd(2015, 6, 15), ymd(2025, 6, 14))).toBe(9);
  });

  it('year-only dates use conservative bounds (never overstate)', () => {
    // 2010-12-31 → 2025-01-01 = 14 completed years
    expect(floorCompletedYears(y(2010), y(2025))).toBe(14);
  });

  it('returns null when end is before start', () => {
    expect(floorCompletedYears(ym(2025, 11), ym(2015, 6))).toBeNull();
  });
});

describe('computeRelationshipDurations', () => {
  it('Bennett marriage dates: approximately 10 years; null cohabitation when absent', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2015, 6),
      separationDate: ym(2025, 11),
      cohabitationStartDate: null,
    });

    expect(result.marriageYears).toBe(10);
    expect(result.marriageDurationFact).toBe('approximately 10 years');
    expect(result.cohabitationYears).toBeNull();
    expect(result.cohabitationDurationFact).toBeNull();
    expect(result.totalYears).toBeNull();
    expect(result.totalDurationFact).toBeNull();
    expect(durationFactOrUnset(result.cohabitationDurationFact)).toBe(
      DURATION_COULD_NOT_BE_ESTABLISHED,
    );
    expect(durationFactOrUnset(result.totalDurationFact)).toBe(
      DURATION_COULD_NOT_BE_ESTABLISHED,
    );
  });

  it('does not set total span from marriage alone when cohabitation start is null', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2015, 6),
      separationDate: ym(2025, 11),
      cohabitationStartDate: null,
    });

    expect(result.marriageDurationFact).toBe('approximately 10 years');
    expect(result.totalDurationFact).toBeNull();
    expect(durationFactOrUnset(result.totalDurationFact)).toBe(
      DURATION_COULD_NOT_BE_ESTABLISHED,
    );
  });

  it('returns null facts when marriage date is missing', () => {
    const result = computeRelationshipDurations({
      marriageDate: null,
      separationDate: ym(2025, 11),
      cohabitationStartDate: null,
    });

    expect(result.marriageYears).toBeNull();
    expect(result.marriageDurationFact).toBeNull();
    expect(durationFactOrUnset(result.marriageDurationFact)).toBe(
      DURATION_COULD_NOT_BE_ESTABLISHED,
    );
  });

  it('returns null facts when separation date is missing', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2015, 6),
      separationDate: null,
      cohabitationStartDate: y(2008),
    });

    expect(result.marriageYears).toBeNull();
    expect(result.cohabitationYears).toBeNull();
    expect(result.totalYears).toBeNull();
  });

  it('computes cohabitation and total when cohabitation start is stated', () => {
    // Conservative year-only 2008 → Nov 2025: 2008-12-31 → 2025-11-01 = 16 years
    const result = computeRelationshipDurations({
      marriageDate: ym(2010, 7),
      separationDate: ym(2025, 11),
      cohabitationStartDate: y(2008),
    });

    expect(result.marriageYears).toBe(15);
    expect(result.marriageDurationFact).toBe('approximately 15 years');
    expect(result.cohabitationYears).toBe(16);
    expect(result.cohabitationDurationFact).toBe('approximately 16 years');
    expect(result.totalYears).toBe(16);
    expect(result.totalDurationFact).toBe('approximately 16 years');
  });

  it('year-only marriage and separation still yield approximate years', () => {
    const result = computeRelationshipDurations({
      marriageDate: y(2010),
      separationDate: y(2025),
      cohabitationStartDate: null,
    });

    expect(result.marriageYears).toBe(14);
    expect(result.marriageDurationFact).toBe('approximately 14 years');
  });

  it('singular year wording for exactly one completed year', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2024, 3),
      separationDate: ym(2025, 4),
      cohabitationStartDate: null,
    });

    expect(result.marriageYears).toBe(1);
    expect(result.marriageDurationFact).toBe('approximately 1 year');
  });
});

describe('formatRelationshipDurationFactsBlock', () => {
  it('omits null cohabitation/total lines and injects only-marriage guard', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2015, 6),
      separationDate: ym(2025, 11),
      cohabitationStartDate: null,
    });
    const block = formatRelationshipDurationFactsBlock(result);
    expect(block).toContain('SYSTEM-COMPUTED RELATIONSHIP DURATION FACTS');
    expect(block).toContain('Marriage duration: approximately 10 years');
    expect(block).not.toContain('Cohabitation duration:');
    expect(block).not.toContain('Total relationship / cohabitation span:');
    expect(block).not.toMatch(/Cohabitation duration:\s*could not be established/i);
    expect(block).not.toMatch(/Total relationship \/ cohabitation span:\s*could not be established/i);
    expect(block).toContain(
      'Only the marriage duration above is authoritative. Do not state a cohabitation duration or total relationship span, and do not announce that either could not be established.',
    );
  });

  it('emits marriage and cohabitation lines when both are computed', () => {
    const result = computeRelationshipDurations({
      marriageDate: ym(2013, 6),
      separationDate: ym(2025, 11),
      cohabitationStartDate: y(2010),
    });
    const block = formatRelationshipDurationFactsBlock(result);
    expect(block).toContain('Marriage duration:');
    expect(block).toContain('Cohabitation duration:');
    expect(block).toContain('Total relationship / cohabitation span:');
    expect(block).not.toContain('Only the marriage duration above is authoritative');
    expect(block).not.toContain(DURATION_COULD_NOT_BE_ESTABLISHED);
  });
});
