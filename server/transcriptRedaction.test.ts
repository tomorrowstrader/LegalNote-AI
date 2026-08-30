import { describe, expect, it } from 'vitest';
import { validateNewTranscriptRedaction } from './transcriptRedaction';

const utterance = { start: 1000, end: 5000 };

describe('validateNewTranscriptRedaction', () => {
  it('allows full segment redaction after partial redactions on the same utterance', () => {
    const current = [
      {
        id: 'partial-1',
        start: utterance.start,
        end: utterance.end,
        textStart: 10,
        textEnd: 20,
      },
    ];

    const result = validateNewTranscriptRedaction(current, utterance);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.baseRedactions).toHaveLength(0);
    expect(result.supersededPartialIds).toEqual(['partial-1']);
  });

  it('blocks duplicate full segment redaction', () => {
    const current = [
      {
        id: 'full-1',
        start: utterance.start,
        end: utterance.end,
      },
    ];

    const result = validateNewTranscriptRedaction(current, utterance);

    expect(result).toEqual({
      ok: false,
      message: 'This segment is already fully redacted',
    });
  });

  it('blocks partial redaction when segment is already fully redacted', () => {
    const current = [
      {
        id: 'full-1',
        start: utterance.start,
        end: utterance.end,
      },
    ];

    const result = validateNewTranscriptRedaction(current, {
      ...utterance,
      textStart: 5,
      textEnd: 12,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('already fully redacted');
  });

  it('allows non-overlapping partial redactions on the same utterance', () => {
    const current = [
      {
        id: 'partial-1',
        start: utterance.start,
        end: utterance.end,
        textStart: 0,
        textEnd: 5,
      },
    ];

    const result = validateNewTranscriptRedaction(current, {
      ...utterance,
      textStart: 10,
      textEnd: 15,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.baseRedactions).toHaveLength(1);
    expect(result.supersededPartialIds).toEqual([]);
  });

  it('blocks overlapping partial redactions on the same utterance', () => {
    const current = [
      {
        id: 'partial-1',
        start: utterance.start,
        end: utterance.end,
        textStart: 0,
        textEnd: 10,
      },
    ];

    const result = validateNewTranscriptRedaction(current, {
      ...utterance,
      textStart: 5,
      textEnd: 15,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('partial redaction');
  });
});
