# LegalNote AI - Technical Architecture

## Overview

LegalNote AI is a legal documentation platform for UK solicitors. This document describes all external services, data flows, and GDPR considerations.

---

## External Services

### 1. AssemblyAI (Transcription)

**Purpose:** Speech-to-text transcription with speaker diarization

**Data Flow:**
1. Audio file downloaded from Replit Object Storage
2. Audio uploaded to AssemblyAI via `/v2/upload`
3. Transcription job created via `/v2/transcript` with word boost
4. Poll for completion, retrieve utterances with speaker labels
5. Transcript stored in PostgreSQL database

**Configuration:**
- API Key: `ASSEMBLYAI_API_KEY` (secret)
- Endpoint: `https://api.assemblyai.com/v2`
- Language: `en_uk` (British English)

**Accuracy Features:**
- **Word Boost:** Auto-injects client names, matter references, and 200+ UK legal terms
- Boost level: `high` (maximum priority for boosted terms)
- Max 1000 terms per transcription (AssemblyAI limit)
- See `server/services/legalVocabulary.ts` for vocabulary list

**Pricing:** $0.27/hour of audio

**GDPR Notes:**
- Audio is temporarily uploaded to AssemblyAI servers for processing
- AssemblyAI is GDPR compliant with EU data processing addendum
- Audio is deleted from AssemblyAI after transcription completion
- Original audio retained in Replit Object Storage for 7 days per retention policy

---

### 2. OpenAI GPT-4o (Document Generation & Correction)

**Purpose:** 
- Generate attendance notes, summaries, extract action items, pre-meeting briefings
- Post-processing transcript correction for names, numbers, and legal terms

**Data Flow:**
1. Transcript text sent to GPT-4o API
2. Structured prompts with UK legal formatting requirements
3. Generated document returned
4. Document stored in PostgreSQL

**Transcript Correction Pipeline:**
1. Raw transcript from AssemblyAI
2. GPT-4o correction pass with case context (client name, matter reference)
3. Fixes: misspelled names, legal terms, obvious number errors
4. Corrected transcript stored and used for document generation

**Configuration:**
- API Key: `OPENAI_API_KEY` (secret)
- Model: `gpt-4o`
- Temperature: 0.3 (documents), 0.1 (corrections)

**Pricing:**
- Input: $5.00/1M tokens
- Output: $15.00/1M tokens

**GDPR Notes:**
- Transcript text (potentially containing personal data) sent to OpenAI
- OpenAI API is zero-data-retention for API calls
- No client data used for model training
- All processing is ephemeral

---

### 3. Recall.ai (Video Conferencing Import)

**Purpose:** Import recordings from Zoom, Microsoft Teams, Google Meet

**Data Flow:**
1. Bot joins meeting via meeting URL
2. Bot records audio during meeting
3. Recording stored on Recall.ai servers
4. Audio URL retrieved and downloaded to Replit Object Storage
5. Transcript obtained from Recall.ai's built-in AssemblyAI transcription

**Configuration:**
- API Key: `RECALL_API_KEY` (secret)
- Region: `us-west-2` (configurable via `RECALL_REGION`)
- Endpoint: `https://{region}.recall.ai/api/v1`

**Pricing:** $0.70/hour (+ $0.15/hour for transcription)

**GDPR Notes:**
- SOC2, ISO27001 certified
- Recall.ai GDPR compliant
- Recordings can be deleted via API
- Bot name displayed as "LegalNote AI" to meeting participants
- Consent handling via pre-consent email workflow

---

### 4. Resend (Email Service)

**Purpose:** Send emails for notifications, pre-consent emails, share links

**Data Flow:**
1. Email content prepared (HTML + text)
2. Sent via Resend API
3. Delivery status tracked

**Configuration:**
- API Key: `RESEND_API_KEY` (secret)

**GDPR Notes:**
- Email addresses and content processed by Resend
- Resend GDPR compliant
- No personal data stored long-term by Resend

---

### 5. Twilio (SMS Service)

**Purpose:** SMS two-factor authentication for share links

**Data Flow:**
1. One-time code generated
2. SMS sent to client phone number
3. Code verified on entry

**Configuration:**
- Account SID: `TWILIO_ACCOUNT_SID` (secret)
- Auth Token: `TWILIO_AUTH_TOKEN` (secret)
- Phone Number: `TWILIO_PHONE_NUMBER` (secret)

**GDPR Notes:**
- Phone numbers processed by Twilio
- Twilio GDPR compliant
- Codes are ephemeral, no personal data stored long-term

---

### 6. Google Calendar API

**Purpose:** Sync case deadlines and reminders to Google Calendar

**Data Flow:**
1. OAuth 2.0 authentication
2. Calendar events created/updated/deleted
3. Bidirectional sync with case deadlines

**Configuration:**
- Client ID: `GOOGLE_CLIENT_ID` (secret)
- Client Secret: `GOOGLE_CLIENT_SECRET` (secret)
- OAuth endpoints via `googleapis` library

**GDPR Notes:**
- Calendar data contains case titles and deadlines
- User explicitly authorizes access
- Tokens stored encrypted in database
- Token refresh handled automatically

---

### 7. Microsoft Graph API (Outlook Calendar)

**Purpose:** Sync case deadlines to Outlook Calendar

**Data Flow:**
1. OAuth via Replit connector
2. Calendar events synced via Graph API
3. Bidirectional sync

**Configuration:**
- Managed via Replit connector integration
- Uses `@azure/msal-node` for token management

**GDPR Notes:**
- Calendar data contains case titles and deadlines
- Workspace-level authentication (firm-wide)
- User explicitly authorizes access

---

### 8. Microsoft Graph API (SharePoint/OneDrive)

**Purpose:** Sync documents to firm's SharePoint or OneDrive

**Data Flow:**
1. OAuth via Replit connector
2. Documents uploaded to specified drive
3. Folder structure: `LegalNote AI / Cases / [Client - Case Title] / [Document Type]`

**Configuration:**
- Managed via Replit connector
- Drive ID stored in `sharePointConnections` table

**GDPR Notes:**
- Documents contain client data
- Firm controls destination SharePoint/OneDrive
- Workspace-level authentication (firm-wide)
- Known limitation: Not per-user OAuth

---

### 9. Clio Manage (Practice Management)

**Purpose:** Import matters from Clio, link LegalNote cases to Clio matters

**Data Flow:**
1. OAuth 2.0 authentication (EU endpoint)
2. Matters fetched via Clio API
3. Case-matter links stored in `clioMatterLinks` table

**Configuration:**
- Client ID: `CLIO_CLIENT_ID` (secret)
- Client Secret: `CLIO_CLIENT_SECRET` (secret)
- API Endpoint: `eu.app.clio.com/api/v4/` (EU for GDPR)

**GDPR Notes:**
- Uses EU endpoint for GDPR compliance
- OAuth tokens stored encrypted in database
- Only matter references synced, not full case files

---

### 10. Stripe (Payments)

**Purpose:** Subscription billing and payment processing

**Data Flow:**
1. Customer created in Stripe
2. Subscription managed via Stripe API
3. Webhooks for payment events

**Configuration:**
- API keys managed via Replit Stripe integration
- Webhook handlers in `server/webhookHandlers.ts`

**GDPR Notes:**
- PCI-DSS compliant
- No card details stored in LegalNote database
- Stripe handles all payment data

---

### 11. Replit Object Storage (Backblaze S3)

**Purpose:** Store audio recordings and generated documents

**Data Flow:**
1. Presigned URLs generated for direct browser uploads
2. Files stored in Backblaze B2 via S3 API
3. 7-day retention policy for audio files

**Configuration:**
- `BACKBLAZE_KEY_ID`
- `BACKBLAZE_APPLICATION_KEY`
- `BACKBLAZE_BUCKET_NAME`
- `BACKBLAZE_S3_ENDPOINT`

**GDPR Notes:**
- Audio may contain personal data
- 7-day automatic deletion for audio
- GDPR-compliant data retention cleanup service runs daily

---

## Database

**Provider:** PostgreSQL via Neon Serverless

**Connection:** `DATABASE_URL` environment variable

**Key Tables:**
- `users` - Authenticated users
- `cases` - Legal cases/matters
- `transcripts` - Transcription records
- `documents` - Generated documents
- `consentLogs` - GDPR consent records
- `auditTrail` - Cryptographically signed audit events
- `shareLinks` - Client access links with 2FA
- `meetingImports` - Recall.ai import records
- `calendarEvents` - Synced deadlines

---

## Security Architecture

### Authentication
- Replit Auth (OIDC-based)
- Session-based with secure cookies
- 4-hour session timeout with activity extension

### Authorization
- ACL-based at storage, route, and UI levels
- All data scoped to authenticated user

### Audit Trail
- HMAC-SHA256 signed events
- Tamper detection
- CSV export for compliance

### Share Link Security
- Optional password protection (bcrypt hashed)
- Optional SMS 2FA (Twilio)
- Expiry and revocation support

---

## Data Retention

| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| Audio recordings | 7 days | Automated cleanup service |
| Transcripts | Permanent | User deletion |
| Documents | Permanent | User deletion |
| Consent logs | Permanent | Regulatory requirement |
| Audit trail | Permanent | Compliance requirement |
| Session data | 4 hours | Automatic expiry |

---

## GDPR Compliance Summary

1. **Consent Management:** Pre-consent email workflow, consent logging, client signature tracking
2. **Data Minimization:** Only necessary data collected, 7-day audio retention
3. **Right to Erasure:** Case deletion removes all associated data
4. **Data Portability:** Document export (PDF, Word)
5. **Audit Trail:** Comprehensive logging with tamper detection
6. **Third-Party DPAs:** All external services GDPR compliant with DPAs available

---

## Cost Estimation (Per Case)

| Service | Typical Usage | Cost |
|---------|---------------|------|
| AssemblyAI | 30 min meeting | ~$0.14 |
| OpenAI GPT-4o | Attendance note + summary | ~$0.02-0.05 |
| Recall.ai | 30 min meeting | ~$0.43 |
| Resend | 2-3 emails | Included |
| Twilio | 1-2 SMS | ~$0.02 |
| **Total per case** | | **~$0.60-0.65** |
