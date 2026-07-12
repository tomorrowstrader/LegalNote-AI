/**
 * Harness-only Bedrock adapter for DocumentService measurement seam.
 */

import type { DocumentChatCompletionFn } from '../server/services/documentService';
import { HarnessBedrockProvider } from './harness-llm/BedrockProvider';

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
    return {
      content: result.text,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost: 0,
    };
  };
}
