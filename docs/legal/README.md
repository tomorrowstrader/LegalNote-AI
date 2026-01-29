# LegalNote AI Legal Documentation

**Status:** DRAFT - Requires Legal Review Before Publication  
**Last Updated:** January 2026  

---

## Overview

This folder contains draft legal and compliance documents for LegalNote AI. These documents are based on the current technical implementation and should be reviewed by qualified legal counsel before publication.

---

## Document List

| Document | Purpose | Status |
|----------|---------|--------|
| `PRIVACY_POLICY.md` | User-facing privacy notice | Draft |
| `TERMS_OF_SERVICE.md` | Platform terms of use | Draft |
| `COOKIE_POLICY.md` | Cookie usage disclosure | Draft |
| `DATA_PROCESSING_AGREEMENT.md` | B2B DPA (GDPR Art. 28) | Draft |
| `SUB_PROCESSOR_LIST.md` | Third-party vendor list | Draft |
| `DPIA.md` | Data Protection Impact Assessment | Draft |

---

## Verified Technical Claims

The following claims in these documents have been verified against the codebase:

| Claim | Location | Verified |
|-------|----------|----------|
| 4-hour session timeout | `server/replitAuth.ts` | Yes |
| 7-day audio retention | `server/audioCleanup.ts`, `server/services/dataRetentionCleanup.ts` | Yes |
| Daily GDPR cleanup at 2 AM | `server/workers.ts` | Yes |
| AssemblyAI EU endpoint | `server/services/assemblyAIService.ts` | Yes |
| Recall.ai EU region | `RECALL_REGION=eu-central-1` env var | Yes |
| HMAC-SHA256 audit logging | `server/auditSignature.ts` | Yes |
| TLS encryption | Handled by Replit infrastructure | Assumed |

---

## Items Requiring External Verification

Before publication, verify with vendors:

1. **Neon Database** - Confirm EU data residency
2. **Replit Hosting** - Confirm EU infrastructure
3. **Backblaze Object Storage** - Confirm EU region for bucket
4. **OpenAI** - Confirm current DPF certification status
5. **Resend/Twilio/Stripe** - Confirm current DPF certification status

---

## Next Steps

1. [ ] Have legal counsel review all documents
2. [ ] Verify vendor data residency claims with each vendor
3. [ ] Obtain signed DPAs from each sub-processor
4. [ ] Add documents to public website/app
5. [ ] Implement cookie consent banner if adding analytics
6. [ ] Create process for annual DPIA review

---

*These documents are templates based on UK GDPR requirements. They do not constitute legal advice.*
