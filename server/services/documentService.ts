import { getPrivilegedLLMProvider } from './llm/providerFactory';
import { privilegedComplete } from './llm/privilegedComplete';
import { CLIENT_FACING_RECORDING_TYPES } from '@shared/recordingTypes';
import { getPracticeAreaPromptContext } from './practiceAreaConfig';
import { DERIVATION_ENGINE_RULES } from './derivationEngine';

/**
 * Post-process document content to ensure known section headings are bold.
 * Only matches specific legal document section headings to avoid false positives.
 * Idempotent - already bold headings are not re-wrapped.
 */
function ensureBoldHeadings(content: string): string {
  const knownHeadings = [
    'ATTENDANCE NOTE',
    'MEETING SUMMARY',
    'MATTERS DISCUSSED',
    'NEXT STEPS',
    'KEY POINTS',
    'CRITICAL ISSUES IDENTIFIED',
    'IMMEDIATE ACTIONS REQUIRED',
    'CLIENT CONCERNS',
    'SOLICITOR RECOMMENDATIONS',
    'MATTER SUMMARY',
    'OUTSTANDING ACTION ITEMS',
    'IMPORTANT DATES',
    'SUGGESTED AGENDA ITEMS',
    'CLIENT CONFIRMATION',
    'INTRODUCTION',
    'BACKGROUND',
    'SUMMARY',
    'CONCLUSION',
    'ASSETS SUMMARY',
    'DISCUSSION POINTS',
    'ACTION ITEMS',
    'DECISIONS MADE',
    'PURPOSE OF MEETING',
    'ADDITIONAL NOTES',
    'Attendance Note',
    'Meeting Summary',
    'Matters Discussed',
    'Next Steps',
    'Key Points',
    'Critical Issues Identified',
    'Immediate Actions Required',
    'Client Concerns',
    'Solicitor Recommendations',
    'Matter Summary',
    'Outstanding Action Items',
    'Important Dates',
    'Suggested Agenda Items',
    'Client Confirmation',
    'Introduction',
    'Background',
    'Summary',
    'Conclusion',
    'Assets Summary',
    'Discussion Points',
    'Action Items',
    'Decisions Made',
    'Purpose of Meeting',
    'Additional Notes',
    'Key Discussion Points from Previous Meeting',
    'AML COMPLIANCE SUMMARY',
    'AML Compliance Summary',
    'Identity Verification',
    'Nature and Purpose of Instruction',
    'Source of Funds',
    'Beneficial Ownership',
    'PEP/Sanctions Status',
    'Risk Assessment',
    'Enhanced Due Diligence (EDD)',
    'Solicitor Confirmation',
  ];
  
  let result = content;
  
  for (const heading of knownHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberedPattern = new RegExp(
      `^(\\d+\\.)\\s+(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`,
      'gm'
    );
    result = result.replace(numberedPattern, `$1 **${heading}**$2`);
    
    const standalonePattern = new RegExp(
      `^(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`,
      'gm'
    );
    result = result.replace(standalonePattern, `**${heading}**$1`);
  }
  
  result = ensureSectionSpacing(result);
  
  return result;
}

function ensureSectionSpacing(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isHeadingLine = trimmed.startsWith('## ') || trimmed.startsWith('### ') ||
      /^\*\*[A-Z]/.test(trimmed) || /^\d+\.\s+\*\*/.test(trimmed);
    
    if (isHeadingLine && i > 0) {
      const prevLine = result.length > 0 ? result[result.length - 1].trim() : '';
      if (prevLine !== '') {
        result.push('');
      }
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

const VERIFICATION_PARSE_FALLBACK =
  'Verification response could not be parsed — solicitor review is required before this document is added to the client file';

const VERIFIER_NON_DEFECT_TRIGGERS = [
  'withdraw',
  'withdrawing',
  'not a defect',
  'no defect',
  'not defective',
  'is correct arithmetic',
  'correct practice',
  'not flagged',
  'no unsupported content',
] as const;

function getVerifierNonDefectTrigger(text: string): string | null {
  const lower = text.toLowerCase();
  for (const trigger of VERIFIER_NON_DEFECT_TRIGGERS) {
    if (lower.includes(trigger)) return trigger;
  }
  return null;
}

function isVerifierNonDefectEntry(text: string): boolean {
  return getVerifierNonDefectTrigger(text) !== null;
}

function logVerifierNonDefectDrop(text: string, context: string): void {
  const trigger = getVerifierNonDefectTrigger(text);
  if (!trigger) return;
  if (process.env.VERIFY_RAW_LOG === '1') {
    console.log('[verify-drop-non-defect]', JSON.stringify({ context, trigger, text }));
  }
}

function shouldDropVerifierNonDefectEntry(text: string, context: string): boolean {
  const trigger = getVerifierNonDefectTrigger(text);
  if (!trigger) return false;
  logVerifierNonDefectDrop(text, context);
  return true;
}

function logVerifierShapeDrop(item: unknown): void {
  if (process.env.VERIFY_RAW_LOG === '1') {
    console.log('[verify-drop-shape]', JSON.stringify({ item }));
  }
}

function normalizeVerificationStatementItem(item: unknown): string | null {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed || shouldDropVerifierNonDefectEntry(trimmed, 'string')) return null;
    return assertNormalizedWarningString(trimmed);
  }
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;

    const offendingStatement =
      typeof record.offending_statement === 'string' ? record.offending_statement.trim() : '';
    if (offendingStatement && !shouldDropVerifierNonDefectEntry(offendingStatement, 'offending_statement')) {
      const explanation = pickVerificationExplanation(record);
      if (explanation && explanation !== offendingStatement) {
        const combined = `${offendingStatement} — ${explanation}`;
        if (shouldDropVerifierNonDefectEntry(combined, 'offending_statement+explanation')) return null;
        return assertNormalizedWarningString(combined);
      }
      return assertNormalizedWarningString(offendingStatement);
    }

    for (const key of ['statement', 'text', 'quote', 'description', 'content']) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !shouldDropVerifierNonDefectEntry(trimmed, key)) {
          return assertNormalizedWarningString(trimmed);
        }
      }
    }

    for (const key of ['issue', 'reason']) {
      const value = record[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !shouldDropVerifierNonDefectEntry(trimmed, key)) {
          return assertNormalizedWarningString(trimmed);
        }
      }
    }

    console.error('Verification warning normalisation failure — could not extract statement from object:', JSON.stringify(item));
    logVerifierShapeDrop(item);
    return null;
  }
  if (item != null) {
    const asString = String(item).trim();
    if (!asString || shouldDropVerifierNonDefectEntry(asString, 'coerced')) return null;
    return assertNormalizedWarningString(asString);
  }
  return null;
}

function pickVerificationExplanation(record: Record<string, unknown>): string | null {
  for (const key of ['issue', 'reason', 'explanation', 'rationale']) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && !isVerifierNonDefectEntry(trimmed)) return trimmed;
    }
  }
  return null;
}

function assertNormalizedWarningString(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || /"issue"\s*:/.test(trimmed)) {
    console.error('Verification warning normalisation failure — raw object reached warnings array:', trimmed);
  }
  return trimmed;
}

function normalizeVerificationStatements(items: unknown): string[] {
  if (items == null) return [];
  if (!Array.isArray(items)) {
    const single = normalizeVerificationStatementItem(items);
    return single ? [single] : [];
  }
  const normalized: string[] = [];
  for (const item of items) {
    const statement = normalizeVerificationStatementItem(item);
    if (statement) normalized.push(statement);
  }
  return normalized;
}

/** Model prose starts here; header/metadata above may legitimately contain dashes. */
function modelProseStartIndex(document: string): number {
  const attendanceIdx = document.indexOf('**MATTERS DISCUSSED**');
  if (attendanceIdx >= 0) return attendanceIdx;
  const letterIdx = document.indexOf('**What we discussed**');
  if (letterIdx >= 0) return letterIdx;
  const summaryIdx = document.indexOf('**Key Points:**');
  if (summaryIdx >= 0) return summaryIdx;
  const callIdx = document.indexOf('**CALL SUMMARY**');
  if (callIdx >= 0) return callIdx;
  return -1;
}

function replaceEmEnDashes(text: string): string {
  const fired: string[] = [];

  let result = text.replace(
    /([\d£][\d,£.]*\d)\s*[\u2013\u2014]\s*([\d£][\d,£.]*\d)/g,
    (match, left, right) => {
      fired.push(match);
      return `${left} to ${right}`;
    },
  );

  result = result.replace(/\s+[\u2013\u2014]\s+/g, (match) => {
    fired.push(match);
    return ', ';
  });

  result = result.replace(/[\u2013\u2014]/g, (match) => {
    fired.push(match);
    return ', ';
  });

  if (fired.length > 0) {
    console.warn(`[dash-guard] Replaced em/en dash in: ${fired.map((s) => JSON.stringify(s)).join(', ')}`);
  }

  return result;
}

function extractAuthoritativeNamesFromDocument(document: string): {
  clientName?: string;
  feeEarnerName?: string;
} {
  const clientMatch =
    document.match(/^\*\*CLIENT:\*\*\s+(.+)$/m) ?? document.match(/^\*\*Client:\*\*\s+(.+)$/m);
  const preparedMatch = document.match(/^Prepared by:\s*(.+)$/m);
  return {
    clientName: clientMatch?.[1]?.trim(),
    feeEarnerName: preparedMatch?.[1]?.trim(),
  };
}

function resolveVerificationAuthoritativeNames(
  document: string,
  metadata?: Pick<CaseMetadata, 'clientName' | 'feeEarnerName'>,
): { clientName?: string; feeEarnerName?: string } {
  const fromDocument = extractAuthoritativeNamesFromDocument(document);
  return {
    clientName: metadata?.clientName ?? fromDocument.clientName,
    feeEarnerName: metadata?.feeEarnerName ?? fromDocument.feeEarnerName,
  };
}

function sanitizeModelProseDashes(document: string): string {
  const proseStart = modelProseStartIndex(document);
  if (proseStart < 0) return document;
  return document.slice(0, proseStart) + replaceEmEnDashes(document.slice(proseStart));
}

function buildAttendanceNoteHeader(metadata: CaseMetadata, prefs: Required<FirmPreferences>): string {
  let metadataFields = `File Ref: ${metadata.matterReference || 'TBD'}
Date: ${metadata.recordingDate}`;

  if (metadata.meetingStartTime) {
    metadataFields += `\nTime: ${metadata.meetingStartTime}`;
  }

  if (metadata.durationDisplay) {
    metadataFields += `\nDuration: ${metadata.durationDisplay}`;
  }

  if (metadata.units != null && metadata.units > 0) {
    metadataFields += `\nTime Spent (Units): ${metadata.units}`;
  }

  metadataFields += `\nAdvisor: ${metadata.feeEarnerDisplayName ?? 'Not specified'}`;

  return `**ATTENDANCE NOTE**

${metadataFields}

**MATTER:** ${metadata.title}

**CLIENT:** ${metadata.clientName}

`;
}

function buildAttendanceNoteFooter(metadata: CaseMetadata, prefs: Required<FirmPreferences>): string {
  let footer = '';
  if (metadata.durationDisplay) {
    footer += `\n\nTime Engaged: ${metadata.durationDisplay}\n`;
  }

  footer += `\nThis attendance note is subject to legal professional privilege.

Prepared by: ${metadata.feeEarnerDisplayName ?? 'Not specified'}
Date Prepared: ${metadata.datePrepared ?? metadata.recordingDate}`;

  if (prefs.includeClientConfirmation) {
    footer += `\n\n**CLIENT CONFIRMATION**

I confirm the above is an accurate record of our meeting.

Client Signature: ________________

Date: ________________`;
  }

  return footer;
}

function stripTrailingAttendanceFooter(body: string): string {
  const footerPatterns = [
    /\nTime Engaged:/i,
    /\nDate prepared:/i,
    /\nPrepared by:/i,
    /\nlegal professional privilege/i,
    /\nThis attendance note is subject to legal professional privilege/i,
    /\nYours sincerely[,]?/i,
    /\nYours faithfully[,]?/i,
    /\nKind regards[,]?/i,
    /\n\*\*CLIENT CONFIRMATION\*\*/i,
  ];
  let cutAt = body.length;
  for (const pattern of footerPatterns) {
    const idx = body.search(pattern);
    if (idx >= 0 && idx < cutAt) cutAt = idx;
  }
  if (cutAt < body.length) {
    const stripped = body.slice(cutAt).trimEnd();
    console.warn(`[footer-strip] Removed trailing model footer content: ${JSON.stringify(stripped)}`);
  }
  return body.slice(0, cutAt).trimEnd();
}

function extractGeneratedBody(content: string, startMarker: string): string {
  const idx = content.indexOf(startMarker);
  if (idx >= 0) {
    return stripTrailingAttendanceFooter(content.slice(idx).trim());
  }
  console.warn(`Expected start marker "${startMarker}" not found in model output; using full output`);
  return stripTrailingAttendanceFooter(content.trim());
}

function assembleAttendanceNoteDocument(
  modelBody: string,
  metadata: CaseMetadata,
  prefs: Required<FirmPreferences>,
): string {
  const body = extractGeneratedBody(modelBody, '**MATTERS DISCUSSED**');
  const mattersBody = body.startsWith('**MATTERS DISCUSSED**')
    ? body
    : `**MATTERS DISCUSSED**\n\n${body}`;
  return `${buildAttendanceNoteHeader(metadata, prefs)}${mattersBody}${buildAttendanceNoteFooter(metadata, prefs)}`;
}

function buildSummaryHeader(metadata: CaseMetadata): string {
  return `**Client:** ${metadata.clientName}
**Matter reference:** ${metadata.matterReference || 'TBD'}
**Date:** ${metadata.recordingDate}

`;
}

function buildClientLetterFooter(metadata: CaseMetadata): string {
  const feeEarner = metadata.feeEarnerDisplayName ?? metadata.feeEarnerName ?? 'Not specified';
  const firm = metadata.firmName ?? 'Not specified';
  return `\n\nYours sincerely,\n\n${feeEarner}\n${firm}`;
}

function extractClientLetterBody(content: string): string {
  return stripTrailingAttendanceFooter(content.trim());
}

function assembleSummaryDocument(modelBody: string, metadata: CaseMetadata): string {
  const body = extractClientLetterBody(modelBody);
  return `${buildSummaryHeader(metadata)}${body}${buildClientLetterFooter(metadata)}`;
}

export interface DocumentGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  verificationWarnings?: string[];
}

export interface CaseMetadata {
  title: string;
  clientName: string;
  matterReference?: string;
  /** UK long-form meeting date, e.g. "8 April 2026" */
  recordingDate: string;
  /** UK long-form date the note was prepared */
  datePrepared?: string;
  meetingStartTime?: string;
  durationDisplay?: string;
  units?: number;
  feeEarnerDisplayName?: string;
  /** Plain name for first-person voice instruction (no title) */
  feeEarnerName?: string;
  firmName?: string;
  templateId?: string;
  practiceArea?: string;
}

const NOT_DISCUSSED_PHRASE = 'This was not discussed on this occasion.';

export interface FirmPreferences {
  includeLocation?: boolean;
  showFullSolicitorName?: boolean;
  includeClientConfirmation?: boolean;
}

/** Harness / measurement only: optional chat completion override (inert when absent). */
export interface DocumentChatCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: 'json_object';
  frequencyPenalty?: number;
}

export interface DocumentChatCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export type DocumentChatCompletionFn = (
  request: DocumentChatCompletionRequest,
) => Promise<DocumentChatCompletionResult>;

export class DocumentService {
  private readonly chatCompletion?: DocumentChatCompletionFn;

  /** When chatCompletion is omitted, production routes through Bedrock via getPrivilegedLLMProvider(). */
  constructor(options?: { chatCompletion?: DocumentChatCompletionFn }) {
    this.chatCompletion = options?.chatCompletion;
  }

  /**
   * Generate attendance note from transcript
   */
  async generateAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences,
    utterances?: Array<{ text: string; start: number; end: number }>
  ): Promise<DocumentGenerationResult> {
    // Apply firm preferences (default to true if not specified)
    const prefs = {
      includeLocation: firmPreferences?.includeLocation ?? true,
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
      includeClientConfirmation: firmPreferences?.includeClientConfirmation ?? false,
    };

    let systemPrompt = `You are a UK-qualified solicitor specializing in creating professional attendance notes compliant with Solicitors Regulation Authority (SRA) standards and English law practice requirements.

${DERIVATION_ENGINE_RULES}

YOU ARE THE FEE EARNER. You were present at this meeting. Write the entire note in the first person as yourself: "I advised", "I explained", "I asked", "I confirmed", "I reminded". NEVER refer to yourself in the third person. Never write "the solicitor advised", "the fee earner explained", or your own name as the subject of a sentence. Your name is ${metadata.feeEarnerName ?? 'the fee earner'}; it appears in the header, never in the body as a third party. Refer to the client as "the client". Use the client's name only where necessary to disambiguate.

You will be given a record of what was said at the meeting. You were there.

NEVER refer, anywhere in the note, to a transcript, a recording, an audio file, "the session", or to what was or was not "recorded". You were present at the meeting. The conversation is the source. If something was not covered, write "${NOT_DISCUSSED_PHRASE}"

ADDITIONAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Use UK legal terminology and practice conventions throughout
- Format the document professionally with clean spacing (use white space for visual separation, NO horizontal lines or underscores)

REASONING AND THINKING — MANDATORY REQUIREMENT:
The SRA expects attendance notes to record not just what was discussed and what advice was given, but also the reasoning and thinking behind the advice and behind any decisions made. You MUST comply with this requirement in every section:
1. For every piece of advice recorded, you MUST state the reasoning behind it — the factors you weighed, the legal position considered, or the client's circumstances that informed it. Do NOT write "I advised the client to proceed." Write "I advised the client to proceed, having considered [the specific factors the fee earner actually stated at the meeting]." Where the fee earner gave advice without stating any reasoning, do not supply reasoning from context. Emit the REASONING_GAP marker instead. An invented reason is worse than no reason.
2. For every decision recorded (next steps, referrals, further investigation, no action), you MUST record the thinking behind that decision where it is evident from the conversation.
3. Where the conversation does not capture the reasoning, you MUST emit the exact marker on its own line, using the current discussion section topic as the label (e.g. if the section is "MORTGAGE OPTIONS", emit: <!-- REASONING_GAP: MORTGAGE OPTIONS: Reasoning behind advice -->). Each marker label MUST reflect the specific section heading so gaps are independently identifiable.
4. You MUST NEVER invent reasoning that is not evident from the conversation. If reasoning was not discussed or evident, emit the section-specific marker (see rule 3) — do not fabricate it.

SPEAKER-LABELED CONVERSATION RECORDS:
- The conversation record may include speaker labels in the format "[Speaker A]: text" or "[Speaker B]: text"
- Use these labels to distinguish your statements from the client's
- You are the fee earner who was present; the client is the other party
- Attribute advice and instructions correctly between yourself and the client
- If speaker identities are unclear, use context from the content to distinguish your advice from the client's statements

CONSENT RECORDING HANDLING:
- If the conversation includes consent dialogue for audio recording, acknowledge it ONCE in a single brief line at the start of "MATTERS DISCUSSED": "Client consent to audio recording obtained."
- Do NOT elaborate on the consent process, GDPR explanations, data protection details, or consent script language
- Do NOT include consent dialogue as a separate numbered topic or section
- Focus exclusively on substantive legal matters discussed AFTER consent was obtained
- If the meeting consisted primarily of consent dialogue with minimal legal discussion, produce a brief attendance note acknowledging limited substantive legal content was discussed

Your attendance note MUST follow this professional UK legal practice format.

The system supplies the attendance note header (File Reference, Date, Time, Duration, Time Spent (Units), Solicitor), MATTER, CLIENT, and footer (Time Engaged, privilege wording, Prepared by, Date Prepared) from known metadata. Generate ONLY the meeting-content portion below. Do NOT include those header or footer blocks. Start your output with **MATTERS DISCUSSED**.

**MATTERS DISCUSSED**

**1. [FIRST MAJOR TOPIC - USE CLEAR PROFESSIONAL HEADING IN CAPS]**

   What was discussed:
   [Opening paragraph describing the issue or matter discussed - based strictly on what was said. Include facts established, re-expressed in legal register, and state any value that follows from them, e.g. "The client married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years."]

   Advice given:
   [Legal advice provided - use professional terminology. Always write: "I advised the client that..." NOT "We discussed..." or "I told them..."]
   
   Key points advised:
   - [Advice point 1]
   - [Advice point 2]
   - [Advice point 3]

   Reasoning behind advice and decisions:
   [State the reasoning and thinking behind the advice given and any decisions made — as evident from the conversation. For example: "I advised the client to [action], having considered [factor 1], [factor 2], and [factor 3]." If the fee earner did not state the reasoning FOR THIS ADVICE, emit the section-specific marker (a topic being discussed elsewhere in the meeting is not a reason having been given for this advice): <!-- REASONING_GAP: [FIRST MAJOR TOPIC]: Reasoning behind advice --> replacing [FIRST MAJOR TOPIC] with this section's actual heading]

   Client's instructions and response:
   [The client confirmed understanding and instructed... / The client requested... / The client's response to the advice given]

**2. [SECOND MAJOR TOPIC - IN CAPS]**

   What was discussed:
   [Include facts established, re-expressed in legal register, and state any value that follows from them, e.g. "The client married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years."]
   - [Fact 1 from the conversation]
   - [Fact 2 from the conversation]

   Advice given:
   I advised the client that [legal principle or position]. Specifically:
   - [Advice point 1]
   - [Advice point 2]

   Reasoning behind advice and decisions:
   [State the reasoning and thinking behind the advice — as evident from the conversation. If the fee earner did not state the reasoning FOR THIS ADVICE, emit the section-specific marker (a topic being discussed elsewhere in the meeting is not a reason having been given for this advice): <!-- REASONING_GAP: [SECOND MAJOR TOPIC]: Reasoning behind advice --> replacing [SECOND MAJOR TOPIC] with this section's actual heading]

   Client's instructions and response:
   [Client's instructions and response to advice given]

**3. [ADDITIONAL TOPICS AS NEEDED]**

   [Continue for each major discussion point, using the same four-part structure: What was discussed / Advice given / Reasoning behind advice and decisions / Client's instructions and response]

**[FINAL NUMBERED SECTION]. NEXT STEPS**

   [Each action has a description and a Due entry. If a timing was given at the meeting, it belongs in the Due entry, NOT inside the action description. Write the action as the thing to be done, and put the timing, however it was expressed, in Due. Do not write the timing in both places, and never write a timing in the description and then record Due as not discussed.]

   Solicitor to action:
   1. [First action step with clear description]
      Due: [The date or timing stated at the meeting, exactly as given (e.g. "24 March 2026", "tonight", "within 10 working days of submission"), or "${NOT_DISCUSSED_PHRASE}" only if no timing of any kind was given]
   
   2. [Second action step]
      Due: [The date or timing stated at the meeting, exactly as given (e.g. "24 March 2026", "tonight", "within 10 working days of submission"), or "${NOT_DISCUSSED_PHRASE}" only if no timing of any kind was given]
   
   Client to action:
   1. [Action required from client]
      Due: [The date or timing stated at the meeting, exactly as given (e.g. "24 March 2026", "tonight", "within 10 working days of submission"), or "${NOT_DISCUSSED_PHRASE}" only if no timing of any kind was given]
   
   2. [Action required from client]
      Due: [The date or timing stated at the meeting, exactly as given (e.g. "24 March 2026", "tonight", "within 10 working days of submission"), or "${NOT_DISCUSSED_PHRASE}" only if no timing of any kind was given]
   
   Next appointment: [The date or timing stated at the meeting, exactly as given (e.g. "24 March 2026", "tonight", "within 10 working days of submission"), or "${NOT_DISCUSSED_PHRASE}" only if no timing of any kind was given]

FORMATTING GUIDELINES:
- Use **bold** for ALL section headings (ATTENDANCE NOTE, MATTERS DISCUSSED, each numbered topic, NEXT STEPS)
- Use clean white space between sections - NO horizontal lines or underscores
- Use dash (-) for ALL sub-points and bullet lists
- Use numbered lists (1. 2. 3.) for main topics and sequential action steps
- Write in formal but clear UK legal language throughout
- ALWAYS use professional terminology:
  * "I advised the client that..." NOT "We discussed..." or "I told them..."
  * "The client stated..." NOT "They said..."
  * "The client confirmed..." NOT "They agreed..."
  * "I explained the legal position regarding..." NOT "I talked about..."
- Include specific amounts, dates, and deadlines where mentioned in the conversation
- Use 24-hour time format (14:30 not 2:30 PM)
- Use full date format (10 November 2025 not 10/11/2025)
- Numerals, never words, for all quantities: "47 days", "3 years", "2 children" — never "forty-seven days"
- Currency with £ and thousands separators: £1,900 · £4,000 a month · £2,000,000
- UK telephone number spacing: 07445 333 228 · 0800 212 4534
- Percentages as numerals: 50%
- Define a term once, then use the shorthand thereafter (e.g. parental responsibility ("PR"))
- If the client has vulnerabilities or special circumstances, note them where relevant to the legal position

IMPORTANT: This attendance note must be reviewed and verified by the supervising solicitor before being added to the client file. All legal advice and action items should be confirmed against current UK law and SRA guidance.

Adhere strictly to the facts from the meeting. Where information is missing, use the exact phrase "${NOT_DISCUSSED_PHRASE}" rather than inventing details.`;

    if (metadata.templateId === 'matter_inception') {
      systemPrompt += `

MATTER INCEPTION RECORD — AML COMPLIANCE SUMMARY:
This meeting uses the Matter Inception Record template. After the standard attendance note content and NEXT STEPS section, you MUST append an additional section titled "AML COMPLIANCE SUMMARY". This section extracts and structures all AML-relevant information discussed during the meeting.

The AML COMPLIANCE SUMMARY section MUST follow this exact structure:

**AML COMPLIANCE SUMMARY**

**Identity Verification:**
[Summarise what identity documents were discussed, presented, or verified. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Nature and Purpose of Instruction:**
[Summarise the stated reason for the client seeking legal services. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Source of Funds:**
[Summarise what was discussed about where the funds for the transaction are coming from. Include specific amounts if mentioned. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Beneficial Ownership:**
[Summarise who the beneficial owner is, including whether the client is acting on behalf of a third party, company, or trust. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**PEP/Sanctions Status:**
[Note whether the client or any connected party was identified as a Politically Exposed Person or subject to sanctions. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Risk Assessment:**
[Summarise any risk factors noted — client risk level (low/medium/high), geographic risk, transaction complexity, sector risk. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Enhanced Due Diligence (EDD):**
[Note whether EDD was considered necessary and the reasoning. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Solicitor Confirmation:**
[Note whether you confirmed you are satisfied to proceed with the matter on the basis of the information provided. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

CRITICAL: For each field, extract ONLY what was actually said. Where an area was not covered in the meeting, you MUST state "${NOT_DISCUSSED_PHRASE}" — do NOT fabricate or assume compliance information.`;
    }

    if (metadata.templateId === 'legal_aid') {
      systemPrompt += `

LEGAL AID TEMPLATE — MANDATORY ADDITIONAL SECTIONS:
This matter is funded by Legal Aid. After the standard attendance note content and NEXT STEPS section, you MUST append an additional section titled "LEGAL AID RECORD". This section documents Legal Aid-specific compliance information.

The LEGAL AID RECORD section MUST follow this exact structure:

**LEGAL AID RECORD**

**Funding Category:**
[State the Legal Aid funding category discussed — e.g., Legal Help, Legal Representation (Crime Lower), Legal Representation (Crime Higher), Civil Legal Aid, Exceptional Case Funding. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**CLA/DSCC Reference:**
[Note any Civil Legal Advice (CLA) or Defence Solicitor Call Centre (DSCC) reference numbers mentioned. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Representation Order:**
[Note whether a representation order was granted, applied for, or discussed. Include the court and any conditions if mentioned. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Means Test Status:**
[Summarise the client's means test position — passported, within means threshold, or contribution required. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Interests of Justice Test:**
[Note whether the interests of justice test was discussed and any relevant factors mentioned (e.g., risk of custody, complex law, unable to represent self). If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Disbursements Authorised:**
[Note any disbursements or prior authority discussed — expert reports, counsel, interpreters. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

**Billing / File Review Notes:**
[Note any time-recording, billing code, or file review observations relevant to the Legal Aid assessment. If not addressed, state: "${NOT_DISCUSSED_PHRASE}"]

CRITICAL: Extract only what was actually discussed. Where an area was not covered, state: "${NOT_DISCUSSED_PHRASE}".`;
    }

    if (metadata.practiceArea) {
      try {
        const paContext = getPracticeAreaPromptContext(metadata.practiceArea);
        if (paContext) {
          systemPrompt += `\n\n${paContext}`;
        }
      } catch {}
    }

    const userPrompt = `Generate a professional attendance note for the following meeting:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**What was said at the meeting:**
${transcript}`;

    const result = await this.generateDocument(systemPrompt, userPrompt);
    return {
      ...result,
      content: assembleAttendanceNoteDocument(result.content, metadata, prefs),
    };
  }

  /**
   * Generate client letter from completed attendance note
   */
  async generateSummary(
    attendanceNote: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified SRA-regulated solicitor writing a post-meeting confirmation letter to your client, under English and Welsh law.

YOU ARE THE FEE EARNER. Write to the client directly, in the second person ("you", "your"). This letter is the written confirmation of the meeting that you will review, approve, and send. Write as yourself in the first person when describing what you said or did ("I advised you", "I explained").

You will be given the firm's internal attendance note from the meeting. That note is your sole source of facts. Translate its content into plain English for the client. Do NOT refer to the attendance note, any transcript, any recording, or any internal document in the letter.

ANTI-FABRICATION RULES:
1. Every fact in this letter must come from the attendance note. Add nothing.
2. Where the note records that something was not discussed, omit the topic entirely rather than stating it was not discussed.
3. Do NOT add legal advice, case law, statutory references, or procedural guidance that does not appear in the note.
4. Include nothing from any "Reasoning behind advice and decisions" section. The reasoning in the attendance note is the firm's internal record. This letter confirms WHAT was discussed and advised, not your internal analysis of why.
5. Include no REASONING_GAP markers, no supervision banners, no review instructions, and no reference to this letter being generated, reviewed, or verified.

REGISTER:
Write in plain English throughout. Where the attendance note uses a legal term of art, translate it: "the matrimonial home" becomes "the family home" or "your home"; "a pension sharing order" becomes "an arrangement under which a share of a pension is transferred into your name (called a pension sharing order)" on first use and "the pension arrangement" thereafter; "periodical payments" becomes "ongoing monthly payments"; "full and frank disclosure" becomes "both of you must provide complete details of your finances". A legal term may appear once, in brackets, after its plain-English explanation, where the client will encounter that term in proceedings.

The system supplies the letter header (Client, Matter reference, Date) and sign-off block from metadata. Generate ONLY the letter body below. Do NOT include those header lines, any footer, or a sign-off. Do NOT write "Prepared by", "Date prepared", "Time Engaged", or privilege wording.

Structure your letter as follows:

1. Opening paragraph: thank the client for meeting on [date from the note]; confirm this letter sets out what you discussed.

2. **What we discussed**
   The matters covered, in plain language.

3. **What I advised**
   The advice given, in plain language.

4. **What happens next**
   Who is doing what, and by when. State the client's actions and deadlines plainly and prominently.

5. Closing paragraph: how the client can raise questions; mention the next appointment if one was set in the note.

FORMATTING GUIDELINES:
- Use **bold** for the three section headings exactly as shown: **What we discussed**, **What I advised**, **What happens next**
- Use full date format (10 November 2025 not 10/11/2025)
- Numerals, never words, for quantities: "3 years", "2 children"
- Currency with £ and thousands separators: £1,900 · £4,000 a month
- Do not use em dashes or en dashes. For ranges, use "to" (e.g. "September 2025 to January 2026")
- Keep the letter concise (1-2 pages maximum)`;

    const userPrompt = `Write a client confirmation letter based on the following attendance note. Use only facts from this note. Do not include any content from "Reasoning behind advice and decisions" sections.

**Attendance note:**
${attendanceNote}`;

    const result = await this.generateDocument(systemPrompt, userPrompt);
    return {
      ...result,
      content: assembleSummaryDocument(result.content, metadata),
    };
  }

  async verifyDocumentAgainstTranscript(
    document: string,
    transcript: string,
    metadata?: Pick<CaseMetadata, 'clientName' | 'feeEarnerName'>,
  ): Promise<{ warnings: string[]; inputTokens: number; outputTokens: number; cost: number }> {
    try {
      console.log('Running post-generation verification against transcript...');

      const authoritativeNames = resolveVerificationAuthoritativeNames(document, metadata);
      const authoritativeNamesBlock =
        authoritativeNames.clientName || authoritativeNames.feeEarnerName
          ? `\nSYSTEM-SUPPLIED AUTHORITATIVE NAMES (use these; do not treat transcript spelling as authoritative):\n${
              authoritativeNames.clientName ? `Client: ${authoritativeNames.clientName}\n` : ''
            }${authoritativeNames.feeEarnerName ? `Fee earner: ${authoritativeNames.feeEarnerName}\n` : ''}`
          : '';

      const systemPrompt = `You are a legal document auditor for a UK law firm. You will be given the record of what was said at a client meeting, and a document generated from it. Identify genuine defects. You must distinguish defects from correct professional practice.
THE GOVERNING TEST: content is ESTABLISHED if it was said at the meeting, or if it follows from what was said by arithmetic, by date computation, or by applying the correct legal term of art to it. A statement is defective ONLY if it introduces content that was neither said nor follows from what was said. A statement is NOT defective because its exact words were not spoken, and NOT defective because a value it states was computed rather than uttered. A professional legal document re-expresses what was said, in legal register, in standard notation, and with the values that follow from the facts. That is the job. It is not fabrication.
CATEGORY 1 (UNSUPPORTED CONTENT). Flag a statement when it:

asserts a concrete fact (an amount, a transfer, an agreement, a party, a date, an event, an instruction) with no basis in what was said. Fabricated concrete specifics are the most serious defect; never let one pass;
reaches a conclusion the established facts do not support;
records advice that was not given;
makes a finding that a breach, offence or liability occurred, rather than recording an allegation or concern;
contradicts what was said (a wrong name, a wrong figure, a wrong date);
claims something was not discussed when it was: flag the phrase "This was not discussed on this occasion." ONLY if you can quote the specific timing, date or detail from the meeting record that contradicts it. If you cannot quote such content, the placeholder is correct practice and must not be flagged.

DO NOT FLAG: these are correct practice:

Notation: numerals for spoken numbers, currency with separators, formatted dates, times and telephone numbers. "£450,000" is a faithful record of "four hundred and fifty thousand pounds".
Derived computation: arithmetic or temporal derivation from established facts ("married August 2021, separated 2024, therefore the marriage subsisted for some 3 years").
Legal characterisation: the correct term of art applied to established facts ("the matrimonial home"; "broken down irretrievably"; an allegation characterised as "concerns raised as to the potential misapplication of funds"), provided the underlying facts were established and no new factual content is introduced.
Professional paraphrase that preserves meaning.
The exact placeholder "This was not discussed on this occasion." where the item genuinely was not covered, including in Due dates and Next appointment.
HTML comment markers of the form <!-- REASONING_GAP: ... -->.
Headings, structure, and standard framing such as "subject to legal professional privilege".
Defined-term shorthand after first definition (e.g. "PR").
Header and footer metadata: file reference, date, time, duration, time spent in units, location, solicitor name, matter, client name, date prepared, and the legal professional privilege wording. These are supplied by the system and are not derived from the meeting record. They are not within the scope of this check and must never be flagged.
The client's name and the fee earner's name are supplied to you by the system and are authoritative. The record of the meeting may contain transcription errors in the spelling of names. Where the note uses the system-supplied name and the meeting record spells it differently, the note is correct and must not be flagged. Never flag a name as contradicted on the basis of the meeting record's spelling alone.

Before flagging any statement, first check whether it is a notation, derivation or characterisation of something that was said; if it is, it must not be flagged.

CATEGORY 2 (ADVICE WITHOUT REASONING). The SRA expects the note to record the reasoning behind advice. Flag advice only when, within its own section, there is neither stated reasoning nor a <!-- REASONING_GAP: ... --> marker. A marker within the section satisfies the requirement for that section; do not flag advice whose section contains one, and never flag the marker itself.
Return JSON only, in exactly this structure: {"unverifiable_statements": [...], "advice_without_reasoning": [...]}. Each array contains ONLY confirmed defects. Do NOT include statements you have considered and decided are not defects, do NOT include your reasoning about statements you are not flagging, and do NOT include entries whose text says a statement is correct, is not a defect, or is being withdrawn. If a statement is correct practice, it does not appear in the output at all. Empty arrays where there are no defects. Each entry must be a single string: the offending statement itself, optionally followed by a brief explanation. Do not return objects.

List each distinct defect once. Never repeat a statement. Never restate the same defect in multiple entries.${authoritativeNamesBlock}`;

      const userPrompt = `MEETING RECORD:\n${transcript}\n\n---\n\nGENERATED DOCUMENT:\n${document}\n\nIdentify unsupported content and any advice recorded without reasoning. Return JSON only.`;

      const completion = await this.callChatCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 4096,
        temperature: 0,
        responseFormat: 'json_object',
        frequencyPenalty: 0.3,
      });

      const content = completion.content;
      const inputTokens = completion.inputTokens;
      const outputTokens = completion.outputTokens;
      const cost = completion.cost;

      if (process.env.VERIFY_RAW_LOG === '1') {
        console.log('[verify-raw]', JSON.stringify({ outputTokens, len: content.length, content }));
      }

      let warnings: string[] = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (process.env.VERIFY_RAW_LOG === '1') {
            const knownKeys = new Set(['unverifiable_statements', 'advice_without_reasoning']);
            const extraKeys = Object.keys(parsed).filter((k) => !knownKeys.has(k));
            if (extraKeys.length > 0) {
              console.log('[verify-extra-keys]', JSON.stringify({ keys: extraKeys }));
            }
          }
          const unverifiable = normalizeVerificationStatements(parsed.unverifiable_statements);
          const missingReasoning = normalizeVerificationStatements(parsed.advice_without_reasoning).map(
            (s) => `[Advice without reasoning] ${s}`,
          );
          warnings = [...unverifiable, ...missingReasoning];
        } else {
          console.error('Verification response contained no JSON object. Raw response:', content);
          warnings = [VERIFICATION_PARSE_FALLBACK];
        }
      } catch (parseError) {
        console.error('Failed to parse verification response:', parseError);
        console.error('Raw verification response:', content);
        warnings = [VERIFICATION_PARSE_FALLBACK];
      }

      console.log(`Verification complete. Found ${warnings.length} unverifiable statement(s). Cost: $${cost.toFixed(4)}`);

      return { warnings, inputTokens, outputTokens, cost };
    } catch (error: any) {
      console.error('Verification pass failed:', error);
      return { warnings: ['Automated verification failed — solicitor review is required before this document is added to the client file'], inputTokens: 0, outputTokens: 0, cost: 0 };
    }
  }

  private async callChatCompletion(
    request: DocumentChatCompletionRequest,
  ): Promise<DocumentChatCompletionResult> {
    if (this.chatCompletion) {
      return this.chatCompletion(request);
    }

    const result = await getPrivilegedLLMProvider().generate({
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.responseFormat,
    });

    return {
      content: result.text,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost: result.cost,
    };
  }

  private getGenerationModelLabel(): string {
    if (this.chatCompletion) {
      return process.env.BEDROCK_PRIVILEGED_MODEL_ID ?? 'measurement-seam';
    }
    return process.env.BEDROCK_PRIVILEGED_MODEL_ID ?? 'bedrock';
  }

  private async generateDocument(
    systemPrompt: string,
    userPrompt: string
  ): Promise<DocumentGenerationResult> {
    try {
      const modelLabel = this.getGenerationModelLabel();
      console.log(`Generating document with ${modelLabel}...`);

      const completion = await this.callChatCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 4000,
        temperature: 0,
      });

      const rawContent = completion.content;
      const inputTokens = completion.inputTokens;
      const outputTokens = completion.outputTokens;
      const cost = completion.cost;

      const content = sanitizeModelProseDashes(ensureBoldHeadings(rawContent));

      console.log(`Document generated with ${modelLabel}. Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${cost.toFixed(4)}`);

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
      };
    } catch (error: any) {
      console.error('Document production failed:', error);
      throw new Error(`Document production failed: ${error.message}`);
    }
  }

  async generateTelephoneAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a telephone attendance note compliant with SRA standards.

${DERIVATION_ENGINE_RULES}

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate any details not present in the transcript
- If information is missing, state "Not specified" rather than guessing
- Keep the note concise and factual — telephone calls produce shorter notes than full meetings
- Use UK legal terminology throughout

REASONING AND THINKING — MANDATORY REQUIREMENT:
The SRA expects attendance notes to record not just the advice given but the reasoning and thinking behind it. For any advice or decisions recorded in this telephone note:
1. State the reasoning behind the advice as evident from the transcript — the factors weighed or circumstances that informed it. For example: "I advised the client to [action], having considered [the specific factors from the transcript]."
2. Where the call did not capture the reasoning (common in brief telephone exchanges), emit the exact marker on its own line: <!-- REASONING_GAP: Call Summary: Reasoning behind advice -->
3. Do NOT fabricate reasoning. If it is not evident from the transcript, emit the marker above.

Format:

**TELEPHONE ATTENDANCE NOTE**

File Reference:  ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Time:           {Call time from transcript, or "Not recorded"}
Duration:       {Call duration, or "Not recorded"}
Solicitor:      ${solicitorFormat}

**MATTER:**     ${metadata.title}
**CLIENT:**     ${metadata.clientName}

**CALL SUMMARY**

[Brief factual account of what was discussed, advice given, and instructions received. Use "I advised the client that..." phrasing. For each piece of advice, include the reasoning behind it as evident from the transcript, or emit the marker: <!-- REASONING_GAP: Call Summary: Reasoning behind advice --> Keep to 2-4 paragraphs maximum.]

**ACTION POINTS**

Solicitor:
1. [Action if any]

Client:
1. [Action if any]

This telephone attendance note is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for headings. Keep the entire note to approximately half a page. Be factual and concise.`;

    const userPrompt = `Generate a telephone attendance note for this call transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateFileNote(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified solicitor creating a brief file note.

${DERIVATION_ENGINE_RULES}

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript or notes provided
- Do NOT invent details
- A file note is a single-paragraph internal record — keep it brief and factual
- Use UK legal terminology

REASONING AND THINKING — MANDATORY REQUIREMENT:
Where any advice or decision is recorded, you MUST include the reasoning behind it as evident from the transcript. If the reasoning was not captured, emit the exact marker on its own line: <!-- REASONING_GAP: File Note: Reasoning behind advice --> Do NOT fabricate reasoning.

Format:

**FILE NOTE**

File Reference: ${metadata.matterReference || 'TBD'}
Date: ${metadata.recordingDate}
Matter: ${metadata.title}
Client: ${metadata.clientName}

[Single paragraph summarising the key point being recorded. This should be 3-6 sentences maximum, capturing the essential facts, any decision made, the reasoning behind that decision as evident from the transcript (or the marker <!-- REASONING_GAP: File Note: Reasoning behind advice --> if not captured), and any follow-up required.]

This file note is subject to legal professional privilege.`;

    const userPrompt = `Generate a file note from the following:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}

**Content:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateCourtAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a court attendance note compliant with SRA standards.

${DERIVATION_ENGINE_RULES}

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate details
- If information is missing, state "Not specified in hearing" rather than guessing
- Use UK legal terminology and court conventions throughout

REASONING AND THINKING — MANDATORY REQUIREMENT:
The SRA requires attendance notes to capture not only what submissions were made and what orders were obtained, but the reasoning and strategic thinking behind them. For any advice given to the client or any decision made (e.g. regarding submissions, appeal, or next steps):
1. Record the reasoning as evident from the transcript — e.g. "I advised the client to accept the order, having considered the judge's indications regarding costs and the likely outcome at trial."
2. Where reasoning was not captured in the hearing transcript, emit the exact marker on its own line using the relevant hearing section as the label: <!-- REASONING_GAP: [HEARING SECTION]: Reasoning behind advice --> (e.g. <!-- REASONING_GAP: Submissions on Costs: Reasoning behind advice -->).
3. Do NOT fabricate reasoning not evident from the transcript.

Format:

**COURT ATTENDANCE NOTE**

File Reference:  ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Court:          {Court name from transcript, or "Not recorded"}
Before:         {Judge name and title from transcript, or "Not recorded"}
Case Number:    {Case number from transcript, or "Not recorded"}

**MATTER:**     ${metadata.title}
**CLIENT:**     ${metadata.clientName}

**PARTIES PRESENT**

- [List parties and their representatives as identified in transcript]

**HEARING SUMMARY**

**1. [NATURE OF HEARING]**

[Description of the type of hearing and its purpose]

**2. [SUBMISSIONS AND ARGUMENTS]**

[Key submissions made by each party]

**3. [ORDERS MADE]**

[List all orders made by the court]

**4. [DIRECTIONS]**

[List any directions given with dates]

**NEXT STEPS**

Solicitor to action:
1. [Action with deadline]

Client to action:
1. [Action with deadline]

Next hearing: [Date if scheduled, or "To be listed"]

This court attendance note is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for all section headings. Be thorough but concise.`;

    const userPrompt = `Generate a court attendance note from this hearing transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generatePoliceStationAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a police station attendance record compliant with PACE (Police and Criminal Evidence Act 1984) requirements and SRA standards.

${DERIVATION_ENGINE_RULES}

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate details
- This record must be PACE-compliant — accuracy is paramount
- Use UK criminal law terminology throughout

REASONING AND THINKING — MANDATORY REQUIREMENT:
The SRA and the PI insurer need to see the reasoning behind advice given at the police station, not just the conclusion. For the "ADVICE GIVEN" section and any decisions recorded:
1. Record the reasoning behind each piece of advice as evident from the transcript — e.g. "I advised the client to exercise the right to silence, having considered the adequacy of disclosure, the nature of the alleged offence, and the client's instructions."
2. Where the reasoning was not captured on the recording, emit the exact marker on its own line using the advice section as the label: <!-- REASONING_GAP: Advice Given: Reasoning behind advice -->
3. Do NOT fabricate reasoning not evident from the transcript.

Format:

**POLICE STATION ATTENDANCE RECORD**

File Reference:     ${metadata.matterReference || 'TBD'}
Date:               ${metadata.recordingDate}
Station:            {Police station name from transcript, or "Not recorded"}
Custody Number:     {Custody reference from transcript, or "Not recorded"}
Arrival Time:       {Time of arrival from transcript, or "Not recorded"}
Departure Time:     {Time of departure from transcript, or "Not recorded"}

**CLIENT:**         ${metadata.clientName}
**OFFENCE(S):**     {Offence(s) as stated from transcript, or "Not specified"}

**1. INITIAL CONSULTATION**

[Summary of private consultation with client before interview, including advice given on right to silence, disclosure reviewed, and client's instructions]

**2. DISCLOSURE**

[Summary of disclosure provided by police, any issues with adequacy of disclosure]

**3. INTERVIEW SUMMARY**

[Chronological summary of the interview, questions asked, answers given or "no comment" responses, any significant statements]

**4. ADVICE GIVEN**

[Record of legal advice provided at each stage, including pre-interview, during breaks, and post-interview]

**5. REPRESENTATIONS**

[Any representations made to custody sergeant regarding detention, bail, or conditions]

**6. OUTCOME**

[Outcome of attendance — charged, released under investigation, NFA, bail conditions]

**7. FOLLOW-UP ACTIONS**

Solicitor:
1. [Action required]

Client:
1. [Action required]

This police station attendance record is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for all section headings. Be thorough and PACE-compliant.`;

    const userPrompt = `Generate a police station attendance record from this transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateDocumentByRecordingType(
    recordingType: string,
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences,
    utterances?: Array<{ text: string; start: number; end: number }>
  ): Promise<DocumentGenerationResult> {
    let result: DocumentGenerationResult;
    switch (recordingType) {
      case 'telephone_call':
        result = await this.generateTelephoneAttendanceNote(transcript, metadata, firmPreferences);
        break;
      case 'file_note':
        result = await this.generateFileNote(transcript, metadata);
        break;
      case 'court_hearing':
        result = await this.generateCourtAttendanceNote(transcript, metadata, firmPreferences);
        break;
      case 'police_station':
        result = await this.generatePoliceStationAttendanceNote(transcript, metadata, firmPreferences);
        break;
      case 'full_meeting':
        result = await this.generateAttendanceNote(transcript, metadata, firmPreferences, utterances);
        break;
      default:
        throw new Error(
          `Unsupported recording type: ${recordingType}. Permitted types: ${CLIENT_FACING_RECORDING_TYPES.join(', ')}`,
        );
    }
    return result;
  }

  /**
   * Extract action items from transcript
   */
  async extractActionItems(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<{ items: ExtractedActionItem[], cost: number, inputTokens: number, outputTokens: number }> {
    const systemPrompt = `You are a legal assistant specializing in extracting action items and follow-ups from legal meeting transcripts.

TASK: Extract all action items, tasks, follow-ups, and deadlines mentioned in the transcript.

For each action item, identify:
1. A clear description of what needs to be done
2. Who should do it (Solicitor, Client, or specific name if mentioned)
3. Any deadline or timeframe mentioned (convert to ISO date format YYYY-MM-DD if possible)
4. Priority level based on urgency words used (high, medium, low)

IMPORTANT RULES:
- Only extract genuine action items that were explicitly discussed or agreed upon
- Do not invent or assume action items not mentioned in the transcript
- Capture follow-up calls, document requests, deadline commitments, research tasks
- Be conservative - when in doubt, mark as "medium" priority

OUTPUT FORMAT: Return a JSON object with an "items" array:
{
  "items": [
    {
      "description": "Brief description of the action item",
      "assignee": "Solicitor" | "Client" | "specific name",
      "dueDate": "YYYY-MM-DD" | null,
      "priority": "high" | "medium" | "low"
    }
  ]
}

If no clear action items are found, return: {"items": []}`;

    const userPrompt = `Extract action items from this legal meeting transcript:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Return the action items as a JSON object with an "items" array:`;

    try {
      console.log('Extracting action items...');

      const completion = await privilegedComplete({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: 'json_object',
      });

      const content = completion.content || '[]';
      const inputTokens = completion.inputTokens;
      const outputTokens = completion.outputTokens;
      const cost = completion.cost;

      let items: ExtractedActionItem[] = [];
      try {
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.action_items || []);
      } catch (parseError) {
        console.error('Failed to parse action items JSON:', parseError);
        items = [];
      }

      console.log(`Extracted ${items.length} action items. Cost: $${cost.toFixed(4)}`);

      return { items, cost, inputTokens, outputTokens };
    } catch (error: any) {
      console.error('Action item extraction failed:', error);
      throw new Error(`Action item extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate pre-meeting briefing from all documents and transcripts for a case
   */
  async generatePreMeetingBriefing(
    meetings: Array<{
      date: string;
      transcript: string;
      attendanceNote?: string;
      summary?: string;
    }>,
    metadata: CaseMetadata,
    outstandingUndertakings?: Array<{ wording: string; deadline: Date | null; dateGiven: Date; status: string }>
  ): Promise<DocumentGenerationResult> {
    let undertakingsSection = '';
    if (outstandingUndertakings && outstandingUndertakings.length > 0) {
      undertakingsSection = `\n7. **Outstanding Undertakings** - CRITICAL: List all outstanding undertakings given by this firm on this matter. These are binding professional commitments that MUST be addressed. Include deadlines where applicable. Mark any overdue undertakings clearly.\n`;
    }

    const systemPrompt = `You are a UK legal assistant preparing a concise pre-meeting briefing for a solicitor before their next client meeting.

TASK: Generate a 1-page professional briefing document summarizing all prior meetings on this matter.

The briefing should include:
1. **Matter Summary** - Brief overview of the case and client situation
2. **Key Discussion Points** - Main topics from previous meetings
3. **Outstanding Action Items** - Tasks that were assigned but may still be pending
4. **Important Dates & Deadlines** - Any critical dates mentioned
5. **Client Concerns** - Any worries or priorities the client has expressed
6. **Suggested Agenda Items** - Topics to discuss in the next meeting${undertakingsSection}

CRITICAL RULES:
- Be concise and scannable - solicitors need to review this quickly before meetings
- Only include information from the provided meeting records - do not fabricate details
- Use professional UK legal terminology
- Format for easy reading with clear headings and bullet points
- Keep the entire briefing to approximately one printed page
- If information is not available in the records, use the exact phrase "Not recorded in this session" rather than guessing
- If outstanding undertakings are provided, they MUST be prominently featured as they represent binding professional obligations`;

    const meetingsSummary = meetings.map((m, idx) => `
--- MEETING ${idx + 1} (${m.date}) ---
${m.summary ? `SUMMARY:\n${m.summary}\n` : ''}
${m.attendanceNote ? `ATTENDANCE NOTE:\n${m.attendanceNote}\n` : ''}
${m.transcript ? `TRANSCRIPT EXCERPT:\n${m.transcript.slice(0, 5000)}\n` : ''}
`).join('\n');

    let undertakingsData = '';
    if (outstandingUndertakings && outstandingUndertakings.length > 0) {
      undertakingsData = `\n\nOUTSTANDING UNDERTAKINGS (BINDING COMMITMENTS):\n${outstandingUndertakings.map((u, i) => {
        const deadlineStr = u.deadline ? new Date(u.deadline).toISOString().split('T')[0] : 'No deadline specified';
        const givenStr = new Date(u.dateGiven).toISOString().split('T')[0];
        const isOverdue = u.deadline && new Date(u.deadline) < new Date();
        return `${i + 1}. ${u.wording}\n   Given: ${givenStr} | Deadline: ${deadlineStr}${isOverdue ? ' [OVERDUE]' : ''}`;
      }).join('\n')}\n`;
    }

    const userPrompt = `Generate a pre-meeting briefing for:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}
Number of Prior Meetings: ${meetings.length}

MEETING RECORDS:
${meetingsSummary}${undertakingsData}

Generate the briefing document:`;

    return this.generateDocument(systemPrompt, userPrompt);
  }
  async generateClientCareLetter(params: {
    firmName: string;
    firmAddress?: string;
    firmPhone?: string;
    firmEmail?: string;
    sraNumber?: string;
    feeEarnerName: string;
    clientName: string;
    matterDescription: string;
    practiceArea: string;
    costsEstimate?: string;
    matterReference?: string;
  }): Promise<DocumentGenerationResult> {
    const { getClientCareLetterPrompt } = require('./practiceAreaConfig');
    const systemPrompt = getClientCareLetterPrompt(params);

    const userPrompt = `Generate the client care letter now based on the details provided. Output the complete letter in professional format ready for solicitor review.`;

    return this.generateDocument(systemPrompt, userPrompt);
  }

  async extractUndertakings(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<{ items: ExtractedUndertaking[], cost: number, inputTokens: number, outputTokens: number }> {
    const systemPrompt = `You are a UK legal compliance assistant specializing in identifying undertakings in legal meeting transcripts.

TASK: Identify all undertakings — binding commitments given by a solicitor on behalf of their firm — in the transcript.

Undertaking language includes phrases such as:
- "we undertake to..."
- "I give an undertaking that..."
- "we will provide by..."
- "I confirm we will..."
- "I undertake to..."
- "this firm undertakes..."
- "we give our undertaking..."
- "I/we confirm that we will..."
- Any promise or commitment by the solicitor to do something specific, especially with a deadline

For each undertaking found, extract:
1. The precise wording of the undertaking commitment
2. Who gave the undertaking (speaker name or role)
3. The exact quoted text from the transcript containing the undertaking language
4. Any deadline mentioned (convert to ISO date format YYYY-MM-DD if possible)

IMPORTANT RULES:
- Only extract genuine undertakings — binding professional commitments by the solicitor or firm
- Do NOT include general action items, to-do lists, or informal promises
- Focus on language that creates a binding professional obligation
- Be conservative — when in doubt, do NOT include it
- The source quote must be the exact text from the transcript

OUTPUT FORMAT: Return a JSON object with an "items" array:
{
  "items": [
    {
      "wording": "Clear description of the undertaking commitment",
      "speaker": "Solicitor" | "specific name",
      "sourceQuote": "Exact quoted text from transcript",
      "deadline": "YYYY-MM-DD" | null
    }
  ]
}

If no undertakings are found, return: {"items": []}`;

    const userPrompt = `Identify all undertakings in this legal meeting transcript:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Return the undertakings as a JSON object with an "items" array:`;

    try {
      console.log('Extracting undertakings...');

      const completion = await privilegedComplete({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 2000,
        responseFormat: 'json_object',
      });

      const content = completion.content || '{"items":[]}';
      const inputTokens = completion.inputTokens;
      const outputTokens = completion.outputTokens;
      const cost = completion.cost;

      let items: ExtractedUndertaking[] = [];
      try {
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.undertakings || []);
      } catch (parseError) {
        console.error('Failed to parse undertakings JSON:', parseError);
        items = [];
      }

      console.log(`Extracted ${items.length} undertaking(s). Cost: $${cost.toFixed(4)}`);

      return { items, cost, inputTokens, outputTokens };
    } catch (error: any) {
      console.error('Undertaking extraction failed:', error);
      throw new Error(`Undertaking extraction failed: ${error.message}`);
    }
  }
}

export interface ExtractedActionItem {
  description: string;
  assignee: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
}

export interface ExtractedUndertaking {
  wording: string;
  speaker: string | null;
  sourceQuote: string;
  deadline: string | null;
}
