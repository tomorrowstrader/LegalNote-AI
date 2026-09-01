import { useAuth } from "@/hooks/useAuth";
import {
  isFeatureVisible,
  isFeatureVisibleForContext,
  type FeatureKey,
} from "@shared/featureVisibility";

/** Respects global flags and governed-evaluation firm overrides. */
export function useFeatureVisibility(key: FeatureKey): boolean {
  const { user } = useAuth();
  return isFeatureVisibleForContext(key, {
    firmIsEvaluation: user?.firmIsEvaluation,
    evaluationActive: user?.evaluationActive,
  });
}

export function useFeatureVisibilityGlobal(key: FeatureKey): boolean {
  return isFeatureVisible(key);
}
