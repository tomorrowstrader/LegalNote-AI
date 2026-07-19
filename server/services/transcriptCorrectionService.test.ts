import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./llm/privilegedComplete', () => ({
  privilegedComplete: vi.fn(),
}));

import { privilegedComplete } from './llm/privilegedComplete';
import {
  CORRECTION_CHUNK_MAX_CHARS,
  splitTranscriptForCorrection,
  TranscriptCorrectionService,
} from './transcriptCorrectionService';

const mockedComplete = vi.mocked(privilegedComplete);

describe('splitTranscriptForCorrection', () => {
  it('preserves a long transcript exactly across bounded chunks', () => {
    const transcript = Array.from(
      { length: 2_000 },
      (_, index) => `[Speaker ${index % 2 ? 'B' : 'A'}]: Sentence ${index}.\n`,
    ).join('');

    const chunks = splitTranscriptForCorrection(transcript);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(transcript);
    expect(chunks.every((chunk) => chunk.length <= CORRECTION_CHUNK_MAX_CHARS)).toBe(true);
  });
});

describe('TranscriptCorrectionService long transcripts', () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it('corrects every chunk and reconstructs the complete transcript', async () => {
    const transcript = Array.from(
      { length: 2_000 },
      (_, index) => `[Speaker ${index % 2 ? 'B' : 'A'}]: Evidence item ${index}.\n`,
    ).join('');

    mockedComplete.mockImplementation(async ({ userPrompt }) => {
      const correctedText =
        userPrompt.match(/(?:\n\n)([\s\S]*?)\n\nReturn a JSON object/)?.[1] ?? '';
      return {
        content: JSON.stringify({ correctedText, corrections: [] }),
        inputTokens: 100,
        outputTokens: 100,
        cost: 0.01,
      };
    });

    const result = await new TranscriptCorrectionService().correctTranscript(transcript, {
      clientName: 'Test Client',
    });

    expect(mockedComplete.mock.calls.length).toBeGreaterThan(1);
    expect(result.correctedText).toBe(transcript);
    expect(result.inputTokens).toBe(mockedComplete.mock.calls.length * 100);
    expect(result.outputTokens).toBe(mockedComplete.mock.calls.length * 100);
  });

  it('falls back only the failed chunk without dropping later chunks', async () => {
    const transcript = `${'A'.repeat(CORRECTION_CHUNK_MAX_CHARS)}${'B'.repeat(500)}`;
    mockedComplete
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockImplementationOnce(async ({ userPrompt }) => {
        const correctedText =
          userPrompt.match(/(?:\n\n)([\s\S]*?)\n\nReturn a JSON object/)?.[1] ?? '';
        return {
          content: JSON.stringify({ correctedText, corrections: [] }),
          inputTokens: 50,
          outputTokens: 50,
          cost: 0.005,
        };
      });

    const result = await new TranscriptCorrectionService().correctTranscript(transcript, {});

    expect(result.correctedText).toBe(transcript);
    expect(mockedComplete).toHaveBeenCalledTimes(2);
  });

  it('rejects a provider-confirmed max-token cutoff even if the text looks long enough', async () => {
    const transcript = 'Original evidence sentence. '.repeat(300);
    mockedComplete.mockResolvedValue({
      content: JSON.stringify({
        correctedText: `${transcript.slice(0, -10)}cut short`,
        corrections: [{ original: 'x', corrected: 'y', reason: 'test' }],
      }),
      inputTokens: 100,
      outputTokens: 8_000,
      cost: 0.02,
      stopReason: 'max_tokens',
    });

    const result = await new TranscriptCorrectionService().correctTranscript(transcript, {});

    expect(result.correctedText).toBe(transcript);
    expect(result.corrections).toEqual([]);
  });
});
