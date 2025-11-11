# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It enables legal professionals to record client meetings, automatically generate attendance notes, legal opinions, and searchable transcripts, while ensuring GDPR compliance, client consent management, and professional document workflows with firm branding on all exports. The project aims to provide an efficient and compliant solution for legal document creation and management, offering a secure and streamlined way to manage legal documentation and client interactions.

## Recent Changes

### November 11, 2025
- **Automated Testing Framework**: Implemented comprehensive unit testing with Vitest covering all 7 reminder scheduler scenarios, DST transitions, edge cases, and provenance tracking (18 tests total). Ensures regression prevention and validates DST-safe timezone handling.
- **Security Monitoring System**: Added failed login attempt tracking with configurable account lockout (5 attempts, 15min lockout), suspicious activity detection (IP changes, concurrent sessions), and comprehensive security event logging.
- **Audit Log Integrity**: Implemented cryptographic signatures (HMAC-SHA256) for audit logs to detect tampering. Critical for legal compliance - ensures tamper-evident audit trail for all system actions. Enforces AUDIT_LOG_SECRET environment variable in production (throws error if missing).
- **Automated Data Retention**: Created GDPR-compliant cleanup service using node-cron scheduler that automatically removes expired share links (7-day grace period), old audio files (7-day retention), and manages consent log archival. Scheduled to run daily at 2:00 AM (Europe/London) with hourly session cleanup. **Note**: Audio file deletion requires GCS permissions that must be configured by Replit support - cleanup logic is working but actual deletion may fail without proper infrastructure permissions.
- **Session Timeout Warnings**: Frontend component monitors user activity and displays warning 5 minutes before 4-hour session timeout, allowing users to extend their session with one click. Session extension properly resets countdown timer to prevent forced logout.

### November 10, 2025
- **Template-Based Reminder System**: Implemented production-grade reminder scheduler using Luxon for DST-safe, timezone-aware calendar reminders with Europe/London handling. Features template-based rules (no calculate-then-clamp edge cases), smart fallback for early morning deadlines (<8am), automatic deduplication, and 8am floor constraint to prevent early notifications. Priority-based schedules: Normal (1 reminder), Urgent/Deadline-Soon (2 reminders with distinct times).
- **Calendar Sync Confirmation Page**: Added dedicated confirmation page after successful calendar sync (desktop popup and mobile flows) with clear success messaging and navigation back to case.
- **Password Protection Security Enhancement**: Share link passwords now use bcrypt hashing (10 salt rounds) with automatic migration of legacy plaintext passwords on first successful login
- **Calendar Sync Integration**: Fixed calendar sync workflow - users can now sync case deadlines directly to Google Calendar or Outlook after setting a deadline (previously only navigated to settings page)
- **Quick Note Transcription**: Added dedicated `/api/transcribe` endpoint for Quick Notes feature with OpenAI Whisper integration
- **Email Personalization**: Share link emails now greet recipients by their own name instead of the case client's name

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
- **Audit Logging**: Comprehensive security event tracking (severity, metadata), structured JSON for SIEM integration, cryptographic signatures (HMAC-SHA256) for tamper detection.
- **Security Monitoring**: Failed login attempt tracking with account lockout (5 attempts, 15min), suspicious activity detection (IP changes, concurrent sessions), automated security event logging.
- **Session Security**: 4-hour timeout with 5-minute warning, automatic session extension on activity, activity-based tracking.
- **Reliability & Data Protection**: 7-day audio retention policy, automatic/manual retry for API failures, early audio deletion, expiration cleanup, consent documentation, automated GDPR-compliant data retention cleanup (daily at 2 AM).
- **Share Link Security**: 
  - **SMS Two-Factor Authentication**: Platform-level SMS verification using Twilio API provides strong identity verification. When enabled, recipients must verify their phone number (which must match the solicitor-specified number) before accessing documents. Twilio handles SMS delivery, code generation, and rate limiting.
  - **Password Protection (Optional)**: Additional password-based access control is available as a secondary security layer. However, SMS 2FA is considered the primary security mechanism because: (1) It verifies identity via out-of-band communication channel, (2) Protects against link forwarding/sharing, (3) Ensures only the intended recipient can access documents, (4) Provides audit trail of access attempts. Password protection alone can be shared/forwarded easily and doesn't verify identity.
  - **Recommendation**: For UK legal practice, SMS 2FA is preferred as it aligns with SRA guidelines for secure client communication and identity verification. Password protection may be kept as an optional additional layer for scenarios where the client prefers both methods, or removed to simplify the UX if deemed redundant.

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns (frontend), Luxon (backend timezone-aware operations).
- **Icons**: Lucide React.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3), GDPR-compliant retention policy.
- **AI Services**: OpenAI Whisper API (transcription), GPT-4o (document generation).
- **Email Service**: Resend API for professional transactional emails.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis package) and Microsoft Graph API (@microsoft/microsoft-graph-client package) for bidirectional calendar sync with OAuth 2.0 authentication. Template-based reminder scheduler with Europe/London timezone handling and DST support.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).
- **Testing**: Vitest with happy-dom for unit testing, comprehensive test coverage for critical business logic (reminder scheduler, security features).