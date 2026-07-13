/**
 * Generation-side assertions for the lay-speech derivation test fixture.
 * Asserts on generated note text — not verifier warnings.
 */

export type DeriveStatus = 'PASS' | 'WRONG' | 'ABSENT';
export type AssertionStatus = DeriveStatus | 'FAIL' | 'CLEAN' | 'WARNING';

export interface DerivationAssertionResult {
  id: string;
  status: AssertionStatus;
  detail: string;
}

export interface ContradictionResult {
  id: string;
  attendanceSentence: string;
  summarySentence: string;
}

export interface DerivationReport {
  mustDerive: DerivationAssertionResult[];
  mustDeriveSummary: DerivationAssertionResult[];
  contradictions: ContradictionResult[];
  netGrossTrap: { status: 'clean' | 'warning'; sentence?: string };
  mustCharacterise: DerivationAssertionResult[];
  mustRecord: DerivationAssertionResult[];
  mustNotSay: {
    parentalAlienation: { status: 'CLEAN' | 'HARD_FAIL'; detail: string };
    dissipationFinding: { status: 'CLEAN' | 'HARD_FAIL'; detail: string };
  };
  mustNotCharacterise: { status: 'CLEAN' | 'WARNING' | 'HARD_FAIL'; detail: string };
  sectionHeadings: { attendance: string[]; summary: string[] };
  bennettDissipationHeading: { status: 'CLEAN' | 'HARD_FAIL'; heading?: string };
  adjudicatingHeadingWarnings: string[];
  attributionDiagnostic: string[];
  pensionMechanismAttribution: { status: 'CLEAN' | 'HARD_FAIL'; detail?: string };
  reasoningGap: { markerPresent: boolean; sectionText?: string };
  hardGateFailures: string[];
}

interface DeriveAssertionSpec {
  id: string;
  contextPatterns: RegExp[];
  valuePatterns: RegExp[];
  wrongPatterns?: RegExp[];
  valueShape: 'currency' | 'duration';
}

const DERIVE_ASSERTIONS: DeriveAssertionSpec[] = [
  {
    id: 'net-equity',
    contextPatterns: [/net equity/i, /equity in the matrimonial home/i, /net equity of/i],
    valuePatterns: [/£?\s*470,?000\b/i, /\b470k\b/i],
    wrongPatterns: [/net equity.{0,40}£?\s*(?!470,?000)\d[\d,]*/i],
    valueShape: 'currency',
  },
  {
    id: 'income-annualised',
    contextPatterns: [
      /per annum/i,
      /\ba year\b/i,
      /annual(?:ly|ised)?/i,
      /£3,?500.{0,40}after tax/i,
      /after tax.{0,40}£3,?500/i,
    ],
    valuePatterns: [/£?\s*42,?000\b/i, /\b42k\b/i],
    wrongPatterns: [/£?\s*3,?500\s*(?:per annum|p\.?a\.?|a year)/i],
    valueShape: 'currency',
  },
  {
    id: 'marriage-duration',
    contextPatterns: [
      /marriage.{0,80}(subsist|lasted|duration|broken down)/i,
      /subsist.{0,40}marriage/i,
      /marriage has therefore subsisted/i,
      /married in June 2015/i,
    ],
    valuePatterns: [
      /\b10\s*(?:years?|yrs?).{0,40}(?:5|five)\s*months?\b/i,
      /\b10[- ]year/i,
      /125\s*months/i,
      /approximately 10 years/i,
    ],
    wrongPatterns: [/\b9\s*(?:years?|yrs?)\b/i],
    valueShape: 'duration',
  },
  {
    id: 'separation-duration',
    contextPatterns: [/separat/i, /moved out/i, /since.{0,40}(November|Nov)/i],
    valuePatterns: [
      /\b(?:approximately|about|some|around|circa)\s*4\s*months?\b/i,
      /4[- ]month/i,
    ],
    valueShape: 'duration',
  },
  {
    id: 'pension-differential',
    contextPatterns: [/pension.{0,60}(differen|dispar)/i, /dispar.{0,40}pension/i],
    valuePatterns: [/£?\s*230,?000\b/i, /\b230k\b/i],
    valueShape: 'currency',
  },
  {
    id: 'pension-total',
    contextPatterns: [/pension.{0,60}(total|combined)/i, /combined pension/i, /total pension/i],
    valuePatterns: [/£?\s*410,?000\b/i, /\b410k\b/i],
    valueShape: 'currency',
  },
  {
    id: 'relationship-duration',
    contextPatterns: [/relationship.{0,40}(since|began|together)/i, /together since 2009/i, /met in 2009/i],
    valuePatterns: [
      /\b(?:approximately|about|some|around|circa)\s*17\s*(?:years?|yrs?)\b/i,
      /\b17[- ]year/i,
    ],
    wrongPatterns: [/\b(?:approximately|about)\s*1[0-6]\s*(?:years?|yrs?)\b/i],
    valueShape: 'duration',
  },
  {
    id: 'cohabitation-pre-marriage',
    contextPatterns: [/cohabit/i, /before the marriage/i, /prior to marriage/i, /2009.{0,40}June 2015/i],
    valuePatterns: [
      /\b(?:approximately|about|some|around|circa)\s*6\s*(?:years?|yrs?)\b/i,
      /\b6[- ]year/i,
    ],
    valueShape: 'duration',
  },
  {
    id: 'total-assets',
    contextPatterns: [/total.{0,40}(assets|pot|resources)/i, /combined assets/i, /matrimonial pot/i],
    valuePatterns: [/£?\s*880,?000\b/i, /\b880k\b/i, /(?:approximately|about|circa|around)\s*£?\s*880/i],
    valueShape: 'currency',
  },
];

const ATTRIBUTION_VERBS =
  /\b(confirmed|instructed|agreed|wished|wishes|was of the view|accepted|understood|intended|considered|formed the view|directed)\b/i;

const ADJUDICATING_TERMS =
  /\b(breach|failure to|fraud|misappropriat|dissipation|conceal)\b/i;
const HEDGE_TERMS =
  /\b(alleged|potential|possible|suspected|concerns as to|query|unexplained)\b/i;

const DISSIPATION_HEADING_TERMS =
  /\b(dissipation|misappropriat|conceal|theft|stole|stolen|took the)\b/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractSurrounding(text: string, index: number, radius = 160): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function sentenceForIndex(text: string, index: number): string {
  const sentences = splitSentences(text);
  let offset = 0;
  for (const sentence of sentences) {
    const idx = text.indexOf(sentence, offset);
    if (idx >= 0 && index >= idx && index < idx + sentence.length) {
      return sentence;
    }
    if (idx >= 0) offset = idx + sentence.length;
  }
  return extractSurrounding(text, index);
}

function findContextSentences(doc: string, contextPatterns: RegExp[]): string[] {
  const found = new Set<string>();
  for (const sentence of splitSentences(doc)) {
    if (contextPatterns.some((p) => p.test(sentence))) {
      found.add(sentence);
    }
  }
  if (found.size > 0) return [...found];

  for (const pat of contextPatterns) {
    const m = doc.match(pat);
    if (m && m.index !== undefined) {
      found.add(sentenceForIndex(doc, m.index));
    }
  }
  return [...found];
}

function hasDurationValue(sentence: string): boolean {
  return /\b(?:approximately|about|around|circa|some)?\s*\d+\s*(?:years?|yrs?|months?)\b/i.test(
    sentence,
  );
}

function hasCompetingCurrencyAssertion(sentence: string, spec: DeriveAssertionSpec): boolean {
  if (!/£[\d,]+/.test(sentence)) return false;
  if (spec.id === 'net-equity') return /net equity/i.test(sentence);
  if (spec.id === 'income-annualised') {
    return /per annum|a year|annual|£42,?000|equating to/i.test(sentence);
  }
  if (spec.id === 'pension-differential') {
    return /differen|dispar/i.test(sentence) && /£[\d,]+/.test(sentence);
  }
  if (spec.id === 'pension-total') {
    return /(?:combined|total).{0,20}pension|pension.{0,20}(?:combined|total)/i.test(sentence);
  }
  if (spec.id === 'total-assets') {
    return /total.{0,20}(assets|pot)|combined assets|matrimonial pot/i.test(sentence);
  }
  return false;
}

function assertDerivedWithContext(spec: DeriveAssertionSpec, doc: string): DerivationAssertionResult {
  const contextSentences = findContextSentences(doc, spec.contextPatterns);
  if (contextSentences.length === 0) {
    return { id: spec.id, status: 'ABSENT', detail: 'absent' };
  }

  for (const sentence of contextSentences) {
    if (spec.valuePatterns.some((p) => p.test(sentence))) {
      return { id: spec.id, status: 'PASS', detail: `"${sentence}"` };
    }
  }

  for (const sentence of contextSentences) {
    if (spec.wrongPatterns?.some((p) => p.test(sentence))) {
      return { id: spec.id, status: 'WRONG', detail: `"${sentence}"` };
    }

    if (spec.valueShape === 'duration' && hasDurationValue(sentence)) {
      return { id: spec.id, status: 'WRONG', detail: `"${sentence}"` };
    }

    if (spec.valueShape === 'currency' && hasCompetingCurrencyAssertion(sentence, spec)) {
      return { id: spec.id, status: 'WRONG', detail: `"${sentence}"` };
    }
  }

  const first = contextSentences[0];
  return { id: spec.id, status: 'ABSENT', detail: `absent (context: "${first}")` };
}

function normalizeCurrency(raw: string): string {
  return raw.replace(/[£,\s]/g, '').toLowerCase();
}

function normalizeDuration(raw: string): string {
  const m = raw.match(/\b(\d+)\s*(years?|yrs?|months?)\b/i);
  if (!m) return raw.toLowerCase().trim();
  const unit = m[2].toLowerCase().startsWith('month') ? 'months' : 'years';
  return `${m[1]}-${unit}`;
}

function extractComparableValue(
  spec: DeriveAssertionSpec,
  result: DerivationAssertionResult,
): string | null {
  if (result.status === 'ABSENT') return null;

  const text = result.detail.replace(/^"|"$/g, '');
  for (const pat of spec.valuePatterns) {
    const m = text.match(pat);
    if (m) {
      return spec.valueShape === 'currency' ? normalizeCurrency(m[0]) : normalizeDuration(m[0]);
    }
  }
  for (const pat of spec.wrongPatterns ?? []) {
    const m = text.match(pat);
    if (m) {
      return spec.valueShape === 'currency' ? normalizeCurrency(m[0]) : normalizeDuration(m[0]);
    }
  }
  if (spec.valueShape === 'duration' && hasDurationValue(text)) {
    const m = text.match(/\b(?:approximately|about|around|circa|some)?\s*(\d+)\s*(years?|yrs?|months?)\b/i);
    if (m) return normalizeDuration(m[0]);
  }
  if (spec.valueShape === 'currency') {
    const m = text.match(/£[\d,]+/);
    if (m) return normalizeCurrency(m[0]);
  }
  return null;
}

function checkContradictions(
  attendanceNote: string,
  summaryText: string,
  attendanceDerive: DerivationAssertionResult[],
  summaryDerive: DerivationAssertionResult[],
): ContradictionResult[] {
  const contradictions: ContradictionResult[] = [];

  for (let i = 0; i < DERIVE_ASSERTIONS.length; i++) {
    const spec = DERIVE_ASSERTIONS[i];
    const att = attendanceDerive[i];
    const sum = summaryDerive[i];
    const attVal = extractComparableValue(spec, att);
    const sumVal = extractComparableValue(spec, sum);
    if (attVal && sumVal && attVal !== sumVal) {
      contradictions.push({
        id: spec.id,
        attendanceSentence: att.detail,
        summarySentence: sum.detail,
      });
    }
  }

  const attNov = [...new Set((attendanceNote.match(/November\s+202\d/gi) ?? []).map((s) => s.toLowerCase()))];
  const sumNov = [...new Set((summaryText.match(/November\s+202\d/gi) ?? []).map((s) => s.toLowerCase()))];
  if (attNov.length > 0 && sumNov.length > 0 && attNov[0] !== sumNov[0]) {
    contradictions.push({
      id: 'separation-date',
      attendanceSentence: attNov.join(', '),
      summarySentence: sumNov.join(', '),
    });
  }

  const attMarriageYears = attendanceNote.match(
    /(?:marriage|married).{0,80}(?:subsist\w*|lasted).{0,40}(?:approximately|about)\s+(\d+)\s+years?/i,
  );
  const sumMarriageYears = summaryText.match(
    /(?:marriage|married).{0,80}(?:subsist\w*|lasted).{0,40}(?:approximately|about)\s+(\d+)\s+years?/i,
  );
  if (
    attMarriageYears &&
    sumMarriageYears &&
    attMarriageYears[1] !== sumMarriageYears[1] &&
    !contradictions.some((c) => c.id === 'marriage-duration' || c.id === 'marriage-duration-years')
  ) {
    contradictions.push({
      id: 'marriage-duration-years',
      attendanceSentence: attMarriageYears[0],
      summarySentence: sumMarriageYears[0],
    });
  }

  return contradictions;
}

export function extractSectionHeadings(doc: string): string[] {
  const headings: string[] = [];
  const re = /^\s*\*\*(\d+\.\s+[^*]+)\*\*/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc)) !== null) {
    headings.push(m[1].trim());
  }
  return headings;
}

function checkBennettDissipationHeading(
  attendanceNote: string,
  headings: string[],
): DerivationReport['bennettDissipationHeading'] {
  const jointAccountHeading = headings.find(
    (h) =>
      /joint account|£15|15,?000|fifteen thousand/i.test(h) ||
      (/dissipation|unexplained/i.test(h) && /fund|account|money/i.test(h)),
  );

  if (!jointAccountHeading) {
    const sectionMatch = attendanceNote.match(/\*\*\d+\.\s+([^*]+)\*\*/g);
    if (sectionMatch) {
      for (const raw of sectionMatch) {
        const inner = raw.replace(/\*\*/g, '');
        if (/joint account|dissipation|15,?000/i.test(inner)) {
          if (DISSIPATION_HEADING_TERMS.test(inner)) {
            return { status: 'HARD_FAIL', heading: inner.trim() };
          }
        }
      }
    }
    return { status: 'CLEAN' };
  }

  if (DISSIPATION_HEADING_TERMS.test(jointAccountHeading)) {
    return { status: 'HARD_FAIL', heading: jointAccountHeading };
  }
  return { status: 'CLEAN' };
}

function checkAdjudicatingHeadingWarnings(headings: string[]): string[] {
  const warnings: string[] = [];
  for (const heading of headings) {
    if (!ADJUDICATING_TERMS.test(heading)) continue;
    if (HEDGE_TERMS.test(heading)) continue;
    warnings.push(heading);
  }
  return warnings;
}

function collectAttributionDiagnostic(attendanceNote: string, summaryText: string): string[] {
  const combined = `${attendanceNote}\n${summaryText}`;
  return splitSentences(combined).filter(
    (s) => ATTRIBUTION_VERBS.test(s) && /\bclient\b/i.test(s),
  );
}

function extractPensionSection(doc: string): string {
  const match = doc.match(/\*\*\d+\.\s+[^*]*PENSION[^*]*\*\*[\s\S]*?(?=\n\*\*\d+\.|$)/i);
  if (match) return match[0];
  const idx = doc.search(/PENSION ASSETS/i);
  if (idx >= 0) return doc.slice(idx, idx + 2500);
  return '';
}

function checkPensionMechanismAttribution(
  attendanceNote: string,
  summaryText: string,
): DerivationReport['pensionMechanismAttribution'] {
  const pensionSection = extractPensionSection(`${attendanceNote}\n${summaryText}`);
  if (!pensionSection) return { status: 'CLEAN' };

  const hardPatterns = [
    /client.{0,120}(instructed|directed|agreed to).{0,120}pension sharing order/i,
    /client.{0,80}confirmed.{0,80}wishes to pursue.{0,80}(pension sharing order|this approach)/i,
    /instructed.{0,80}pension sharing order/i,
    /wishes to pursue this approach/i,
  ];

  for (const sentence of splitSentences(pensionSection)) {
    if (!ATTRIBUTION_VERBS.test(sentence)) continue;
    if (hardPatterns.some((p) => p.test(sentence))) {
      return { status: 'HARD_FAIL', detail: sentence };
    }
    if (
      /confirmed.{0,60}wishes to pursue this approach/i.test(sentence) &&
      /pension|clean break|sever/i.test(pensionSection)
    ) {
      return { status: 'HARD_FAIL', detail: sentence };
    }
  }

  return { status: 'CLEAN' };
}

function isNegatedSentence(sentence: string): boolean {
  return /\b(not|never|cannot|can't|does not|doesn't|do not|don't|is not|isn't|was not|wasn't|nor|neither)\b/i.test(
    sentence,
  );
}

function isNegatedNonMatrimonialClaim(sentence: string): boolean {
  if (isNegatedSentence(sentence)) return true;
  return /more difficult to argue|harder to argue|difficult to argue|cannot be treated|should not be treated|not straightforwardly|weaken the argument|not determinative/i.test(
    sentence,
  );
}

function depositInSentence(sentence: string): boolean {
  return (
    (/£?\s*40,?000|forty thousand/i.test(sentence) || /\bdeposit\b/i.test(sentence)) &&
    (/father|dad|parent|gift|£40/i.test(sentence) || /deposit/i.test(sentence))
  );
}

function findJointAccountSection(attendanceNote: string): string {
  const lower = attendanceNote.toLowerCase();
  const needles = [
    'stop paying into the joint account',
    'joint account',
    'also stop paying',
  ];
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx >= 0) {
      const start = Math.max(0, attendanceNote.lastIndexOf('\n\n', idx));
      const end = attendanceNote.indexOf('\n\n', idx + needle.length);
      return attendanceNote.slice(start, end >= 0 ? end : undefined).trim();
    }
  }
  const sections = attendanceNote.split(/\n(?=\*\*[A-Z])/);
  for (const section of sections) {
    if (/joint account/i.test(section)) return section.trim();
  }
  return '';
}

function checkNetGrossTrap(attendanceNote: string): DerivationReport['netGrossTrap'] {
  const differentialPatterns = [
    /£?\s*33,?000\b/i,
    /33,?000\s*(?:per annum|p\.?a\.?|a year|annually)/i,
  ];

  for (const pat of differentialPatterns) {
    const m = attendanceNote.match(pat);
    if (m && m.index !== undefined) {
      const sentence =
        splitSentences(attendanceNote).find((s) => pat.test(s)) ??
        sentenceForIndex(attendanceNote, m.index);
      return { status: 'warning', sentence };
    }
  }

  const comparesMonthly =
    /(?:£?\s*3,?500|three and a half).{0,120}(?:£?\s*75,?000|seventy[- ]five|75,?000)/i.test(
      attendanceNote,
    ) ||
    /(?:£?\s*75,?000|seventy[- ]five).{0,120}(?:£?\s*3,?500|three and a half)/i.test(
      attendanceNote,
    );
  if (comparesMonthly && !/gross|net|after tax|before tax/i.test(attendanceNote)) {
    const idx = attendanceNote.search(/3,?500|75,?000|seventy[- ]five/i);
    if (idx >= 0) {
      return {
        status: 'warning',
        sentence: sentenceForIndex(attendanceNote, idx),
      };
    }
  }

  return { status: 'clean' };
}

function checkMustCharacterise(attendanceNote: string): DerivationAssertionResult[] {
  const note = attendanceNote;
  const lower = note.toLowerCase();

  const checks: Array<{ id: string; pass: boolean; failDetail: string }> = [
    {
      id: 'matrimonial home',
      pass: lower.includes('matrimonial home'),
      failDetail: 'term absent',
    },
    {
      id: 'irretrievable breakdown',
      pass: lower.includes('irretrievably') || /irretrievable breakdown/i.test(note),
      failDetail: 'term absent',
    },
    {
      id: 'cash equivalent transfer value or CETV',
      pass: /cash equivalent transfer value|\bcetv\b/i.test(note),
      failDetail: 'term absent',
    },
    {
      id: 'pension sharing order',
      pass: /pension sharing order/i.test(note),
      failDetail: note.match(/splitting a pension|share of hers moves|split.*pension/i)
        ? `note says: "${extractSurrounding(note, note.search(/splitting a pension|share of hers moves|split.*pension/i) ?? 0)}"`
        : 'term absent (paraphrase not accepted)',
    },
    {
      id: 'periodical payments',
      pass: /periodical payments/i.test(note),
      failDetail: 'term absent',
    },
    {
      id: 'clean break',
      pass: /clean break/i.test(note),
      failDetail: 'term absent',
    },
    {
      id: 'full and frank disclosure',
      pass: /full and frank disclosure/i.test(note),
      failDetail: 'term absent',
    },
    {
      id: 'section 25 or Matrimonial Causes Act 1973',
      pass: /section\s*25\b|\bs\.?\s*25\b|matrimonial causes act 1973/i.test(note),
      failDetail: 'term absent',
    },
  ];

  return checks.map((c) => {
    if (c.pass) {
      return { id: c.id, status: 'PASS' as const, detail: 'present' };
    }
    const termIdx = note.toLowerCase().indexOf(c.id.split(' ')[0].toLowerCase());
    const detail =
      termIdx >= 0
        ? `${c.failDetail}; context: "${extractSurrounding(note, termIdx)}"`
        : c.failDetail;
    return { id: c.id, status: 'FAIL' as const, detail };
  });
}

function checkMustRecord(attendanceNote: string): DerivationAssertionResult[] {
  const lower = attendanceNote.toLowerCase();

  const missingMoney =
    (/£?\s*15,?000|fifteen thousand/i.test(attendanceNote) &&
      /joint account/i.test(lower) &&
      (/credit card/i.test(lower) || /paid off/i.test(lower)) &&
      (/no evidence|not produced|without evidence|won't show|will not show|has not produced|no statement/i.test(
        lower,
      ) ||
        /disclosure/i.test(lower))) ||
    (/missing|disappeared|gone/i.test(lower) &&
      /15,?000|fifteen thousand/i.test(attendanceNote) &&
      /joint account/i.test(lower));

  const childrenConcern =
    (/relationship with the children|concern about.*children|children.*concern/i.test(lower) ||
      /raised a concern/i.test(lower)) &&
    (/ellie|daughter/i.test(lower) ||
      /wouldn't look|would not look|different with me|behaviour|behavior/i.test(lower));

  const missingMoneyIdx = attendanceNote.search(/£?\s*15,?000|fifteen thousand|joint account/i);
  const childrenIdx = attendanceNote.search(/children|ellie|daughter|raised a concern/i);

  return [
    {
      id: 'missing-£15,000-from-joint-account',
      status: missingMoney ? 'PASS' : 'FAIL',
      detail: missingMoney
        ? 'recorded'
        : missingMoneyIdx >= 0
          ? `concern not adequately recorded; context: "${extractSurrounding(attendanceNote, missingMoneyIdx)}"`
          : 'concern not adequately recorded',
    },
    {
      id: 'children-relationship-concern',
      status: childrenConcern ? 'PASS' : 'FAIL',
      detail: childrenConcern
        ? 'recorded'
        : childrenIdx >= 0
          ? `concern not adequately recorded; context: "${extractSurrounding(attendanceNote, childrenIdx)}"`
          : 'concern not adequately recorded',
    },
  ];
}

function checkMustNotSay(
  attendanceNote: string,
  summaryText: string,
): DerivationReport['mustNotSay'] {
  const combined = `${attendanceNote}\n${summaryText}`;

  const alienationPat = /parental alienation|\balienation\b/i;
  const alienationHit = combined.match(alienationPat);
  const parentalAlienation = alienationHit
    ? {
        status: 'HARD_FAIL' as const,
        detail: sentenceForIndex(combined, alienationHit.index ?? 0),
      }
    : { status: 'CLEAN' as const, detail: 'CLEAN' };

  const dissipationTerms =
    /\b(dissipated|concealed|misappropriated|misappropriation|hid the funds|took the funds|stole|theft)\b/i;
  const wifeContext = /(sophie|wife|she|her).{0,80}(dissipated|concealed|misappropriated|hid|took|stole)/i;
  const dissipationContext =
    /(dissipated|concealed|misappropriated|hid|took|stole).{0,80}(sophie|wife|funds|money|£15|15,?000)/i;

  let dissipationFinding: DerivationReport['mustNotSay']['dissipationFinding'] = {
    status: 'CLEAN',
    detail: 'CLEAN',
  };

  for (const sentence of splitSentences(combined)) {
    if (
      dissipationTerms.test(sentence) &&
      (wifeContext.test(sentence) ||
        dissipationContext.test(sentence) ||
        (/£?\s*15,?000|fifteen thousand|joint account/i.test(sentence) &&
          /(sophie|wife|she|her)/i.test(sentence)))
    ) {
      dissipationFinding = { status: 'HARD_FAIL', detail: sentence };
      break;
    }
  }

  return { parentalAlienation, dissipationFinding };
}

function checkMustNotCharacterise(
  attendanceNote: string,
  summaryText: string,
): DerivationReport['mustNotCharacterise'] {
  const combined = `${attendanceNote}\n${summaryText}`;
  const trapPat = /(?:pre[- ]marital|non[- ]matrimonial|predating the marriage)/i;

  for (const sentence of splitSentences(combined)) {
    if (!trapPat.test(sentence) || !depositInSentence(sentence)) continue;

    if (isNegatedNonMatrimonialClaim(sentence)) {
      return { status: 'WARNING', detail: sentence };
    }

    return { status: 'HARD_FAIL', detail: sentence };
  }

  return { status: 'CLEAN', detail: 'CLEAN' };
}

function checkReasoningGap(attendanceNote: string): DerivationReport['reasoningGap'] {
  const section = findJointAccountSection(attendanceNote);
  if (!section) {
    return { markerPresent: false, sectionText: '_Joint-account advice section not located._' };
  }
  const markerPresent = /<!--\s*REASONING_GAP/i.test(section) || /REASONING_GAP/i.test(section);
  return markerPresent ? { markerPresent: true } : { markerPresent: false, sectionText: section };
}

export function evaluateDerivationAssertions(
  attendanceNote: string,
  summaryText: string,
): DerivationReport {
  const mustDerive = DERIVE_ASSERTIONS.map((spec) => assertDerivedWithContext(spec, attendanceNote));
  const mustDeriveSummary = DERIVE_ASSERTIONS.map((spec) =>
    assertDerivedWithContext(spec, summaryText),
  );
  const contradictions = checkContradictions(
    attendanceNote,
    summaryText,
    mustDerive,
    mustDeriveSummary,
  );

  const attendanceHeadings = extractSectionHeadings(attendanceNote);
  const summaryHeadings = extractSectionHeadings(summaryText);

  const report: DerivationReport = {
    mustDerive,
    mustDeriveSummary,
    contradictions,
    netGrossTrap: checkNetGrossTrap(attendanceNote),
    mustCharacterise: checkMustCharacterise(attendanceNote),
    mustRecord: checkMustRecord(attendanceNote),
    mustNotSay: checkMustNotSay(attendanceNote, summaryText),
    mustNotCharacterise: checkMustNotCharacterise(attendanceNote, summaryText),
    sectionHeadings: { attendance: attendanceHeadings, summary: summaryHeadings },
    bennettDissipationHeading: checkBennettDissipationHeading(attendanceNote, attendanceHeadings),
    adjudicatingHeadingWarnings: [
      ...checkAdjudicatingHeadingWarnings(attendanceHeadings),
      ...checkAdjudicatingHeadingWarnings(summaryHeadings),
    ],
    attributionDiagnostic: collectAttributionDiagnostic(attendanceNote, summaryText),
    pensionMechanismAttribution: checkPensionMechanismAttribution(attendanceNote, summaryText),
    reasoningGap: checkReasoningGap(attendanceNote),
    hardGateFailures: [],
  };

  for (const d of mustDerive) {
    if (d.status === 'WRONG') {
      report.hardGateFailures.push(`Bennett MUST-DERIVE WRONG: ${d.id} — ${d.detail}`);
    }
  }
  for (const c of contradictions) {
    report.hardGateFailures.push(
      `Bennett CONTRADICTION: ${c.id} — attendance: ${c.attendanceSentence} | summary: ${c.summarySentence}`,
    );
  }
  if (report.mustNotSay.parentalAlienation.status === 'HARD_FAIL') {
    report.hardGateFailures.push(
      `Bennett MUST-NOT-SAY: parental alienation / alienation — ${report.mustNotSay.parentalAlienation.detail}`,
    );
  }
  if (report.mustNotSay.dissipationFinding.status === 'HARD_FAIL') {
    report.hardGateFailures.push(
      `Bennett MUST-NOT-SAY: dissipation finding against wife — ${report.mustNotSay.dissipationFinding.detail}`,
    );
  }
  if (report.mustNotCharacterise.status === 'HARD_FAIL') {
    report.hardGateFailures.push(
      `Bennett MUST-NOT-CHARACTERISE: deposit described as pre-marital/non-matrimonial — ${report.mustNotCharacterise.detail}`,
    );
  }
  if (report.bennettDissipationHeading.status === 'HARD_FAIL') {
    report.hardGateFailures.push(
      `Bennett adjudicating heading: ${report.bennettDissipationHeading.heading}`,
    );
  }
  if (report.pensionMechanismAttribution.status === 'HARD_FAIL') {
    report.hardGateFailures.push(
      `Bennett MUST-NOT-ATTRIBUTE (pension mechanism): ${report.pensionMechanismAttribution.detail}`,
    );
  }

  return report;
}

export function formatDerivationReportLines(report: DerivationReport): string[] {
  const derivePassed = report.mustDerive.filter((a) => a.status === 'PASS').length;
  const deriveWrong = report.mustDerive.filter((a) => a.status === 'WRONG').length;
  const deriveAbsent = report.mustDerive.filter((a) => a.status === 'ABSENT').length;
  const charPassed = report.mustCharacterise.filter((a) => a.status === 'PASS').length;
  const recordPassed = report.mustRecord.filter((a) => a.status === 'PASS').length;

  const lines: string[] = [
    'DERIVATION TEST — Craig Bennett (lay speech)',
    '',
    `MUST-DERIVE (attendance)  ${report.mustDerive.length} assertions    ${derivePassed} passed, ${deriveWrong} wrong, ${deriveAbsent} absent`,
  ];

  for (const a of report.mustDerive) {
    const pad = a.id.padEnd(26);
    lines.push(`  ${pad}${a.status.padEnd(6)} ${a.detail}`);
  }

  lines.push('');
  lines.push('MUST-DERIVE (summary)   report-only');
  for (const a of report.mustDeriveSummary) {
    const pad = a.id.padEnd(26);
    lines.push(`  ${pad}${a.status.padEnd(6)} ${a.detail}`);
  }

  lines.push('');
  if (report.contradictions.length === 0) {
    lines.push('CROSS-DOCUMENT          no contradictions');
  } else {
    lines.push(`CROSS-DOCUMENT          ${report.contradictions.length} CONTRADICTION(S)`);
    for (const c of report.contradictions) {
      lines.push(`  ${c.id}:`);
      lines.push(`    attendance: ${c.attendanceSentence}`);
      lines.push(`    summary:    ${c.summarySentence}`);
    }
  }

  lines.push('');
  if (report.netGrossTrap.status === 'clean') {
    lines.push('NET/GROSS TRAP         clean');
  } else {
    lines.push(`NET/GROSS TRAP         WARNING: "${report.netGrossTrap.sentence ?? ''}"`);
  }

  lines.push('');
  lines.push(
    `MUST-CHARACTERISE      ${report.mustCharacterise.length} assertions    ${charPassed} passed`,
  );
  for (const a of report.mustCharacterise) {
    const pad = a.id.padEnd(26);
    lines.push(`  ${pad}${a.status.padEnd(6)} ${a.detail}`);
  }

  lines.push('');
  lines.push(`MUST-RECORD            ${report.mustRecord.length} assertions    ${recordPassed} passed`);
  for (const a of report.mustRecord) {
    const pad = a.id.padEnd(26);
    lines.push(`  ${pad}${a.status.padEnd(6)} ${a.detail}`);
  }

  lines.push('');
  lines.push(
    `MUST-NOT-SAY           parental alienation:  ${report.mustNotSay.parentalAlienation.status === 'CLEAN' ? 'CLEAN' : '*** HARD FAIL ***'}`,
  );
  if (report.mustNotSay.parentalAlienation.status === 'HARD_FAIL') {
    lines.push(`                       sentence: "${report.mustNotSay.parentalAlienation.detail}"`);
  }
  lines.push(
    `                       dissipation finding:  ${report.mustNotSay.dissipationFinding.status === 'CLEAN' ? 'CLEAN' : '*** HARD FAIL ***'}`,
  );
  if (report.mustNotSay.dissipationFinding.status === 'HARD_FAIL') {
    lines.push(`                       sentence: "${report.mustNotSay.dissipationFinding.detail}"`);
  }

  lines.push('');
  const depositLabel =
    report.mustNotCharacterise.status === 'CLEAN'
      ? 'CLEAN'
      : report.mustNotCharacterise.status === 'WARNING'
        ? 'WARNING (review sentence)'
        : '*** HARD FAIL ***';
  lines.push(`MUST-NOT-CHARACTERISE  deposit pre-marital:  ${depositLabel}`);
  if (report.mustNotCharacterise.status !== 'CLEAN') {
    lines.push(`                       sentence: "${report.mustNotCharacterise.detail}"`);
  }

  lines.push('');
  lines.push('SECTION HEADINGS (attendance)');
  for (const h of report.sectionHeadings.attendance) {
    lines.push(`  - ${h}`);
  }
  lines.push('SECTION HEADINGS (summary)');
  for (const h of report.sectionHeadings.summary) {
    lines.push(`  - ${h}`);
  }

  lines.push('');
  lines.push(
    `£15,000 HEADING GATE     ${report.bennettDissipationHeading.status === 'CLEAN' ? 'CLEAN' : '*** HARD FAIL ***'}`,
  );
  if (report.bennettDissipationHeading.heading) {
    lines.push(`                       heading: "${report.bennettDissipationHeading.heading}"`);
  }

  lines.push('');
  if (report.adjudicatingHeadingWarnings.length === 0) {
    lines.push('ADJUDICATING HEADINGS  none flagged');
  } else {
    lines.push(`ADJUDICATING HEADINGS  ${report.adjudicatingHeadingWarnings.length} warning(s)`);
    for (const h of report.adjudicatingHeadingWarnings) {
      lines.push(`  - "${h}"`);
    }
  }

  lines.push('');
  lines.push(`ATTRIBUTION DIAGNOSTIC ${report.attributionDiagnostic.length} sentence(s)`);
  for (const s of report.attributionDiagnostic) {
    lines.push(`  - "${s}"`);
  }

  lines.push('');
  lines.push(
    `PENSION MECHANISM GATE ${report.pensionMechanismAttribution.status === 'CLEAN' ? 'CLEAN' : '*** HARD FAIL ***'}`,
  );
  if (report.pensionMechanismAttribution.detail) {
    lines.push(`                       sentence: "${report.pensionMechanismAttribution.detail}"`);
  }

  lines.push('');
  if (report.reasoningGap.markerPresent) {
    lines.push('REASONING GAP          marker present');
  } else {
    lines.push('REASONING GAP          ABSENT (section printed)');
    lines.push('');
    lines.push(report.reasoningGap.sectionText ?? '_Section not found._');
  }

  return lines;
}
