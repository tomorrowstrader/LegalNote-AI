# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LegalNote is a compliance-first documentation platform for UK solicitors: it records client meetings, transcribes them, and generates attendance notes/summaries from the transcript. It deliberately avoids legal analysis/advice generation to limit SRA and PI-insurance liability — documents must only reflect what was said/done, never offer legal opinions.

## Commands

```bash
npm run dev        # start dev server (tsx, NODE_ENV=development) — serves API + Vite client on :5000
npm run build       # vite build (client) + esbuild bundle of server/index.ts -> dist/
npm run start       # run production build (dist/index.js)
npm run check       # tsc --noEmit (typecheck only, no test runner build step)
npm run db:push     # drizzle-kit push — applies shared/schema.ts to the DB
```

Testing is via Vitest, but there is no `npm test` script — invoke vitest directly:

```bash
npx vitest run                              # full suite (server/**/*.test.ts + shared/**/*.test.ts)
npx vitest run server/services/documentService.test.ts   # single file
npx vitest run -t "name of test"            # filter by test name
```

Client code (`client/**`) is excluded from the vitest config — there is no frontend test suite. ESLint is configured (`eslint.config.js`, `no-console` enforced on `server/**` except `logSanitize.ts`) but is not wired into any npm script or git hook — it's not part of the normal dev loop.

A single local Postgres database backs both the app schema and `stripe-replit-sync`'s managed `stripe` schema; `DATABASE_URL` is required even to run tests that touch storage.

## Architecture

### Monorepo layout
- `client/` — React + TypeScript SPA (Vite root), path-aliased as `@/*`
- `server/` — Express + TypeScript API, run directly via `tsx` in dev, bundled with esbuild for prod
- `shared/` — code and Zod schemas imported by both sides via `@shared/*` (path alias in both `vite.config.ts` and `tsconfig.json`), notably `shared/schema.ts` (Drizzle table defs + Zod insert schemas) and a large set of pure business-logic modules with colocated `*.test.ts` files (document formatting, consent rules, recording-type/matter-kind logic, track-change typing, UK spellcheck, etc.) — these are the easiest place to add unit-testable logic since they have no DB/HTTP dependency.

### Request flow
`server/index.ts` wires up security headers first, then two raw-body webhook routes (Stripe, Recall.ai — both **must** stay registered before `express.json()` since they verify HMAC signatures over the raw body), then JSON middleware, then `registerRoutes(app)` (`server/routes.ts`, ~16k lines — the single Express route table for the whole API). Startup also runs a sequence of idempotent one-off migration/backfill functions (`server/*Migration.ts`) before workers start; new schema changes that need backfilling follow this same pattern rather than a one-shot script.

Routes talk to Postgres exclusively through the `IStorage` interface implemented in `server/storage.ts` (~7.6k lines) — never query the DB directly from a route handler. `server/db.ts` holds the Drizzle/Neon client.

### Compliance-critical invariants (do not weaken without explicit instruction)

- **Sealed audit trail / consent logs**: `audit_trail` and `consent_logs` rows are made immutable by Postgres triggers (`scripts/seal-triggers.sql`), not just application logic. `server/sealTriggerAssertion.ts` asserts these triggers exist and **refuses to boot** if they're missing — `drizzle-kit push` doesn't know about them and can silently drop them on a schema sync. The only bypass is the `legalnote_seal_bypass` DB role via the `legalnote.seal_bypass` session GUC (`server/services/auditChain.ts`), which must never be the app's own `DATABASE_URL` role. Audit entries are HMAC-SHA256 chained (`buildAuditEntryContent`/`computeAuditChainHash`) using `AUDIT_SIGNING_KEY`.
- **Legal master documents are hash-gated**: `docs/legal/masters/*.md` (DPA, evaluation agreement) have their SHA-256 pinned in `EXPECTED_LEGAL_MASTER_HASHES` (`server/services/legalDocumentLoader.ts`). The server **refuses to boot** if a master's bytes don't match. If you ever need to edit one of these files, you must also update the corresponding hash — and that's a legal/compliance decision, not a routine code change, so confirm with the user first.
- **Document governance gate** (`server/services/documentGovernanceGate.ts`): scans generated documents for leaked internal framing ("Speaker A", "the transcript", "this recording") — currently warn-only logging, not a hard reject, but treat new violation patterns as real bugs in the generation prompt/pipeline, not things to silence.
- **Privileged LLM provider boundary**: `server/services/llm/` defines a separate `PrivilegedLLMProvider` interface (currently Bedrock-only, gated by `PRIVILEGED_LLM_PROVIDER=bedrock`) used for the privileged/sensitive completion path, distinct from the general AssemblyAI/OpenAI/Anthropic pipeline described below. Don't collapse these into one code path.

### AI/document pipeline
- Transcription: AssemblyAI (speaker diarization) with Word Boost seeded from practice-area vocab (`server/services/practiceAreaConfig.ts`, 15 UK practice areas), then GPT-4o post-processing for context-aware correction.
- Document generation (attendance notes, summaries): Anthropic Claude, with a post-generation verification pass — see `server/services/documentService.ts`, `derivationEngine.ts`, `produceDocumentVersion.ts`.
- AML trigger detection / action-item extraction: OpenAI GPT-4o (`amlTriggerService.ts`).
- Generated documents must never perform legal analysis — they format/structure what happened, not advise on it. This is a product/compliance line, not just a prompt-tuning detail.

### Auth & multi-tenancy
Google OAuth 2.0 (passport-google-oauth20), session-based. Every user belongs to a `firm` (firm-scoped data isolation); roles and regulatory designations are tracked with a full audit trail of role changes (`role_change_logs`). Authorization is enforced at storage, route, object, and UI layers — when adding a new storage method or route, follow the existing per-user/per-firm scoping pattern rather than trusting client-supplied IDs.

### Frontend
Single-page app, routed with `wouter` (not react-router) in `client/src/App.tsx`. Server state via TanStack Query (`client/src/lib/queryClient.ts`). UI is Shadcn/Radix (`client/src/components/ui/`). Rich text editing (attendance notes, A4 paginated "page view") uses TipTap (`client/src/lib/editorHtml.ts` / `shared/editorHtml.ts`, `PageView.tsx`-style measurement rendering described in `replit.md`).

## Working rules

- Never push directly to `main`. Always work on a new branch.
- Never read or print `.env` files or any real client data.
- Ask before running any `git push` or `railway` command.

## Where to look for more context
- `replit.md` — the most complete running description of features/architecture; kept up to date as features ship. Read it before `README.md`-shaped questions since there is no README.
- `docs/legal/` — the actual legal documents (privacy policy, DPA, terms); `docs/legal/masters/` are the hash-gated ones.
- `COMPLIANCE_AND_RISK.md`, `DATA_HANDLING.md`, `design_guidelines.md` — compliance and design reference docs at repo root.
