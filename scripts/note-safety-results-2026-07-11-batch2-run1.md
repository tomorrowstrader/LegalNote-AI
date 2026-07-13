# Note Safety Harness Results — Batch 2 (derive-do-not-invent) — Run 1

Generated: 2026-07-11T21:39:38.539Z

**Harness:** OpenAI-only; real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.
**Regression library:** `scripts/verifier-regression-cases.ts`
**Synthetic data only.**

## Hard gate

**Result:** FAIL

- Attendance plants: 9/9 DETECTED (gates commit)
- Summary plants: 9/9 DETECTED (informative)
- Retired spurious warnings gone: YES
- Placeholder misuse still flagged: YES
- Family derive/characterise: NO
- Wrong-client-name regression (injected): FLAGGED
- No em/en dash in model prose: YES
- New spurious on clean notes: 4

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Family note missing subsistence derivation and/or matrimonial home characterisation
- New spurious warnings on clean notes (4)

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0584 | **Verification:** $0.1569

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
   I advised the client that Section 25 of the Matrimonial Causes Act 1973 requires consideration of factors such as needs, resources, and the standard of living during the marriage. I highlighted the disparity in incomes and the deposit contribution as relevant factors.

   Key points advised:
   - Consideration of Section 25 factors, including income disparity and deposit contribution.
   - Importance of full and frank disclosure in Form E.
   - Preparation of updated financial documents for the FDR.

   Reasoning behind advice and decisions:
   I advised the client to consider these factors, having weighed the disparity in incomes and the significance of the deposit contribution. <!-- REASONING_GAP: MATRIMONIAL HOME AND FINANCIAL DISCLOSURE: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to gather necessary financial documents by 24 March 2026.

**2. FDR PREPARATION AND STRATEGY**

   What was discussed:
   The client inquired about the upcoming Financial Dispute Resolution (FDR) hearing on 22 April 2026 at the Manchester Family Court. He expressed disagreement with Emma's proposal to keep the matrimonial home while he retains his pension intact.

   Advice given:
   I advised the client to prepare updated bank statements and pension statements for both parties before the FDR. I also suggested that a clean break with a pension sharing order might be preferable to ongoing periodical payments.

   Key points advised:
   - Preparation of financial documents for credibility at FDR.
   - Consideration of a clean break with a pension sharing order.

   Reasoning behind advice and decisions:
   I advised the client to prepare these documents to ensure the credibility of our without prejudice proposal. The suggestion of a clean break was made considering Emma's earning capacity and the potential liquidity issues. <!-- REASONING_GAP: FDR PREPARATION AND STRATEGY: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to gather the necessary documents and requested the drafting of a counter-proposal letter by 17 March 2026.

**3. DISCLOSURE OF BONUS AND DOCUMENTATION**

   What was discussed:
   The client queried whether to disclose a £22,000 bonus received in January 2026.

   Advice given:
   I advised the client that all material changes in financial circumstances must be disclosed in Form E, emphasizing the duty of full and frank disclosure.

   Key points advised:
   - Disclosure of the £22,000 bonus in Form E.
   - Adherence to full and frank disclosure obligations.

   Reasoning behind advice and decisions:
   I advised the client to disclose the bonus, having considered the legal obligation for full and frank disclosure in financial remedy proceedings. <!-- REASONING_GAP: DISCLOSURE OF BONUS AND DOCUMENTATION: Reasoning behind advice -->

   Client's instructions and response:
   The client understood and agreed to disclose the bonus in Form E.

**4. NEXT STEPS**

   Solicitor to action:
   1. Draft the without prejudice letter by 17 March 2026.
      Due: 17 March 2026
   
   2. Send the Form E checklist and document request list to the client.
      Due: 15 March 2026
   
   Client to action:
   1. Gather bank statements, pension CETV updates, and mortgage redemption figure.
      Due: 24 March 2026
   
   2. Prepare for the telephone appointment.
      Due: 18 March 2026
   
   Next appointment: 18 March 2026 at 14:00

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

- **[characterisation]** Prepared by: Sarah Mitchell, Associate Solicitor  Date Prepared: 11 July 2026

### Clean baseline warnings (summary)

- **[spurious]** The matrimonial home at 14 Linden Avenue, Didsbury, is valued at approximately £450,000.
- **[characterisation]** The client has an NHS pension CETV of approximately £120,000.
- **[spurious]** There are joint savings of £18,400.

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
- Draft the without prejudice letter by 17 March 2026. Due: This was not discussed on this occasion.

### Wrong-client-name regression (injected)

**Status:** FLAGGED
- The client, James Harris, disclosed that he and his ex-wife, Emma Harris, married in August 2014 and separated in March 2026.
- Prepared by: Sarah Mitchell, Associate Solicitor  Date Prepared: 11 July 2026

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0599 | **Verification:** $0.1229

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
   I advised the client to raise Article 8 ECHR, having considered the potential impact of refusal on family unity and the children's education in the UK. <!-- REASONING_GAP: FAMILY DEPENDANTS AND ARTICLE 8 ECHR: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to include Article 8 considerations in the further representations and confirmed understanding of the advice given.

**3. DEADLINE FOR FURTHER REPRESENTATIONS**

   What was discussed:
   The client inquired about the deadline for submitting further representations following the refusal.

   Advice given:
   I advised the client that the refusal letter allows fourteen days from 19 February 2026, which means the deadline of 5 March 2026 has passed. I advised that we must request an extension immediately.

   Key points advised:
   - Request an extension from the Home Office immediately.
   - Chase Home Office acknowledgment of the extension request within ten working days of submission.

   Reasoning behind advice and decisions:
   I advised the client to request an extension immediately, having considered the missed deadline and the importance of securing additional time to prepare comprehensive further representations. <!-- REASONING_GAP: DEADLINE FOR FURTHER REPRESENTATIONS: Reasoning behind advice -->

   Client's instructions and response:
   The client instructed to proceed with the extension request and confirmed understanding of the urgency.

**4. DOCUMENTATION AND NEXT STEPS**

   What was discussed:
   The client agreed to obtain the employer reference and travel evidence by 25 March 2026 and to email passport scans.

   Advice given:
   I advised the client to obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary before submitting representations.

   Key points advised:
   - Obtain and provide necessary documentation by 25 March 2026.
   - Prepare a witness statement on absences if needed.

   Reasoning behind advice and decisions:
   I advised the client to gather and provide the necessary documentation, having considered the evidential requirements for further representations and the need to substantiate claims of continuous residence and employment. <!-- REASONING_GAP: DOCUMENTATION AND NEXT STEPS: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to provide the required documents by the specified date.

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
**Generation cost:** $0.0616 | **Verification:** $0.1261

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
   The client, Elena Vasquez, a minority shareholder of Northstar Logistics Ltd, raised concerns regarding potential misapplication of company funds by the managing director, Mr Colin Marsh. The client disclosed that their accountants identified transfers totalling £275,000 from the company account to Marsh Consulting Ltd between September 2025 and January 2026. Marsh Consulting is owned by Mr Marsh personally and had no legitimate supplier invoices on file. Additionally, three payments of £15,000 each were made to an account in Gibraltar described as "consultancy retainer" without any supporting contract.

   Advice given:
   I advised the client that directors owe duties under Section 172 and Section 174 of the Companies Act 2006. Unauthorised self-dealing may necessitate a board investigation, particularly given the client's position as an 11% shareholder and not a director. I further advised that unusual related-party payments and offshore transfers require careful review and may raise anti-money laundering (AML) considerations.

   Key points advised:
   - Directors' duties under the Companies Act 2006.
   - The need for a board investigation into unauthorised self-dealing.
   - AML considerations for related-party payments and offshore transfers.

   Reasoning behind advice and decisions:
   I advised the client to consider a board investigation, having considered the client's role as a whistleblower and the potential implications of unauthorised transactions. The advice regarding AML considerations was informed by the nature of the transactions and the client's non-decision-making role. <!-- REASONING_GAP: ALLEGED MISAPPLICATION OF COMPANY FUNDS: Reasoning behind advice -->

   Client's instructions and response:
   The client expressed concern about the source of funds and agreed to prepare a factual briefing note for the non-executive directors before making any criminal allegations. The client confirmed understanding and agreed to preserve all relevant emails and WhatsApp messages.

**2. DOCUMENT PRESERVATION AND REVIEW**

   What was discussed:
   The client mentioned having emails from the finance manager questioning the Marsh Consulting invoices in October 2025. The client agreed to upload company bank statements for the period from September 2025 to January 2026 by 16 March 2026.

   Advice given:
   I advised the client to preserve all emails and WhatsApp messages and not to delete any documents. I undertook to review the company bank statements provided and report findings to the board in a privileged note by 20 March 2026.

   Reasoning behind advice and decisions:
   The advice to preserve documents was based on the need to maintain evidential accuracy and integrity before any potential court or regulatory submission. <!-- REASONING_GAP: DOCUMENT PRESERVATION AND REVIEW: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to preserve all relevant documents and confirmed the timeline for uploading the bank statements. The client also agreed to the proposed review and reporting process.

**3. FORENSIC ACCOUNTANT INSTRUCTION**

   What was discussed:
   I informed the client that a forensic accountant would be instructed once the bank statements were received and reviewed. The estimated fee range for this service is £5,000 to £8,000 plus VAT, subject to partner approval.

   Advice given:
   I advised the client that the instruction of a forensic accountant is necessary to thoroughly investigate the financial transactions in question.

   Reasoning behind advice and decisions:
   The decision to instruct a forensic accountant was based on the complexity and seriousness of the financial transactions involved, which require expert analysis. <!-- REASONING_GAP: FORENSIC ACCOUNTANT INSTRUCTION: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to the instruction of a forensic accountant and acknowledged the estimated fee range.

**4. POTENTIAL IMPACT ON LENDER**

   What was discussed:
   The client expressed concern that the suspicious activity might affect the company's lender, HSBC.

   Advice given:
   I advised the client that if funds were misapplied, the company might need to consider whether a suspicious activity report is required after internal verification. This decision would be for the Money Laundering Reporting Officer (MLRO) to make, not a conclusion of this meeting.

   Reasoning behind advice and decisions:
   The advice was given considering the potential regulatory implications and the need for internal verification before any external reporting. <!-- REASONING_GAP: POTENTIAL IMPACT ON LENDER: Reasoning behind advice -->

   Client's instructions and response:
   The client understood the advice and agreed to flag the matter for attention without making any findings at this stage.

**5. RELATED-PARTY PAYMENTS AND GOVERNANCE**

   What was discussed:
   I advised the client to rely only on documents already mentioned and not to assume facts not recorded in this session.

   Advice given:
   I advised the client to maintain evidential accuracy by relying solely on documented facts.

   Reasoning behind advice and decisions:
   The advice was based on the need to ensure evidential accuracy before any court or regulator submission. <!-- REASONING_GAP: RELATED-PARTY PAYMENTS AND GOVERNANCE: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list as discussed.

**6. NEXT STEPS**

   Solicitor to action:
   1. Review company bank statements and prepare a board briefing by 20 March 2026.
      Due: 20 March 2026
   
   2. Instruct a forensic accountant upon receipt of partner approval.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Preserve all emails and WhatsApp messages.
      Due: Ongoing
   
   2. Upload bank statements for September 2025 to January 2026.
      Due: 16 March 2026
   
   Next appointment: This was not discussed on this occasion.

Time Engaged: 1 hour 20 minutes

This attendance note is subject to legal professional privilege.

Prepared by: James Thornton, Corporate Partner  
Date Prepared: 11 July 2026
```

### Clean baseline warnings (attendance)

- **[verifier-fp-genuine-placeholder]** Due: This was not discussed on this occasion.

### Clean baseline warnings (summary)

- **[characterisation]** Potential breach of fiduciary duty by Mr Colin Marsh.

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