# LegalNote AI - Replit Configuration

## Overview

LegalNote AI is a professional legal documentation platform designed for solicitors and law firms. The application enables legal professionals to record client meetings and automatically generate attendance notes, legal opinions, and searchable transcripts. The system emphasizes GDPR compliance, client consent management, and professional-grade document workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 8, 2025 - Critical Bug Fixes & Code Quality Improvements
1. **OAuth Login Fixed**: Changed session cookie from `sameSite: 'strict'` to `sameSite: 'lax'` to allow OAuth redirects while maintaining CSRF protection
2. **API Response Parsing Fixed**: Updated `apiRequest()` function to return parsed JSON data instead of Response objects, fixing case creation and audio recording flows
3. **CORS Configuration Fixed**: Simplified CORS for development to allow all origins (safe for local development), maintaining strict rules for production
4. **Audio Recording Schema Fixed**: Added `expiresAt` and `deletedAt` to omit list in `insertAudioRecordingSchema` since server calculates these values
5. **TypeScript Code Cleanup**: Resolved all TypeScript errors across frontend and backend
   - Added proper type annotations for API responses (CaseResponse, AudioResponse)
   - Fixed User type in useAuth hook with proper interface
   - Created ServerAudioRecordingInsert type for server-side audio creation
   - Fixed null/undefined type mismatches in storage layer
   - Fixed Uppy type issues with type assertions
   - Fixed Map iteration and implicit any types in uploadSecurity.ts

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component Library**: Shadcn UI with Radix UI primitives
- Custom theme system supporting light/dark modes with Material Design influence
- Design philosophy: Professional legal application with navy primary colors, gold accents for CTAs, and clean typography using Inter font
- Component-based architecture with reusable UI elements (buttons, cards, dialogs, forms)

**Routing**: Wouter for lightweight client-side routing
- Main routes: Dashboard, New Note, Case Detail, Saved Cases, Settings, My Profile

**State Management**: TanStack Query (React Query) for server state and async operations
- Query client configured with custom fetch wrapper for API requests
- Session-based authentication with cookie credentials

**Key Features**:
- **Quick Record with Consent Flow**: 3-second countdown, solicitor reads disclaimer, client verbal consent captured on audio, full audit trail
  - Fallback: Plain text note-taking when consent declined (same document generation workflow)
- **Priority System**: Text badges only (red "Action Required", amber "Deadline Approaching") for case urgency indicators
- **Global Search**: Omnipresent search bar for searching cases, clients, and transcripts (placeholder: "Search cases, clients, or content...")
- **Document Version Control**: Tracks AI generated → manually edited → AI regenerated versions with archive system
- **Transcript Redaction**: Post-generation redaction tool for privilege/privacy issues, regenerates documents without redacted content
- **Client Version Tracking**: Logs which document versions sent to clients, allows amendments, warns on version changes
- **Review Checklist Banner**: Dismissible compliance reminder on first document view (checks for privilege, third-party data, sensitive info)
- **Tabbed Document Viewer**: Three-tab interface separating Summary, Legal Opinion, and Transcript views
- **Role-Based UI**: Settings page splits between regular user "My Profile" and admin-only "Firm Settings"
- **Quick Actions**: Context menus on case cards for common operations (email, mark reviewed, download PDF, assign team member)

### Backend Architecture

**Runtime**: Node.js with Express.js framework
- TypeScript-based server implementation
- Modular route registration system
- Custom error handling middleware
- Request logging with response time tracking

**API Design**: RESTful API with `/api` prefix convention
- Routes registered through `registerRoutes()` function
- Storage interface pattern for data access abstraction

**Storage Layer**: 
- Interface-based storage system (`IStorage`) for flexibility
- In-memory storage implementation (`MemStorage`) for development
- Prepared for database integration via Drizzle ORM

### Data Storage Solutions

**Database**: PostgreSQL (configured via Drizzle ORM)
- Connection via Neon serverless with WebSocket support
- Schema-first approach using `shared/schema.ts`
- Migration management through Drizzle Kit

**Current Schema**:
- **Users**: UUID primary keys, username/password authentication
- **Cases**: Core case management with audio/text source tracking, priority levels, 24hr audio expiration
- **Consent Logs**: GDPR-compliant consent tracking with timestamps, IP addresses, and deletion audit trail
- **Transcripts**: Permanent transcript storage with redaction support (JSON array of redacted segments)
- **Documents**: Version-controlled attendance notes and legal opinions (AI generated, manually edited, AI regenerated)
- **Client Version Tracking**: Tracks which document versions were sent to clients and when
- **User Preferences**: Per-user settings including review banner dismissal
- Zod schema validation using `drizzle-zod` for type safety

**Session Management**: Designed for PostgreSQL session store (connect-pg-simple)

### Authentication & Authorization

**Authentication Mechanism**: Replit Auth (OIDC-based)
- Session-based authentication with 4-hour timeout
- Secure cookie configuration (httpOnly, secure, sameSite: strict)
- User isolation invariant: all storage operations enforce createdBy checks
- Prepared for multi-role system (Partner, Senior Associate, Solicitor, Paralegal)

**Authorization**: 
- Storage layer enforces user isolation across all CRUD operations
- Route-level authorization checks for case and audio access
- ACL-based object storage access control (owner + visibility)
- Role-based access control for settings (admin vs regular users)
- UI-level permission checks for feature access

### Security Architecture (Production-Ready)

**1. Upload Security**
- Server-side file validation: MIME type, magic number verification
- 100MB file size limit enforcement
- Audio format validation (audio/webm, audio/ogg, audio/mp4, audio/wav, audio/mpeg)
- Invalid files deleted immediately with audit logging

**2. Access Control**
- User isolation invariant in storage layer (all operations scoped to userId)
- ACL ownership verification for object storage uploads
- Authorization checks before any resource access
- UUID-based resources prevent object enumeration attacks

**3. Rate Limiting**
- Per-user rate limits (prevents single user abuse)
- Per-IP rate limits (prevents distributed attacks)
- IPv6-safe implementation (uses first 64 bits for subnet tracking)
- Endpoint-specific limits:
  - General API: 100 requests/15min
  - Case creation: 50 requests/hour
  - Presigned URLs: 100 requests/15min
  - Audio uploads: 20 requests/15min
  - Auth endpoints: 100 requests/15min

**4. Input Sanitization**
- Zod validation with strict length limits on all inputs
- Path traversal prevention (../. patterns blocked)
- XSS protection via input escaping
- SQL injection prevention via Drizzle ORM parameterized queries
- Regex validation for UUIDs, paths, and sensitive fields

**5. Network Security**
- Environment-aware Content Security Policy (strict in production)
- CORS with configurable allowed origins (ALLOWED_ORIGINS env var)
- HSTS with 1-year max-age
- Security headers via Helmet: X-Frame-Options, X-Content-Type-Options
- Production CSP: default-src 'self', strict resource loading

**6. Error Sanitization**
- Production error responses hide internal details
- Generic "Internal server error" messages with tracking error IDs
- Development mode preserves full error details
- Server-side error logging for debugging
- No stack trace leakage to clients

**7. Audit Logging**
- Comprehensive security event tracking with severity levels
- Events logged: case creation, access violations, upload security, audio uploads
- Metadata captured: userId, IP address, resource ID/type, action, timestamp
- Structured JSON logging for SIEM integration
- Tamper-evident audit trail

**8. Environment Validation**
- Required environment variables validated at startup
- Session secret strength validation in production
- Graceful startup failures with clear error messages
- Documented optional variables for production deployment

### External Dependencies

**UI & Styling**:
- Tailwind CSS for utility-first styling
- Custom CSS variables for theme consistency
- Google Fonts (Inter for UI, JetBrains Mono for code/IDs)

**Form Management**:
- React Hook Form with Hookform Resolvers
- Zod for schema validation

**Date Handling**: date-fns for date formatting and manipulation

**Icons**: Lucide React icon library

**Development Tools**:
- Replit-specific plugins (runtime error overlay, cartographer, dev banner)
- TypeScript strict mode with path aliases (`@/`, `@shared/`, `@assets/`)
- ESBuild for production builds

**Audio Recording & Storage** (✓ Implemented):
- MediaRecorder API for browser-based audio capture
- Replit Object Storage integration with presigned URL uploads (Uppy + AWS S3)
- 24-hour audio expiration enforcement (server-computed expiresAt, enforced in GET routes and streaming)
- Graceful fallback to text notes when microphone unavailable
- AudioPlayer component with playback controls, timeline scrubber, and expiration warnings
- Object ACL system for private audio file access control

**Planned Integrations**:
- AI transcription service (OpenAI Whisper API) for audio-to-text conversion
- AI service for generating attendance notes and legal opinions from transcripts (GPT-4)
- Email service for client communication
- PDF generation for document export