import { storage } from "../storage";
import {
  isFeatureVisibleForContext,
  type FeatureKey,
} from "@shared/featureVisibility";
import { enrichFirmEvaluationStatus } from "@shared/evaluationAccess";

export async function isFeatureEnabledForUser(
  userId: string,
  key: FeatureKey,
): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user?.firmId) {
    return isFeatureVisibleForContext(key, null);
  }
  const firm = await storage.getFirm(user.firmId);
  if (!firm) {
    return isFeatureVisibleForContext(key, null);
  }
  const evalStatus = enrichFirmEvaluationStatus(firm);
  return isFeatureVisibleForContext(key, {
    firmIsEvaluation: firm.isEvaluation ?? false,
    evaluationActive: evalStatus.evaluationActive ?? false,
  });
}

/** Client meetings default to auto-record when the calendar auto-record feature is enabled. */
export async function shouldDefaultAutoRecordEnabled(
  userId: string,
  clientEmail?: string | null,
): Promise<boolean> {
  if (!clientEmail?.trim()) return false;
  return isFeatureEnabledForUser(userId, "calendarAutoRecord");
}
