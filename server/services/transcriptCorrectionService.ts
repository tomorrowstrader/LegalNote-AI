import { privilegedComplete } from './llm/privilegedComplete';

export interface TranscriptCorrectionResult {
  correctedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CorrectionContext {
  clientName?: string;
  matterReference?: string;
  caseTitle?: string;
  participants?: string[];
}

/**
 * LLM-based post-processing for transcript error correction.
 * Focuses on context-aware fixes for names, numbers, and legal terms.
 */
export class TranscriptCorrectionService {
  /**
   * Apply context-aware corrections to a transcript.
   */
  async correctTranscript(
    transcript: string,
    context: CorrectionContext
  ): Promise<TranscriptCorrectionResult> {
    const contextInfo = this.buildContextString(context);
    
    const systemPrompt = `You are a transcript correction specialist for a UK legal practice. Your task is to fix obvious transcription errors while preserving the original meaning and speaker intent.

CONTEXT FOR THIS TRANSCRIPT:
${contextInfo}

CORRECTION RULES:
1. **Names**: Fix misspellings of the client name, participant names, and matter reference provided above.
2. **Legal Terms**: Correct UK legal terminology (e.g., "cleo" → "Clio", "SRA" not "essay ray", "GDPR" not "GDP are").
3. **Numbers**: Only correct numbers if the context makes an error obvious (e.g., "fifteen" vs "fifty" when discussing a clearly stated amount).
4. **Courts & Bodies**: Correct UK court names (County Court, Crown Court, High Court, etc.) and regulatory bodies (SRA, Law Society, HMCTS, etc.).
5. **Preserve Meaning**: Never change the meaning of what was said. Only fix obvious transcription errors.
6. **Minimal Changes**: Make the minimum necessary corrections. Do not rephrase or improve the language.
7. **Speaker Labels**: Preserve all speaker labels exactly as they appear (e.g., "[Speaker A]:", "[Speaker B]:").

OUTPUT FORMAT:
Return a JSON object with:
{
  "correctedText": "The full corrected transcript",
  "corrections": [
    {
      "original": "the misspelled word or phrase",
      "corrected": "the corrected word or phrase", 
      "reason": "Brief explanation"
    }
  ]
}

If no corrections are needed, return the original text with an empty corrections array.`;

    const userPrompt = `Please review and correct this transcript:

${transcript}

Return a JSON object with the corrected text and list of corrections made.`;

    try {
      console.log('[TranscriptCorrection] Starting correction pass...');
      
      const completion = await privilegedComplete({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 8000,
        responseFormat: 'json_object',
      });

      const content = completion.content || '{}';
      const inputTokens = completion.inputTokens;
      const outputTokens = completion.outputTokens;
      const cost = completion.cost;

      let result: { correctedText: string; corrections: Array<{ original: string; corrected: string; reason: string }> };
      
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('[TranscriptCorrection] Failed to parse response:', parseError);
        return {
          correctedText: transcript,
          corrections: [],
          inputTokens,
          outputTokens,
          cost,
        };
      }

      console.log(`[TranscriptCorrection] Made ${result.corrections?.length || 0} corrections. Cost: $${cost.toFixed(4)}`);

      const correctedText = result.correctedText || transcript;
      // Guard against model max-token truncation mid-transcript (would store a cut sentence).
      if (
        typeof correctedText === "string" &&
        transcript.length > 500 &&
        correctedText.length < transcript.length * 0.9
      ) {
        console.warn(
          `[TranscriptCorrection] Discarding truncated correction (${correctedText.length} vs ${transcript.length} chars)`,
        );
        return {
          correctedText: transcript,
          corrections: [],
          inputTokens,
          outputTokens,
          cost,
        };
      }

      return {
        correctedText,
        corrections: result.corrections || [],
        inputTokens,
        outputTokens,
        cost,
      };
    } catch (error: any) {
      console.error('[TranscriptCorrection] Correction failed:', error);
      return {
        correctedText: transcript,
        corrections: [],
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
    }
  }

  /**
   * Build context string for the correction prompt
   */
  private buildContextString(context: CorrectionContext): string {
    const parts: string[] = [];
    
    if (context.clientName) {
      parts.push(`- Client Name: ${context.clientName}`);
    }
    if (context.matterReference) {
      parts.push(`- Matter Reference: ${context.matterReference}`);
    }
    if (context.caseTitle) {
      parts.push(`- Case Title: ${context.caseTitle}`);
    }
    if (context.participants?.length) {
      parts.push(`- Participants: ${context.participants.join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : 'No specific context provided.';
  }
}

export const transcriptCorrectionService = new TranscriptCorrectionService();
