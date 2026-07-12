/**
 * Fabricated UK legal meeting transcripts for note-safety harness ONLY.
 * Not based on any real matter or person.
 * Copied from shadow-compare-transcripts.ts (no server dependencies).
 */

export interface SyntheticTranscriptSpec {
  id: string;
  label: string;
  practiceArea: 'family_divorce_financial' | 'immigration' | 'corporate_commercial';
  metadata: {
    title: string;
    clientName: string;
    matterReference: string;
    recordingDate: string;
  };
  /** Raw transcript (includes deliberate ASR-style errors for correction testing). */
  rawTranscript: string;
  /** Ground truth for extraction evaluation — phrases that MUST appear in transcript. */
  expectedActionItems: Array<{ descriptionHint: string; assignee: 'Solicitor' | 'Client' }>;
  expectedUndertakings: Array<{ wordingHint: string }>;
  /** AML-relevant phrases present in transcript (fiduciary transcript only). */
  expectedAmlSignals?: string[];
  /** Phrases that must NOT appear in extractions (invented items). */
  forbiddenExtractionHints: string[];
}

const CONSENT_PREFIX = `[Speaker A — Solicitor]: Before we begin, I need to confirm you consent to this meeting being recorded for the purpose of preparing an attendance note. Do you agree?
[Speaker B — Client]: Yes, I consent to the recording.
[Speaker A — Solicitor]: Thank you. This recording is stored securely in accordance with our data protection policy.
`;

function familyFinancialRemedyBody(): string {
  return `
[Speaker A — Solicitor]: Good morning. This is our financial remedy conference in matter reference HARRIS/FIN/2026/0142. Today is 10 March 2026. The meeting started at 10:30 and we expect about ninety minutes. We are at our Manchester office, Conference Room 3. I am Sarah Mitchell, associate solicitor.
[Speaker B — Client]: Good morning. I'm Jon Harris. My ex-wife is Emma Harris. We married in August 2014 and separated in March 2026. We are discussing the matrimonial home at 14 Linden Avenue, Didsbury — value about four hundred and fifty thousand pounds — and my NHS pension CETV of roughly one hundred and twenty thousand pounds.
[Speaker A — Solicitor]: Thank you. For Form E purposes, you mentioned mortgage redemption of sixty-two thousand pounds on Linden Avenue and joint savings of eighteen thousand four hundred pounds in the Halifax account ending 3312.
[Speaker B — Client]: Yes. Emma wants a fifty-fifty split but I contributed the deposit of ninety-five thousand from my inheritance in two thousand and twelve. I am worried about spousal maintenance because she earns thirty-eight thousand as a teacher and I earn one hundred and five thousand as a consultant.
[Speaker A — Solicitor]: I advised the client that Section 25 Matrimonial Causes Act 1973 factors include needs, resources, and the standard of living during marriage, having considered the disparity in incomes and the deposit contribution argument you raised.
[Speaker B — Client]: What about the FDR on 22 April 2026 at the Manchester Family Court?
[Speaker A — Solicitor]: I advised the client to prepare updated bank statements for the twelve months to March 2026 and pension statements for both parties before FDR. Without those, our without prejudice proposal lacks credibility.
[Speaker B — Client]: I can gather my bank statements and the Nationwide joint account statements by 24 March 2026.
[Speaker A — Solicitor]: I advised the client that a clean break with a pension sharing order may be preferable to ongoing periodical payments, having considered Emma's earning capacity.
[Speaker B — Client]: Emma's solicitor proposed she keep Linden Avenue and I take my pension intact. I do not agree.
[Speaker A — Solicitor]: I advised the client that we should respond with a counter-proposal before 17 March 2026, having considered the liquidity issues if you retain the property and pay a lump sum.
[Speaker B — Client]: Please draft that without prejudice letter.
[Speaker A — Solicitor]: I give an undertaking that this firm will send you the Form E checklist and document request list by 15 March 2026.
[Speaker B — Client]: Thank you. Also, should I disclose the bonus of twenty-two thousand pounds received in January 2026?
[Speaker A — Solicitor]: I advised the client that all material changes in financial circumstances must be disclosed in Form E, having considered the duty of full and frank disclosure.
[Speaker B — Client]: Understood. Next steps?
[Speaker A — Solicitor]: You will gather bank statements, pension CETV updates, and mortgage redemption figure by 24 March 2026. I will draft the without prejudice letter by 17 March 2026. We will review at a telephone appointment on 18 March 2026 at 14:00.
[Speaker B — Client]: Agreed.
[Speaker A — Solicitor]: Is there anything else? No further matters. Meeting ended 12:05.
`.trim();
}

function immigrationBody(): string {
  return `
[Speaker A — Solicitor]: This is a case history conference for Mr Amir Hassan, matter reference HASSAN/IMM/2026/0088, on 11 March 2026 at 09:15, Birmingham office. I am David Okonkwo, immigration solicitor.
[Speaker B — Client]: Thank you. My Skilled Worker visa expires on 30 June 2026. My employer is Midlands Digital Ltd, sponsor licence reference SL-992184.
[Speaker A — Solicitor]: You entered the UK on 14 August 2021 with entry clearance as a Skilled Worker. You applied for ILR in January 2026 and received a refusal dated 19 February 2026 citing short absences and a gap in employer confirmation.
[Speaker B — Client]: I was abroad caring for my mother in Lahore from 3 March 2025 to 28 April 2025 — forty-seven days. I have travel stamps and employer email approval.
[Speaker A — Solicitor]: I advised the client that absences over one hundred eighty days in any twelve-month period can affect continuous residence, having considered UKVI guidance and the specific dates you provided.
[Speaker B — Client]: My wife and two children are on dependant visas. We want to avoid disruption to schooling in Solihull.
[Speaker A — Solicitor]: I advised the client that further representations to the Home Office should address the absence explanation, updated employer letter, and proof of residence since 2021, having considered the refusal reasons.
[Speaker B — Client]: The HR director can provide a revised reference by 25 March 2026 confirming continuous employment.
[Speaker A — Solicitor]: I advised the client to obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary before we submit representations.
[Speaker B — Client]: Can we mention Article 8 family life with the children?
[Speaker A — Solicitor]: I advised the client that Article 8 ECHR may be raised proportionately where refusal affects family unity, having considered your dependants' schooling and ties in the UK.
[Speaker B — Client]: What is the deadline for further representations?
[Speaker A — Solicitor]: The refusal letter allows fourteen days from 19 February 2026 — so 5 March 2026 has passed. We must request an extension immediately. I undertake to chase Home Office acknowledgment of our extension request within ten working days of submission.
[Speaker B — Client]: Please submit as soon as possible.
[Speaker A — Solicitor]: You will obtain the employer reference and travel evidence by 25 March 2026. I will draft further representations and submit to UKVI by 28 March 2026, subject to receiving your documents.
[Speaker B — Client]: I will email the passport scans tonight.
[Speaker A — Solicitor]: We will also prepare a witness statement on absences if needed. Next review call 26 March 2026 at 11:00. Meeting ended 10:40.
`.trim();
}

function corporateFiduciaryBody(): string {
  return `
[Speaker A — Solicitor]: Corporate conference regarding alleged breach of fiduciary duty, matter reference NORTHSTAR/CC/2026/0317, 12 March 2026, 15:00, London office. Client is Elena Vasquez, minority shareholder of Northstar Logistics Ltd. I am James Thornton, corporate partner.
[Speaker B — Client]: I suspect the managing director, Mr Colin Marsh, misapplied company funds. Our accountants flagged transfers totalling two hundred and seventy-five thousand pounds from the company account to Marsh Consulting Ltd between September 2025 and January 2026.
[Speaker A — Solicitor]: You said Marsh Consulting is owned by Colin Marsh personally and had no legitimate supplier invoices on file.
[Speaker B — Client]: Correct. There were also three payments of fifteen thousand pounds each to an account in Gibraltar described as "consultancy retainer" with no contract.
[Speaker A — Solicitor]: I advised the client that directors owe duties under Section 172 and Section 174 Companies Act 2006, and unauthorised self-dealing may require board investigation, having considered that you hold eleven per cent of shares and are not a director.
[Speaker B — Client]: I am concerned about source of funds — Marsh told the board the Gibraltar payments were for a freight broker in Turkey but provided no KYC pack.
[Speaker A — Solicitor]: I advised the client that unusual related-party payments and offshore transfers are matters requiring careful review and may raise AML considerations for the company and its advisers, having considered your role as whistleblower rather than decision-maker.
[Speaker B — Client]: I do not want to accuse him of fraud on the record yet, but I need the board informed.
[Speaker A — Solicitor]: I advised the client that a factual briefing note to non-executive directors is appropriate before any criminal allegation, having considered privilege and the need for verified bank statements.
[Speaker B — Client]: I have emails from the finance manager questioning the Marsh Consulting invoices in October 2025.
[Speaker A — Solicitor]: Please preserve all emails and WhatsApp messages. Do not delete anything. I undertake to review the company bank statements you provide and report findings to the board in a privileged note by 20 March 2026.
[Speaker B — Client]: I can upload statements for September 2025 to January 2026 by 16 March 2026.
[Speaker A — Solicitor]: I will instruct a forensic accountant once we have statements. Estimated fee range five to eight thousand pounds plus VAT — subject to partner approval.
[Speaker B — Client]: The suspicious activity may affect our lender, HSBC.
[Speaker A — Solicitor]: I advised the client that if funds were misapplied, the company may need to consider whether a suspicious activity report is required after internal verification — that is a matter for the MLRO, not this meeting's conclusion.
[Speaker B — Client]: Understood — flag for attention, not a finding.
[Speaker A — Solicitor]: Precisely. You will preserve emails and upload bank statements by 16 March 2026. I will review statements and prepare the board briefing by 20 March 2026. Forensic instruction to follow upon approval.
[Speaker B — Client]: Agreed. Meeting ended 16:20.
`.trim();
}

/** Expand body with additional realistic dialogue to exceed ~1024-token cache minimum. */
function expandTranscript(body: string, fillerTopic: string): string {
  const padding = Array.from({ length: 6 }, (_, i) => `
[Speaker A — Solicitor]: On ${fillerTopic} point ${i + 1}, I advised the client to rely only on documents already mentioned and not assume facts not recorded in this session.
[Speaker B — Client]: I confirm that aligns with what we discussed earlier regarding timelines, amounts, and next steps already noted.
[Speaker A — Solicitor]: For the file, the reasoning behind that advice was the need to maintain evidential accuracy before any court or regulator submission.
[Speaker B — Client]: I understand and will follow the document list we agreed.
`).join('\n');
  return `${body}\n${padding}`;
}

export const SYNTHETIC_TRANSCRIPTS: SyntheticTranscriptSpec[] = [
  {
    id: 'family-financial-remedy',
    label: 'Family: Financial Remedy Conference',
    practiceArea: 'family_divorce_financial',
    metadata: {
      title: 'Harris v Harris: Financial Remedy Conference',
      clientName: 'Jon Harris',
      matterReference: 'HARRIS/FIN/2026/0142',
      recordingDate: '2026-03-10',
    },
    rawTranscript: CONSENT_PREFIX + expandTranscript(
      familyFinancialRemedyBody().replace(/four hundred and fifty/g, 'fourty hundred and fifty'),
      'matrimonial asset disclosure',
    ),
    expectedActionItems: [
      { descriptionHint: 'bank statements', assignee: 'Client' },
      { descriptionHint: 'without prejudice letter', assignee: 'Solicitor' },
    ],
    expectedUndertakings: [{ wordingHint: 'Form E checklist' }],
    forbiddenExtractionHints: ['criminal prosecution', 'arrest warrant', 'offshore trust in Jersey'],
  },
  {
    id: 'immigration-case-history',
    label: 'Immigration: Case History Conference',
    practiceArea: 'immigration',
    metadata: {
      title: 'Hassan: Skilled Worker Refusal and Further Representations',
      clientName: 'Amir Hassan',
      matterReference: 'HASSAN/IMM/2026/0088',
      recordingDate: '2026-03-11',
    },
    rawTranscript: CONSENT_PREFIX + expandTranscript(
      immigrationBody().replace(/Amir Hassan/g, 'Amir Hasan').replace(/UKVI/g, 'U K V I'),
      'continuous residence and dependants',
    ),
    expectedActionItems: [
      { descriptionHint: 'employer reference', assignee: 'Client' },
      { descriptionHint: 'further representations', assignee: 'Solicitor' },
    ],
    expectedUndertakings: [{ wordingHint: 'Home Office acknowledgment' }],
    forbiddenExtractionHints: ['deportation order issued', 'visa cancelled yesterday'],
  },
  {
    id: 'corporate-fiduciary-duty',
    label: 'Corporate: Fiduciary Duty / Financial Crime Conference',
    practiceArea: 'corporate_commercial',
    metadata: {
      title: 'Vasquez: Northstar Logistics Ltd Director Misapplication Investigation',
      clientName: 'Elena Vasquez',
      matterReference: 'NORTHSTAR/CC/2026/0317',
      recordingDate: '2026-03-12',
    },
    rawTranscript: CONSENT_PREFIX + expandTranscript(corporateFiduciaryBody(), 'related-party payments and governance'),
    expectedActionItems: [
      { descriptionHint: 'preserve emails', assignee: 'Client' },
      { descriptionHint: 'bank statements', assignee: 'Client' },
      { descriptionHint: 'forensic accountant', assignee: 'Solicitor' },
    ],
    expectedUndertakings: [{ wordingHint: 'review the company bank statements' }],
    expectedAmlSignals: [
      'source of funds',
      'offshore',
      'suspicious activity',
      'misapplied',
      'Gibraltar',
    ],
    forbiddenExtractionHints: [
      'confirmed Colin Marsh committed fraud',
      'guilty of money laundering',
      'SAR filed today',
    ],
  },
];
