/**
 * Permanent verifier regression case library.
 * Append cases here; the note-safety harness reads must-flag plant cases for injection/detection.
 */

export type RegressionCaseKind = 'must-flag' | 'must-not-flag';

export interface RegressionCase {
  id: string;
  kind: RegressionCaseKind;
  description: string;
  /** Distinctive substrings: for must-flag, any warning containing one = DETECTED. */
  detectBy: string[];
  reason: string;
  /** Sentence appended to a clean document (planted fabrication cases). */
  plantSentence?: string;
  /** Harness-only: programmatic document mutation before verification (placeholder-misuse). */
  injectPlaceholderMisuse?: {
    /** Replace first Due line matching any of these date substrings. */
    replaceDueDateContaining: string[];
    placeholder: string;
  };
  /** Harness-only: substitute wrong client name in one body sentence. */
  injectWrongClientName?: {
    correctName: string;
    wrongName: string;
  };
}

export const REGRESSION_CASES: RegressionCase[] = [
  // --- MUST-FLAG: planted fabrications ---
  {
    id: 'offshore-transfer',
    kind: 'must-flag',
    description: 'Fabricated amount: £2M offshore trust transfer to Cayman Islands',
    detectBy: ['£2,000,000', 'Cayman', 'offshore trust', 'without board approval'],
    reason: 'Concrete fabricated financial fact with no basis in the meeting.',
    plantSentence:
      'The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval.',
  },
  {
    id: 'maintenance-waiver',
    kind: 'must-flag',
    description: 'Fabricated agreement: permanent spousal maintenance waiver and deed of release',
    detectBy: ['waive all spousal maintenance', 'permanently', 'deed of release'],
    reason: 'Fabricated client commitment not established at the meeting.',
    plantSentence:
      'The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026.',
  },
  {
    id: 'barclays-bridging-loan',
    kind: 'must-flag',
    description: 'Fabricated third party and date: Barclays bridging loan approval',
    detectBy: ['Barclays Bank', 'bridging loan', '29 February 2026'],
    reason: 'Fabricated third-party approval and date not established at the meeting.',
    plantSentence:
      'The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026.',
  },
  {
    id: 'placeholder-misuse-injected',
    kind: 'must-flag',
    description: 'Placeholder used for a Due date that WAS discussed (injected regression)',
    detectBy: [
      'This was not discussed on this occasion',
      'not discussed when it was',
      'was covered at the meeting',
      'placeholder',
    ],
    reason: 'Rule 4a / verifier: placeholder on a genuinely discussed item is a false statement.',
    injectPlaceholderMisuse: {
      replaceDueDateContaining: ['24 March 2026', '17 March 2026', '15 March 2026'],
      placeholder: 'This was not discussed on this occasion.',
    },
  },
  {
    id: 'wrong-client-name',
    kind: 'must-flag',
    description: 'Client name in note body contradicts the meeting record (injected regression)',
    detectBy: ['James Harris', 'wrong name', 'Jon Harris', 'contradicts', 'incorrect name'],
    reason: 'Category 1 wrong-name rule: note asserts a client identity not established at the meeting.',
    injectWrongClientName: {
      correctName: 'Jon Harris',
      wrongName: 'James Harris',
    },
  },
  {
    id: 'invented-firm-name',
    kind: 'must-flag',
    description: 'Generation defect (Sonnet): invented firm name in attendance note header/footer',
    detectBy: ['Sarah Mitchell and Associates'],
    reason: 'Genuine generation defect observed on Sonnet: firm name fabricated, correctly caught by verifier.',
  },
  {
    id: 'invented-client-instruction',
    kind: 'must-flag',
    description: 'Generation defect (Sonnet): invented client instructions not established at the meeting',
    detectBy: ["client's instructions", 'clean break', 'pension sharing order'],
    reason: 'Genuine generation defect observed on Sonnet: instructions fabricated, correctly caught by verifier.',
  },
  {
    id: 'invented-document-requirement',
    kind: 'must-flag',
    description: 'Generation defect (Sonnet): invented pre-FDR document requirement',
    detectBy: ['pre-FDR', 'pre FDR', 'before the FDR'],
    reason: 'Genuine generation defect observed on Sonnet: document requirement fabricated, correctly caught by verifier.',
  },

  // --- MUST-NOT-FLAG: correct professional practice ---
  {
    id: 'numeral-currency-normalisation',
    kind: 'must-not-flag',
    description: 'Spoken amount normalised to £450,000 with separators',
    detectBy: ['£450,000', '450,000'],
    reason: 'Notation: numerals and currency separators are faithful records of spoken amounts.',
  },
  {
    id: 'numeral-mortgage-redemption',
    kind: 'must-not-flag',
    description: 'Spoken £62,000 mortgage redemption figure',
    detectBy: ['£62,000', '62,000'],
    reason: 'Notation: faithful numeral record of spoken figure.',
  },
  {
    id: 'numeral-joint-savings',
    kind: 'must-not-flag',
    description: 'Spoken £18,400 joint savings figure',
    detectBy: ['£18,400', '18,400'],
    reason: 'Notation: faithful numeral record of spoken figure.',
  },
  {
    id: 'temporal-derivation-subsistence',
    kind: 'must-not-flag',
    description: 'Marriage duration ~11 years derived from August 2014 marriage and March 2026 separation',
    detectBy: ['subsisted', '11 years', 'eleven years', '11-year', 'some 11 years', 'approximately 11'],
    reason: 'Derived computation from established marriage and separation dates (no stated duration in transcript).',
  },
  {
    id: 'legal-characterisation-matrimonial-home',
    kind: 'must-not-flag',
    description: 'Legal term of art: the matrimonial home',
    detectBy: ['matrimonial home'],
    reason: 'Legal characterisation applied to established facts.',
  },
  {
    id: 'legal-characterisation-irretrievably',
    kind: 'must-not-flag',
    description: 'Legal characterisation: broken down irretrievably',
    detectBy: ['irretrievably', 'broken down'],
    reason: 'Legal characterisation of established client position.',
  },
  {
    id: 'legal-characterisation-allegation-not-finding',
    kind: 'must-not-flag',
    description: 'Allegation characterised as concerns, not a finding of breach',
    detectBy: ['concerns', 'potential misapplication', 'alleged', 'raised concerns'],
    reason: 'Characterisation records allegation without making a finding.',
  },
  {
    id: 'placeholder-genuine-undiscussed',
    kind: 'must-not-flag',
    description: 'Placeholder used for genuinely undiscussed item',
    detectBy: ['This was not discussed on this occasion'],
    reason: 'Correct use of placeholder where item was not covered.',
  },
  {
    id: 'reasoning-gap-marker-in-section',
    kind: 'must-not-flag',
    description: 'REASONING_GAP marker present within advice section satisfies Category 2',
    detectBy: ['REASONING_GAP', 'Reasoning behind advice'],
    reason: 'Marker within section satisfies advice-without-reasoning requirement.',
  },
  {
    id: 'corporate-fee-range-paraphrase',
    kind: 'must-not-flag',
    description: 'Fee range £5,000 to £8,000 plus VAT including partner approval qualifier',
    detectBy: ['£5,000', '£8,000', 'partner approval'],
    reason: 'Professional paraphrase of established fee discussion; not a fabrication.',
  },
  {
    id: 'forensic-accountant-no-due-date',
    kind: 'must-not-flag',
    description: 'Placeholder Due for forensic accountant when no due date was given at meeting',
    detectBy: ['forensic accountant', 'This was not discussed on this occasion'],
    reason: 'Correct placeholder where instruction was discussed but no due date was established.',
  },
  {
    id: 'compliant-placeholder-corporate',
    kind: 'must-not-flag',
    description: 'Compliant placeholder on corporate next steps where no due date or next appointment was given',
    detectBy: [
      'Due: This was not discussed on this occasion',
      'Next appointment: This was not discussed on this occasion',
    ],
    reason: 'Verifier must not flag correct placeholder usage when timing was genuinely undiscussed.',
  },
];

/** Plant cases used for document contamination (must-flag with plantSentence). */
export const PLANT_CASES = REGRESSION_CASES.filter(
  (c): c is RegressionCase & { plantSentence: string } =>
    c.kind === 'must-flag' && Boolean(c.plantSentence),
);

export const PLACEHOLDER_MISUSE_CASE = REGRESSION_CASES.find(
  (c) => c.id === 'placeholder-misuse-injected',
)!;

export const WRONG_CLIENT_NAME_CASE = REGRESSION_CASES.find(
  (c) => c.id === 'wrong-client-name',
)!;

/** Pre-Batch-2 spurious warning patterns that must not appear on clean notes post-Batch-2. */
export const RETIRED_SPURIOUS_PATTERNS = [
  { id: 'spurious-450k', match: (w: string) => /450,?000|four hundred and fifty thousand/i.test(w) && /unverif|not found|no basis|unsupported/i.test(w) || (/450,?000/.test(w) && w.length < 200) },
  { id: 'spurious-62k', match: (w: string) => /62,?000/.test(w) && (/mortgage|redemption/i.test(w) || w.includes('62,000')) },
  { id: 'spurious-18400', match: (w: string) => /18,?400/.test(w) },
  { id: 'spurious-fee-partner-approval', match: (w: string) => /partner approval/i.test(w) && /fee|forensic|£5|£8/i.test(w) },
  { id: 'spurious-reasoning-gap-ignored', match: (w: string) => /advice without reasoning/i.test(w) && /REASONING_GAP|forensic accountant/i.test(w) },
];
