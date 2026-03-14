# LegalNote Sub-processor List

**Last Updated:** January 2026  
**Version:** 1.0  

---

## Overview

This document lists all third-party sub-processors engaged by LegalNote Ltd to process personal data on behalf of our customers (law firms and legal professionals).

In accordance with our Data Processing Agreement (DPA), we will notify customers at least 30 days before adding or replacing sub-processors.

---

## Current Sub-processors

### Core Service Delivery

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|-------------------|
| **AssemblyAI Inc.** | Audio transcription with speaker diarization | Audio recordings, client names via word boost | EU (Dublin, Ireland) | EU data residency - no international transfer |
| **OpenAI LLC** | AI document generation (attendance notes, summaries) | Transcript text, case context | US | EU-US DPF + SCCs |
| **Recall.ai Inc.** | Video meeting recording (Zoom, Teams, Meet) | Meeting audio/video, participant names | EU (Frankfurt, Germany) | EU data residency - no international transfer |

### Infrastructure

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|-------------------|
| **Neon Inc.** | PostgreSQL database hosting | All application data (cases, transcripts, documents, user accounts) | EU | EU data residency - no international transfer |
| **Replit Inc.** | Application hosting and compute | All application data in transit and processing | EU | DPA in place |
| **Backblaze Inc.** | Object storage (audio files) | Audio recordings | EU | EU data residency - no international transfer |

### Communications

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|-------------------|
| **Resend Inc.** | Transactional email delivery | Email addresses, email content | US | EU-US DPF + SCCs |
| **Twilio Inc.** | SMS delivery (2FA for share links) | Phone numbers, verification codes | US | EU-US DPF + SCCs |

### Payments

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|-------------------|
| **Stripe Inc.** | Payment processing | Billing contact details, payment method tokens (not card numbers) | US | EU-US DPF + SCCs |

---

## Calendar & Integration Connectors

| Sub-processor | Purpose | Data Processed | Location | Transfer Mechanism |
|---------------|---------|----------------|----------|-------------------|
| **Google LLC** | Google Calendar sync | Calendar event details, meeting links | US | EU-US DPF + SCCs |
| **Microsoft Corporation** | Outlook Calendar sync, SharePoint/OneDrive integration | Calendar event details, document files | US/EU | EU-US DPF + SCCs, EU data centers for M365 |

---

## Data Residency Summary

| Processing Activity | Primary Location | Notes |
|--------------------|------------------|-------|
| Audio transcription | EU (Dublin) | AssemblyAI EU endpoint |
| Meeting bot recording | EU (Frankfurt) | Recall.ai EU region |
| Database storage | EU | Neon serverless PostgreSQL |
| Object storage | EU | Backblaze B2 EU region |
| Application hosting | EU | Replit infrastructure |
| Document generation | US | OpenAI with SCCs/DPF |
| Email/SMS | US | Resend/Twilio with SCCs/DPF |

---

## International Transfer Safeguards

For sub-processors located in the United States, we rely on the following safeguards:

### EU-US Data Privacy Framework (DPF)
All US sub-processors are certified under the EU-US Data Privacy Framework, which provides an adequacy mechanism for data transfers following the July 2023 European Commission decision.

### Standard Contractual Clauses (SCCs) / UK IDTA
As a supplementary measure, we maintain Standard Contractual Clauses with all US sub-processors. For UK data, we use the UK International Data Transfer Agreement (IDTA) or UK Addendum to SCCs.

### Technical Measures
- All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- Minimization of data transferred to US processors
- Access controls limiting who can access data

---

## Changes to Sub-processors

### Notification Process
1. LegalNote will email all customers at least 30 days before adding or replacing a sub-processor
2. Customers may object in writing within 14 days
3. If objection cannot be resolved, the customer may terminate the service

### Change Log

| Date | Change | Details |
|------|--------|---------|
| January 2026 | Initial list | Document created |
| January 2026 | AssemblyAI | Migrated to EU endpoint (api.eu.assemblyai.com) |
| January 2026 | Recall.ai | Migrated to EU region (eu-central-1) |

---

## Contact

To receive sub-processor change notifications or to object to a proposed change:

**Email:** privacy@legalnote.ai

LegalNote Ltd  
71-75 Shelton Street  
Covent Garden, London  
WC2H 9JQ  
United Kingdom

---

*This Sub-processor List is maintained in accordance with our Data Processing Agreement and UK GDPR Article 28 requirements.*
