/**
 * Client-side ETA for Meeting-to-Matter™ document production.
 * Combines milestone baselines with elapsed/progress velocity so the
 * countdown stays live and recalibrates as the server reports progress.
 */

const DOC_PHASE_SEC = 90;
const DEFAULT_FULL_PIPELINE_SEC = 180;
const PRODUCE_VERSION_SEC = 75;

/** Typical seconds still needed from each server progress milestone. */
const MILESTONE_REMAINING: Array<{ progress: number; remaining: number }> = [
  { progress: 0, remaining: 180 },
  { progress: 10, remaining: 170 },
  { progress: 20, remaining: 140 },
  { progress: 35, remaining: 95 },
  { progress: 40, remaining: 80 },
  { progress: 42, remaining: 75 },
  { progress: 55, remaining: 45 },
  { progress: 70, remaining: 30 },
  { progress: 85, remaining: 15 },
  { progress: 100, remaining: 0 },
];

export function isProduceVersionStep(currentStep?: string): boolean {
  if (!currentStep) return false;
  const s = currentStep.toLowerCase();
  return (
    s.includes("further version") ||
    s.includes("derivation engine") ||
    s.includes("compile a further") ||
    s.includes("further version production")
  );
}

export function estimateTranscriptionSeconds(audioDurationSec?: number | null): number {
  if (!audioDurationSec || audioDurationSec <= 0) return 75;
  // AssemblyAI is typically well under real-time
  return Math.round(Math.max(25, Math.min(audioDurationSec * 0.35, 240)));
}

export function milestoneRemainingSeconds(
  progress: number,
  opts?: { audioDurationSec?: number | null; produceVersion?: boolean },
): number {
  if (progress >= 100) return 0;

  if (opts?.produceVersion) {
    return Math.max(8, Math.round(PRODUCE_VERSION_SEC * (1 - progress / 100)));
  }

  let lower = MILESTONE_REMAINING[0];
  let upper = MILESTONE_REMAINING[MILESTONE_REMAINING.length - 1];
  for (let i = 0; i < MILESTONE_REMAINING.length - 1; i++) {
    if (
      progress >= MILESTONE_REMAINING[i].progress &&
      progress <= MILESTONE_REMAINING[i + 1].progress
    ) {
      lower = MILESTONE_REMAINING[i];
      upper = MILESTONE_REMAINING[i + 1];
      break;
    }
  }

  const span = upper.progress - lower.progress || 1;
  const t = (progress - lower.progress) / span;
  let remaining = lower.remaining + (upper.remaining - lower.remaining) * t;

  if (progress < 40 && opts?.audioDurationSec) {
    const transcription = estimateTranscriptionSeconds(opts.audioDurationSec);
    const expectedEarly = transcription + DOC_PHASE_SEC;
    remaining = remaining * (expectedEarly / DEFAULT_FULL_PIPELINE_SEC);
  }

  return Math.max(8, Math.round(remaining));
}

export function estimateRemainingSeconds(params: {
  progress: number;
  elapsedSec: number;
  audioDurationSec?: number | null;
  currentStep?: string;
}): number {
  const { progress, elapsedSec, audioDurationSec, currentStep } = params;
  if (progress >= 100) return 0;

  const produceVersion = isProduceVersionStep(currentStep);
  const milestone = milestoneRemainingSeconds(progress, {
    audioDurationSec,
    produceVersion,
  });

  if (progress < 8 || elapsedSec < 5) {
    return milestone;
  }

  const projectedTotal = elapsedSec / (progress / 100);
  const velocityRemaining = projectedTotal - elapsedSec;
  const velocityWeight = Math.min(0.75, progress / 50);
  const blended =
    milestone * (1 - velocityWeight) + Math.max(0, velocityRemaining) * velocityWeight;

  return Math.max(progress >= 95 ? 3 : 8, Math.round(blended));
}

export function formatEtaCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s`;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

/**
 * Human ETA copy. "Almost done…" only when real server progress is near the end —
 * never from a mid-run countdown floor while the bar is still creeping (e.g. 54%).
 */
export function formatEtaLabel(seconds: number, progress?: number): string {
  const nearEnd = progress == null ? false : progress >= 90;
  if (seconds <= 5 && nearEnd) return "Almost done…";
  return `About ${formatEtaCountdown(Math.max(seconds, nearEnd ? 0 : 8))} remaining`;
}

export function processingStartStorageKey(caseId: string): string {
  return `processingStart_${caseId}`;
}
