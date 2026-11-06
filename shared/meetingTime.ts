const UK_TIME_ZONE = "Europe/London";

/** The meeting's date as a UK reader expects it, whichever zone the server runs in. */
export function formatUkLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UK_TIME_ZONE,
  });
}

/** The same UK calendar day as YYYY-MM-DD. */
export function toUkIsoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: UK_TIME_ZONE,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * When the meeting happened, from the times we hold. A recording row can be saved
 * long after the meeting, so a later time is never preferred over an earlier one.
 */
export function earliestMeetingTime(
  ...times: Array<Date | string | null | undefined>
): Date | undefined {
  const valid = times
    .filter((t): t is Date | string => t != null)
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) return undefined;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}
