import { describe, expect, it, vi } from 'vitest';
import {
  DocumentService,
  formatRevisionInstructions,
  type CaseMetadata,
} from './documentService';

const metadata: CaseMetadata = {
  title: 'Test Matter',
  clientName: 'Test Client',
  matterReference: 'TEST/001',
  recordingDate: '14 July 2026',
  feeEarnerName: 'Jane Smith',
};

describe('DocumentService.generateAttendanceNote', () => {
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
    expect(systemPrompt).toContain('YOU ARE THE FEE EARNER');
    expect(systemPrompt).not.toContain('brief file note for a short recording');
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
  it('passes revision context into generation at non-zero temperature', async () => {
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
    expect(request.temperature).toBe(0.35);
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
