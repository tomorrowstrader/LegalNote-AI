/**
 * Platform-level feature visibility for launch.
 * Flip a flag to true when a feature is ready for client use.
 * Per-user entitlements (e.g. user.complianceThread) remain separate.
 */
export const FEATURE_VISIBILITY = {
  amlCompliance: false,
  sraReadiness: false,
} as const;

export type FeatureKey = keyof typeof FEATURE_VISIBILITY;

export function isFeatureVisible(key: FeatureKey): boolean {
  return FEATURE_VISIBILITY[key];
}
