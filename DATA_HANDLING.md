# LegalNote AI: Data Handling Statement

**Lawyer-Readable Summary of Data Flows, Retention, and Privacy**

---

## Purpose

This document provides a clear, lawyer-readable explanation of how LegalNote AI handles client data. It is designed for:

- Compliance Officers (COLPs/DPOs)
- Risk Partners
- PI Insurers
- Procurement/IT Security teams

---

## Data Categories and Lifecycle

### What Data We Process

| Data Type | Source | Purpose | Retention |
|-----------|--------|---------|-----------|
| **Audio recordings** | Client meeting recordings | Transcription input | 7 days (configurable) |
| **Transcripts** | AI-generated from audio | Attendance note generation | Matter lifetime |
| **Attendance notes** | AI-generated from transcript | File documentation | Matter lifetime |
| **Action items** | AI-extracted from transcript | Task management | Matter lifetime |
| **Consent logs** | User input at recording start | GDPR compliance | Indefinite |
| **Audit logs** | System-generated | Regulatory compliance | Indefinite |
| **User data** | Replit authentication | Access control | Account lifetime |

### Data Flow Diagram

```
Client Meeting
      |
      v
[Solicitor initiates recording]
      |
      v
[Audio captured in browser] --> [Uploaded to Object Storage]
      |                                    |
      v                                    v
[Consent logged with wording]    [Audio sent to AssemblyAI]
      |                                    |
      v                                    v
[Audit event: recording_stopped]  [Transcript returned]
                                          |
                                          v
                                  [GPT-4o correction]
                                          |
                                          v
                                  [Attendance note generated]
                                          |
                                          v
                                  [Solicitor reviews/approves]
                                          |
                                          v
                                  [Document exported/shared]
```

---

## Hosting and Jurisdiction

### Infrastructure Providers

| Component | Provider | Purpose | Data Location |
|-----------|----------|---------|---------------|
| Application hosting | Replit | Web application | [Confirm with Replit] |
| Database | Neon (PostgreSQL) | Structured data storage | [Confirm region] |
| Object storage | Replit/Backblaze B2 | Audio file storage | [Confirm region] |
| Transcription | AssemblyAI | Speech-to-text | US-based processing |
| AI processing | OpenAI | Document generation | US-based processing |
| Email delivery | Resend | Notifications | [Confirm region] |
| SMS delivery | Twilio | 2FA codes | [Confirm region] |

### Data Transfer Considerations

- Audio and transcript data may be processed in the US by AssemblyAI and OpenAI
- Standard Contractual Clauses (SCCs) or equivalent safeguards should be verified with each processor
- [FIRM ACTION REQUIRED: Confirm adequacy decisions / SCCs with each sub-processor]

---

## Sub-Processors

### Primary Sub-Processors

| Processor | Data Processed | Purpose | Training on Data? |
|-----------|---------------|---------|-------------------|
| **AssemblyAI** | Audio files | Speech-to-text transcription | No* |
| **OpenAI** | Transcript text | Document generation, correction | No* |
| **Neon** | All structured data | Database hosting | No |
| **Replit** | All application data | Application hosting | No |
| **Resend** | Email content | Notification delivery | No |
| **Twilio** | Phone numbers, OTP | SMS 2FA | No |

*[FIRM ACTION REQUIRED: Verify contractual terms prohibit training on client data]

### No Cross-Client Training

LegalNote AI does not:
- Train AI models on client data
- Share data between tenants/firms
- Use client data for product improvement without consent
- Retain data beyond configured retention periods

---

## Retention Policies

### Default Retention Schedule

| Data Type | Default Retention | Enforcement | Configurable? |
|-----------|------------------|-------------|---------------|
| Raw audio | 7 days | Automated daily cleanup | Yes (planned) |
| Transcripts | Matter lifetime | Manual deletion | Yes (planned) |
| Attendance notes | Matter lifetime | Manual deletion | Yes (planned) |
| Action items | Matter lifetime | Manual deletion | Yes (planned) |
| Consent logs | Indefinite | No deletion | No |
| Audit logs | Indefinite | No deletion | No |

### Retention Exceptions

**Litigation Hold:**
- When applied, suspends automated deletion
- Tracks who applied hold, when, and why
- Tracks who released hold
- Creates audit entry for every skipped deletion

### Audio Deletion Process

1. Daily cleanup runs at 2:00 AM (Europe/London)
2. Identifies audio files older than retention period
3. Checks for litigation holds - skips if held
4. Deletes from object storage
5. Logs deletion event with attribution
6. Updates case record

---

## Security Controls

### Authentication

| Control | Implementation |
|---------|----------------|
| Authentication method | Replit Auth (OIDC-based) |
| Session management | Secure cookies, HttpOnly, SameSite |
| Session timeout | 4 hours with activity extension |
| Failed login tracking | Logged and monitored |

### Authorisation

| Control | Implementation |
|---------|----------------|
| User isolation | All queries filtered by authenticated user ID |
| Matter scoping | Data linked to creating user |
| Role-based access | Enforced at storage, route, and UI levels |
| Share link security | Optional password + SMS 2FA |

### Encryption

| Layer | Implementation |
|-------|----------------|
| In transit | HTTPS/TLS for all connections |
| At rest | Provider-managed encryption (Neon, Backblaze) |
| Audit integrity | HMAC-SHA256 signatures on log entries |

### Network Security

| Control | Implementation |
|---------|----------------|
| HTTPS enforcement | All traffic encrypted |
| CORS | Restricted to application domain |
| Rate limiting | Applied to API endpoints |
| Input validation | Zod schema validation on all inputs |
| Content Security Policy | Configured via Helmet |

---

## Data Subject Rights

### Supported Rights

| Right | Capability | Process |
|-------|------------|---------|
| **Access** | Full | Query audit trail, export documents |
| **Rectification** | Full | Edit transcripts, notes, action items |
| **Restriction** | Full | Litigation hold suspends processing |
| **Erasure** | Partial | Manual deletion available; audit logs preserved |
| **Portability** | Full | Export to PDF, Word, CSV |
| **Objection** | Full | Consent withdrawal logged |

### DSAR Response

To respond to a Data Subject Access Request:

1. Query audit trail for subject's data
2. Export all documents (transcripts, notes, actions)
3. Provide consent logs showing lawful basis
4. Produce audit trail showing access history
5. [FUTURE: Structured DSAR workflow - Phase 5]

### Erasure Limitations

The following data is NOT deleted on erasure request:
- Audit log entries (regulatory requirement)
- Consent logs (evidence of lawful processing)

Rationale: These records are necessary for regulatory compliance and may be required for SRA or PI claim defence.

---

## Incident Response

### Breach Notification

In the event of a personal data breach:

1. Platform logs all access and security events
2. Audit trail supports incident reconstruction
3. [FIRM ACTION REQUIRED: Define notification procedures]
4. [FIRM ACTION REQUIRED: Confirm 72-hour ICO notification process]

### Audit Trail for Incidents

For any matter, the platform can produce:
- Who accessed data and when
- What changes were made
- Who exported or shared documents
- Complete event timeline with cryptographic integrity

---

## Vendor Contract Verification

### Required Contractual Terms

[FIRM ACTION REQUIRED: Verify with each sub-processor]

| Vendor | Required Terms | Verified? |
|--------|---------------|-----------|
| AssemblyAI | No training on client data, SCCs | [ ] |
| OpenAI | No training on client data, SCCs | [ ] |
| Replit | Data processing agreement, security standards | [ ] |
| Neon | Data processing agreement | [ ] |
| Resend | Data processing agreement | [ ] |
| Twilio | Data processing agreement | [ ] |

### Recommended Contract Review

For each sub-processor, verify:
- [ ] No cross-client model training
- [ ] No secondary use of data
- [ ] No onward disclosure
- [ ] Adequate security measures
- [ ] Incident notification obligations
- [ ] Data deletion on termination
- [ ] Standard Contractual Clauses (for non-EU processors)

---

## Summary Statement

**For client-facing communications:**

> "LegalNote AI processes meeting recordings to create transcripts and attendance notes. Audio is retained for 7 days then automatically deleted. All data is encrypted, access-controlled, and logged. We do not share your data with other clients or use it to train AI models. Full data handling details are available on request."

**For regulatory inquiries:**

> "LegalNote AI maintains comprehensive audit trails with cryptographic integrity verification. All processing is lawful-basis documented, consent is logged with exact wording, and data subject rights are fully supported. Retention policies are technically enforced with litigation hold capability."

---

*This document should be reviewed when sub-processor arrangements change or platform capabilities are updated.*
