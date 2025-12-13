# LegalNote AI - Phase 2 Roadmap

**Document Version:** 1.0  
**Created:** December 2025  
**Status:** Planning

---

## Overview

This document tracks features and enhancements planned for future development phases. Items are prioritized based on user feedback, strategic value, and implementation complexity.

---

## Phase 2 Features

### 1. AI-Powered Semantic Search

**Status:** Planned  
**Priority:** High  
**Estimated Effort:** 4-6 weeks

**Description:**  
Implement semantic search using AI embeddings to understand the meaning behind search queries, not just exact text matches. This would allow solicitors to search for concepts like "property dispute" and find cases about "land disagreement" or "real estate conflict".

**Technical Approach:**
- Use OpenAI text-embedding-3-small for generating embeddings
- Store embeddings in PostgreSQL using pgvector extension
- Generate embeddings nightly for transcripts and documents
- Rerank top-N fuzzy search results using semantic similarity
- Hybrid approach: trigram/phonetic first, semantic reranking second

**Benefits:**
- Find cases by concept, not just keywords
- Better recall for complex legal terminology
- Reduces "I know I had a case about X but can't find it" frustrations

**Dependencies:**
- Phase 1 fuzzy search must be complete
- OpenAI API integration (already available)
- pgvector extension installation

**Cost Considerations:**
- Embedding generation: ~$0.02 per 1M tokens
- Storage: Additional column per document/transcript
- Query time: Add ~50-100ms for reranking

---

### 2. Per-User OAuth for Cloud Integrations

**Status:** Planned  
**Priority:** High  
**Estimated Effort:** 4-6 weeks

**Description:**  
Currently, SharePoint/OneDrive sync uses workspace-level Replit connectors, meaning all solicitors' documents sync to a single Microsoft account. This needs to be upgraded to per-user OAuth where each solicitor connects their own Microsoft 365 account.

**Technical Approach:**
- Implement Microsoft Graph API OAuth 2.0 flow per user
- Store refresh tokens securely per user
- Update sync logic to use user-specific tokens
- Add connection management UI to Settings

**Benefits:**
- True multi-tenant document isolation
- Each solicitor's documents go to their own OneDrive/SharePoint
- Meets enterprise security requirements

**Current Limitation:**  
Using workspace-level Replit connector rather than per-user OAuth

---

### 3. Enterprise SSO Integration

**Status:** Planned  
**Priority:** Critical (for enterprise clients)  
**Estimated Effort:** 4-6 weeks

**Description:**  
Support enterprise single sign-on via SAML 2.0, Azure AD, and Okta. Essential for deployment at larger law firms.

**Technical Approach:**
- Implement SAML 2.0 authentication
- Add Azure AD / Microsoft Entra ID connector
- Add Okta connector
- Support for custom identity providers

**Benefits:**
- Required for enterprise sales
- Centralized user management for IT departments
- Improved security through corporate identity policies

---

### 4. iManage Integration

**Status:** Planned  
**Priority:** High (for enterprise clients)  
**Estimated Effort:** 8-12 weeks

**Description:**  
Bidirectional document sync with iManage, the dominant document management system in large law firms.

**Technical Approach:**
- Implement iManage Work REST API integration
- Support document upload/download
- Folder structure mapping
- Metadata synchronization

**Benefits:**
- Essential for large firm deployment
- Documents automatically appear in firm's DMS
- No manual export/import required

---

### 5. NetDocuments Integration

**Status:** Planned  
**Priority:** High (for enterprise clients)  
**Estimated Effort:** 8-12 weeks

**Description:**  
Bidirectional document sync with NetDocuments, another major cloud DMS used by law firms.

**Technical Approach:**
- Implement NetDocuments REST API integration
- OAuth 2.0 authentication
- Cabinet/folder structure mapping
- Profile/metadata mapping

**Benefits:**
- Expands enterprise market reach
- Alternative to iManage for cloud-first firms

---

### 6. Time Capture & Billing Integration

**Status:** Planned  
**Priority:** Medium  
**Estimated Effort:** 6-8 weeks

**Description:**  
Automatic time capture from meeting recordings with export to billing systems.

**Technical Approach:**
- Calculate meeting duration from audio recordings
- AI-generated time entry descriptions
- Export to Clio billing (already integrated)
- Support for LEDES billing formats

**Benefits:**
- Reduces unbilled time loss
- Automates tedious time entry
- Improves billing accuracy

---

### 7. Microsoft Teams Channel Integration

**Status:** Planned  
**Priority:** Medium  
**Estimated Effort:** 4-6 weeks

**Description:**  
Post meeting summaries and documents directly to Microsoft Teams channels.

**Technical Approach:**
- Microsoft Graph API for Teams
- Configurable channel mapping per case/client
- Adaptive card formatting for rich previews

**Benefits:**
- Keep team members informed
- Documents accessible in collaboration context
- Reduces email overhead

---

### 8. Advanced Analytics Dashboard

**Status:** Planned  
**Priority:** Medium  
**Estimated Effort:** 4-6 weeks

**Description:**  
Firm-wide analytics showing meeting volumes, document generation rates, AI usage, and productivity metrics.

**Technical Approach:**
- Aggregate metrics from audit trail
- Time-series visualizations
- Per-solicitor and per-matter breakdowns
- Export to CSV/PDF for management reporting

**Benefits:**
- Demonstrate ROI to firm management
- Identify productivity patterns
- Support capacity planning

---

## Enterprise Readiness Items

These items are required for deployment at large law firms (100+ solicitors):

| Item | Priority | Estimated Effort | Notes |
|------|----------|------------------|-------|
| Horizontal Scalability | Critical | 8-12 weeks | Load balancing, auto-scaling |
| Multi-Tenancy | Critical | 12-16 weeks | Tenant isolation, shared resources |
| High Availability | Critical | 6-8 weeks | Failover, geo-redundancy |
| ISO 27001 Certification | Critical | 12 months | £50,000-100,000 |
| SOC 2 Type II | Critical | 12 months | £40,000-80,000 |
| Penetration Testing | Critical | 2-4 weeks | £15,000-30,000 |
| 24/7 Enterprise Support | Critical | Ongoing | £100,000+/year staffing |

---

## Compliance & Regulatory

| Item | Priority | Notes |
|------|----------|-------|
| SRA Formal Assessment | High | Professional validation |
| DPIA Documentation | High | Data Protection Impact Assessment |
| UK Data Residency | Critical | May need UK/EU hosting |
| DPA Templates | High | GDPR Article 28 agreements |
| Legal Privilege Playbook | High | Formal controls documentation |

---

## Previously Discussed Features

### From User Feedback Sessions

1. **Batch Document Operations** - Select multiple cases and generate documents in bulk
2. **Custom Document Templates** - User-defined templates with firm-specific language
3. **Client Portal** - Allow clients to view their case documents securely
4. **Mobile App** - Native iOS/Android apps for on-the-go access
5. **Offline Recording** - Record meetings without internet, sync later
6. **Multi-Language Support** - Transcription and UI in languages beyond English

---

## Prioritization Criteria

Features are prioritized based on:

1. **User Impact** - How many users benefit and how significantly
2. **Revenue Potential** - Enterprise features that unlock new markets
3. **Technical Feasibility** - Implementation complexity and risk
4. **Strategic Alignment** - Fit with product vision and positioning
5. **Competitive Pressure** - Features needed to maintain market position

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial document creation |
