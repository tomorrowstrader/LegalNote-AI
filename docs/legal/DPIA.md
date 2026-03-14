# LegalNote Data Protection Impact Assessment (DPIA)

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Author:** LegalNote Ltd  
**Status:** Active  
**Next Review Date:** July 2026  

---

## 1. Executive Summary

This Data Protection Impact Assessment (DPIA) evaluates the data protection risks associated with the LegalNote platform, a compliance-first legal documentation tool for UK solicitors and law firms.

**Key Findings:**
- LegalNote processes high-risk personal data (audio recordings of legal consultations)
- Primary processing occurs within UK/EU jurisdiction
- Residual risk exists for international transfers to OpenAI (US) for document generation
- Mitigations include EU-US DPF, SCCs, and encryption
- Overall risk level: **MEDIUM** (acceptable with documented mitigations)

---

## 2. Processing Description

### 2.1 Nature of Processing
LegalNote provides:
- Recording of client meetings (in-person and video conferencing)
- AI-powered transcription with speaker diarization
- AI-generated legal documentation (attendance notes, summaries)
- Consent management and audit trails
- Secure document sharing with clients

### 2.2 Scope of Processing

| Data Category | Examples | Volume |
|---------------|----------|--------|
| Client personal data | Names, case details | Thousands of records |
| Audio recordings | Client meeting recordings | Hours of audio per firm |
| Transcripts | Full text of meetings | Derived from audio |
| Legal documents | Attendance notes, summaries | Generated from transcripts |
| Consent records | Timestamps, consent audio | One per meeting |

### 2.3 Context of Processing
- **Data Subjects:** Clients of law firms, meeting participants
- **Relationship:** Indirect (LegalNote is processor, law firm is controller)
- **Expectations:** Clients expect confidential treatment of legal consultations
- **Sector:** Legal services (highly regulated, professional privilege applies)

### 2.4 Purposes of Processing
1. Create accurate records of client meetings for professional compliance
2. Generate contemporaneous attendance notes (SRA best practice)
3. Document client consent for regulatory audit trails
4. Enable secure sharing of documents with clients

---

## 3. Necessity and Proportionality

### 3.1 Legal Basis for Processing

| Processing Activity | Legal Basis | Justification |
|--------------------|-------------|---------------|
| Recording meetings | Legitimate interests (law firm) | Accurate documentation supports professional duties |
| Transcription | Contract performance | Necessary to deliver subscribed service |
| Document generation | Contract performance | Core service feature |
| Consent logging | Legal obligation | GDPR Article 7 (demonstrating consent) |
| Audit trail | Legitimate interests | Professional compliance, risk management |

### 3.2 Necessity Assessment
**Is the processing necessary for the stated purpose?**
- Yes. Manual transcription is prohibitively expensive and slow
- AI-assisted documentation is the only practical way to create contemporaneous records
- Alternative (manual note-taking) is less accurate and more burdensome

### 3.3 Proportionality Assessment
**Is the processing proportionate?**
- Data minimization: Audio deleted 7 days after transcription
- Purpose limitation: Data used only for documentation, never for AI training
- Storage limitation: Firms control retention; defaults align with professional requirements

---

## 4. Data Flow Analysis

### 4.1 Data Flow Diagram

```
[Client Meeting]
       ↓
[Recording Device / Browser]
       ↓ (TLS 1.3)
[LegalNote Server - EU]
       ↓
[Object Storage - EU] ←→ [AssemblyAI EU - Dublin]
       ↓                        ↓
[Database - EU]         [Transcript returned]
       ↓
[OpenAI - US] ←── Document generation request
       ↓
[Generated document]
       ↓
[Solicitor review/approval]
       ↓
[Client access via share link]
```

### 4.2 Data Residency by Service

| Service | Data Processed | Location | Transfer Mechanism |
|---------|----------------|----------|-------------------|
| LegalNote Application | All data | EU | N/A (no transfer) |
| Object Storage | Audio files | EU | N/A (no transfer) |
| Database (Neon) | All structured data | EU | N/A (no transfer) |
| AssemblyAI | Audio → Transcript | EU (Dublin) | N/A (no transfer) |
| Recall.ai | Meeting recording | EU (Frankfurt) | N/A (no transfer) |
| OpenAI | Transcript → Document | US | SCCs + DPF |
| Resend | Email addresses | US | SCCs + DPF |
| Twilio | Phone numbers (2FA) | US | SCCs + DPF |

---

## 5. Risk Assessment

### 5.1 Risk Matrix

| Risk | Likelihood | Severity | Overall | Mitigation |
|------|------------|----------|---------|------------|
| Unauthorized access to recordings | Low | High | Medium | Encryption, access controls, audit logging |
| Data breach during transfer | Low | High | Medium | TLS 1.3, encrypted at rest |
| US government access (OpenAI) | Low | Medium | Low-Medium | DPF, SCCs, encryption, data minimization |
| Transcription errors affecting legal accuracy | Medium | Medium | Medium | Solicitor review required before use |
| Vendor security incident | Low | High | Medium | Vetted sub-processors, DPAs, incident response |
| Client consent not properly obtained | Low | High | Medium | Consent workflow, timestamp logging |
| Over-retention of audio | Low | Medium | Low | 7-day auto-deletion |

### 5.2 US Transfer Risk Assessment (OpenAI)

**Background:**
OpenAI LLC is headquartered in the US and subject to US surveillance laws (FISA Section 702, EO 12333, Cloud Act).

**Safeguards in Place:**

1. **EU-US Data Privacy Framework (DPF)**
   - OpenAI is certified under the DPF framework
   - DPF received adequacy decision from European Commission (July 2023)
   - UK government has recognized DPF as providing adequate protection

2. **Standard Contractual Clauses (SCCs)**
   - SCCs incorporated into OpenAI's Terms of Service
   - UK IDTA addendum applied for UK data transfers

3. **Technical Measures**
   - Data encrypted in transit (TLS 1.3)
   - Only transcript text sent to OpenAI (not audio)
   - No persistent storage by OpenAI (API calls, not training data)
   - Client names can be pseudonymized before sending

4. **Data Minimization**
   - Only the minimum data necessary for document generation is sent
   - No audio files transferred to OpenAI
   - Sensitive information can be redacted prior to processing

**Residual Risk Assessment:**
- Likelihood of US government access: Low (legal protections, encryption)
- Impact if access occurred: Medium (legal privilege concerns)
- Overall residual risk: **LOW-MEDIUM** (acceptable with documented mitigations)

**Alternative Considered:**
- Azure OpenAI (EU region) would eliminate transfer risk
- Currently evaluating for future implementation
- Documented in FUTURE_FEATURES.md roadmap

---

## 6. Data Subject Rights

### 6.1 Rights Facilitation

| Right | How Facilitated |
|-------|-----------------|
| **Access** | Export functionality for all case data |
| **Rectification** | Edit capabilities for transcripts and documents |
| **Erasure** | Delete case, delete account functionality |
| **Restriction** | Can pause processing by not generating documents |
| **Portability** | PDF and Word export, JSON API |
| **Object** | Can opt out of specific features |

### 6.2 Client Rights (Third-Party Data Subjects)
- Clients of law firms should contact their solicitor (controller)
- LegalNote will assist controllers in responding to requests
- Process documented in DPA

---

## 7. Consultation

### 7.1 Internal Stakeholders
- Product team: Confirmed technical mitigations
- Legal counsel: Reviewed transfer mechanisms
- Security: Validated encryption and access controls

### 7.2 External Consultation
- Law firm customers: Informal feedback on consent workflow
- ICO guidance: Reviewed published guidance on AI and international transfers

### 7.3 Data Subject Views
- Target users (solicitors) consulted on workflow design
- Consent mechanisms designed to be clear and transparent
- Client-facing share links include privacy information

---

## 8. Mitigations and Controls

### 8.1 Technical Controls

| Control | Implementation |
|---------|----------------|
| Encryption in transit | TLS 1.3 for all connections |
| Encryption at rest | AES-256 for database and object storage |
| Access control | Role-based, user isolation enforced at storage layer |
| Authentication | Replit Auth with session management |
| Audit logging | HMAC-SHA256 signed logs, tamper-evident |
| Session security | 4-hour timeout, activity extension |
| Data minimization | Audio deleted after 7 days |

### 8.2 Organizational Controls

| Control | Implementation |
|---------|----------------|
| Sub-processor vetting | DPAs required, security assessment |
| Staff training | Confidentiality obligations |
| Incident response | 72-hour notification commitment |
| Regular review | DPIA reviewed every 6 months |
| Documentation | Privacy policy, DPA, sub-processor list maintained |

### 8.3 Contractual Controls

| Control | Implementation |
|---------|----------------|
| Data Processing Agreement | Provided to all customers |
| Sub-processor DPAs | In place with all vendors |
| SCCs / UK IDTA | Applied to US transfers |
| Audit rights | Customer audit rights in DPA |

---

## 9. Decision

### 9.1 Risk Summary

| Risk Category | Assessment |
|---------------|------------|
| Overall processing risk | **MEDIUM** |
| International transfer risk | **LOW-MEDIUM** |
| Security risk | **LOW** |
| Compliance risk | **LOW** |

### 9.2 Conclusion
The processing described in this DPIA is **APPROVED** subject to the mitigations documented above.

The residual risks are acceptable because:
1. Primary processing occurs within UK/EU
2. US transfers are limited to document generation (no audio)
3. Robust legal mechanisms (DPF, SCCs) are in place
4. Technical encryption provides defense in depth
5. Solicitors review all output before reliance

### 9.3 Conditions
- This DPIA must be reviewed if:
  - New sub-processors are added
  - Processing scope changes
  - Relevant legal developments occur (e.g., DPF invalidation)
- Azure OpenAI (EU region) should be evaluated for future implementation
- OpenAI transfer risk should be disclosed to customers in the DPA

---

## 10. Sign-Off

| Role | Name | Date |
|------|------|------|
| Data Protection Lead | [To be signed] | January 2026 |
| Technical Lead | [To be signed] | January 2026 |
| Managing Director | [To be signed] | January 2026 |

---

## Annex A: Sub-processor Details

See separate document: `SUB_PROCESSOR_LIST.md`

## Annex B: Technical Architecture

See separate document: `TECHNICAL_ARCHITECTURE.md`

## Annex C: Data Flow Diagrams

See Section 4.1 above.

---

*This DPIA was prepared in accordance with UK GDPR Article 35 and ICO guidance on conducting DPIAs.*
