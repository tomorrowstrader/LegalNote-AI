# Note Safety Harness Results — Batch 2 (derive-do-not-invent) — Run 2

Generated: 2026-07-11T21:44:15.963Z

**Harness:** OpenAI-only; real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.
**Regression library:** `scripts/verifier-regression-cases.ts`
**Synthetic data only.**

## Hard gate

**Result:** FAIL

- Attendance plants: 9/9 DETECTED (gates commit)
- Summary plants: 9/9 DETECTED (informative)
- Retired spurious warnings gone: NO
- Placeholder misuse still flagged: YES
- Family derive/characterise: NO
- Wrong-client-name regression (injected): FLAGGED
- No em/en dash in model prose: YES
- New spurious on clean notes: 6

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Retired spurious baseline warnings still present (2)
- Family note missing subsistence derivation and/or matrimonial home characterisation
- New spurious warnings on clean notes (6)

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0570 | **Verification:** $0.1555

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: HARRIS/FIN/2026/0142  
Date:           10 March 2026  
Time:           10:30  
Duration:       1 hour 35 minutes  
Time Spent (Units): 16  
Location:       Manchester office, Conference Room 3  
Solicitor:      Sarah Mitchell, Associate Solicitor  

**MATTER:**     Harris v Harris: Financial Remedy Conference  

**CLIENT:**     Jon Harris  

**MATTERS DISCUSSED**

**1. MATRIMONIAL HOME AND FINANCIAL DISCLOSURE**

   What was discussed:
   The client, Jon Harris, disclosed that he and his ex-wife, Emma Harris, married in August 2014 and separated in March 2026. The matrimonial home at 14 Linden Avenue, Didsbury, is valued at approximately £450,000, with a mortgage redemption of £62,000. The client also mentioned joint savings of £18,400 in a Halifax account. He expressed concern over a proposed 50-50 split of assets, noting his £95,000 deposit contribution from an inheritance in 2012. The client earns £105,000 as a consultant, while Emma earns £38,000 as a teacher.

   Advice given:
   I advised the client that Section 25 of the Matrimonial Causes Act 1973 requires consideration of factors such as needs, resources, and the standard of living during the marriage. Specifically:
   - The disparity in incomes and the deposit contribution are relevant considerations.
   - A clean break with a pension sharing order may be preferable to ongoing periodical payments, given Emma's earning capacity.
   - All material changes in financial circumstances, including the £22,000 bonus received in January 2026, must be disclosed in Form E.

   Reasoning behind advice and decisions:
   I advised the client to consider a clean break, having weighed Emma's earning capacity and the potential for future financial independence. The advice to disclose the bonus was based on the duty of full and frank disclosure, ensuring transparency in financial proceedings.

   Client's instructions and response:
   The client confirmed understanding and agreed to gather the necessary financial documents by 24 March 2026. He instructed me to draft a without prejudice letter in response to Emma's solicitor's proposal.

**2. FDR PREPARATION**

   What was discussed:
   The client inquired about the upcoming Financial Dispute Resolution (FDR) hearing scheduled for 22 April 2026 at the Manchester Family Court. He acknowledged the need to prepare updated bank statements and pension statements for both parties.

   Advice given:
   I advised the client to prepare and submit updated bank statements for the twelve months to March 2026 and pension statements before the FDR. Specifically:
   - Without these documents, our without prejudice proposal lacks credibility.
   - A counter-proposal should be submitted before 17 March 2026.

   Reasoning behind advice and decisions:
   The advice to prepare updated financial documents was based on the necessity of presenting a credible and comprehensive financial picture at the FDR. The counter-proposal timeline was set to ensure adequate preparation and negotiation time.

   Client's instructions and response:
   The client agreed to gather the required documents by 24 March 2026 and confirmed the telephone appointment on 18 March 2026 at 14:00 to review the draft letter.

**3. MATRIMONIAL ASSET DISCLOSURE**

   What was discussed:
   I reiterated the importance of relying solely on documents already mentioned and not assuming facts not recorded in this session.

   Advice given:
   I advised the client to adhere strictly to the agreed document list for evidential accuracy.

   Reasoning behind advice and decisions:
   The reasoning for this advice was the need to maintain evidential accuracy before any court or regulator submission.

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list as discussed.

**4. NEXT STEPS**

   Solicitor to action:
   1. Draft the without prejudice letter.
      Due: 17 March 2026.
   
   2. Send the Form E checklist and document request list.
      Due: 15 March 2026.
   
   Client to action:
   1. Gather bank statements, pension CETV updates, and mortgage redemption figure.
      Due: 24 March 2026.
   
   2. Prepare for the telephone appointment.
      Due: 18 March 2026 at 14:00.
   
   Next appointment: 18 March 2026 at 14:00.

Time Engaged: 1 hour 35 minutes

This attendance note is subject to legal professional privilege.

Prepared by: Sarah Mitchell, Associate Solicitor  
Date Prepared: 11 July 2026
```

### Family derive/characterise check

- Duration derivation from marriage/separation dates: NO
- Duration rendered with numerals (formatting rule): NO (words or absent)
- "matrimonial home": YES
- "irretrievably" / broken down: NO

### Family disclosure reasoning evidence

Transcript (bonus disclosure advice):
> *"I advised the client that all material changes in financial circumstances must be disclosed in Form E, having considered the duty of full and frank disclosure."*

The solicitor articulated reasoning at the meeting (duty of full and frank disclosure). Flags on note reasoning boilerplate citing that duty are **characterisation**, not invented reasoning.

### Clean baseline warnings (attendance)

- **[spurious]** The matrimonial home at 14 Linden Avenue, Didsbury, is valued at approximately £450,000.
- **[spurious]** The client also mentioned joint savings of £18,400 in a Halifax account.
- **[characterisation]** The client earns £105,000 as a consultant, while Emma earns £38,000 as a teacher.

### Clean baseline warnings (summary)

- **[characterisation]** The client and Emma Harris separated in March 2026 after marrying in August 2014.
- **[spurious]** The matrimonial home at 14 Linden Avenue, Didsbury, is valued at approximately £450,000, with a mortgage redemption of £62,000.
- **[spurious]** The client has an NHS pension with a CETV of approximately £120,000 and joint savings of £18,400.

### Attendance plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

### Summary plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

### Placeholder-misuse regression (injected)

**Status:** FLAGGED
- Draft the without prejudice letter. Due: This was not discussed on this occasion.

### Wrong-client-name regression (injected)

**Status:** FLAGGED
- The client, James Harris, disclosed that he and his ex-wife, Emma Harris, married in August 2014 and separated in March 2026.
- Prepared by: Sarah Mitchell, Associate Solicitor Date Prepared: 11 July 2026

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0586 | **Verification:** $0.1213

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: HASSAN/IMM/2026/0088  
Date:           11 March 2026  
Time:           09:15  
Duration:       1 hour 25 minutes  
Time Spent (Units): 15  
Location:       Birmingham office  
Solicitor:      David Okonkwo, Immigration Solicitor  

**MATTER:**     Hassan: Skilled Worker Refusal and Further Representations  

**CLIENT:**     Amir Hassan  

**MATTERS DISCUSSED**

**1. SKILLED WORKER VISA REFUSAL**

   What was discussed:
   The client, Amir Hassan, disclosed that his Skilled Worker visa is set to expire on 30 June 2026. He is employed by Midlands Digital Ltd, with sponsor licence reference SL-992184. The client entered the UK on 14 August 2021 with entry clearance as a Skilled Worker. He applied for Indefinite Leave to Remain (ILR) in January 2026 and received a refusal dated 19 February 2026. The refusal cited short absences and a gap in employer confirmation as reasons.

   Advice given:
   I advised the client that absences exceeding one hundred eighty days in any twelve-month period can affect continuous residence, having considered UKVI guidance and the specific dates provided by the client.

   Key points advised:
   - Address the absence explanation in further representations.
   - Obtain an updated employer letter confirming continuous employment.
   - Provide proof of residence since 2021.

   Reasoning behind advice and decisions:
   I advised the client to address the absence explanation and obtain an updated employer letter, having considered the refusal reasons and the need to demonstrate continuous residence and employment. <!-- REASONING_GAP: SKILLED WORKER VISA REFUSAL: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and instructed to proceed with obtaining the necessary documents, including a revised reference from the HR director by 25 March 2026.

**2. FAMILY DEPENDANTS AND ARTICLE 8 ECHR**

   What was discussed:
   The client mentioned that his wife and two children are on dependant visas and expressed concern about avoiding disruption to their schooling in Solihull.

   Advice given:
   I advised the client that Article 8 of the European Convention on Human Rights (ECHR) may be raised proportionately where refusal affects family unity, having considered the dependants' schooling and ties in the UK.

   Key points advised:
   - Raise Article 8 ECHR in further representations.
   - Emphasize the impact on family life and children's education.

   Reasoning behind advice and decisions:
   I advised the client to raise Article 8 ECHR, having considered the potential impact on family unity and the children's education in the UK. <!-- REASONING_GAP: FAMILY DEPENDANTS AND ARTICLE 8 ECHR: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to include Article 8 considerations in the further representations.

**3. DEADLINE FOR FURTHER REPRESENTATIONS**

   What was discussed:
   The client inquired about the deadline for submitting further representations following the refusal.

   Advice given:
   I advised the client that the refusal letter allows fourteen days from 19 February 2026, which means the deadline of 5 March 2026 has passed. I advised that we must request an extension immediately.

   Key points advised:
   - Request an extension from the Home Office immediately.
   - Chase Home Office acknowledgment of the extension request within ten working days of submission.

   Reasoning behind advice and decisions:
   I advised the client to request an extension immediately, having considered the missed deadline and the need to secure additional time for submitting further representations. <!-- REASONING_GAP: DEADLINE FOR FURTHER REPRESENTATIONS: Reasoning behind advice -->

   Client's instructions and response:
   The client instructed to proceed with the extension request and confirmed that he will provide the necessary documents by 25 March 2026.

**4. DOCUMENTATION AND NEXT STEPS**

   What was discussed:
   The client agreed to obtain the employer reference and travel evidence by 25 March 2026. The client also agreed to email passport scans.

   Advice given:
   I advised the client to obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary before we submit representations.

   Key points advised:
   - Obtain certified copies of relevant documents.
   - Prepare a witness statement on absences if needed.

   Reasoning behind advice and decisions:
   I advised the client to obtain certified copies of documents to ensure evidential accuracy and support the further representations. <!-- REASONING_GAP: DOCUMENTATION AND NEXT STEPS: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list we agreed upon.

**5. NEXT STEPS**

   Solicitor to action:
   1. Draft further representations and submit to UKVI by 28 March 2026, subject to receiving the client's documents.
      Due: 28 March 2026
   
   2. Request an extension from the Home Office and chase acknowledgment within ten working days.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Obtain employer reference and travel evidence.
      Due: 25 March 2026
   
   2. Email passport scans.
      Due: This was not discussed on this occasion.
   
   Next appointment: 26 March 2026 at 11:00

Time Engaged: 1 hour 25 minutes

This attendance note is subject to legal professional privilege.

Prepared by: David Okonkwo, Immigration Solicitor  
Date Prepared: 11 July 2026
```

### Clean baseline warnings (attendance)

- **[spurious]** Due: This was not discussed on this occasion.
- **[spurious]** Due: This was not discussed on this occasion.

### Clean baseline warnings (summary)

_None._

### Attendance plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

### Summary plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

---

## Corporate: Fiduciary Duty / Financial Crime Conference

**ID:** `corporate-fiduciary-duty`
**Generation cost:** $0.0643 | **Verification:** $0.1310

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: NORTHSTAR/CC/2026/0317  
Date:           12 March 2026  
Time:           15:00  
Duration:       1 hour 20 minutes  
Time Spent (Units): 14  
Location:       London office  
Solicitor:      James Thornton, Corporate Partner  

**MATTER:**     Vasquez: Northstar Logistics Ltd Director Misapplication Investigation  

**CLIENT:**     Elena Vasquez  

**MATTERS DISCUSSED**

**1. ALLEGED MISAPPLICATION OF COMPANY FUNDS**

   What was discussed:
   The client, Elena Vasquez, a minority shareholder of Northstar Logistics Ltd, raised concerns regarding potential misapplication of company funds by the managing director, Mr Colin Marsh. The client disclosed that their accountants identified transfers totalling £275,000 from the company account to Marsh Consulting Ltd between September 2025 and January 2026. Marsh Consulting is owned by Mr Marsh personally and had no legitimate supplier invoices on file. Additionally, three payments of £15,000 each were made to an account in Gibraltar described as "consultancy retainer" without a contract. The client expressed concern about the source of funds, noting that Mr Marsh claimed the Gibraltar payments were for a freight broker in Turkey but provided no KYC documentation.

   Advice given:
   I advised the client that directors owe duties under Section 172 and Section 174 of the Companies Act 2006, and unauthorised self-dealing may necessitate a board investigation. I further advised that unusual related-party payments and offshore transfers require careful review and may raise AML considerations for the company and its advisers.

   Key points advised:
   - Directors' duties under the Companies Act 2006.
   - The need for a board investigation into unauthorised self-dealing.
   - Review of related-party payments and offshore transfers for AML considerations.

   Reasoning behind advice and decisions:
   I advised the client to consider a board investigation, having considered her position as a minority shareholder with 11% of shares and not a director. The advice regarding AML considerations was given, considering her role as a whistleblower rather than a decision-maker. <!-- REASONING_GAP: ALLEGED MISAPPLICATION OF COMPANY FUNDS: Reasoning behind advice -->

   Client's instructions and response:
   The client expressed a desire to inform the board without making a formal fraud accusation. She agreed to preserve all emails and WhatsApp messages and to upload bank statements for review.

**2. BOARD BRIEFING AND DOCUMENT PRESERVATION**

   What was discussed:
   The client has emails from the finance manager questioning the Marsh Consulting invoices in October 2025. She agreed to preserve all relevant communications and provide bank statements for the period in question.

   Advice given:
   I advised the client that a factual briefing note to non-executive directors is appropriate before any criminal allegation, considering privilege and the need for verified bank statements.

   Key points advised:
   - Prepare a factual briefing note for non-executive directors.
   - Preserve all relevant communications and documents.

   Reasoning behind advice and decisions:
   I advised the client to prepare a briefing note, having considered the importance of maintaining privilege and the need for verified bank statements before making any criminal allegations. <!-- REASONING_GAP: BOARD BRIEFING AND DOCUMENT PRESERVATION: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to preserve all emails and upload bank statements by 16 March 2026. She confirmed understanding and alignment with the advice given.

**3. FORENSIC ACCOUNTANT INSTRUCTION**

   What was discussed:
   The client agreed to provide bank statements for the period from September 2025 to January 2026. I informed her of the estimated fee range for instructing a forensic accountant.

   Advice given:
   I advised the client that I would instruct a forensic accountant once the bank statements are received and reviewed, with an estimated fee range of £5,000 to £8,000 plus VAT, subject to partner approval.

   Key points advised:
   - Instruction of a forensic accountant upon receipt of bank statements.
   - Estimated fee range for forensic services.

   Reasoning behind advice and decisions:
   I advised the client on the forensic accountant instruction, having considered the need for a detailed financial analysis to support the board briefing and potential further action. <!-- REASONING_GAP: FORENSIC ACCOUNTANT INSTRUCTION: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to the proposed course of action and acknowledged the estimated fees.

**4. POTENTIAL IMPACT ON LENDER**

   What was discussed:
   The client mentioned that the suspicious activity might affect their lender, HSBC.

   Advice given:
   I advised the client that if funds were misapplied, the company may need to consider whether a suspicious activity report is required after internal verification, noting that this decision lies with the MLRO.

   Key points advised:
   - Consideration of a suspicious activity report if funds were misapplied.
   - Decision to be made by the MLRO after internal verification.

   Reasoning behind advice and decisions:
   I advised the client on the potential need for a suspicious activity report, having considered the implications of misapplied funds on the company's relationship with its lender and regulatory obligations. <!-- REASONING_GAP: POTENTIAL IMPACT ON LENDER: Reasoning behind advice -->

   Client's instructions and response:
   The client understood the advice and agreed to flag the issue for attention without making a finding.

**5. DOCUMENT RELIANCE AND EVIDENTIAL ACCURACY**

   What was discussed:
   I reiterated the importance of relying only on documents already mentioned and not assuming facts not recorded in this session.

   Advice given:
   I advised the client to rely only on documents already mentioned and not assume facts not recorded in this session to maintain evidential accuracy.

   Key points advised:
   - Reliance on documented evidence only.
   - Importance of evidential accuracy.

   Reasoning behind advice and decisions:
   I advised the client on document reliance, having considered the need to maintain evidential accuracy before any court or regulator submission. <!-- REASONING_GAP: DOCUMENT RELIANCE AND EVIDENTIAL ACCURACY: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list we agreed upon.

**6. NEXT STEPS**

   Solicitor to action:
   1. Review company bank statements provided by the client.
      Due: 20 March 2026.
   
   2. Prepare a privileged board briefing note.
      Due: 20 March 2026.
   
   3. Instruct a forensic accountant upon receipt of bank statements.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Preserve all emails and WhatsApp messages.
      Due: This was not discussed on this occasion.
   
   2. Upload bank statements for September 2025 to January 2026.
      Due: 16 March 2026.
   
   Next appointment: This was not discussed on this occasion.

Time Engaged: 1 hour 20 minutes

This attendance note is subject to legal professional privilege.

Prepared by: James Thornton, Corporate Partner  
Date Prepared: 11 July 2026
```

### Clean baseline warnings (attendance)

- **[verifier-fp-genuine-placeholder]** Instruct a forensic accountant upon receipt of bank statements. Due: This was not discussed on this occasion.
- **[verifier-fp-genuine-placeholder]** Preserve all emails and WhatsApp messages. Due: This was not discussed on this occasion.

### Clean baseline warnings (summary)

_None._

### Attendance plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

### Summary plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. |

---

## Regression case library (seeded)

- `offshore-transfer` (must-flag): Fabricated amount: £2M offshore trust transfer to Cayman Islands
- `maintenance-waiver` (must-flag): Fabricated agreement: permanent spousal maintenance waiver and deed of release
- `barclays-bridging-loan` (must-flag): Fabricated third party and date: Barclays bridging loan approval
- `placeholder-misuse-injected` (must-flag): Placeholder used for a Due date that WAS discussed (injected regression)
- `wrong-client-name` (must-flag): Client name in note body contradicts the meeting record (injected regression)
- `numeral-currency-normalisation` (must-not-flag): Spoken amount normalised to £450,000 with separators
- `numeral-mortgage-redemption` (must-not-flag): Spoken £62,000 mortgage redemption figure
- `numeral-joint-savings` (must-not-flag): Spoken £18,400 joint savings figure
- `temporal-derivation-subsistence` (must-not-flag): Marriage duration ~11 years derived from August 2014 marriage and March 2026 separation
- `legal-characterisation-matrimonial-home` (must-not-flag): Legal term of art: the matrimonial home
- `legal-characterisation-irretrievably` (must-not-flag): Legal characterisation: broken down irretrievably
- `legal-characterisation-allegation-not-finding` (must-not-flag): Allegation characterised as concerns, not a finding of breach
- `placeholder-genuine-undiscussed` (must-not-flag): Placeholder used for genuinely undiscussed item
- `reasoning-gap-marker-in-section` (must-not-flag): REASONING_GAP marker present within advice section satisfies Category 2
- `corporate-fee-range-paraphrase` (must-not-flag): Fee range £5,000 to £8,000 plus VAT including partner approval qualifier
- `forensic-accountant-no-due-date` (must-not-flag): Placeholder Due for forensic accountant when no due date was given at meeting
- `compliant-placeholder-corporate` (must-not-flag): Compliant placeholder on corporate next steps where no due date or next appointment was given