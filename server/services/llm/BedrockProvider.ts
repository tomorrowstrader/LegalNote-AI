import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type InferenceConfiguration,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  PrivilegedLLMGenerateOptions,
  PrivilegedLLMProvider,
  PrivilegedLLMResult,
  PrivilegedLLMUsage,
} from './PrivilegedLLMProvider';

/** Whether a model accepts temperature/topP/topK in inferenceConfig. */
const SAMPLING_CAPABILITIES: Record<string, { temperature: boolean }> = {
  'eu.anthropic.claude-sonnet-4-6': { temperature: true },
};

/** Claude Sonnet 4.6 on Bedrock (eu.anthropic.claude-sonnet-4-6, on-demand). */
const BEDROCK_SONNET_46_PRICING = {
  INPUT_PER_1M: 3.0,
  OUTPUT_PER_1M: 15.0,
  CACHE_WRITE_PER_1M: 3.75,
  CACHE_READ_PER_1M: 0.3,
} as const;

const JSON_ONLY_INSTRUCTION = `

CRITICAL OUTPUT FORMAT: You MUST respond with ONLY a single valid JSON object. Do not include any prose, explanation, markdown code fences, or any text before or after the JSON. Escape special characters inside JSON strings correctly (including newlines in long string values).`;

// A 16k-token legal document can take several minutes to generate. The old
// 120-second timeout aborted otherwise healthy long-document requests.
const DEFAULT_REQUEST_TIMEOUT_MS = 900_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function resolveBedrockRequestTimeoutMs(
  explicitTimeout?: number,
  configuredTimeout = process.env.BEDROCK_REQUEST_TIMEOUT_MS,
): number {
  if (explicitTimeout !== undefined) return explicitTimeout;
  const parsed = Number(configuredTimeout);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REQUEST_TIMEOUT_MS;
}

export type BedrockErrorCode =
  | 'configuration'
  | 'throttling'
  | 'timeout'
  | 'validation'
  | 'access_denied'
  | 'service_unavailable'
  | 'model_error'
  | 'unknown';

export class BedrockProviderError extends Error {
  readonly code: BedrockErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, code: BedrockErrorCode, options?: { retryable?: boolean; cause?: unknown }) {
    super(message);
    this.name = 'BedrockProviderError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
  }
}

function modelSupportsTemperature(modelId: string): boolean {
  if (modelId in SAMPLING_CAPABILITIES) {
    return SAMPLING_CAPABILITIES[modelId].temperature;
  }
  return false;
}

function assertEuConfiguration(region: string, modelId: string): void {
  if (!region.startsWith('eu-')) {
    throw new BedrockProviderError(
      `Privileged Bedrock inference requires an EU region (AWS_REGION must start with "eu-"); got "${region}"`,
      'configuration',
    );
  }
  if (!modelId.startsWith('eu.')) {
    throw new BedrockProviderError(
      `Privileged Bedrock inference requires an EU geographic inference profile (BEDROCK_PRIVILEGED_MODEL_ID must start with "eu."); got "${modelId}"`,
      'configuration',
    );
  }
}

/** Transcript-first so cachePoint marks a stable prefix reused across sequential calls. */
function buildUserContentBlocks(userPrompt: string, cacheableBlock?: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  if (cacheableBlock) {
    blocks.push({ text: cacheableBlock });
    blocks.push({ cachePoint: { type: 'default' } });
  }

  if (userPrompt) {
    blocks.push({ text: userPrompt });
  }

  if (blocks.length === 0) {
    blocks.push({ text: '' });
  }

  return blocks;
}

function buildInferenceConfig(
  modelId: string,
  maxTokens: number,
  temperature?: number,
): InferenceConfiguration {
  const config: InferenceConfiguration = { maxTokens };

  if (temperature !== undefined && modelSupportsTemperature(modelId)) {
    config.temperature = temperature;
  }

  return config;
}

/** Strip fences/prose so callers receive parseable JSON text. */
export function cleanJsonResponse(raw: string): string {
  let text = raw.trim();

  const fullFence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/im);
  if (fullFence) {
    text = fullFence[1].trim();
  } else {
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

export function calculateBedrockSonnet46Cost(usage: PrivilegedLLMUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.INPUT_PER_1M +
    (usage.outputTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.OUTPUT_PER_1M +
    (usage.cacheWriteTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.CACHE_WRITE_PER_1M +
    (usage.cacheReadTokens / 1_000_000) * BEDROCK_SONNET_46_PRICING.CACHE_READ_PER_1M
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return error.name;
  }
  return '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function mapBedrockError(error: unknown): BedrockProviderError {
  if (error instanceof BedrockProviderError) {
    return error;
  }

  const name = getErrorName(error);
  const message = getErrorMessage(error);

  if (name === 'AbortError' || message.includes('timed out') || name === 'TimeoutError') {
    return new BedrockProviderError('Bedrock request timed out', 'timeout', { retryable: true, cause: error });
  }

  switch (name) {
    case 'ThrottlingException':
      return new BedrockProviderError('Bedrock request was throttled', 'throttling', { retryable: true, cause: error });
    case 'ServiceUnavailableException':
    case 'InternalServerException':
    case 'ModelTimeoutException':
      return new BedrockProviderError(`Bedrock service error: ${message}`, 'service_unavailable', {
        retryable: true,
        cause: error,
      });
    case 'ValidationException':
      return new BedrockProviderError(`Bedrock validation error: ${message}`, 'validation', {
        retryable: false,
        cause: error,
      });
    case 'AccessDeniedException':
      return new BedrockProviderError(`Bedrock access denied: ${message}`, 'access_denied', {
        retryable: false,
        cause: error,
      });
    case 'ModelNotReadyException':
    case 'ModelErrorException':
      return new BedrockProviderError(`Bedrock model error: ${message}`, 'model_error', {
        retryable: false,
        cause: error,
      });
    default:
      return new BedrockProviderError(message || 'Unknown Bedrock error', 'unknown', {
        retryable: false,
        cause: error,
      });
  }
}

function usageFromResponse(response: ConverseCommandOutput): PrivilegedLLMUsage {
  return {
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
    cacheReadTokens: response.usage?.cacheReadInputTokens ?? 0,
    cacheWriteTokens: response.usage?.cacheWriteInputTokens ?? 0,
  };
}

export class BedrockProvider implements PrivilegedLLMProvider {
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;
  private readonly requestTimeoutMs: number;
  private readonly maxAttempts: number;

  constructor(options?: { requestTimeoutMs?: number; maxAttempts?: number }) {
    const region = process.env.AWS_REGION ?? '';
    const modelId = process.env.BEDROCK_PRIVILEGED_MODEL_ID ?? '';

    assertEuConfiguration(region, modelId);

    this.modelId = modelId;
    this.requestTimeoutMs = resolveBedrockRequestTimeoutMs(options?.requestTimeoutMs);
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.client = new BedrockRuntimeClient({ region });
  }

  async generate(options: PrivilegedLLMGenerateOptions): Promise<PrivilegedLLMResult> {
    const start = Date.now();

    let systemPrompt = options.systemPrompt;
    if (options.responseFormat === 'json_object') {
      systemPrompt += JSON_ONLY_INSTRUCTION;
    }

    const input: ConverseCommandInput = {
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: 'user',
          content: buildUserContentBlocks(options.userPrompt, options.cacheableBlock),
        },
      ],
      inferenceConfig: buildInferenceConfig(
        this.modelId,
        options.maxTokens,
        options.temperature,
      ),
    };

    const response = await this.sendWithRetry(input);

    let text =
      response.output?.message?.content
        ?.map((block) => block.text ?? '')
        .join('') ?? '';

    if (options.responseFormat === 'json_object') {
      text = cleanJsonResponse(text);
    }

    const usage = usageFromResponse(response);

    return {
      text,
      usage,
      latencyMs: Date.now() - start,
      cost: calculateBedrockSonnet46Cost(usage),
      stopReason: response.stopReason,
    };
  }

  private async sendWithRetry(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    let lastError: BedrockProviderError | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await this.client.send(new ConverseCommand(input), {
          abortSignal: AbortSignal.timeout(this.requestTimeoutMs),
        });
      } catch (error) {
        const mapped = mapBedrockError(error);
        lastError = mapped;

        if (!mapped.retryable || attempt === this.maxAttempts - 1) {
          throw mapped;
        }

        const backoffMs = Math.min(
          INITIAL_BACKOFF_MS * 2 ** attempt + Math.random() * 500,
          MAX_BACKOFF_MS,
        );
        console.warn(
          `[BedrockProvider] ${mapped.code} on attempt ${attempt + 1}/${this.maxAttempts}; retrying in ${Math.round(backoffMs)}ms`,
        );
        await sleep(backoffMs);
      }
    }

    throw lastError ?? new BedrockProviderError('Bedrock request failed after retries', 'unknown');
  }
}
