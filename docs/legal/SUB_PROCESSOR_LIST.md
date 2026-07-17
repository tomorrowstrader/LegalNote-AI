# LegalNote Sub-processor List

**Last Updated:** July 2026  
**Version:** 3.0  
**Company:** LegalNote Technologies Ltd (registered in England and Wales, No. 16788981)  
**Status:** Requires legal counsel review before publication  

---

## Overview

This document lists the third-party sub-processors engaged by LegalNote Technologies Ltd to process personal data on behalf of customers (law firms and legal professionals), based on the integrations present in the production platform. In accordance with our Data Processing Agreement, we will notify customers at least 30 days before adding or replacing a material sub-processor, or as otherwise required by the DPA.

Each of the core sub-processors below is a United States company or has a United States parent. Client data is stored and processed in the region shown, but a residual exposure to United States law, including the CLOUD Act, remains that the choice of region does not remove. We address this through the transfer safeguards recorded below and the government-access terms in each sub-processor agreement.

## Core privileged processing

| Sub-processor | Purpose | Region | Transfer position |
|---------------|---------|--------|-------------------|
| AssemblyAI Inc. | Audio transcription with speaker diarization | EU endpoint (Dublin), enforced in production | EU SCCs + UK Addendum; DPF / UK Extension certified. No model training via the EU endpoint. |
| Amazon Web Services (Bedrock) | Privileged AI generation (attendance notes, letters, summaries) | UK/EU region and EU inference profile; global routing disabled | AWS GDPR DPA + UK Addendum (SCCs / UK IDTA); DPF certified. Inputs and outputs not used to train any model. |
| Backblaze Inc. | Object storage for audio | EU Central (Amsterdam) | EEA/EU DPA and UK Residents DPA (SCCs). Support is US-based; support access is treated as a US transfer. |
| Recall.ai (Hyperdoc Inc.) | Meeting-bot import (audio-only) | EU (Frankfurt), configured and monitored | EU and UK DPA (SCCs + UK Addendum). Customer data not used to train any model. |

## Infrastructure

| Sub-processor | Purpose | Region | Transfer position |
|---------------|---------|--------|-------------------|
| Neon (Databricks) | PostgreSQL database | AWS eu-west-2 (London) | Databricks DPA executed; Neon covered by DPF / UK Extension; SCCs + UK IDTA. Contracting via the Neon Platform Services Product Specific Schedule. |
| Railway Corporation | Application hosting | EU-West (Amsterdam), pinned and monitored | Railway DPA executed (SCCs Module 2/3, Clause 9 Option 1; UK Addendum). EU region is a paid-plan option. |
| AWS SES | Transactional email (notification and link only) | AWS eu-west-2 (London) | Same AWS GDPR DPA and UK Addendum as Bedrock and Neon. No document content. |

## Identity, communications and payments

| Sub-processor | Purpose | Data | Transfer position |
|---------------|---------|------|-------------------|
| Google LLC | Sign-in (OAuth); optional Calendar | Identity fields; calendar events when connected | Adequacy / SCCs / IDTA as applicable |
| Microsoft Corporation | Sign-in (OAuth); optional Outlook, SharePoint, OneDrive | Identity fields; calendar and files when connected | Adequacy / SCCs / IDTA; customer tenant |
| Twilio Inc. | SMS one-time access codes for share links | Phone numbers; codes | EU SCCs + UK IDTA; DPF certified. IE1 (Ireland) SMS residency where enabled. |
| Stripe Inc. | Payment processing | Billing contact and payment tokens (no full card number stored by LegalNote) | DPF / SCCs / UK IDTA. Billing data only; no matter content. |

## Optional practice integrations

| Sub-processor | Purpose | Region | Notes |
|---------------|---------|--------|-------|
| Clio | Optional practice-management sync | EU Clio API (eu.app.clio.com) | Only when the firm connects Clio |

## Explicitly not used

| Former item | Current status |
|-------------|----------------|
| OpenAI for privileged document generation | Not used in production privileged paths. Production requires AWS Bedrock (EU). OpenAI appears only in non-production test tooling and is not a production sub-processor. |
| Resend for transactional email | Removed. Transactional email now runs on AWS SES (eu-west-2, London). |
| Replit Auth as live authentication | Not used. Live authentication is Google/Microsoft OAuth with connect.sid sessions; the filename replitAuth.ts is historical. |

## Data residency summary

| Processing activity | Posture |
|---------------------|---------|
| Audio transcription | EU (AssemblyAI Dublin endpoint) |
| Privileged LLM / notes | EU (AWS Bedrock, EU inference profile) |
| Object storage (audio) | EU (Backblaze Amsterdam) |
| Database | UK (Neon, AWS eu-west-2 London) |
| Application hosting | EU (Railway Amsterdam) |
| Transactional email | UK (AWS SES eu-west-2 London) |
| Meeting-bot import | EU (Recall.ai Frankfurt) |
| Auth / billing / SMS | May be international (Google, Microsoft, Stripe, Twilio) |
| Optional Clio | EU API |

## International transfer safeguards

Where personal data is transferred outside the United Kingdom or the EEA, LegalNote relies on one or more of: an adequacy decision, including the EU-US Data Privacy Framework and its UK Extension where the recipient is certified; the UK IDTA or UK Addendum and/or EU Standard Contractual Clauses; and technical measures including encryption in transit, access controls and data minimisation.

## Change log

| Date | Change |
|------|--------|
| July 2026 | Resend removed; AWS SES added for transactional email (eu-west-2). |
| July 2026 | Neon (Databricks) and Railway DPAs executed; regions confirmed (Neon London, Railway Amsterdam). |
| July 2026 | Recall.ai region confirmed EU (Frankfurt). |

*This Sub-processor List is governed by the laws of England and Wales and is not legal advice.*
