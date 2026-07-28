import { describe, expect, it } from 'vitest';
import { normalizeAttendanceSectionLabels } from './attendanceNoteFormat';

describe('normalizeAttendanceSectionLabels', () => {
  it('puts glued subheadings on their own lines and bolds only the label', () => {
    const input =
      'The client described the nature of his work on the railway.Advice given:I advised the client on the legal framework.';
    const result = normalizeAttendanceSectionLabels(input);

    expect(result).toContain('railway.\n\n**Advice given:**\n\nI advised the client');
    expect(result).not.toMatch(/\*\*Advice given:\*\*[^\n]/);
  });

  it('unwraps bold that incorrectly spans label and body', () => {
    const messy = '**What was discussed: The client explained the facts in detail**';
    const result = normalizeAttendanceSectionLabels(messy);

    expect(result).toMatch(/^\*\*What was discussed:\*\*\n\nThe client explained/m);
    expect(result).not.toMatch(/\*\*What was discussed: The client/);
  });

  it('closes unclosed bold on a label line so body is not bold', () => {
    const input = `**What was discussed:
The client explained everything that happened.
**Advice given:**
I advised the client.`;
    const result = normalizeAttendanceSectionLabels(input);

    expect(result).toContain('**What was discussed:**\n\nThe client explained');
    expect(result).toContain('**Advice given:**\n\nI advised the client');
  });

  it('normalizes all standard section labels', () => {
    const input = `What was discussed:
Facts.

Key points advised:
- Point one

Reasoning behind advice and decisions:
Because X.

Client's instructions and response:
Agreed.`;
    const result = normalizeAttendanceSectionLabels(input);

    expect(result).toContain('**What was discussed:**\n\nFacts.');
    expect(result).toContain('**Key points advised:**\n\n- Point one');
    expect(result).toContain('**Reasoning behind advice and decisions:**\n\nBecause X.');
    expect(result).toContain("**Client's instructions and response:**\n\nAgreed.");
  });

  it('inserts a blank line when label and body share a soft line break', () => {
    const input = `**What was discussed:**
The client stated the facts.

**Advice given:**
I advised the client.`;
    const result = normalizeAttendanceSectionLabels(input);

    expect(result).toContain('**What was discussed:**\n\nThe client stated');
    expect(result).toContain('**Advice given:**\n\nI advised the client');
  });

  it('keeps a blank line after numbered topic headings', () => {
    const input = `**1. BACKGROUND AND STATUS OF THE TRANSACTION**
**What was discussed:**
Facts.`;
    const result = normalizeAttendanceSectionLabels(input);

    expect(result).toContain(
      '**1. BACKGROUND AND STATUS OF THE TRANSACTION**\n\n**What was discussed:**\n\nFacts.',
    );
  });

  it('is idempotent', () => {
    const once = normalizeAttendanceSectionLabels(
      'railway.Advice given:I advised.\n\nKey points advised:\n- One',
    );
    expect(normalizeAttendanceSectionLabels(once)).toBe(once);
  });
});
