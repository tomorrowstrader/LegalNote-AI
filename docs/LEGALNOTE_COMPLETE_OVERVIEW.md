# LegalNote - Complete Technical & Product Overview

> **Purpose**: This document provides a comprehensive description of LegalNote for use as context in AI tools (Perplexity, ChatGPT, Claude, etc.) to enable contextual questions about the platform's capabilities, architecture, and implementation.

---

## Executive Summary

**LegalNote** is a compliance-first legal meeting documentation platform designed for UK solicitors and law firms. It transforms client meetings into evidence-quality documentation through recording, transcription, AI-assisted document generation, and comprehensive audit trails.

**Tagline**: "Meeting to Matter in Minutes"

**Core Value Proposition**: Never lose a word of any client meeting. Triple-layer protection ensures recordings survive battery death, browser crashes, network loss, and server restarts.

**Target Market**: 
- Solo practitioners
- Boutique law firms (1-10 solicitors)
- COLP/COFA compliance officers
- Legal operations professionals

**Strategic Positioning**: LegalNote is positioned as a "compliance-first documentation tool" - it records, transcribes, and formats solicitors' own work. It does NOT provide legal analysis. This deliberate positioning avoids SRA compliance risks and professional indemnity insurance liability exposure.

---

## Product Features

### 1. Meeting Recording & Consent Management

**Quick Record with Consent Flow**:
- One-click recording initiation from dashboard
- Built-in verbal consent capture workflow
- Configurable disclaimer scripts with version tracking
- Consent modalities: verbal_recorded, verbal_attested, electronic
- GDPR Article 6 lawful basis documentation
- Consent withdrawal tracking with timestamps

**Consent Segment Preservation**:
- Automatically preserves the consent portion of recordings
- Timestamp-based extraction of consent confirmation moment
- Retained separately even when main recording expires

### 2. "Never Lose a Word" Protection System (Black Box)

**Triple-Layer Redundancy**:
1. **IndexedDB (Local Browser)**: Chunks stored locally before upload
2. **Cloud Object Storage**: Real-time chunk upload to Replit Object Storage (S3-compatible)
3. **Database Metadata**: Session tracking in PostgreSQL for cross-device recovery

**Protection Coverage**:
- Battery death mid-recording
- Browser crash or force-close
- Tab closure (accidental or intentional)
- Network connection loss (extended offline recording)
- Server restart during recording
- Device destruction mid-meeting

**Technical Implementation**:
- 10-second chunk intervals (configurable, considering 5-second for premium)
- Presigned URL uploads via Uppy + AWS S3 SDK
- Chunk integrity verification using ListObjectsV2 before assembly
- Contiguous index verification (detects gaps in chunk sequence)
- Dedicated recovery endpoint bypasses in-memory session requirements
- Recovery dashboard shows all incomplete sessions with status

**Recovery Flow**:
1. Local chunks uploaded via recovery endpoint
2. Server lists all chunks from cloud storage
3. Verifies contiguous chunk indices (no gaps)
4. Assembles final audio file if complete
5. Session marked recovered only on success

### 3. AI-Powered Transcription

**Primary Transcription**: AssemblyAI
- Speaker diarization (multiple speaker detection)
- Word-level timestamps
- Confidence scores per utterance
- Word Boost feature for legal terminology

**Transcription Accuracy Pipeline**:
1. **AssemblyAI Word Boost**: Auto-injects client names, matter references, 200+ UK legal terms
2. **GPT-4o Post-Processing**: Context-aware correction of names, numbers, legal terminology
3. **Manual Review**: Solicitor can edit and approve transcript

**Legal Vocabulary List**: 200+ UK legal terms including:
- Court terminology (Crown Court, Magistrates' Court, etc.)
- Legal procedures (disclosure, discovery, injunction, etc.)
- Document types (attendance note, witness statement, etc.)
- Professional titles (QC, KC, LLP, etc.)

### 4. AI Document Generation

**Document Types**:
- **Attendance Notes**: Formal meeting records with structured format
- **Summaries**: Concise overview of key discussion points
- **Action Items**: AI-extracted tasks with assignees and due dates

**Generation Engine**: OpenAI GPT-4o
- Context-aware document creation
- Respects transcript redactions
- Firm branding integration
- Version control with parent-child relationships

**Document Workflow**:
- Draft → Review → Approve cycle
- Version history with diff tracking
- Content hash (SHA-256) for integrity verification
- Approval comments and timestamps
- Document unlocking for amendments

### 5. Transcript Management

**Speaker Diarization**:
- Automatic speaker detection and labeling
- Speaker count tracking
- Utterance-level timestamps (start/end)
- Confidence scores

**Redaction System**:
- Select text ranges for redaction
- Redaction reason documentation
- Redactor identification and timestamp
- Redactions persist across document regeneration
- Redaction history in audit trail

### 6. Document Export & Sharing

**Export Formats**:
- **PDF**: Generated via jsPDF with firm branding
- **Word (DOCX)**: Generated via docx library

**Secure Sharing**:
- Unique share links with configurable expiration
- Optional password protection (bcrypt hashed)
- SMS Two-Factor Authentication via Twilio
- Access level control (view-only or download)
- Access count and last accessed tracking
- Client consent confirmation before sharing
- Selective document sharing (choose which documents to include)

**Client Version Tracking**:
- Tracks which document version was sent to client
- Amendment reason documentation if sending updated version
- Warning system for version changes

### 7. Case Management

**Case Properties**:
- Title, client name, matter reference
- Priority levels: urgent, deadline-soon, normal
- Status tracking: pending, processing, review_required, completed
- Archive functionality (soft delete)
- Team member assignment

**Litigation Hold**:
- Prevents automatic audio deletion
- Applied by, reason, timestamp tracking
- Release tracking with history

**Quick Notes**:
- Ad-hoc notes attached to cases
- Timestamped with creator identification

### 8. Calendar Integration

**Supported Providers**:
- **Google Calendar**: OAuth 2.0 via googleapis
- **Microsoft Outlook**: Replit connector integration

**Features**:
- Bidirectional sync for case deadlines
- Calendar event creation/update/deletion
- Reminder scheduling with timezone awareness (Europe/London)
- Smart reminder rules (template-based, priority-based)

### 9. Video Conferencing Import (Recall.ai)

**Supported Platforms**:
- Zoom
- Microsoft Teams
- Google Meet

**Features**:
- Post-call recording import
- Bot deployment for meeting capture
- Participant tracking
- Pre-consent email workflow
- Cost tracking ($0.70/hour)
- GDPR/SOC2/ISO27001 certified provider

### 10. Practice Management Integration (Clio)

**Clio Manage Integration**:
- OAuth 2.0 authentication
- EU endpoint for GDPR compliance (eu.app.clio.com/api/v4/)
- Matter import and search
- Case-to-matter linking
- Client information sync

### 11. Cloud Storage Sync (SharePoint/OneDrive)

**Architecture**: Firm-wide integration via Replit connector

**Features**:
- Automatic document sync to Microsoft cloud
- Folder structure: LegalNote / Cases / [Client - Case Title] / [Document Type]
- Auto-sync settings per provider
- Site and drive selection for SharePoint

**Use Cases**:
- Solo practitioners: Personal OneDrive backup
- Boutique firms: Shared document library

### 12. Comprehensive Audit Trail

**Event Types Tracked**:
- Recording lifecycle: started, consent given/declined, uploaded
- Audio playback: started, paused, seeked, deleted
- AI operations: transcript generated, document generated/regenerated
- Document modifications: edited, redacted
- Document review: approved, unlocked
- Exports: PDF, Word, audit CSV
- Case actions: created, viewed, updated, priority changed, assigned, email sent
- Calendar sync events
- System events: login, logout, session expired

**Security Features**:
- HMAC-SHA256 cryptographic signatures for tamper detection
- IP address and user agent logging
- Severity levels: info, warning, critical
- CSV export with signed PDF option

### 13. GDPR Compliance Features

**Data Subject Access Requests (DSAR)**:
- Request types: access, erasure, restriction, rectification, portability, objection
- Requester verification workflow
- 30-day ICO deadline tracking
- Data location tracking
- Withheld data with legal basis documentation
- Response method tracking

**Data Retention**:
- 7-day audio retention (configurable)
- Automated cleanup service
- Litigation hold override
- Consent segment preservation

**Security Incidents**:
- Incident tracking and investigation
- Severity classification
- Remedial action documentation
- ICO/client notification tracking

### 14. Firm Branding & Preferences

**Firm Profile**:
- Firm name, logo, address
- Contact information
- SRA registration number
- Document preferences (location, solicitor name format, client confirmation)

**User Preferences**:
- Onboarding completion tracking
- Consent workflow preferences
- Recording confirmation email toggle
- Review banner dismissal

### 15. Search & Discovery

**Global Search**:
- Cross-case search functionality
- Enhanced search with filters
- Search history tracking
- Full-text search across transcripts and documents

### 16. Subscription & Billing (Stripe)

**Integration**: Stripe via stripe-replit-sync

**Features**:
- Customer management
- Subscription lifecycle (active, trialing, past_due, canceled, unpaid)
- Plan management (solo, team)
- Trial period tracking
- Checkout and billing portal

---

## Technical Architecture

### Frontend Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 with TypeScript |
| Build Tool | Vite |
| UI Components | Shadcn UI + Radix UI primitives |
| Styling | Tailwind CSS with custom theme |
| Routing | Wouter |
| State Management | TanStack Query (React Query v5) |
| Forms | React Hook Form + Zod validation |
| Icons | Lucide React |
| Date Handling | date-fns |
| Audio Recording | MediaRecorder API |
| File Upload | Uppy with AWS S3 plugin |
| Rich Text | TipTap editor |
| Charts | Recharts |
| Animations | Framer Motion |

### Backend Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js with TypeScript |
| Framework | Express.js |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon serverless) |
| Session Store | PostgreSQL-backed (connect-pg-simple) |
| Authentication | Replit Auth (OIDC-based) |
| Validation | Zod |
| Task Scheduling | node-cron with Luxon |
| Testing | Vitest with happy-dom |

### External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Transcription | AssemblyAI | Speech-to-text with speaker diarization |
| AI Generation | OpenAI GPT-4o | Document generation, transcript correction |
| Object Storage | Replit Object Storage (S3-compatible) | Audio file storage |
| Email | Resend | Transactional emails |
| SMS | Twilio | Two-factor authentication |
| Video Import | Recall.ai | Video conferencing recording capture |
| Calendar | Google Calendar API, Microsoft Graph | Calendar sync |
| PMS | Clio Manage API | Practice management integration |
| Cloud Storage | SharePoint/OneDrive via Graph API | Document backup |
| Payments | Stripe | Subscription billing |

### Database Schema (Key Tables)

```
users                    - User accounts with Stripe integration
cases                    - Legal matters with full lifecycle tracking
audioRecordings          - Audio file metadata with consent segments
recordingSessions        - Chunked upload session tracking
consentLogs              - GDPR-compliant consent documentation
transcripts              - AI-generated transcripts with utterances
documents                - Attendance notes, summaries with versioning
actionItems              - AI-extracted or manual tasks
auditTrail               - Comprehensive event logging with signatures
shareLinks               - Secure document sharing with 2FA
calendarIntegrations     - OAuth tokens for calendar providers
calendarEvents           - Synced calendar event tracking
recallConnections        - Video conferencing integration status
meetingImports           - Imported video call recordings
scheduledMeetings        - Calendar-linked auto-recording
preConsentEmails         - Pre-meeting consent email tracking
firmProfile              - Firm branding and preferences
userPreferences          - Per-user settings
dsarRequests             - GDPR data subject requests
securityIncidents        - Security incident tracking
clioConnections          - Clio OAuth tokens
clioMatterLinks          - Case-to-Clio-matter mapping
sharePointConnections    - Cloud storage integration
clientVersionTracking    - Document version sent to clients
quickNotes               - Ad-hoc case notes
preMeetingBriefings      - AI-generated meeting prep summaries
```

### API Endpoints Overview

**Authentication**: `/api/auth/*`
**Cases**: `/api/cases/*` - CRUD, search, archive, assign, litigation hold
**Audio**: `/api/audio/*` - Upload, chunked sessions, recovery, consent segments
**Documents**: `/api/documents/*` - Approve, unlock, verify, track sharing
**AI Processing**: `/api/cases/:id/transcribe`, `/generate-documents`, `/process`
**Calendar**: `/api/calendar/*` - Connect, disconnect, sync
**Clio**: `/api/clio/*` - Auth, matters, import, linking
**Recall.ai**: `/api/recall/*` - Connect, meetings, import
**Storage**: `/api/storage/*` - SharePoint/OneDrive sync
**Sharing**: `/api/share/*` - Public share links with SMS verification
**Audit**: `/api/audit/*` - Logs, export
**Stripe**: `/api/stripe/*` - Checkout, portal, webhook
**Admin**: `/api/admin/*` - Statistics, user management

### Security Implementation

**Authentication & Authorization**:
- Replit Auth (OIDC-based SSO)
- Session-based with secure cookies
- User isolation at storage layer
- Role-based access control
- ACL enforcement at route, object, and UI levels

**Network Security**:
- Helmet.js for security headers
- CORS configuration with origin validation
- Content Security Policy (CSP)
- HSTS enforcement
- Rate limiting (general API + specific endpoints)

**Data Security**:
- Input sanitization (Zod validation)
- Path traversal prevention
- XSS protection
- SQL injection prevention (parameterized queries via Drizzle)
- UUID-based resource identifiers
- Server-side file validation

**Session Security**:
- 4-hour session timeout with warning
- Activity-based session extension
- Secure cookie configuration
- Session storage in PostgreSQL

**Audit Security**:
- HMAC-SHA256 signatures on audit entries
- Tamper detection
- Failed login tracking
- Suspicious activity detection

**Share Link Security**:
- Bcrypt password hashing
- SMS 2FA via Twilio
- Rate limiting on verification attempts
- Expiration enforcement
- Access logging

### Object Storage Architecture

**Provider**: Replit Object Storage (S3-compatible via AWS SDK)

**Directory Structure**:
```
.private/
├── recordings/
│   ├── {sessionId}/
│   │   ├── chunk_0.webm
│   │   ├── chunk_1.webm
│   │   └── ...
│   └── {caseId}/
│       ├── recording.webm
│       └── consent_segment.webm
```

**Presigned URL Flow**:
1. Client requests upload URL from server
2. Server generates presigned PUT URL
3. Client uploads directly to storage
4. Server verifies upload completion

### Chunked Upload System

**Constants**:
- Chunk interval: 10 seconds
- Session expiry: 30 minutes
- Cleanup interval: 5 minutes
- Fallback consent chunks: 2

**Session Lifecycle**:
1. `createSession()` - Initialize recording session
2. `uploadChunk()` - Store chunk in memory + cloud
3. `confirmConsent()` - Mark consent timestamp
4. `finalizeSession()` - Assemble chunks, create audio record
5. `recoverSession()` - Rebuild from cloud storage

**Recovery Verification**:
- ListObjectsV2 to enumerate all chunks
- Sort by chunk index
- Verify contiguous sequence (0, 1, 2, ... n)
- Fail if gaps detected
- Concatenate in order if complete

---

## Deployment & Infrastructure

**Platform**: Replit

**Environment**:
- Node.js runtime
- PostgreSQL (Neon serverless)
- Object Storage (S3-compatible)
- Automatic HTTPS/TLS
- Custom domain support

**Workflows**:
- `npm run dev` - Development server (Vite + Express)
- `npm run build` - Production build
- `npm run db:push` - Database schema sync

**Environment Variables Required**:
```
DATABASE_URL           - PostgreSQL connection string
ASSEMBLYAI_API_KEY     - Transcription service
OPENAI_API_KEY         - AI document generation
RESEND_API_KEY         - Email service
TWILIO_ACCOUNT_SID     - SMS service
TWILIO_AUTH_TOKEN      - SMS service
TWILIO_PHONE_NUMBER    - SMS sender number
RECALL_API_KEY         - Video conferencing import
BACKBLAZE_KEY_ID       - Object storage (legacy)
BACKBLAZE_APPLICATION_KEY
BACKBLAZE_BUCKET_NAME
BACKBLAZE_S3_ENDPOINT
GOOGLE_CLIENT_ID       - Calendar integration
GOOGLE_CLIENT_SECRET
CLIO_CLIENT_ID         - Practice management
CLIO_CLIENT_SECRET
```

---

## Compliance & Regulatory Positioning

### SRA Compliance

LegalNote is designed to support solicitors' SRA obligations:
- **Record keeping**: Demonstrates compliance with SRA Standards and Regulations
- **Competent service**: Evidence of advice given and instructions received
- **Client communication**: Documented meeting records

**Key Design Decision**: LegalNote records and transcribes solicitors' own work. It does NOT provide legal analysis or advice. This avoids:
- SRA concerns about AI providing legal advice
- Professional indemnity insurance complications
- Liability exposure for AI-generated legal opinions

### GDPR Compliance

- Article 6 lawful basis documentation
- Consent capture and withdrawal tracking
- Data subject access request (DSAR) workflow
- 30-day ICO deadline tracking
- Data retention with automated cleanup
- Right to erasure implementation
- Data portability support

### Evidence Quality

Documents generated meet evidence standards:
- Contemporaneous creation (timestamped)
- Version control with integrity hashes
- Audit trail with cryptographic signatures
- Redaction tracking
- Approval workflow

---

## Pricing Tiers (Planned)

### LegalNote Standard
- Real-time cloud upload
- Basic recovery (connection drops)
- 7-day audio retention
- Full audit trail

### LegalNote Professional
- Extended retention (30/60/90 days)
- Priority transcription
- Firm branding
- Advanced templates

### LegalNote Black Box (Premium)
- Triple-layer redundancy
- 5-second chunk intervals
- 30-day recovery window
- Cross-device recovery
- Forensic chain of custody
- Priority recovery support

---

## Development Notes

**Built On**: Replit platform over 3 months

**Architecture Philosophy**:
- Industry-standard implementations over quick hacks
- Proper multipart/form-data uploads (not base64 in JSON)
- Interface-based storage layer for testability
- Comprehensive error handling with user-friendly messages

**Testing**:
- Vitest for unit testing
- happy-dom for DOM simulation
- Critical business logic coverage

**Code Organization**:
```
client/src/
├── components/     - React components
├── hooks/          - Custom React hooks
├── lib/            - Utilities and API client
├── pages/          - Route pages
└── types/          - TypeScript definitions

server/
├── services/       - Business logic services
├── routes.ts       - API endpoint definitions
├── storage.ts      - Database interface
├── db.ts           - Drizzle ORM setup
└── *.ts            - Integration modules

shared/
└── schema.ts       - Database schema + Zod types
```

---

## Contact & Resources

**Product**: LegalNote
**Target Market**: UK Legal Sector
**Regulatory Framework**: SRA, GDPR, ICO

---

*This document is intended for use as context in AI assistants to enable informed questions about LegalNote's capabilities, architecture, and implementation details.*
