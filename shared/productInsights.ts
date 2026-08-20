/** Format meeting duration for quiet value reinforcement (no client/matter data). */
export function formatMeetingDurationLabel(durationSeconds: number | null | undefined): string | null {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds < 60) {
    return null;
  }
  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Estimate traditional note-up time vs meeting length (conservative heuristic).
 * Used only for soft value pulses — never billed figures.
 */
export function estimateNoteUpMinutes(durationSeconds: number | null | undefined): number | null {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds < 60) {
    return null;
  }
  const meetingMinutes = durationSeconds / 60;
  // Rough industry rule of thumb: ~0.5–1× meeting length to write up; use 0.6×
  return Math.max(15, Math.round(meetingMinutes * 0.6));
}

export function buildValuePulseCopy(
  durationSeconds: number | null | undefined,
  kind: "adopt" | "produce" = "adopt",
): {
  title: string;
  description: string;
} | null {
  const meetingLabel = formatMeetingDurationLabel(durationSeconds);
  const noteUp = estimateNoteUpMinutes(durationSeconds);
  if (!meetingLabel || noteUp == null) {
    return {
      title: kind === "produce" ? "Notes ready to review" : "Matter review complete",
      description:
        kind === "produce"
          ? "Your session documents are ready — adopt when you are satisfied."
          : "Your adopted notes are locked and ready to share when you need them.",
    };
  }
  if (kind === "produce") {
    return {
      title: `${meetingLabel} of meeting → notes ready`,
      description: `That’s roughly ${noteUp} minutes of traditional write-up you didn’t have to start from scratch.`,
    };
  }
  return {
    title: `${meetingLabel} of meeting → note adopted`,
    description: `That’s roughly ${noteUp} minutes of traditional write-up you didn’t have to start from scratch.`,
  };
}

/** Light scrub so free-text feedback stays free of obvious client identifiers. */
export function scrubInsightComment(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let text = raw.trim().slice(0, 280);
  if (!text) return null;
  text = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[redacted]")
    .replace(/\b[A-Z]{2,}\/[A-Z]{2,}\d{2,}[-/]?\d*\b/g, "[redacted]")
    .replace(/\bREE\/[A-Z0-9/-]+\b/gi, "[redacted]");
  return text;
}

export function adoptFeedbackStorageKey(caseId: string): string {
  return `ln-adopt-feedback:${caseId}`;
}

export function valuePulseStorageKey(caseId: string, kind: "adopt" | "produce"): string {
  return `ln-value-pulse:${kind}:${caseId}`;
}
