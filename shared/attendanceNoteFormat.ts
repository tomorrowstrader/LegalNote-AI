/**
 * Attendance-note markdown normalization.
 * Keeps section labels bold and on their own lines; body text stays regular weight
 * and starts on the line under the label (blank line so TipTap/markdown-it do not
 * collapse label+body onto one visual line).
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

/** Find the start of the MATTERS DISCUSSED body (bold or plain heading). */
export function findAttendanceMattersBodyIndex(content: string): number {
  if (!content) return -1;
  const match = content.match(/^\s*(?:\*\*)?MATTERS DISCUSSED(?:\*\*)?/im);
  return match?.index ?? -1;
}

/**
 * Normalize section labels so they render as:
 *   **What was discussed:**
 *
 *   Body text…
 *
 * Handles glued labels ("railway.Advice given:I advised"), label+body wrapped in
 * one bold span, missing space after the colon ("**What was discussed:The client"),
 * and unclosed ** after a label (which otherwise bolds the rest of the document).
 */
export function normalizeAttendanceSectionLabels(body: string): string {
  if (!body) return body;
  let result = body;

  // Canonicalise MATTERS DISCUSSED heading (older notes often omit bold)
  result = result.replace(
    /^([ \t]*)(?:\*\*)?MATTERS DISCUSSED(?:\*\*)?[ \t]*$/gim,
    '$1**MATTERS DISCUSSED**',
  );

  // Close unclosed bold that opens on a section-label line: **Advice given:
  result = result.replace(
    new RegExp(`^([ \\t]*)\\*\\*((?:${LABEL_ALTERNATION}))[ \\t]*$`, 'gim'),
    '$1**$2**',
  );

  // **Label: body text** → **Label:**\n\nbody text  (space after colon)
  result = result.replace(
    new RegExp(`\\*\\*((?:${LABEL_ALTERNATION}))\\s+([^*]+?)\\*\\*`, 'gi'),
    '**$1**\n\n$2',
  );

  // **Label:body** or **Label:body (no space after colon; bold never closed after label)
  result = result.replace(
    new RegExp(
      `^([ \\t]*)\\*\\*((?:${LABEL_ALTERNATION}))(?!\\*\\*)[ \\t]*(\\S.*?)(?:\\*\\*)?[ \\t]*$`,
      'gim',
    ),
    '$1**$2**\n\n$3',
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
    '$1**$2**\n\n$3',
  );

  // Plain label with body on the same line: Advice given:I advised
  result = result.replace(
    new RegExp(
      `^([ \\t]*)(?!\\*\\*)((?:${LABEL_ALTERNATION}))[ \\t]*(\\S.*)$`,
      'gim',
    ),
    '$1**$2**\n\n$3',
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

  // Ensure a blank line after every bold section label so body is a separate
  // paragraph (single \\n collapses to a space in TipTap/markdown-it).
  result = result.replace(
    new RegExp(
      `^([ \\t]*\\*\\*(?:${LABEL_ALTERNATION})\\*\\*)[ \\t]*\\n(?!\\n)`,
      'gim',
    ),
    '$1\n\n',
  );

  // Same for numbered topic headings — keep a line drop before following content
  result = result.replace(
    /^([ \t]*\*\*\d+\.\s+[A-Z][A-Z0-9 ,/'&()——–-]{2,}\*\*)[ \t]*\n(?!\n)/gm,
    '$1\n\n',
  );

  return result.replace(/\n{3,}/g, '\n\n');
}
