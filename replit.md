# LegalNote AI - Replit Configuration

## Overview
LegalNote AI is a professional legal documentation platform for solicitors and law firms. It enables legal professionals to record client meetings, automatically generate attendance notes, legal opinions, and searchable transcripts, while ensuring GDPR compliance, client consent management, and professional document workflows with firm branding on all exports. The project aims to provide an efficient and compliant solution for legal document creation and management.

## Recent Changes (October 29, 2025)
- **Calendar Integration for Deadline Management**:
  - Integrated Google Calendar and Outlook connectors via Replit integrations with OAuth 2.0 authentication
  - Database schema additions: calendarEvents table (tracks synced events), calendarConnections table (stores OAuth tokens), deadline and syncToCalendar fields on cases table
  - Created comprehensive calendar service utility (server/calendar.ts) with bidirectional sync capabilities for both Google Calendar and Microsoft Outlook
  - Implemented API routes: GET /api/calendar/status, POST /api/cases/:id/sync-calendar, DELETE /api/cases/:id/unsync-calendar
  - Updated SetPriorityDeadlineModal to save deadlines to database with date picker using react-day-picker
  - Added SyncCalendarModal component for calendar provider selection and sync management
  - Integrated calendar sync action into CaseCard quick actions menu
  - Installed required packages: googleapis and @microsoft/microsoft-graph-client for calendar API integration
  - Calendar events include: case title, client name, matter reference, and deadline date/time
  - Full audit trail with calendar_synced and calendar_sync_failed event types
  - Proper React Query cache invalidation for real-time UI updates

- **Case Management Features Completed**:
  - Implemented Mark as Reviewed feature with backend API, frontend mutation, and database schema (reviewed boolean field)
  - Implemented Archive Case feature with automatic filtering from main case list (archived boolean field)
  - Added Assign to Team Member backend infrastructure with assignedToUserId field and API route (UI picker pending)
  - Implemented comprehensive Download PDF feature that exports all case documents (attendance notes, legal opinions, transcripts) with firm branding
  - **Email to Client Integration**: Complete email functionality using Resend API
    - Installed Resend npm package and configured with RESEND_API_KEY secret
    - Created professional HTML email template with firm branding and secure case document links
    - EmailToClientModal component with recipient input and custom message textarea
    - POST /api/cases/:id/email route with Zod validation, user isolation checks, and audit logging
    - Email includes: case details, customizable message, secure document access link, firm letterhead, and legal confidentiality notice
    - Full audit trail with case_email_sent event type logging recipient and message metadata
  - All features properly invalidate React Query cache and show success/error toast notifications
  - Added comprehensive Zod validation for email requests (email format and 5000 char message limit)

- **MVP Polish Phase Completed (October 28, 2025)**:
  - Enhanced markdown formatting in document exports (PDF strips markdown cleanly, Word preserves **bold**, *italic*, headings, bullets)
  - Added audio deletion status indicator to distinguish GDPR-deleted audio from consent-declined cases
  - Updated GPT-4o attendance note prompts to professional Adam Bernard format with numbered sections and UK law compliance
  - Implemented firm profile infrastructure with database schema, storage methods, and API routes (GET/PUT with admin check)
  - Added firm branding to all document exports (PDF and Word) with professional letterhead displaying firm name, address, phone, email, and SRA number
  - Fixed critical issues: GPT prompt bracketed placeholders and updatedBy UUID validation (now accepts Replit Auth numeric IDs)
  - Improved export filenames to use pattern: ClientName_MatterType_DocumentType_Date.pdf

- **User Onboarding & Admin Setup (October 28, 2025)**:
  - Implemented admin setup prompt modal that appears when firm profile is incomplete (prompts admins to complete firm details on first login)
  - Added interactive onboarding tour using react-joyride library with steps highlighting Quick Record, New Case, Search, Saved Cases, and Firm Settings
  - Created user preferences tracking system with database schema (completedOnboarding, dismissedReviewBanner flags)
  - Added unique constraint on userPreferences.userId to prevent duplicate records
  - Implemented API endpoints for user preferences (GET/PUT /api/user-preferences) with proper validation and user isolation
  - Fixed onboarding tour trigger logic with useEffect to properly start tour when preferences load for first-time users
  - Tour automatically marks as complete after user finishes walkthrough or skips it
  - Added "Restart Tour" button in user profile dropdown menu for users to replay the onboarding walkthrough on demand
  - Restart tour feature properly resets Joyride state and skips completion mutation for manual restarts
  - **Premium Tour Design**: Enhanced with professional styling including custom color scheme using HSL design tokens for seamless light/dark mode support, improved typography with clear headings and readable body text, smooth animations with cubic-bezier easing, elegant progress indicator, custom button styling matching design system, subtle shadows and proper spacing for polished appearance suitable for legal professionals

## User Preferences
**Communication Style:** Simple, everyday language.

**Architectural Preferences:**
- When architectural constraints force backend proxy solutions (e.g., CORS blocking direct uploads), **always choose proper industry-standard implementations over quick hacks**, even if it takes longer to implement
- Prioritize correct architecture from the start rather than temporary workarounds that become technical debt
- Use multipart/form-data for file uploads (industry standard) rather than base64 encoding in JSON (bandwidth inefficient, memory intensive)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite.
- **UI Component Library**: Shadcn UI with Radix UI primitives, black gradient theme (0-8% lightness range), Inter font.
- **Routing**: Wouter for client-side routing (Dashboard, New Note, Case Detail, Saved Cases, Settings, My Profile, Audit Logs).
- **State Management**: TanStack Query for server state and async operations.
- **Key Features**: Quick Record with Consent Flow (3-sec countdown, verbal consent capture, audit trail), Priority System (badges), Global Search, Document Version Control, Transcript Redaction, Client Version Tracking, Review Checklist Banner, Tabbed Document Viewer (Summary, Legal Opinion, Transcript), Role-Based UI (My Profile vs. Firm Settings), Quick Actions (Mark as Reviewed, Archive Case, Assign to Team Member, Download PDF, Email to Client, Share Link, Set Priority/Deadline, Sync to Calendar, Add Quick Note), Firm Branding on Exports (professional letterhead with firm details on all PDF/Word exports), Interactive Onboarding Tour (first-time user walkthrough), Admin Setup Prompts (ensures firm profile completion), Email Integration (Resend API for sending case documents to clients with professional branding), Calendar Integration (Google Calendar and Outlook sync for deadline management), and comprehensive Audit Trail Compliance with CSV export.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript-based).
- **API Design**: RESTful API with `/api` prefix, modular routes, custom error handling.
- **Storage Layer**: Interface-based storage (`IStorage`), with an in-memory implementation for development and Drizzle ORM for database integration.

### Data Storage Solutions
- **Database**: PostgreSQL via Drizzle ORM, connected through Neon serverless.
- **Schema**: Users, Cases (with deadline and syncToCalendar fields), Consent Logs, Transcripts (with redaction), Documents (version-controlled), Client Version Tracking, User Preferences, Firm Profile (name, logo, address, contact details, SRA number for professional letterhead), Calendar Events (tracks synced calendar events with provider, providerEventId, eventType), Calendar Connections (OAuth tokens for Google/Outlook), and Audit Trail (comprehensive logging with eventType, userId, IP, metadata). Zod schema validation using `drizzle-zod`.
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

### Reliability & Data Protection
- **Audio Retention Policy**: 7 days OR until successful processing (whichever comes first) - compliant with UK GDPR "as long as necessary" principle
- **Automatic Retry**: 5 attempts with exponential backoff (1s, 2s, 4s, 8s, 16s) for API failures
- **Manual Retry**: User-initiated retry button for failed cases
- **Early Deletion**: Audio automatically deleted after successful transcription/document generation
- **Expiration Cleanup**: Server startup cleanup removes expired audio recordings
- **Consent Documentation**: Updated consent flow informs clients of 7-day retention period
- **Audit Trail**: All deletions logged with reason (successful_processing_completion or 7day_retention_policy)

## External Dependencies

- **UI & Styling**: Tailwind CSS, custom CSS variables, Google Fonts (Inter, JetBrains Mono).
- **Form Management**: React Hook Form with Hookform Resolvers, Zod for validation.
- **Date Handling**: date-fns.
- **Icons**: Lucide React.
- **Development Tools**: Replit-specific plugins, TypeScript strict mode, ESBuild.
- **Audio Recording & Storage**: MediaRecorder API, Replit Object Storage with presigned URL uploads (Uppy + AWS S3), GDPR-compliant retention policy (7 days OR until successful processing, whichever comes first) with automatic cleanup on completion and startup expiration cleanup.
- **AI Services**: OpenAI Whisper API (transcription), GPT-4o (document generation with Adam Bernard professional format).
- **Email Service**: Resend API for professional transactional emails with firm branding (RESEND_API_KEY environment variable).
- **Calendar Integration**: Google Calendar API (googleapis package) and Microsoft Graph API (@microsoft/microsoft-graph-client package) for bidirectional calendar sync with OAuth 2.0 authentication via Replit connectors.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation with markdown formatting support).