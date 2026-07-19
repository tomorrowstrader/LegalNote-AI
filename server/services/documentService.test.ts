import { describe, expect, it, vi } from 'vitest';
import {
  DocumentService,
  formatRevisionInstructions,
  looksLikeTruncatedDocumentBody,
  joinDocumentContinuation,
  type CaseMetadata,
} from './documentService';

const metadata: CaseMetadata = {
  title: 'Test Matter',
  clientName: 'Test Client',
  matterReference: 'TEST/001',
  recordingDate: '14 July 2026',
  feeEarnerName: 'Jane Smith',
};

describe('looksLikeTruncatedDocumentBody', () => {
  it('detects mid-sentence cutoff', () => {
    expect(
      looksLikeTruncatedDocumentBody(
        'In the absence of a will, the intestacy rules apply; given the client\'s current marital status, this may not produce',
      ),
    ).toBe(true);
  });

  it('accepts complete sentences', () => {
    expect(
      looksLikeTruncatedDocumentBody(
        'The client confirmed his understanding and thanked me.',
      ),
    ).toBe(false);
  });
});

describe('joinDocumentContinuation', () => {
  it('joins mid-sentence with a space', () => {
    expect(joinDocumentContinuation('this may not produce', 'the intended outcome.')).toBe(
      'this may not produce the intended outcome.',
    );
  });
});

describe('DocumentService.generateAttendanceNote', () => {
  it('formats metadata on separate lines and bolds standard section labels', async () => {
    const service = new DocumentService({
      chatCompletion: vi.fn().mockResolvedValue({
        content: `**MATTERS DISCUSSED**

**1. TEST TOPIC**

What was discussed:
The facts.

Advice given:
I advised the client.

Client's instructions and response:
The client agreed.`,
        inputTokens: 10,
        outputTokens: 20,
        cost: 0,
      }),
    });

    const result = await service.generateAttendanceNote('Meeting text', {
      ...metadata,
      meetingStartTime: '10:37',
      durationDisplay: '10 minutes',
      units: 2,
      feeEarnerDisplayName: 'Jane Smith, Solicitor',
    });

    expect(result.content).toContain('**ATTENDANCE NOTE**');
    expect(result.content).toContain(
      '**File Ref:** TEST/001  \n' +
      '**Advisor:** Jane Smith, Solicitor\n\n' +
      '**Client Name:** Test Client  \n' +
      '**Date:** 14 July 2026\n\n' +
      '**Time Spent (Units):** 2  \n' +
      '**Duration:** 10 minutes',
    );
    expect(result.content).not.toContain('**MATTER:**');
    expect(result.content).not.toContain('**CLIENT:**');
    expect(result.content).toContain('**What was discussed:**');
    expect(result.content).toContain('**Advice given:**');
    expect(result.content).toContain("**Client's instructions and response:**");
  });

  it('continues generation when the first pass is truncated mid-sentence', async () => {
    const chatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        content:
          '**MATTERS DISCUSSED**\n\nIn the absence of a will, the intestacy rules apply; this may not produce',
        inputTokens: 100,
        outputTokens: 4000,
        cost: 0.01,
      })
      .mockResolvedValueOnce({
        content: 'the outcome the client intends under the intestacy rules.',
        inputTokens: 50,
        outputTokens: 40,
        cost: 0.002,
      });

    const service = new DocumentService({ chatCompletion });
    const result = await service.generateAttendanceNote('Long meeting transcript.', metadata);

    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(chatCompletion.mock.calls[0][0].maxTokens).toBeGreaterThanOrEqual(8000);
    expect(result.content).toContain('this may not produce the outcome the client intends');
    expect(result.content).toContain('legal professional privilege');
    expect(result.outputTokens).toBe(4040);
  });

  it('continues when Bedrock explicitly reports max_tokens despite sentence punctuation', async () => {
    const chatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        content: '**MATTERS DISCUSSED**\n\nThe first section is complete.',
        inputTokens: 100,
        outputTokens: 16384,
        cost: 0.01,
        stopReason: 'max_tokens',
      })
      .mockResolvedValueOnce({
        content: '**2. NEXT SECTION**\n\nThe remaining section is complete.',
        inputTokens: 50,
        outputTokens: 100,
        cost: 0.002,
        stopReason: 'end_turn',
      });

    const result = await new DocumentService({ chatCompletion }).generateAttendanceNote(
      'Long meeting transcript.',
      metadata,
    );

    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('**2. NEXT SECTION**');
  });

  it('routes short transcripts through the governed attendance note prompt', async () => {
    const service = new DocumentService({
      chatCompletion: vi.fn().mockResolvedValue({
        content: '**MATTERS DISCUSSED**\n\nClient consent to audio recording obtained.',
        inputTokens: 10,
        outputTokens: 20,
        cost: 0,
      }),
    });

    const generateDocumentSpy = vi
      .spyOn(service as unknown as { generateDocument: (...args: unknown[]) => Promise<unknown> }, 'generateDocument')
      .mockResolvedValue({
        content: '**MATTERS DISCUSSED**\n\nClient consent to audio recording obtained.',
        inputTokens: 10,
        outputTokens: 20,
        cost: 0,
      });

    const shortUtterances = [
      { text: 'Do you consent to being recorded?', start: 0, end: 2000 },
      { text: 'Yes.', start: 2500, end: 3000 },
    ];

    await service.generateAttendanceNote(
      '[Speaker A]: Do you consent to being recorded?\n[Speaker B]: Yes.',
      metadata,
      undefined,
      shortUtterances,
    );

    expect(generateDocumentSpy).toHaveBeenCalledOnce();
    const systemPrompt = generateDocumentSpy.mock.calls[0]?.[0] as string;
    expect(systemPrompt).toContain('BOUNDARY OF DERIVATION');
    expect(systemPrompt).toContain('RELATIONSHIP DURATIONS (SYSTEM-SUPPLIED)');
    expect(systemPrompt).toContain('£48,000 a year');
    expect(systemPrompt).toContain('YOU ARE THE FEE EARNER');
    expect(systemPrompt).not.toContain('brief file note for a short recording');
    expect(systemPrompt).not.toContain(
      'the marriage has therefore subsisted for some 11 years',
    );
  });

  it('injects system-computed relationship duration facts into the user prompt', async () => {
    const service = new DocumentService({
      chatCompletion: vi.fn().mockResolvedValue({
        content: '**MATTERS DISCUSSED**\n\nClient consent to audio recording obtained.',
        inputTokens: 10,
        outputTokens: 20,
        cost: 0,
      }),
    });

    const generateDocumentSpy = vi
      .spyOn(service as unknown as { generateDocument: (...args: unknown[]) => Promise<unknown> }, 'generateDocument')
      .mockResolvedValue({
        content: '**MATTERS DISCUSSED**\n\nClient consent to audio recording obtained.',
        inputTokens: 10,
        outputTokens: 20,
        cost: 0,
      });

    const { computeRelationshipDurations } = await import('./relationshipDuration');
    const relationshipDurations = computeRelationshipDurations({
      marriageDate: { precision: 'year-month', year: 2015, month: 6 },
      separationDate: { precision: 'year-month', year: 2025, month: 11 },
      cohabitationStartDate: null,
    });

    await service.generateAttendanceNote(
      '[Speaker A]: We married in June 2015.\n[Speaker B]: I moved out in November 2025.',
      { ...metadata, relationshipDurations },
    );

    const userPrompt = generateDocumentSpy.mock.calls[0]?.[1] as string;
    expect(userPrompt).toContain('SYSTEM-COMPUTED RELATIONSHIP DURATION FACTS');
    expect(userPrompt).toContain('Marriage duration: approximately 10 years');
    expect(userPrompt).not.toContain('Cohabitation duration:');
    expect(userPrompt).toContain(
      'Only the marriage duration above is authoritative. Do not state a cohabitation duration or total relationship span, and do not announce that either could not be established.',
    );
  });
});

describe('DocumentService verification capacity', () => {
  it('uses the long-document output budget for structured verification', async () => {
    const chatCompletion = vi.fn().mockResolvedValue({
      content: '{"unverifiable_statements":[],"advice_without_reasoning":[]}',
      inputTokens: 10_000,
      outputTokens: 20,
      cost: 0.03,
      stopReason: 'end_turn',
    });
    const service = new DocumentService({ chatCompletion });

    const result = await service.verifyDocumentAgainstTranscript(
      'A long generated attendance note.',
      'A long source transcript.',
    );

    expect(result.warnings).toEqual([]);
    expect(chatCompletion.mock.calls[0][0].maxTokens).toBe(16384);
  });
});

describe('formatRevisionInstructions', () => {
  it('includes previous content and fee earner reason', () => {
    const block = formatRevisionInstructions({
      previousContent: 'Previous note body',
      reason: 'Expand next steps',
    });
    expect(block).toContain('FURTHER VERSION — MANDATORY');
    expect(block).toContain('Previous note body');
    expect(block).toContain('Expand next steps');
  });
});

describe('DocumentService further version revision', () => {
  it('passes revision context into generation at temperature 0', async () => {
    const chatCompletion = vi.fn().mockResolvedValue({
      content: '**What we discussed**\n\nRevised letter body.',
      inputTokens: 10,
      outputTokens: 20,
      cost: 0,
    });
    const service = new DocumentService({ chatCompletion });

    await service.generateSummary('Attendance note content', metadata, {
      previousContent: 'Old letter content',
      reason: 'Clarify advice on costs',
    });

    expect(chatCompletion).toHaveBeenCalledOnce();
    const request = chatCompletion.mock.calls[0]?.[0] as {
      userPrompt: string;
      temperature: number;
    };
    expect(request.temperature).toBe(0);
    expect(request.userPrompt).toContain('FURTHER VERSION — MANDATORY');
    expect(request.userPrompt).toContain('Old letter content');
    expect(request.userPrompt).toContain('Clarify advice on costs');
  });

  it('keeps temperature 0 when no revision context is provided', async () => {
    const chatCompletion = vi.fn().mockResolvedValue({
      content: '**What we discussed**\n\nLetter body.',
      inputTokens: 10,
      outputTokens: 20,
      cost: 0,
    });
    const service = new DocumentService({ chatCompletion });

    await service.generateSummary('Attendance note content', metadata);

    expect(chatCompletion).toHaveBeenCalledOnce();
    const request = chatCompletion.mock.calls[0]?.[0] as { temperature: number; userPrompt: string };
    expect(request.temperature).toBe(0);
    expect(request.userPrompt).not.toContain('FURTHER VERSION — MANDATORY');
  });
});
