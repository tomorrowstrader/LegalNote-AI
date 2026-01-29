# LegalNote AI Privacy Policy

**Last Updated:** January 2026  
**Effective Date:** January 2026  
**Company:** LegalNote AI Ltd  
**Registered Address:** 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ  

---

## 1. Introduction

LegalNote AI Ltd ("LegalNote", "we", "us", "our") is committed to protecting the privacy of our users and their clients. This Privacy Policy explains how we collect, use, store, and protect personal data when you use our legal documentation platform.

LegalNote is a compliance-first documentation tool designed for UK solicitors and law firms. We act as a **data processor** on behalf of law firms (the **data controllers**) when processing client meeting recordings and generating legal documentation.

---

## 2. Data Controller and Processor Roles

| Role | Entity | Responsibility |
|------|--------|----------------|
| **Data Controller** | Your law firm | Determines purposes and means of processing client data |
| **Data Processor** | LegalNote AI Ltd | Processes data on behalf of your firm per our DPA |
| **Sub-processors** | See Section 9 | Third parties we engage to deliver services |

---

## 3. Personal Data We Collect

### 3.1 Account Data (Solicitor Users)
- Name, email address, firm name
- Authentication credentials (via Replit Auth)
- Firm branding and preferences
- Usage logs and session data

### 3.2 Client Data (Processed on Behalf of Law Firms)
- Audio recordings of client meetings
- Transcripts generated from recordings
- Client names, matter references, case details
- Consent records and timestamps
- Generated documents (attendance notes, summaries)

### 3.3 Technical Data
- IP addresses, browser type, device information
- Log data for security and troubleshooting
- Cookies (see our Cookie Policy)

---

## 4. How We Use Personal Data

| Purpose | Legal Basis (UK GDPR) |
|---------|----------------------|
| Provide the LegalNote service | Contract performance (Art. 6(1)(b)) |
| Generate transcripts and documents | Legitimate interests of the controller (Art. 6(1)(f)) |
| Improve transcription accuracy | Legitimate interests (Art. 6(1)(f)) |
| Security and fraud prevention | Legitimate interests (Art. 6(1)(f)) |
| Comply with legal obligations | Legal obligation (Art. 6(1)(c)) |
| Send service communications | Contract performance (Art. 6(1)(b)) |
| Marketing (with consent) | Consent (Art. 6(1)(a)) |

**Important:** We do NOT use client audio, transcripts, or case data to train AI models. Your client data is processed solely to deliver the service you requested.

---

## 5. Data Storage and Security

### 5.1 Data Location
| Data Type | Storage Location | Provider |
|-----------|-----------------|----------|
| Audio recordings | EU (Object Storage) | Replit/Backblaze EU |
| Transcripts & documents | EU (PostgreSQL) | Neon (EU region) |
| Transcription processing | EU (Dublin, Ireland) | AssemblyAI EU endpoint |
| Document generation | US (with SCCs/DPF) | OpenAI |
| Meeting bot data | EU (Frankfurt) | Recall.ai EU endpoint |

### 5.2 International Transfers
Where data is processed outside the UK/EEA (specifically OpenAI for document generation), we rely on:
- EU-US Data Privacy Framework (DPF) certification
- Standard Contractual Clauses (SCCs) / UK International Data Transfer Agreement (IDTA)
- Supplementary technical measures (encryption in transit and at rest)

This is documented in our Data Protection Impact Assessment (DPIA).

### 5.3 Security Measures
- TLS 1.3 encryption for all data in transit
- AES-256 encryption for data at rest
- Role-based access controls
- Audit logging with HMAC-SHA256 tamper detection
- Regular security assessments
- Session timeouts and secure authentication

---

## 6. Data Retention

| Data Type | Retention Period | Justification |
|-----------|-----------------|---------------|
| Audio recordings | 7 days after transcription | Data minimization |
| Transcripts | Until deleted by user or firm | Required for service |
| Documents | Until deleted by user or firm | Required for service |
| Consent records | 7 years minimum | SRA compliance / legal hold |
| Audit logs | 7 years | Regulatory compliance |
| Account data | Duration of account + 2 years | Legal obligations |

Firms may configure longer retention periods where required for professional obligations.

---

## 7. Your Rights (UK GDPR)

As a data subject, you have the right to:

| Right | Description |
|-------|-------------|
| **Access** | Request a copy of your personal data |
| **Rectification** | Correct inaccurate personal data |
| **Erasure** | Request deletion ("right to be forgotten") |
| **Restriction** | Limit how we process your data |
| **Portability** | Receive your data in a portable format |
| **Object** | Object to processing based on legitimate interests |
| **Withdraw consent** | Where processing is based on consent |

**To exercise your rights:** Contact us at privacy@legalnote.ai

**For client data:** If you are a client of a law firm using LegalNote, please contact your solicitor directly. They are the data controller and will coordinate with us as needed.

---

## 8. Cookies

We use essential cookies for authentication and session management. See our separate Cookie Policy for details.

---

## 9. Sub-processors

We engage the following sub-processors to deliver our service:

| Sub-processor | Purpose | Location | DPA in Place |
|---------------|---------|----------|--------------|
| AssemblyAI | Audio transcription | EU (Dublin) | Yes |
| OpenAI | Document generation | US (DPF certified) | Yes |
| Recall.ai | Video meeting recording | EU (Frankfurt) | Yes |
| Neon | Database hosting | EU | Yes |
| Replit | Application hosting | EU | Yes |
| Resend | Email delivery | US (DPF certified) | Yes |
| Twilio | SMS (2FA for share links) | US (DPF certified) | Yes |
| Stripe | Payment processing | US (DPF certified) | Yes |

We maintain an up-to-date sub-processor list and will notify customers of any changes.

---

## 10. Children's Privacy

LegalNote is a B2B service for legal professionals. We do not knowingly collect data from individuals under 18 years of age.

---

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify registered users of material changes via email and update the "Last Updated" date above.

---

## 12. Contact Us

**Data Protection Queries:**  
Email: privacy@legalnote.ai

**Data Protection Officer:**  
LegalNote AI Ltd  
71-75 Shelton Street  
Covent Garden, London  
WC2H 9JQ  
United Kingdom

**Supervisory Authority:**  
You have the right to lodge a complaint with the Information Commissioner's Office (ICO):  
https://ico.org.uk/make-a-complaint/

---

*This Privacy Policy is governed by the laws of England and Wales.*
