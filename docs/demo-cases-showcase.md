---
title: Demo cases — full showcase rebuild
---
# Demo Cases — Full Showcase Rebuild

## What & Why
Remove all existing cases and replace them with six precisely crafted showcase cases that collectively demonstrate LegalNote's full capability across multiple practice areas, session types, and compliance scenarios. Each case is designed to feel like a real boutique firm's live caseload, not test data. A prospective firm partner viewing these cases should be able to immediately envision LegalNote operating within their own practice. The rebuild also integrates all newly built infrastructure — client registry, meeting sessions, recording types, time entries, undertakings, external document references, practice area routing, client care letters, and conflict checks — which the existing seed does not yet use.

The task agent should also save a copy of the showcase document to `docs/demo-cases-showcase.md` for permanent reference.

## Done looks like
- All existing cases (and all related data) for the admin user are deleted before seeding
- Six demo cases exist, each fully populated with the data described below
- Each case has: a proper Client record, confirmed conflict check, auto-generated client care letter, practice area with correct AML default, at least one meeting session with a realistic transcript and generated document, confirmed time entry, and audit trail entries
- The clearDemoData and resetDemoData functions are updated to also clear and reseed: meetingSessions, clients, undertakings, timeEntries, externalDocumentRefs
- Transcripts are rich, realistic, UK-law-specific, and free of padding or generic language
- Generated documents (attendance notes, telephone notes, court notes, police station records) are each clearly different in format and length — demonstrating that LegalNote adapts to the session type
- All six cases use the `DEMO_` matter reference prefix for safe identification during resets
- The admin quick-access demo reset uses this improved seed

## Out of scope
- Generating actual audio files (transcripts are seeded directly as text)
- Generating real PDF binaries (documents are stored as markdown/text content as the existing seed does)
- Any changes to the AI pipeline or document generation logic

---

## The Six Cases

---

### Case 1 — Richard Patterson | Commercial Property | AML/SRA Audit Showcase
**Matter reference:** COMP/2024/0291
**Client:** Richard Patterson (corporate — Patterson Developments Ltd)
**Practice area:** Commercial Property
**AML risk:** HIGH (auto-default + manually elevated)
**Status:** Active — ongoing due diligence

This is the centrepiece compliance demonstration. Patterson Developments Ltd is acquiring a commercial warehouse unit in Stratford, East London for £2.4m. The beneficial ownership structure is opaque — two holding companies and an offshore trust — which triggered the solicitor's enhanced due diligence obligation from the outset.

**Sessions (3):**
1. **Full meeting — Matter inception** (5 weeks ago, 2h 10m): Initial consultation covering: purpose of acquisition, corporate structure walkthrough, source of funds, AML screening results, and decision to escalate to enhanced due diligence. Attendance note flags three AML concerns: (a) beneficial ownership not fully transparent, (b) offshore trust component cannot be immediately verified, (c) client declined to provide bank statements citing commercial sensitivity. Solicitor formally put client on notice that matter cannot proceed without satisfactory documentation. AML monitoring note created. Compliance Thread activated.

2. **Telephone call** (3 weeks ago, 18 min): Patterson called to say documents were being compiled. Brief telephone attendance note records: call received, client confirmed documents being prepared by accountants, expected within 5 working days. Solicitor noted continued concern about pace of disclosure. Second monitoring note added.

3. **Full meeting — AML review and clearance** (1 week ago, 1h 25m): Client attended with documentation. Beneficial ownership now fully verified through Companies House and Jersey trust register. Source of funds confirmed via audited accounts. Solicitor satisfied — AML Decision Record completed with "cleared to proceed" determination, counter-signatory approval recorded. Matter ready to proceed to heads of terms.

**Undertakings:** None (pre-contract stage)
**Compliance Thread:** Fully populated — three monitoring notes, one decision record, counter-signatory approval
**External document references:** "Certified copy of company formation documents for Patterson Developments Ltd — provided by client 14 January 2025, not stored, reference only" and "Jersey trust register extract — provided by client 14 January 2025, not stored, reference only"
**Time entries:** Session 1: 2h 10m @ £320/hr. Session 2: 0.3h @ £320/hr. Session 3: 1h 25m @ £320/hr. Plus 3h due diligence review @ £320/hr (file note).
**AML audit trail:** Full HMAC-signed sequence from matter inception through clearance.

---

### Case 2 — Sophie Henderson | Residential Conveyancing | Multi-Session Showcase
**Matter reference:** CONV/2024/1147
**Client:** Sophie Henderson
**Practice area:** Residential Conveyancing
**AML risk:** HIGH (auto-default)
**Status:** Active — exchange imminent

Sophie is purchasing 14 Ashfield Close, Bath, BA2 5NP — a freehold property at £385,000. She is a first-time buyer using a combination of savings and a parental gift for the deposit. The matter is at an advanced stage: searches complete, enquiries resolved, mortgage offer received.

**Sessions (2):**
1. **Full meeting — Initial consultation** (3 weeks ago, 55 min): Full attendance note covering: contract report, title review, search results (one drainage search query now resolved), SDLT calculation (£9,750), mortgage conditions including a valuation retention of £2,500 pending roof inspection report. Client gave instructions on fixtures and fittings — specifically requested garden studio to be included. Source of funds: £77,000 deposit comprising £52,000 savings (evidenced by bank statements) and £25,000 parental gift (gift letter obtained). AML satisfied.

2. **Telephone call** (4 days ago, 7 min): Sophie called to confirm she had received the mortgage retention report and the roof had been cleared by the surveyor. Brief telephone attendance note: call received 11:14am, client confirmed roof report satisfactory, instructed to proceed to exchange. Agreed exchange target: Friday 21st. Solicitor to contact seller's solicitors to confirm. Note: brief, factual, one paragraph — clearly demonstrating the difference from the full attendance note above.

**Undertakings:** Outstanding — "We undertake to exchange contracts within 5 working days of receipt of the signed contract and deposit funds from our client." (Created at first session, not yet discharged — shows in amber on the undertakings tab.)
**Client care letter:** Generated at matter inception, visible in Documents tab.
**Time entries:** Session 1: 0.9h @ £220/hr. Session 2: 0.1h @ £220/hr. File review: 1.5h @ £220/hr.

---

### Case 3 — Daniel Hartley | Employment (Employee) | Undertakings Showcase
**Matter reference:** EMP/2024/0889
**Client:** Daniel Hartley
**Practice area:** Employment (Employee)
**AML risk:** MEDIUM (auto-default)
**Status:** Active — pre-claim, ET1 ready to file

Daniel was employed for seven years as Senior Systems Engineer at TechLogic Solutions Ltd. He resigned following a sustained period of management behaviour which he characterises as making his continued employment untenable. He is claiming constructive dismissal. The ACAS early conciliation certificate has been obtained. ET1 is drafted and ready to submit. Schedule of loss: £31,450 (including loss of earnings to date, future loss estimated at 9 months, notice pay, and accrued holiday).

**Sessions (2):**
1. **Full meeting — Initial consultation** (5 weeks ago, 1h 40m): Rich attendance note covering the full factual background: series of incidents over 8 months, HR complaint that was inadequately investigated, demotion of responsibilities without consultation, exclusion from team meetings. Solicitor advised on the constructive dismissal test under section 95(1)(c) Employment Rights Act 1996, the importance of not delaying too long after resignation, ACAS early conciliation as prerequisite to ET1, and prospects of success (assessed as reasonable to good). Schedule of loss prepared during meeting: basic award (7 years x 1 week x £544 statutory cap = £3,808), compensatory award including 9 months future loss (£27,642), notice pay (£5,445 for the period worked without full notice). Action items: client to obtain all written correspondence from TechLogic, provide payslips for last 3 months, sign ACAS form.

2. **Full meeting — Strategy review and ET1 sign-off** (1 week ago, 50 min): Draft ET1 reviewed and approved by client. ET1 particulars cover the sustained detriment narrative. Schedule of loss finalised. Respondent details confirmed. Solicitor gave undertaking regarding schedule of loss service. Client confirmed instructions to proceed. Next steps: file ET1 this week, await tribunal acknowledgement, respond to any early conciliation approach from respondent.

**Undertakings:** "I undertake to serve the schedule of loss on the respondent within 3 working days of filing the ET1." — **Discharged.** Shows as completed with discharge date and confirming note. Demonstrates the full undertaking lifecycle (given → outstanding → discharged).
**Time entries:** Session 1: 1.7h @ £195/hr. Session 2: 0.8h @ £195/hr. ET1 drafting: 2.5h @ £195/hr.

---

### Case 4 — Yasmin Okafor | Family (Children / Arrangements) | Multi-Format Showcase
**Matter reference:** FAM/2024/0534
**Client:** Yasmin Okafor
**Practice area:** Family (Children / Arrangements)
**AML risk:** MEDIUM (auto-default)
**Status:** Active — post-directions hearing, CAFCASS report awaited

Yasmin separated from her partner eight months ago. The couple have two children: Amara (9) and Kofi (6). Contact and living arrangements have been agreed informally but have broken down. Yasmin is seeking a Child Arrangements Order. A Section 7 CAFCASS report has been ordered. A directions hearing took place last week at Bristol Family Court.

**Sessions (3):**
1. **Full meeting — Initial consultation** (6 weeks ago, 1h 15m): Full attendance note. Solicitor explained the paramountcy principle, the welfare checklist, the court's strong preference for agreements between parties, and the MIAM requirement (mediation information and assessment meeting attended — certificate provided). Client's account of the breakdown of informal arrangements detailed. Solicitor advised on realistic outcomes: shared care arrangement likely, Prohibited Steps Order considered premature at this stage. Applied for Form C100. Consent to record handled with particular care — transcript shows solicitor's careful explanation in the context of a sensitive matter.

2. **Telephone call** (2 weeks ago, 12 min): Yasmin called following CAFCASS allocation. Brief telephone attendance note recording: call received, CAFCASS officer allocated (Officer J. Mercer), first contact appointment scheduled for 4 February. Solicitor advised client on what to expect from CAFCASS initial contact. No substantive legal advice given. Characteristic brief-format telephone note.

3. **Court hearing** (5 days ago, Bristol Family Court): **Court attendance note** — completely different format from the above. Structured record: Hearing type: First Hearing Dispute Resolution Appointment (FHDRA). Court: Bristol Family Court. Judge: District Judge Pemberton. Parties: Applicant (Yasmin Okafor) represented. Respondent (Michael Okafor, in person). Orders made: CAFCASS Section 7 report directed, to be filed by 14 March. Next hearing: Dispute Resolution Appointment 28 March. Interim arrangement confirmed by consent. Duration: 35 minutes. This document is visibly different in structure and length from a normal attendance note.

**Time entries:** Session 1: 1.2h @ £210/hr. Session 2: 0.2h @ £210/hr. Session 3 (court): 3.5h @ £210/hr (including travel and waiting).

---

### Case 5 — Margaret & Geoffrey Whitmore | Wills & Probate | Complex Document Showcase
**Matter reference:** PROB/2024/0203
**Client:** Margaret Whitmore & Geoffrey Whitmore (joint matter)
**Practice area:** Wills & Probate
**AML risk:** MEDIUM (auto-default)
**Status:** Completed — wills executed

Margaret (73) and Geoffrey (76) Whitmore attended together to give instructions for mirror wills. Their estate is substantial: primary residence in Surrey valued at approximately £1.1m, investment portfolio of approximately £680,000, cash savings of £190,000. Total estate circa £1.97m — well above the IHT threshold. The matter was attended by both the fee earner and the senior partner given the estate complexity.

**Sessions (1):**
1. **Full meeting — Will instructions** (8 weeks ago, 1h 50m): The attendance note is the centrepiece of this case — a complex, substantive document covering: estate valuation, IHT calculations (both NRBs totalling £650,000, both RNRBs totalling £350,000 — combined shelter of £1m; taxable estate £970,000 at 40% = £388,000 IHT unless structured), discretionary trust recommendation for grandchildren's shares (three grandchildren, ages 8, 11, 14), STEP standard provisions, mutual will considerations (discussed and rejected), lasting power of attorney discussion (referred to separate file), letter of wishes. Four speakers clearly identified in the transcript: Margaret, Geoffrey, fee earner, and the partner. AssemblyAI speaker diarization labels all four throughout. Solicitor's advice covers specific IHT planning steps — recommendation to gift £20,000 annually utilising annual exemptions over 7-year period to reduce taxable estate. The document verification pass shows: "Verified — all statements traceable to transcript."

**Time entries:** Session 1: 1.8h @ £320/hr (partner rate). File preparation: 3.0h @ £195/hr (fee earner). Will drafting: 2.5h @ £195/hr.

---

### Case 6 — Leon Treadwell | Criminal Defence | Police Station Showcase
**Matter reference:** CRIM/2024/2201
**Client:** Leon Treadwell
**Practice area:** Criminal Defence
**AML risk:** LOW (auto-default)
**Status:** Completed — no further action

Leon was arrested on suspicion of Section 18 Wounding with Intent (Grievous Bodily harm). A duty solicitor was called to the police station at 11:47pm. The solicitor advised throughout the custody period and attended the voluntary police interview under PACE. NFA (no further action) was confirmed the following morning.

**Sessions (1):**
1. **Police station** (recorded at 11:47pm, duration 3h 25m): The document generated for this session is a **Police Station Attendance Record** — entirely different in format from any other case. It is short, structured, and clinical: time of arrival at custody suite, custody number, grounds of arrest (Section 18 OAPA 1866), client's account, advice given (no comment recommended given the state of disclosure), interview conducted (no comment throughout), any identification procedure (VIPER — not conducted), legal basis for detention reviewed (authorised to 24 hours), outcome (released under investigation pending forensic results), follow-up required (await CPS charging decision). Total word count: approximately 350 words. This is the starkest contrast to the Whitmore wills note, demonstrating LegalNote's range.

**Time entries:** Session: 3.4h @ £195/hr (out-of-hours duty rate). All entries confirmed.

---

## Implementation Tasks

1. **Clear all existing cases** — Delete all cases and their related data for the admin user (not just demo-flagged ones). This is a deliberate full wipe before reseeding. Update the deletion order to also clear the new tables: meetingSessions, undertakings, timeEntries, externalDocumentRefs, and clients (user-scoped).

2. **Update the client seeding** — Create a proper Client record for each of the six cases before creating the case. Link each case to its client via clientId. Each client has realistic contact details.

3. **Seed meeting sessions** — For each case, create the correct number of meetingSession records with the right recordingType, timestamps, and duration. Each session is linked to the case.

4. **Seed rich transcripts** — Write full, realistic, UK-law-specific transcripts for each session. Transcripts must use correct legal terminology for the practice area, include realistic dialogue, and be free of padding. Each transcript is scoped to its session.

5. **Seed generated documents** — Create the appropriate document type for each session: full attendance note for full meetings, telephone attendance note for telephone calls, court attendance note for the Okafor hearing, police station attendance record for the Treadwell session. Documents should be visibly different in structure and length from each other.

6. **Seed undertakings** — Henderson: one outstanding undertaking (exchange within 5 working days). Hartley: one discharged undertaking (schedule of loss service). Each with source quote, deadline, and status.

7. **Seed time entries** — Confirmed time entries for all sessions across all six cases with realistic rates and durations.

8. **Seed AML data for Patterson** — Three monitoring notes and one decision record. External document references for the Patterson case. Full ComplianceThread data.

9. **Seed audit trail** — Realistic audit events for each case in chronological order: case created, conflict check confirmed, client care letter generated, transcript processed, document generated, and (for Patterson) AML events.

10. **Update clearDemoData and resetDemoData** — Add deletion of all new tables (meetingSessions, undertakings, timeEntries, externalDocumentRefs, clients scoped to user) so the admin reset function works cleanly against the new seed.

11. **Save showcase document** — Save a copy of this case description document to `docs/demo-cases-showcase.md` for permanent reference.

## Relevant files
- `server/services/demoSeedService.ts`
- `shared/schema.ts`
- `server/routes.ts`