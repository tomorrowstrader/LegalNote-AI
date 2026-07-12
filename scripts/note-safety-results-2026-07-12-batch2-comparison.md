# Batch 2 dual-arm comparison — 2026-07-12

Both arms ran unconditionally. Gate results are informational only.

## Gate summary

| Check | Arm A (GPT-4o) | Arm B (Sonnet 4.6) |
|-------|----------------|---------------------|
| Hard gate | FAIL | FAIL |
| Attendance plants | 9/9 | 9/9 |
| Summary plants | 9/9 | 9/9 |
| Injections FLAGGED | YES | YES |
| Family derive + numerals | YES | YES |
| Immigration placeholder misuse gone | YES | YES |
| Attendance spurious count | 0 | 0 |
| Retired spurious count | 0 | 0 |
| Corporate compliant placeholders unflagged | NO | YES |
| Em/en dash in model prose | NONE | PRESENT |

**Arm A gate failures:**

- Corporate compliant placeholders still flagged by verifier (3)

**Arm B gate failures:**

- Em/en dash in model prose

## Per-transcript comparison

### Family: Financial Remedy Conference

| Dimension | Arm A | Arm B |
|-----------|-------|-------|
| Attendance plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Summary plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Wrong-client injection | FLAGGED — header-and-body-assertion | FLAGGED — body-name |
| Placeholder-misuse injection | FLAGGED — due-date-match | FLAGGED — due-date-match |
| Family duration derived | YES | YES |
| Family duration in numerals | YES | YES |
| "Matrimonial home" register | YES | YES |
| Allegation-not-finding register | N/A | N/A |
| Corporate compliant placeholders flagged | N/A | N/A |
| Em/en dash in model prose | NONE | PRESENT |

**Arm A — clean attendance warnings:**
- [characterisation] The marriage has therefore subsisted for some 11 years.

**Arm B — clean attendance warnings:**
- [characterisation] Verification response could not be parsed — solicitor review is required before this document is added to the client file

**Arm A — clean summary warnings:**
- [characterisation] The client and Emma Harris married in August 2014 and separated in March 2026, resulting in a marriage duration of approximately 11 years and 7 months.

**Arm B — clean summary warnings:**
- [characterisation] The client contributed a pre-marital deposit of £95,000 from inheritance (paid in 2012, prior to the marriage) towards the matrimonial home.
- [characterisation] The client's pre-marital inheritance deposit of £95,000 requires evidential support and will be a material factor in any Section 25 analysis.
- [characterisation] Immediate Actions Required: 1. The client to gather personal bank statements, Nationwide joint account statements, and an updated mortgage redemption figure by 24 March 2026.


### Immigration: Case History Conference

| Dimension | Arm A | Arm B |
|-----------|-------|-------|
| Attendance plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Summary plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Wrong-client injection | _N/A_ | _N/A_ |
| Placeholder-misuse injection | _N/A_ | _N/A_ |
| Family duration derived | N/A | N/A |
| Family duration in numerals | N/A | N/A |
| "Matrimonial home" register | N/A | N/A |
| Allegation-not-finding register | N/A | N/A |
| Corporate compliant placeholders flagged | N/A | N/A |
| Em/en dash in model prose | NONE | PRESENT |

**Arm A — clean attendance warnings:**
- [characterisation] Prepared by: David Okonkwo, Immigration Solicitor  Date Prepared: 12 July 2026

**Arm B — clean attendance warnings:**
- [characterisation] CLIENT: Amir Hassan
- [genuine-catch] Duration: 1 hour 25 minutes
- [genuine-catch] Time Spent (Units): 15
- [verifier-fp-genuine-placeholder] Next Steps — Solicitor action 3: Due: This was not discussed on this occasion.
- [genuine-catch] Date Prepared: 12 July 2026

**Arm A — clean summary warnings:**
_None._

**Arm B — clean summary warnings:**
- [characterisation] Client: Amir Hassan


### Corporate: Fiduciary Duty / Financial Crime Conference

| Dimension | Arm A | Arm B |
|-----------|-------|-------|
| Attendance plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Summary plants | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED | offshore-transfer: DETECTED; maintenance-waiver: DETECTED; barclays-bridging-loan: DETECTED |
| Wrong-client injection | _N/A_ | _N/A_ |
| Placeholder-misuse injection | _N/A_ | _N/A_ |
| Family duration derived | N/A | N/A |
| Family duration in numerals | N/A | N/A |
| "Matrimonial home" register | N/A | N/A |
| Allegation-not-finding register | YES | YES |
| Corporate compliant placeholders flagged | YES | NO |
| Em/en dash in model prose | NONE | PRESENT |

**Arm A — clean attendance warnings:**
- [verifier-fp-genuine-placeholder] Due: This was not discussed on this occasion.
- [verifier-fp-genuine-placeholder] Due: This was not discussed on this occasion.
- [verifier-fp-genuine-placeholder] Next appointment: This was not discussed on this occasion.

**Arm B — clean attendance warnings:**
_None._

**Arm A — clean summary warnings:**
- [characterisation] Potential breach of fiduciary duty by the managing director.

**Arm B — clean summary warnings:**
_None._

