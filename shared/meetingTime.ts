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

/** A recording start more than this far ahead of the server clock is not trusted. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The start a session should carry once we know when its recording began.
 * Sessions are numbered by start, so a recording filed days after the meeting
 * must take the meeting's time, not the filing time. Only ever moves a session
 * earlier, never later, and ignores a start that is in the future.
 * Returns null when the session's current start should stay.
 */
export function sessionStartFromRecording(
  currentStart: Date | string | null | undefined,
  recordingStart: Date | string | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (recordingStart == null) return null;
  const recording = new Date(recordingStart);
  if (Number.isNaN(recording.getTime())) return null;
  if (recording.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return null;
  if (currentStart == null) return recording;
  const current = new Date(currentStart);
  if (Number.isNaN(current.getTime())) return recording;
  return recording.getTime() < current.getTime() ? recording : null;
}

/** A recording held on the device for longer than this before reaching the server is not trusted. */
const MAX_DEVICE_HOLD_MS = 24 * 60 * 60 * 1000;

export interface DeviceRecordingStart {
  /** When the recording began, on the server's clock. */
  startedAt: Date;
  /** "device": from the device's own times. "server": when the server heard of it. */
  source: "device" | "server";
  /** The device's start time as it reported it, if any. */
  deviceStartedAt: Date | null;
  /** How far the device clock was behind (+) or ahead (-) of the server, in ms. */
  deviceClockOffsetMs: number | null;
}

/**
 * When a recording began. The device reports when it pressed record and its own time
 * now; the gap between the two is how long the recording waited, for example while
 * offline. That gap is taken back from the server's time now. When the device clock is
 * right this is exactly the device's start time; when it is off, the error cancels out.
 * The server's own time is only used when the device gives nothing usable.
 */
export function recordingStartFromDevice(input: {
  serverNow: Date;
  deviceStartedAt?: string | Date | null;
  deviceNow?: string | Date | null;
}): DeviceRecordingStart {
  const serverOnly: DeviceRecordingStart = {
    startedAt: input.serverNow,
    source: "server",
    deviceStartedAt: null,
    deviceClockOffsetMs: null,
  };
  if (input.deviceStartedAt == null || input.deviceNow == null) return serverOnly;
  const started = new Date(input.deviceStartedAt);
  const now = new Date(input.deviceNow);
  if (Number.isNaN(started.getTime()) || Number.isNaN(now.getTime())) return serverOnly;
  const waitedMs = now.getTime() - started.getTime();
  if (waitedMs < 0 || waitedMs > MAX_DEVICE_HOLD_MS) {
    return { ...serverOnly, deviceStartedAt: started };
  }
  return {
    startedAt: new Date(input.serverNow.getTime() - waitedMs),
    source: "device",
    deviceStartedAt: started,
    deviceClockOffsetMs: input.serverNow.getTime() - now.getTime(),
  };
}
