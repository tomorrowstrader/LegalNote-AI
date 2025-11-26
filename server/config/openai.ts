import OpenAI from 'openai';

// Validate OpenAI API key is present
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Initialize OpenAI client with API key
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configurations
export const MODELS = {
  TRANSCRIPTION: 'whisper-1',
  DOCUMENT_GENERATION: 'gpt-4o',
} as const;

// Pricing per 1M tokens (source: https://openai.com/api/pricing/ - January 2025)
export const PRICING = {
  WHISPER_PER_MINUTE: 0.006, // $0.006 per minute
  GPT4O_INPUT_PER_1M: 5.00,  // $5.00 per 1M input tokens
  GPT4O_OUTPUT_PER_1M: 15.00, // $15.00 per 1M output tokens
  RECALL_AI_PER_HOUR: 0.70,  // $0.70 per hour of recorded meeting (source: Recall.ai pricing)
} as const;

// Calculate cost for transcription
export function calculateTranscriptionCost(durationInSeconds: number): number {
  const minutes = durationInSeconds / 60;
  return minutes * PRICING.WHISPER_PER_MINUTE;
}

// Calculate cost for GPT-4o usage
export function calculateGPT4oCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.GPT4O_INPUT_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * PRICING.GPT4O_OUTPUT_PER_1M;
  return inputCost + outputCost;
}

// Calculate cost for Recall.ai video meeting import
export function calculateRecallAICost(durationInSeconds: number): number {
  const hours = durationInSeconds / 3600;
  return hours * PRICING.RECALL_AI_PER_HOUR;
}
