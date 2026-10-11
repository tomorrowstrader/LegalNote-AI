export type CalendarProviderChoice = "google" | "outlook";

/**
 * Default the meeting calendar to the account they signed in with.
 * Use the other calendar only when the preferred one is not connected and the other is.
 */
export function resolveScheduleProvider(input: {
  preferred?: CalendarProviderChoice | null;
  googleConnected: boolean;
  outlookConnected: boolean;
}): CalendarProviderChoice {
  const preferred = input.preferred === "outlook" ? "outlook" : "google";
  if (preferred === "google" && input.googleConnected) return "google";
  if (preferred === "outlook" && input.outlookConnected) return "outlook";
  if (input.googleConnected && !input.outlookConnected) return "google";
  if (input.outlookConnected && !input.googleConnected) return "outlook";
  return preferred;
}

/** Local wall-clock datetime. Avoids `Date.parse` treating a time without a zone as UTC. */
export function parseLocalDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  return parsed;
}

/** Next half-hour on the local clock, so a new meeting form starts in the future. */
export function nextHalfHourSlot(now = new Date()): { date: string; time: string } {
  const slot = new Date(now);
  slot.setSeconds(0, 0);
  const minutes = slot.getMinutes();
  const add = minutes % 30 === 0 ? 30 : 30 - (minutes % 30);
  slot.setMinutes(minutes + add);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${slot.getFullYear()}-${pad(slot.getMonth() + 1)}-${pad(slot.getDate())}`,
    time: `${pad(slot.getHours())}:${pad(slot.getMinutes())}`,
  };
}
