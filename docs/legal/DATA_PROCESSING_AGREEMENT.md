# LegalNote Data Processing Agreement (DPA)

**Last Updated:** July 2026  
**Version:** 2.0  
**Status:** DRAFT — requires legal counsel review before publication  

---

## 1. Parties

This Data Processing Agreement ("DPA") is entered into between:

**Data Controller:** The law firm or legal professional subscribing to the LegalNote service ("Controller", "You", "Your Firm")

**Data Processor:** LegalNote Ltd, registered in England and Wales, with registered address at 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ ("Processor", "LegalNote", "We", "Us")

This DPA supplements and forms part of the LegalNote Terms of Service.

---

## 2. Definitions

| Term | Definition |
|------|------------|
| **Personal Data** | Any information relating to an identified or identifiable natural person |
| **Processing** | Any operation performed on Personal Data (collection, storage, use, disclosure, deletion) |
| **Data Subject** | The individual whose Personal Data is processed |
| **Sub-processor** | A third party engaged by LegalNote to process Personal Data on behalf of the Controller |
| **UK GDPR** | The UK General Data Protection Regulation as applied by the Data Protection Act 2018 |
| **SCCs** | Standard Contractual Clauses approved by the European Commission / UK ICO mechanisms |
| **IDTA** | UK International Data Transfer Agreement / UK Addendum as applicable |
| **Privileged Content** | Client audio, transcripts, case/matter content, and generated legal documents processed through the Service |

---

## 3. Scope and Purpose of Processing

### 3.1 Categories of Data Subjects
- Clients of the Controller's law firm
- Other meeting participants (witnesses, opposing counsel, experts, etc.)
- Controller's employees and authorised users

### 3.2 Categories of Personal Data
- Names and contact details
- Voice recordings of meetings
- Transcripts of recorded meetings
- Case/matter information and document content
- Consent records and related audit metadata
- Optional integration data (calendar, PMS, file storage) when connected by the Controller

### 3.3 Special Category Data
Audio and transcripts may incidentally include special category data depending on meeting content. The Controller is responsible for ensuring an appropriate lawful basis and safeguards.

### 3.4 Purpose of Processing
LegalNote processes Personal Data solely to:
- Record meetings as instructed by the Controller
- Transcribe audio (AssemblyAI EU endpoint in production)
- Generate legal documentation via privileged AI (AWS Bedrock EU configuration in production)
- Provide consent sealing, audit trails, and compliance features
- Enable secure document sharing and optional firm integrations
- Provide support and security monitoring necessary to operate the Service

LegalNote does not use Privileged Content to train foundation models.

---

## 4. Controller Obligations

The Controller warrants that:

4.1 It has a lawful basis for processing Personal Data  
4.2 It has provided appropriate privacy notices to Data Subjects  
4.3 It has obtained valid consent (or other lawful basis) before recording any meeting  
4.4 It will not instruct LegalNote to process data in violation of UK GDPR  
4.5 It will review and approve AI-generated documents before relying on them  
4.6 It maintains appropriate client engagement terms covering use of AI documentation tools  
4.7 It will configure and use optional integrations (Clio, Microsoft, Google, Recall bots) lawfully

---

## 5. Processor Obligations

LegalNote shall:

### 5.1 Lawful processing
Process Personal Data only on documented instructions from the Controller, unless required by law to process otherwise.

### 5.2 Confidentiality
Ensure personnel authorised to process Personal Data are bound by confidentiality obligations. Platform personnel access to firm data is auditable.

### 5.3 Security measures (Article 32)
Implement appropriate technical and organisational measures, including:
- Encryption of data in transit (TLS) and encryption at rest as provided by infrastructure vendors
- Access controls and authentication (Google/Microsoft OAuth; 4-hour session TTL)
- Sealed consent required before AI processing of recordings
- Audit logging with HMAC-SHA256 chain / tamper detection in production
- Production residency gates for privileged LLM (Bedrock EU), AssemblyAI EU, and Backblaze EU object storage
- Incident response procedures

### 5.4 Sub-processors
- Obtain Controller's general authorisation for sub-processors listed in `SUB_PROCESSOR_LIST.md`
- Maintain that list and notify Controller of material changes
- Impose equivalent data protection obligations on sub-processors

### 5.5 Data subject rights
Assist the Controller in responding to Data Subject requests.

### 5.6 Data breach notification
Notify the Controller without undue delay (within 72 hours where feasible) upon becoming aware of a Personal Data breach.

### 5.7 DPIA assistance
Assist the Controller with DPIAs where required, considering the nature of processing and information available.

### 5.8 Audit rights
Make available information necessary to demonstrate compliance and allow audits by the Controller or a mandated auditor, subject to reasonable notice and confidentiality.

### 5.9 Deletion / return
At the Controller's choice, delete or return Personal Data upon termination, unless retention is required by law or expressly retained for regulatory audit evidence as described in this DPA.

---

## 6. Sub-processors

### 6.1 Authorised sub-processors

The Controller provides general authorisation for the sub-processors described in `SUB_PROCESSOR_LIST.md`, including in particular:

| Sub-processor | Purpose | Location posture |
|---------------|---------|------------------|
| AssemblyAI Inc. | Audio transcription | EU endpoint |
| Amazon Web Services (Bedrock) | Privileged AI document generation | EU region + EU inference profile |
| Backblaze Inc. | Audio object storage | EU endpoint required in production |
| Neon Inc. | Database hosting | Intended UK/EEA production region |
| Recall.ai Inc. | Meeting bots / import | Configurable; EU intended in production |
| Google LLC | Auth; optional Calendar | International |
| Microsoft Corporation | Auth; optional Outlook/SharePoint | International / customer tenant |
| Clio | Optional PMS | EU Clio API |
| Resend Inc. | Email | International |
| Twilio Inc. | SMS 2FA | International |
| Stripe Inc. | Payments | International |
| Cloud application host | Runtime hosting | Deployment-dependent |

### 6.2 Changes
LegalNote will notify the Controller before adding or replacing material sub-processors (target: 30 days). The Controller may object in writing within 14 days. If unresolved, the Controller may terminate the Service in accordance with the Terms.

---

## 7. International Data Transfers

### 7.1 Privileged path (production design)
In production, LegalNote is configured so that:
- Transcription uses AssemblyAI's EU endpoint
- Privileged AI generation uses AWS Bedrock with EU region and EU inference profile requirements
- Audio object storage uses a Backblaze EU endpoint

### 7.2 Transfers / non-UK-EEA processing that may occur
Depending on features used and deployment configuration:
- Recall.ai processing region (must be set to EU for EU residency; code default if unset is outside the EU)
- Google / Microsoft authentication and optional integrations
- Resend, Twilio, and Stripe
- Database/hosting regions as actually deployed

### 7.3 Safeguards
Transfers outside the UK/EEA rely on adequacy (including DPF where applicable), UK IDTA/UK Addendum and/or SCCs, plus technical measures (encryption, access control, minimisation, privileged-path gates).

### 7.4 Honest limitation
LegalNote does **not** warrant that *all* Personal Data never leaves the UK/EU. It does warrant that privileged transcription and privileged note-generation paths are engineered and production-gated for UK/EU processing as described above.

---

## 8. Data Retention

| Data Type | Retention Period | Basis |
|-----------|------------------|-------|
| Main audio recordings | ~7 days from creation/import, then automatic deletion | Data minimisation |
| Consent segment audio | Retained when main recording is deleted | Consent evidence |
| Transcripts / documents | Until Controller deletion or termination process | Controller instruction |
| Expired share links | Deleted 7 days after expiry | Minimisation |
| Consent / audit records | Intended multi-year regulatory retention (target 7 years) | Professional / legal evidence |
| Account data | Per Privacy Policy / termination process | Contract / legal obligation |

The Controller may request earlier deletion subject to technical feasibility and legal holds.

---

## 9. Security Incident Management

### 9.1 Notification
On becoming aware of a Personal Data breach, LegalNote will:
- Notify the Controller without undue delay (within 72 hours where feasible)
- Describe the nature of the breach, likely consequences, and measures taken or proposed

### 9.2 Cooperation
LegalNote will cooperate with the Controller in investigation, mitigation, and regulatory notification obligations.

---

## 10. Audit Rights

### 10.1 Information provision
Upon request, LegalNote will provide reasonable documentation of security measures, sub-processor posture, and relevant compliance evidence.

### 10.2 Audits
The Controller may conduct audits with reasonable notice (minimum 30 days), during business hours, without unreasonably disrupting operations. Costs are borne by the Controller unless material non-compliance by LegalNote is revealed.

---

## 11. Term and Termination

### 11.1 Duration
This DPA remains in effect for the duration of the service agreement and for as long as LegalNote retains Personal Data.

### 11.2 Termination
Upon termination:
- Controller may export data within 30 days where the export features are available
- LegalNote will delete Personal Data within 90 days unless retention is required by law or for agreed audit evidence
- Audit/consent evidence may be retained for regulatory purposes as described above

---

## 12. Liability

Liability under this DPA is subject to the limitations in the Terms of Service. Each party remains responsible for damages caused by its own breach of UK GDPR.

---

## 13. Governing Law

This DPA is governed by the laws of England and Wales. Disputes are subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 14. Contact

**Privacy:** privacy@legalnote.ai  
**Legal:** legal@legalnote.ai  

LegalNote Ltd  
71-75 Shelton Street  
Covent Garden, London  
WC2H 9JQ  
United Kingdom  

---

## Annex A: Technical and Organisational Measures

### A.1 Access control
- Firm- and user-scoped access controls
- Google / Microsoft OAuth authentication
- Session timeout (4 hours)
- Invite / allowlist controls where enabled
- Personnel access auditing for platform personnel

### A.2 Encryption and transport security
- TLS for data in transit; HSTS/security headers in production
- Encryption at rest as provided by database and object-storage vendors

### A.3 Logging and monitoring
- Chained audit logging with HMAC-SHA256 tamper detection
- Sealed consent events linked into the audit chain
- Production requirement for `AUDIT_SIGNING_KEY`

### A.4 Data minimisation and residency gates
- Main audio auto-deletion after ~7 days
- Consent segment preservation
- Production enforcement: Bedrock EU, AssemblyAI EU, Backblaze EU
- No privileged production use of OpenAI

### A.5 Availability
- Operational backups and recovery procedures as implemented by infrastructure providers and LegalNote operations

### A.6 Personnel
- Confidentiality obligations
- Security awareness appropriate to role

---

*This Data Processing Agreement draft was updated in July 2026 to align with production codebase behaviour. It is not legal advice.*
