# LegalNote AI - Design Guidelines

## Design Approach: Professional Legal Application

**Selected Framework**: Material Design (customized for legal/professional context)
**Justification**: Legal case management requires clarity, hierarchy, and trust. Material's emphasis on structured layouts and clear information architecture suits data-heavy legal workflows while allowing customization for professional aesthetics.

---

## Core Design Elements

### A. Color Palette

**Primary Colors:**
- **Navy Primary**: 220 60% 25% (headers, primary buttons, navigation)
- **Navy Dark**: 220 60% 15% (hover states, emphasis)
- **White**: 0 0% 100% (backgrounds, cards)
- **Grey Background**: 220 15% 97% (page backgrounds, subtle sections)

**Accent & Supporting:**
- **Gold Accent**: 45 85% 55% (CTAs, important badges, success states - use sparingly)
- **Grey Medium**: 220 10% 50% (secondary text, borders)
- **Grey Light**: 220 10% 85% (disabled states, subtle dividers)
- **Alert Red**: 0 70% 50% (deletion warnings, errors)
- **Success Green**: 145 60% 45% (completion states)

**Dark Mode** (for late-night case review):
- Navy becomes 220 30% 12% for backgrounds
- White text becomes 220 15% 95%
- Maintain gold accent for consistency

---

### B. Typography

**Font Families:**
- **Primary**: 'Inter' (clean, professional, excellent for legal documents)
- **Headings**: 'Inter' at 600-700 weight
- **Body**: 'Inter' at 400 weight
- **Monospace**: 'JetBrains Mono' (for timestamps, case IDs)

**Type Scale:**
- H1 (Page Titles): text-4xl font-semibold (Dashboard, Case titles)
- H2 (Section Headers): text-2xl font-semibold (Attendance Note, Legal Opinion)
- H3 (Subsections): text-xl font-medium (Key Issues, Next Steps)
- Body Large: text-base (main content, transcripts)
- Body Small: text-sm (metadata, timestamps, helper text)
- Caption: text-xs (labels, tags)

---

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 or p-8
- Section gaps: gap-4 or gap-6
- Page margins: px-8 md:px-16
- Vertical rhythm: space-y-6 for sections

**Grid Structure:**
- Max container width: max-w-7xl mx-auto
- Dashboard grid: 3-column on desktop (grid-cols-1 md:grid-cols-3)
- Case list: Single column with consistent card width
- Form layouts: 2-column where appropriate (grid-cols-1 md:grid-cols-2)

---

### D. Component Library

**Navigation (Top Bar):**
- Height: h-16, navy background (220 60% 25%)
- Logo left, navigation center, user profile right
- Links: "Dashboard | New Note | Saved Cases | Settings"
- Active state: gold underline (border-b-2)
- Sticky positioning for persistent access

**Cards (Case Cards, Document Previews):**
- White background with subtle shadow (shadow-md hover:shadow-lg)
- Rounded corners: rounded-lg
- Padding: p-6
- Border: 1px solid grey-light for definition
- Hover: slight elevation increase, no color change

**Buttons:**
- Primary (Record, Generate, Export): Navy background with white text, gold on hover
- Secondary (Cancel, Back): Outline style with navy border
- Danger (Delete Audio): Red background, use with confirmation modal
- Size variants: py-2 px-4 (standard), py-3 px-6 (large CTAs)

**Forms (Audio Upload, Consent Field, Client Details):**
- Input fields: White background, grey border, navy focus ring
- Labels above inputs: text-sm font-medium text-grey-medium
- Required indicators: Gold asterisk
- Consent toggle: Large switch component with navy active state
- Text areas (consent field): min-h-24, border-2 when focused

**Dashboard Elements:**
- Stats cards: Grid of 3-4 cards showing total cases, recent activity
- Case list: Table or card view with sortable headers
- Quick actions: Prominent "New Note" button (gold accent)
- Search/filter bar: Sticky below navigation

**Document Viewer:**
- Clean white reading area with max-w-4xl
- Sections clearly delineated: Attendance Note, Key Issues, Next Steps, Legal Opinion
- Export buttons top-right: Word and PDF icons with labels
- Typography optimized for reading (line-height-relaxed)

**Modals (Consent, Deletion Confirmation):**
- Overlay: Semi-transparent dark backdrop
- Modal card: White, centered, shadow-2xl, max-w-lg
- Actions: Right-aligned with clear primary/secondary hierarchy

**Admin View:**
- User management table with role badges
- Invite user form: Modal or dedicated page
- Settings organized in tabs or accordion sections

---

### E. Animations

**Minimal, purposeful animations:**
- Button hover: transition-colors duration-200
- Card elevation: transition-shadow duration-300
- Modal entry: Fade in with subtle scale (0.95 to 1)
- Page transitions: None (instant for professional feel)
- Recording indicator: Pulsing red dot (animate-pulse) when active

**NO**: Scroll animations, parallax effects, or decorative motion

---

## Images

**No Hero Image**: This is a utility application, not a marketing page. Lead directly with functionality.

**Icons Only:**
- Use Heroicons (outline and solid variants) via CDN
- Microphone icon for recording
- Document icons for exports (Word, PDF)
- User icons for profile/admin
- Folder/file icons for case management
- Chevrons for navigation and dropdowns

**Optional Placeholder Images:**
- Empty state illustrations for "No cases yet" (simple line art in navy)
- Legal-themed iconography (scales of justice, gavel) - use very sparingly in branding only

---

## Page-Specific Layouts

**Dashboard:**
- Top: Stats overview (3 cards: Total Cases, This Week, Pending)
- Main: Recent cases table/cards with client name, date, status
- Sidebar: Quick filters (date range, client, status)

**New Note Page:**
- Centered form, max-w-2xl
- Consent section at top (toggle + text field)
- Audio section: Upload button OR Record button (large, prominent)
- Recording state: Show waveform visualization, timer, stop button
- Processing state: Progress indicator with "Transcribing..." message

**Case Detail/Generated Note:**
- Breadcrumb navigation
- Document sections in vertical stack with clear headings
- Export toolbar: Sticky at top with Word/PDF buttons
- Metadata sidebar: Client name, date, created by, consent status

**Settings:**
- Tabs: Account | Firm | Team | Security
- Form-based layouts with save button bottom-right
- Two-factor authentication toggle
- GDPR compliance notice prominently displayed

---

## Security & Trust Indicators

- GDPR badge in footer
- "Audio auto-deleted in 24h" notice during recording
- Consent timestamp displayed on every case
- SSL indicator in browser (encourage)
- "Firm-private" label on cases
- Role badges (Admin, Solicitor, Paralegal) in user lists

---

## Responsive Behavior

- Mobile: Stack all multi-column layouts, collapsible navigation drawer
- Tablet: 2-column layouts, preserve top navigation
- Desktop: Full 3-column grids, spacious layouts for document reading
- Recording: Full-screen modal on mobile for focused experience