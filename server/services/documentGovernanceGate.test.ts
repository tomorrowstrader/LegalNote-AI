import { describe, expect, it, vi } from 'vitest';
import {
  logDocumentGovernanceViolations,
  scanDocumentGovernanceViolations,
} from './documentGovernanceGate';

describe('documentGovernanceGate', () => {
  it('detects Speaker [A-Z] labels in output', () => {
    const violations = scanDocumentGovernanceViolations('Speaker A advised the client.');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.type).toBe('speaker_label');
  });

  it('detects transcript, recording, and session references', () => {
    const text =
      'Not captured in the transcript. This recording was brief. Not recorded in this session.';
    const violations = scanDocumentGovernanceViolations(text);
    expect(violations.map((v) => v.type)).toEqual([
      'transcript_reference',
      'recording_reference',
      'session_reference',
    ]);
  });

  it('returns no violations for governed-style output', () => {
    const text = 'I advised the client that the matter would proceed. This was not discussed on this occasion.';
    expect(scanDocumentGovernanceViolations(text)).toEqual([]);
  });

  it('logs violations in warn mode without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const violations = logDocumentGovernanceViolations(
      'Speaker B confirmed the position in the transcript.',
      'telephone_call',
      { caseId: 'case-123' },
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.some((call) => String(call[1]).includes('telephone_call'))).toBe(true);
    warnSpy.mockRestore();
  });
});
