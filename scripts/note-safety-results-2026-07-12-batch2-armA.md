# Note Safety Harness Results — Batch 2 completion — Arm A

**Model:** GPT-4o (production path)
Generated: 2026-07-12T17:40:19.954Z

**Harness:** real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.
**Arm A:** default OpenAI production path (measurement seam inert).
**Regression library:** `scripts/verifier-regression-cases.ts`
**Synthetic data only.**

## Hard gate (Arm A — full)

**Result:** FAIL

- Attendance plants: 9/9 DETECTED
- Summary plants: 9/9 DETECTED (informative)
- Placeholder misuse injected: FLAGGED
- Wrong-client-name injected: FLAGGED
- No em/en dash in model prose: YES
- Retired spurious warnings gone: YES
- Family duration derivation: YES
- Family duration in numerals: YES
- Immigration placeholder misuse gone: YES
- Attendance spurious warnings: NONE
- Corporate compliant placeholder verifier FPs: 3

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Corporate compliant placeholders still flagged by verifier (3)

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0636 | **Verification:** $0.1643

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

**1. MATRIMONIAL HOME AND FINANCIAL ASSETS**

   What was discussed:
   The client married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years. The matrimonial home at 14 Linden Avenue, Didsbury, is valued at approximately £450,000. The client disclosed a mortgage redemption figure of £62,000 and joint savings of £18,400 in a Halifax account. The client contributed a deposit of £95,000 from an inheritance in 2012. The client expressed concern regarding a 50-50 split proposed by the ex-wife, Emma Harris, and the potential for spousal maintenance, given the income disparity: the client earns £105,000 as a consultant, while Emma earns £38,000 as a teacher.

   Advice given:
   I advised the client that Section 25 of the Matrimonial Causes Act 1973 requires consideration of factors including needs, resources, and the standard of living during the marriage. Specifically:
   - The deposit contribution may be a relevant factor in the division of assets.
   - The income disparity could influence spousal maintenance considerations.
   - A clean break with a pension sharing order may be preferable to ongoing periodical payments.

   Reasoning behind advice and decisions:
   I advised the client to consider a clean break, having weighed Emma's earning capacity and the potential for future financial independence. The deposit contribution was highlighted as a significant factor in asset division. <!-- REASONING_GAP: MATRIMONIAL HOME AND FINANCIAL ASSETS: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and expressed disagreement with Emma's proposal to retain the matrimonial home while the client retains the pension intact.

**2. FINANCIAL DISCLOSURE AND FDR PREPARATION**

   What was discussed:
   The client is scheduled for a Financial Dispute Resolution (FDR) hearing on 22 April 2026 at the Manchester Family Court. The client was advised to prepare updated bank statements for the twelve months to March 2026 and pension statements for both parties.

   Advice given:
   I advised the client that full and frank disclosure is essential for Form E, including any material changes in financial circumstances, such as the £22,000 bonus received in January 2026. Specifically:
   - Gather bank statements and pension CETV updates by 24 March 2026.
   - Disclose all material financial changes in Form E.

   Reasoning behind advice and decisions:
   I advised the client to ensure full disclosure to maintain credibility in the without prejudice proposal, having considered the duty of full and frank disclosure. <!-- REASONING_GAP: FINANCIAL DISCLOSURE AND FDR PREPARATION: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to gather the necessary documents by 24 March 2026 and confirmed understanding of the disclosure obligations.

**3. COUNTER-PROPOSAL AND NEXT STEPS**

   What was discussed:
   The client was advised to respond to Emma's solicitor's proposal with a counter-proposal before 17 March 2026, considering liquidity issues if the client retains the property and pays a lump sum.

   Advice given:
   I advised the client to draft a without prejudice letter as a counter-proposal. Specifically:
   - Respond with a counter-proposal by 17 March 2026.
   - Consider liquidity issues in retaining the property.

   Reasoning behind advice and decisions:
   I advised the client to draft a counter-proposal, having considered the liquidity implications and the need for a balanced settlement. <!-- REASONING_GAP: COUNTER-PROPOSAL AND NEXT STEPS: Reasoning behind advice -->

   Client's instructions and response:
   The client instructed me to draft the without prejudice letter and agreed to the proposed timeline.

**4. MATRIMONIAL ASSET DISCLOSURE**

   What was discussed:
   I advised the client to rely only on documents already mentioned and not assume facts not recorded in this session.

   Advice given:
   I advised the client to maintain evidential accuracy before any court or regulator submission.

   Reasoning behind advice and decisions:
   The reasoning behind this advice was the need to maintain evidential accuracy before any court or regulator submission.

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list as discussed.

**NEXT STEPS**

   Solicitor to action:
   1. Draft the without prejudice letter.
      Due: 17 March 2026
   
   2. Send the Form E checklist and document request list.
      Due: 15 March 2026
   
   Client to action:
   1. Gather bank statements, pension CETV updates, and mortgage redemption figure.
      Due: 24 March 2026
   
   2. Prepare for the FDR hearing with updated financial documents.
      Due: 24 March 2026
   
   Next appointment: 18 March 2026 at 14:00 (telephone appointment)

Time Engaged: 1 hour 35 minutes

This attendance note is subject to legal professional privilege.

Prepared by: Sarah Mitchell, Associate Solicitor  
Date Prepared: 12 July 2026
```

### Family derive/characterise check

- Duration derivation from marriage/separation dates: YES
- Duration rendered with numerals (formatting rule): YES
- "matrimonial home": YES
- "irretrievably" / broken down: NO

### Family disclosure reasoning evidence

Transcript (bonus disclosure advice):
> *"I advised the client that all material changes in financial circumstances must be disclosed in Form E, having considered the duty of full and frank disclosure."*

The solicitor articulated reasoning at the meeting (duty of full and frank disclosure). Flags on note reasoning boilerplate citing that duty are **characterisation**, not invented reasoning.

### Clean baseline warnings (attendance)

- **[characterisation]** The marriage has therefore subsisted for some 11 years.

### Clean baseline warnings (summary)

- **[characterisation]** The client and Emma Harris married in August 2014 and separated in March 2026, resulting in a marriage duration of approximately 11 years and 7 months.

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
**Inject method:** due-date-match
**V1 expectation:** FLAGGED — injected Due replaces 24 March 2026 commitment; contradicting timing is quotable from the meeting record.
- The marriage has therefore subsisted for some 11 years.
- Due: This was not discussed on this occasion.

### Wrong-client-name regression (injected)

**Status:** FLAGGED
**Inject method:** header-and-body-assertion
- The client, James Harris, confirmed his instructions.
- The client married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years.
- The client, James Harris, confirmed his instructions.

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0593 | **Verification:** $0.1193

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
   The client, Amir Hassan, entered the UK on 14 August 2021 with entry clearance as a Skilled Worker. He applied for Indefinite Leave to Remain (ILR) in January 2026 and received a refusal dated 19 February 2026. The refusal cited short absences and a gap in employer confirmation. The client's Skilled Worker visa is set to expire on 30 June 2026. The client was abroad from 3 March 2025 to 28 April 2025, a period of forty-seven days, to care for his mother in Lahore. He has travel stamps and employer email approval for this absence.

   Advice given:
   I advised the client that absences exceeding one hundred eighty days in any twelve-month period can affect continuous residence, having considered UKVI guidance and the specific dates provided.

   Key points advised:
   - Address the absence explanation in further representations.
   - Obtain an updated employer letter and proof of residence since 2021.
   - Obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary.

   Reasoning behind advice and decisions:
   I advised the client to address the absence explanation and obtain necessary documentation, having considered the refusal reasons and the need to demonstrate continuous residence and employment.

   Client's instructions and response:
   The client confirmed understanding and instructed to proceed with obtaining the necessary documents. The HR director will provide a revised reference by 25 March 2026.

**2. DEPENDANT VISAS AND FAMILY LIFE**

   What was discussed:
   The client's wife and two children are on dependant visas. The client expressed a desire to avoid disruption to their schooling in Solihull.

   Advice given:
   I advised the client that Article 8 of the European Convention on Human Rights (ECHR) may be raised proportionately where refusal affects family unity, having considered the dependants' schooling and ties in the UK.

   Reasoning behind advice and decisions:
   I advised the client to consider raising Article 8 ECHR in further representations, having considered the potential impact on family life and the children's education.

   Client's instructions and response:
   The client requested to include Article 8 considerations in the further representations.

**3. DEADLINE FOR FURTHER REPRESENTATIONS**

   What was discussed:
   The refusal letter allows fourteen days from 19 February 2026 for further representations, which has passed as of 5 March 2026.

   Advice given:
   I advised the client to request an extension immediately and undertake to chase Home Office acknowledgment of our extension request within ten working days of submission.

   Reasoning behind advice and decisions:
   I advised the client to request an extension due to the missed deadline, having considered the importance of timely submissions to the Home Office.

   Client's instructions and response:
   The client instructed to proceed with the extension request and confirmed understanding of the urgency.

**4. DOCUMENTATION AND NEXT STEPS**

   What was discussed:
   The client will obtain the employer reference and travel evidence by 25 March 2026. The client will email passport scans tonight.

   Advice given:
   I advised the client to obtain the necessary documents and prepare a witness statement on absences if needed.

   Reasoning behind advice and decisions:
   I advised the client to gather all relevant documentation to support the further representations, having considered the evidential requirements for the Home Office.

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list we agreed upon.

**NEXT STEPS**

   Solicitor to action:
   1. Draft further representations and submit to UKVI.
      Due: 28 March 2026, subject to receiving client's documents.
   
   2. Chase Home Office acknowledgment of extension request.
      Due: Within 10 working days of submission.

   Client to action:
   1. Obtain employer reference and travel evidence.
      Due: 25 March 2026.
   
   2. Email passport scans.
      Due: Tonight.

   Next appointment: 26 March 2026 at 11:00.

Time Engaged: 1 hour 25 minutes

This attendance note is subject to legal professional privilege.

Prepared by: David Okonkwo, Immigration Solicitor  
Date Prepared: 12 July 2026
```

### Clean baseline warnings (attendance)

- **[characterisation]** Prepared by: David Okonkwo, Immigration Solicitor  Date Prepared: 12 July 2026

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
**Generation cost:** $0.0588 | **Verification:** $0.1207

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
   The client, Elena Vasquez, a minority shareholder of Northstar Logistics Ltd, raised concerns regarding the alleged misapplication of company funds by the managing director, Mr Colin Marsh. The client reported that accountants flagged transfers totalling £275,000 from the company account to Marsh Consulting Ltd between September 2025 and January 2026. Marsh Consulting is owned by Colin Marsh personally and had no legitimate supplier invoices on file. Additionally, three payments of £15,000 each were made to an account in Gibraltar described as "consultancy retainer" without a contract.

   Advice given:
   I advised the client that directors owe duties under Section 172 and Section 174 of the Companies Act 2006, and unauthorised self-dealing may require a board investigation. I further advised that unusual related-party payments and offshore transfers are matters requiring careful review and may raise AML considerations for the company and its advisers.

   Key points advised:
   - A factual briefing note to non-executive directors is appropriate before any criminal allegation.
   - Preserve all emails and WhatsApp messages related to the matter.
   - I will review the company bank statements provided by the client and report findings to the board in a privileged note by 20 March 2026.

   Reasoning behind advice and decisions:
   I advised the client to consider a board investigation, having considered her role as a minority shareholder and whistleblower, rather than a decision-maker. The advice to prepare a factual briefing note was given to maintain privilege and ensure the board is informed without making premature allegations. <!-- REASONING_GAP: ALLEGED MISAPPLICATION OF COMPANY FUNDS: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to preserve all relevant communications. The client will upload bank statements for the period September 2025 to January 2026 by 16 March 2026.

**2. POTENTIAL IMPACT ON LENDER AND AML CONSIDERATIONS**

   What was discussed:
   The client expressed concern that the suspicious activity may affect the company's lender, HSBC. The client also mentioned that Mr Marsh had informed the board that the Gibraltar payments were for a freight broker in Turkey but provided no KYC pack.

   Advice given:
   I advised the client that if funds were misapplied, the company may need to consider whether a suspicious activity report is required after internal verification. This decision would be for the Money Laundering Reporting Officer (MLRO) to make, not a conclusion of this meeting.

   Reasoning behind advice and decisions:
   The advice was given to ensure that any potential AML issues are addressed appropriately, considering the client's role as a whistleblower and the need for internal verification before any external reporting. <!-- REASONING_GAP: POTENTIAL IMPACT ON LENDER AND AML CONSIDERATIONS: Reasoning behind advice -->

   Client's instructions and response:
   The client understood the advice and agreed to flag the matter for attention without making any findings at this stage.

**3. NEXT STEPS**

   Solicitor to action:
   1. Review the company bank statements provided by the client.
      Due: 20 March 2026
   
   2. Prepare a privileged board briefing note based on the findings.
      Due: 20 March 2026
   
   3. Instruct a forensic accountant upon partner approval.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Upload bank statements for September 2025 to January 2026.
      Due: 16 March 2026
   
   2. Preserve all emails and WhatsApp messages related to the matter.
      Due: This was not discussed on this occasion.
   
   Next appointment: This was not discussed on this occasion.

Time Engaged: 1 hour 20 minutes

This attendance note is subject to legal professional privilege.

Prepared by: James Thornton, Corporate Partner  
Date Prepared: 12 July 2026
```

### Clean baseline warnings (attendance)

- **[verifier-fp-genuine-placeholder]** Due: This was not discussed on this occasion.
- **[verifier-fp-genuine-placeholder]** Due: This was not discussed on this occasion.
- **[verifier-fp-genuine-placeholder]** Next appointment: This was not discussed on this occasion.

### Clean baseline warnings (summary)

- **[characterisation]** Potential breach of fiduciary duty by the managing director.

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