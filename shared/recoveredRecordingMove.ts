import { normalizeMatterKind } from "./matterKinds";
import { validateRecordingType } from "./recordingTypes";

/**
 * A recording that did not finish saving is recovered into a case of its own
 * ("Recovered Recording", "Unknown Client"). These rules decide when it can be
 * moved, whole, onto the matter it belongs to.
 */

export type RecoveredMoveSourceBlock =
  | "not_recovered"
  | "processing"
  | "has_transcript"
  | "has_documents"
  | "has_consent"
  | "no_recording"
  | "several_recordings"
  | "several_sessions"
  | "audio_deleted";

export const RECOVERED_MOVE_SOURCE_MESSAGES: Record<RecoveredMoveSourceBlock, string> = {
  not_recovered: "Only a recovered recording can be moved to another matter.",
  processing: "This recording is being processed. Wait until it finishes.",
  has_transcript: "This recording has already been transcribed here, so it can no longer be moved.",
  has_documents: "Documents have already been produced here, so the recording can no longer be moved.",
  has_consent:
    "Consent has already been sealed on this case. Sealed records cannot move, so the recording stays here.",
  no_recording: "There is no recording on this case to move.",
  several_recordings: "This case holds more than one recording, so it cannot be moved automatically.",
  several_sessions: "This case holds more than one session, so it cannot be moved automatically.",
  audio_deleted: "The audio for this recording has already been deleted.",
};

export interface RecoveredMoveSourceFacts {
  recovered: boolean;
  caseStatus: string | null | undefined;
  hasTranscript: boolean;
  documentCount: number;
  consentLogCount: number;
  recordingCount: number;
  sessionCount: number;
  audioDeleted: boolean;
}

export function recoveredMoveSourceBlock(facts: RecoveredMoveSourceFacts): RecoveredMoveSourceBlock | null {
  if (!facts.recovered) return "not_recovered";
  if (facts.caseStatus === "processing") return "processing";
  if (facts.hasTranscript) return "has_transcript";
  if (facts.documentCount > 0) return "has_documents";
  if (facts.consentLogCount > 0) return "has_consent";
  if (facts.recordingCount === 0) return "no_recording";
  if (facts.recordingCount > 1) return "several_recordings";
  if (facts.sessionCount > 1) return "several_sessions";
  if (facts.audioDeleted) return "audio_deleted";
  return null;
}

export interface RecoveredMoveTargetFacts {
  sourceCaseId: string;
  target: {
    id: string;
    archived?: boolean | null;
    matterKind?: string | null;
    practiceArea?: string | null;
  } | null;
  recordingType: unknown;
  /** Practice area supplied with the move, for a client matter that has none. */
  practiceArea?: unknown;
  practiceAreas: readonly string[];
}

export type RecoveredMoveTargetResult =
  | { ok: true; recordingType: string; setPracticeArea: string | null }
  | { ok: false; status: number; message: string };

export function checkRecoveredMoveTarget(facts: RecoveredMoveTargetFacts): RecoveredMoveTargetResult {
  const target = facts.target;
  if (!target) return { ok: false, status: 404, message: "Matter not found." };
  if (target.id === facts.sourceCaseId) {
    return { ok: false, status: 400, message: "Choose a different matter from the one the recording is on." };
  }
  if (target.archived) {
    return { ok: false, status: 400, message: "That matter is archived. Restore it before moving a recording to it." };
  }

  const typeResult = validateRecordingType(facts.recordingType, { matterKind: target.matterKind });
  if (!typeResult.ok) return { ok: false, status: 400, message: typeResult.message };

  let setPracticeArea: string | null = null;
  if (normalizeMatterKind(target.matterKind) === "client" && !target.practiceArea) {
    const requested = typeof facts.practiceArea === "string" ? facts.practiceArea : "";
    if (!facts.practiceAreas.includes(requested)) {
      return { ok: false, status: 400, message: "Practice area is required before the note is produced." };
    }
    setPracticeArea = requested;
  }

  return { ok: true, recordingType: typeResult.recordingType, setPracticeArea };
}

/** The hold reason written on the destination matter when a hold travels with the recording. */
export function carriedHoldReason(sourceTitle: string, sourceReason: string | null | undefined): string {
  const original = sourceReason?.trim() ? ` Original reason: ${sourceReason.trim()}` : "";
  return `Carried over with a recovered recording moved from "${sourceTitle}".${original}`;
}
