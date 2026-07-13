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
  /** Corporate fixture only: target for section-targeted non-factual verifier plants. */
  nonFactualPlantTarget?: boolean;
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

function familyDerivationLaySpeechBody(): string {
  return `[Speaker A — Solicitor]: Craig, thanks for coming in. Before we start, I'd like to record this so I can write up an accurate note for the file. Everything stays confidential, same as if I were writing it by hand. Are you happy with that?
[Speaker B — Client]: Yeah, that's fine.
[Speaker A — Solicitor]: Thank you. I'm Michael Reyes, I'm a solicitor and a partner here, and I'm regulated by the Solicitors Regulation Authority. You've got the terms of business letter, so you'll have seen how to complain if you ever need to. One thing I ask everyone. Is there anything about your health, or your circumstances, that means you'd want me to do things differently for you?
[Speaker B — Client]: No, I'm all right. Bit tired, that's all.
[Speaker A — Solicitor]: Understood. Let's start at the beginning. Tell me about you and Sophie.
[Speaker B — Client]: So we met in 2009. Been together ever since. We got married in June 2015.
[Speaker A — Solicitor]: And when did things end?
[Speaker B — Client]: I moved out in November last year. Just before Bonfire Night.
[Speaker A — Solicitor]: And is that it? Is there any chance of the two of you working it out?
[Speaker B — Client]: No. It's done. There's no coming back from it, honestly.
[Speaker A — Solicitor]: All right. And the children, tell me about them.
[Speaker B — Client]: Ellie's eleven. Tom's eight. He's the young one.
[Speaker A — Solicitor]: Right. Let's talk about the house.
[Speaker B — Client]: So the house. It's in both our names. The estate agent came round and said about six eighty.
[Speaker A — Solicitor]: Six hundred and eighty thousand?
[Speaker B — Client]: Yeah. And there's still about two hundred and ten thousand left on the mortgage.
[Speaker A — Solicitor]: And who's living there?
[Speaker B — Client]: Sophie and the kids. I'm at my brother's.
[Speaker A — Solicitor]: And who's paying the mortgage?
[Speaker B — Client]: Me. Still. And I've been giving her money on top.
[Speaker A — Solicitor]: How much on top?
[Speaker B — Client]: Eight hundred a month. I can't keep doing it, honestly, I'm running on fumes.
[Speaker A — Solicitor]: And what do you earn?
[Speaker B — Client]: I bring home about three and a half grand a month. That's after tax.
[Speaker A — Solicitor]: And Sophie?
[Speaker B — Client]: She's on about seventy-five. She's an operations manager. She's always earned more than me, that's never bothered me.
[Speaker A — Solicitor]: And pensions?
[Speaker B — Client]: So hers is the big one. She got that transfer value thing done and it came back at three hundred and twenty. Mine's about ninety. I've moved around a lot, I've got bits everywhere.
[Speaker A — Solicitor]: All right. That's useful. Now, the deposit on the house. Where did that come from?
[Speaker B — Client]: My dad. He gave us forty grand for the deposit. That was 2016, I think. Maybe early 2017. He said it was a gift, but honestly I've always felt like I owed him.
[Speaker A — Solicitor]: Was anything written down?
[Speaker B — Client]: No. Nothing. It was just my dad.
[Speaker A — Solicitor]: All right. I'm going to be straight with you about that, because I don't want you to have false hope. It matters that your father gave it, but it was given after you were married, and there's nothing in writing. That makes it harder to argue it should come off the top for you, and I want you to hear that from me now rather than in six months. It's still worth raising, but it isn't the trump card you might be hoping for.
[Speaker B — Client]: Right. Okay.
[Speaker A — Solicitor]: Now. Anything else about the money that's bothering you?
[Speaker B — Client]: Yeah, actually. There was fifteen grand in the joint account in September. And it's gone. All of it.
[Speaker A — Solicitor]: Gone where?
[Speaker B — Client]: She says she paid off a credit card. But she won't show me anything. Won't send me a statement, won't tell me which card. And I don't, look, I'm not saying she's stolen it. But I don't know where it's gone and she won't tell me.
[Speaker A — Solicitor]: All right. I'm going to note down that you've raised that, and I'm not going to draw a conclusion about it today and nor should you. What we do is we deal with it through disclosure. She has to put everything on the table, everything, and if that money went somewhere it has to be explained. If it can't be, that becomes a very different conversation. But we don't accuse anybody of anything until we've seen the paperwork.
[Speaker B — Client]: Yeah. That's fair.
[Speaker A — Solicitor]: Anything else?
[Speaker B — Client]: There is, and I don't really know how to say it. She's been saying things to the kids. About me. Ellie came back last time and she was different with me. Wouldn't look at me.
[Speaker A — Solicitor]: That sounds hard.
[Speaker B — Client]: It is.
[Speaker A — Solicitor]: I'm going to write down that you've raised a concern about your relationship with the children. I'm deliberately not going to put a label on it, because labels in these situations tend to become weapons, and I'd rather have the facts first. If it carries on, we'll deal with it properly.
[Speaker B — Client]: Okay.
[Speaker A — Solicitor]: Now, the court. If we can't agree this, a judge decides. And a judge has to look at a whole list of things: how long you were married, what you each earn, what you each need going forward, what the children need, what each of you put in. The children's needs come first, always. And I'll tell you now, the thing that will drive this case more than anything is that Tom is eight and Ellie is eleven, and they need a roof, and so do you.
[Speaker B — Client]: So what does that mean for the house?
[Speaker A — Solicitor]: In practice it probably means both of you need somewhere the children can live properly. Which affects how the house gets split, and it might mean the house doesn't get sold straight away.
[Speaker B — Client]: And what about the pensions? Hers is huge compared to mine.
[Speaker A — Solicitor]: It is, and that's a real point in your favour. There's a way of splitting a pension so a share of hers moves into your name. That's often the thing that lets us stop the monthly payments altogether, and I think that's what you want, isn't it? You don't want to be tied to her for the next fifteen years.
[Speaker B — Client]: God, no. I want it finished.
[Speaker A — Solicitor]: Then that's what we aim for.
[Speaker B — Client]: And what about the money I'm paying her?
[Speaker A — Solicitor]: Stop paying the mortgage. Pay her direct instead.
[Speaker B — Client]: Why?
[Speaker A — Solicitor]: Because at the moment you're paying the mortgage on a house she lives in, and paying her on top, and nobody is writing any of it down in your favour. If you pay her direct, it's visible, it's recorded, and a judge can take it into account. As it stands you're subsidising her and getting no credit for it.
[Speaker B — Client]: Right. That makes sense.
[Speaker A — Solicitor]: Also stop paying into the joint account.
[Speaker B — Client]: Okay.
[Speaker A — Solicitor]: Now, there's a hearing listed. Fourteenth of May.
[Speaker B — Client]: That's quick.
[Speaker A — Solicitor]: It is. So there are things we have to do before then. I need twelve months of bank statements from you, and your pension paperwork. All of it, including the bits you've forgotten about.
[Speaker B — Client]: When do you need them?
[Speaker A — Solicitor]: By the end of the month.
[Speaker B — Client]: All right.
[Speaker A — Solicitor]: And I want you to send me a copy of your father's bank statement showing that forty thousand leaving his account, if he'll give it to you.
[Speaker B — Client]: I'll ask him tonight.
[Speaker A — Solicitor]: Good. On my side, I'm going to write to the other side proposing we sit down and try to sort this out before the hearing. I'll get that letter out by close of business on Friday, you have my word on that. And I'll draft you a proposal to look at.
[Speaker B — Client]: Do you think she'll go for it?
[Speaker A — Solicitor]: I don't know. But it costs us nothing to try, and if she refuses, that goes in front of the judge too.
[Speaker B — Client]: Okay.
[Speaker A — Solicitor]: Do you want to talk about my fees today, or shall I put it in writing?
[Speaker B — Client]: In writing. I can't take any more in today, to be honest.
[Speaker A — Solicitor]: In writing then. Let's speak Thursday. Half three?
[Speaker B — Client]: Half three Thursday's fine.
[Speaker A — Solicitor]: Good. We'll get there, Craig.
[Speaker B — Client]: Thanks.`;
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
    id: 'family-derivation-lay-speech',
    label: 'Family: Derivation Test (Lay Speech)',
    practiceArea: 'family_divorce_financial',
    metadata: {
      title: 'Bennett v Bennett: Financial Remedy Conference',
      clientName: 'Craig Bennett',
      matterReference: 'BENNETT/FIN/2026/0203',
      recordingDate: '2026-03-16',
    },
    rawTranscript: familyDerivationLaySpeechBody(),
    expectedActionItems: [
      { descriptionHint: 'bank statements', assignee: 'Client' },
      { descriptionHint: 'pension paperwork', assignee: 'Client' },
      { descriptionHint: "father's bank statement", assignee: 'Client' },
      { descriptionHint: 'letter to the other side', assignee: 'Solicitor' },
      { descriptionHint: 'proposal', assignee: 'Solicitor' },
    ],
    expectedUndertakings: [{ wordingHint: 'letter out by close of business on Friday' }],
    forbiddenExtractionHints: [
      'parental alienation',
      'dissipated the funds',
      'pre-marital deposit',
      'Cayman Islands trust',
    ],
  },
  {
    id: 'corporate-fiduciary-duty',
    label: 'Corporate: Fiduciary Duty / Financial Crime Conference',
    practiceArea: 'corporate_commercial',
    nonFactualPlantTarget: true,
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
