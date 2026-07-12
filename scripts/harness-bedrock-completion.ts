/**
 * Harness-only Bedrock adapter for DocumentService measurement seam.
 */

import type { DocumentChatCompletionFn } from '../server/services/documentService';
import { HarnessBedrockProvider } from './harness-llm/BedrockProvider';

/** Claude Sonnet 4.6 on Bedrock (eu.anthropic.claude-sonnet-4-6, eu-west-2 on-demand). */
const BEDROCK_SONNET_46_PRICING = {
  INPUT_PER_1M: 3.0,
  OUTPUT_PER_1M: 15.0,
} as const;

export function calculateBedrockSonnet46Cost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.INPUT_PER_1M +
    (outputTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.OUTPUT_PER_1M
  );
}

export function createBedrockChatCompletion(): DocumentChatCompletionFn {
  const provider = new HarnessBedrockProvider();
  return async (request) => {
    const result = await provider.generate({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.responseFormat,
    });
    const inputTokens = result.usage.inputTokens;
    const outputTokens = result.usage.outputTokens;
    return {
      content: result.text,
      inputTokens,
      outputTokens,
      cost: calculateBedrockSonnet46Cost(inputTokens, outputTokens),
    };
  };
}
