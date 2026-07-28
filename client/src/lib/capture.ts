/** Capture launcher modes — maps to the five primary intents. */
export type CaptureMode =
  | "record"
  | "join"
  | "import"
  | "transcript"
  | "phone";

export const CAPTURE_MODES: readonly CaptureMode[] = [
  "record",
  "join",
  "import",
  "transcript",
  "phone",
] as const;

export function isCaptureMode(value: string | null | undefined): value is CaptureMode {
  return !!value && (CAPTURE_MODES as readonly string[]).includes(value);
}

export function buildCapturePath(options?: {
  mode?: CaptureMode;
  caseId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options?.mode) params.set("mode", options.mode);
  if (options?.caseId) params.set("caseId", options.caseId);
  const qs = params.toString();
  return qs ? `/capture?${qs}` : "/capture";
}

/** Modes that require an existing matter before the flow can start. */
export function captureModeRequiresCase(mode: CaptureMode): boolean {
  return mode === "import" || mode === "transcript" || mode === "phone";
}
