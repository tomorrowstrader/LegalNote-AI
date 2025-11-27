# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It streamlines the creation of attendance notes, AI summaries, and searchable transcripts from client meetings, ensuring GDPR compliance, managing client consent, and providing professional document workflows with firm branding. The platform positions itself as a "compliance-first documentation tool" - recording, transcribing, and formatting solicitors' own work, NOT providing legal analysis. This deliberate positioning avoids SRA compliance risks and PI insurance liability exposure.

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
- **Key Features**: Quick Record with Consent Flow, Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Tabbed Document Viewer, Role-Based UI, comprehensive Quick Actions (e.g., Download Document, Email to Client, Share Link with Optional SMS 2FA), Firm Branding on Exports, Interactive Onboarding, Admin Setup, Email/SMS/Calendar Integrations, Video Conferencing Import, and a Comprehensive Audit Trail with CSV export.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with modular routes and custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`) with Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Includes Users, Cases, Consent Logs, Transcripts, Documents, Client Version Tracking, User Preferences, Firm Profile, Calendar Events, Share Links, Meeting Imports (Recall.ai), Pre-Consent Emails, and Audit Trail (with cryptographic signatures). Zod schema validation.
- **Session Management**: Designed for PostgreSQL session store.

### Authentication & Authorization
- **Authentication**: Replit Auth (OIDC-based), session-based with secure cookies and user isolation.
- **Authorization**: Enforced at storage, route, object, and UI levels using ACLs.

### Security Architecture
- **General Security**: Server-side file validation, access control, UUID-based resources, rate limiting, input sanitization (Zod, path traversal, XSS, SQL injection), network security (CSP, CORS, HSTS, Helmet), error sanitization.
- **Audit Logging**: Comprehensive event tracking with HMAC-SHA256 signatures for tamper detection.
- **Security Monitoring**: Failed login tracking, suspicious activity detection, automated security event logging.
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
- **AI Services**: OpenAI Whisper API (transcription), GPT-4o (document generation).
- **Email Service**: Resend API.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis) and Microsoft Graph API (@microsoft/microsoft-graph-client) for bidirectional sync.
- **Video Conferencing**: Recall.ai API for post-call recording import from Zoom, Microsoft Teams, and Google Meet ($0.70/hour, GDPR/SOC2/ISO27001 certified).
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).
- **Testing**: Vitest with happy-dom.