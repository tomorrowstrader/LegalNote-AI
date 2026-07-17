# LegalNote Legal Documentation

**Status:** DRAFT — Requires Legal Review Before Publication  
**Last Updated:** July 2026 (v3 counsel drafts ingested)  
**Company:** LegalNote Technologies Ltd (No. 16788981; ICO Reg. ZC176177)

---

## Overview

This folder contains legal and compliance documents for LegalNote. v3 Word drafts were ingested July 2026 and published to the corresponding public routes (except the DPIA, which remains internal).

---

## Document List

| Document | Purpose | Public route |
|----------|---------|--------------|
| `PRIVACY_POLICY.md` | User-facing privacy notice | `/privacy` |
| `TERMS_OF_SERVICE.md` | Platform terms of use | `/terms` |
| `COOKIE_POLICY.md` | Cookie usage disclosure | `/cookies` |
| `SUB_PROCESSOR_LIST.md` | Third-party vendor list | `/sub-processors` |
| `DPIA.md` | Data Protection Impact Assessment | Internal only |
| `DATA_PROCESSING_AGREEMENT.md` | B2B DPA (markdown preview) | `/dpa/preview` |
| `docusign/LegalNote_DPA_Master_Template.docx` | Counsel master DPA for DocuSign e-sign | `/dpa` (signing) |

Live pages: `PrivacyPage.tsx`, `TermsPage.tsx`, `CookiePage.tsx`, `SubProcessorsPage.tsx`, `DpaPage.tsx`, `DpaPreviewPage.tsx`, `DpaCompletePage.tsx`.

---

## DPA electronic signing (DocuSign)

Governed-evaluation and B2B clients can sign the DPA at **`/dpa`** (optional tracking: `/dpa?ref=acme-eval`). Flow:

1. Client fills firm + signer details on LegalNote.
2. Server fills the **master Word DPA** (`docs/legal/docusign/LegalNote_DPA_Master_Template.docx`) and creates a DocuSign envelope from that file (JWT Grant).
3. Client is redirected to DocuSign embedded signing, then back to **`/dpa/complete`**.

The public markdown at `/dpa/preview` (`DATA_PROCESSING_AGREEMENT.md`) is unchanged — it is a separate sample/preview. The executed DocuSign document is always the master `.docx` above.

Signing is gated by `DPA_SIGNING_ENABLED=true` and full DocuSign configuration. Until then, `/dpa` remains viewable and the form shows that e-sign is unavailable.

### Master template (DocuSign only)

Source file: [`docs/legal/docusign/LegalNote_DPA_Master_Template.docx`](docusign/LegalNote_DPA_Master_Template.docx)

On each signing start the server replaces:

| Placeholder in Word | Filled from |
|---------------------|-------------|
| `[Firm legal name]` | Firm legal name |
| `[company number]` | Company number (or em dash) |
| `[SRA number]` | SRA number (or em dash) |
| `[Date of signature]` | Start date (YYYY-MM-DD) |
| Firm `Name:` / `Title:` | Signer name / job title |

DocuSign anchor tabs (inserted into the Firm signature cells):

| Anchor | Tab |
|--------|-----|
| `/firm_sig/` | Sign Here |
| `/firm_date/` | Date Signed |

LegalNote’s signature block remains pre-filled (Jazz Dennis / Director) for countersignature outside this embedded Firm flow.

### Manual DocuSign setup (demo)

1. Create a [DocuSign developer](https://developers.docusign.com/) account.
2. Apps and Keys → add an Integration Key; generate an RSA keypair; copy the **User ID** and **API Account ID**.
3. Grant JWT consent once (the API returns a consent URL on first failure if consent is missing). Scopes: `signature impersonation`.
4. Confirm `docs/legal/docusign/LegalNote_DPA_Master_Template.docx` is deployed with the app (no DocuSign cloud template ID required).
5. Run `npm run db:push` so `dpa_signing_envelopes` exists for tracking.
6. Set `DPA_SIGNING_ENABLED=true` only after counsel sign-off.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DPA_SIGNING_ENABLED` | Must be `true` to allow `POST /api/dpa/start` |
| `DOCUSIGN_INTEGRATION_KEY` | Integration / client ID |
| `DOCUSIGN_USER_ID` | Impersonated user GUID (JWT) |
| `DOCUSIGN_ACCOUNT_ID` | API Account ID |
| `DOCUSIGN_RSA_PRIVATE_KEY` | PEM private key (use `\n` for newlines in env) |
| `DOCUSIGN_RSA_PRIVATE_KEY_PATH` | Alternative: path to PEM file (prefer over embedding the key) |
| `DOCUSIGN_BASE_PATH` | API base; demo default `https://demo.docusign.net/restapi` |
| `DOCUSIGN_OAUTH_BASE_PATH` | OAuth host; demo default `account-d.docusign.com` (no `https://`) |
| `APP_URL` | Canonical app origin for DocuSign return URL (`/dpa/complete`) |

Never commit RSA private keys. `DOCUSIGN_TEMPLATE_ID` is no longer used.

### Demo → production

1. Switch `DOCUSIGN_BASE_PATH` / `DOCUSIGN_OAUTH_BASE_PATH` to your production account region (e.g. `https://eu.docusign.net/restapi` and `account.docusign.com`, or the host shown in DocuSign Admin).
2. Re-grant JWT consent on the production Integration Key.
3. Complete DocuSign go-live review for the Integration Key.
4. Confirm `APP_URL` is the public production origin and the master `.docx` is present on the server.

### API surface

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/dpa/status` | `{ enabled, available }` for the form UI |
| `GET` | `/api/dpa/document` | Markdown sample from `DATA_PROCESSING_AGREEMENT.md` (preview only) |
| `POST` | `/api/dpa/start` | Builds master `.docx` → DocuSign envelope → `{ signingUrl, envelopeId }` |

Code: `server/services/docusignService.ts`, `server/services/dpaDocumentPrep.ts`, table `dpa_signing_envelopes` in `shared/schema.ts`.

---

## Next Steps

1. [ ] Legal counsel final sign-off
2. [ ] Align or replace `DATA_PROCESSING_AGREEMENT.md` with a matching v3 DPA if provided (party name: LegalNote Technologies Ltd)
3. [ ] Soften Security/Landing absolute UK/EU-only marketing claims to match Privacy Policy
4. [ ] Sign DPIA
5. [ ] Complete DocuSign env + enable `DPA_SIGNING_ENABLED` (master `.docx` already in `docs/legal/docusign/`)

---

*These documents are based on UK GDPR considerations. They do not constitute legal advice.*
