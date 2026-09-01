/** Shared helpers for governed evaluation period timing. */

export function parseEvaluationEndsAtInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const endsAt = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(endsAt.getTime())) return null;
  return endsAt;
}

export function parseEvaluationStartsAtInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const startsAt = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(startsAt.getTime())) return null;
  return startsAt;
}

export function isEvaluationExpired(
  evaluationEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!evaluationEndsAt) return false;
  const endsAt =
    evaluationEndsAt instanceof Date ? evaluationEndsAt : new Date(evaluationEndsAt);
  if (Number.isNaN(endsAt.getTime())) return false;
  return now.getTime() > endsAt.getTime();
}

/** Whole days until end-of-evaluation (0 when expired). */
export function getEvaluationDaysRemaining(
  evaluationEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!evaluationEndsAt) return null;
  const endsAt =
    evaluationEndsAt instanceof Date ? evaluationEndsAt : new Date(evaluationEndsAt);
  if (Number.isNaN(endsAt.getTime())) return null;
  if (now.getTime() > endsAt.getTime()) return 0;
  const msPerDay = 86_400_000;
  return Math.ceil((endsAt.getTime() - now.getTime()) / msPerDay);
}

export function enrichFirmEvaluationStatus<
  T extends { isEvaluation?: boolean; evaluationEndsAt?: Date | string | null },
>(firm: T, now: Date = new Date()) {
  const active =
    Boolean(firm.isEvaluation) &&
    Boolean(firm.evaluationEndsAt) &&
    !isEvaluationExpired(firm.evaluationEndsAt, now);
  return {
    ...firm,
    evaluationExpired: Boolean(
      firm.isEvaluation && firm.evaluationEndsAt && isEvaluationExpired(firm.evaluationEndsAt, now),
    ),
    evaluationDaysRemaining: firm.isEvaluation
      ? getEvaluationDaysRemaining(firm.evaluationEndsAt ?? null, now)
      : null,
    evaluationActive: active,
  };
}
