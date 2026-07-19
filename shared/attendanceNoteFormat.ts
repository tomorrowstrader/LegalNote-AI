/**
 * Attendance-note markdown normalization.
 * Keeps section labels bold and on their own lines; body text stays regular weight.
 */

export const ATTENDANCE_SECTION_LABELS = [
  'What was discussed:',
  'Advice given:',
  'Key points advised:',
  'Reasoning behind advice and decisions:',
  "Client's instructions and response:",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LABEL_ALTERNATION = ATTENDANCE_SECTION_LABELS.map(escapeRegExp).join('|');

/**
 * Normalize section labels so they render as:
 *   **What was discussed:**
 *   Body text…
 *
 * Handles glued labels ("railway.Advice given:I advised"), label+body wrapped in
 * one bold span, and unclosed ** after a label (which otherwise bolds the rest
 * of the document).
 */
export function normalizeAttendanceSectionLabels(body: string): string {
  if (!body) return body;
  let result = body;

  // Close unclosed bold that opens on a section-label line: **Advice given:
  result = result.replace(
    new RegExp(`^([ \\t]*)\\*\\*((?:${LABEL_ALTERNATION}))[ \\t]*$`, 'gim'),
    '$1**$2**',
  );

  // **Label: body text** → **Label:**\n\nbody text
  result = result.replace(
    new RegExp(`\\*\\*((?:${LABEL_ALTERNATION}))\\s+([^*]+?)\\*\\*`, 'gi'),
    '**$1**\n\n$2',
  );

  // Split labels glued to preceding prose (not markdown * markers):
  // "...railway.Advice given:" or "...railway.**Advice given:**"
  result = result.replace(
    new RegExp(
      `([A-Za-z0-9.,;:!?'"”)\\]])((?:\\*\\*)?(?:${LABEL_ALTERNATION})(?:\\*\\*)?)`,
      'gi',
    ),
    '$1\n\n$2',
  );

  // Already-bold label with body on the same line: **Advice given:**I advised
  result = result.replace(
    new RegExp(
      `^([ \\t]*)\\*\\*((?:${LABEL_ALTERNATION}))\\*\\*[ \\t]*(\\S.*)$`,
      'gim',
    ),
    '$1**$2**\n$3',
  );

  // Plain label with body on the same line: Advice given:I advised
  result = result.replace(
    new RegExp(
      `^([ \\t]*)(?!\\*\\*)((?:${LABEL_ALTERNATION}))[ \\t]*(\\S.*)$`,
      'gim',
    ),
    '$1**$2**\n$3',
  );

  // Standalone label lines → bold label only
  result = result.replace(
    new RegExp(
      `^([ \\t]*)(?:\\*\\*)?((?:${LABEL_ALTERNATION}))(?:\\*\\*)?[ \\t]*$`,
      'gim',
    ),
    '$1**$2**',
  );

  // Numbered CAPS topic headings on their own line
  result = result.replace(
    /^([ \t]*)(?:\*\*)?(\d+\.\s+[A-Z][A-Z0-9 ,/'&()——–-]{2,})(?:\*\*)?[ \t]*$/gm,
    '$1**$2**',
  );

  return result.replace(/\n{3,}/g, '\n\n');
}
