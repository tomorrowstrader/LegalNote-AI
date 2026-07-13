# Note Safety Harness Results — Batch 2 (derive-do-not-invent)

Generated: 2026-07-11T21:16:02.488Z

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
- New spurious on clean notes: 1

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Family note missing subsistence derivation and/or matrimonial home characterisation
- New spurious warnings on clean notes (1)

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0572 | **Verification:** $0.1549

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
   The client, Jon Harris, discussed the matrimonial home located at 14 Linden Avenue, Didsbury, valued at approximately £450,000. The client also mentioned an NHS pension with a Cash Equivalent Transfer Value (CETV) of approximately £120,000. The mortgage redemption figure on the property is £62,000, and there are joint savings of £18,400 in a Halifax account. The client expressed concern over a proposed 50-50 split of assets, noting a £95,000 deposit contribution from an inheritance in 2012. The client earns £105,000 as a consultant, while the ex-wife earns £38,000 as a teacher.

   Advice given:
   I advised the client that Section 25 of the Matrimonial Causes Act 1973 requires consideration of factors such as needs, resources, and the standard of living during the marriage. Specifically:
   - The disparity in incomes and the deposit contribution are relevant considerations.
   - A clean break with a pension sharing order may be preferable to ongoing periodical payments.
   - All material changes in financial circumstances, such as the £22,000 bonus received in January 2026, must be disclosed in Form E.

   Reasoning behind advice and decisions:
   I advised the client to consider a clean break, having considered Emma's earning capacity and the length of the marriage, which was twelve years. The advice on full disclosure was based on the duty of full and frank disclosure required in financial remedy proceedings.

   Client's instructions and response:
   The client confirmed understanding and agreed to gather the necessary financial documents by 24 March 2026.

**2. FDR PREPARATION AND COUNTER-PROPOSAL**

   What was discussed:
   The client inquired about the Financial Dispute Resolution (FDR) hearing scheduled for 22 April 2026 at the Manchester Family Court. The client also mentioned a proposal from Emma's solicitor for her to retain the matrimonial home while the client retains the pension intact, which the client does not agree with.

   Advice given:
   I advised the client to prepare updated bank statements for the twelve months to March 2026 and pension statements for both parties before the FDR. Specifically:
   - Without these documents, our without prejudice proposal lacks credibility.
   - We should respond with a counter-proposal before 17 March 2026.

   Reasoning behind advice and decisions:
   I advised the client to prepare financial documents to ensure credibility in negotiations, having considered the importance of evidential support in financial remedy proceedings. The counter-proposal advice was based on liquidity issues if the client retains the property and pays a lump sum.

   Client's instructions and response:
   The client agreed to gather the necessary documents and instructed me to draft the without prejudice letter by 17 March 2026.

**3. DOCUMENTATION AND DISCLOSURE**

   What was discussed:
   The client asked about the disclosure of a £22,000 bonus received in January 2026.

   Advice given:
   I advised the client that all material changes in financial circumstances must be disclosed in Form E, having considered the duty of full and frank disclosure.

   Reasoning behind advice and decisions:
   The advice was based on the legal requirement for full and frank disclosure in financial remedy proceedings.

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
   
   2. Prepare for the FDR hearing with updated financial documents.
      Due: Before 22 April 2026
   
   Next appointment: Telephone appointment on 18 March 2026 at 14:00.

Time Engaged: 1 hour 35 minutes

This attendance note is subject to legal professional privilege.

Prepared by: Sarah Mitchell, Associate Solicitor  
Date Prepared: 11 July 2026
```

### Family derive/characterise check

- Subsistence or duration derivation: NO
- "matrimonial home": YES
- "irretrievably" / broken down: NO

### Clean baseline warnings (attendance)

- **[characterisation]** The advice on full disclosure was based on the duty of full and frank disclosure required in financial remedy proceedings.
- **[characterisation]** The advice was based on the legal requirement for full and frank disclosure in financial remedy proceedings.

### Clean baseline warnings (summary)

- **[spurious]** The matrimonial home at 14 Linden Avenue, Didsbury, valued at approximately £450,000
- **[characterisation]** The client's NHS pension CETV is approximately £120,000

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
- The client, James Harris, discussed the matrimonial home located at 14 Linden Avenue, Didsbury, valued at approximately £450,000.
- The client also mentioned an NHS pension with a Cash Equivalent Transfer Value (CETV) of approximately £120,000.

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0571 | **Verification:** $0.1206

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
   - Obtain an updated employer letter and proof of residence since 2021.
   - Obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary.

   Reasoning behind advice and decisions:
   I advised the client to address the absence explanation and obtain necessary documentation, having considered the refusal reasons and the importance of maintaining continuous residence for ILR applications. <!-- REASONING_GAP: SKILLED WORKER VISA REFUSAL: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and instructed to proceed with obtaining the necessary documents. The client will obtain the employer reference and travel evidence by 25 March 2026.

**2. FAMILY LIFE AND ARTICLE 8 ECHR**

   What was discussed:
   The client mentioned that his wife and two children are on dependant visas and expressed concern about avoiding disruption to their schooling in Solihull.

   Advice given:
   I advised the client that Article 8 of the European Convention on Human Rights (ECHR) may be raised proportionately where refusal affects family unity, having considered the dependants' schooling and ties in the UK.

   Key points advised:
   - Consider raising Article 8 ECHR in further representations.
   - Highlight the impact on family life and children's education.

   Reasoning behind advice and decisions:
   I advised the client to consider raising Article 8 ECHR, having considered the potential impact on family unity and the children's education in the UK. <!-- REASONING_GAP: FAMILY LIFE AND ARTICLE 8 ECHR: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to include Article 8 considerations in the further representations.

**3. DEADLINE FOR FURTHER REPRESENTATIONS**

   What was discussed:
   The client inquired about the deadline for submitting further representations following the refusal.

   Advice given:
   I advised the client that the refusal letter allows fourteen days from 19 February 2026, which means the deadline of 5 March 2026 has passed. I advised that we must request an extension immediately.

   Key points advised:
   - Request an extension from the Home Office immediately.
   - Chase Home Office acknowledgment of the extension request within ten working days of submission.

   Reasoning behind advice and decisions:
   I advised the client to request an extension immediately, having considered the missed deadline and the need to secure additional time for preparing further representations. <!-- REASONING_GAP: DEADLINE FOR FURTHER REPRESENTATIONS: Reasoning behind advice -->

   Client's instructions and response:
   The client instructed to proceed with the extension request and confirmed understanding of the urgency.

**4. NEXT STEPS**

   Solicitor to action:
   1. Draft further representations and submit to UKVI by 28 March 2026, subject to receiving the client's documents.
      Due: 28 March 2026
   
   2. Chase Home Office acknowledgment of the extension request within ten working days of submission.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Obtain the employer reference and travel evidence by 25 March 2026.
      Due: 25 March 2026
   
   2. Email passport scans and other relevant documents.
      Due: This was not discussed on this occasion.
   
   Next appointment: 26 March 2026 at 11:00

Time Engaged: 1 hour 25 minutes

This attendance note is subject to legal professional privilege.

Prepared by: David Okonkwo, Immigration Solicitor  
Date Prepared: 11 July 2026
```

### Clean baseline warnings (attendance)

- **[characterisation]** Chase Home Office acknowledgment of the extension request within ten working days of submission. Due: This was not discussed on this occasion.
- **[characterisation]** Email passport scans and other relevant documents. Due: This was not discussed on this occasion.

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
**Generation cost:** $0.0626 | **Verification:** $0.1280

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
   - Directors' duties under Companies Act 2006
   - Need for board investigation into unauthorised self-dealing
   - AML considerations for related-party payments and offshore transfers

   Reasoning behind advice and decisions:
   I advised the client to consider a board investigation, having considered the client's role as a whistleblower and the potential implications of unauthorised transactions. The advice regarding AML considerations was informed by the nature of the transactions and the client's non-decision-making role. <!-- REASONING_GAP: ALLEGED MISAPPLICATION OF COMPANY FUNDS: Reasoning behind advice -->

   Client's instructions and response:
   The client expressed concern about the source of funds and requested that the board be informed without making a formal fraud accusation. The client agreed to preserve all relevant emails and WhatsApp messages and to provide company bank statements for review.

**2. BOARD BRIEFING AND DOCUMENT PRESERVATION**

   What was discussed:
   The client has emails from the finance manager questioning the Marsh Consulting invoices in October 2025. The client agreed to upload bank statements for the period from September 2025 to January 2026 by 16 March 2026.

   Advice given:
   I advised the client that a factual briefing note to non-executive directors is appropriate before any criminal allegation, considering privilege and the need for verified bank statements. I also advised the client to preserve all emails and WhatsApp messages and not to delete any documents.

   Key points advised:
   - Preparation of a factual briefing note for non-executive directors
   - Preservation of all relevant documents

   Reasoning behind advice and decisions:
   I advised the client to prepare a briefing note, having considered the importance of maintaining privilege and the need for verified documentation before making any formal allegations. <!-- REASONING_GAP: BOARD BRIEFING AND DOCUMENT PRESERVATION: Reasoning behind advice -->

   Client's instructions and response:
   The client agreed to preserve all relevant documents and to upload the bank statements by 16 March 2026. The client confirmed understanding of the need for a factual briefing note.

**3. FORENSIC ACCOUNTANT INSTRUCTION**

   What was discussed:
   The client mentioned that the suspicious activity might affect their lender, HSBC.

   Advice given:
   I advised the client that if funds were misapplied, the company may need to consider whether a suspicious activity report is required after internal verification. This decision would be for the Money Laundering Reporting Officer (MLRO) to make, not a conclusion of this meeting.

   Key points advised:
   - Consideration of a suspicious activity report if funds were misapplied
   - Decision to be made by the MLRO

   Reasoning behind advice and decisions:
   I advised the client on the potential need for a suspicious activity report, having considered the implications of misapplied funds and the role of the MLRO in such matters. <!-- REASONING_GAP: FORENSIC ACCOUNTANT INSTRUCTION: Reasoning behind advice -->

   Client's instructions and response:
   The client understood the advice and agreed to flag the matter for attention without making a finding. The client also agreed to the instruction of a forensic accountant, subject to partner approval, with an estimated fee range of £5,000 to £8,000 plus VAT.

**4. RELATED-PARTY PAYMENTS AND GOVERNANCE**

   What was discussed:
   I advised the client to rely only on documents already mentioned and not assume facts not recorded in this session.

   Advice given:
   I advised the client to maintain evidential accuracy before any court or regulator submission by relying solely on the documents discussed.

   Key points advised:
   - Reliance on discussed documents for evidential accuracy
   - Avoidance of assumptions not recorded in the session

   Reasoning behind advice and decisions:
   I advised the client to rely on the discussed documents, having considered the need to maintain evidential accuracy in any potential legal or regulatory proceedings. <!-- REASONING_GAP: RELATED-PARTY PAYMENTS AND GOVERNANCE: Reasoning behind advice -->

   Client's instructions and response:
   The client confirmed understanding and agreed to follow the document list as discussed.

**5. NEXT STEPS**

   Solicitor to action:
   1. Review company bank statements provided by the client.
      Due: 20 March 2026
   
   2. Prepare a privileged board briefing note.
      Due: 20 March 2026
   
   3. Instruct a forensic accountant upon partner approval.
      Due: This was not discussed on this occasion.
   
   Client to action:
   1. Preserve all relevant emails and WhatsApp messages.
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

- **[genuine-catch]** Due: This was not discussed on this occasion.
- **[genuine-catch]** Next appointment: This was not discussed on this occasion.

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
- `temporal-derivation-subsistence` (must-not-flag): Marriage subsisted ~3 years derived from August 2021 and 2024 separation
- `legal-characterisation-matrimonial-home` (must-not-flag): Legal term of art: the matrimonial home
- `legal-characterisation-irretrievably` (must-not-flag): Legal characterisation: broken down irretrievably
- `legal-characterisation-allegation-not-finding` (must-not-flag): Allegation characterised as concerns, not a finding of breach
- `placeholder-genuine-undiscussed` (must-not-flag): Placeholder used for genuinely undiscussed item
- `reasoning-gap-marker-in-section` (must-not-flag): REASONING_GAP marker present within advice section satisfies Category 2
- `corporate-fee-range-paraphrase` (must-not-flag): Fee range £5,000 to £8,000 plus VAT including partner approval qualifier
- `forensic-accountant-no-due-date` (must-not-flag): Placeholder Due for forensic accountant when no due date was given at meeting