# LegalNote Data Processing Agreement (DPA)

**Last Updated:** January 2026  
**Version:** 1.0  

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
| **UK GDPR** | The General Data Protection Regulation as incorporated into UK law by the Data Protection Act 2018 |
| **SCCs** | Standard Contractual Clauses approved by the European Commission / UK ICO |
| **IDTA** | UK International Data Transfer Agreement |

---

## 3. Scope and Purpose of Processing

### 3.1 Categories of Data Subjects
- Clients of the Controller's law firm
- Other meeting participants (witnesses, opposing counsel, etc.)
- Controller's employees and staff

### 3.2 Categories of Personal Data
- Names and contact details
- Voice recordings of meetings
- Transcripts of recorded meetings
- Case/matter information
- Consent records
- Document content

### 3.3 Special Category Data
Audio recordings may incidentally capture special category data (health information, political opinions, religious beliefs, etc.) depending on meeting content. The Controller is responsible for ensuring appropriate safeguards are in place.

### 3.4 Purpose of Processing
LegalNote processes Personal Data solely to:
- Record client meetings as instructed by the Controller
- Transcribe audio recordings
- Generate legal documentation (attendance notes, summaries)
- Provide audit trail and compliance features
- Enable secure document sharing

---

## 4. Controller Obligations

The Controller warrants that:

4.1 It has a lawful basis for processing Personal Data (typically legitimate interests or contract performance)

4.2 It has provided appropriate privacy notices to Data Subjects

4.3 It has obtained valid consent before recording any meeting

4.4 It will not instruct LegalNote to process data in violation of UK GDPR

4.5 It will review and approve AI-generated documents before relying on them

4.6 It maintains appropriate client engagement terms covering the use of AI documentation tools

---

## 5. Processor Obligations

LegalNote shall:

### 5.1 Lawful Processing
Process Personal Data only on documented instructions from the Controller, unless required by law to process otherwise

### 5.2 Confidentiality
Ensure that all personnel authorized to process Personal Data are bound by confidentiality obligations

### 5.3 Security Measures (Article 32)
Implement appropriate technical and organizational measures, including:
- Encryption of data in transit (TLS 1.3) and at rest (AES-256)
- Access controls and authentication
- Audit logging with tamper detection
- Regular security assessments
- Incident response procedures

### 5.4 Sub-processors
- Obtain Controller's general authorization for sub-processors
- Maintain a list of current sub-processors
- Notify Controller of changes to sub-processors
- Impose equivalent data protection obligations on sub-processors

### 5.5 Data Subject Rights
Assist the Controller in responding to Data Subject requests (access, rectification, erasure, portability, restriction, objection)

### 5.6 Data Breach Notification
Notify the Controller without undue delay (within 72 hours where feasible) upon becoming aware of a Personal Data breach

### 5.7 Data Protection Impact Assessments
Assist the Controller with DPIAs where required, considering the nature of processing and information available

### 5.8 Audit Rights
Make available information necessary to demonstrate compliance and allow for audits conducted by the Controller or an auditor mandated by the Controller

### 5.9 Deletion
At the Controller's choice, delete or return all Personal Data upon termination of the service, unless retention is required by law

---

## 6. Sub-processors

### 6.1 Authorized Sub-processors

The Controller provides general authorization for the following sub-processors:

| Sub-processor | Purpose | Location | Safeguards |
|---------------|---------|----------|------------|
| AssemblyAI Inc. | Audio transcription | EU (Dublin) | EU data residency |
| OpenAI LLC | Document generation | US | SCCs + DPF certification |
| Recall.ai Inc. | Video meeting recording | EU (Frankfurt) | EU data residency |
| Neon Inc. | Database hosting | EU | EU data residency |
| Replit Inc. | Application hosting | EU | DPA in place |
| Resend Inc. | Email delivery | US | SCCs + DPF certification |
| Twilio Inc. | SMS (2FA) | US | SCCs + DPF certification |
| Stripe Inc. | Payment processing | US | SCCs + DPF certification |

### 6.2 Changes to Sub-processors
LegalNote will notify the Controller at least 30 days before adding or replacing sub-processors. The Controller may object to changes by providing written notice within 14 days. If the objection cannot be resolved, the Controller may terminate the service.

---

## 7. International Data Transfers

### 7.1 Primary Processing
LegalNote processes data primarily within the UK and EU:
- Application hosting: EU
- Database: EU
- Transcription: EU (Dublin)
- Meeting recording: EU (Frankfurt)

### 7.2 Transfers to the United States
Certain sub-processors (OpenAI, Resend, Twilio, Stripe) process data in the United States. These transfers are protected by:
- EU-US Data Privacy Framework (DPF) certification of the recipient
- Standard Contractual Clauses (SCCs) / UK IDTA
- Supplementary technical measures (encryption, access controls)

### 7.3 Transfer Impact Assessment
LegalNote has conducted a Transfer Impact Assessment for US transfers, documented in our Data Protection Impact Assessment. Key mitigations include:
- Encryption of data before transfer
- Minimization of data transferred
- Contractual protections requiring notice of government access requests

---

## 8. Data Retention

| Data Type | Retention Period | Basis |
|-----------|-----------------|-------|
| Audio recordings | 7 days post-transcription | Data minimization |
| Transcripts | Until Controller deletion | Controller instruction |
| Documents | Until Controller deletion | Controller instruction |
| Consent records | 7 years minimum | Legal hold / SRA requirements |
| Audit logs | 7 years | Regulatory compliance |

The Controller may request earlier deletion in accordance with their retention policies.

---

## 9. Security Incident Management

### 9.1 Notification
In the event of a Personal Data breach, LegalNote will:
- Notify the Controller within 72 hours of becoming aware
- Provide details of the nature of the breach
- Describe likely consequences
- Describe measures taken or proposed to address the breach

### 9.2 Cooperation
LegalNote will cooperate with the Controller in investigating and mitigating the breach and in meeting regulatory notification obligations.

---

## 10. Audit Rights

### 10.1 Information Provision
Upon request, LegalNote will provide:
- Copies of relevant certifications and audit reports
- Documentation of security measures
- Evidence of sub-processor compliance

### 10.2 On-Site Audits
The Controller may conduct on-site audits with reasonable notice (minimum 30 days). The Controller shall bear the costs of such audits unless the audit reveals material non-compliance by LegalNote.

---

## 11. Term and Termination

### 11.1 Duration
This DPA remains in effect for the duration of the service agreement and for as long as LegalNote retains Personal Data.

### 11.2 Termination
Upon termination of the service:
- Controller may export data within 30 days
- LegalNote will delete Personal Data within 90 days unless retention is required by law
- Audit logs may be retained for 7 years for regulatory compliance

---

## 12. Liability

Liability under this DPA is subject to the limitations set out in the Terms of Service. Each party is liable for damages caused by its own breach of UK GDPR.

---

## 13. Governing Law

This DPA is governed by the laws of England and Wales. Disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 14. Contact

**Data Protection Queries:**  
Email: privacy@legalnote.ai

**Legal Matters:**  
Email: legal@legalnote.ai

LegalNote Ltd  
71-75 Shelton Street  
Covent Garden, London  
WC2H 9JQ  
United Kingdom

---

## Annex A: Technical and Organizational Measures

### A.1 Access Control
- Role-based access controls
- Multi-factor authentication for admin access
- Session timeout (4 hours with warning)
- Unique user credentials

### A.2 Encryption
- TLS 1.3 for data in transit
- AES-256 for data at rest
- Encrypted backups

### A.3 Logging and Monitoring
- Comprehensive audit logging
- HMAC-SHA256 tamper detection
- Failed login tracking
- Suspicious activity detection

### A.4 Data Minimization
- Audio deleted 7 days post-transcription
- Minimal data collection principle
- Purpose limitation enforcement

### A.5 Availability
- Automated backups
- Disaster recovery procedures
- Uptime monitoring

### A.6 Personnel
- Confidentiality agreements
- Security awareness training
- Background checks where appropriate

---

*This Data Processing Agreement was last updated in January 2026.*
