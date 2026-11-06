export type DocumentGovernanceViolationType =
  | 'speaker_label'
  | 'transcript_reference'
  | 'recording_reference'
  | 'session_reference'
  | 'continuation_commentary'
  | 'page_marker';

export interface DocumentGovernanceViolation {
  type: DocumentGovernanceViolationType;
  pattern: string;
  match: string;
  index: number;
}

const GOVERNANCE_PATTERNS: ReadonlyArray<{
  type: DocumentGovernanceViolationType;
  label: string;
  regex: RegExp;
}> = [
  { type: 'speaker_label', label: 'Speaker [A-Z]', regex: /\bSpeaker\s+[A-Z]\b/g },
  { type: 'transcript_reference', label: 'the transcript', regex: /\bthe transcript\b/gi },
  { type: 'recording_reference', label: 'this recording', regex: /\bthis recording\b/gi },
  { type: 'session_reference', label: 'this session', regex: /\bthis session\b/gi },
  // Leaked model meta-commentary about a continuation call, rather than document content.
  { type: 'continuation_commentary', label: 'continuation task', regex: /\bcontinuation task\b/gi },
  { type: 'continuation_commentary', label: 'no continuation required/needed', regex: /\bno continuation (?:is |was )?(?:required|needed)\b/gi },
  { type: 'continuation_commentary', label: 'the correct output is', regex: /\bthe correct output is\b/gi },
  { type: 'continuation_commentary', label: 'document appears to have ended', regex: /\bdocument appears to have (?:ended|ceased)\b/gi },
  { type: 'continuation_commentary', label: 'is a duplicate and should be deleted/removed', regex: /\bis a duplicate and should be (?:deleted|removed)\b/gi },
  { type: 'page_marker', label: 'Page N on its own line', regex: /^[ \t]*(?:\*\*)?Page \d+(?: of \d+)?(?:\*\*)?[ \t]*$/gim },
];

export function scanDocumentGovernanceViolations(content: string): DocumentGovernanceViolation[] {
  const violations: DocumentGovernanceViolation[] = [];

  for (const { type, label, regex } of GOVERNANCE_PATTERNS) {
    const matcher = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(content)) !== null) {
      violations.push({
        type,
        pattern: label,
        match: match[0],
        index: match.index,
      });
    }
  }

  return violations;
}

/**
 * These are never right in a finished note, so they stop it being released as it is.
 * "The transcript" and similar can be legitimate, for example a court transcript, so
 * those stay logged only.
 */
const RELEASE_BLOCKING_TYPES = new Set<DocumentGovernanceViolationType>([
  'speaker_label',
  'continuation_commentary',
  'page_marker',
]);

export function findReleaseBlockers(content: string): DocumentGovernanceViolation[] {
  return scanDocumentGovernanceViolations(content).filter((v) => RELEASE_BLOCKING_TYPES.has(v.type));
}

/** Warn-mode instrument: log violations tagged by recording type; never reject. */
export function logDocumentGovernanceViolations(
  content: string,
  recordingType: string,
  context?: { caseId?: string },
): DocumentGovernanceViolation[] {
  const violations = scanDocumentGovernanceViolations(content);
  if (violations.length === 0) {
    return violations;
  }

  for (const violation of violations) {
    console.warn(
      '[DOCUMENT_GOVERNANCE]',
      JSON.stringify({
        recordingType,
        caseId: context?.caseId,
        violationType: violation.type,
        pattern: violation.pattern,
        match: violation.match,
        index: violation.index,
      }),
    );
  }

  return violations;
}
