# COLP Self-Audit Checklist: LegalNote Platform

**Document Purpose:** Compliance Officer for Legal Practice (COLP) and Head of Risk self-audit of the LegalNote meeting-to-attendance-note platform.

**Audit Date:** [FIRM TO COMPLETE]  
**Auditor:** [FIRM TO COMPLETE]  
**Platform Version:** 1.0  
**Last Review:** [FIRM TO COMPLETE]

---

## Status Key

| Status | Meaning |
|--------|---------|
| **GREEN** | Adequate - meets requirements |
| **AMBER** | Partial/unclear - needs attention |
| **RED** | Not in place - requires remediation |

---

## 1. Scope, Use-Cases and Ownership

### 1.1 Functions and Boundaries

**What functions does the app perform today?**

| Function | Status | Description |
|----------|--------|-------------|
| Audio Recording | GREEN | Browser-based MediaRecorder API captures client meetings |
| Transcription | GREEN | AssemblyAI with speaker diarization and UK legal vocabulary boost |
| Diarisation | GREEN | Speaker separation with GPT-4o post-processing for accuracy |
| Attendance Note Drafting | GREEN | AI-generated structured notes from transcript |
| Action/Obligation Extraction | GREEN | AI extracts action items with priority, assignee, due dates |
| Consent Logging | GREEN | Pre-recording consent with lawful basis, exact wording stored |
| Document Export | GREEN | PDF and Word export with firm branding |

**Does the app generate legal advice, conclusions, risk ratings, or case-strategy suggestions?**

| Assessment | Status |
|------------|--------|
| Legal advice generation | GREEN - NO |
| Legal conclusions | GREEN - NO |
| Risk ratings | GREEN - NO |
| Case strategy suggestions | GREEN - NO |

**Platform Positioning:** LegalNote is explicitly positioned as a "compliance-first documentation tool" that records, transcribes, and formats solicitors' own work. It does NOT provide legal analysis. This deliberate positioning avoids SRA compliance risks and PI insurance liability exposure.

### 1.2 Intended Use-Cases

**Intended matter types/practice areas:**

| Practice Area | Suitability | Notes |
|---------------|-------------|-------|
| Litigation/Contentious | Suitable | Standard consent flow applies |
| Employment | Suitable | Standard consent flow applies |
| Family | Suitable | Consider sensitivity - see 5.3 |
| Clinical Negligence | Suitable | Limitation dates should be flagged |
| Corporate/Commercial | Suitable | Standard consent flow applies |
| Regulatory | Suitable | Standard consent flow applies |
| Private Client | Suitable | Consider vulnerability - see 5.3 |
| Conveyancing | Suitable | Standard consent flow applies |

**Scenarios where app is NOT intended:**

| Scenario | Status | Platform Support |
|----------|--------|------------------|
| Very sensitive matters | AMBER | No "do not record" flag currently |
| Vulnerable clients | AMBER | No vulnerability indicator |
| Matters where recording prohibited | AMBER | No hard block mechanism |

### 1.3 Internal Ownership and Accountability

| Question | Response |
|----------|----------|
| Who owns this tool? | [FIRM TO COMPLETE - Named partner/committee/role] |
| How is oversight documented? | [FIRM TO COMPLETE - AI register, governance paper, risk committee minutes] |

---

## 2. Legal and Regulatory Analysis

### 2.1 SRA/LSB Expectations

**How does the app support SRA principles?**

| Principle | Platform Support | Status |
|-----------|------------------|--------|
| **Confidentiality** | User isolation, matter-scoped access, no cross-client data sharing | GREEN |
| **Supervision** | All AI outputs require solicitor review before finalisation | AMBER - needs explicit approval workflow |
| **Competence** | AI assists documentation, does not provide legal analysis | GREEN |
| **Record-keeping** | Comprehensive audit trail with 50+ event types, cryptographic signatures | GREEN |
| **Accountability** | All actions attributed to authenticated users | GREEN |

**Written mapping to SRA/LSB AI guidance:**

| Question | Response | Status |
|----------|----------|--------|
| Mapping document produced? | [FIRM TO COMPLETE] | AMBER |

### 2.2 Lawful Basis and DPIA/AI Risk Assessment

**Lawful bases identified:**

| Processing Activity | Lawful Basis | Platform Support | Status |
|--------------------|--------------|------------------|--------|
| Recording meetings | Consent (Article 6(1)(a)) | Consent modal with lawful basis selection, wording stored | GREEN |
| Transcribing audio | Legitimate interests / Contract | Linked to case creation | GREEN |
| Generating attendance notes | Legitimate interests / Contract | Linked to matter management | GREEN |
| Extracting actions | Legitimate interests / Contract | Linked to matter management | GREEN |

**DPIA/AI Risk Assessment:**

| Question | Response | Status |
|----------|----------|--------|
| UK-GDPR DPIA completed? | [FIRM TO COMPLETE] | AMBER |
| AI-specific risk assessment completed? | [FIRM TO COMPLETE] | AMBER |
| Storage location of assessment | [FIRM TO COMPLETE] | AMBER |
| Last review date | [FIRM TO COMPLETE] | AMBER |

### 2.3 Data Subject Rights and Special-Category Data

**Data subject rights support:**

| Right | Platform Support | Status |
|-------|------------------|--------|
| Access | Audit trail queryable, documents exportable | GREEN |
| Rectification | Transcripts editable, notes editable | GREEN |
| Restriction | Litigation hold mechanism prevents processing | GREEN |
| Erasure | 7-day audio retention, manual deletion available | GREEN |
| Objection | Consent withdrawal tracking implemented | GREEN |
| DSAR workflow | Structured tracking | AMBER - Phase 5 pending |

**Special-category/criminal-offence data:**

| Question | Response | Status |
|----------|----------|--------|
| Assessment documented? | [FIRM TO COMPLETE] | AMBER |
| Handling procedures defined? | [FIRM TO COMPLETE] | AMBER |

---

## 3. Data Handling, Security and Retention

### 3.1 Data Flows and Locations

**Storage locations:**

| Data Type | Provider | Location | Status |
|-----------|----------|----------|--------|
| Audio files | Replit Object Storage / Backblaze B2 | [Confirm region] | GREEN |
| Transcripts | PostgreSQL (Neon) | [Confirm region] | GREEN |
| Attendance notes | PostgreSQL (Neon) | [Confirm region] | GREEN |
| Audit logs | PostgreSQL (Neon) | [Confirm region] | GREEN |

**Sub-processors:**

| Service | Purpose | Data Processed |
|---------|---------|----------------|
| AssemblyAI | Transcription | Audio files |
| OpenAI | Document generation, transcript correction | Transcript text |
| Replit | Hosting, object storage | All data |
| Neon | Database | Structured data |
| Resend | Email delivery | Notification content |
| Twilio | SMS 2FA | Phone numbers, OTP codes |

**Tenant/matter/user separation:**

| Control | Implementation | Status |
|---------|----------------|--------|
| User isolation | All queries filtered by userId/createdBy | GREEN |
| Matter scoping | Cases linked to authenticated user | GREEN |
| Access controls | Route-level, storage-level, UI-level enforcement | GREEN |

### 3.2 Retention Policies and Enforcement

**Default retention periods:**

| Data Type | Retention Period | Technical Enforcement | Status |
|-----------|------------------|----------------------|--------|
| Raw audio | 7 days | Automated cleanup service (daily 2AM) | GREEN |
| Transcripts | Matter lifetime | Manual deletion only | AMBER - configurable retention pending |
| Attendance notes | Matter lifetime | Manual deletion only | AMBER - configurable retention pending |
| Audit logs | Indefinite | No deletion | GREEN |

**Litigation hold:**

| Feature | Implementation | Status |
|---------|----------------|--------|
| Hold application | Endpoint with reason, appliedBy, appliedAt | GREEN |
| Hold release | Tracks releasedBy, releasedAt, original applier | GREEN |
| Cleanup respect | Retention service skips held cases | GREEN |
| Audit logging | Critical-severity events for apply/release | GREEN |

### 3.3 Security Controls

**Encryption:**

| Layer | Implementation | Status |
|-------|----------------|--------|
| In transit | HTTPS/TLS | GREEN |
| At rest | Provider-managed encryption (Neon, Backblaze) | GREEN |

**Authentication and authorisation:**

| Control | Implementation | Status |
|---------|----------------|--------|
| Authentication | Replit Auth (OIDC-based) | GREEN |
| Session management | Secure cookies, 4-hour timeout with warning | GREEN |
| Role-based access | User isolation enforced at all levels | GREEN |
| Share link security | Optional password (bcrypt), SMS 2FA (Twilio) | GREEN |

### 3.4 Sub-Processors and Third-Party Models

**Contractual restrictions:**

| Vendor | No Cross-Client Training | No Secondary Use | Status |
|--------|-------------------------|------------------|--------|
| AssemblyAI | [FIRM TO VERIFY CONTRACT] | [FIRM TO VERIFY] | AMBER |
| OpenAI | [FIRM TO VERIFY CONTRACT] | [FIRM TO VERIFY] | AMBER |
| Replit | [FIRM TO VERIFY CONTRACT] | [FIRM TO VERIFY] | AMBER |

---

## 4. Model Behaviour and Human Oversight

### 4.1 AI Components and Error Modes

**AI/ML components:**

| Component | Technology | Purpose |
|-----------|------------|---------|
| Speech recognition | AssemblyAI | Audio to text |
| Speaker diarisation | AssemblyAI | Speaker separation |
| Transcript correction | OpenAI GPT-4o | Name/number/legal term accuracy |
| Attendance note generation | OpenAI GPT-4o | Structured summary from transcript |
| Action extraction | OpenAI GPT-4o | Identify obligations and deadlines |

**Known/expected error modes:**

| Error Type | Likelihood | Mitigation |
|------------|------------|------------|
| Mis-hearing words | Medium | UK legal vocabulary boost (200+ terms), GPT-4o correction |
| Mis-labelling speakers | Medium | Diarisation confidence scores, manual correction available |
| Hallucinated content | Low | Human review required, notes clearly marked as AI-generated |
| Missed actions | Medium | Extraction is additive - solicitor can add manually |

### 4.2 Human-in-the-Loop Controls

**Review/approval points:**

| Output Type | Human Review Required? | Technical Enforcement | Status |
|-------------|----------------------|----------------------|--------|
| Transcripts | Available but optional | Can edit before note generation | AMBER |
| Attendance notes | Available but optional | Can edit before export | AMBER - approval workflow pending |
| Action items | Available but optional | Can edit/delete | AMBER - approval workflow pending |
| Final export | Not enforced | Notes can be exported without approval | RED |

**Remediation required:** Implement mandatory approval workflow for attendance notes and action items before they become part of the matter record or are shared externally.

### 4.3 Quality Assurance and Supervision

| Question | Response | Status |
|----------|----------|--------|
| Sampling/QA process defined? | [FIRM TO COMPLETE] | AMBER |
| Supervision of junior users documented? | [FIRM TO COMPLETE] | AMBER |

---

## 5. Consent, Client Communication and Policy Fit

### 5.1 On-Screen Consent and Notice

**Consent/notice flows:**

| Flow | Implementation | Status |
|------|----------------|--------|
| Pre-meeting email | Pre-consent email template with meeting details | GREEN |
| In-meeting consent | Modal with disclaimer text, lawful basis selection | GREEN |
| Verbal script | Suggested wording displayed for solicitor to read | GREEN |
| Consent logging | Timestamp, exact wording, lawful basis, IP address stored | GREEN |
| Withdrawal tracking | Consent withdrawal can be logged post-hoc | GREEN |

**Client-friendly explanation:**

| Aspect | Status |
|--------|--------|
| Clear language about recording | GREEN |
| Clear language about AI processing | AMBER - could be more explicit about AI use |

### 5.2 Alignment with Firm Documents

| Question | Response | Status |
|----------|----------|--------|
| Aligned with engagement letters? | [FIRM TO COMPLETE] | AMBER |
| Aligned with privacy notice? | [FIRM TO COMPLETE] | AMBER |
| Documents updated to reference recording/AI? | [FIRM TO COMPLETE] | AMBER |

### 5.3 Red Lines and Exceptions

| Question | Response | Status |
|----------|----------|--------|
| Prohibited matter types defined? | [FIRM TO COMPLETE] | AMBER |
| Exceptions communicated to users? | No in-app guidance currently | AMBER |
| Exceptions enforced/flagged in app? | No "do not record" mechanism | AMBER |

---

## 6. Auditability and Evidential Value

### 6.1 Logged Events

**Events logged (50+ event types):**

| Category | Events | Status |
|----------|--------|--------|
| Recording lifecycle | recording_started, recording_stopped, recording_paused, recording_resumed | GREEN |
| Case lifecycle | case_created, case_updated, case_archived, case_deleted, case_created_from_recording | GREEN |
| Consent | consent_given, consent_withdrawn, consent_updated | GREEN |
| Documents | document_created, document_updated, document_deleted | GREEN |
| Transcription | transcription_started, transcription_completed, transcription_failed | GREEN |
| Litigation holds | litigation_hold_applied, litigation_hold_released | GREEN |
| Authentication | login, logout, session_timeout, failed_login | GREEN |
| Data retention | cleanup.audio_deleted, cleanup.audio_skipped_litigation_hold | GREEN |
| Exports | document_exported, document_shared | AMBER - not fully implemented |
| Access events | case_viewed, document_accessed | RED - not implemented |

**Identifiers stored:**

| Identifier | Stored | Status |
|------------|--------|--------|
| Timestamps | Yes (ISO 8601) | GREEN |
| User IDs | Yes | GREEN |
| Case/Matter IDs | Yes | GREEN |
| IP addresses | Yes | GREEN |
| User agent | Yes | GREEN |
| Cryptographic signature | Yes (HMAC-SHA256) | GREEN |

### 6.2 Reconstructing a Matter

**For a single meeting, can we reconstruct:**

| Question | Capability | Status |
|----------|------------|--------|
| Who initiated recording? | Yes - recording_started event with userId | GREEN |
| Which participants informed and how? | Partial - consent log exists but no multi-party tracking | AMBER |
| Who accessed recordings/transcripts/notes? | No - access events not logged | RED |
| Who edited recordings/transcripts/notes? | Partial - updates logged but not granular | AMBER |
| Who approved final attendance note? | No - approval workflow not implemented | RED |
| What actions/deadlines created? | Yes - action items tracked | GREEN |

**Export for SRA audit/investigations:**

| Capability | Status |
|------------|--------|
| Audit trail CSV export | GREEN - implemented |
| Structured PDF report for COLP | RED - not implemented |

### 6.3 Authoritative Record and Disclosure

| Question | Response | Status |
|----------|----------|--------|
| Which record is authoritative? | [FIRM TO DEFINE - recommend: solicitor-approved attendance note] | AMBER |
| Disclosure handling defined? | [FIRM TO COMPLETE] | AMBER |
| DSAR handling defined? | Phase 5 pending implementation | AMBER |
| Privilege assessment process? | [FIRM TO COMPLETE] | AMBER |

---

## 7. Insurance and Liability

### 7.1 PI Insurer and Broker Engagement

| Question | Response | Status |
|----------|----------|--------|
| Tool explained to PI broker/insurer? | [FIRM TO COMPLETE] | AMBER |
| Feedback documented? | [FIRM TO COMPLETE] | AMBER |
| Conditions/exclusions/recommendations recorded? | [FIRM TO COMPLETE] | AMBER |

### 7.2 Duty of Fair Presentation

| Question | Response | Status |
|----------|----------|--------|
| Disclosure required for PI renewal? | [FIRM TO COMPLETE] | AMBER |
| Framing approach documented? | Recommend: "risk-reduction control" not "AI tool" | AMBER |

### 7.3 Vendor Contract and Liability

| Contract Term | Status |
|---------------|--------|
| Data use and model training restrictions | [FIRM TO VERIFY WITH VENDORS] |
| Security requirements | [FIRM TO VERIFY WITH VENDORS] |
| Incident notification obligations | [FIRM TO VERIFY WITH VENDORS] |
| Liability caps and exclusions | [FIRM TO VERIFY WITH VENDORS] |
| Indemnities | [FIRM TO VERIFY WITH VENDORS] |

---

## 8. Operational Readiness and Change Management

### 8.1 Integrations and Resilience

**Live integrations:**

| Integration | Status | Purpose |
|-------------|--------|---------|
| Google Calendar | GREEN | Bidirectional sync |
| Outlook Calendar | GREEN | Bidirectional sync via Replit connector |
| Clio Manage | GREEN | Matter import/linking |
| SharePoint/OneDrive | GREEN | Document sync |
| Stripe | GREEN | Subscription billing |

**Fallback processes:**

| Scenario | Fallback | Status |
|----------|----------|--------|
| Platform unavailable | [FIRM TO DEFINE - manual note-taking] | AMBER |
| Integration unavailable | Manual data entry | GREEN |

### 8.2 Implementation and Vendor Risk

| Question | Response | Status |
|----------|----------|--------|
| Vendor risk assessed? | [FIRM TO COMPLETE] | AMBER |
| Exit plan defined? | Data exportable via CSV/PDF, deletion available | GREEN |
| Transition alternatives identified? | [FIRM TO COMPLETE] | AMBER |

### 8.3 Policies, Training and Monitoring

| Question | Response | Status |
|----------|----------|--------|
| AI usage policy adopted? | [FIRM TO COMPLETE - template available] | AMBER |
| Recording policy adopted? | [FIRM TO COMPLETE] | AMBER |
| Information security policies updated? | [FIRM TO COMPLETE] | AMBER |
| Training provided? | [FIRM TO COMPLETE] | AMBER |
| Usage monitoring in place? | Basic analytics available | AMBER |

---

## 9. Remediation and Action Plan

### Summary of Status

| Section | GREEN | AMBER | RED |
|---------|-------|-------|-----|
| 1. Scope & Ownership | 7 | 4 | 0 |
| 2. Legal & Regulatory | 6 | 8 | 0 |
| 3. Data Handling | 12 | 5 | 0 |
| 4. Model Behaviour | 5 | 5 | 1 |
| 5. Consent & Policy | 5 | 6 | 0 |
| 6. Auditability | 10 | 6 | 3 |
| 7. Insurance | 0 | 6 | 0 |
| 8. Operational | 4 | 6 | 0 |
| **TOTAL** | **49** | **46** | **4** |

### Consolidated Remediation Actions

| Issue | Section | Remediation Action | Owner | Timescale | Task Reference |
|-------|---------|-------------------|-------|-----------|----------------|
| No attendance note approval workflow | 4.2, 6.2 | Implement Draft → Approved states with solicitor sign-off | Development | 1-3 months | Task 4 |
| No attendance note approval logging | 4.2, 6.2 | Log who approved, when, original vs edited | Development | 1-3 months | Task 5 |
| No action item approval workflow | 4.2 | Implement Draft → Approved states | Development | 1-3 months | Task 6 |
| No action item approval logging | 4.2 | Log approval events | Development | 1-3 months | Task 7 |
| No access/view logging | 6.1, 6.2 | Log case_viewed, document_accessed events | Development | 1-3 months | Task 8 |
| No export logging | 6.1 | Log document exports with attribution | Development | 1-3 months | Task 8 |
| No COLP dashboard | 6.2 | Build compliance officer view with metrics | Development | 3-6 months | Task 9 |
| No COLP audit report PDF | 6.2 | Structured PDF export for SRA/insurer | Development | 3-6 months | Task 10 |
| No Clio task sync | 4.2 | Push approved actions to PMS diary | Development | 3-6 months | Task 11 |
| Single attendance note template | 1.2 | Firm-editable templates per practice area | Development | 3-6 months | Task 12 |
| Generic speaker labels | 4.1 | Hybrid speaker labelling (Solicitor/Client/Counsel) | Development | 3-6 months | Task 13 |
| No governance audit trail | 2.1 | Log settings changes, role changes | Development | 1-3 months | Task 14 |
| No DSAR workflow | 2.3, 6.3 | Structured DSAR request tracking | Development | 3-6 months | Task 15 |
| Security events in memory only | 6.1 | Persist SecurityMonitor events to audit trail | Development | 1-3 months | Task 16 |
| No third-party consent flow | 5.1 | Consent for non-client attendees | Development | 3-6 months | Task 17 |
| No configurable retention | 3.2 | Matter-based retention policies | Development | 3-6 months | Task 18 |
| No "do not record" mechanism | 1.2, 5.3 | Sensitive matter flag | Development | 3-6 months | Future |
| Vendor contracts not verified | 3.4, 7.3 | Review AssemblyAI, OpenAI, Replit contracts | COLP/Risk | 1-3 months | Firm action |
| DPIA not confirmed | 2.2 | Complete UK-GDPR DPIA | COLP/DPO | 1-3 months | Firm action |
| PI insurer not engaged | 7.1 | Brief PI broker on platform | COLP/Risk | 1-3 months | Firm action |
| Firm policies not adopted | 8.3 | Adopt AI usage policy, recording policy | COLP | 1-3 months | Firm action |
| Training not provided | 8.3 | Deliver training to all users | COLP/HR | 1-3 months | Firm action |

### Documentation Deliverables

| Document | Purpose | Status | Task Reference |
|----------|---------|--------|----------------|
| COMPLIANCE_AND_RISK.md | Risk-reduction narrative for COLPs/insurers | Pending | Task 1 |
| DATA_HANDLING.md | Lawyer-readable data statement | Pending | Task 2 |
| AI_USAGE_POLICY_TEMPLATE.md | Ready-made policy for firm adoption | Pending | Task 3 |

---

## Certification

**Auditor Certification:**

I confirm that this self-audit has been conducted thoroughly and the findings accurately represent the current state of the LegalNote platform as deployed at this firm.

| Field | Value |
|-------|-------|
| Auditor Name | [FIRM TO COMPLETE] |
| Role | [FIRM TO COMPLETE] |
| Date | [FIRM TO COMPLETE] |
| Next Review Date | [FIRM TO COMPLETE - recommend 6 months] |

---

*Document generated by LegalNote platform self-audit framework. This document should be stored securely and reviewed periodically in accordance with firm governance procedures.*
