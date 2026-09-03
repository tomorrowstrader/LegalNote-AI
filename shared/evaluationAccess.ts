/** Shared helpers for governed evaluation period timing (Europe/London calendar days). */

import { DateTime } from "luxon";

export const EVALUATION_TIMEZONE = "Europe/London";

const PAID_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

/** True when the firm has an active (or trialing) paid subscription. */
export function firmHasPaidAccess(firm: {
  subscriptionStatus?: string | null;
}): boolean {
  const status = String(firm.subscriptionStatus || "").toLowerCase();
  return PAID_SUBSCRIPTION_STATUSES.has(status);
}

/** Legacy admin dates were stored as YYYY-MM-DDT23:59:59.000Z (UTC), which displays a day late in the UK. */
function isLegacyUtcEndOfDay(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T23:59:59\.000Z$/.test(iso);
}

function isLegacyUtcStartOfDay(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso);
}

/** Resolve the evaluation end instant in London, including legacy UTC-stored admin dates. */
export function getEvaluationEndLondon(
  evaluationEndsAt: Date | string,
): DateTime {
  const asDate = evaluationEndsAt instanceof Date ? evaluationEndsAt : new Date(evaluationEndsAt);
  const iso = asDate.toISOString();
  if (isLegacyUtcEndOfDay(iso)) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return DateTime.fromObject({ year: y, month: m, day: d }, { zone: EVALUATION_TIMEZONE }).endOf(
      "day",
    );
  }
  return DateTime.fromJSDate(asDate).setZone(EVALUATION_TIMEZONE);
}

export function getEvaluationStartLondon(
  evaluationStartsAt: Date | string,
): DateTime {
  const asDate =
    evaluationStartsAt instanceof Date ? evaluationStartsAt : new Date(evaluationStartsAt);
  const iso = asDate.toISOString();
  if (isLegacyUtcStartOfDay(iso)) {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return DateTime.fromObject({ year: y, month: m, day: d }, { zone: EVALUATION_TIMEZONE }).startOf(
      "day",
    );
  }
  return DateTime.fromJSDate(asDate).setZone(EVALUATION_TIMEZONE);
}

export function parseEvaluationEndsAtInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const endsAt = DateTime.fromISO(trimmed, { zone: EVALUATION_TIMEZONE }).endOf("day");
    if (!endsAt.isValid) return null;
    return endsAt.toJSDate();
  }
  const endsAt = DateTime.fromISO(trimmed, { zone: EVALUATION_TIMEZONE });
  if (!endsAt.isValid) return null;
  return endsAt.toJSDate();
}

export function parseEvaluationStartsAtInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const startsAt = DateTime.fromISO(trimmed, { zone: EVALUATION_TIMEZONE }).startOf("day");
    if (!startsAt.isValid) return null;
    return startsAt.toJSDate();
  }
  const startsAt = DateTime.fromISO(trimmed, { zone: EVALUATION_TIMEZONE });
  if (!startsAt.isValid) return null;
  return startsAt.toJSDate();
}

export function formatEvaluationCalendarDate(
  value: Date | string | null | undefined,
  kind: "start" | "end" = "end",
): string {
  if (!value) return "";
  const dt =
    kind === "start"
      ? getEvaluationStartLondon(value)
      : getEvaluationEndLondon(value);
  return dt.toFormat("d MMMM yyyy");
}

export function isEvaluationExpired(
  evaluationEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!evaluationEndsAt) return false;
  const asDate =
    evaluationEndsAt instanceof Date ? evaluationEndsAt : new Date(evaluationEndsAt);
  if (Number.isNaN(asDate.getTime())) return false;
  const endDay = getEvaluationEndLondon(asDate).startOf("day");
  const today = DateTime.fromJSDate(now, { zone: EVALUATION_TIMEZONE }).startOf("day");
  return today > endDay;
}

/** Whole calendar days until the evaluation end date in London (0 when expired). */
export function getEvaluationDaysRemaining(
  evaluationEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!evaluationEndsAt) return null;
  const asDate =
    evaluationEndsAt instanceof Date ? evaluationEndsAt : new Date(evaluationEndsAt);
  if (Number.isNaN(asDate.getTime())) return null;
  const endDay = getEvaluationEndLondon(asDate).startOf("day");
  const today = DateTime.fromJSDate(now, { zone: EVALUATION_TIMEZONE }).startOf("day");
  if (today > endDay) return 0;
  return Math.round(endDay.diff(today, "days").days);
}

export function enrichFirmEvaluationStatus<
  T extends {
    isEvaluation?: boolean;
    evaluationEndsAt?: Date | string | null;
    subscriptionStatus?: string | null;
    subscriptionPlan?: string | null;
    subscriptionSeatQuantity?: number | null;
  },
>(firm: T, now: Date = new Date()) {
  const paid = firmHasPaidAccess(firm);
  const evalExpired =
    Boolean(firm.isEvaluation) &&
    Boolean(firm.evaluationEndsAt) &&
    isEvaluationExpired(firm.evaluationEndsAt, now) &&
    !paid;
  const active =
    Boolean(firm.isEvaluation) &&
    Boolean(firm.evaluationEndsAt) &&
    !isEvaluationExpired(firm.evaluationEndsAt, now) &&
    !paid;
  return {
    ...firm,
    hasPaidAccess: paid,
    evaluationExpired: evalExpired,
    evaluationDaysRemaining:
      firm.isEvaluation && !paid
        ? getEvaluationDaysRemaining(firm.evaluationEndsAt ?? null, now)
        : null,
    evaluationActive: active,
  };
}
