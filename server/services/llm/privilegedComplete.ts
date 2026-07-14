import { getPrivilegedLLMProvider } from './providerFactory';

export interface PrivilegedCompleteRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'json_object';
  cacheableBlock?: string;
}

export interface PrivilegedCompleteResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** Single production entry point for privileged LLM calls outside the DocumentService seam. */
export async function privilegedComplete(
  request: PrivilegedCompleteRequest,
): Promise<PrivilegedCompleteResult> {
  const result = await getPrivilegedLLMProvider().generate({
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
    responseFormat: request.responseFormat,
    cacheableBlock: request.cacheableBlock,
  });

  return {
    content: result.text,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cost: result.cost,
  };
}
