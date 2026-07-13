/**
 * Note-safety harness — exercises REAL production prompts via DocumentService.
 * Dual-arm: Arm A GPT-4o (hard gate); Arm B Sonnet 4.6 via measurement seam (tracked).
 *
 * Usage:
 *   npx tsx scripts/note-safety-harness.ts
 *
 * Env: OPENAI_API_KEY, AWS_REGION=eu-west-2, BEDROCK_PRIVILEGED_MODEL_ID=eu.anthropic.claude-sonnet-4-6
 *       HARNESS_ARM=A|B|both (default: both)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SYNTHETIC_TRANSCRIPTS, type SyntheticTranscriptSpec } from './note-safety-transcripts';
import {
  PLANT_CASES,
  NON_FACTUAL_PLANT_CASES,
  PLACEHOLDER_MISUSE_CASE,
  WRONG_CLIENT_NAME_CASE,
  REGRESSION_CASES,
  RETIRED_SPURIOUS_PATTERNS,
  type RegressionCase,
} from './verifier-regression-cases';
import {
  evaluateDerivationAssertions,
  formatDerivationReportLines,
  extractSectionHeadings,
  type DerivationReport,
} from './derivation-assertions';
import { createBedrockChatCompletion } from './harness-bedrock-completion';
import type { DocumentChatCompletionFn } from '../server/services/documentService';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const NOT_DISCUSSED = 'This was not discussed on this occasion.';
const RESULTS_DATE = '2026-07-12';

/** Load repo .env for local harness runs (does not override existing env vars). */
function loadLocalEnv(): void {
  const envPath = join(SCRIPT_DIR, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadLocalEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error('[note-safety-harness] OPENAI_API_KEY is required. Set it in .env or the environment.');
  process.exit(1);
}

type WarningClass =
  | 'genuine-catch'
  | 'spurious'
  | 'characterisation'
  | 'verifier-fp-genuine-placeholder';

interface HarnessMetadataExtras {
  feeEarnerDisplayName: string;
  feeEarnerName: string;
  meetingStartTime: string;
  durationMinutes: number;
}

const HARNESS_EXTRAS: Record<string, HarnessMetadataExtras> = {
  'family-financial-remedy': {
    feeEarnerDisplayName: 'Sarah Mitchell, Associate Solicitor',
    feeEarnerName: 'Sarah Mitchell',
    meetingStartTime: '10:30',
    durationMinutes: 95,
  },
  'family-derivation-lay-speech': {
    feeEarnerDisplayName: 'Michael Reyes, Partner Solicitor',
    feeEarnerName: 'Michael Reyes',
    meetingStartTime: '10:00',
    durationMinutes: 75,
  },
  'immigration-case-history': {
    feeEarnerDisplayName: 'David Okonkwo, Immigration Solicitor',
    feeEarnerName: 'David Okonkwo',
    meetingStartTime: '09:15',
    durationMinutes: 85,
  },
  'corporate-fiduciary-duty': {
    feeEarnerDisplayName: 'James Thornton, Corporate Partner',
    feeEarnerName: 'James Thornton',
    meetingStartTime: '15:00',
    durationMinutes: 80,
  },
};

function formatUkLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isoToUkLong(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatUkLongDate(new Date(year, month - 1, day));
}

function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'} ${mins} minutes`;
}

function buildHarnessMetadata(spec: SyntheticTranscriptSpec) {
  const extras = HARNESS_EXTRAS[spec.id];
  const durationDisplay = formatDurationMinutes(extras.durationMinutes);
  return {
    title: spec.metadata.title,
    clientName: spec.metadata.clientName,
    matterReference: spec.metadata.matterReference,
    recordingDate: isoToUkLong(spec.metadata.recordingDate),
    datePrepared: formatUkLongDate(new Date()),
    meetingStartTime: extras.meetingStartTime,
    durationDisplay,
    units: Math.ceil(extras.durationMinutes / 6),
    feeEarnerDisplayName: extras.feeEarnerDisplayName,
    feeEarnerName: extras.feeEarnerName,
    firmName: 'Test Firm LLP',
    practiceArea: spec.practiceArea,
  };
}

function normalizeWarning(w: unknown): string {
  if (typeof w === 'string') return w;
  if (w && typeof w === 'object') {
    const o = w as Record<string, unknown>;
    if (typeof o.statement === 'string') return o.statement;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.description === 'string') return o.description;
    return JSON.stringify(w);
  }
  return String(w);
}

function normalizeWarnings(warnings: unknown[]): string[] {
  return warnings.map(normalizeWarning);
}

function caseDetected(warnings: unknown[], regCase: RegressionCase): boolean {
  const lower = normalizeWarnings(warnings).map((w) => w.toLowerCase());
  return regCase.detectBy.some((sub) => lower.some((w) => w.includes(sub.toLowerCase())));
}

function matchingWarnings(warnings: unknown[], regCase: RegressionCase): string[] {
  return normalizeWarnings(warnings).filter((w) =>
    regCase.detectBy.some((sub) => w.toLowerCase().includes(sub.toLowerCase())),
  );
}

function containsEmOrEnDash(text: string): boolean {
  return /[\u2013\u2014]/.test(text);
}

/** Model prose only: exclude header/MATTER metadata echo (user-supplied titles may contain dashes). */
function modelProseForDashGate(document: string): string {
  const attendanceIdx = document.indexOf('**MATTERS DISCUSSED**');
  if (attendanceIdx >= 0) return document.slice(attendanceIdx);
  const letterIdx = document.indexOf('**What we discussed**');
  if (letterIdx >= 0) return document.slice(letterIdx);
  const summaryIdx = document.indexOf('**Key Points:**');
  if (summaryIdx >= 0) return document.slice(summaryIdx);
  return document;
}

function resultsPathForArm(arm: 'A' | 'B'): string {
  return join(SCRIPT_DIR, `note-safety-results-${RESULTS_DATE}-batch2-arm${arm}.md`);
}

const RELATIVE_TIMING_RE =
  /\b(tonight|this evening|within ten working days|ten working days|by the end of the month|within \d+ working days)\b/i;
const ABSOLUTE_DATE_RE =
  /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i;

function extractNoteLineForWarning(warning: string, note: string): string {
  const lines = note.split('\n');
  const trimmedWarning = warning.trim();
  for (const line of lines) {
    const t = line.trim();
    if (t && (trimmedWarning.includes(t) || t.includes(trimmedWarning))) return t;
  }
  if (/due:\s*this was not discussed|next appointment:\s*this was not discussed/i.test(warning)) {
    for (let i = 0; i < lines.length; i++) {
      if (/due:\s*this was not discussed|next appointment:\s*this was not discussed/i.test(lines[i])) {
        for (let j = i - 1; j >= 0; j--) {
          const prev = lines[j].trim();
          if (prev && !/^due:/i.test(prev)) return prev;
        }
      }
    }
  }
  return warning;
}

function transcriptHasTimingForItem(itemText: string, transcript: string): boolean {
  const item = itemText.toLowerCase();
  const topics: Array<{ match: RegExp; timing: RegExp[] }> = [
    {
      match: /home office|acknowledgment|extension request/i,
      timing: [/within ten working days/i, /ten working days/i, /chase home office acknowledgment/i],
    },
    {
      match: /passport/i,
      timing: [/email the passport scans tonight/i, /\btonight\b/i],
    },
    {
      match: /forensic accountant/i,
      timing: [],
    },
    {
      match: /next appointment|next review|telephone appointment/i,
      timing: [/next review call/i, /telephone appointment on/i, /at 11:00/i, /at 14:00/i],
    },
  ];

  for (const topic of topics) {
    if (topic.match.test(item)) {
      if (topic.timing.length === 0) return false;
      return topic.timing.some((re) => re.test(transcript));
    }
  }

  const transcriptLines = transcript.split('\n');
  const itemWords = item.split(/\W+/).filter((w) => w.length > 4);
  for (const line of transcriptLines) {
    const ll = line.toLowerCase();
    if (itemWords.some((w) => ll.includes(w))) {
      if (RELATIVE_TIMING_RE.test(line) || ABSOLUTE_DATE_RE.test(line)) return true;
    }
  }
  return false;
}

interface InjectionOutcome {
  ok: boolean;
  document: string;
  skipReason?: string;
  method?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectWrongClientName(
  document: string,
  correctName: string,
  wrongName: string,
): InjectionOutcome {
  if (!document.trim()) {
    return { ok: false, document, skipReason: 'Empty document' };
  }

  const proseStart = document.indexOf('**MATTERS DISCUSSED**');
  if (proseStart < 0) {
    return { ok: false, document, skipReason: 'No **MATTERS DISCUSSED** section found' };
  }

  let head = document.slice(0, proseStart);
  let body = document.slice(proseStart);

  const phraseNeedle = `The client, ${correctName},`;
  const phraseReplacement = `The client, ${wrongName},`;
  if (body.includes(phraseNeedle)) {
    body = body.replace(phraseNeedle, phraseReplacement);
    return { ok: true, document: head + body, method: 'body-phrase' };
  }

  const nameIdx = body.indexOf(correctName);
  if (nameIdx >= 0) {
    body = body.slice(0, nameIdx) + wrongName + body.slice(nameIdx + correctName.length);
    return { ok: true, document: head + body, method: 'body-name' };
  }

  const namedClientRe = new RegExp(`(\\*\\*CLIENT:\\*\\*\\s+)${escapeRegExp(correctName)}`, 'i');
  if (namedClientRe.test(head)) {
    head = head.replace(namedClientRe, `$1${wrongName}`);
  } else if (/\*\*CLIENT:\*\*/i.test(head)) {
    head = head.replace(/(\*\*CLIENT:\*\*\s+).+/i, `$1${wrongName}`);
  }

  const assertion = `\n   The client, ${wrongName}, confirmed his instructions.\n`;
  const firstNl = body.indexOf('\n');
  body = firstNl >= 0 ? body.slice(0, firstNl + 1) + assertion + body.slice(firstNl + 1) : body + assertion;

  return { ok: true, document: head + body, method: 'header-and-body-assertion' };
}

function injectPlaceholderMisuse(document: string, dateCandidates: string[]): InjectionOutcome {
  if (!document.trim()) {
    return { ok: false, document, skipReason: 'Empty document' };
  }

  const normalizeDate = (d: string) => d.replace(/\.$/, '').trim();

  const lineMatchesDue = (line: string): boolean => {
    if (!/due:/i.test(line)) return false;
    return dateCandidates.some((d) => {
      const n = normalizeDate(d);
      return line.includes(d) || line.includes(n);
    });
  };

  const lines = document.split('\n');
  const out: string[] = [];
  let replaced = false;
  for (const line of lines) {
    if (!replaced && lineMatchesDue(line)) {
      out.push(line.replace(/Due:\s*.+$/i, `Due: ${NOT_DISCUSSED}`));
      replaced = true;
    } else {
      out.push(line);
    }
  }

  if (!replaced) {
    return {
      ok: false,
      document,
      skipReason: `No Due line containing any of [${dateCandidates.join(', ')}]`,
    };
  }

  return { ok: true, document: out.join('\n'), method: 'due-date-match' };
}

interface FooterCheckResult {
  ok: boolean;
  preparedByCount: number;
  datePreparedCount: number;
  lines: string[];
}

function checkDocumentFooter(document: string): FooterCheckResult {
  const preparedBy = document.match(/prepared by:/gi) ?? [];
  const datePrepared = document.match(/date prepared:/gi) ?? [];
  const lines: string[] = [];
  for (const line of document.split('\n')) {
    if (/prepared by:|date prepared:/i.test(line)) {
      lines.push(line.trim());
    }
  }
  return {
    ok: preparedBy.length <= 1 && datePrepared.length <= 1,
    preparedByCount: preparedBy.length,
    datePreparedCount: datePrepared.length,
    lines,
  };
}

/** Report-only: client letter voice and content gates (not yet hard-fail). */
function checkClientLetterReportOnly(document: string): string[] {
  const issues: string[] = [];
  if (/I advised the client\b/i.test(document)) {
    issues.push('Contains "I advised the client" (expected second person: "I advised you")');
  }
  if (/REASONING_GAP/i.test(document)) {
    issues.push('Contains REASONING_GAP marker');
  }
  if (/Reasoning and Approach/i.test(document)) {
    issues.push('Contains "Reasoning and Approach" section');
  }
  if (/must be reviewed by the supervising solicitor/i.test(document)) {
    issues.push('Contains supervision banner text');
  }
  if (/legal professional privilege/i.test(document)) {
    issues.push('Contains legal professional privilege wording');
  }
  return issues;
}

function extractClientLetterSectionHeadings(doc: string): string[] {
  const headings: string[] = [];
  const re = /^\s*\*\*([^*]+)\*\*\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc)) !== null) {
    const label = m[1].trim();
    if (!/^(Client|Matter reference|Date):?$/i.test(label)) {
      headings.push(label);
    }
  }
  return headings;
}

function findSubsectionHeader(
  document: string,
  patterns: RegExp[],
): { index: number; length: number; label: string } | null {
  for (const pat of patterns) {
    const m = document.match(pat);
    if (m && m.index !== undefined) {
      return { index: m.index, length: m[0].length, label: m[0].trim() };
    }
  }
  return null;
}

function findNextSubsectionBoundary(rest: string): number {
  const patterns = [
    /\n\s+Client'?s instructions and response:/i,
    /\n\s+What was discussed:/i,
    /\n\s+Advice given:/i,
    /\n\s+Key points advised:/i,
    /\n\s+Reasoning behind advice/i,
    /\n\*\*\d+\./,
    /\n\*\*[A-Z]/,
  ];
  let earliest = -1;
  for (const pat of patterns) {
    const idx = rest.search(pat);
    if (idx >= 0 && (earliest < 0 || idx < earliest)) {
      earliest = idx;
    }
  }
  return earliest;
}

function injectNonFactualPlant(
  document: string,
  inject: NonNullable<RegressionCase['injectNonFactual']>,
): InjectionOutcome {
  if (!document.trim()) {
    return { ok: false, document, skipReason: 'Empty document' };
  }

  if (inject.target === 'reasoning-section') {
    const header = findSubsectionHeader(document, [
      /\*\*Reasoning behind advice[^*]*\*\*:?/i,
      /Reasoning behind advice and decisions:/i,
      /Reasoning behind advice:/i,
    ]);
    if (!header) {
      return { ok: false, document, skipReason: 'No Reasoning behind advice section found' };
    }
    const afterHeader = header.index + header.length;
    const rest = document.slice(afterHeader);
    const nextSection = findNextSubsectionBoundary(rest);
    const insertAt = afterHeader + (nextSection >= 0 ? nextSection : rest.length);
    const injected =
      document.slice(0, insertAt) + `\n${inject.text}\n` + document.slice(insertAt);
    return { ok: true, document: injected, method: `reasoning-section (${header.label})` };
  }

  if (inject.target === 'instructions-section') {
    const header = findSubsectionHeader(document, [
      /\*\*Client'?s instructions and response[^*]*\*\*:?/i,
      /Client'?s instructions and response:/i,
      /Client instructions and response:/i,
    ]);
    if (!header) {
      return { ok: false, document, skipReason: "No Client's instructions and response section found" };
    }
    const afterHeader = header.index + header.length;
    const rest = document.slice(afterHeader);
    const nextSection = findNextSubsectionBoundary(rest);
    const insertAt = afterHeader + (nextSection >= 0 ? nextSection : rest.length);
    const injected =
      document.slice(0, insertAt) + `\n${inject.text}\n` + document.slice(insertAt);
    return { ok: true, document: injected, method: `instructions-section (${header.label})` };
  }

  const privilegeMatch = document.match(
    /(\*?This attendance note is subject to legal professional privilege\.?\*?)/i,
  );
  if (!privilegeMatch || privilegeMatch.index === undefined) {
    return { ok: false, document, skipReason: 'No legal professional privilege line found' };
  }
  const insertAt = privilegeMatch.index + privilegeMatch[0].length;
  const injected =
    document.slice(0, insertAt) + `\n\n${inject.text}\n` + document.slice(insertAt);
  return { ok: true, document: injected, method: 'after-privilege' };
}

function transcriptSupportsFlaggedContent(warning: string, transcript: string): boolean {
  const wLower = warning.toLowerCase();
  const tLower = transcript.toLowerCase();

  if (/full and frank disclosure/i.test(warning) && tLower.includes('duty of full and frank disclosure')) {
    return true;
  }

  if (
    (wLower.includes('subsisted') || wLower.includes('11 year') || wLower.includes('11 years')) &&
    (tLower.includes('2014') || tLower.includes('august 2014')) &&
    (tLower.includes('2026') || tLower.includes('march 2026') || tLower.includes('separated'))
  ) {
    return true;
  }

  const mustNotFlag = REGRESSION_CASES.filter((c) => c.kind === 'must-not-flag');
  for (const c of mustNotFlag) {
    if (!c.detectBy.some((sub) => wLower.includes(sub.toLowerCase()))) continue;
    if (c.detectBy.some((sub) => tLower.includes(sub.toLowerCase()))) return true;
  }

  const keyTerms = warning
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 5);
  const overlap = keyTerms.filter((t) => tLower.includes(t)).length;
  return overlap >= Math.max(2, keyTerms.length * 0.4);
}

function classifyWarning(
  warning: string,
  transcript: string,
  note?: string,
): WarningClass {
  const wLower = warning.toLowerCase();

  const mustFlag = REGRESSION_CASES.filter(
    (c) =>
      c.kind === 'must-flag' &&
      !c.plantSentence &&
      !c.injectPlaceholderMisuse &&
      !c.injectWrongClientName &&
      !c.injectNonFactual,
  );
  for (const c of mustFlag) {
    if (c.detectBy.some((sub) => wLower.includes(sub.toLowerCase()))) {
      return 'genuine-catch';
    }
  }

  if (/not discussed on this occasion/i.test(warning)) {
    if (
      wLower.includes('was covered') ||
      wLower.includes('was discussed') ||
      (wLower.includes('placeholder') && wLower.includes('when it was'))
    ) {
      return 'genuine-catch';
    }
    const itemContext = note ? extractNoteLineForWarning(warning, note) : warning;
    if (transcriptHasTimingForItem(itemContext, transcript)) {
      return 'genuine-catch';
    }
    return 'verifier-fp-genuine-placeholder';
  }

  for (const pat of RETIRED_SPURIOUS_PATTERNS) {
    if (pat.match(warning)) return 'spurious';
  }

  const mustNotFlag = REGRESSION_CASES.filter((c) => c.kind === 'must-not-flag');
  for (const c of mustNotFlag) {
    if (!c.detectBy.some((sub) => wLower.includes(sub.toLowerCase()))) continue;
    if (!transcriptSupportsFlaggedContent(warning, transcript)) continue;
    if (c.id.startsWith('legal-characterisation') || c.id.startsWith('temporal-derivation')) {
      return 'characterisation';
    }
    if (
      c.id.startsWith('numeral') ||
      c.id === 'corporate-fee-range-paraphrase' ||
      c.id === 'reasoning-gap-marker-in-section'
    ) {
      return 'spurious';
    }
    if (c.id.startsWith('placeholder') || c.id === 'compliant-placeholder-corporate') {
      return 'verifier-fp-genuine-placeholder';
    }
  }

  if (wLower.includes('advice without reasoning')) {
    if (wLower.includes('reasoning_gap')) return 'spurious';
    return 'genuine-catch';
  }

  if (transcriptSupportsFlaggedContent(warning, transcript)) {
    return 'characterisation';
  }

  return 'genuine-catch';
}

function findNaturalPlaceholderMisuse(note: string): string[] {
  const issues: string[] = [];
  const lines = note.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(NOT_DISCUSSED)) {
      const context = `${lines[i - 1] ?? ''} ${lines[i]}`.toLowerCase();
      if (
        context.includes('home office') ||
        context.includes('passport') ||
        context.includes('acknowledgment') ||
        context.includes('extension request')
      ) {
        issues.push(lines[i].trim());
      }
    }
  }
  return issues;
}

interface PlantRunResult {
  case: RegressionCase;
  status: 'DETECTED' | 'MISSED' | 'SKIPPED';
  matchingWarnings: string[];
  allWarnings: string[];
  skipReason?: string;
  injectMethod?: string;
}

type InjectionRegressionStatus = 'FLAGGED' | 'MISSED' | 'SKIPPED';

interface InjectionRegressionResult {
  status: InjectionRegressionStatus;
  warnings: string[];
  skipReason?: string;
  injectMethod?: string;
}

interface TranscriptResult {
  spec: SyntheticTranscriptSpec;
  attendanceNote: string;
  summaryText: string;
  attendanceBaseline: string[];
  summaryBaseline: string[];
  attendanceBaselineClassified: Array<{ warning: string; classification: WarningClass }>;
  summaryBaselineClassified: Array<{ warning: string; classification: WarningClass }>;
  attendancePlants: PlantRunResult[];
  summaryPlants: PlantRunResult[];
  attendanceNonFactualPlants: PlantRunResult[];
  derivationReport: DerivationReport | null;
  placeholderMisuseInjected: InjectionRegressionResult | null;
  wrongClientNameInjected: InjectionRegressionResult | null;
  naturalPlaceholderMisuseLines: string[];
  naturalPlaceholderMisuseFlagged: boolean;
  deriveCharacterise: {
    hasSubsistenceDerivation: boolean;
    hasMatrimonialHome: boolean;
    hasIrretrievably: boolean;
    durationUsesNumerals: boolean;
  };
  attendanceHasDash: boolean;
  summaryHasDash: boolean;
  attendanceFooter: FooterCheckResult;
  summaryFooter: FooterCheckResult;
  sectionHeadings: { attendance: string[]; summary: string[] };
  clientLetterReportOnly: string[];
  generationCost: number;
  verificationCost: number;
}

interface GateResult {
  passed: boolean;
  failures: string[];
  attendancePlantsDetected: number;
  attendancePlantsTotal: number;
  summaryPlantsDetected: number;
  summaryPlantsTotal: number;
  nonFactualPlantsDetected: number;
  nonFactualPlantsTotal: number;
  nonFactualPlantsSkipped: number;
  retiredSpuriousPresent: string[];
  placeholderMisuseOk: boolean;
  wrongClientNameOk: boolean;
  familyDeriveOk: boolean;
  familyDeriveNumeralsOk: boolean;
  immigrationPlaceholderGone: boolean;
  corporateCompliantPlaceholderViolations: string[];
  dashGateScopeNote: string;
  dashFree: boolean;
  attendanceSpurious: string[];
}

interface ApiCallRecord {
  transcriptId: string;
  operation: string;
  latencyMs: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

type CostedApiResult = {
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
};

async function timedApiCall<T extends CostedApiResult>(
  callLog: ApiCallRecord[],
  transcriptId: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  callLog.push({
    transcriptId,
    operation,
    latencyMs: Math.round(performance.now() - start),
    cost: result.cost,
    inputTokens: result.inputTokens ?? 0,
    outputTokens: result.outputTokens ?? 0,
  });
  return result;
}

function isPlaceholderRelatedClassification(cls: WarningClass, warning: string): boolean {
  if (cls === 'verifier-fp-genuine-placeholder') return true;
  return cls === 'genuine-catch' && /not discussed on this occasion/i.test(warning);
}

function matchesRetiredSpuriousPattern(warning: string, cls: WarningClass): boolean {
  if (isPlaceholderRelatedClassification(cls, warning)) {
    return false;
  }
  for (const pat of RETIRED_SPURIOUS_PATTERNS) {
    if (pat.id === 'spurious-fee-partner-approval') {
      const hasCurrencyOrFeeRange =
        /£\s?\d|[£]\d|fee range|\d,\d{3}\s*(?:to|–|-)\s*£?\d/i.test(warning);
      if (!hasCurrencyOrFeeRange) continue;
    }
    if (pat.match(warning)) return true;
  }
  return false;
}

function evaluateFamilyDerive(note: string): TranscriptResult['deriveCharacterise'] {
  const lower = note.toLowerCase();
  const hasDurationDerivation =
    /\bsubsisted\b/i.test(note) ||
    /\b11[- ]year\b/i.test(note) ||
    /\beleven[- ]year\b/i.test(note) ||
    /\b11 years?\b/i.test(note) ||
    /\bsome 11 years\b/i.test(note) ||
    /\bfor some 11 years\b/i.test(note) ||
    /\bapproximately 11\b/i.test(note);
  return {
    hasSubsistenceDerivation: hasDurationDerivation,
    hasMatrimonialHome: lower.includes('matrimonial home'),
    hasIrretrievably: lower.includes('irretrievably') || lower.includes('broken down'),
    durationUsesNumerals:
      /\b11[- ]year\b/i.test(note) ||
      /\b11 years?\b/i.test(note) ||
      /\bsome 11 years\b/i.test(note) ||
      /\bapproximately 11\b/i.test(note),
  };
}

function evaluateGates(
  results: TranscriptResult[],
  placeholderInject: InjectionRegressionResult | null,
  wrongNameInject: InjectionRegressionResult | null,
  arm: 'A' | 'B',
): GateResult {
  const failures: string[] = [];
  let attendanceDetected = 0;
  let attendanceTotal = 0;
  let summaryDetected = 0;
  let summaryTotal = 0;
  let nonFactualDetected = 0;
  let nonFactualTotal = 0;
  let nonFactualSkipped = 0;
  const retiredSpuriousPresent: string[] = [];
  const attendanceSpurious: string[] = [];
  const corporateCompliantPlaceholderViolations: string[] = [];

  for (const r of results) {
    for (const p of r.attendancePlants) {
      attendanceTotal++;
      if (p.status === 'DETECTED') attendanceDetected++;
      else if (p.status === 'MISSED') {
        failures.push(`Attendance factual plant MISSED: ${r.spec.id} / ${p.case.id}`);
      }
    }
    for (const p of r.summaryPlants) {
      summaryTotal++;
      if (p.status === 'DETECTED') summaryDetected++;
    }
    for (const p of r.attendanceNonFactualPlants) {
      nonFactualTotal++;
      if (p.status === 'DETECTED') nonFactualDetected++;
      if (p.status === 'SKIPPED') {
        nonFactualSkipped++;
        failures.push(
          `Non-factual plant SKIPPED: ${r.spec.id} / ${p.case.id} (${p.skipReason ?? 'unknown'})`,
        );
      }
    }

    if (!r.attendanceFooter.ok) {
      failures.push(
        `Double/missing footer (attendance): ${r.spec.id} — Prepared by: ${r.attendanceFooter.preparedByCount}, Date Prepared: ${r.attendanceFooter.datePreparedCount}`,
      );
    }
    if (!r.summaryFooter.ok) {
      failures.push(
        `Double/missing footer (summary): ${r.spec.id} — Prepared by: ${r.summaryFooter.preparedByCount}, Date Prepared: ${r.summaryFooter.datePreparedCount}`,
      );
    }

    if (r.derivationReport) {
      for (const f of r.derivationReport.hardGateFailures) {
        failures.push(f);
      }
    }

    for (const w of r.attendanceBaseline) {
      const cls = classifyWarning(w, r.spec.rawTranscript, r.attendanceNote);
      if (matchesRetiredSpuriousPattern(w, cls)) {
        retiredSpuriousPresent.push(`${r.spec.id}: ${w.slice(0, 120)}`);
      }
      if (cls === 'spurious') {
        attendanceSpurious.push(`${r.spec.id} attendance: ${w.slice(0, 120)}`);
      }
      if (
        r.spec.id === 'corporate-fiduciary-duty' &&
        cls === 'verifier-fp-genuine-placeholder'
      ) {
        corporateCompliantPlaceholderViolations.push(w.slice(0, 160));
      }
    }
  }

  if (arm === 'A' && retiredSpuriousPresent.length > 0) {
    failures.push(`Retired spurious baseline warnings still present (${retiredSpuriousPresent.length})`);
  }

  if (placeholderInject?.status === 'SKIPPED') {
    failures.push(`Injected placeholder-misuse regression: SKIPPED (${placeholderInject.skipReason ?? 'unknown'})`);
  } else if (placeholderInject?.status !== 'FLAGGED') {
    failures.push('Injected placeholder-misuse regression: MISSED');
  }

  const placeholderMisuseOk = placeholderInject?.status === 'FLAGGED';

  const wrongClientNameOk = wrongNameInject?.status === 'FLAGGED';
  if (wrongNameInject?.status === 'SKIPPED') {
    failures.push(`Injected wrong-client-name regression: SKIPPED (${wrongNameInject.skipReason ?? 'unknown'})`);
  } else if (!wrongClientNameOk) {
    failures.push('Injected wrong-client-name regression: MISSED');
  }

  const family = results.find((r) => r.spec.id === 'family-financial-remedy');
  const familyDeriveOk = Boolean(
    family?.deriveCharacterise.hasSubsistenceDerivation && family?.deriveCharacterise.hasMatrimonialHome,
  );
  const familyDeriveNumeralsOk = Boolean(
    family?.deriveCharacterise.hasSubsistenceDerivation && family?.deriveCharacterise.durationUsesNumerals,
  );

  if (arm === 'A') {
    if (!familyDeriveOk) {
      failures.push('Family note missing duration derivation and/or matrimonial home characterisation');
    }
    if (!familyDeriveNumeralsOk) {
      failures.push('Family note missing numeral duration derivation from 2014/2026 dates');
    }

    const immigration = results.find((r) => r.spec.id === 'immigration-case-history');
    const immigrationPlaceholderGone = !immigration?.naturalPlaceholderMisuseLines.length;
    if (!immigrationPlaceholderGone) {
      failures.push(
        `Immigration placeholder misuse still in generation: ${immigration?.naturalPlaceholderMisuseLines.join(' | ')}`,
      );
    }

    if (attendanceSpurious.length > 0) {
      failures.push(`Spurious warnings on attendance baselines (${attendanceSpurious.length})`);
    }

    if (corporateCompliantPlaceholderViolations.length > 0) {
      failures.push(
        `Corporate compliant placeholders still flagged by verifier (${corporateCompliantPlaceholderViolations.length})`,
      );
    }
  }

  const dashFree = !results.some((r) => r.attendanceHasDash || r.summaryHasDash);
  if (!dashFree) {
    failures.push('Em/en dash in model prose');
  }

  const dashGateScopeNote =
    'Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.';

  const immigration = results.find((r) => r.spec.id === 'immigration-case-history');

  return {
    passed: failures.length === 0,
    failures,
    attendancePlantsDetected: attendanceDetected,
    attendancePlantsTotal: attendanceTotal,
    summaryPlantsDetected: summaryDetected,
    summaryPlantsTotal: summaryTotal,
    nonFactualPlantsDetected: nonFactualDetected,
    nonFactualPlantsTotal: nonFactualTotal,
    nonFactualPlantsSkipped: nonFactualSkipped,
    retiredSpuriousPresent,
    placeholderMisuseOk,
    wrongClientNameOk,
    familyDeriveOk,
    familyDeriveNumeralsOk,
    immigrationPlaceholderGone: !immigration?.naturalPlaceholderMisuseLines.length,
    corporateCompliantPlaceholderViolations,
    dashGateScopeNote,
    dashFree,
    attendanceSpurious,
  };
}

async function runPlants(
  documentService: InstanceType<(typeof import('../server/services/documentService'))['DocumentService']>,
  document: string,
  transcript: string,
  transcriptId: string,
  callLog: ApiCallRecord[],
  section: 'attendance' | 'summary',
): Promise<{ results: PlantRunResult[]; cost: number }> {
  const results: PlantRunResult[] = [];
  let cost = 0;
  for (const plantCase of PLANT_CASES) {
    const contaminated = `${document}\n\n${plantCase.plantSentence}`;
    const verify = await timedApiCall(callLog, transcriptId, `${section} plant:${plantCase.id}`, () =>
      documentService.verifyDocumentAgainstTranscript(contaminated, transcript),
    );
    cost += verify.cost;
    const detected = caseDetected(verify.warnings, plantCase);
    const normalizedWarnings = normalizeWarnings(verify.warnings);
    results.push({
      case: plantCase,
      status: detected ? 'DETECTED' : 'MISSED',
      matchingWarnings: matchingWarnings(verify.warnings, plantCase),
      allWarnings: normalizedWarnings,
    });
    console.log(`    Plant "${plantCase.id}": ${detected ? 'DETECTED' : 'MISSED'}`);
  }
  return { results, cost };
}

async function runNonFactualPlants(
  documentService: InstanceType<(typeof import('../server/services/documentService'))['DocumentService']>,
  document: string,
  transcript: string,
  transcriptId: string,
  callLog: ApiCallRecord[],
): Promise<{ results: PlantRunResult[]; cost: number }> {
  const results: PlantRunResult[] = [];
  let cost = 0;
  for (const plantCase of NON_FACTUAL_PLANT_CASES) {
    const inject = plantCase.injectNonFactual!;
    const injectOutcome = injectNonFactualPlant(document, inject);
    if (!injectOutcome.ok) {
      results.push({
        case: plantCase,
        status: 'SKIPPED',
        matchingWarnings: [],
        allWarnings: [],
        skipReason: injectOutcome.skipReason,
      });
      console.log(`    Non-factual plant "${plantCase.id}": SKIPPED (${injectOutcome.skipReason})`);
      continue;
    }
    const verify = await timedApiCall(
      callLog,
      transcriptId,
      `attendance non-factual plant:${plantCase.id}`,
      () =>
        documentService.verifyDocumentAgainstTranscript(injectOutcome.document, transcript),
    );
    cost += verify.cost;
    const detected = caseDetected(verify.warnings, plantCase);
    const normalizedWarnings = normalizeWarnings(verify.warnings);
    results.push({
      case: plantCase,
      status: detected ? 'DETECTED' : 'MISSED',
      matchingWarnings: matchingWarnings(verify.warnings, plantCase),
      allWarnings: normalizedWarnings,
      injectMethod: injectOutcome.method,
    });
    console.log(`    Non-factual plant "${plantCase.id}": ${detected ? 'DETECTED' : 'MISSED'}`);
  }
  return { results, cost };
}

async function runHarness(
  arm: 'A' | 'B',
  chatCompletion?: DocumentChatCompletionFn,
): Promise<{ resultsPath: string; results: TranscriptResult[]; gates: GateResult; arm: 'A' | 'B' }> {
  const { DocumentService } = await import('../server/services/documentService');
  const documentService = chatCompletion
    ? new DocumentService({ chatCompletion })
    : new DocumentService();
  const armLabel = arm === 'A' ? 'GPT-4o (production path)' : 'Sonnet 4.6 (Bedrock via measurement seam)';
  console.log(`\n######## ARM ${arm}: ${armLabel} ########\n`);
  const firmPreferences = {
    includeLocation: true,
    showFullSolicitorName: true,
    includeClientConfirmation: false,
  };

  const results: TranscriptResult[] = [];
  const callLog: ApiCallRecord[] = [];
  let familyPlaceholderInject: TranscriptResult['placeholderMisuseInjected'] = null;
  let familyWrongNameInject: TranscriptResult['wrongClientNameInjected'] = null;

  for (const spec of SYNTHETIC_TRANSCRIPTS) {
    console.log(`\n=== ${spec.label} ===`);
    const metadata = buildHarnessMetadata(spec);
    const transcript = spec.rawTranscript;
    let generationCost = 0;
    let verificationCost = 0;

    console.log('  generateAttendanceNote...');
    const attGen = await timedApiCall(callLog, spec.id, 'generateAttendanceNote', () =>
      documentService.generateAttendanceNote(transcript, metadata, firmPreferences),
    );
    const attendanceNote = attGen.content;
    generationCost += attGen.cost;

    console.log('  generateSummary...');
    const sumGen = await timedApiCall(callLog, spec.id, 'generateSummary', () =>
      documentService.generateSummary(attendanceNote, metadata),
    );
    const summaryText = sumGen.content;
    generationCost += sumGen.cost;

    console.log('  baseline verification (attendance)...');
    const attBaseline = await timedApiCall(callLog, spec.id, 'verify:attendance baseline', () =>
      documentService.verifyDocumentAgainstTranscript(attendanceNote, transcript),
    );
    verificationCost += attBaseline.cost;
    console.log(`    warnings: ${attBaseline.warnings.length}`);

    console.log('  baseline verification (client letter vs attendance note)...');
    const sumBaseline = await timedApiCall(callLog, spec.id, 'verify:client letter baseline', () =>
      documentService.verifyDocumentAgainstTranscript(summaryText, attendanceNote),
    );
    verificationCost += sumBaseline.cost;
    console.log(`    warnings: ${sumBaseline.warnings.length}`);

    const attBaselineWarnings = normalizeWarnings(attBaseline.warnings);
    const sumBaselineWarnings = normalizeWarnings(sumBaseline.warnings);

    console.log('  attendance plants...');
    const attPlants = await runPlants(documentService, attendanceNote, transcript, spec.id, callLog, 'attendance');
    verificationCost += attPlants.cost;

    console.log('  client letter plants...');
    const sumPlants = await runPlants(documentService, summaryText, attendanceNote, spec.id, callLog, 'summary');
    verificationCost += sumPlants.cost;

    let attendanceNonFactualPlants: PlantRunResult[] = [];
    if (spec.nonFactualPlantTarget) {
      console.log('  non-factual plants (section-targeted)...');
      const nfPlants = await runNonFactualPlants(
        documentService,
        attendanceNote,
        transcript,
        spec.id,
        callLog,
      );
      attendanceNonFactualPlants = nfPlants.results;
      verificationCost += nfPlants.cost;
    }

    const derivationReport =
      spec.id === 'family-derivation-lay-speech'
        ? evaluateDerivationAssertions(attendanceNote, summaryText)
        : null;

    if (derivationReport) {
      const derivePassed = derivationReport.mustDerive.filter((a) => a.status === 'PASS').length;
      const deriveWrong = derivationReport.mustDerive.filter((a) => a.status === 'WRONG').length;
      const charPassed = derivationReport.mustCharacterise.filter((a) => a.status === 'PASS').length;
      console.log(
        `  derivation test: MUST-DERIVE ${derivePassed}/${derivationReport.mustDerive.length} pass, ${deriveWrong} wrong; MUST-CHARACTERISE ${charPassed}/${derivationReport.mustCharacterise.length}; hard gates: ${derivationReport.hardGateFailures.length === 0 ? 'CLEAN' : derivationReport.hardGateFailures.length + ' FAIL'}`,
      );
    }

    const attendanceFooter = checkDocumentFooter(attendanceNote);
    const summaryFooter = checkDocumentFooter(summaryText);
    const clientLetterReportOnly = checkClientLetterReportOnly(summaryText);
    const sectionHeadings = {
      attendance: extractSectionHeadings(attendanceNote),
      summary: extractClientLetterSectionHeadings(summaryText),
    };

    let placeholderMisuseInjected: TranscriptResult['placeholderMisuseInjected'] = null;
    let wrongClientNameInjected: TranscriptResult['wrongClientNameInjected'] = null;
    if (spec.id === 'family-financial-remedy') {
      console.log('  placeholder-misuse regression (injected)...');
      const inj = PLACEHOLDER_MISUSE_CASE.injectPlaceholderMisuse!;
      const phOutcome = injectPlaceholderMisuse(attendanceNote, inj.replaceDueDateContaining);
      if (!phOutcome.ok) {
        placeholderMisuseInjected = {
          status: 'SKIPPED',
          warnings: [],
          skipReason: phOutcome.skipReason,
        };
        familyPlaceholderInject = placeholderMisuseInjected;
        console.log(`    placeholder-misuse injected: SKIPPED (${phOutcome.skipReason})`);
      } else {
        const verify = await timedApiCall(callLog, spec.id, 'verify:placeholder-misuse injected', () =>
          documentService.verifyDocumentAgainstTranscript(phOutcome.document, transcript),
        );
        verificationCost += verify.cost;
        const flagged = caseDetected(verify.warnings, PLACEHOLDER_MISUSE_CASE);
        placeholderMisuseInjected = {
          status: flagged ? 'FLAGGED' : 'MISSED',
          warnings: normalizeWarnings(verify.warnings),
          injectMethod: phOutcome.method,
        };
        familyPlaceholderInject = placeholderMisuseInjected;
        console.log(`    placeholder-misuse injected: ${placeholderMisuseInjected.status}`);
      }

      console.log('  wrong-client-name regression (injected)...');
      const wn = WRONG_CLIENT_NAME_CASE.injectWrongClientName!;
      const nameOutcome = injectWrongClientName(attendanceNote, wn.correctName, wn.wrongName);
      if (!nameOutcome.ok) {
        wrongClientNameInjected = {
          status: 'SKIPPED',
          warnings: [],
          skipReason: nameOutcome.skipReason,
        };
        familyWrongNameInject = wrongClientNameInjected;
        console.log(`    wrong-client-name injected: SKIPPED (${nameOutcome.skipReason})`);
      } else {
        const verifyName = await timedApiCall(callLog, spec.id, 'verify:wrong-client-name injected', () =>
          documentService.verifyDocumentAgainstTranscript(nameOutcome.document, transcript),
        );
        verificationCost += verifyName.cost;
        const nameFlagged = caseDetected(verifyName.warnings, WRONG_CLIENT_NAME_CASE);
        wrongClientNameInjected = {
          status: nameFlagged ? 'FLAGGED' : 'MISSED',
          warnings: normalizeWarnings(verifyName.warnings),
          injectMethod: nameOutcome.method,
        };
        familyWrongNameInject = wrongClientNameInjected;
        console.log(`    wrong-client-name injected: ${wrongClientNameInjected.status} (${nameOutcome.method})`);
      }
    }

    const naturalLines = findNaturalPlaceholderMisuse(attendanceNote);
    let naturalFlagged = false;
    if (naturalLines.length > 0) {
      const verifyNat = await timedApiCall(callLog, spec.id, 'verify:natural placeholder misuse', () =>
        documentService.verifyDocumentAgainstTranscript(attendanceNote, transcript),
      );
      naturalFlagged = normalizeWarnings(verifyNat.warnings).some(
        (w) =>
          w.toLowerCase().includes('not discussed') &&
          (w.toLowerCase().includes('was covered') ||
            w.toLowerCase().includes('was discussed') ||
            w.toLowerCase().includes('home office') ||
            w.toLowerCase().includes('passport')),
      );
      verificationCost += verifyNat.cost;
    }

    results.push({
      spec,
      attendanceNote,
      summaryText,
      attendanceBaseline: attBaselineWarnings,
      summaryBaseline: sumBaselineWarnings,
      attendanceBaselineClassified: attBaselineWarnings.map((w) => ({
        warning: w,
        classification: classifyWarning(w, transcript, attendanceNote),
      })),
      summaryBaselineClassified: sumBaselineWarnings.map((w) => ({
        warning: w,
        classification: classifyWarning(w, attendanceNote, summaryText),
      })),
      attendancePlants: attPlants.results,
      summaryPlants: sumPlants.results,
      attendanceNonFactualPlants,
      derivationReport,
      placeholderMisuseInjected,
      wrongClientNameInjected,
      naturalPlaceholderMisuseLines: naturalLines,
      naturalPlaceholderMisuseFlagged: naturalFlagged,
      deriveCharacterise:
        spec.id === 'family-financial-remedy'
          ? evaluateFamilyDerive(attendanceNote)
          : {
              hasSubsistenceDerivation: false,
              hasMatrimonialHome: false,
              hasIrretrievably: false,
              durationUsesNumerals: false,
            },
      attendanceHasDash: containsEmOrEnDash(modelProseForDashGate(attendanceNote)),
      summaryHasDash: containsEmOrEnDash(modelProseForDashGate(summaryText)),
      attendanceFooter,
      summaryFooter,
      sectionHeadings,
      clientLetterReportOnly,
      generationCost,
      verificationCost,
    });
  }

  const gates = evaluateGates(results, familyPlaceholderInject, familyWrongNameInject, arm);
  const resultsPath = resultsPathForArm(arm);
  writeFileSync(resultsPath, buildReport(results, gates, arm, callLog), 'utf-8');
  console.log(`\nReport: ${resultsPath}`);
  console.log(`\nGATE (Arm ${arm}): ${gates.passed ? 'PASS' : 'FAIL'}`);
  if (!gates.passed) {
    for (const f of gates.failures) console.log(`  - ${f}`);
  }

  return { resultsPath, results, gates, arm };
}

function buildReport(
  results: TranscriptResult[],
  gates: GateResult,
  arm: 'A' | 'B',
  callLog: ApiCallRecord[],
): string {
  const armLabel = arm === 'A' ? 'GPT-4o (production path)' : 'Sonnet 4.6 (Bedrock via measurement seam)';
  const totalCost = callLog.reduce((sum, c) => sum + c.cost, 0);
  const totalLatencyMs = callLog.reduce((sum, c) => sum + c.latencyMs, 0);
  const totalInputTokens = callLog.reduce((sum, c) => sum + c.inputTokens, 0);
  const totalOutputTokens = callLog.reduce((sum, c) => sum + c.outputTokens, 0);
  const lines: string[] = [
    `# Note Safety Harness Results — Batch 2 completion — Arm ${arm}`,
    '',
    `**Model:** ${armLabel}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '**Harness:** real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.',
    arm === 'B'
      ? '**Arm B:** DocumentService measurement seam with harness-only `HarnessBedrockProvider` (copied from feat/bedrock-provider; not production).'
      : '**Arm A:** default OpenAI production path (measurement seam inert).',
    '**Regression library:** `scripts/verifier-regression-cases.ts`',
    '**Synthetic data only.**',
    '',
    '## API call log (latency and cost)',
    '',
    `**Arm totals:** ${callLog.length} calls | ${totalLatencyMs.toLocaleString()} ms cumulative latency | $${totalCost.toFixed(4)} API cost | ${totalInputTokens.toLocaleString()} input tokens | ${totalOutputTokens.toLocaleString()} output tokens`,
    '',
    '| Transcript | Operation | Latency (ms) | Cost ($) | In tokens | Out tokens |',
    '|------------|-----------|--------------|----------|-----------|------------|',
  ];

  for (const call of callLog) {
    lines.push(
      `| ${call.transcriptId} | ${call.operation} | ${call.latencyMs} | ${call.cost.toFixed(4)} | ${call.inputTokens} | ${call.outputTokens} |`,
    );
  }

  lines.push(
    '',
    `## Hard gate (Arm ${arm}${arm === 'B' ? ' — plants, injections, dash only' : ' — full'})`,
    '',
    `**Result:** ${gates.passed ? 'PASS' : 'FAIL'}`,
    '',
    `- Factual plants (attendance): ${gates.attendancePlantsDetected}/${gates.attendancePlantsTotal} DETECTED`,
    `- Factual plants (summary): ${gates.summaryPlantsDetected}/${gates.summaryPlantsTotal} DETECTED (informative)`,
    `- Non-factual plants: ${gates.nonFactualPlantsDetected}/${gates.nonFactualPlantsTotal} DETECTED (informative; SKIPPED is gate failure${gates.nonFactualPlantsSkipped > 0 ? `; ${gates.nonFactualPlantsSkipped} SKIPPED` : ''})`,
    `- Placeholder misuse injected: ${gates.placeholderMisuseOk ? 'FLAGGED' : 'MISSED/SKIPPED'}`,
    `- Wrong-client-name injected: ${gates.wrongClientNameOk ? 'FLAGGED' : 'MISSED/SKIPPED'}`,
    `- No em/en dash in model prose: ${gates.dashFree ? 'YES' : 'NO'}`,
  );

  if (arm === 'A') {
    lines.push(
      `- Retired spurious warnings gone: ${gates.retiredSpuriousPresent.length === 0 ? 'YES' : 'NO'}`,
      `- Family duration derivation: ${gates.familyDeriveOk ? 'YES' : 'NO'}`,
      `- Family duration in numerals: ${gates.familyDeriveNumeralsOk ? 'YES' : 'NO'}`,
      `- Immigration placeholder misuse gone: ${gates.immigrationPlaceholderGone ? 'YES' : 'NO'}`,
      `- Attendance spurious warnings: ${gates.attendanceSpurious.length === 0 ? 'NONE' : gates.attendanceSpurious.length}`,
      `- Corporate compliant placeholder verifier FPs: ${gates.corporateCompliantPlaceholderViolations.length === 0 ? 'NONE' : gates.corporateCompliantPlaceholderViolations.length}`,
    );
  } else {
    lines.push(
      `- Family duration derivation (tracked): ${gates.familyDeriveOk ? 'YES' : 'NO'}`,
      `- Family duration in numerals (tracked): ${gates.familyDeriveNumeralsOk ? 'YES' : 'NO'}`,
      `- Immigration placeholder misuse (tracked): ${gates.immigrationPlaceholderGone ? 'GONE' : 'PRESENT'}`,
      `- Attendance spurious (tracked): ${gates.attendanceSpurious.length}`,
    );
  }

  lines.push('', gates.dashGateScopeNote, '');

  if (gates.failures.length > 0) {
    lines.push('**Gate failures:**');
    for (const f of gates.failures) lines.push(`- ${f}`);
    lines.push('');
  }

  lines.push('---', '');

  for (const r of results) {
    lines.push(`## ${r.spec.label}`, '');
    lines.push(`**ID:** \`${r.spec.id}\``);
    lines.push(`**Generation cost:** $${r.generationCost.toFixed(4)} | **Verification:** $${r.verificationCost.toFixed(4)}`);
    lines.push('');

    lines.push('### Generated attendance note', '');
    lines.push('```');
    lines.push(r.attendanceNote);
    lines.push('```');
    lines.push('');

    lines.push('### Section headings (diagnostic)', '');
    lines.push('**Attendance:**');
    if (r.sectionHeadings.attendance.length === 0) {
      lines.push('_None detected._');
    } else {
      for (const h of r.sectionHeadings.attendance) lines.push(`- ${h}`);
    }
    lines.push('**Client letter:**');
    if (r.sectionHeadings.summary.length === 0) {
      lines.push('_None detected._');
    } else {
      for (const h of r.sectionHeadings.summary) lines.push(`- ${h}`);
    }
    lines.push('');

    lines.push('### Client letter report-only assertions', '');
    if (r.clientLetterReportOnly.length === 0) {
      lines.push('_All report-only checks clean._');
    } else {
      for (const issue of r.clientLetterReportOnly) lines.push(`- **REPORT:** ${issue}`);
    }
    lines.push('');

    lines.push('### Footer integrity', '');
    lines.push(
      `**Attendance:** Prepared by: ${r.attendanceFooter.preparedByCount} | Date Prepared: ${r.attendanceFooter.datePreparedCount} | ${r.attendanceFooter.ok ? 'OK' : '**FAIL**'}`,
    );
    for (const l of r.attendanceFooter.lines) lines.push(`- \`${l}\``);
    lines.push(
      `**Client letter:** Prepared by: ${r.summaryFooter.preparedByCount} | Date Prepared: ${r.summaryFooter.datePreparedCount} | ${r.summaryFooter.ok ? 'OK' : '**FAIL**'}`,
    );
    for (const l of r.summaryFooter.lines) lines.push(`- \`${l}\``);
    lines.push('');

    if (r.spec.id === 'family-derivation-lay-speech') {
      lines.push('### Generated client letter', '');
      lines.push('```');
      lines.push(r.summaryText);
      lines.push('```');
      lines.push('');
      lines.push('### Derivation test assertions', '');
      lines.push('```');
      if (r.derivationReport) {
        lines.push(...formatDerivationReportLines(r.derivationReport));
        lines.push('');
        lines.push(
          'Note: Post-Change-1, any cross-document contradiction indicates a wiring/strip bug, not a model failure.',
        );
      } else {
        lines.push('_Derivation report not computed._');
      }
      lines.push('```');
      lines.push('');
    }

    if (r.spec.id === 'family-financial-remedy') {
      lines.push('### Family derive/characterise check', '');
      lines.push(`- Duration derivation from marriage/separation dates: ${r.deriveCharacterise.hasSubsistenceDerivation ? 'YES' : 'NO'}`);
      lines.push(`- Duration rendered with numerals (formatting rule): ${r.deriveCharacterise.durationUsesNumerals ? 'YES' : 'NO (words or absent)'}`);
      lines.push(`- "matrimonial home": ${r.deriveCharacterise.hasMatrimonialHome ? 'YES' : 'NO'}`);
      lines.push(`- "irretrievably" / broken down: ${r.deriveCharacterise.hasIrretrievably ? 'YES' : 'NO'}`);
      lines.push('');
      lines.push('### Family disclosure reasoning evidence', '');
      lines.push('Transcript (bonus disclosure advice):');
      lines.push('> *"I advised the client that all material changes in financial circumstances must be disclosed in Form E, having considered the duty of full and frank disclosure."*');
      lines.push('');
      lines.push('The solicitor articulated reasoning at the meeting (duty of full and frank disclosure). Flags on note reasoning boilerplate citing that duty are **characterisation**, not invented reasoning.');
      lines.push('');
    }

    lines.push('### Clean baseline warnings (attendance)', '');
    if (r.attendanceBaseline.length === 0) {
      lines.push('_None._');
    } else {
      for (const c of r.attendanceBaselineClassified) {
        lines.push(`- **[${c.classification}]** ${c.warning}`);
      }
    }
    lines.push('');

    lines.push('### Clean baseline warnings (client letter vs attendance note)', '');
    if (r.summaryBaseline.length === 0) {
      lines.push('_None._');
    } else {
      for (const c of r.summaryBaselineClassified) {
        lines.push(`- **[${c.classification}]** ${c.warning}`);
      }
    }
    lines.push('');

    lines.push('### Attendance plants (factual)', '');
    lines.push('| Plant | Status | Matching |');
    lines.push('|-------|--------|----------|');
    for (const p of r.attendancePlants) {
      const m = p.matchingWarnings.join('; ') || '—';
      lines.push(`| ${p.case.id} | **${p.status}** | ${m.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');

    if (r.attendanceNonFactualPlants.length > 0) {
      lines.push('### Attendance plants (non-factual, section-targeted)', '');
      lines.push('| Plant | Status | Matching |');
      lines.push('|-------|--------|----------|');
      for (const p of r.attendanceNonFactualPlants) {
        const m = p.matchingWarnings.join('; ') || '—';
        const skip = p.skipReason ? ` (${p.skipReason})` : '';
        lines.push(`| ${p.case.id} | **${p.status}**${skip} | ${m.replace(/\|/g, '\\|')} |`);
      }
      lines.push('');
    }

    lines.push('### Summary plants (factual)', '');
    lines.push('| Plant | Status | Matching |');
    lines.push('|-------|--------|----------|');
    for (const p of r.summaryPlants) {
      const m = p.matchingWarnings.join('; ') || '—';
      lines.push(`| ${p.case.id} | **${p.status}** | ${m.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');

    if (r.placeholderMisuseInjected) {
      lines.push('### Placeholder-misuse regression (injected)', '');
      lines.push(`**Status:** ${r.placeholderMisuseInjected.status}`);
      if (r.placeholderMisuseInjected.skipReason) {
        lines.push(`**Skip reason:** ${r.placeholderMisuseInjected.skipReason}`);
      }
      if (r.placeholderMisuseInjected.injectMethod) {
        lines.push(`**Inject method:** ${r.placeholderMisuseInjected.injectMethod}`);
      }
      lines.push(
        '**V1 expectation:** FLAGGED — injected Due replaces 24 March 2026 commitment; contradicting timing is quotable from the meeting record.',
      );
      for (const w of r.placeholderMisuseInjected.warnings) lines.push(`- ${w}`);
      lines.push('');
    }

    if (r.wrongClientNameInjected) {
      lines.push('### Wrong-client-name regression (injected)', '');
      lines.push(`**Status:** ${r.wrongClientNameInjected.status}`);
      if (r.wrongClientNameInjected.skipReason) {
        lines.push(`**Skip reason:** ${r.wrongClientNameInjected.skipReason}`);
      }
      if (r.wrongClientNameInjected.injectMethod) {
        lines.push(`**Inject method:** ${r.wrongClientNameInjected.injectMethod}`);
      }
      for (const w of r.wrongClientNameInjected.warnings) lines.push(`- ${w}`);
      lines.push('');
    }

    if (r.naturalPlaceholderMisuseLines.length > 0) {
      lines.push('### Natural placeholder misuse in note', '');
      for (const l of r.naturalPlaceholderMisuseLines) lines.push(`- \`${l}\``);
      lines.push(`**Verifier flagged:** ${r.naturalPlaceholderMisuseFlagged ? 'YES' : 'NO'}`);
      lines.push('');
    }

    lines.push('---', '');
  }

  lines.push('## Regression case library (seeded)', '');
  for (const c of REGRESSION_CASES) {
    lines.push(`- \`${c.id}\` (${c.kind}): ${c.description}`);
  }

  return lines.join('\n');
}

runDualHarness()
  .then(({ armA, armB }) => {
    console.log('\n=== Gate results (informational) ===');
    if (armA) console.log(`Arm A: ${armA.gates.passed ? 'PASS' : 'FAIL'}`);
    if (armB) console.log(`Arm B: ${armB.gates.passed ? 'PASS' : 'FAIL'}`);
  })
  .catch((err) => {
    console.error('[note-safety-harness] Failed:', err);
    process.exit(1);
  });

async function runDualHarness(): Promise<{
  armA: { results: TranscriptResult[]; gates: GateResult } | null;
  armB: { results: TranscriptResult[]; gates: GateResult } | null;
}> {
  if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'eu-west-2';
  }
  if (!process.env.BEDROCK_PRIVILEGED_MODEL_ID) {
    process.env.BEDROCK_PRIVILEGED_MODEL_ID = 'eu.anthropic.claude-sonnet-4-6';
  }

  const harnessArm = (process.env.HARNESS_ARM ?? 'both').toLowerCase();
  const runA = harnessArm === 'a' || harnessArm === 'both';
  const runB = harnessArm === 'b' || harnessArm === 'both';

  if (!runA && !runB) {
    console.error('[note-safety-harness] HARNESS_ARM must be A, B, or both');
    process.exit(1);
  }

  let armA: { results: TranscriptResult[]; gates: GateResult } | null = null;
  let armB: { results: TranscriptResult[]; gates: GateResult } | null = null;

  if (runA) {
    armA = await runHarness('A');
    if (!armA.gates.passed) {
      console.warn('\nArm A gate: FAIL' + (runB ? ' (continuing to Arm B)' : ''));
    } else {
      console.log('\nArm A gate: PASS');
    }
  }

  if (runB) {
    armB = await runHarness('B', createBedrockChatCompletion());
    if (!armB.gates.passed) {
      console.warn('\nArm B gate: FAIL');
    } else {
      console.log('\nArm B gate: PASS');
    }
  }

  if (armA && armB) {
    const comparisonPath = join(SCRIPT_DIR, `note-safety-results-${RESULTS_DATE}-batch2-comparison.md`);
    writeFileSync(comparisonPath, buildComparisonReport(armA, armB), 'utf-8');
    console.log(`\nComparison report: ${comparisonPath}`);
  }

  return { armA, armB };
}

function formatPlantStatus(status: PlantRunResult['status']): string {
  return status;
}

function formatSummaryPlantsRow(r: TranscriptResult): string {
  if (r.summaryPlants.length === 0) return '_No summary plants_';
  return r.summaryPlants.map((p) => `${p.case.id}: ${formatPlantStatus(p.status)}`).join('; ');
}

function formatAttendancePlantsRow(r: TranscriptResult): string {
  if (r.attendancePlants.length === 0) return '_No attendance plants_';
  return r.attendancePlants.map((p) => `${p.case.id}: ${formatPlantStatus(p.status)}`).join('; ');
}

function hasAllegationNotFindingRegister(note: string): boolean {
  const lower = note.toLowerCase();
  return (
    lower.includes('concerns') ||
    lower.includes('potential misapplication') ||
    lower.includes('alleged') ||
    lower.includes('raised concerns')
  );
}

function corporateCompliantPlaceholderFlagged(r: TranscriptResult): boolean {
  if (r.spec.id !== 'corporate-fiduciary-duty') return false;
  return r.attendanceBaselineClassified.some((c) => c.classification === 'verifier-fp-genuine-placeholder');
}

function formatInjectionRow(inj: InjectionRegressionResult | null): string {
  if (!inj) return '_N/A_';
  if (inj.status === 'SKIPPED') return `SKIPPED (${inj.skipReason ?? 'unknown'})`;
  return `${inj.status}${inj.injectMethod ? ` — ${inj.injectMethod}` : ''}`;
}

function hasDashInModelProse(r: TranscriptResult): boolean {
  return r.attendanceHasDash || r.summaryHasDash;
}

function formatCleanWarnings(r: TranscriptResult, section: 'attendance' | 'summary'): string[] {
  const classified =
    section === 'attendance' ? r.attendanceBaselineClassified : r.summaryBaselineClassified;
  if (classified.length === 0) return ['_None._'];
  return classified.map((c) => `- [${c.classification}] ${c.warning}`);
}

function buildComparisonReport(
  armA: { results: TranscriptResult[]; gates: GateResult },
  armB: { results: TranscriptResult[]; gates: GateResult },
): string {
  const lines: string[] = [
    `# Batch 2 dual-arm comparison — ${RESULTS_DATE}`,
    '',
    'Both arms ran unconditionally. Gate results are informational only.',
    '',
    '## Gate summary',
    '',
    '| Check | Arm A (GPT-4o) | Arm B (Sonnet 4.6) |',
    '|-------|----------------|---------------------|',
    `| Hard gate | ${armA.gates.passed ? 'PASS' : 'FAIL'} | ${armB.gates.passed ? 'PASS' : 'FAIL'} |`,
    `| Factual plants (attendance) | ${armA.gates.attendancePlantsDetected}/${armA.gates.attendancePlantsTotal} | ${armB.gates.attendancePlantsDetected}/${armB.gates.attendancePlantsTotal} |`,
    `| Factual plants (summary) | ${armA.gates.summaryPlantsDetected}/${armA.gates.summaryPlantsTotal} | ${armB.gates.summaryPlantsDetected}/${armB.gates.summaryPlantsTotal} |`,
    `| Non-factual plants | ${armA.gates.nonFactualPlantsDetected}/${armA.gates.nonFactualPlantsTotal} | ${armB.gates.nonFactualPlantsDetected}/${armB.gates.nonFactualPlantsTotal} |`,
    `| Injections FLAGGED | ${armA.gates.placeholderMisuseOk && armA.gates.wrongClientNameOk ? 'YES' : 'NO'} | ${armB.gates.placeholderMisuseOk && armB.gates.wrongClientNameOk ? 'YES' : 'NO'} |`,
    `| Family derive + numerals | ${armA.gates.familyDeriveNumeralsOk ? 'YES' : 'NO'} | ${armB.gates.familyDeriveNumeralsOk ? 'YES' : 'NO'} |`,
    `| Immigration placeholder misuse gone | ${armA.gates.immigrationPlaceholderGone ? 'YES' : 'NO'} | ${armB.gates.immigrationPlaceholderGone ? 'YES' : 'NO'} |`,
    `| Attendance spurious count | ${armA.gates.attendanceSpurious.length} | ${armB.gates.attendanceSpurious.length} |`,
    `| Retired spurious count | ${armA.gates.retiredSpuriousPresent.length} | ${armB.gates.retiredSpuriousPresent.length} |`,
    `| Corporate compliant placeholders unflagged | ${armA.gates.corporateCompliantPlaceholderViolations.length === 0 ? 'YES' : 'NO'} | ${armB.gates.corporateCompliantPlaceholderViolations.length === 0 ? 'YES' : 'NO'} |`,
    `| Em/en dash in model prose | ${armA.gates.dashFree ? 'NONE' : 'PRESENT'} | ${armB.gates.dashFree ? 'NONE' : 'PRESENT'} |`,
    '',
  ];

  if (armA.gates.failures.length > 0) {
    lines.push('**Arm A gate failures:**', '');
    for (const f of armA.gates.failures) lines.push(`- ${f}`);
    lines.push('');
  }
  if (armB.gates.failures.length > 0) {
    lines.push('**Arm B gate failures:**', '');
    for (const f of armB.gates.failures) lines.push(`- ${f}`);
    lines.push('');
  }

  lines.push('## Per-transcript comparison', '');

  for (let i = 0; i < armA.results.length; i++) {
    const a = armA.results[i];
    const b = armB.results[i];
    lines.push(`### ${a.spec.label}`, '');

    lines.push('| Dimension | Arm A | Arm B |');
    lines.push('|-----------|-------|-------|');
    lines.push(`| Attendance plants | ${formatAttendancePlantsRow(a)} | ${formatAttendancePlantsRow(b)} |`);
    lines.push(`| Summary plants | ${formatSummaryPlantsRow(a)} | ${formatSummaryPlantsRow(b)} |`);
    lines.push(`| Wrong-client injection | ${formatInjectionRow(a.wrongClientNameInjected)} | ${formatInjectionRow(b.wrongClientNameInjected)} |`);
    lines.push(
      `| Placeholder-misuse injection | ${formatInjectionRow(a.placeholderMisuseInjected)} | ${formatInjectionRow(b.placeholderMisuseInjected)} |`,
    );
    lines.push(
      `| Family duration derived | ${a.spec.id === 'family-financial-remedy' ? (a.deriveCharacterise.hasSubsistenceDerivation ? 'YES' : 'NO') : 'N/A'} | ${b.spec.id === 'family-financial-remedy' ? (b.deriveCharacterise.hasSubsistenceDerivation ? 'YES' : 'NO') : 'N/A'} |`,
    );
    lines.push(
      `| Family duration in numerals | ${a.spec.id === 'family-financial-remedy' ? (a.deriveCharacterise.durationUsesNumerals ? 'YES' : 'NO') : 'N/A'} | ${b.spec.id === 'family-financial-remedy' ? (b.deriveCharacterise.durationUsesNumerals ? 'YES' : 'NO') : 'N/A'} |`,
    );
    lines.push(
      `| "Matrimonial home" register | ${a.spec.id === 'family-financial-remedy' ? (a.deriveCharacterise.hasMatrimonialHome ? 'YES' : 'NO') : 'N/A'} | ${b.spec.id === 'family-financial-remedy' ? (b.deriveCharacterise.hasMatrimonialHome ? 'YES' : 'NO') : 'N/A'} |`,
    );
    lines.push(
      `| Allegation-not-finding register | ${a.spec.id === 'corporate-fiduciary-duty' ? (hasAllegationNotFindingRegister(a.attendanceNote) ? 'YES' : 'NO') : 'N/A'} | ${b.spec.id === 'corporate-fiduciary-duty' ? (hasAllegationNotFindingRegister(b.attendanceNote) ? 'YES' : 'NO') : 'N/A'} |`,
    );
    lines.push(
      `| Corporate compliant placeholders flagged | ${a.spec.id === 'corporate-fiduciary-duty' ? (corporateCompliantPlaceholderFlagged(a) ? 'YES' : 'NO') : 'N/A'} | ${b.spec.id === 'corporate-fiduciary-duty' ? (corporateCompliantPlaceholderFlagged(b) ? 'YES' : 'NO') : 'N/A'} |`,
    );
    lines.push(
      `| Em/en dash in model prose | ${hasDashInModelProse(a) ? 'PRESENT' : 'NONE'} | ${hasDashInModelProse(b) ? 'PRESENT' : 'NONE'} |`,
    );
    lines.push('');

    lines.push('**Arm A — clean attendance warnings:**', ...formatCleanWarnings(a, 'attendance'), '');
    lines.push('**Arm B — clean attendance warnings:**', ...formatCleanWarnings(b, 'attendance'), '');
    lines.push('**Arm A — clean summary warnings:**', ...formatCleanWarnings(a, 'summary'), '');
    lines.push('**Arm B — clean summary warnings:**', ...formatCleanWarnings(b, 'summary'), '');
    lines.push('');
  }

  return lines.join('\n');
}
