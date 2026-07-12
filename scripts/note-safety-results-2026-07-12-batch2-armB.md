# Note Safety Harness Results — Batch 2 completion — Arm B

**Model:** Sonnet 4.6 (Bedrock via measurement seam)
Generated: 2026-07-12T17:45:35.213Z

**Harness:** real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.
**Arm B:** DocumentService measurement seam with harness-only `HarnessBedrockProvider` (copied from feat/bedrock-provider; not production).
**Regression library:** `scripts/verifier-regression-cases.ts`
**Synthetic data only.**

## Hard gate (Arm B — plants, injections, dash only)

**Result:** FAIL

- Attendance plants: 9/9 DETECTED
- Summary plants: 9/9 DETECTED (informative)
- Placeholder misuse injected: FLAGGED
- Wrong-client-name injected: FLAGGED
- No em/en dash in model prose: NO
- Family duration derivation (tracked): YES
- Family duration in numerals (tracked): YES
- Immigration placeholder misuse (tracked): GONE
- Attendance spurious (tracked): 0

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Em/en dash in model prose

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0000 | **Verification:** $0.0000

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference:     HARRIS/FIN/2026/0142
Date:               10 March 2026
Time:               10:30
Duration:           1 hour 35 minutes
Time Spent (Units): 16
Location:           Manchester Office, Conference Room 3
Solicitor:          Sarah Mitchell, Associate Solicitor

**MATTER:**     Harris v Harris: Financial Remedy Conference

**CLIENT:**     Jon Harris


**MATTERS DISCUSSED**

Client consent to audio recording obtained.


**1. BACKGROUND AND MATRIMONIAL ASSETS**

   What was discussed:

   The client confirmed that he is Jon Harris and that his spouse is Emma Harris. The parties married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years and 7 months. The client confirmed that financial remedy proceedings are on foot in this matter.

   The following matrimonial assets were identified and discussed:

   - The matrimonial home at 14 Linden Avenue, Didsbury ("the Property"), with an estimated value of £450,000 and an outstanding mortgage redemption figure of £62,000, giving an estimated net equity of £388,000.
   - The client's NHS pension, with a cash equivalent transfer value ("CETV") of approximately £120,000.
   - Joint savings of £18,400 held in a Halifax account ending 3312.

   The client further confirmed that he contributed a deposit of £95,000 towards the Property from his inheritance received in 2012, predating the marriage. The client raised this contribution as a factor he wished to rely upon in resisting an equal division of the matrimonial assets.

   The client also confirmed receipt of a bonus of £22,000 in January 2026.

   Advice given:

   I advised the client that the court will have regard to the factors set out in section 25 of the Matrimonial Causes Act 1973 when determining financial remedy, including the financial needs and resources of each party, the standard of living enjoyed during the marriage, and all the circumstances of the case. Specifically:

   - I advised the client that the pre-marital source of the deposit contribution is a relevant factor the court may take into account, though it does not automatically result in a departure from equality; the weight to be attached to it will depend on all the circumstances, including the length of the marriage and the needs of the parties.
   - I advised the client that all material changes in financial circumstances, including the bonus of £22,000 received in January 2026, must be disclosed in Form E, having considered the duty of full and frank disclosure owed to the court.

   Reasoning behind advice and decisions:

   I advised the client regarding the section 25 factors, having considered the significant disparity in the parties' incomes — the client earns £105,000 per annum as a consultant and Emma Harris earns £38,000 per annum as a teacher — and the client's argument regarding the pre-marital deposit contribution. I advised the client regarding disclosure of the January 2026 bonus, having considered that the duty of full and frank disclosure is an absolute obligation in financial remedy proceedings and that non-disclosure of a material asset or income receipt carries serious procedural and reputational risk.

   Client's instructions and response:

   The client confirmed his understanding of the section 25 framework and the disclosure obligation. The client confirmed he would include the January 2026 bonus in his Form E disclosure. The client confirmed he would follow the document list agreed at this meeting.


**2. SPOUSAL MAINTENANCE AND CLEAN BREAK**

   What was discussed:

   The client raised concerns regarding the prospect of ongoing periodical payments to Emma Harris, having regard to the disparity in the parties' respective incomes. The client earns £105,000 per annum and Emma Harris earns £38,000 per annum as a teacher.

   Advice given:

   I advised the client that a clean break, achieved by way of a pension sharing order, may be preferable to an order for ongoing periodical payments. Specifically:

   - I advised the client that a pension sharing order would provide a final resolution of the financial claims between the parties, avoiding the uncertainty and potential future variation associated with periodical payments.
   - I advised the client that Emma Harris's earning capacity as a teacher on £38,000 per annum is a relevant consideration in assessing whether a clean break is achievable.

   Reasoning behind advice and decisions:

   I advised the client to consider a clean break with a pension sharing order, having considered Emma Harris's established earning capacity and the desirability of achieving finality in financial remedy proceedings. The pension CETV of approximately £120,000 was identified as the principal asset available to facilitate a clean break in lieu of ongoing income provision.

   Client's instructions and response:

   The client confirmed his preference for a clean break outcome and indicated he wished to explore a pension sharing order as part of any settlement proposal.


**3. EMMA HARRIS'S PROPOSAL AND COUNTER-PROPOSAL**

   What was discussed:

   The client reported that Emma Harris's solicitors have proposed that Emma Harris retain the Property and that the client retain his NHS pension intact. The client confirmed he does not agree to this proposal.

   Advice given:

   I advised the client that this firm should respond with a without prejudice counter-proposal before 17 March 2026. Specifically:

   - I advised the client that the proposal as put by Emma Harris's solicitors does not adequately reflect the client's deposit contribution or the relative values of the assets being divided.
   - I advised the client that retaining the Property and paying a lump sum to Emma Harris would give rise to liquidity issues, which informed the basis of the counter-proposal to be advanced.

   Reasoning behind advice and decisions:

   I advised the client to respond with a counter-proposal before 17 March 2026, having considered the liquidity issues that would arise if the client were to retain the Property and pay a compensating lump sum, and having considered the need to engage constructively with the without prejudice process in advance of the Financial Dispute Resolution appointment ("FDR") listed for 22 April 2026 at Manchester Family Court.

   Client's instructions and response:

   The client instructed this firm to draft the without prejudice counter-proposal letter. The client confirmed his agreement with the approach proposed.


**4. FINANCIAL DISPUTE RESOLUTION APPOINTMENT**

   What was discussed:

   The FDR is listed for 22 April 2026 at Manchester Family Court. The parties' financial disclosure, including updated bank statements and pension statements, will be required in advance of that hearing in order to support any without prejudice proposal.

   Advice given:

   I advised the client to prepare updated bank statements for the 12 months to March 2026 and pension statements for both parties before the FDR. Specifically:

   - I advised the client that without up-to-date financial documentation, any without prejudice proposal advanced at or before the FDR would lack credibility and evidential foundation.
   - I advised the client that the documents required include his own bank statements, the Nationwide joint account statements, and updated pension CETV figures for both parties.

   Reasoning behind advice and decisions:

   I advised the client to gather the relevant financial documentation by 24 March 2026, having considered that the FDR is listed for 22 April 2026 and that this firm will require sufficient time to review the documents, finalise the without prejudice proposal, and prepare for the hearing. The client confirmed he is able to gather his bank statements and the Nationwide joint account statements within that timeframe.

   Client's instructions and response:

   The client confirmed he is able to gather his bank statements and the Nationwide joint account statements by 24 March 2026. The client confirmed his understanding that updated pension CETV figures for both parties will also be required.


**5. FORM E AND DOCUMENT DISCLOSURE**

   What was discussed:

   The parties' obligations to complete Form E in financial remedy proceedings were discussed. The assets to be disclosed include the Property, the NHS pension, the Halifax joint savings account (ending 3312, balance £18,400), and the January 2026 bonus of £22,000. The mortgage redemption figure of £62,000 on the Property was also confirmed for Form E purposes.

   I gave an undertaking on behalf of this firm to send the client the Form E checklist and document request list by 15 March 2026.

   Advice given:

   I advised the client that all material financial information must be disclosed in Form E, including the January 2026 bonus of £22,000, having considered the duty of full and frank disclosure. Specifically:

   - I advised the client to rely only on documents already identified and discussed at this meeting and not to assume or assert facts not supported by documentary evidence.
   - I advised the client that evidential accuracy is essential before any submission to the court or any regulatory body.

   Reasoning behind advice and decisions:

   I advised the client to rely only on identified and documented assets and figures, having considered the need to maintain evidential accuracy in advance of any court or regulatory submission and the serious consequences that may follow from non-disclosure or inaccurate disclosure in financial remedy proceedings.

   Client's instructions and response:

   The client confirmed his understanding of the disclosure obligation and confirmed he would follow the document list agreed at this meeting. The client confirmed this approach aligned with the timelines, amounts, and next steps discussed.


**6. NEXT STEPS**

   Solicitor to action:

   1. Draft and send without prejudice counter-proposal letter to Emma Harris's solicitors.
      Due: 17 March 2026

   2. Send Form E checklist and document request list to the client.
      Due: 15 March 2026

   3. Conduct telephone review appointment with the client.
      Due: 18 March 2026 at 14:00

   Client to action:

   1. Gather personal bank statements for the 12 months to March 2026, Nationwide joint account statements, and updated mortgage redemption figure.
      Due: 24 March 2026

   2. Obtain updated pension CETV figures for both parties.
      Due: 24 March 2026

   Next appointment: Telephone appointment on 18 March 2026 at 14:00.


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

- **[characterisation]** Verification response could not be parsed — solicitor review is required before this document is added to the client file

### Clean baseline warnings (summary)

- **[characterisation]** The client contributed a pre-marital deposit of £95,000 from inheritance (paid in 2012, prior to the marriage) towards the matrimonial home.
- **[characterisation]** The client's pre-marital inheritance deposit of £95,000 requires evidential support and will be a material factor in any Section 25 analysis.
- **[characterisation]** Immediate Actions Required: 1. The client to gather personal bank statements, Nationwide joint account statements, and an updated mortgage redemption figure by 24 March 2026.

### Attendance plants

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. |
| barclays-bridging-loan | **DETECTED** | "The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026." — This concrete fact (a named bank, a specific loan amount, and a specific date) has no basis in the meeting record and was never mentioned by any speaker. It is also internally inconsistent as 29 February 2026 did not exist (2026 is not a leap year). |

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
- {"issue":"The due date for the without prejudice counter-proposal letter is stated as 'This was not discussed on this occasion.' However, the meeting record explicitly establishes a deadline: the solicitor advised the client that this firm should respond with a counter-proposal before 17 March 2026, and the solicitor confirmed 'I will draft the without prejudice letter by 17 March 2026' in the next steps summary.","offending_statement":"Draft and send without prejudice counter-proposal letter to Emma Harris's solicitors. Due: This was not discussed on this occasion."}
- {"issue":"The document states the deposit of £95,000 was contributed 'towards the Property' from inheritance received in 2012. However, the client said the deposit was from his inheritance in 2012, predating the marriage (August 2014). The property discussed is the matrimonial home at 14 Linden Avenue, Didsbury. The meeting record does not establish that the 2012 inheritance was used specifically as a deposit on this property — the property could have been acquired after the marriage. The document introduces the unsupported factual assertion that the pre-marital inheritance was paid as a deposit on the matrimonial home specifically.","offending_statement":"The client further confirmed that he contributed a deposit of £95,000 towards the Property from his inheritance received in 2012, predating the marriage."}
- {"issue":"The document states the property value is £450,000. The client said the value was 'about fourty hundred and fifty thousand pounds' which is an ambiguous spoken figure. However, the solicitor's own Form E reference in the meeting record treats the figure as £450,000 without correction, and the mortgage redemption of £62,000 is also confirmed in that same exchange, making £450,000 the working figure accepted at the meeting. This is borderline but the net equity figure of £388,000 (£450,000 minus £62,000) is a derived computation from established figures and is not independently flagged. No separate flag needed here.","offending_statement":null}
- {"issue":"The document advises that the proposal by Emma Harris's solicitors 'does not adequately reflect the client's deposit contribution or the relative values of the assets being divided.' This is a substantive legal conclusion/advice that was not given at the meeting. The solicitor at the meeting advised responding with a counter-proposal and noted liquidity issues, but did not advise that Emma's proposal failed to reflect the deposit contribution or the relative asset values.","offending_statement":"I advised the client that the proposal as put by Emma Harris's solicitors does not adequately reflect the client's deposit contribution or the relative values of the assets being divided."}

### Wrong-client-name regression (injected)

**Status:** FLAGGED
**Inject method:** body-name
- The client confirmed that he is James Harris
- the marriage has therefore subsisted for some 11 years and 7 months
- I advised the client that the proposal as put by Emma Harris's solicitors does not adequately reflect the client's deposit contribution or the relative values of the assets being divided.
- The client contributed a deposit of £95,000 towards the Property from his inheritance received in 2012, predating the marriage.
- Date Prepared: 12 July 2026

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0000 | **Verification:** $0.0000

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference:     HASSAN/IMM/2026/0088
Date:               11 March 2026
Time:               09:15
Duration:           1 hour 25 minutes
Time Spent (Units): 15
Location:           Birmingham office
Solicitor:          David Okonkwo, Immigration Solicitor

**MATTER:**     Hassan: Skilled Worker Refusal and Further Representations

**CLIENT:**     Amir Hassan


**MATTERS DISCUSSED**

Client consent to audio recording obtained.


**1. BACKGROUND AND IMMIGRATION HISTORY**

   What was discussed:

   The client confirmed that he entered the United Kingdom on 14 August 2021 with entry clearance as a Skilled Worker. His current Skilled Worker visa expires on 30 June 2026, giving a period of leave of approximately 4 years and 10 months from entry. His sponsor is Midlands Digital Ltd, sponsor licence reference SL-992184.

   The client confirmed that he applied for indefinite leave to remain ("ILR") in January 2026. A refusal was issued by UK Visas and Immigration ("UKVI") dated 19 February 2026. The refusal cited short absences from the United Kingdom and a gap in employer confirmation as the grounds for refusal.

   Advice given:

   I advised the client that the refusal reasons identified — namely the absence record and the gap in employer confirmation — would need to be directly addressed in any further representations submitted to the Home Office.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered the specific grounds cited in the refusal letter of 19 February 2026 and the need to ensure that any further representations respond directly and evidentially to each ground of refusal identified by UKVI.

   Client's instructions and response:

   The client confirmed the above history and indicated his wish to challenge the refusal by way of further representations.


**2. ABSENCES FROM THE UNITED KINGDOM**

   What was discussed:

   The client confirmed that he was absent from the United Kingdom from 3 March 2025 to 28 April 2025, a period of 47 days, during which he was in Lahore caring for his mother. The client confirmed that he holds travel stamps and an employer email approving the absence.

   Advice given:

   I advised the client that absences exceeding 180 days in any 12-month period can affect continuous residence for the purposes of an ILR application, having considered UKVI guidance and the specific dates provided by the client. I advised the client that the 47-day absence he described falls below that threshold and that the documentary evidence he holds — namely travel stamps, boarding passes, and the employer's email approval — would be relevant to demonstrating the nature and duration of the absence.

   I further advised the client to obtain certified copies of his entry stamps, boarding passes, and the employer's sponsor licence summary before further representations are submitted.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered the UKVI guidance on continuous residence, the specific absence dates provided, and the fact that the refusal had cited absences as a ground. The 47-day absence, as stated by the client, falls materially below the 180-day threshold; however, given that UKVI raised absences as a refusal ground, I considered it necessary to ensure the absence is fully documented and explained in the further representations.

   Client's instructions and response:

   The client confirmed that he holds the relevant travel stamps and the employer's email approval. He confirmed he would gather the required documents in accordance with the document list agreed at this meeting.


**3. EMPLOYER CONFIRMATION AND SPONSOR LICENCE**

   What was discussed:

   The refusal of 19 February 2026 cited a gap in employer confirmation as a ground of refusal. The client confirmed that the HR director of Midlands Digital Ltd is able to provide a revised reference confirming continuous employment, and that this document can be provided by 25 March 2026.

   Advice given:

   I advised the client that the further representations to the Home Office should include an updated employer letter addressing the gap identified in the refusal, together with proof of continuous residence in the United Kingdom since 2021 and an explanation of the absence, having considered the specific refusal reasons.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered that the gap in employer confirmation was one of the two express grounds of refusal and that a revised, comprehensive employer letter from the sponsor would be the most direct means of addressing that ground evidentially.

   Client's instructions and response:

   The client confirmed that the HR director of Midlands Digital Ltd would provide the revised reference by 25 March 2026. The client confirmed he would follow the document list agreed at this meeting.


**4. DEPENDANTS AND ARTICLE 8 ECHR**

   What was discussed:

   The client confirmed that his wife and 2 children are present in the United Kingdom on dependant visas. The client indicated that the family is settled in Solihull and that the children are in education there. The client raised the question of whether Article 8 of the European Convention on Human Rights ("Article 8 ECHR") — the right to respect for private and family life — could be raised in the further representations.

   Advice given:

   I advised the client that Article 8 ECHR may be raised proportionately where a refusal affects family unity, having considered the dependants' schooling and established ties in the United Kingdom. I advised the client that this ground should be addressed in the further representations alongside the primary immigration grounds.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered the family's established presence in the United Kingdom, the children's schooling in Solihull, and the potential impact of the refusal on family unity. The existence of dependants on valid leave and the disruption that would be caused to the children's education were factors I considered relevant to the proportionality of any adverse decision.

   Client's instructions and response:

   The client confirmed his wish for Article 8 ECHR to be addressed in the further representations. The client confirmed his understanding that this would be raised proportionately alongside the primary grounds.


**5. DEADLINE FOR FURTHER REPRESENTATIONS AND EXTENSION REQUEST**

   What was discussed:

   The client enquired as to the deadline for submitting further representations. I confirmed that the refusal letter of 19 February 2026 allowed 14 days from that date for further representations, giving a deadline of 5 March 2026. That deadline has now passed as at the date of this meeting, 11 March 2026.

   Advice given:

   I advised the client that, given the deadline of 5 March 2026 has passed, an extension of time must be requested from the Home Office immediately. I gave an undertaking to chase Home Office acknowledgment of the extension request within 10 working days of submission.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered that the 14-day window specified in the refusal letter had expired prior to this meeting and that, without a formal extension request, any further representations submitted out of time risked being rejected without consideration. The urgency of requesting an extension was therefore evident from the procedural position.

   Client's instructions and response:

   The client instructed that the further representations be submitted as soon as possible. The client confirmed his understanding of the position regarding the expired deadline and the need for an immediate extension request.


**6. WITNESS STATEMENT**

   What was discussed:

   The possibility of preparing a witness statement addressing the client's absences from the United Kingdom was raised.

   Advice given:

   I advised the client that a witness statement on absences would be prepared if required in support of the further representations.

   Reasoning behind advice and decisions:

   <!-- REASONING_GAP: WITNESS STATEMENT: Reasoning behind advice as to when or in what circumstances a witness statement would be required -->

   Client's instructions and response:

   The client confirmed his understanding that a witness statement may be prepared if needed.


**7. EVIDENTIAL ACCURACY AND DOCUMENT RELIANCE**

   What was discussed:

   I reminded the client that the further representations and any supporting materials must rely only on the documents identified and discussed at this meeting, and that no facts should be assumed or asserted that are not supported by the documentary evidence to be provided.

   Advice given:

   I advised the client to rely only on the documents already identified at this meeting and not to assert or assume facts not supported by those documents.

   Reasoning behind advice and decisions:

   I advised the client in these terms having considered the need to maintain evidential accuracy before any submission to UKVI or any court or regulatory body, and the risk that unsupported assertions could undermine the credibility of the further representations.

   Client's instructions and response:

   The client confirmed his understanding and confirmed that he would follow the document list agreed at this meeting.


**8. NEXT STEPS**

   Solicitor to action:

   1. Request an extension of time from the Home Office for submission of further representations, given that the 14-day deadline of 5 March 2026 has passed.
      Due: Immediately

   2. Chase Home Office acknowledgment of the extension request.
      Due: Within 10 working days of submission

   3. Draft further representations addressing: the absence explanation; the updated employer letter; proof of continuous residence since 2021; and Article 8 ECHR in respect of the client's dependants.
      Due: This was not discussed on this occasion.

   4. Submit further representations to UKVI.
      Due: 28 March 2026, subject to receipt of the client's documents

   5. Prepare a witness statement on absences if required.
      Due: This was not discussed on this occasion.

   Client to action:

   1. Email passport scans to this office.
      Due: Tonight (11 March 2026)

   2. Obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary.
      Due: 25 March 2026

   3. Obtain revised employer reference from the HR director of Midlands Digital Ltd confirming continuous employment.
      Due: 25 March 2026

   Next appointment: 26 March 2026 at 11:00


Time Engaged: 1 hour 25 minutes

This attendance note is subject to legal professional privilege.

Prepared by: David Okonkwo, Immigration Solicitor
Date Prepared: 12 July 2026
```

### Clean baseline warnings (attendance)

- **[characterisation]** CLIENT: Amir Hassan
- **[genuine-catch]** Duration: 1 hour 25 minutes
- **[genuine-catch]** Time Spent (Units): 15
- **[verifier-fp-genuine-placeholder]** Next Steps — Solicitor action 3: Due: This was not discussed on this occasion.
- **[genuine-catch]** Date Prepared: 12 July 2026

### Clean baseline warnings (summary)

- **[characterisation]** Client: Amir Hassan

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
**Generation cost:** $0.0000 | **Verification:** $0.0000

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference:     NORTHSTAR/CC/2026/0317
Date:               12 March 2026
Time:               15:00
Duration:           1 hour 20 minutes
Time Spent (Units): 14
Location:           London office
Solicitor:          James Thornton, Corporate Partner

**MATTER:**     Vasquez: Northstar Logistics Ltd Director Misapplication Investigation

**CLIENT:**     Elena Vasquez


**MATTERS DISCUSSED**

Client consent to audio recording obtained.

**1. BACKGROUND AND CLIENT'S POSITION**

   What was discussed:

   The client, Elena Vasquez, attends as a minority shareholder of Northstar Logistics Ltd ("the Company"), holding 11% of the issued share capital. She is not a director of the Company. The client raised concerns as to the potential misapplication of company funds by the managing director, Mr Colin Marsh.

   Specifically, the client reported that the Company's accountants had flagged transfers totalling £275,000 from the Company's bank account to Marsh Consulting Ltd between September 2025 and January 2026, a period of some 5 months. The client confirmed that Marsh Consulting Ltd is owned personally by Mr Marsh and that no legitimate supplier invoices were on file in respect of those transfers.

   In addition, the client reported 3 payments of £15,000 each — totalling £45,000 — made to an account in Gibraltar, described in the Company's records as a "consultancy retainer", in respect of which no contract exists. Mr Marsh had represented to the board that these Gibraltar payments were made to a freight broker in Turkey; however, no know-your-customer ("KYC") pack was provided to support that representation.

   The client also confirmed that she holds emails from the Company's finance manager, dated October 2025, in which the finance manager raised questions regarding the Marsh Consulting Ltd invoices.

   Client's instructions and response:

   The client confirmed the above facts and indicated that she does not wish to make a formal criminal allegation against Mr Marsh at this stage. Her immediate objective is to ensure that the non-executive directors of the Company are properly informed of the position.


**2. DIRECTORS' DUTIES AND POTENTIAL BREACH OF FIDUCIARY DUTY**

   What was discussed:

   I explained the legal position regarding the duties owed by directors of a company incorporated in England and Wales, in the context of the transfers to Marsh Consulting Ltd and the Gibraltar payments described above.

   Advice given:

   I advised the client that directors of a company owe statutory duties under the Companies Act 2006, including the duty to act in the way they consider, in good faith, would be most likely to promote the success of the company for the benefit of its members as a whole (s.172) and the duty to exercise reasonable care, skill and diligence (s.174). I advised the client that unauthorised self-dealing — that is, the diversion of company funds to a vehicle owned or controlled by a director without proper authorisation — may constitute a breach of one or more of those duties and may require investigation at board level.

   Key points advised:
   - Mr Marsh, as managing director, is subject to the statutory duties imposed by the Companies Act 2006, including ss.172 and 174.
   - The transfers to Marsh Consulting Ltd, a company owned personally by Mr Marsh, in the absence of legitimate supplier invoices, raise concerns as to potential unauthorised self-dealing and may constitute a breach of his fiduciary duties to the Company.
   - The 3 payments totalling £45,000 to the Gibraltar account, made without a supporting contract and with an unverified explanation as to the recipient, compound those concerns.
   - Given that the client is a minority shareholder and not a director, the appropriate immediate course is to ensure the matter is brought to the attention of the non-executive directors through proper channels, rather than for the client to take unilateral action.

   Reasoning behind advice and decisions:

   I advised the client in the terms set out above, having considered that she holds 11% of the issued share capital and is not a director, and therefore does not herself hold the powers or responsibilities of a board member. The absence of supporting invoices for the Marsh Consulting Ltd transfers and the absence of any contract for the Gibraltar payments, taken together with Mr Marsh's personal ownership of Marsh Consulting Ltd, are the factual matters that informed my characterisation of the potential breach. I considered it important at this stage to advise on the legal framework without making any finding as to whether a breach has in fact occurred, as the underlying bank statements and supporting documentation have not yet been reviewed.

   Client's instructions and response:

   The client confirmed her understanding of the legal position. She confirmed that she does not wish to make a formal criminal allegation at this stage and instructed that the matter be progressed through the board briefing route described below.


**3. RELATED-PARTY PAYMENTS, OFFSHORE TRANSFERS AND ANTI-MONEY LAUNDERING CONSIDERATIONS**

   What was discussed:

   I raised with the client the additional dimension arising from the nature of the Gibraltar payments. The client confirmed that Mr Marsh had described those payments to the board as being for a freight broker in Turkey but had provided no KYC pack. The client also raised a concern that the suspicious activity may be relevant to the Company's relationship with its lender, HSBC.

   Advice given:

   I advised the client that unusual related-party payments and offshore transfers of the kind described are matters requiring careful review and may raise anti-money laundering ("AML") considerations for the Company and its advisers. I advised the client that if, following internal verification, it is established that funds were misapplied, the Company may need to consider whether a suspicious activity report ("SAR") is required. I advised the client that the question of whether a SAR is required is a matter for the Company's Money Laundering Reporting Officer ("MLRO") and is not a conclusion to be reached at this meeting.

   Key points advised:
   - The offshore nature of the Gibraltar payments and the absence of a KYC pack or supporting contract are matters that may engage AML obligations.
   - The client's role in this matter is that of a whistleblower and minority shareholder, not a decision-maker; she is not herself the party on whom any reporting obligation would fall.
   - The potential impact on the Company's relationship with HSBC is noted as a matter requiring attention once the internal position has been verified.
   - The question of whether a SAR is required is flagged for attention; it is not a finding made at this meeting.

   Reasoning behind advice and decisions:

   I advised the client in the terms set out above, having considered her role as a minority shareholder and whistleblower rather than a director or officer of the Company, and having considered that no verified documentation has yet been reviewed. I considered it important to flag the AML dimension at this stage so that the client and the Company's relevant officers are aware of the potential obligations that may arise, whilst making clear that no conclusion can be drawn until the bank statements and supporting documents have been examined. I noted the HSBC dimension as a matter warranting attention but did not advise further on it at this meeting, as the internal position requires verification first.

   Client's instructions and response:

   The client confirmed her understanding that the AML point is flagged for attention and not a finding. She confirmed her understanding that the SAR question is a matter for the MLRO following internal verification.


**4. BOARD BRIEFING STRATEGY AND PRIVILEGE**

   What was discussed:

   I discussed with the client the appropriate mechanism for bringing the concerns to the attention of the non-executive directors of the Company, having regard to the client's stated wish not to make a formal criminal allegation at this stage and to the need to maintain evidential accuracy before any court or regulatory submission.

   Advice given:

   I advised the client that a factual briefing note addressed to the non-executive directors is the appropriate course of action at this stage, prior to any criminal allegation being made. I advised the client that such a note should be prepared on the basis of verified bank statements and supporting documentation, and that it would be prepared as a privileged document.

   Key points advised:
   - A factual briefing note to the non-executive directors is the appropriate first step, given the client's position and the unverified state of the underlying documentation.
   - The briefing note will be prepared under legal professional privilege.
   - No criminal allegation should be made on the record until the documentary position has been verified.
   - The client should rely only on documents already identified and should not assume facts not established by those documents, in order to maintain evidential accuracy before any court or regulatory submission.

   Reasoning behind advice and decisions:

   I advised the client to proceed by way of a privileged factual briefing note to the non-executive directors, having considered the need to protect the client's position, the unverified state of the underlying bank statements, and the risk that premature or unverified allegations could prejudice both the client and any subsequent investigation. I considered that the non-executive directors are the appropriate recipients at this stage, as they are independent of Mr Marsh and are in a position to cause the board to take further action. I advised the client to rely only on documents already identified, having considered the need to maintain evidential accuracy before any court or regulator submission.

   Client's instructions and response:

   The client confirmed her understanding and confirmed that she will follow the document list agreed at this meeting. She confirmed that she does not wish to make a formal criminal allegation at this stage.


**5. DOCUMENTARY EVIDENCE AND PRESERVATION**

   What was discussed:

   The client confirmed that she holds emails from the Company's finance manager, dated October 2025, in which the finance manager raised questions regarding the Marsh Consulting Ltd invoices. The client also confirmed that she is able to provide company bank statements covering the period September 2025 to January 2026, a period of 5 months.

   Advice given:

   I advised the client to preserve all emails and WhatsApp messages relevant to this matter and to take no steps to delete any such material.

   Key points advised:
   - All emails and WhatsApp messages relevant to the matters under investigation must be preserved immediately.
   - No material is to be deleted.
   - The client is to upload the company bank statements for the period September 2025 to January 2026 by 16 March 2026.

   Reasoning behind advice and decisions:

   I advised the client to preserve all relevant communications and documents, having considered that the emails from the finance manager and the bank statements are likely to constitute key evidential material in any subsequent board investigation, regulatory inquiry or litigation. Preservation of this material at the earliest opportunity is essential to prevent any risk of loss or destruction of evidence.

   Client's instructions and response:

   The client confirmed her understanding and instructed that she will upload the company bank statements for the period September 2025 to January 2026 by 16 March 2026. She confirmed she will preserve all relevant emails and WhatsApp messages.


**6. FORENSIC ACCOUNTANT INSTRUCTION**

   What was discussed:

   I raised with the client the need to instruct a forensic accountant to review the bank statements and related documentation once those documents have been received.

   Advice given:

   I advised the client that I will instruct a forensic accountant following receipt and initial review of the bank statements. I advised the client that the estimated fee range for the forensic accountant's instruction is £5,000 to £8,000 plus VAT, subject to partner approval.

   Key points advised:
   - Forensic accountant instruction will follow receipt of the bank statements.
   - Estimated forensic accountant fees: £5,000 to £8,000 plus VAT.
   - Instruction is subject to partner approval.

   Reasoning behind advice and decisions:

   I considered that independent forensic analysis of the bank statements is necessary to provide a reliable evidential basis for the board briefing note and for any subsequent steps, given the complexity and quantum of the transfers under review and the need for findings that will withstand scrutiny before the board, any regulator, or a court.

   Client's instructions and response:

   The client noted the estimated fee range and confirmed her understanding that forensic instruction is subject to partner approval.


**7. NEXT STEPS**

   Solicitor to action:

   1. Review company bank statements for the period September 2025 to January 2026 upon receipt from the client and prepare a privileged factual briefing note for the non-executive directors of Northstar Logistics Ltd.
      Due: 20 March 2026

   2. Instruct a forensic accountant to review the bank statements and related documentation.
      Due: Upon receipt of bank statements and subject to partner approval

   Client to action:

   1. Preserve all emails and WhatsApp messages relevant to this matter; no material to be deleted.
      Due: Immediately

   2. Upload company bank statements for the period September 2025 to January 2026.
      Due: 16 March 2026

   Next appointment: This was not discussed on this occasion.


Time Engaged: 1 hour 20 minutes

This attendance note is subject to legal professional privilege.

Prepared by: James Thornton, Corporate Partner
Date Prepared: 12 March 2026
```

### Clean baseline warnings (attendance)

_None._

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