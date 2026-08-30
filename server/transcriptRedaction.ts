export type TranscriptRedactionMarker = {
  id?: string;
  start: number;
  end: number;
  textStart?: number;
  textEnd?: number;
  status?: string;
};

export function isFullUtteranceRedaction(r: TranscriptRedactionMarker): boolean {
  return r.textStart === undefined && r.textEnd === undefined;
}

export function isPartialUtteranceRedaction(r: TranscriptRedactionMarker): boolean {
  return typeof r.textStart === 'number' && typeof r.textEnd === 'number';
}

export function sameUtterance(
  r: TranscriptRedactionMarker,
  start: number,
  end: number,
): boolean {
  return r.start === start && r.end === end;
}

export function partialTextRangesOverlap(
  a: { textStart: number; textEnd: number },
  b: { textStart: number; textEnd: number },
): boolean {
  return a.textStart < b.textEnd && a.textEnd > b.textStart;
}

export type NewTranscriptRedactionRequest = {
  start: number;
  end: number;
  textStart?: number;
  textEnd?: number;
};

export type ValidateNewTranscriptRedactionResult =
  | { ok: true; baseRedactions: TranscriptRedactionMarker[]; supersededPartialIds: string[] }
  | { ok: false; message: string };

/**
 * Validates a pending transcript redaction and returns the redaction list after
 * removing any partial markers superseded by a full-segment redaction.
 */
export function validateNewTranscriptRedaction(
  currentRedactions: TranscriptRedactionMarker[],
  request: NewTranscriptRedactionRequest,
): ValidateNewTranscriptRedactionResult {
  const isPartial =
    typeof request.textStart === 'number' && typeof request.textEnd === 'number';

  if (isPartial) {
    const { start, end, textStart, textEnd } = request as {
      start: number;
      end: number;
      textStart: number;
      textEnd: number;
    };

    const duplicate = currentRedactions.some(
      (r) =>
        r.start === start &&
        r.end === end &&
        r.textStart === textStart &&
        r.textEnd === textEnd,
    );
    if (duplicate) {
      return { ok: false, message: 'This text is already redacted' };
    }

    const hasFull = currentRedactions.some(
      (r) => sameUtterance(r, start, end) && isFullUtteranceRedaction(r),
    );
    if (hasFull) {
      return {
        ok: false,
        message:
          'This segment is already fully redacted. Remove the segment redaction first if you need to change it.',
      };
    }

    const partialOverlap = currentRedactions.some(
      (r) =>
        sameUtterance(r, start, end) &&
        isPartialUtteranceRedaction(r) &&
        partialTextRangesOverlap(
          { textStart, textEnd },
          { textStart: r.textStart!, textEnd: r.textEnd! },
        ),
    );
    if (partialOverlap) {
      return {
        ok: false,
        message:
          'This selection overlaps with an existing partial redaction on this segment. Adjust your selection or undo the existing redaction first.',
      };
    }

    const crossUtteranceOverlap = currentRedactions.some((r) => {
      if (sameUtterance(r, start, end)) return false;
      return r.start < end && r.end > start;
    });
    if (crossUtteranceOverlap) {
      return {
        ok: false,
        message: 'This selection overlaps with an existing redaction. Please adjust your selection.',
      };
    }

    return { ok: true, baseRedactions: currentRedactions, supersededPartialIds: [] };
  }

  const duplicateFull = currentRedactions.some(
    (r) => sameUtterance(r, request.start, request.end) && isFullUtteranceRedaction(r),
  );
  if (duplicateFull) {
    return { ok: false, message: 'This segment is already fully redacted' };
  }

  const supersededPartials = currentRedactions.filter(
    (r) => sameUtterance(r, request.start, request.end) && isPartialUtteranceRedaction(r),
  );
  const baseRedactions = currentRedactions.filter(
    (r) => !(sameUtterance(r, request.start, request.end) && isPartialUtteranceRedaction(r)),
  );

  const crossOverlap = baseRedactions.some(
    (r) => r.start < request.end && r.end > request.start,
  );
  if (crossOverlap) {
    return {
      ok: false,
      message: 'This selection overlaps with an existing redaction. Please adjust your selection.',
    };
  }

  return {
    ok: true,
    baseRedactions,
    supersededPartialIds: supersededPartials
      .map((r) => r.id)
      .filter((id): id is string => typeof id === 'string'),
  };
}
