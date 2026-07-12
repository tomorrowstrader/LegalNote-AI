/**
 * Harness-only copy of feat/bedrock-provider PrivilegedLLMProvider.ts.
 * Not imported by production code.
 */

export interface PrivilegedLLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface PrivilegedLLMResult {
  text: string;
  usage: PrivilegedLLMUsage;
  latencyMs: number;
}

export interface PrivilegedLLMGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  cacheableBlock?: string;
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'json_object';
}

export interface PrivilegedLLMProvider {
  generate(options: PrivilegedLLMGenerateOptions): Promise<PrivilegedLLMResult>;
}
