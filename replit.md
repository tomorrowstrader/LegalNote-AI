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
- **AI Services**: 
  - AssemblyAI (primary transcription with speaker diarization)
  - OpenAI GPT-4o (document generation, transcript correction)
  - See `TECHNICAL_ARCHITECTURE.md` for full service documentation
- **Transcription Accuracy Pipeline**:
  1. AssemblyAI Word Boost (auto-injects client names, matter refs, 200+ UK legal terms)
  2. GPT-4o post-processing (context-aware correction of names, numbers, legal terms)
  3. See `server/services/legalVocabulary.ts` for vocabulary list
- **Email Service**: Resend API.
- **SMS Service**: Twilio API for platform-level SMS two-factor authentication.
- **Calendar Integration**: Google Calendar API (googleapis) and Microsoft Outlook/Graph API via Replit connector for bidirectional sync.
- **Video Conferencing**: Recall.ai API for post-call recording import from Zoom, Microsoft Teams, and Google Meet ($0.70/hour, GDPR/SOC2/ISO27001 certified).
- **Practice Management**: Clio Manage integration via OAuth 2.0 (EU endpoint: eu.app.clio.com/api/v4/) for matter import and linking.
- **Document Export**: jsPDF (PDF generation), docx (Word document generation).
- **Testing**: Vitest with happy-dom.

## Integration Configuration

### Calendar Integrations
- **Google Calendar**: OAuth 2.0 via googleapis (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- **Outlook Calendar**: Replit connector integration (oauth handled by Replit Tools pane)

### Practice Management System (PMS)
- **Clio Manage**: OAuth 2.0 integration (requires CLIO_CLIENT_ID, CLIO_CLIENT_SECRET)
  - Uses EU endpoint for GDPR compliance
  - Features: Import matters, link cases to matters, sync client information
  - Schema: clioConnections (OAuth tokens), clioMatterLinks (case-matter mapping)

### Cloud Storage (SharePoint/OneDrive)
- **Architecture**: Firm-wide integration via Replit connector (workspace-level Microsoft auth)
- **Scope**: All documents from all solicitors sync to a single connected Microsoft account
- **Use Cases**:
  - Solo practitioners: Personal OneDrive backup (one user = one connector = perfect isolation)
  - Boutique firms: Shared document library where all solicitors' work syncs to central repository
- **Folder Structure**: LegalNote AI / Cases / [Client - Case Title] / [Document Type]
- **Schema**: sharePointConnections (provider, driveId, auto-sync settings)
- **Known Limitation**: Uses workspace-level Replit connector rather than per-user OAuth
- **Future Enhancement**: Implement per-user Microsoft OAuth for true multi-tenant isolation

### Demo Data Seeding
- **Endpoints**: 
  - `POST /api/demo/seed` - Creates sample cases for demonstrations
  - `POST /api/demo/reset` - Clears and re-seeds demo data
  - `DELETE /api/demo/clear` - Removes demo data only
- **Sample Cases**: 4 realistic UK legal scenarios:
  1. Sarah Thompson - Conveyancing (property purchase)
  2. Marcus Webb - Employment Dispute (unfair dismissal)
  3. Eleanor Chen - Commercial Contract (LLP partnership)
  4. David Patterson - Family Law (divorce settlement)
- **Includes**: Full transcripts with utterances, attendance notes, summaries, action items, consent logs
- **Security**: All data is user-scoped; does not modify shared/global data (e.g., firm profile)
- **Usage**: For client demonstrations and sales presentations
- **Roadmap**: See `FUTURE_FEATURES.md` for Waze-inspired product roadmap

### Revenue Model & Stripe Configuration
- **Business Description**: See `docs/STRIPE_BUSINESS_DESCRIPTION.md` for complete payment processor documentation
- **Revenue Streams**:
  1. **Cloud subscriptions** (recurring): Solo £99/month, Team £199/month + £49/seat
  2. **Implementation packages** (one-time): £1,000-£2,500 for guided onboarding
  3. **Consulting services** (one-time): £500-£1,500 per engagement
  4. **Training workshops** (one-time): £250-£1,500 per session
  5. **Advisory retainers** (recurring): £500-£1,000/month
- **Stripe Products**: 
  - Subscription products: `server/seed-stripe-products.ts`
  - Service products: `server/seed-stripe-services.ts`
- **Preview Mode**: Set `PREVIEW_MODE=true` (server) and `VITE_PREVIEW_MODE=true` (client) in production to disable login for payment processor review