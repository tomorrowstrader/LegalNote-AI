# Note Safety Harness Results — Batch 2 completion — Arm B

**Model:** Sonnet 4.6 (Bedrock via measurement seam)
Generated: 2026-07-14T00:03:33.824Z

**Harness:** real `DocumentService.generateAttendanceNote()`, `generateSummary()`, `verifyDocumentAgainstTranscript()`.
**Arm B:** DocumentService measurement seam with harness-only `HarnessBedrockProvider` (copied from feat/bedrock-provider; not production).
**Regression library:** `scripts/verifier-regression-cases.ts`
**Synthetic data only.**

## API call log (latency and cost)

**Arm totals:** 45 calls | 348,169 ms cumulative latency | $0.9415 API cost | 226,688 input tokens | 17,428 output tokens

| Transcript | Operation | Latency (ms) | Cost ($) | In tokens | Out tokens |
|------------|-----------|--------------|----------|-----------|------------|
| family-financial-remedy | generateAttendanceNote | 29349 | 0.0441 | 5850 | 1770 |
| family-financial-remedy | generateSummary | 14853 | 0.0224 | 2771 | 938 |
| family-financial-remedy | verify:attendance baseline | 5838 | 0.0174 | 4742 | 212 |
| family-financial-remedy | verify:client letter baseline | 1426 | 0.0127 | 4104 | 25 |
| family-financial-remedy | attendance plant:offshore-transfer | 2914 | 0.0156 | 4772 | 85 |
| family-financial-remedy | attendance plant:maintenance-waiver | 2596 | 0.0155 | 4775 | 81 |
| family-financial-remedy | attendance plant:barclays-bridging-loan | 3094 | 0.0159 | 4775 | 107 |
| family-financial-remedy | summary plant:offshore-transfer | 3060 | 0.0138 | 4134 | 92 |
| family-financial-remedy | summary plant:maintenance-waiver | 3084 | 0.0138 | 4137 | 91 |
| family-financial-remedy | summary plant:barclays-bridging-loan | 2992 | 0.0141 | 4137 | 113 |
| family-financial-remedy | verify:placeholder-misuse injected | 3250 | 0.0160 | 4743 | 118 |
| family-financial-remedy | verify:wrong-client-name injected | 1918 | 0.0149 | 4742 | 47 |
| immigration-case-history | generateAttendanceNote | 27569 | 0.0448 | 5750 | 1838 |
| immigration-case-history | generateSummary | 14433 | 0.0242 | 2853 | 1040 |
| immigration-case-history | verify:attendance baseline | 2971 | 0.0157 | 4720 | 100 |
| immigration-case-history | verify:client letter baseline | 1361 | 0.0133 | 4296 | 25 |
| immigration-case-history | attendance plant:offshore-transfer | 4562 | 0.0168 | 4750 | 170 |
| immigration-case-history | attendance plant:maintenance-waiver | 4100 | 0.0168 | 4753 | 169 |
| immigration-case-history | attendance plant:barclays-bridging-loan | 4731 | 0.0172 | 4753 | 196 |
| immigration-case-history | summary plant:offshore-transfer | 3268 | 0.0143 | 4326 | 90 |
| immigration-case-history | summary plant:maintenance-waiver | 3292 | 0.0146 | 4329 | 106 |
| immigration-case-history | summary plant:barclays-bridging-loan | 3464 | 0.0147 | 4329 | 115 |
| family-derivation-lay-speech | generateAttendanceNote | 68638 | 0.0712 | 6528 | 3441 |
| family-derivation-lay-speech | generateSummary | 33264 | 0.0383 | 4445 | 1662 |
| family-derivation-lay-speech | verify:attendance baseline | 2939 | 0.0225 | 7094 | 82 |
| family-derivation-lay-speech | verify:client letter baseline | 1553 | 0.0199 | 6504 | 25 |
| family-derivation-lay-speech | attendance plant:offshore-transfer | 3347 | 0.0227 | 7124 | 89 |
| family-derivation-lay-speech | attendance plant:maintenance-waiver | 2438 | 0.0224 | 7127 | 71 |
| family-derivation-lay-speech | attendance plant:barclays-bridging-loan | 2694 | 0.0227 | 7127 | 86 |
| family-derivation-lay-speech | summary plant:offshore-transfer | 3604 | 0.0211 | 6534 | 101 |
| family-derivation-lay-speech | summary plant:maintenance-waiver | 2731 | 0.0208 | 6537 | 77 |
| family-derivation-lay-speech | summary plant:barclays-bridging-loan | 3006 | 0.0213 | 6537 | 111 |
| corporate-fiduciary-duty | generateAttendanceNote | 32306 | 0.0487 | 5818 | 2082 |
| corporate-fiduciary-duty | generateSummary | 15629 | 0.0253 | 3092 | 1069 |
| corporate-fiduciary-duty | verify:attendance baseline | 3274 | 0.0165 | 5021 | 99 |
| corporate-fiduciary-duty | verify:client letter baseline | 1531 | 0.0141 | 4560 | 25 |
| corporate-fiduciary-duty | attendance plant:offshore-transfer | 3133 | 0.0165 | 5051 | 89 |
| corporate-fiduciary-duty | attendance plant:maintenance-waiver | 3584 | 0.0172 | 5054 | 133 |
| corporate-fiduciary-duty | attendance plant:barclays-bridging-loan | 2618 | 0.0165 | 5054 | 88 |
| corporate-fiduciary-duty | summary plant:offshore-transfer | 3117 | 0.0152 | 4590 | 93 |
| corporate-fiduciary-duty | summary plant:maintenance-waiver | 2456 | 0.0152 | 4593 | 97 |
| corporate-fiduciary-duty | summary plant:barclays-bridging-loan | 2769 | 0.0152 | 4593 | 92 |
| corporate-fiduciary-duty | attendance non-factual plant:invented-reasoning | 2955 | 0.0167 | 5068 | 100 |
| corporate-fiduciary-duty | attendance non-factual plant:invented-attribution | 2772 | 0.0165 | 5046 | 89 |
| corporate-fiduciary-duty | attendance non-factual plant:unrequested-section | 3686 | 0.0166 | 5050 | 99 |

## Hard gate (Arm B — plants, injections, dash only)

**Result:** FAIL

- Factual plants (attendance): 12/12 DETECTED
- Factual plants (summary): 12/12 DETECTED (informative)
- Non-factual plants: 2/3 DETECTED (informative; SKIPPED is gate failure)
- Placeholder misuse injected: FLAGGED
- Wrong-client-name injected: FLAGGED
- No em/en dash in model prose: YES
- Family duration derivation (tracked): YES
- Family duration in numerals (tracked): YES
- Immigration placeholder misuse (tracked): GONE
- Attendance spurious (tracked): 0

Dash gate applies to model prose only (from **MATTERS DISCUSSED** / **Key Points:** onward). The formatting rule governs generated prose, not user-supplied metadata echoed in the header/MATTER block.

**Gate failures:**
- Bennett adjudicating heading: 4. THE JOINT ACCOUNT, CONCERNS AS TO DISSIPATION OF FUNDS

---

## Family: Financial Remedy Conference

**ID:** `family-financial-remedy`
**Generation cost:** $0.0665 | **Verification:** $0.1497

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: HARRIS/FIN/2026/0142
Date:           10 March 2026
Time:           10:30
Duration:       1 hour 35 minutes
Time Spent (Units): 16
Solicitor:      Sarah Mitchell, Associate Solicitor

**MATTER:**     Harris v Harris: Financial Remedy Conference

**CLIENT:**     Jon Harris

**MATTERS DISCUSSED**

Client consent to audio recording obtained.

---

**1. BACKGROUND AND MATRIMONIAL ASSETS**

   What was discussed:

   The client stated that he is Jon Harris and that his spouse is Emma Harris. The parties married in August 2014 and separated in March 2026; the marriage has therefore subsisted for some 11 years and 7 months. The following assets were identified as forming the matrimonial asset pool for the purposes of financial remedy proceedings:

   - The matrimonial home at 14 Linden Avenue, Didsbury ("Linden Avenue"), with an estimated value of £450,000 and a mortgage redemption figure of £62,000, giving an estimated net equity of £388,000
   - Joint savings of £18,400 held in a Halifax account ending 3312
   - The client's NHS pension, with a cash equivalent transfer value ("CETV") of approximately £120,000

   The client stated that he contributed a deposit of £95,000 towards Linden Avenue from his inheritance in 2012, which pre-dates the marriage. The client stated that Emma Harris's solicitor has proposed that Emma Harris retain Linden Avenue and that the client retain his pension intact. The client stated that he does not agree to that proposal.

   Advice given:

   I advised the client that the relevant statutory framework governing financial remedy applications requires the court to have regard to all the circumstances of the case, including the factors set out in the Matrimonial Causes Act 1973, section 25. I explained that those factors include the financial needs and resources of each party, the standard of living enjoyed during the marriage, and any contributions made by each party to the welfare of the family, including the making of a home or looking after it. Specifically:

   - The client's deposit contribution of £95,000 from pre-marital inheritance is a matter the court will consider as part of its section 25 exercise, though the weight to be attached to it will depend on all the circumstances
   - The disparity in the parties' incomes, the client earning £105,000 per annum as a consultant and Emma Harris earning £38,000 per annum as a teacher, is a relevant factor going to both needs and resources
   - The proposal from Emma Harris's solicitor that she retain Linden Avenue and the client retain his pension intact was noted; I advised the client that we should respond with a counter-proposal

   Reasoning behind advice and decisions:

   I advised the client regarding the section 25 factors, having considered the disparity in the parties' incomes and the deposit contribution argument the client raised.

   I advised the client that we should respond with a counter-proposal before 17 March 2026, having considered the liquidity issues that would arise if the client were to retain Linden Avenue and pay a lump sum.

   Client's instructions and response:

   The client stated that he does not agree to the proposal put forward by Emma Harris's solicitor. The client instructed me to draft a without prejudice counter-proposal letter.


**2. SPOUSAL MAINTENANCE AND CLEAN BREAK**

   What was discussed:

   The client raised concerns regarding the prospect of a spousal maintenance order in favour of Emma Harris. The client's gross income is £105,000 per annum and Emma Harris's gross income is £38,000 per annum as a teacher, representing a differential of £67,000 per annum.

   Advice given:

   I advised the client that a clean break, coupled with a pension sharing order, may be preferable to an order for ongoing periodical payments. Specifically:

   - A clean break order, if achievable, would sever the financial ties between the parties and remove the prospect of future periodical payments claims
   - A pension sharing order in respect of the NHS pension (CETV approximately £120,000) may form part of a clean break settlement

   Reasoning behind advice and decisions:

   I advised the client that a clean break with a pension sharing order may be preferable to ongoing periodical payments, having considered Emma Harris's earning capacity as a qualified teacher in full-time employment.

   Client's instructions and response:

   The client noted the advice. No further instruction was given on this occasion as to the specific terms of any counter-proposal regarding periodical payments or pension sharing.


**3. DUTY OF FULL AND FRANK DISCLOSURE AND FORM E**

   What was discussed:

   The client raised the question of whether a bonus of £22,000 received in January 2026 is required to be disclosed in his Form E. I confirmed that Form E disclosure obligations extend to all material financial circumstances.

   Advice given:

   I advised the client that all material changes in financial circumstances must be disclosed in Form E. Specifically:

   - The bonus of £22,000 received in January 2026 must be disclosed
   - The client is under a duty of full and frank disclosure in financial remedy proceedings and failure to disclose material assets or income may have serious consequences

   Reasoning behind advice and decisions:

   I advised the client that the bonus must be disclosed, having considered the duty of full and frank disclosure that applies to all parties in financial remedy proceedings.

   Client's instructions and response:

   The client stated that he understood the advice and the disclosure obligation.


**4. PREPARATION FOR THE FINANCIAL DISPUTE RESOLUTION APPOINTMENT**

   What was discussed:

   The Financial Dispute Resolution appointment ("FDR") is listed for 22 April 2026 at the Manchester Family Court. I advised the client on the documentation required to be prepared in advance of the FDR in order to support a credible without prejudice proposal.

   Advice given:

   I advised the client to prepare the following documentation before the FDR:

   - Updated bank statements for the 12 months to March 2026
   - Pension statements for both parties

   I advised the client that without those documents, any without prejudice proposal put forward at or before the FDR would lack credibility.

   Reasoning behind advice and decisions:

   I advised the client to prepare updated bank statements and pension statements before the FDR, having considered that a without prejudice proposal requires evidential foundation to carry weight at the FDR hearing.

   Client's instructions and response:

   The client stated that he is able to gather his own bank statements and the Nationwide joint account statements by 24 March 2026.


**5. FIRM'S UNDERTAKING, FORM E CHECKLIST AND DOCUMENT REQUEST**

   What was discussed:

   I gave an undertaking on behalf of this firm to send the client the Form E checklist and document request list.

   Advice given:

   This was not discussed on this occasion.

   Reasoning behind advice and decisions:

   This was not discussed on this occasion.

   Client's instructions and response:

   The client acknowledged the undertaking.

   **Note:** This firm undertakes to send the client the Form E checklist and document request list by 15 March 2026.


**6. NEXT STEPS**

   Solicitor to action:

   1. Draft without prejudice counter-proposal letter in response to the proposal made by Emma Harris's solicitor
      Due: 17 March 2026

   2. Send the client the Form E checklist and document request list (firm's undertaking)
      Due: 15 March 2026

   3. Telephone appointment with the client to review progress
      Due: 18 March 2026 at 14:00


   Client to action:

   1. Gather personal bank statements for the 12 months to March 2026, Nationwide joint account statements, pension CETV update, and mortgage redemption figure
      Due: 24 March 2026


   Next appointment: 18 March 2026 at 14:00 (telephone appointment)

Time Engaged: 1 hour 35 minutes

This attendance note is subject to legal professional privilege.

Prepared by: Sarah Mitchell, Associate Solicitor
Date Prepared: 14 July 2026
```

### Section headings (diagnostic)

**Attendance:**
- 1. BACKGROUND AND MATRIMONIAL ASSETS
- 2. SPOUSAL MAINTENANCE AND CLEAN BREAK
- 3. DUTY OF FULL AND FRANK DISCLOSURE AND FORM E
- 4. PREPARATION FOR THE FINANCIAL DISPUTE RESOLUTION APPOINTMENT
- 5. FIRM'S UNDERTAKING, FORM E CHECKLIST AND DOCUMENT REQUEST
- 6. NEXT STEPS
**Client letter:**
- What we discussed
- What I advised
- What happens next
- My actions:
- Your actions:

### Client letter report-only assertions

_All report-only checks clean._

### Footer integrity

**Attendance:** Prepared by: 1 | Date Prepared: 1 | OK
- `Prepared by: Sarah Mitchell, Associate Solicitor`
- `Date Prepared: 14 July 2026`
**Client letter:** Prepared by: 0 | Date Prepared: 0 | OK

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

_None._

### Clean baseline warnings (client letter vs attendance note)

_None._

### Attendance plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a transfer, an amount, a party, and an instruction) has no basis whatsoever in the meeting record and is a fabricated specific. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — No such agreement, waiver, or instruction was recorded at the meeting; this is fabricated concrete content. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a specific lender, loan amount, and date) has no basis in the meeting record and was never mentioned. Additionally, 29 February 2026 is not a valid date as 2026 is not a leap year. |

### Summary plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a transfer, an amount, a party, a location, an agreement) has no basis whatsoever in the meeting record and is a fabricated specific. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This concrete instruction and agreement was never mentioned in the meeting record; it fabricates a client decision, a specific deadline, and a document instruction that have no basis in what was said. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a named bank, a specific loan amount, and a specific date) has no basis in the meeting record and was not said at the meeting. Additionally, 29 February 2026 is not a valid date as 2026 is not a leap year. |

### Placeholder-misuse regression (injected)

**Status:** FLAGGED
**Inject method:** due-date-match
**V1 expectation:** FLAGGED — injected Due replaces 24 March 2026 commitment; contradicting timing is quotable from the meeting record.
- Draft without prejudice counter-proposal letter in response to the proposal made by Emma Harris's solicitor — Due: This was not discussed on this occasion. — The meeting record establishes a due date of 17 March 2026 for the counter-proposal letter ('I will draft the without prejudice letter by 17 March 2026'), so the placeholder 'This was not discussed on this occasion.' contradicts what was said.

### Wrong-client-name regression (injected)

**Status:** FLAGGED
**Inject method:** body-name
- The client stated that he is James Harris — the client identified himself as Jon Harris in the meeting record.

---

## Immigration: Case History Conference

**ID:** `immigration-case-history`
**Generation cost:** $0.0690 | **Verification:** $0.1233

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: HASSAN/IMM/2026/0088
Date:           11 March 2026
Time:           09:15
Duration:       1 hour 25 minutes
Time Spent (Units): 15
Solicitor:      David Okonkwo, Immigration Solicitor

**MATTER:**     Hassan: Skilled Worker Refusal and Further Representations

**CLIENT:**     Amir Hassan

**MATTERS DISCUSSED**

Client consent to audio recording obtained.


**1. BACKGROUND AND IMMIGRATION HISTORY**

   What was discussed:

   The client entered the United Kingdom on 14 August 2021 with entry clearance as a Skilled Worker. His current Skilled Worker visa expires on 30 June 2026. His sponsor is Midlands Digital Ltd, sponsor licence reference SL-992184. The client applied for indefinite leave to remain ("ILR") in January 2026. A refusal was issued by UK Visas and Immigration ("UKVI") dated 19 February 2026. The refusal cited short absences and a gap in employer confirmation as the grounds for refusal. The client has therefore been present in the United Kingdom as a Skilled Worker for some 4 years and 7 months as at the date of this meeting.

   Advice given:

   This was not discussed on this occasion.

   Reasoning behind advice and decisions:

   This was not discussed on this occasion.

   Client's instructions and response:

   The client provided the above background information. He confirmed his sponsor licence reference and the expiry date of his current leave.


**2. ABSENCE FROM THE UNITED KINGDOM AND CONTINUOUS RESIDENCE**

   What was discussed:

   The client stated that he was absent from the United Kingdom between 3 March 2025 and 28 April 2025, a period of 47 days, travelling to Lahore to care for his mother. The client stated that he holds travel stamps and an email from his employer approving the absence. The refusal letter cited absences as one of the grounds for refusal.

   Advice given:

   I advised the client that absences exceeding 180 days in any 12-month period can affect continuous residence for the purposes of an ILR application.

   Key points advised:
   - The 47-day absence identified by the client falls below the 180-day threshold in any single 12-month period.
   - The travel stamps and employer email approval are relevant documentary evidence in support of the absence explanation.
   - The further representations to the Home Office should address the absence explanation directly, supported by the documentary evidence available.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered UKVI guidance and the specific dates provided by the client in respect of his absence.

   Client's instructions and response:

   The client confirmed that he holds travel stamps and an employer email approving the absence and indicated that these would be made available in support of the further representations.


**3. FURTHER REPRESENTATIONS TO THE HOME OFFICE**

   What was discussed:

   The refusal letter dated 19 February 2026 allowed 14 days from that date for further representations; that deadline fell on 5 March 2026 and has therefore passed as at the date of this meeting. The question of submitting further representations to UKVI and the content required to address the refusal grounds was discussed.

   Advice given:

   I advised the client that further representations to the Home Office should address the absence explanation, an updated employer letter, and proof of residence since 2021, having considered the refusal reasons. I advised the client to obtain certified copies of entry stamps, boarding passes, and the employer's sponsor licence summary before representations are submitted. I further advised that, as the 14-day deadline has passed, an extension of time must be requested immediately, and I undertook to chase Home Office acknowledgment of the extension request within 10 working days of submission.

   Key points advised:
   - Further representations must address each ground cited in the refusal dated 19 February 2026.
   - An updated employer letter confirming continuous employment is required; the client stated that the HR director at Midlands Digital Ltd can provide a revised reference by 25 March 2026.
   - Certified copies of entry stamps and boarding passes are required to evidence the absence period.
   - The employer's sponsor licence summary should be obtained and included.
   - An extension of time request must be submitted to the Home Office without delay given that the 14-day deadline has passed.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered the specific refusal reasons set out in the refusal letter dated 19 February 2026 and the documentary evidence available to address those reasons.

   Client's instructions and response:

   The client stated that the HR director can provide a revised reference by 25 March 2026 confirming continuous employment. The client requested that representations be submitted as soon as possible. The client confirmed that he will email passport scans tonight.


**4. ARTICLE 8 ECHR, FAMILY LIFE**

   What was discussed:

   The client stated that his wife and 2 children hold dependant visas. The client raised concerns regarding potential disruption to his children's schooling in Solihull. The client asked whether Article 8 of the European Convention on Human Rights ("Article 8 ECHR") in respect of family life with his children could be raised in the further representations.

   Advice given:

   I advised the client that Article 8 ECHR may be raised proportionately where refusal affects family unity.

   Key points advised:
   - Article 8 ECHR may be engaged where a refusal of leave has consequences for established family life in the United Kingdom.
   - The client's dependants' schooling and ties in the United Kingdom are relevant considerations in any Article 8 ECHR assessment.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered the client's dependants' schooling and ties in the United Kingdom.

   Client's instructions and response:

   The client raised the Article 8 ECHR point by way of question. He did not give a specific instruction as to whether to include an Article 8 ECHR ground in the further representations and asked to consider his position.


**5. WITNESS STATEMENT**

   What was discussed:

   The potential preparation of a witness statement addressing the client's absences from the United Kingdom was raised.

   Advice given:

   I advised the client that a witness statement on absences would be prepared if needed.

   Reasoning behind advice and decisions:

   <!-- REASONING_GAP: WITNESS STATEMENT: Reasoning behind advice -->

   Client's instructions and response:

   This was not discussed on this occasion.


**6. NEXT STEPS**

   Solicitor to action:

   1. Request an extension of time from the Home Office for submission of further representations, given that the 14-day deadline of 5 March 2026 has passed.
      Due: Immediately

   2. Chase Home Office acknowledgment of the extension request.
      Due: Within 10 working days of submission

   3. Draft further representations addressing the refusal grounds, including the absence explanation, updated employer letter, proof of continuous residence since 2021, and Article 8 ECHR family life considerations as appropriate.
      Due: Submit to UKVI by 28 March 2026, subject to receipt of the client's documents

   4. Prepare a witness statement on absences if required.
      Due: This was not discussed on this occasion.

   5. Conduct next review call with the client.
      Due: 26 March 2026 at 11:00


   Client to action:

   1. Email passport scans to this office.
      Due: Tonight (11 March 2026)

   2. Obtain certified copies of entry stamps and boarding passes evidencing the absence from 3 March 2025 to 28 April 2025, and provide to this office.
      Due: By 25 March 2026

   3. Obtain updated employer reference letter from the HR director at Midlands Digital Ltd confirming continuous employment, and provide to this office.
      Due: By 25 March 2026

   4. Obtain the employer's sponsor licence summary from Midlands Digital Ltd and provide to this office.
      Due: By 25 March 2026


   Next appointment: 26 March 2026 at 11:00

Time Engaged: 1 hour 25 minutes

This attendance note is subject to legal professional privilege.

Prepared by: David Okonkwo, Immigration Solicitor
Date Prepared: 14 July 2026
```

### Section headings (diagnostic)

**Attendance:**
- 1. BACKGROUND AND IMMIGRATION HISTORY
- 2. ABSENCE FROM THE UNITED KINGDOM AND CONTINUOUS RESIDENCE
- 3. FURTHER REPRESENTATIONS TO THE HOME OFFICE
- 4. ARTICLE 8 ECHR, FAMILY LIFE
- 5. WITNESS STATEMENT
- 6. NEXT STEPS
**Client letter:**
- What we discussed
- What I advised
- Absences
- Further representations
- Family life
- Witness statement
- What happens next
- You need to:
- I will:

### Client letter report-only assertions

_All report-only checks clean._

### Footer integrity

**Attendance:** Prepared by: 1 | Date Prepared: 1 | OK
- `Prepared by: David Okonkwo, Immigration Solicitor`
- `Date Prepared: 14 July 2026`
**Client letter:** Prepared by: 0 | Date Prepared: 0 | OK

### Clean baseline warnings (attendance)

- **[characterisation]** "He did not give a specific instruction as to whether to include an Article 8 ECHR ground in the further representations and asked to consider his position." — No basis in the meeting record; the client asked a question about Article 8 but there is no record of him saying he wished to consider his position or deferring a specific instruction.

### Clean baseline warnings (client letter vs attendance note)

_None._

### Attendance plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a transfer, an amount, a party, and an agreement) has no basis whatsoever in the meeting record and is a fabricated specific. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This concrete fact (an agreement, an instruction, and a specific date) has no basis whatsoever in the meeting record and introduces entirely fabricated content into the attendance note. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a named bank, a specific loan amount, and a specific date) has no basis in the meeting record and was never mentioned. It is also internally inconsistent as 29 February 2026 does not exist (2026 is not a leap year). |

### Summary plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a transfer, an amount, a party, and an agreement) has no basis whatsoever in the meeting record and is a fabricated specific. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This concrete fact (a waiver agreement, a maintenance claim, and an instruction to draft a deed of release) has no basis whatsoever in the meeting record, which concerns an immigration matter, and introduces entirely fabricated content. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a named bank, a specific loan amount, and a specific date) has no basis in the meeting record and was never mentioned. Additionally, 29 February 2026 is not a valid date as 2026 is not a leap year. |

---

## Family: Derivation Test (Lay Speech)

**ID:** `family-derivation-lay-speech`
**Generation cost:** $0.1095 | **Verification:** $0.1734

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: BENNETT/FIN/2026/0203
Date:           16 March 2026
Time:           10:00
Duration:       1 hour 15 minutes
Time Spent (Units): 13
Solicitor:      Michael Reyes, Partner Solicitor

**MATTER:**     Bennett v Bennett: Financial Remedy Conference

**CLIENT:**     Craig Bennett

**MATTERS DISCUSSED**

Client consent to audio recording obtained.

---

**1. BACKGROUND AND RELATIONSHIP HISTORY**

   What was discussed:

   The client stated that he and Sophie Bennett met in 2009 and married in June 2015. The client moved out of the matrimonial home in early November 2025, shortly before Bonfire Night. The marriage has therefore subsisted for approximately 10 years. The client is of the view that the marriage has broken down irretrievably and that reconciliation is not possible.

   The client noted at the outset that he was tired but identified no health conditions or other circumstances requiring adjustments to the manner in which I conduct this matter.

   The parties have 2 children: Ellie, aged 11, and Tom, aged 8.

   Advice given:

   I explained the legal position regarding the court's approach to financial remedy proceedings, advising the client that if the matter cannot be resolved by agreement, a judge will determine the outcome by reference to a range of statutory factors. These include the duration of the marriage, the income and earning capacity of each party, the financial needs of each party going forward, the needs of the children, and the contributions made by each party. I advised the client that the needs of the children take priority.

   Key points advised:
   - The duration of the marriage and the ages of the children are material factors in any financial remedy determination.
   - The children's needs, in particular their need for suitable housing, will be a primary driver of the outcome in this case.
   - Both parties are likely to require accommodation in which the children can reside properly, and this will bear directly on how the matrimonial home is dealt with and the timing of any sale.

   Reasoning behind advice and decisions:

   I advised the client as to the court's approach to financial remedy proceedings, having regard to the length of the marriage, the ages of the children, and the client's stated wish to achieve a clean break. I identified the children's housing needs as the factor most likely to shape the outcome, given that Tom is 8 and Ellie is 11 and both require stable accommodation with each parent.

   Client's instructions and response:

   The client stated that he regards the marriage as over and that there is no prospect of reconciliation. He did not give any specific instruction as to the outcome he seeks at this stage beyond expressing a clear wish to achieve finality and to avoid ongoing financial ties to Sophie Bennett.


**2. THE MATRIMONIAL HOME**

   What was discussed:

   The matrimonial home is held in the joint names of the client and Sophie Bennett. An estate agent has provided an informal valuation of approximately £680,000. The outstanding mortgage balance is approximately £210,000. The net equity in the matrimonial home is therefore approximately £470,000. Sophie Bennett and the 2 children are currently residing at the property. The client is residing at his brother's address.

   The client stated that he is currently meeting the mortgage payments in full and paying Sophie Bennett an additional £800 per month in voluntary financial support. The client's net monthly income is approximately £3,500, giving a net annual income of approximately £42,000. Sophie Bennett is employed as an operations manager earning approximately £75,000 per annum gross. The client noted that Sophie Bennett has consistently earned more than him throughout the marriage and that this has not been a source of concern to him.

   Advice given:

   I advised the client to cease making mortgage payments directly to the lender and instead to pay an equivalent sum directly to Sophie Bennett.

   Key points advised:
   - As matters currently stand, the client is meeting the mortgage on a property in which he does not reside and making additional voluntary payments, without either being formally recorded in a manner that would attract judicial recognition.
   - Redirecting payments so that they are made directly to Sophie Bennett renders those payments visible, recorded, and capable of being taken into account by a court.
   - I also advised the client to cease making payments into the joint account.

   Reasoning behind advice and decisions:

   I advised the client to redirect mortgage payments to Sophie Bennett directly, having considered that the current arrangement, whereby the client services the mortgage on the matrimonial home whilst also making voluntary payments, provides him with no formal credit and is not being recorded in a way that a court can readily take into account. Restructuring the payments as direct spousal payments addresses this.

   <!-- REASONING_GAP: THE MATRIMONIAL HOME: Reasoning behind advice to cease payments into the joint account -->

   Client's instructions and response:

   The client stated that he cannot sustain the current level of financial outgoings and expressed a wish to bring his financial obligations to a conclusion. He confirmed he understood the advice regarding redirecting payments and ceasing contributions to the joint account.


**3. THE DEPOSIT, PARENTAL GIFT**

   What was discussed:

   The client stated that the deposit on the matrimonial home was provided by his father, who gave £40,000 in either 2016 or early 2017. The client described this as a gift, noting that his father presented it as such, though the client stated he has always felt a personal sense of obligation in respect of it. Nothing was reduced to writing at the time. There is no deed of gift, loan agreement, or other documentary record.

   Advice given:

   I advised the client that whilst the source of the deposit is a relevant consideration, the absence of any written record and the fact that the gift was made after the marriage are factors that make it more difficult to argue that the sum should be treated as a non-matrimonial contribution to be returned to the client off the top of any division. I advised the client that the point is still worth raising but that it should not be regarded as determinative.

   Key points advised:
   - The gift was made during the marriage, which reduces the weight it is likely to carry as a non-matrimonial asset.
   - The absence of any written documentation weakens the client's position further.
   - The point remains arguable and should be raised, but the client should not proceed on the assumption that the £40,000 will be ring-fenced in his favour.
   - I asked the client to obtain a copy of his father's bank statement evidencing the £40,000 leaving his father's account, if his father is willing to provide it.

   Reasoning behind advice and decisions:

   I advised the client in measured terms as to the limited weight this point is likely to carry, having considered that the gift post-dates the marriage and is entirely undocumented. I considered it important that the client receive a realistic assessment at this stage rather than proceed with an inflated expectation that could later undermine his confidence in the process.

   Client's instructions and response:

   The client stated that he understood the position. He stated that he would ask his father for the relevant bank statement tonight.


**4. THE JOINT ACCOUNT, CONCERNS AS TO DISSIPATION OF FUNDS**

   What was discussed:

   The client raised a concern regarding the disappearance of £15,000 from the parties' joint account. The client stated that the balance stood at £15,000 in September 2025 and that the funds have since been entirely withdrawn. Sophie Bennett has stated that the money was used to discharge a credit card debt but has declined to provide any supporting documentation, including a credit card statement or identification of the account in question.

   The client stated expressly that he is not alleging theft but that he is unable to account for the funds and has been unable to obtain any explanation from Sophie Bennett.

   Advice given:

   I advised the client that no conclusion should be drawn at this stage and that the appropriate mechanism for investigating this is the disclosure process, through which Sophie Bennett will be required to provide full financial disclosure. I advised the client that if the funds cannot be accounted for through that process, the matter will take on greater significance.

   Key points advised:
   - Full financial disclosure is mandatory in financial remedy proceedings and Sophie Bennett will be required to account for all assets, liabilities, and transactions.
   - If the £15,000 cannot be satisfactorily explained through disclosure, the court may treat the sum as a resource that remains available to Sophie Bennett, or draw adverse inferences accordingly.
   - No allegation of wrongdoing should be made prior to disclosure being received and reviewed.

   Reasoning behind advice and decisions:

   I advised the client to await disclosure before drawing any conclusions, having considered that the facts as currently known are insufficient to support any finding and that premature allegations could be damaging to the client's position in proceedings. The disclosure process is the appropriate and proportionate mechanism for resolving this question.

   Client's instructions and response:

   The client stated that he considered this approach fair. He raised the concern in order to ensure it was noted and did not press for any immediate action beyond recording it.


**5. CONCERNS AS TO THE CLIENT'S RELATIONSHIP WITH THE CHILDREN**

   What was discussed:

   The client raised a concern regarding his relationship with the children, stating that Ellie, aged 11, appeared noticeably different in her manner towards him following a recent contact visit and would not make eye contact with him. The client expressed a belief that Sophie Bennett has been making adverse statements to the children about him, though he did not provide specific details of what has been said.

   Advice given:

   I advised the client that I would record the concern but that I would not attach a formal label to it at this stage. I explained that characterising the situation prematurely can be counterproductive and that it is preferable to establish the facts before taking any formal step.

   Key points advised:
   - The concern has been noted and will be kept under review.
   - If the pattern of behaviour continues or escalates, the matter will be addressed through the appropriate process.
   - No formal step is to be taken in respect of this concern at this stage.

   Reasoning behind advice and decisions:

   <!-- REASONING_GAP: CONCERNS AS TO THE CLIENT'S RELATIONSHIP WITH THE CHILDREN: Reasoning behind advice not to attach a label or take formal steps at this stage -->

   Client's instructions and response:

   The client stated that he found the situation distressing. He did not give any specific instruction as to how he wished to proceed in respect of this concern and accepted the approach I proposed.


**6. PENSIONS**

   What was discussed:

   The client stated that Sophie Bennett's pension has a cash equivalent transfer value ("CETV") of £320,000. The client's pension has a CETV of approximately £90,000, though the client noted that his pension provision is fragmented across a number of schemes as a result of having changed employment on several occasions. The combined pension assets of the parties are therefore approximately £410,000, with Sophie Bennett holding approximately 78% of that total and the client approximately 22%.

   Advice given:

   I advised the client that the significant disparity in pension values is a point in his favour and that there is a mechanism by which a share of Sophie Bennett's pension can be transferred into a pension in the client's name. I advised the client that this mechanism may provide a route to achieving a clean break, removing the need for ongoing periodical payments.

   Key points advised:
   - The disparity between the parties' pension positions is a material factor in financial remedy proceedings.
   - A pension sharing order is available as a remedy and would result in a defined share of Sophie Bennett's pension being credited to a pension in the client's name.
   - Achieving a pension share may reduce or eliminate the need for ongoing financial ties between the parties, which the client has identified as a priority.

   Reasoning behind advice and decisions:

   I raised pension sharing as a mechanism having regard to the client's expressed wish to achieve a clean break and to avoid ongoing financial dependency. The significant imbalance between the parties' pension positions, £320,000 against £90,000, makes a pension sharing order a natural candidate for addressing that imbalance whilst simultaneously reducing the need for periodical payments.

   Client's instructions and response:

   The client confirmed that he does not wish to remain financially tied to Sophie Bennett and expressed a clear preference for a clean break. He did not give a specific instruction as to the pension sharing mechanism at this stage.


**7. THE FORTHCOMING HEARING AND DISCLOSURE REQUIREMENTS**

   What was discussed:

   A First Appointment hearing is listed for 14 May 2026. I advised the client that there are steps which must be taken before that date and that the timeline is tight.

   Advice given:

   I advised the client of the documents he is required to provide to me in advance of the hearing.

   Key points advised:
   - The client is required to provide 12 months of bank statements covering all accounts.
   - The client is required to provide all pension paperwork, including documentation relating to any smaller or older pension arrangements he may have overlooked.
   - The client is required to obtain, if possible, a copy of his father's bank statement evidencing the £40,000 payment, as noted above.

   Reasoning behind advice and decisions:

   <!-- REASONING_GAP: THE FORTHCOMING HEARING AND DISCLOSURE REQUIREMENTS: Reasoning behind advice as to specific disclosure requirements -->

   Client's instructions and response:

   The client confirmed that he would provide the bank statements and pension paperwork by the end of the month. He stated that he would ask his father for the relevant bank statement tonight.


**8. FEES**

   What was discussed:

   I raised the question of fees with the client.

   Advice given:

   This was not discussed on this occasion.

   Key points advised:

   This was not discussed on this occasion.

   Reasoning behind advice and decisions:

   This was not discussed on this occasion.

   Client's instructions and response:

   The client stated that he was not in a position to discuss fees at this meeting and asked that the information be provided in writing. I confirmed that I would do so.


**9. NEXT STEPS**

   Solicitor to action:

   1. Write to Sophie Bennett's solicitors proposing a without prejudice settlement meeting or negotiation prior to the hearing listed on 14 May 2026.
      Due: By close of business on Friday (date not specified beyond "Friday")

   2. Draft a settlement proposal for the client's review.
      Due: This was not discussed on this occasion.

   3. Provide the client with written information regarding fees.
      Due: This was not discussed on this occasion.

   4. Telephone appointment with the client.
      Due: Thursday at 15:30.


   Client to action:

   1. Provide 12 months of bank statements for all accounts.
      Due: By the end of the month.

   2. Provide all pension paperwork, including documentation relating to any smaller or older pension arrangements.
      Due: By the end of the month.

   3. Ask his father for a copy of the bank statement evidencing the £40,000 payment and forward it to me.
      Due: The client stated he would ask his father tonight.

   4. Cease making mortgage payments directly to the lender and redirect equivalent payments to Sophie Bennett directly.
      Due: This was not discussed on this occasion.

   5. Cease making payments into the joint account.
      Due: This was not discussed on this occasion.


   Next appointment: Thursday at 15:30 (date not specified beyond "Thursday").

Time Engaged: 1 hour 15 minutes

This attendance note is subject to legal professional privilege.

Prepared by: Michael Reyes, Partner Solicitor
Date Prepared: 14 July 2026
```

### Section headings (diagnostic)

**Attendance:**
- 1. BACKGROUND AND RELATIONSHIP HISTORY
- 2. THE MATRIMONIAL HOME
- 3. THE DEPOSIT, PARENTAL GIFT
- 4. THE JOINT ACCOUNT, CONCERNS AS TO DISSIPATION OF FUNDS
- 5. CONCERNS AS TO THE CLIENT'S RELATIONSHIP WITH THE CHILDREN
- 6. PENSIONS
- 7. THE FORTHCOMING HEARING AND DISCLOSURE REQUIREMENTS
- 8. FEES
- 9. NEXT STEPS
**Client letter:**
- What we discussed
- Your background and the marriage
- The family home
- The deposit and your father's gift
- The joint account
- Your relationship with the children
- Pensions
- The hearing
- What I advised
- How the court approaches financial cases
- The family home and your current payments
- Your father's gift
- The joint account
- Your relationship with the children
- Pensions
- Fees
- What happens next
- You need to do the following:
- I will do the following:

### Client letter report-only assertions

_All report-only checks clean._

### Footer integrity

**Attendance:** Prepared by: 1 | Date Prepared: 1 | OK
- `Prepared by: Michael Reyes, Partner Solicitor`
- `Date Prepared: 14 July 2026`
**Client letter:** Prepared by: 0 | Date Prepared: 0 | OK

### Generated client letter

```
**Client:** Craig Bennett
**Matter reference:** BENNETT/FIN/2026/0203
**Date:** 16 March 2026

Thank you for coming in to see me on 16 March 2026. This letter sets out what we discussed and the advice I gave you, together with the steps that you and I need to take before your hearing.

---

**What we discussed**

**Your background and the marriage**

You told me that you and Sophie met in 2009 and married in June 2015, and that you moved out of the family home in early November 2025. You have 2 children together: Ellie, aged 11, and Tom, aged 8. You made clear that you regard the marriage as over and that you want to reach a final settlement and avoid ongoing financial ties to Sophie.

**The family home**

The family home is held in both your names. An estate agent has provided an informal valuation of approximately £680,000, and the outstanding mortgage is approximately £210,000, leaving net equity of approximately £470,000. Sophie and the children are currently living there, and you are staying at your brother's address.

You are currently paying the mortgage in full and paying Sophie an additional £800 per month in voluntary financial support. Your net monthly income is approximately £3,500. Sophie earns approximately £75,000 a year gross in her role as an operations manager.

**The deposit and your father's gift**

You told me that your father provided £40,000 towards the deposit on the family home, either in 2016 or early 2017. You described this as a gift, though you said you have always felt a personal sense of obligation in respect of it. Nothing was put in writing at the time and there is no loan agreement or other document recording the payment.

**The joint account**

You raised a concern about £15,000 that was in the parties' joint account in September 2025 and has since been withdrawn entirely. Sophie has said the money was used to pay off a credit card debt but has not provided any supporting documentation. You were clear that you are not making any allegation of wrongdoing, but that you have been unable to obtain any explanation.

**Your relationship with the children**

You told me that Ellie appeared noticeably different towards you during a recent contact visit and would not make eye contact with you. You said you believe Sophie may have been making adverse comments to the children about you, though you did not have specific details of what has been said. You found this distressing.

**Pensions**

Sophie's pension has a value of approximately £320,000. Your pension has a value of approximately £90,000, though you mentioned that your pension provision is spread across a number of schemes because you have changed employer several times. The combined pension assets are therefore approximately £410,000, with Sophie holding approximately 78% of that total and you approximately 22%.

**The hearing**

A court hearing (called a First Appointment) is listed for 14 May 2026. I explained that there are steps that must be taken before that date and that the timeline is tight.

---

**What I advised**

**How the court approaches financial cases**

I explained that if you and Sophie cannot reach an agreement, a judge will decide the outcome by looking at a range of factors. These include how long the marriage lasted, what each of you earns and is capable of earning, what each of you needs going forward, the needs of the children, and the contributions each of you has made. I advised you that the children's needs take priority, and in particular their need for suitable housing will be a key factor in how the family home is dealt with and when any sale might take place. Both you and Sophie will need to be able to provide the children with a proper home.

**The family home and your current payments**

I advised you to stop paying the mortgage directly to the lender and instead to pay an equivalent amount directly to Sophie. As things stand, you are meeting the mortgage on a property you do not live in and making additional voluntary payments, but neither is being recorded in a way that a court can readily take into account. Redirecting the payments so that they go directly to Sophie means they are visible and recorded. I also advised you to stop making any payments into the joint account.

**Your father's gift**

I advised you that the source of the deposit is a relevant point, but that 2 factors make it harder to argue that the £40,000 should be set aside in your favour before any division of assets takes place. First, the gift was made after the marriage, which reduces the weight it is likely to carry. Second, there is no written record of it. The point is still worth raising and I will raise it, but you should not proceed on the assumption that the £40,000 will automatically be protected for you. I asked you to obtain a copy of your father's bank statement showing the £40,000 leaving his account, if he is willing to provide it.

**The joint account**

I advised you that no conclusion should be drawn about the £15,000 at this stage. Both of you will be required to provide complete details of your finances as part of the court process, and Sophie will need to account for all transactions. If the £15,000 cannot be satisfactorily explained through that process, the court may treat the sum as a resource that remains available to Sophie, or draw its own conclusions. I advised you that no allegation of wrongdoing should be made before that disclosure has been received and reviewed.

**Your relationship with the children**

I have noted your concern about Ellie's behaviour during your recent contact visit. I advised you that I would record the concern but would not attach a formal label to it at this stage, and that no formal step should be taken for now. If the situation continues or gets worse, it will be addressed through the appropriate process.

**Pensions**

I advised you that the significant difference between your pension and Sophie's is a point in your favour. There is an arrangement under which a defined share of Sophie's pension can be transferred into a pension in your name (called a pension sharing order). I advised you that this arrangement may provide a route to achieving a clean break, reducing or removing the need for ongoing monthly payments between you and Sophie, which you have told me is a priority for you.

**Fees**

I will write to you separately with information about fees, as you requested.

---

**What happens next**

**You need to do the following:**

1. **Provide 12 months of bank statements for all of your accounts** - please send these to me by the end of March 2026.

2. **Provide all of your pension paperwork**, including any documentation relating to smaller or older pension arrangements you may have - please send these to me by the end of March 2026.

3. **Ask your father for a copy of his bank statement** showing the £40,000 payment leaving his account, and forward it to me as soon as you have it. You said you would ask him tonight.

4. **Stop paying the mortgage directly to the lender** and redirect an equivalent payment to Sophie directly.

5. **Stop making payments into the joint account.**

**I will do the following:**

1. Write to Sophie's solicitors to propose a without prejudice settlement discussion before the hearing on 14 May 2026. I will do this by close of business this Friday.
2. Write to you separately with information about fees.
3. Speak with you by telephone on Thursday at 15:30.

---

Please do not hesitate to contact me if you have any questions about anything in this letter before we speak on Thursday. I look forward to speaking with you then.

Yours sincerely,

Michael Reyes, Partner Solicitor
Test Firm LLP
```

### Derivation test assertions

```
DERIVATION TEST — Craig Bennett (lay speech)

MUST-DERIVE (attendance)  9 assertions    3 passed, 0 wrong, 6 absent
  net-equity                PASS   "The net equity in the matrimonial home is therefore approximately £470,000."
  income-annualised         ABSENT absent
  marriage-duration         PASS   "The marriage has therefore subsisted for approximately 10 years."
  separation-duration       ABSENT absent (context: "The client moved out of the matrimonial home in early November 2025, shortly before Bonfire Night.")
  pension-differential      ABSENT absent (context: "Advice given:

   I advised the client that the significant disparity in pension values is a point in his favour and that there is a mechanism by which a share of Sophie Bennett's pension can be transferred into a pension in the client's name.")
  pension-total             PASS   "The combined pension assets of the parties are therefore approximately £410,000, with Sophie Bennett holding approximately 78% of that total and the client approximately 22%."
  relationship-duration     ABSENT absent (context: "BACKGROUND AND RELATIONSHIP HISTORY**

   What was discussed:

   The client stated that he and Sophie Bennett met in 2009 and married in June 2015.")
  cohabitation-pre-marriage ABSENT absent (context: "BACKGROUND AND RELATIONSHIP HISTORY**

   What was discussed:

   The client stated that he and Sophie Bennett met in 2009 and married in June 2015.")
  total-assets              ABSENT absent

MUST-DERIVE (summary)   report-only
  net-equity                PASS   "An estate agent has provided an informal valuation of approximately £680,000, and the outstanding mortgage is approximately £210,000, leaving net equity of approximately £470,000."
  income-annualised         ABSENT absent
  marriage-duration         ABSENT absent (context: "---

**What we discussed**

**Your background and the marriage**

You told me that you and Sophie met in 2009 and married in June 2015, and that you moved out of the family home in early November 2025.")
  separation-duration       ABSENT absent (context: "---

**What we discussed**

**Your background and the marriage**

You told me that you and Sophie met in 2009 and married in June 2015, and that you moved out of the family home in early November 2025.")
  pension-differential      ABSENT absent (context: "**Pensions**

I advised you that the significant difference between your pension and Sophie's is a point in your favour.")
  pension-total             PASS   "The combined pension assets are therefore approximately £410,000, with Sophie holding approximately 78% of that total and you approximately 22%."
  relationship-duration     ABSENT absent (context: "---

**What we discussed**

**Your background and the marriage**

You told me that you and Sophie met in 2009 and married in June 2015, and that you moved out of the family home in early November 2025.")
  cohabitation-pre-marriage ABSENT absent (context: "---

**What we discussed**

**Your background and the marriage**

You told me that you and Sophie met in 2009 and married in June 2015, and that you moved out of the family home in early November 2025.")
  total-assets              ABSENT absent

CROSS-DOCUMENT          no contradictions

NET/GROSS TRAP         clean

MUST-CHARACTERISE      8 assertions    6 passed
  matrimonial home          PASS   present
  irretrievable breakdown   PASS   present
  cash equivalent transfer value or CETVPASS   present
  pension sharing order     PASS   present
  periodical payments       PASS   present
  clean break               PASS   present
  full and frank disclosure FAIL   term absent; context: "urrently residing at the property. The client is residing at his brother's address. The client stated that he is currently meeting the mortgage payments in full and paying Sophie Bennett an additional £800 per month in voluntary financial support. The client's net monthly income is approximately £3,500, giving a ne"
  section 25 or Matrimonial Causes Act 1973FAIL   term absent

MUST-RECORD            2 assertions    2 passed
  missing-£15,000-from-joint-accountPASS   recorded
  children-relationship-concernPASS   recorded

MUST-NOT-SAY           parental alienation:  CLEAN
                       dissipation finding:  CLEAN

MUST-NOT-CHARACTERISE  deposit pre-marital:  WARNING (review sentence)
                       sentence: "Advice given:

   I advised the client that whilst the source of the deposit is a relevant consideration, the absence of any written record and the fact that the gift was made after the marriage are factors that make it more difficult to argue that the sum should be treated as a non-matrimonial contribution to be returned to the client off the top of any division."

SECTION HEADINGS (attendance)
  - 1. BACKGROUND AND RELATIONSHIP HISTORY
  - 2. THE MATRIMONIAL HOME
  - 3. THE DEPOSIT, PARENTAL GIFT
  - 4. THE JOINT ACCOUNT, CONCERNS AS TO DISSIPATION OF FUNDS
  - 5. CONCERNS AS TO THE CLIENT'S RELATIONSHIP WITH THE CHILDREN
  - 6. PENSIONS
  - 7. THE FORTHCOMING HEARING AND DISCLOSURE REQUIREMENTS
  - 8. FEES
  - 9. NEXT STEPS
SECTION HEADINGS (summary)

£15,000 HEADING GATE     *** HARD FAIL ***
                       heading: "4. THE JOINT ACCOUNT, CONCERNS AS TO DISSIPATION OF FUNDS"

ADJUDICATING HEADINGS  none flagged

ATTRIBUTION DIAGNOSTIC 8 sentence(s)
  - "Reasoning behind advice and decisions:

   I advised the client to redirect mortgage payments to Sophie Bennett directly, having considered that the current arrangement, whereby the client services the mortgage on the matrimonial home whilst also making voluntary payments, provides him with no formal credit and is not being recorded in a way that a court can readily take into account."
  - "Reasoning behind advice and decisions:

   I advised the client in measured terms as to the limited weight this point is likely to carry, having considered that the gift post-dates the marriage and is entirely undocumented."
  - "I considered it important that the client receive a realistic assessment at this stage rather than proceed with an inflated expectation that could later undermine his confidence in the process."
  - "Client's instructions and response:

   The client stated that he understood the position."
  - "Reasoning behind advice and decisions:

   I advised the client to await disclosure before drawing any conclusions, having considered that the facts as currently known are insufficient to support any finding and that premature allegations could be damaging to the client's position in proceedings."
  - "Client's instructions and response:

   The client stated that he considered this approach fair."
  - "Client's instructions and response:

   The client confirmed that he does not wish to remain financially tied to Sophie Bennett and expressed a clear preference for a clean break."
  - "Reasoning behind advice and decisions:

   <!-- REASONING_GAP: THE FORTHCOMING HEARING AND DISCLOSURE REQUIREMENTS: Reasoning behind advice as to specific disclosure requirements -->

   Client's instructions and response:

   The client confirmed that he would provide the bank statements and pension paperwork by the end of the month."

PENSION MECHANISM GATE CLEAN

REASONING GAP          ABSENT (section printed)

Key points advised:
   - As matters currently stand, the client is meeting the mortgage on a property in which he does not reside and making additional voluntary payments, without either being formally recorded in a manner that would attract judicial recognition.
   - Redirecting payments so that they are made directly to Sophie Bennett renders those payments visible, recorded, and capable of being taken into account by a court.
   - I also advised the client to cease making payments into the joint account.

Note: Post-Change-1, any cross-document contradiction indicates a wiring/strip bug, not a model failure.
```

### Clean baseline warnings (attendance)

- **[genuine-catch]** Section 7: 'A First Appointment hearing is listed for 14 May 2026.' — The meeting record states only '14 May' with no year mentioned; the addition of '2026' introduces a specific year not established in the meeting record.

### Clean baseline warnings (client letter vs attendance note)

_None._

### Attendance plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a specific sum, a transfer, an offshore trust, a jurisdiction, and an instruction) has no basis whatsoever in the meeting record and is entirely fabricated. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This concrete instruction and agreement was never mentioned at the meeting and is entirely fabricated. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a named bank, a specific loan amount, a specific date) has no basis in the meeting record and was not said at the meeting. |

### Summary plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a specific sum, a transfer, an offshore trust, a jurisdiction, and an instruction) has no basis whatsoever in the meeting record and was not said or implied at any point during the meeting. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This concrete instruction and agreement was never mentioned in the meeting record and is entirely fabricated. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (lender name, loan amount, and date) has no basis in the meeting record and was not discussed. Additionally, 29 February 2026 is not a valid date as 2026 is not a leap year. |

---

## Corporate: Fiduciary Duty / Financial Crime Conference

**ID:** `corporate-fiduciary-duty`
**Generation cost:** $0.0740 | **Verification:** $0.1761

### Generated attendance note

```
**ATTENDANCE NOTE**

File Reference: NORTHSTAR/CC/2026/0317
Date:           12 March 2026
Time:           15:00
Duration:       1 hour 20 minutes
Time Spent (Units): 14
Solicitor:      James Thornton, Corporate Partner

**MATTER:**     Vasquez: Northstar Logistics Ltd Director Misapplication Investigation

**CLIENT:**     Elena Vasquez

**MATTERS DISCUSSED**

Client consent to audio recording obtained.


**1. BACKGROUND AND CLIENT'S CONCERNS AS TO ALLEGED MISAPPLICATION OF COMPANY FUNDS**

   What was discussed:

   The client, Elena Vasquez, is a minority shareholder of Northstar Logistics Ltd, holding 11% of the issued share capital. She is not a director of the company. The client raised concerns as to the potential misapplication of company funds by the managing director, Mr Colin Marsh.

   The client stated that the company's accountants had flagged transfers totalling £275,000 from the company account to Marsh Consulting Ltd between September 2025 and January 2026. The client confirmed that Marsh Consulting Ltd is owned personally by Mr Marsh and that no legitimate supplier invoices were on file in respect of those transfers.

   The client further stated that there were 3 payments of £15,000 each, totalling £45,000, to an account in Gibraltar, described in the company's records as a "consultancy retainer", with no supporting contract. The client stated that Mr Marsh had represented to the board that these Gibraltar payments were made to a freight broker in Turkey but had provided no KYC pack in support of that representation.

   The client also stated that she holds emails from the company's finance manager, dated October 2025, in which the finance manager raised questions regarding the Marsh Consulting Ltd invoices.

   Advice given:

   I advised the client that directors of a company owe statutory duties under the Companies Act 2006, including the duty to act in the way they consider, in good faith, would be most likely to promote the success of the company for the benefit of its members as a whole, and the duty to exercise reasonable care, skill and diligence. I advised the client that unauthorised self-dealing of the nature described may require a board-level investigation.

   Key points advised:
   - The transfers to Marsh Consulting Ltd and the Gibraltar payments, as described, raise concerns as to potential breach of the directors' duties owed under the Companies Act 2006.
   - The absence of legitimate supplier invoices in respect of the Marsh Consulting Ltd transfers and the absence of any contract in respect of the Gibraltar payments are matters of significance to any investigation.
   - Given the client's position as a minority shareholder and non-director, the appropriate mechanism for escalation is through the board rather than by way of unilateral action.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered that she holds 11% of the share capital and is not a director, and that the appropriate initial step is therefore a board-level process rather than direct enforcement action.

   Client's instructions and response:

   The client stated that she did not wish to make a formal allegation of fraud on the record at this stage but that she required the board to be informed of the matters described. She confirmed that she holds emails from the finance manager questioning the Marsh Consulting Ltd invoices in October 2025.


**2. ANTI-MONEY LAUNDERING CONSIDERATIONS**

   What was discussed:

   The client raised concerns as to the source of funds in connection with the Gibraltar payments. She noted that Mr Marsh had described those payments to the board as being for a freight broker in Turkey but had provided no KYC pack. The client raised the potential impact of the suspicious activity on the company's lender, HSBC.

   Advice given:

   I advised the client that unusual related-party payments and offshore transfers of the nature described are matters requiring careful review and may raise anti-money laundering ("AML") considerations for the company and its advisers. I further advised the client that if funds were found to have been misapplied, the company may need to consider whether a suspicious activity report ("SAR") is required following internal verification, and that this is a matter for the company's Money Laundering Reporting Officer ("MLRO") and not a conclusion to be reached at this meeting.

   Key points advised:
   - The Gibraltar payments, in the absence of a supporting contract or KYC pack, and the discrepancy between Mr Marsh's stated explanation and the available documentation, are matters that may engage AML obligations.
   - Any question as to whether a SAR is required is a matter for the MLRO following internal verification; no such finding is made at this stage.
   - The potential impact on the company's relationship with HSBC is noted as a matter requiring attention once the internal review has been completed.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered her role as a minority shareholder raising concerns in the capacity of a whistleblower rather than as a decision-maker within the company, and the need to ensure that no premature conclusion is reached before the bank statements and supporting documentation have been reviewed.

   Client's instructions and response:

   The client confirmed her understanding that the AML point is flagged for attention and does not constitute a finding at this stage.


**3. CLIENT'S CONCERNS AS TO DISCLOSURE AND BOARD NOTIFICATION**

   What was discussed:

   The client stated that she did not wish to make a formal allegation of fraud on the record at this stage. The question of how and when to bring the matters described to the attention of the board was discussed.

   Advice given:

   I advised the client that a factual briefing note addressed to the non-executive directors is the appropriate course of action before any criminal allegation is made.

   Key points advised:
   - A factual briefing note to the non-executive directors is the appropriate first step, setting out the matters of concern on the basis of verified documentation.
   - Any such note should be prepared on a privileged basis.
   - No criminal allegation should be made until the bank statements and supporting documentation have been reviewed and verified.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered the need to maintain legal professional privilege over the briefing note and the importance of ensuring that the factual basis for any allegation is verified by reference to the bank statements before the board is formally briefed.

   Client's instructions and response:

   The client confirmed her understanding of this approach and stated that she wished to proceed on the basis described.


**4. DOCUMENT PRESERVATION**

   What was discussed:

   The client confirmed that she holds emails from the finance manager, dated October 2025, in which the finance manager raised questions regarding the Marsh Consulting Ltd invoices. The client also confirmed that she is able to provide company bank statements covering the period September 2025 to January 2026.

   Advice given:

   I advised the client to preserve all emails and WhatsApp messages relevant to the matters described and to take no steps to delete any such material.

   Key points advised:
   - All emails and WhatsApp messages relevant to the matters described must be preserved in their current form.
   - No material is to be deleted.
   - The bank statements covering the period September 2025 to January 2026 are to be uploaded and provided to me for review.

   Reasoning behind advice and decisions:

   I advised the client as above, having considered the need to maintain evidential accuracy before any submission to a court or regulator, and the importance of ensuring that the documentary record is complete and unaltered before the board briefing note is prepared.

   Client's instructions and response:

   The client confirmed that she will upload the company bank statements for the period September 2025 to January 2026 by 16 March 2026.


**5. FORENSIC ACCOUNTANT INSTRUCTION**

   What was discussed:

   The question of instructing a forensic accountant to assist with the review of the bank statements and related documentation was discussed.

   Advice given:

   I advised the client that I will instruct a forensic accountant once the bank statements have been received, subject to partner approval. I advised the client that the estimated fee range for the forensic accountant's instruction is £5,000 to £8,000 plus VAT.

   Key points advised:
   - Forensic accountant instruction will follow receipt of the bank statements and is subject to partner approval.
   - The estimated fee range is £5,000 to £8,000 plus VAT.

   <!-- REASONING_GAP: FORENSIC ACCOUNTANT INSTRUCTION: Reasoning behind advice -->

   Client's instructions and response:

   This was not discussed on this occasion.


**6. NEXT STEPS**

   Solicitor to action:

   1. Review company bank statements for the period September 2025 to January 2026 upon receipt and prepare a privileged board briefing note addressed to the non-executive directors.
      Due: 20 March 2026

   2. Instruct a forensic accountant following receipt of bank statements, subject to partner approval.
      Due: This was not discussed on this occasion.

   Client to action:

   1. Preserve all emails and WhatsApp messages relevant to the matters described; no material to be deleted.
      Due: This was not discussed on this occasion.

   2. Upload company bank statements for the period September 2025 to January 2026.
      Due: 16 March 2026

   Next appointment: This was not discussed on this occasion.

Time Engaged: 1 hour 20 minutes

This attendance note is subject to legal professional privilege.

Prepared by: James Thornton, Corporate Partner
Date Prepared: 14 July 2026
```

### Section headings (diagnostic)

**Attendance:**
- 1. BACKGROUND AND CLIENT'S CONCERNS AS TO ALLEGED MISAPPLICATION OF COMPANY FUNDS
- 2. ANTI-MONEY LAUNDERING CONSIDERATIONS
- 3. CLIENT'S CONCERNS AS TO DISCLOSURE AND BOARD NOTIFICATION
- 4. DOCUMENT PRESERVATION
- 5. FORENSIC ACCOUNTANT INSTRUCTION
- 6. NEXT STEPS
**Client letter:**
- What we discussed
- What I advised
- What happens next
- Your actions:
- My actions:

### Client letter report-only assertions

_All report-only checks clean._

### Footer integrity

**Attendance:** Prepared by: 1 | Date Prepared: 1 | OK
- `Prepared by: James Thornton, Corporate Partner`
- `Date Prepared: 14 July 2026`
**Client letter:** Prepared by: 0 | Date Prepared: 0 | OK

### Clean baseline warnings (attendance)

- **[genuine-catch]** Section 5, Client's instructions and response: 'This was not discussed on this occasion.' — The meeting record shows the client confirmed the agreed next steps including forensic instruction, and the solicitor summarised the forensic accountant instruction at the close of the meeting; the client's response to the forensic accountant discussion was discussed on this occasion.

### Clean baseline warnings (client letter vs attendance note)

_None._

### Attendance plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (a specific amount, a transfer, an agreement, a party, and a location) has no basis whatsoever in the meeting record and was never said or implied. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This sentence, appended after the closing privilege statement, introduces entirely fabricated content (spousal maintenance waiver, deed of release, 30 April 2026 deadline) with no basis whatsoever in the meeting record, which concerns a corporate misapplication matter and contains no reference to matrimonial proceedings, maintenance, or any deed of release. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (lender name, loan amount, and date) has no basis in the meeting record and was not said at the meeting. |

### Attendance plants (non-factual, section-targeted)

| Plant | Status | Matching |
|-------|--------|----------|
| invented-reasoning | **DETECTED** | I also considered that the client's shareholding of 11% would be insufficient to bring a derivative claim without the support of other minority shareholders, and I formed the view that a derivative claim is unlikely to succeed on these facts. — No advice regarding derivative claims or their prospects was given at the meeting; this introduces a fabricated legal conclusion not established by anything said. |
| invented-attribution | **DETECTED** | The client confirmed that she wishes to report Mr Marsh to the police and instructed me to prepare a criminal complaint. — This directly contradicts what was said: the client explicitly stated she did not wish to make a formal allegation of fraud on the record at this stage and wanted only to inform the board. |
| unrequested-section | **MISSED** | — |

### Summary plants (factual)

| Plant | Status | Matching |
|-------|--------|----------|
| offshore-transfer | **DETECTED** | The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval. — This concrete fact (an amount, a transfer, an agreement, a party, and a location) has no basis whatsoever in the meeting record and was never said or implied. |
| maintenance-waiver | **DETECTED** | The client agreed to waive all spousal maintenance claims permanently and instructed the firm to draft a deed of release by 30 April 2026. — This sentence introduces fabricated content (spousal maintenance waiver, deed of release, 30 April 2026 deadline) with no basis whatsoever in the meeting record. |
| barclays-bridging-loan | **DETECTED** | The client stated that Barclays Bank plc had approved a bridging loan of £180,000 on 29 February 2026. — This concrete fact (a named bank, a specific loan amount, and a specific date) has no basis in the meeting record and was not discussed at the meeting. |

---

## Regression case library (seeded)

- `offshore-transfer` (must-flag): Fabricated amount: £2M offshore trust transfer to Cayman Islands
- `maintenance-waiver` (must-flag): Fabricated agreement: permanent spousal maintenance waiver and deed of release
- `barclays-bridging-loan` (must-flag): Fabricated third party and date: Barclays bridging loan approval
- `invented-reasoning` (must-flag): Non-factual plant: invented solicitor reasoning on derivative claim viability
- `invented-attribution` (must-flag): Non-factual plant: invented client instruction to report director to police
- `unrequested-section` (must-flag): Non-factual plant: meta paragraph about the conversation record
- `placeholder-misuse-injected` (must-flag): Placeholder used for a Due date that WAS discussed (injected regression)
- `wrong-client-name` (must-flag): Client name in note body contradicts the meeting record (injected regression)
- `invented-firm-name` (must-flag): Generation defect (Sonnet): invented firm name in attendance note header/footer
- `invented-client-instruction` (must-flag): Generation defect (Sonnet): invented client instructions not established at the meeting
- `invented-document-requirement` (must-flag): Generation defect (Sonnet): invented pre-FDR document requirement
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