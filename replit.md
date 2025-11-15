# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It enables legal professionals to record client meetings, automatically generate attendance notes, legal opinions, and searchable transcripts, while ensuring GDPR compliance, client consent management, and professional document workflows with firm branding on all exports. The project aims to provide an efficient and compliant solution for legal document creation and management, offering a secure and streamlined way to manage legal documentation and client interactions. Its market potential lies in offering a premium AI-powered solution that provides professional protection and significant time savings for legal professionals.

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
- **Key Features**: Quick Record with Consent Flow, Priority System, Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Review Checklist Banner, Tabbed Document Viewer, Role-Based UI, Quick Actions (Mark as Reviewed, Archive Case, Assign to Team Member, Download Document with format selection, Email to Client, Share Link with Optional SMS 2FA, Set Priority/Deadline, Sync to Calendar, Add Quick Note), Firm Branding on Exports, Interactive Onboarding Tour, Admin Setup Prompts, Email Integration, SMS Two-Factor Authentication for secure share link access, Calendar Integration, Comprehensive Audit Trail (including quick notes, deadlines, priority changes, and document exports) with CSV export. Session timeout warnings and extension.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with `/api` prefix, modular routes, custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`), with an in-memory implementation for development and Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Users, Cases, Consent Logs, Transcripts, Documents, Client Version Tracking, User Preferences, Firm Profile, Calendar Events, Calendar Connections, Share Links, and Audit Trail (comprehensive logging with cryptographic signatures for tamper detection). Zod schema validation.
- **Session Management**: Designed for PostgreSQL session store.

### Authentication & Authorization
- **Authentication**: Replit Auth (OIDC-based), session-based with 4-hour timeout, secure cookies, user isolation.
- **Authorization**: Storage layer enforces user isolation, route-level and object-level access control, ACLs for object storage, and UI-level permission checks.

### Security Architecture
- **General Security**: Server-side file validation, access control (user isolation, ACL ownership), UUID-based resources, rate limiting, input sanitization (Zod, path traversal, XSS, SQL injection, regex), network security (CSP, CORS, HSTS, Helmet), error sanitization.
- **Audit Logging**: Comprehensive event tracking with cryptographic signatures (HMAC-SHA256) for tamper detection.
- **Security Monitoring**: Failed login attempt tracking with account lockout, suspicious activity detection (IP changes, concurrent sessions), automated security event logging.
- **Session Security**: 4-hour timeout with 5-minute warning, automatic extension on activity.
- **Reliability & Data Protection**: 7-day audio retention, GDPR-compliant data retention cleanup service (daily at 2 AM for share links and audio), consent documentation.
- **Share Link Security**: SMS Two-Factor Authentication (primary, using Twilio) and optional bcrypt-hashed password protection.

### System Design Choices
- **Reminder System**: Production-grade scheduler using Luxon for DST-safe, timezone-aware (Europe/London) calendar reminders with template-based rules, smart fallback, deduplication, and priority-based scheduling.
- **Automated Testing**: Comprehensive unit testing with Vitest for critical business logic (e.g., reminder scheduler scenarios, DST transitions).

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns (frontend), Luxon (backend timezone-aware operations).
- **Icons**: Lucide React.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3).
- **AI Services**: OpenAI Whisper API (transcription), GPT-4o (document generation).
- **Email Service**: Resend API.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis package) and Microsoft Graph API (@microsoft/microsoft-graph-client package) for bidirectional calendar sync with OAuth 2.0.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).
- **Testing**: Vitest with happy-dom for unit testing.