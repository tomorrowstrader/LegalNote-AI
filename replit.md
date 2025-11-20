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

## Market Positioning & Pricing Strategy

### Target Market Segments
1. **Phase 1 (Months 1-6)**: Solo practitioners and 2-3 person boutique firms with high client meeting volume (family law, employment, immigration)
2. **Phase 2 (Months 6-12)**: Small firms (3-10 solicitors)
3. **Phase 3 (Year 2+)**: Enterprise law firms with custom requirements

### Value Proposition
- **Not compliance-driven**: SRA doesn't mandate attendance notes as hard requirement, but they are effectively essential for professional protection
- **Best practice tool**: Helps solicitors protect against negligence claims, save time, and maintain professional standards
- **Key benefits**: 45 minutes saved per meeting, comprehensive timestamped records, professional client experience, risk mitigation
- **ROI calculation**: Solicitor with 8 meetings/month saves 6 hours = £1,200/month in capacity value (at £200/hour billing rate)

### Pricing Structure

**Launch Phase (First 50 Customers - Months 1-6)**:
- **£99/month** - Build case studies, testimonials, refine product
- Pilot participants: 3 months free, then £69/month lifetime (30% loyalty discount)

**Growth Phase (Month 7-12)**:
- **£149/month** for new customers (standard pricing)
- Existing customers grandfathered at £99/month
- Annual option: £1,490/year (save £298 = 2 months free)

**Scale Phase (Year 2+) - Tiered Pricing**:
- **Solo**: £149/month (1 user, up to 50 meetings/month)
- **Boutique**: £249/month (2-5 users, unlimited meetings)
- **Premium**: £995 setup + £395/month (5+ users, white-glove onboarding, custom branding, priority support)

### Competitive Positioning
- **Above commodity tools** (Clio £59/month, PracticePanther £39/month): Premium AI-powered solution, not basic practice management
- **Below enterprise tools** (Harvey AI £200-£3,000/year): Accessible for solo/small firms without Magic Circle budgets
- **10-15% of monthly value created**: £149 to save £1,200/month in capacity = strong ROI story

### Pilot Program Strategy
- Target: 3-5 solicitors for initial pilot
- Offer: 3 months free + £69/month lifetime + personal onboarding + priority support
- Requirements: Minimum 10 client meetings, weekly feedback calls (first month), testimonial/case study
- Success metrics: 80%+ meetings recorded, 35+ min time saved per meeting, willingness to refer colleagues

### Key Messaging
- Primary motivation: **Professional protection** - "Every client meeting is a potential negligence claim 3 years from now. Can you remember exactly what you advised?"
- Secondary benefits: **Time savings** - "45 minutes saved per meeting means you can take on more clients"
- Tertiary benefits: **Professional image** - "Branded, polished documents impress clients and justify fees"

## Competitive Analysis

### Market Landscape
LegalNote AI competes in two overlapping categories: (1) Meeting transcription tools, and (2) Generative AI legal document drafting. Our unique position is being the only end-to-end solution covering recording → transcription → structured legal documents → client delivery.

### Direct Competitors

**1. Ulla (AI Paralegal Assistant)**
- **What they offer**: Virtual meeting attendance, attendance notes, transcripts
- **Strengths**: "Not a byte of data leaves your control" security, CRM integration
- **Weaknesses**: No legal opinions, no client sharing, no speaker diarization mentioned, undisclosed pricing
- **LegalNote advantage**: We provide 3 document types (attendance note + legal opinion + summary) vs their 1, plus client sharing with consent tracking, firm branding, and transparent pricing (£99-149/month)

**2. Trint / Amberscript / SpeechLive (Transcription Services)**
- **What they offer**: Secure, accurate transcription only
- **Strengths**: Multi-language support, pay-per-use pricing, established brands
- **Weaknesses**: Stop at transcript - no legal document generation, no workflow integration
- **LegalNote advantage**: We're a complete workflow solution, not just transcription - we deliver client-ready attendance notes and legal opinions

**3. Harvey AI / Thomson Reuters CoCounsel / Lexis+ AI (Enterprise AI)**
- **What they offer**: AI copilot for legal research, document drafting, analysis
- **Strengths**: Trusted legal sources (Halsbury's, case law), enterprise security, broad research capabilities
- **Weaknesses**: No meeting recording, no consent management, expensive (£200-3,000/year per user)
- **LegalNote advantage**: 10x cheaper (£149/month), purpose-built for client meetings not generic research, accessible to solo practitioners, GDPR compliance built-in

**4. Robin AI / Smokeball Archie (Practice Management + AI)**
- **What they offer**: AI embedded in practice management systems for contract drafting
- **Strengths**: Integrated workflow, contract-specific features
- **Weaknesses**: Focus on contracts/documents, not meeting documentation
- **LegalNote advantage**: Purpose-built for client meeting workflow, standalone solution

### Competitive Feature Matrix

| Feature | LegalNote AI | Ulla | Trint/Transcription | Harvey/CoCounsel | Robin AI |
|---------|--------------|------|---------------------|------------------|----------|
| Meeting recording | ✅ | ✅ | ❌ | ❌ | ❌ |
| Speaker diarization | 🚧 Planned | ❌ | ❌ | ❌ | ❌ |
| Transcript | ✅ | ✅ | ✅ | ❌ | ❌ |
| Attendance notes | ✅ | ✅ | ❌ | ✅ Generic | ❌ |
| Legal opinions | ✅ | ❌ | ❌ | ✅ | ✅ |
| Client sharing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Consent management | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Firm branding | ✅ | ❌ | ❌ | ❌ | ❌ |
| Target market | Solo/boutique | Boutique | Any firm | Enterprise | Mid-large |
| Pricing | £99-149/mo | Unknown | Pay-per-use | £200-3,000/yr | Unknown |

### Unique Value Proposition

**What NO competitor offers:**
1. End-to-end meeting-to-deliverable workflow (record → transcript → attendance note → legal opinion → client sharing)
2. Built-in consent + GDPR compliance (not bolted on)
3. Client delivery system (share links, SMS 2FA, expiring access)
4. Affordable for solo practitioners (not £3,000/year enterprise pricing)
5. Professional protection focus (audit trail + review workflow)

### Market Positioning

**Positioning Statement:**
"LegalNote AI is the only platform that takes UK solicitors from client meeting to professional deliverable in 45 minutes - with compliance, branding, and client sharing built-in. Not transcription. Not research. Complete client documentation."

**Differentiation Strategy:**
- **vs. Ulla**: "Ulla creates notes. LegalNote creates complete client deliverables."
- **vs. Trint**: "Transcription is step 1. We deliver the attendance note solicitors actually need."
- **vs. Harvey**: "Harvey is for £500/hr lawyers. LegalNote is for working solicitors."

### Critical Gaps to Address
1. **Speaker diarization** - Ulla may have this; we need it to compete on transcript quality
2. **Legal research integration** - Harvey/CoCounsel strength; not needed for MVP but Phase 2 consideration
3. **Practice management integration** - Smokeball/Clio strength; Phase 2 feature for small firms

## Future Roadmap Considerations

### Phase 2 Features (Months 6-12)
- Video conferencing integration (Zoom, Microsoft Teams, Google Meet) via bot API
- Practice management system integration (Clio, Access Legal)
- Custom templates per firm
- User roles and permissions (for small firms with 2-5 solicitors)
- Redaction tools with privilege tagging
- Export to case management systems

### Video Conferencing Notes
- **UK market usage**: 87% of UK law firms use video conferencing; Microsoft Teams is dominant due to Microsoft 365 integration, Zoom popular for external meetings
- **Implementation approach**: Manual upload workflow sufficient for MVP (solicitors download Zoom/Teams/Meet recordings and upload). Bot API integration (Recall.ai, Meeting BaaS) deferred to Phase 2 due to complexity and minimal ROI for first 50 customers
- **Decision rationale**: 30-second manual workflow acceptable vs 3-6 months development time for automatic capture