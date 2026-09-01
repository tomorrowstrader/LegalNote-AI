import {
  parseEvaluationEndsAtInput,
  parseEvaluationStartsAtInput,
} from "@shared/evaluationAccess";

export function parseAdminEvaluationEndsAt(
  raw: string | null | undefined,
): { ok: true; value: Date | null } | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: true, value: null };
  }
  const value = parseEvaluationEndsAtInput(raw);
  if (!value) {
    return { ok: false, message: "Invalid evaluation end date" };
  }
  return { ok: true, value };
}

export function parseAdminEvaluationStartsAt(
  raw: string | null | undefined,
): { ok: true; value: Date | null } | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: true, value: null };
  }
  const value = parseEvaluationStartsAtInput(raw);
  if (!value) {
    return { ok: false, message: "Invalid evaluation start date" };
  }
  return { ok: true, value };
}

export type EvaluationFirmEmailNotification = "none" | "confirmation" | "schedule_update";
