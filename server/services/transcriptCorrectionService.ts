import { openaiClient, MODELS, calculateGPT4oCost } from '../config/openai';

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
 * GPT-based post-processing for transcript error correction.
 * Focuses on context-aware fixes for names, numbers, and legal terms.
 */
export class TranscriptCorrectionService {
  /**
   * Apply context-aware corrections to a transcript.
   * Uses GPT-4o to identify and fix transcription errors based on context.
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
      console.log('[TranscriptCorrection] Starting GPT-4o correction pass...');
      
      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      let result: { correctedText: string; corrections: Array<{ original: string; corrected: string; reason: string }> };
      
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('[TranscriptCorrection] Failed to parse GPT response:', parseError);
        return {
          correctedText: transcript,
          corrections: [],
          inputTokens,
          outputTokens,
          cost,
        };
      }

      console.log(`[TranscriptCorrection] Made ${result.corrections?.length || 0} corrections. Cost: $${cost.toFixed(4)}`);

      return {
        correctedText: result.correctedText || transcript,
        corrections: result.corrections || [],
        inputTokens,
        outputTokens,
        cost,
      };
    } catch (error: any) {
      console.error('[TranscriptCorrection] GPT correction failed:', error);
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
