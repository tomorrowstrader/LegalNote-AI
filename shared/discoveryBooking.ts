/**
 * LegalNote's own discovery-call booking (legalnote.ai/talk).
 *
 * Pure rules only: which times are offered, given the organiser's busy times.
 * The server reads the busy times from the organiser's connected calendars and
 * calls `computeAvailableSlots`; nothing here touches the database or network.
 */

export type BusyInterval = { start: Date; end: Date };

export type DiscoveryBookingConfig = {
  title: string;
  durationMinutes: number;
  timeZone: string;
  /** ISO weekday (1 = Monday) → local [start, end] windows, "HH:MM". */
  weeklyWindows: Record<number, Array<[string, string]>>;
  /** Offer a start time every N minutes inside each window. */
  slotStepMinutes: number;
  /** No bookings sooner than this. */
  minNoticeHours: number;
  /** How far ahead times are offered. */
  horizonDays: number;
  /** Clear time kept either side of anything already in the diary. */
  bufferMinutes: number;
  /** Most discovery calls on one day. */
  maxPerDay: number;
  /** Local dates ("YYYY-MM-DD") never offered. */
  closedDates: readonly string[];
};

const WORKDAY: Array<[string, string]> = [
  ["09:30", "12:30"],
  ["13:30", "17:00"],
];

/** England and Wales bank holidays (gov.uk). */
export const ENGLAND_WALES_BANK_HOLIDAYS = [
  "2026-12-25",
  "2026-12-28",
  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-05-03",
  "2027-05-31",
  "2027-08-30",
  "2027-12-27",
  "2027-12-28",
] as const;

export const DISCOVERY_BOOKING: DiscoveryBookingConfig = {
  title: "LegalNote discovery call",
  durationMinutes: 20,
  timeZone: "Europe/London",
  weeklyWindows: { 1: WORKDAY, 2: WORKDAY, 3: WORKDAY, 4: WORKDAY, 5: WORKDAY },
  slotStepMinutes: 30,
  minNoticeHours: 12,
  horizonDays: 21,
  bufferMinutes: 10,
  maxPerDay: 3,
  closedDates: ENGLAND_WALES_BANK_HOLIDAYS,
};

const MINUTE = 60_000;

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes the zone is ahead of UTC at `date` (0 or 60 for London). */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE);
}

/** The UTC instant for a local wall-clock date and time in `timeZone`. */
export function zonedTimeToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = guess - zoneOffsetMinutes(new Date(guess), timeZone) * MINUTE;
  const check = zoneOffsetMinutes(new Date(result), timeZone);
  result = guess - check * MINUTE;
  return new Date(result);
}

/** Local calendar date ("YYYY-MM-DD") of `date` in `timeZone`. */
export function localDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function isoWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hhmmOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Every start time the rules allow, before checking the diary. */
export function generateCandidateSlots(now: Date, config: DiscoveryBookingConfig = DISCOVERY_BOOKING): Date[] {
  const earliest = now.getTime() + config.minNoticeHours * 60 * MINUTE;
  const today = localDateKey(now, config.timeZone);
  const closed = new Set(config.closedDates);
  const slots: Date[] = [];

  for (let i = 0; i <= config.horizonDays; i++) {
    const dateKey = addDays(today, i);
    if (closed.has(dateKey)) continue;
    const windows = config.weeklyWindows[isoWeekday(dateKey)] ?? [];
    for (const [from, to] of windows) {
      const last = minutesOf(to) - config.durationMinutes;
      for (let t = minutesOf(from); t <= last; t += config.slotStepMinutes) {
        const start = zonedTimeToUtc(dateKey, hhmmOf(t), config.timeZone);
        if (start.getTime() >= earliest) slots.push(start);
      }
    }
  }
  return slots;
}

function overlaps(aStart: number, aEnd: number, b: BusyInterval, bufferMs: number): boolean {
  return aStart < b.end.getTime() + bufferMs && aEnd > b.start.getTime() - bufferMs;
}

/**
 * Times a visitor may book: allowed by the rules, clear of every busy interval
 * (with the buffer either side), and on a day that hasn't reached its cap.
 * `bookedStarts` are discovery calls already booked, counted towards the cap.
 */
export function computeAvailableSlots(params: {
  now: Date;
  busy: BusyInterval[];
  bookedStarts: Date[];
  config?: DiscoveryBookingConfig;
}): Date[] {
  const config = params.config ?? DISCOVERY_BOOKING;
  const durationMs = config.durationMinutes * MINUTE;
  const bufferMs = config.bufferMinutes * MINUTE;

  const perDay = new Map<string, number>();
  for (const start of params.bookedStarts) {
    const key = localDateKey(start, config.timeZone);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const busy = [
    ...params.busy,
    ...params.bookedStarts.map((start) => ({ start, end: new Date(start.getTime() + durationMs) })),
  ];

  return generateCandidateSlots(params.now, config).filter((start) => {
    if ((perDay.get(localDateKey(start, config.timeZone)) ?? 0) >= config.maxPerDay) return false;
    const s = start.getTime();
    return !busy.some((b) => overlaps(s, s + durationMs, b, bufferMs));
  });
}

/** True when `startsAt` is exactly one of the offered times. */
export function isOfferedSlot(startsAt: Date, available: Date[]): boolean {
  const t = startsAt.getTime();
  return available.some((slot) => slot.getTime() === t);
}

/** Where visitors are sent if LegalNote's own booking can't offer times. */
export const DISCOVERY_FALLBACK_URL = "https://cal.com/jazz-legalnote-technologies/discovery";
