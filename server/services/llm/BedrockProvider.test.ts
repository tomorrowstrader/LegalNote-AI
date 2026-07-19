import { describe, expect, it } from 'vitest';
import { resolveBedrockRequestTimeoutMs } from './BedrockProvider';

describe('resolveBedrockRequestTimeoutMs', () => {
  it('defaults to 15 minutes for long document generation', () => {
    expect(resolveBedrockRequestTimeoutMs(undefined, undefined)).toBe(900_000);
  });

  it('allows a deployment override', () => {
    expect(resolveBedrockRequestTimeoutMs(undefined, '1200000')).toBe(1_200_000);
  });

  it('prefers an explicit constructor timeout', () => {
    expect(resolveBedrockRequestTimeoutMs(5_000, '1200000')).toBe(5_000);
  });

  it('ignores invalid deployment values', () => {
    expect(resolveBedrockRequestTimeoutMs(undefined, 'not-a-number')).toBe(900_000);
  });
});
