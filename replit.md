# LegalNote - Replit Configuration

## Overview
LegalNote is a professional legal documentation platform designed for solicitors and law firms. Its primary purpose is to streamline the creation of attendance notes, AI summaries, and searchable transcripts from client meetings. The platform ensures GDPR compliance, manages client consent, and provides professional document workflows with firm branding. LegalNote is positioned as a "compliance-first documentation tool" that records, transcribes, and formats solicitors' own work, explicitly avoiding legal analysis to mitigate SRA compliance risks and PI insurance liability.

## User Preferences
**Communication Style:** Simple, everyday language.

**Architectural Preferences:**
- When architectural constraints force backend proxy solutions (e.g., CORS blocking direct uploads), **always choose proper industry-standard implementations over quick hacks**, even if it takes longer to implement
- Prioritize correct architecture from the start rather than temporary workarounds that become technical debt
- Use multipart/form-data for file uploads (industry standard) rather than base64 encoding in JSON (bandwidth inefficient, memory intensive)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite.
- **UI Component Library**: Shadcn UI with Radix UI primitives, black gradient theme, Inter font.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state and async operations.
- **Key Features**: Quick Record with Consent Flow, Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Tabbed Document Viewer, Role-Based UI, Comprehensive Quick Actions (e.g., Download Document, Email to Client, Share Link with Optional SMS 2FA), Firm Branding on Exports, Interactive Onboarding, Admin Setup, Email/SMS/Calendar Integrations, Video Conferencing Import, Comprehensive Audit Trail with CSV export, Track Changes/Redline, Comments and Annotations, Visual Version Diff, Master Record Framing with Export Footers, Global Action Items View, Real-Time Notifications (SSE), Case Templates, Log a Call, Enhanced Search Filters, Compliance Thread (AML/KYC), Client Registry (searchable client records with AML risk continuity, linked matters, inline creation from New Note), and Time Recording (post-session billable time prompt, per-case time entries, firm-level time summary with CSV export, Clio push stub, hourly rate in user profile).

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with modular routes and custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`) with Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Includes Users (with complianceThread flag, hourlyRate), Clients (name, email, phone, address, dateOfBirth, companyName, amlRiskLevel, amlRiskLastReviewed, clioClientId, createdBy — per-user isolation), Cases (with templateId for case template tracking, sourceType: audio/text/dictation, riskLevel for AML, nullable clientId FK to clients), Meeting Sessions (multi-session per case with recording type: Full Meeting, Telephone Call, File Note, Court Hearing, Police Station), Consent Logs, Transcripts (with optional meetingSessionId FK), Documents (with optional meetingSessionId FK), Document Comments, Client Version Tracking, User Preferences, Firm Profile, Calendar Events, Share Links, Meeting Imports, Pre-Consent Emails (with consentResponseStatus: awaiting/granted/declined/reschedule_requested, consentRespondedAt, rescheduleRequestNote for full consent lifecycle), AML Monitoring Notes, AML Decision Records, Time Entries (linked to cases/sessions/users with duration, description, hourlyRate, status, Clio integration), and Audit Trail. Zod schema validation.
- **Session Management**: Designed for PostgreSQL session store.

### Authentication & Authorization
- **Authentication**: Google OAuth 2.0 via passport-google-oauth20, session-based with secure cookies and user isolation. Branded login page at `/login` with "Continue with Google" button.
- **Authorization**: Enforced at storage, route, object, and UI levels using ACLs.

### Security Architecture
- **General Security**: Server-side file validation, access control, UUID-based resources, rate limiting, input sanitization (Zod, path traversal, XSS, SQL injection), network security (CSP, CORS, HSTS, Helmet), error sanitization.
- **Audit Logging**: Comprehensive event tracking with HMAC-SHA256 signatures for tamper detection.
- **Session Security**: 4-hour timeout with warning and activity-based extension.
- **Reliability & Data Protection**: 7-day audio retention, GDPR-compliant data retention cleanup service, consent documentation.
- **Share Link Security**: SMS Two-Factor Authentication (Twilio) and optional bcrypt-hashed password protection.

### System Design Choices
- **Reminder System**: Production-grade, timezone-aware (Europe/London) scheduler using Luxon for calendar reminders with template-based rules, smart fallback, deduplication, and priority-based scheduling.
- **Automated Testing**: Comprehensive unit testing with Vitest for critical business logic.

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns (frontend), Luxon (backend).
- **Icons**: Lucide React.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3).
- **AI Services**: AssemblyAI (primary transcription with speaker diarization), Anthropic Claude 3.7 Sonnet (document generation — attendance notes and summaries, with post-generation verification pass), OpenAI GPT-4o (AML trigger detection, action item extraction, transcript correction).
- **Transcription Accuracy Pipeline**: AssemblyAI Word Boost (auto-injects client names, matter refs, UK legal terms) followed by GPT-4o post-processing for context-aware correction.
- **Email Service**: Resend API.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis) and Microsoft Outlook/Graph API via Replit connector for bidirectional sync.
- **Video Conferencing**: Recall.ai API for post-call recording import from Zoom, Microsoft Teams, and Google Meet.
- **Practice Management**: Clio Manage integration via OAuth 2.0 for matter import and linking.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).
- **Testing**: Vitest with happy-dom.
- **Cloud Storage (SharePoint/OneDrive)**: Firm-wide integration via Replit connector.