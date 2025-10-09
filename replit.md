# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It enables legal professionals to record client meetings, automatically generate attendance notes, legal opinions, and searchable transcripts, while ensuring GDPR compliance, client consent management, and professional document workflows. The project aims to provide an efficient and compliant solution for legal document creation and management.

## User Preferences
**Communication Style:** Simple, everyday language.

**Architectural Preferences:**
- When architectural constraints force backend proxy solutions (e.g., CORS blocking direct uploads), **always choose proper industry-standard implementations over quick hacks**, even if it takes longer to implement
- Prioritize correct architecture from the start rather than temporary workarounds that become technical debt
- Use multipart/form-data for file uploads (industry standard) rather than base64 encoding in JSON (bandwidth inefficient, memory intensive)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite.
- **UI Component Library**: Shadcn UI with Radix UI primitives, custom theme (navy, gold accents, Inter font), Material Design influence.
- **Routing**: Wouter for client-side routing (Dashboard, New Note, Case Detail, Saved Cases, Settings, My Profile, Audit Logs).
- **State Management**: TanStack Query for server state and async operations.
- **Key Features**: Quick Record with Consent Flow (3-sec countdown, verbal consent capture, audit trail), Priority System (badges), Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Review Checklist Banner, Tabbed Document Viewer (Summary, Legal Opinion, Transcript), Role-Based UI (My Profile vs. Firm Settings), Quick Actions, and comprehensive Audit Trail Compliance with CSV export.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with `/api` prefix, modular routes, custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`), with an in-memory implementation for development and Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Users, Cases, Consent Logs, Transcripts (with redaction), Documents (version-controlled), Client Version Tracking, User Preferences, and Audit Trail (comprehensive logging with eventType, userId, IP, metadata). Zod schema validation using `drizzle-zod`.
- **Session Management**: Designed for PostgreSQL session store.

### Authentication & Authorization
- **Authentication**: Replit Auth (OIDC-based), session-based with 4-hour timeout, secure cookies, user isolation, and prepared for multi-role system.
- **Authorization**: Storage layer enforces user isolation, route-level and object-level access control, ACLs for object storage, and UI-level permission checks.

### Security Architecture (Production-Ready)
- **Upload Security**: Server-side file validation (MIME, magic number, size limit), audio format validation.
- **Access Control**: User isolation, ACL ownership verification, UUID-based resources.
- **Rate Limiting**: Per-user and per-IP rate limits with endpoint-specific configurations.
- **Input Sanitization**: Zod validation, path traversal prevention, XSS protection, SQL injection prevention (Drizzle ORM), regex validation.
- **Network Security**: Environment-aware Content Security Policy, CORS, HSTS, security headers (Helmet).
- **Error Sanitization**: Production errors hide internal details, generic messages, server-side logging.
- **Audit Logging**: Comprehensive security event tracking (severity, metadata), structured JSON for SIEM integration.
- **Environment Validation**: Required environment variables validated at startup.

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns.
- **Icons**: Lucide React.
- **Development Tools**: Replit-specific plugins, TypeScript strict mode, ESBuild.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3), 24-hour audio expiration.
- **Planned Integrations**: AI transcription service (OpenAI Whisper API), AI for document generation (GPT-4), Email service, PDF generation.