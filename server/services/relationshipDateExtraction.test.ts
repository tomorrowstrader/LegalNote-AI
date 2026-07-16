import { describe, expect, it } from 'vitest';
import {
  parsePartialDate,
  parseRelationshipDateExtractionPayload,
  toIsoDate,
} from './relationshipDateExtraction';

describe('toIsoDate', () => {
  it('formats local calendar date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 2, 16))).toBe('2026-03-16');
  });
});

describe('parsePartialDate', () => {
  it('accepts year, year-month, and day precisions', () => {
    expect(parsePartialDate({ precision: 'year', year: 2010 })).toEqual({
      precision: 'year',
      year: 2010,
    });
    expect(parsePartialDate({ precision: 'year-month', year: 2015, month: 6 })).toEqual({
      precision: 'year-month',
      year: 2015,
      month: 6,
    });
    expect(
      parsePartialDate({ precision: 'day', year: 2025, month: 11, day: 4 }),
    ).toEqual({ precision: 'day', year: 2025, month: 11, day: 4 });
  });

  it('returns null for missing, invalid, or incomplete payloads', () => {
    expect(parsePartialDate(null)).toBeNull();
    expect(parsePartialDate({ precision: 'year-month', year: 2015 })).toBeNull();
    expect(parsePartialDate({ precision: 'day', year: 2015, month: 6 })).toBeNull();
    expect(parsePartialDate({ precision: 'year', year: 1800 })).toBeNull();
    expect(parsePartialDate({ precision: 'month', year: 2015 })).toBeNull();
  });
});

describe('parseRelationshipDateExtractionPayload', () => {
  it('maps Bennett-style marriage and separation; leaves cohabitation null when absent', () => {
    const dates = parseRelationshipDateExtractionPayload({
      marriageDate: { precision: 'year-month', year: 2015, month: 6 },
      separationDate: { precision: 'year-month', year: 2025, month: 11 },
      cohabitationStartDate: null,
    });

    expect(dates.marriageDate).toEqual({
      precision: 'year-month',
      year: 2015,
      month: 6,
    });
    expect(dates.separationDate).toEqual({
      precision: 'year-month',
      year: 2025,
      month: 11,
    });
    expect(dates.cohabitationStartDate).toBeNull();
  });

  it('returns all-null on garbage payload', () => {
    expect(parseRelationshipDateExtractionPayload('nope')).toEqual({
      marriageDate: null,
      separationDate: null,
      cohabitationStartDate: null,
    });
  });
});
