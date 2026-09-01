/**
 * Platform-level feature visibility for launch.
 * Flip a flag to true when a feature is ready for client use.
 * Per-user entitlements (e.g. user.complianceThread) remain separate.
 */
export const FEATURE_VISIBILITY = {
  amlCompliance: false,
  sraReadiness: false,
  supervision: false,
  externalReferences: false,
  firmComplianceDashboard: false,
  complianceScore: false,
  publicComplianceBadge: false,
  profileNotificationPrefs: false,
  /** Auto-record + cron bot deploy for scheduled meetings (Phase 3). */
  calendarAutoRecord: false,
  /** Transfer a matter to another fee earner within the firm. */
  caseHandover: false,
  /** One-click PI defence PDF bundle from case documentation. */
  piDefencePack: false,
} as const;

export type FeatureKey = keyof typeof FEATURE_VISIBILITY;

/** Enabled for active governed-evaluation firms even when the global flag is off. */
export const EVAL_FIRM_ENABLED_FEATURES: FeatureKey[] = [
  "sraReadiness",
  "firmComplianceDashboard",
  "calendarAutoRecord",
];

export type FeatureVisibilityContext = {
  firmIsEvaluation?: boolean;
  /** When false, eval-only features stay hidden even on eval firms. */
  evaluationActive?: boolean;
};

export function isFeatureVisible(key: FeatureKey): boolean {
  return FEATURE_VISIBILITY[key];
}

export function isFeatureVisibleForContext(
  key: FeatureKey,
  context?: FeatureVisibilityContext | null,
): boolean {
  if (FEATURE_VISIBILITY[key]) return true;
  if (!context?.firmIsEvaluation) return false;
  if (context.evaluationActive === false) return false;
  return EVAL_FIRM_ENABLED_FEATURES.includes(key);
}
