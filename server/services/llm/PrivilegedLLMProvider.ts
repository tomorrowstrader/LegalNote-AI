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
  cost: number;
  /** Provider termination reason, e.g. "end_turn" or "max_tokens". */
  stopReason?: string;
}

export interface PrivilegedLLMGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Transcript or other stable prefix to cache (Bedrock only). Omitted = no cachePoint. */
  cacheableBlock?: string;
  maxTokens: number;
  /** Omitted when the target model rejects sampling params. */
  temperature?: number;
  responseFormat?: 'json_object';
}

export interface PrivilegedLLMProvider {
  generate(options: PrivilegedLLMGenerateOptions): Promise<PrivilegedLLMResult>;
}
