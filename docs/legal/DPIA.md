# LegalNote Data Protection Impact Assessment

**Document Version:** 3.0  
**Last Updated:** July 2026  
**Company:** LegalNote Technologies Ltd (registered in England and Wales, No. 16788981)  
**Next Review:** January 2027  
**Status:** Requires legal counsel review and sign-off  

---

## 1. Executive summary

This DPIA evaluates the data protection risks associated with LegalNote, a compliance-first legal documentation platform for UK solicitors and law firms.

Key findings, aligned to the production configuration as of July 2026:

- LegalNote processes high-risk personal data: audio of legal consultations, transcripts, and generated notes, which may include special category and criminal offence data.
- Privileged transcription (AssemblyAI EU, Dublin), privileged note generation (AWS Bedrock EU) and audio object storage (Backblaze EU, Amsterdam) are confined to the UK or EEA in production.
- The database (Neon, AWS eu-west-2 London) and application hosting (Railway EU-West, Amsterdam) are confirmed in the UK/EEA, with executed sub-processor DPAs.
- Meeting-bot capture (Recall.ai) is confirmed configured to the EU (Frankfurt) region and monitored.
- Each core sub-processor has a United States nexus, leaving a residual US CLOUD Act exposure addressed by transfer safeguards and government-access terms.
- Overall risk level: **MEDIUM**, acceptable with the documented mitigations and accurate customer disclosure.

## 2. Processing description

LegalNote records client meetings (browser recording and optional meeting bots), transcribes them with speaker diarization (AssemblyAI EU), generates legal documentation (AWS Bedrock, Claude, EU inference profile), seals consent and maintains chained audit trails, shares documents securely with clients, and offers optional calendar, Clio (EU) and Microsoft file integrations.

| Data category | Examples | Notes |
|---------------|----------|-------|
| Client personal data | Names, case details | Controller is the firm |
| Audio recordings | Meeting audio | Session audio put beyond use within 7 days; consent evidence segment retained separately |
| Transcripts | Full text of meetings | Stored until firm deletion |
| Legal documents | Attendance notes, letters, summaries | Solicitor review and adoption required |
| Consent and audit | Hashes, signatures, chain entries | Regulatory evidence |

## 3. Necessity and proportionality

Manual contemporaneous documentation at scale is impractical. AI-assisted drafting is proportionate when paired with mandatory solicitor review and short audio retention. For matter data the firm is the controller and determines the lawful basis; LegalNote processes on the firm's documented instructions under Article 28. Minimisation measures include the 7-day session-audio deletion, privileged AI confined to Bedrock EU, no foundation-model training on customer privileged content, and optional connectors that process data only when connected.

## 4. Data flow (primary privileged path)

Client meeting → browser recorder or Recall EU bot → (TLS) LegalNote application → Backblaze B2 EU and AssemblyAI EU → Neon PostgreSQL (London) → AWS Bedrock EU (privileged generation) → generated document → solicitor review and adoption → optional client share link.

| Service | Location posture | Risk note |
|---------|------------------|-----------|
| Backblaze B2 (audio) | EU (Amsterdam) | Strong control |
| AssemblyAI (transcription) | EU (Dublin) | Strong control |
| AWS Bedrock (generation) | EU region + EU profile | Strong control |
| Neon (database) | UK (London), confirmed | Strong control; DPA executed |
| Railway (hosting) | EU (Amsterdam), confirmed | Strong control; DPA executed |
| AWS SES (email) | UK (London) | No document content |
| Recall.ai (bot) | EU (Frankfurt), confirmed | Configured and monitored |
| Google / Microsoft | International / tenant | Feature-dependent |
| Stripe / Twilio | International | Limited, non-privileged data |
| Clio | EU API | Optional |

## 5. Risk assessment

| Risk | Likelihood | Severity | Overall | Mitigation |
|------|------------|----------|---------|------------|
| Unauthorised access to recordings or notes | Low | High | Medium | Access controls, sessions, audit chain, personnel-access logging |
| Breach in transit or storage | Low | High | Medium | TLS; vendor encryption at rest |
| Non-EU processing of bot audio | Low | High | Low–Medium | Recall region confirmed EU (Frankfurt) and monitored |
| Hosting or database region not EU | Low | High | Low | Neon London and Railway EU-West confirmed; DPAs executed |
| Transcription or generation errors | Medium | Medium | Medium | Mandatory solicitor review and adoption |
| Vendor incident | Low | High | Medium | Vendor DPAs, incident response, breach notification |
| Consent not obtained | Low–Med | High | Medium | Sealed consent gate before AI processing |
| US CLOUD Act access | Low | High | Medium | Transfer safeguards; government-access terms; data minimisation |

**Former OpenAI US transfer risk:** superseded. Privileged document generation no longer uses OpenAI in production; production requires Bedrock with EU constraints. OpenAI remains only in non-production test tooling and is not a production privileged sub-processor.

## 6. Data subject rights

Access is facilitated by export and firm tools; rectification by editing transcripts and documents in the product; erasure by case and account deletion flows, subject to retention exceptions for consent and audit evidence; restriction by disabling further processing; portability by document export; and objection is handled by the controller with LegalNote's assistance. Clients of law firms should contact their solicitor, who is the controller.

## 7. Consultation

- Engineering: residency configuration and retention jobs verified against the production codebase (July 2026).
- Legal counsel: review and sign-off required before publication.
- Customer COLP and privacy reviews as part of onboarding where requested.

## 8. Mitigations and controls

| Control | Implementation |
|---------|----------------|
| Encryption in transit | TLS; security headers and HSTS in production |
| Encryption at rest | Provider-managed for database and object storage |
| Access control | Firm and user scoping in storage and routes; personnel access logged |
| Authentication | Google / Microsoft OAuth; connect.sid; 4-hour session lifetime |
| Consent gate | Sealed consent required before AI processing |
| Audit logging | HMAC-SHA256 chained audit; signing key required in production |
| Privileged LLM residency | AWS Bedrock EU only in production |
| Transcription residency | AssemblyAI EU (Dublin) endpoint |
| Object storage residency | Backblaze EU (Amsterdam) endpoint |
| Audio minimisation | Session audio put beyond use within 7 days; consent evidence segment retained separately |
| Penetration testing | Independent test commissioned at least annually |
| Breach notification | Within 24 hours to controllers |

## 9. Decision

| Risk category | Assessment |
|---------------|------------|
| Overall processing risk | MEDIUM |
| Privileged AI / transcription residency | LOW (production gates and EU configuration) |
| Bot / import residency (Recall) | LOW–MEDIUM (confirmed EU, monitored) |
| International vendor risk (auth / billing / comms) | LOW–MEDIUM |
| Security control risk | LOW–MEDIUM |

Processing is conditionally approved for continued operation, subject to: accurate public and customer disclosure (no "data never leaves the UK/EU" absolute claim); maintenance and monitoring of the confirmed EU/UK regions for Neon, Railway, Recall and the privileged path; legal counsel review of this DPIA and the related policies; and the continued solicitor-review-and-adoption requirement for AI outputs.

Re-open this DPIA if: a sub-processor for privileged content changes; a hosting, database or bot region changes; a material legal development affects transfers; or analytics or tracking is introduced.

## 10. Sign-off

| Role | Name | Date |
|------|------|------|
| Data Protection Lead | [To be signed] | July 2026 |
| Managing Director | [To be signed] | July 2026 |

*This DPIA was prepared to align with UK GDPR Article 35 and verified production behaviour as of July 2026. It is not legal advice.*
