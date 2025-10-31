# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It enables legal professionals to record client meetings, automatically generate attendance notes, legal opinions, and searchable transcripts, while ensuring GDPR compliance, client consent management, and professional document workflows with firm branding on all exports. The project aims to provide an efficient and compliant solution for legal document creation and management, offering a secure and streamlined way to manage legal documentation and client interactions.

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
- **Key Features**: Quick Record with Consent Flow, Priority System, Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Review Checklist Banner, Tabbed Document Viewer, Role-Based UI, Quick Actions (Mark as Reviewed, Archive Case, Assign to Team Member, Download PDF, Email to Client, Share Link with Optional SMS 2FA, Set Priority/Deadline, Sync to Calendar, Add Quick Note), Firm Branding on Exports, Interactive Onboarding Tour, Admin Setup Prompts, Email Integration, SMS Two-Factor Authentication for secure share link access, Calendar Integration, and comprehensive Audit Trail Compliance with CSV export.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with `/api` prefix, modular routes, custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`), with an in-memory implementation for development and Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Users, Cases (with deadline and syncToCalendar), Consent Logs, Transcripts (with redaction), Documents (version-controlled), Client Version Tracking, User Preferences, Firm Profile, Calendar Events, Calendar Connections (OAuth tokens), Share Links (UUID, expiration, SMS protection fields), and Audit Trail (comprehensive logging). Zod schema validation using `drizzle-zod`.
- **Session Management**: Designed for PostgreSQL session store.

### Authentication & Authorization
- **Authentication**: Replit Auth (OIDC-based), session-based with 4-hour timeout, secure cookies, user isolation, and prepared for multi-role system. Per-user OAuth for calendar integrations.
- **Authorization**: Storage layer enforces user isolation, route-level and object-level access control, ACLs for object storage, and UI-level permission checks.

### Security Architecture
- **Upload Security**: Server-side file validation (MIME, magic number, size limit), audio format validation.
- **Access Control**: User isolation, ACL ownership verification, UUID-based resources.
- **Rate Limiting**: Per-user and per-IP rate limits.
- **Input Sanitization**: Zod validation, path traversal prevention, XSS protection, SQL injection prevention (Drizzle ORM), regex validation.
- **Network Security**: Environment-aware Content Security Policy, CORS, HSTS, security headers (Helmet).
- **Error Sanitization**: Production errors hide internal details, generic messages, server-side logging.
- **Audit Logging**: Comprehensive security event tracking (severity, metadata), structured JSON for SIEM integration.
- **Reliability & Data Protection**: 7-day audio retention policy, automatic/manual retry for API failures, early audio deletion, expiration cleanup, consent documentation.

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns.
- **Icons**: Lucide React.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3), GDPR-compliant retention policy.
- **AI Services**: OpenAI Whisper API (transcription), GPT-4o (document generation).
- **Email Service**: Resend API for professional transactional emails.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis package) and Microsoft Graph API (@microsoft/microsoft-graph-client package) for bidirectional calendar sync with OAuth 2.0 authentication.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).