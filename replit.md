# LegalNote AI - Replit Configuration

## Overview

LegalNote AI is a professional legal documentation platform designed for solicitors and law firms. The application enables legal professionals to record client meetings and automatically generate attendance notes, legal opinions, and searchable transcripts. The system emphasizes GDPR compliance, client consent management, and professional-grade document workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Quick Record**: Floating action button for instant audio recording with post-recording metadata capture (case title, client name, matter reference)
- **Priority System**: Traffic light badges (red/amber/green) for case urgency indicators
- **Global Search**: Omnipresent search bar in top navigation for searching cases, clients, transcripts, and legal opinions
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
- Users table with UUID primary keys, username/password authentication
- Zod schema validation using `drizzle-zod` for type safety

**Session Management**: Designed for PostgreSQL session store (connect-pg-simple)

### Authentication & Authorization

**Authentication Mechanism**: Session-based authentication
- Cookie-based credential flow
- User creation and retrieval methods defined in storage interface
- Prepared for multi-role system (Partner, Senior Associate, Solicitor, Paralegal)

**Authorization**: 
- Role-based access control for settings (admin vs regular users)
- UI-level permission checks for feature access
- Share link system with configurable access levels and expiration

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

**Planned Integrations**:
- Audio recording/transcription service (WebRTC or similar)
- AI service for generating attendance notes and legal opinions from transcripts
- Email service for client communication
- PDF generation for document export
- File storage for audio recordings with TTL (audio expiration feature visible in UI)