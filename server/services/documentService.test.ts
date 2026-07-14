import { describe, expect, it, vi } from 'vitest';
import { DocumentService, type CaseMetadata } from './documentService';

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
