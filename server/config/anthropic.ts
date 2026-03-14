import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[CRITICAL] ANTHROPIC_API_KEY not set — document generation will fail. Claude 3.7 Sonnet is required for attendance notes and summaries.');
}

export const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const CLAUDE_MODELS = {
  DOCUMENT_GENERATION: 'claude-3-7-sonnet-20250219',
} as const;

export const CLAUDE_PRICING = {
  SONNET_INPUT_PER_1M: 3.00,
  SONNET_OUTPUT_PER_1M: 15.00,
} as const;

export function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * CLAUDE_PRICING.SONNET_INPUT_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_PRICING.SONNET_OUTPUT_PER_1M;
  return inputCost + outputCost;
}
