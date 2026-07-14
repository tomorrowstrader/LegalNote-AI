import type { PrivilegedLLMProvider } from './PrivilegedLLMProvider';
import { BedrockProvider } from './BedrockProvider';

let cachedProvider: PrivilegedLLMProvider | null = null;

export function getPrivilegedLLMProvider(): PrivilegedLLMProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.PRIVILEGED_LLM_PROVIDER?.toLowerCase();
  if (providerName !== 'bedrock') {
    throw new Error(
      `PRIVILEGED_LLM_PROVIDER must be "bedrock"; got "${providerName ?? '(unset)'}"`,
    );
  }

  cachedProvider = new BedrockProvider();
  return cachedProvider;
}

/** Test-only reset; not used in production routing until Phase 3. */
export function resetPrivilegedLLMProviderForTests(): void {
  cachedProvider = null;
}
