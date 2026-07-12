/**
 * Harness-only copy of server/services/llm/BedrockProvider.ts (feat/bedrock-provider).
 * Keeps Batch 2 branch mergeable without importing Bedrock into production.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandInput,
  type InferenceConfiguration,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  PrivilegedLLMGenerateOptions,
  PrivilegedLLMProvider,
  PrivilegedLLMResult,
} from './PrivilegedLLMProvider';

const SAMPLING_CAPABILITIES: Record<string, { temperature: boolean }> = {
  'eu.anthropic.claude-sonnet-4-6': { temperature: true },
};

const JSON_ONLY_INSTRUCTION = `

CRITICAL OUTPUT FORMAT: You MUST respond with ONLY a single valid JSON object. Do not include any prose, explanation, markdown code fences, or any text before or after the JSON. Escape special characters inside JSON strings correctly (including newlines in long string values).`;

function modelSupportsTemperature(modelId: string): boolean {
  if (modelId in SAMPLING_CAPABILITIES) {
    return SAMPLING_CAPABILITIES[modelId].temperature;
  }
  return false;
}

function assertEuConfiguration(region: string, modelId: string): void {
  if (!region.startsWith('eu-')) {
    throw new Error(
      `Privileged Bedrock inference requires an EU region (AWS_REGION must start with "eu-"); got "${region}"`,
    );
  }
  if (!modelId.startsWith('eu.')) {
    throw new Error(
      `Privileged Bedrock inference requires an EU geographic inference profile (BEDROCK_PRIVILEGED_MODEL_ID must start with "eu."); got "${modelId}"`,
    );
  }
}

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

export class HarnessBedrockProvider implements PrivilegedLLMProvider {
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor() {
    const region = process.env.AWS_REGION ?? '';
    const modelId = process.env.BEDROCK_PRIVILEGED_MODEL_ID ?? 'eu.anthropic.claude-sonnet-4-6';
    assertEuConfiguration(region, modelId);
    this.modelId = modelId;
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
      inferenceConfig: buildInferenceConfig(this.modelId, options.maxTokens, options.temperature),
    };
    const response = await this.client.send(new ConverseCommand(input));
    let text =
      response.output?.message?.content?.map((block) => block.text ?? '').join('') ?? '';
    if (options.responseFormat === 'json_object') {
      text = cleanJsonResponse(text);
    }
    return {
      text,
      usage: {
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
        cacheReadTokens: response.usage?.cacheReadInputTokens ?? 0,
        cacheWriteTokens: response.usage?.cacheWriteInputTokens ?? 0,
      },
      latencyMs: Date.now() - start,
    };
  }
}
