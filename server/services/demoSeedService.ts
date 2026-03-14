/**
 * Demo Seeding Service — Full Showcase Rebuild
 * Creates six precisely crafted showcase cases demonstrating LegalNote's full capability
 * across multiple practice areas, session types, and compliance scenarios.
 *
 * Cases:
 * 1. Richard Patterson — Commercial Property (AML/SRA Audit Showcase)
 * 2. Sophie Henderson — Residential Conveyancing (Multi-Session Showcase)
 * 3. Daniel Hartley — Employment / Employee (Undertakings Showcase)
 * 4. Yasmin Okafor — Family / Children Arrangements (Multi-Format Showcase)
 * 5. Margaret & Geoffrey Whitmore — Wills & Probate (Complex Document Showcase)
 * 6. Leon Treadwell — Criminal Defence (Police Station Showcase)
 */

import { db } from "../db";
import {
  cases, transcripts, documents, consentLogs, actionItems, auditTrail,
  preMeetingBriefings, shareLinks, quickNotes, audioRecordings,
  calendarEvents, meetingImports, preConsentEmails, clioMatterLinks,
  clientVersionTracking, amlMonitoringNotes, amlDecisionRecords,
  meetingSessions, clients, undertakings, timeEntries, externalDocumentRefs,
  documentComments
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

type Case = typeof cases.$inferSelect;
type Client = typeof clients.$inferSelect;
type MeetingSession = typeof meetingSessions.$inferSelect;
type Transcript = typeof transcripts.$inferSelect;

const now = new Date();
const daysAgo = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
};
const daysAgoAt = (days: number, hour: number, min: number) => {
  const date = daysAgo(days);
  date.setHours(hour, min, 0, 0);
  return date;
};

async function deleteAllUserCaseData(userId: string) {
  const userCases = await db.select().from(cases).where(eq(cases.createdBy, userId));
  for (const c of userCases) {
    if (c.createdBy !== userId) continue;
    const docs = await db.select({ id: documents.id }).from(documents).where(eq(documents.caseId, c.id));
    for (const doc of docs) {
      await db.delete(clientVersionTracking).where(eq(clientVersionTracking.documentId, doc.id));
      await db.delete(documentComments).where(eq(documentComments.documentId, doc.id));
    }
    await db.delete(undertakings).where(eq(undertakings.caseId, c.id));
    await db.delete(timeEntries).where(eq(timeEntries.caseId, c.id));
    await db.delete(externalDocumentRefs).where(eq(externalDocumentRefs.caseId, c.id));
    await db.delete(amlMonitoringNotes).where(eq(amlMonitoringNotes.caseId, c.id));
    await db.delete(amlDecisionRecords).where(eq(amlDecisionRecords.caseId, c.id));
    await db.delete(actionItems).where(eq(actionItems.caseId, c.id));
    await db.delete(preMeetingBriefings).where(eq(preMeetingBriefings.caseId, c.id));
    await db.delete(shareLinks).where(eq(shareLinks.caseId, c.id));
    await db.delete(quickNotes).where(eq(quickNotes.caseId, c.id));
    await db.delete(calendarEvents).where(eq(calendarEvents.caseId, c.id));
    await db.delete(meetingImports).where(eq(meetingImports.caseId, c.id));
    await db.delete(preConsentEmails).where(eq(preConsentEmails.caseId, c.id));
    await db.delete(clioMatterLinks).where(eq(clioMatterLinks.caseId, c.id));
    await db.delete(auditTrail).where(eq(auditTrail.caseId, c.id));
    await db.delete(consentLogs).where(eq(consentLogs.caseId, c.id));
    await db.update(cases).set({ clientCareLetterId: null }).where(eq(cases.id, c.id));
    await db.delete(documents).where(eq(documents.caseId, c.id));
    await db.delete(transcripts).where(eq(transcripts.caseId, c.id));
    await db.delete(audioRecordings).where(eq(audioRecordings.caseId, c.id));
    await db.delete(meetingSessions).where(eq(meetingSessions.caseId, c.id));
    await db.delete(cases).where(and(eq(cases.id, c.id), eq(cases.createdBy, userId)));
  }
  await db.delete(clients).where(eq(clients.createdBy, userId));
}

// ——— CASE 1: Richard Patterson — Commercial Property — AML/SRA Audit Showcase ———

async function seedCase1Patterson(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Richard Patterson",
    email: "r.patterson@pattersondev.co.uk",
    phone: "07901 443 228",
    address: "Patterson Developments Ltd, 14 Canary Court, London E14 5AB",
    companyName: "Patterson Developments Ltd",
    amlRiskLevel: "high",
    amlRiskLastReviewed: daysAgo(7),
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Commercial Warehouse Acquisition — Stratford",
    clientName: "Richard Patterson",
    clientId: client.id,
    matterReference: "DEMO_COMP/2024/0291",
    createdBy: userId,
    status: "review_required",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "commercial_property",
    riskLevel: "high",
    conflictCheckCompleted: true,
    conflictCheckNote: "Checked against client register — no conflict identified. Patterson Developments Ltd not previously instructed. No connection to any opposing party on the firm's current files.",
    reviewed: true,
    createdAt: daysAgo(35),
  }).returning() as Case[];

  // --- Session 1: Full meeting — Matter inception (5 weeks ago, 2h 10m) ---
  const session1Date = daysAgoAt(35, 10, 0);
  const [session1] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    startedAt: session1Date,
    durationSeconds: 7800,
    status: "completed",
    notes: "Matter inception — initial consultation with Richard Patterson of Patterson Developments Ltd",
    createdBy: userId,
  }).returning();

  await db.insert(consentLogs).values({
    caseId: newCase.id,
    audioRecordingId: null,
    solicitorId: userId,
    consentGiven: true,
    disclaimerScriptVersion: "v2.1",
    consentModality: "verbal_recorded",
  });

  const transcript1Content = `Meeting transcript — Commercial Property Acquisition, Matter Inception

SOLICITOR: Good morning, Mr Patterson. Thank you for attending. I should inform you that this meeting is being recorded for the purpose of creating an accurate attendance note. Do you consent to the recording?

CLIENT: Yes, I consent.

SOLICITOR: Thank you. So, Patterson Developments Limited is looking to acquire a commercial warehouse unit in Stratford, East London. Can you give me the background to this transaction?

CLIENT: Certainly. We've identified Unit 14 at the Meridian Industrial Estate on Marshgate Lane, Stratford. It's a warehouse and distribution unit — approximately twelve thousand square feet. The asking price is two point four million pounds. We intend to use it as a primary distribution hub for our construction materials supply business.

SOLICITOR: And what is the current corporate structure of Patterson Developments Limited?

CLIENT: Patterson Developments is the trading company. It's held by Meridian Holdings Limited, which is a UK holding company. Meridian Holdings is itself owned by the Patterson Family Trust, which is a discretionary trust established in Jersey in 2018.

SOLICITOR: I see. That's a three-tier structure — the trust at the top, a holding company in the middle, and the trading company at the bottom. I'll need to understand the beneficial ownership through each layer. Who are the beneficiaries of the Patterson Family Trust?

CLIENT: Myself, my wife Catherine, and our two children. The trustee is Bridgewater Trust Company in Jersey.

SOLICITOR: Thank you. Now, I must explain that under the Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017, commercial property transactions are subject to stringent anti-money laundering obligations. Given the corporate structure you've described — particularly the offshore trust element — I'm required to carry out enhanced due diligence. This means I'll need to verify the beneficial ownership through each layer of the structure, from Patterson Developments up through Meridian Holdings to the Jersey trust.

CLIENT: I understand. What documentation will you need?

SOLICITOR: I'll need the certificate of incorporation and current shareholding for both Patterson Developments and Meridian Holdings from Companies House. For the Jersey trust, I'll need the trust deed, the schedule of beneficiaries, and confirmation from Bridgewater Trust Company of the current trustees and protectors. I'll also need certified identification for you as the principal beneficial owner.

CLIENT: The Companies House documents are straightforward. The Jersey trust documents may take a little longer — I'll need to contact Bridgewater directly.

SOLICITOR: That's understood. Now, turning to source of funds. How is the purchase being financed?

CLIENT: The purchase price of two point four million is being funded as follows: one point two million from retained profits within Patterson Developments, evidenced by the last three years of audited accounts. The remaining one point two million is a commercial mortgage facility which we've applied for through Barclays.

SOLICITOR: I'll need to see the audited accounts and the mortgage offer when it comes through. Are there any other parties contributing to the purchase — investors, joint venture partners, or related entities providing loans?

CLIENT: No. However, I should be transparent — there was a short-term loan of two hundred thousand pounds from Meridian Holdings to Patterson Developments last year to cover a cash flow gap. That has since been repaid in full.

SOLICITOR: Thank you for disclosing that. I'll need to see the loan documentation and evidence of repayment. Any inter-company lending within this structure is something I'll want to record in the AML file. Now, I have to flag three specific concerns arising from what you've told me today.

CLIENT: Go ahead.

SOLICITOR: First, the beneficial ownership is not fully transparent at this stage because I haven't yet verified the trust structure in Jersey. Second, the offshore trust component cannot be immediately verified — Jersey is a Crown Dependency with its own regulatory framework, and I'll need to confirm registration with the Jersey Financial Services Commission. Third — and I appreciate this may be commercially sensitive — I would ordinarily expect to see bank statements for the entities involved. Can you provide those?

CLIENT: I'd prefer not to disclose the full bank statements at this stage. They contain commercially sensitive information about other transactions and supplier relationships.

SOLICITOR: I understand the concern, Mr Patterson, but I must be direct. I have a statutory obligation under the Proceeds of Crime Act 2002 and the Money Laundering Regulations to satisfy myself as to the source of funds. If I cannot do so, I am unable to proceed with this matter. I'm not asking you to disclose anything beyond what's necessary for my compliance obligations, but I do need to see sufficient evidence to verify that the funds are legitimate. We can discuss redaction of genuinely unrelated entries if that helps.

CLIENT: I'll speak to my accountants. I'm sure we can find a way through this.

SOLICITOR: Good. I should also put on record that until I have received satisfactory documentation to verify the beneficial ownership structure and source of funds, this matter cannot proceed to exchange. I'll be creating an AML monitoring note today recording these concerns, and this file will be subject to ongoing enhanced due diligence monitoring. Do you understand that position?

CLIENT: Yes, I understand. I'll get the documentation to you as quickly as possible.

SOLICITOR: Thank you. Moving on to the property itself — have your surveyors inspected the unit?

CLIENT: Yes, the structural survey was completed last week. No material defects. There's a small area of damp near the loading bay doors but the surveyor considers it easily remedied.

SOLICITOR: Good. I'll review the title at the Land Registry, check for restrictive covenants, and examine the commercial lease history. For a property in Stratford, I'll also want to confirm the position regarding any compulsory purchase orders or development orders connected to the Olympic legacy regeneration programme.

CLIENT: That's helpful — I hadn't considered that.

SOLICITOR: One further point on VAT. Has the vendor opted to tax the property?

CLIENT: I believe so, yes.

SOLICITOR: In that case, VAT at twenty percent will be added to the purchase price — that's an additional four hundred and eighty thousand pounds. Patterson Developments is VAT-registered, so you can reclaim this, but it's a significant cash flow consideration at completion. You'll need to ensure the mortgage facility and your available funds can accommodate the VAT payment on completion day.

CLIENT: We are VAT-registered. I'll confirm the cash flow position with the accountants.

SOLICITOR: Good. Let me summarise the action items. On my side: I'll draft the AML monitoring note today, open the enhanced due diligence file, requisition the title from the Land Registry, and instruct searches. On your side: you need to provide the Jersey trust documentation, the Companies House records, certified ID, the audited accounts, and we need to resolve the bank statement question. I'll also need the Barclays mortgage offer once it's issued.

CLIENT: Understood. I'll get the process started today.

SOLICITOR: Excellent. I'll be in touch within the week with an update on the title position. Thank you, Mr Patterson.`;

  const [t1] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session1.id,
    content: transcript1Content,
    utterances: [
      { speaker: "A", text: "Good morning, Mr Patterson. Thank you for attending. I should inform you that this meeting is being recorded for the purpose of creating an accurate attendance note. Do you consent to the recording?", start: 0, end: 12000, confidence: 0.96 },
      { speaker: "B", text: "Yes, I consent.", start: 12500, end: 14000, confidence: 0.98 },
      { speaker: "A", text: "Thank you. So, Patterson Developments Limited is looking to acquire a commercial warehouse unit in Stratford, East London. Can you give me the background to this transaction?", start: 14500, end: 24000, confidence: 0.95 },
      { speaker: "B", text: "Certainly. We've identified Unit 14 at the Meridian Industrial Estate on Marshgate Lane, Stratford. It's a warehouse and distribution unit — approximately twelve thousand square feet. The asking price is two point four million pounds.", start: 24500, end: 42000, confidence: 0.93 },
    ],
    speakerCount: 2,
    createdAt: session1Date,
  }).returning();

  const doc1Content = `# ATTENDANCE NOTE

**Client:** Richard Patterson (Patterson Developments Ltd)
**Matter:** Commercial Warehouse Acquisition — Unit 14 Meridian Industrial Estate, Stratford
**Reference:** DEMO_COMP/2024/0291
**Date:** ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Richard Patterson (Client / Director, Patterson Developments Ltd)
**Duration:** 2 hours 10 minutes

---

## 1. INTRODUCTION AND RECORDING CONSENT

Client attended the office for the initial consultation regarding the proposed acquisition of Unit 14, Meridian Industrial Estate, Marshgate Lane, Stratford, East London. Recording consent was obtained at the commencement of the meeting.

## 2. TRANSACTION OVERVIEW

- **Property:** Unit 14, Meridian Industrial Estate, Marshgate Lane, Stratford, E15
- **Type:** Commercial warehouse and distribution unit (approx. 12,000 sq ft)
- **Purchase price:** £2,400,000
- **Purchaser:** Patterson Developments Ltd
- **Intended use:** Primary distribution hub for construction materials supply business

## 3. CORPORATE STRUCTURE

The client disclosed the following ownership structure:

- **Trading company:** Patterson Developments Ltd (Companies House registered)
- **Holding company:** Meridian Holdings Ltd (UK incorporated)
- **Ultimate beneficial ownership:** Patterson Family Trust — a discretionary trust established in Jersey in 2018
- **Trustee:** Bridgewater Trust Company (Jersey)
- **Beneficiaries:** Richard Patterson, Catherine Patterson (wife), and two children

**Note:** This is a three-tier structure with an offshore trust element requiring enhanced due diligence under the Money Laundering Regulations 2017.

## 4. AML COMPLIANCE — ENHANCED DUE DILIGENCE

### 4.1 Risk Assessment
- **Client risk:** HIGH — offshore trust element, opaque beneficial ownership at inception
- **Matter risk:** HIGH — commercial property acquisition (auto-default under SRA sectoral guidance)
- **EDD required:** YES — Regulation 33 of the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017

### 4.2 AML Concerns Identified

I identified three specific concerns during the meeting:

**(a) Beneficial ownership not fully transparent** — The Jersey trust structure means the ultimate beneficial ownership cannot be verified from UK public registries alone. Trust documentation and confirmation from the trustee (Bridgewater Trust Company) is required.

**(b) Offshore trust component cannot be immediately verified** — Jersey is a Crown Dependency with its own regulatory framework. Registration with the Jersey Financial Services Commission must be confirmed.

**(c) Client declined to provide bank statements** — Client cited commercial sensitivity. I advised Mr Patterson that I have a statutory obligation under the Proceeds of Crime Act 2002 and the Money Laundering Regulations to satisfy myself as to the source of funds, and that the matter cannot proceed without satisfactory documentation. Client agreed to discuss with his accountants.

### 4.3 Source of Funds

| Source | Amount | Status |
|--------|--------|--------|
| Retained profits (Patterson Developments Ltd) | £1,200,000 | Awaiting audited accounts |
| Commercial mortgage (Barclays) | £1,200,000 | Application submitted, offer pending |
| **Total** | **£2,400,000** | |

**Additional disclosure:** A short-term loan of £200,000 from Meridian Holdings to Patterson Developments in the prior year (since repaid in full). Loan documentation and evidence of repayment to be provided.

### 4.4 Verification Required

1. Certificate of incorporation and current shareholding — Patterson Developments Ltd
2. Certificate of incorporation and current shareholding — Meridian Holdings Ltd
3. Trust deed for the Patterson Family Trust
4. Schedule of beneficiaries and confirmation of trustees/protectors from Bridgewater Trust Company
5. Certified identification for Richard Patterson (principal beneficial owner)
6. Audited accounts for Patterson Developments Ltd (3 years)
7. Barclays commercial mortgage offer letter
8. Bank statements or alternative source of funds evidence
9. Inter-company loan documentation and repayment evidence

**I formally advised the client that this matter cannot proceed to exchange until satisfactory documentation has been received and verified. An AML monitoring note has been created.**

## 5. PROPERTY MATTERS

- Structural survey completed — no material defects. Minor damp near loading bay doors (surveyor considers easily remedied)
- Title to be requisitioned from Land Registry
- Restrictive covenants to be examined
- Position regarding compulsory purchase orders / Olympic legacy regeneration development orders to be confirmed
- VAT: Vendor has opted to tax. VAT at 20% (£480,000) payable on completion. Client is VAT-registered — can reclaim on next return. Cash flow position to be confirmed with accountants.

## 6. NEXT STEPS

**Solicitor Actions:**
1. Create AML monitoring note (today)
2. Open enhanced due diligence file
3. Requisition title from Land Registry
4. Instruct local authority, environmental, and drainage searches
5. Contact seller's solicitors regarding draft contract

**Client Actions:**
1. Provide Jersey trust documentation (trust deed, beneficiary schedule, trustee confirmation)
2. Provide Companies House records for both entities
3. Provide certified identification
4. Provide audited accounts (3 years)
5. Resolve bank statement disclosure with accountants
6. Confirm cash flow position for VAT on completion

## 7. CLIENT CONFIRMATION

Client confirmed understanding of AML obligations and agreed to provide documentation. Client understood that the matter cannot proceed until EDD is satisfactorily completed.

---
*Attendance note prepared contemporaneously from recording. AML monitoring note created same day.*`;

  const [attendDoc1] = await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session1.id,
    transcriptSnapshotId: t1.id,
    type: "attendance_note",
    content: doc1Content,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "approved",
    approvedBy: userId,
    approvedAt: new Date(session1Date.getTime() + 3 * 60 * 60 * 1000),
  }).returning();

  // Client care letter for Patterson
  await db.insert(documents).values({
    caseId: newCase.id,
    type: "client_care_letter",
    content: `# CLIENT CARE LETTER\n\n**To:** Richard Patterson\n**Patterson Developments Ltd**\n14 Canary Court, London E14 5AB\n\n**Date:** ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n**Our Reference:** DEMO_COMP/2024/0291\n\n---\n\nDear Mr Patterson,\n\nThank you for instructing us in connection with the proposed acquisition of Unit 14, Meridian Industrial Estate, Marshgate Lane, Stratford, East London E15.\n\nI am writing to confirm the basis on which we will act for Patterson Developments Ltd in this matter.\n\n## Scope of Work\n\nWe have been instructed to act on behalf of Patterson Developments Ltd in connection with the purchase of the above commercial property. Our work will include:\n\n- Reviewing and reporting on the title\n- Carrying out all necessary searches and enquiries\n- Negotiating the contract\n- Dealing with the mortgage documentation\n- Completion and post-completion formalities\n- Compliance with AML and regulatory obligations\n\n## Fees\n\nOur charges for this matter will be calculated on a time-spent basis at the following rate:\n\n- Partner rate: £320 per hour plus VAT\n\nBased on the information currently available, we estimate our total professional charges for this matter will be in the region of £8,500 to £12,000 plus VAT, disbursements, and search fees.\n\n## Regulatory Information\n\nThis firm is authorised and regulated by the Solicitors Regulation Authority (SRA). We are required to comply with the SRA Standards and Regulations, including the SRA Code of Conduct for Solicitors and the SRA Code of Conduct for Firms.\n\n## Complaints\n\nIf you are unhappy with any aspect of the service you receive, please contact the Senior Partner in the first instance. If the matter is not resolved to your satisfaction, you may refer it to the Legal Ombudsman.\n\nPlease sign and return one copy of this letter to confirm your instructions.\n\nYours sincerely,\n\n**Attending Solicitor**\nPartner — Commercial Property`,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "approved",
    approvedBy: userId,
    createdAt: session1Date,
  });

  await db.update(cases).set({
    clientCareLetterSentAt: session1Date,
  }).where(eq(cases.id, newCase.id));

  // --- Session 2: Telephone call (3 weeks ago, 18 min) ---
  const session2Date = daysAgoAt(21, 14, 35);
  const [session2] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "telephone_call",
    startedAt: session2Date,
    durationSeconds: 1080,
    status: "completed",
    notes: "Telephone call — Patterson update on documentation",
    createdBy: userId,
  }).returning();

  const transcript2Content = `Telephone call transcript — Patterson Developments Ltd

SOLICITOR: Good afternoon, Mr Patterson. This call is being recorded. Is that acceptable?

CLIENT: Yes, that's fine.

SOLICITOR: Thank you. I'm calling to check on the progress of the documentation we discussed at our meeting.

CLIENT: Yes, I've spoken to my accountants at Hargreaves & Co. They're compiling the audited accounts and they've agreed to prepare a source of funds report. The Jersey trust documents are being handled by Bridgewater — their compliance officer has confirmed they'll provide the trust deed and beneficiary schedule, but they've said it could take up to five working days because they need internal sign-off.

SOLICITOR: I understand. Five working days is manageable. And the bank statements?

CLIENT: My accountants have suggested providing a certified source of funds letter instead, supported by the audited accounts. They feel that addresses your concerns without full disclosure of every transaction.

SOLICITOR: I'll consider that, Mr Patterson, but I should be candid — a certified letter from your accountants may not be sufficient on its own. The SRA guidance on source of funds is clear that we need to see the underlying evidence, not just third-party confirmations. However, if the letter is detailed and supported by the audited accounts showing the profit retention, we may be able to work with that. I'll reserve my position until I see the documents.

CLIENT: Fair enough. I'll push Hargreaves to get everything to you by the end of next week.

SOLICITOR: Good. I should note that I remain concerned about the pace of disclosure. The longer we go without completing the enhanced due diligence, the greater the risk that we cannot meet the timeline for exchange. I'll add a second monitoring note to the AML file today.

CLIENT: Understood. I'll chase them.

SOLICITOR: Thank you, Mr Patterson. I'll be in touch once the documents arrive.`;

  const [t2] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session2.id,
    content: transcript2Content,
    utterances: [
      { speaker: "A", text: "Good afternoon, Mr Patterson. This call is being recorded. Is that acceptable?", start: 0, end: 5000, confidence: 0.96 },
      { speaker: "B", text: "Yes, that's fine.", start: 5500, end: 7000, confidence: 0.98 },
    ],
    speakerCount: 2,
    createdAt: session2Date,
  }).returning();

  const doc2Content = `# TELEPHONE ATTENDANCE NOTE

**Client:** Richard Patterson (Patterson Developments Ltd)
**Matter:** Commercial Warehouse Acquisition — Stratford
**Reference:** DEMO_COMP/2024/0291
**Date:** ${session2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Time:** 2:35pm
**Duration:** 18 minutes
**Type:** Incoming call from client

---

Call received from Mr Patterson regarding progress on AML documentation.

Client confirmed:
- Accountants (Hargreaves & Co) compiling audited accounts and preparing source of funds report
- Bridgewater Trust Company (Jersey) will provide trust deed and beneficiary schedule — approximately 5 working days due to internal compliance sign-off requirement
- Accountants have proposed providing a certified source of funds letter in lieu of full bank statements, supported by audited accounts

I advised Mr Patterson that a certified letter alone may not satisfy SRA source of funds requirements and that I will reserve my position until I review the documentation. I noted continued concern about the pace of disclosure and confirmed that a second AML monitoring note will be added to the file.

Client undertook to chase Hargreaves and aims to have all documentation submitted by end of next week.

---
*Second AML monitoring note added to file.*`;

  await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session2.id,
    transcriptSnapshotId: t2.id,
    type: "attendance_note",
    content: doc2Content,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "approved",
    approvedBy: userId,
  });

  // --- Session 3: Full meeting — AML review and clearance (1 week ago, 1h 25m) ---
  const session3Date = daysAgoAt(7, 10, 30);
  const [session3] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    startedAt: session3Date,
    durationSeconds: 5100,
    status: "completed",
    notes: "AML review meeting — documentation received, clearance determination",
    createdBy: userId,
  }).returning();

  const transcript3Content = `Meeting transcript — AML Review and Clearance

SOLICITOR: Good morning, Mr Patterson. Recording is on — you consent?

CLIENT: Yes.

SOLICITOR: Thank you. I've now received the full documentation package from Hargreaves and from Bridgewater Trust Company. I want to go through each item with you and confirm the position.

CLIENT: Of course.

SOLICITOR: Starting with the corporate structure. I've verified Patterson Developments Limited and Meridian Holdings Limited through Companies House. Both companies are active, accounts are filed and up to date. The shareholding confirms that Meridian Holdings holds one hundred percent of Patterson Developments, and the Patterson Family Trust holds one hundred percent of Meridian Holdings. That's consistent with what you told me at our first meeting.

CLIENT: Good.

SOLICITOR: Turning to the Jersey trust. Bridgewater have provided the trust deed dated March 2018, the schedule of beneficiaries — yourself, Catherine, and your two children — and a letter confirming the current trustees. I've also verified the trust's registration with the Jersey Financial Services Commission. The trust is registered and in good standing. I'm satisfied that the beneficial ownership is now fully transparent.

CLIENT: That's a relief.

SOLICITOR: Now, source of funds. The audited accounts for Patterson Developments for the last three financial years show cumulative retained profits well in excess of the one point two million being contributed to the purchase. Hargreaves have provided a detailed source of funds report — it traces the funds from trading profits through the company's accounts. The Barclays mortgage offer has also arrived — one point two million on standard commercial terms. I'm satisfied with the source of funds position.

CLIENT: And the bank statement issue?

SOLICITOR: The source of funds report from Hargreaves, combined with the audited accounts, provides sufficient evidence for my purposes. The report specifically addresses the retained profit position and the inter-company loan that was repaid. I don't need to pursue the bank statements further. However, I want to be clear that if any further transactions arise that change the funding position, you must inform me immediately.

CLIENT: Absolutely. You have my word.

SOLICITOR: Good. On that basis, I am satisfied that the enhanced due diligence obligations have been met. I'm recording an AML Decision Record today with a determination of "cleared to proceed." This decision record will be HMAC-signed for audit integrity. I should note that the counter-signatory — our Head of Compliance — will also review and approve the decision within the next twenty-four hours.

CLIENT: So we can move forward?

SOLICITOR: Yes. I'll now proceed to review the draft contract, raise preliminary enquiries, and report to you on the title. We should be in a position to exchange within four to six weeks, subject to satisfactory replies to enquiries and the usual conveyancing formalities.

CLIENT: Excellent news. Thank you for being so thorough with all of this. I know it's been a lot of paperwork.

SOLICITOR: It's my duty, Mr Patterson. These regulations exist for good reason, and compliance protects both of us. Now, shall we discuss the heads of terms?

CLIENT: Yes, let's do that.

SOLICITOR: The vendor is asking for a ten-percent deposit on exchange. Given the purchase price of two point four million, that's two hundred and forty thousand. Are Patterson Developments in a position to provide that from the retained profits?

CLIENT: Yes, that's not a problem.

SOLICITOR: Good. I'll also need to discuss the completion date. The vendor's solicitors have indicated a preference for completion within twenty-eight days of exchange. Is that workable for you?

CLIENT: Perfectly. We'd actually prefer to move quickly.

SOLICITOR: Then we're aligned. I'll proceed on that basis. Is there anything else you'd like to discuss today?

CLIENT: No, I think we've covered everything. Thank you.

SOLICITOR: Thank you, Mr Patterson. I'll be in touch with the contract report within the fortnight.`;

  const [t3] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session3.id,
    content: transcript3Content,
    utterances: [
      { speaker: "A", text: "Good morning, Mr Patterson. Recording is on — you consent?", start: 0, end: 4000, confidence: 0.97 },
      { speaker: "B", text: "Yes.", start: 4500, end: 5000, confidence: 0.99 },
    ],
    speakerCount: 2,
    createdAt: session3Date,
  }).returning();

  const doc3Content = `# ATTENDANCE NOTE

**Client:** Richard Patterson (Patterson Developments Ltd)
**Matter:** Commercial Warehouse Acquisition — Stratford
**Reference:** DEMO_COMP/2024/0291
**Date:** ${session3Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Richard Patterson (Client / Director)
**Duration:** 1 hour 25 minutes

---

## 1. PURPOSE

Meeting to review the AML documentation received from client's accountants (Hargreaves & Co) and from the Jersey trustee (Bridgewater Trust Company), and to determine whether enhanced due diligence requirements have been satisfied.

## 2. CORPORATE STRUCTURE — VERIFIED

- Patterson Developments Ltd — verified via Companies House. Active. Accounts filed and up to date.
- Meridian Holdings Ltd — verified via Companies House. Active. 100% shareholder of Patterson Developments Ltd.
- Patterson Family Trust — trust deed dated March 2018. Beneficiaries: Richard Patterson, Catherine Patterson, two children. Trustee: Bridgewater Trust Company (Jersey). Registered with the Jersey Financial Services Commission — in good standing.

**Beneficial ownership is now fully transparent and verified.**

## 3. SOURCE OF FUNDS — VERIFIED

- Audited accounts for Patterson Developments Ltd (3 financial years) — cumulative retained profits exceed £1,200,000 contribution
- Source of funds report from Hargreaves & Co — traces funds from trading profits through company accounts
- Barclays commercial mortgage offer — £1,200,000 on standard commercial terms
- Inter-company loan (£200,000 from Meridian Holdings) — documentation reviewed, repayment confirmed

**Source of funds position: SATISFACTORY.**

## 4. AML DECISION

I am satisfied that the enhanced due diligence obligations under Regulation 33 of the Money Laundering Regulations 2017 have been met.

**AML Decision Record: CLEARED TO PROCEED**

Decision record HMAC-signed for audit integrity. Counter-signatory (Head of Compliance) to review and approve within 24 hours.

## 5. NEXT STEPS — CONVEYANCING

- Review draft contract and raise preliminary enquiries
- Report on title to client
- Target: exchange within 4–6 weeks
- Deposit on exchange: £240,000 (10% — from retained profits)
- Completion: 28 days after exchange (vendor preference, client agrees)

## 6. CLIENT CONFIRMATION

Client confirmed understanding. Instructed to proceed to heads of terms.

---
*AML Decision Record created. Counter-signatory approval pending.*`;

  await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session3.id,
    transcriptSnapshotId: t3.id,
    type: "attendance_note",
    content: doc3Content,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "approved",
    approvedBy: userId,
  });

  // --- Time entries ---
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: session1.id, userId, durationMinutes: 130, description: "Full meeting — Matter inception, AML screening, corporate structure review", hourlyRate: "320.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: session2.id, userId, durationMinutes: 18, description: "Telephone call — Documentation progress update", hourlyRate: "320.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: session3.id, userId, durationMinutes: 85, description: "Full meeting — AML review, EDD clearance determination", hourlyRate: "320.00", status: "confirmed" },
    { caseId: newCase.id, userId, durationMinutes: 180, description: "Due diligence review — Companies House verification, Jersey trust register, source of funds analysis", hourlyRate: "320.00", status: "confirmed" },
  ]);

  // --- External document references ---
  await db.insert(externalDocumentRefs).values([
    { caseId: newCase.id, createdBy: userId, description: "Certified copy of company formation documents for Patterson Developments Ltd — provided by client 14 January 2025, not stored, reference only", documentType: "Company formation documents", documentDate: daysAgo(14), providedBy: "Richard Patterson (client)" },
    { caseId: newCase.id, createdBy: userId, description: "Jersey trust register extract — provided by Bridgewater Trust Company 14 January 2025, not stored, reference only", documentType: "Trust register extract", documentDate: daysAgo(14), providedBy: "Bridgewater Trust Company (Jersey)" },
  ]);

  // --- AML Compliance Thread ---
  const signingKey = process.env.SESSION_SECRET || (process.env.NODE_ENV === "development" ? "demo-signing-key" : "");

  // Monitoring Note 1 — inception
  const mn1Date = new Date(session1Date.getTime() + 2 * 60 * 60 * 1000);
  await db.insert(amlMonitoringNotes).values({
    caseId: newCase.id, userId, recordType: "inception", riskLevel: "high",
    sourceOfFundsStatus: "Pending verification. £1.2m from retained profits (audited accounts required). £1.2m Barclays commercial mortgage (offer pending). Additional disclosure: £200k inter-company loan from Meridian Holdings (repaid). Bank statements declined by client — commercially sensitive.",
    eddDecision: "Required",
    eddReasoning: "Three-tier corporate structure with offshore Jersey trust. Beneficial ownership not fully transparent at inception. Client declined bank statement disclosure. Enhanced due diligence mandatory under Regulation 33 MLR 2017.",
    notes: "Matter Inception Record — Commercial warehouse acquisition (Unit 14, Meridian Industrial Estate, Stratford, £2.4m). Three AML concerns identified: (a) beneficial ownership not fully transparent via Jersey trust, (b) offshore trust cannot be immediately verified, (c) client declined bank statements citing commercial sensitivity. Client formally advised matter cannot proceed without satisfactory documentation. EDD file opened.",
    createdAt: mn1Date,
  });

  // Monitoring Note 2 — telephone call update
  const mn2Date = new Date(session2Date.getTime() + 30 * 60 * 1000);
  await db.insert(amlMonitoringNotes).values({
    caseId: newCase.id, userId, recordType: "monitoring", riskLevel: "high",
    sourceOfFundsStatus: "Awaiting documentation. Accountants (Hargreaves & Co) preparing source of funds report and audited accounts. Jersey trustee (Bridgewater) processing trust deed and beneficiary schedule — 5 working days. Client proposing certified letter in lieu of bank statements — position reserved.",
    notes: "Second monitoring note. Client called to confirm documentation in progress. Accountants preparing source of funds report. Jersey trustee requires internal sign-off (5 working days). Client proposed certified source of funds letter instead of bank statements — I reserved my position, noting SRA guidance requires underlying evidence. Continued concern about pace of disclosure.",
    createdAt: mn2Date,
  });

  // Monitoring Note 3 — clearance
  const mn3Date = new Date(session3Date.getTime() + 90 * 60 * 1000);
  await db.insert(amlMonitoringNotes).values({
    caseId: newCase.id, userId, recordType: "monitoring", riskLevel: "high",
    sourceOfFundsStatus: "VERIFIED. All documentation received and reviewed. Beneficial ownership fully transparent through Companies House and Jersey trust register. Source of funds confirmed via audited accounts and Hargreaves source of funds report. Barclays mortgage offer received. Inter-company loan documentation and repayment confirmed.",
    notes: "Final monitoring note prior to clearance decision. All enhanced due diligence documentation received and verified. Beneficial ownership transparent. Source of funds satisfactory. AML Decision Record to be created with 'cleared to proceed' determination.",
    createdAt: mn3Date,
  });

  // AML Decision Record — clearance
  const drDate = new Date(mn3Date.getTime() + 30 * 60 * 1000);
  const sigPayload = JSON.stringify({
    caseId: newCase.id, userId, decision: "proceed",
    concernDescription: "Enhanced due diligence required due to three-tier corporate structure with offshore Jersey trust, initial non-transparency of beneficial ownership, and client's initial refusal to provide bank statements.",
    decisionReasoning: "All concerns resolved. Beneficial ownership verified through Companies House and Jersey trust register. Source of funds confirmed via audited accounts and accountants' report. Matter cleared to proceed.",
    timestamp: drDate.toISOString(),
  });
  const signatureHash = crypto.createHmac("sha256", signingKey).update(sigPayload).digest("hex");

  await db.insert(amlDecisionRecords).values({
    caseId: newCase.id, userId,
    concernDescription: "Enhanced due diligence required due to three-tier corporate structure with offshore Jersey trust element. Three concerns identified at inception: (a) beneficial ownership not fully transparent, (b) offshore trust component could not be immediately verified, (c) client initially declined to provide bank statements. Matter subject to ongoing enhanced monitoring throughout due diligence period.",
    decision: "proceed",
    decisionReasoning: "Following receipt and review of all documentation, I am satisfied that the enhanced due diligence obligations under Regulation 33 of the Money Laundering Regulations 2017 have been met:\n\n1. Patterson Developments Ltd and Meridian Holdings Ltd verified via Companies House — both active, accounts filed.\n2. Patterson Family Trust verified via trust deed (March 2018) and Jersey Financial Services Commission registration.\n3. Beneficial ownership fully transparent: Richard Patterson, Catherine Patterson, and two children as beneficiaries.\n4. Source of funds verified: £1.2m retained profits confirmed by audited accounts and Hargreaves source of funds report; £1.2m Barclays commercial mortgage on standard terms.\n5. Inter-company loan (£200k) documentation reviewed, repayment confirmed.\n6. Bank statement issue resolved — source of funds report with audited accounts provides sufficient evidence.\n\nDecision: CLEARED TO PROCEED. Counter-signatory approval recorded.\nNo SAR required. Risk level maintained at HIGH for ongoing monitoring through to completion.",
    signatureHash,
    createdAt: drDate,
  });

  // --- Audit trail ---
  const auditEvents: Array<{ eventType: string; timestamp: Date; metadata: Record<string, unknown>; severity?: "info" | "warning" | "critical"; transcriptId?: string }> = [
    { eventType: "case_created", timestamp: daysAgo(35), metadata: { clientName: "Richard Patterson", practiceArea: "commercial_property" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(35).getTime() + 30 * 60 * 1000), metadata: { result: "clear", note: "No conflict identified" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(35).getTime() + 60 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "consent_given", timestamp: session1Date, metadata: { consentModality: "verbal_recorded", sessionType: "full_meeting" } },
    { eventType: "transcript_generated", timestamp: new Date(session1Date.getTime() + 130 * 60 * 1000), metadata: { speakerCount: 2 }, transcriptId: t1.id },
    { eventType: "document_generated", timestamp: new Date(session1Date.getTime() + 135 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "document_approved", timestamp: new Date(session1Date.getTime() + 180 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "aml_monitoring_note_created", timestamp: mn1Date, metadata: { recordType: "inception", riskLevel: "high" }, severity: "warning" as const },
    { eventType: "aml_monitoring_note_created", timestamp: mn2Date, metadata: { recordType: "monitoring", riskLevel: "high" }, severity: "warning" as const },
    { eventType: "transcript_generated", timestamp: new Date(session2Date.getTime() + 20 * 60 * 1000), metadata: { speakerCount: 2 }, transcriptId: t2.id },
    { eventType: "document_generated", timestamp: new Date(session2Date.getTime() + 22 * 60 * 1000), metadata: { documentType: "attendance_note", sessionType: "telephone_call" } },
    { eventType: "transcript_generated", timestamp: new Date(session3Date.getTime() + 90 * 60 * 1000), metadata: { speakerCount: 2 }, transcriptId: t3.id },
    { eventType: "document_generated", timestamp: new Date(session3Date.getTime() + 92 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "aml_monitoring_note_created", timestamp: mn3Date, metadata: { recordType: "monitoring", riskLevel: "high", note: "Pre-clearance final review" }, severity: "info" as const },
    { eventType: "aml_decision_recorded", timestamp: drDate, metadata: { decision: "proceed", signatureHash }, severity: "critical" as const },
  ];
  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({
      eventType: evt.eventType,
      userId,
      caseId: newCase.id,
      timestamp: evt.timestamp,
      severity: evt.severity || "info",
      metadata: evt.metadata,
      transcriptId: evt.transcriptId || null,
    });
  }
}

// ——— CASE 2: Sophie Henderson — Residential Conveyancing — Multi-Session ———

async function seedCase2Henderson(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Sophie Henderson",
    email: "sophie.henderson@gmail.com",
    phone: "07845 991 022",
    address: "Flat 6, 29 Westmoreland Terrace, Bath BA1 5HG",
    amlRiskLevel: "high",
    amlRiskLastReviewed: daysAgo(21),
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Purchase of 14 Ashfield Close, Bath",
    clientName: "Sophie Henderson",
    clientId: client.id,
    matterReference: "DEMO_CONV/2024/1147",
    createdBy: userId,
    status: "review_required",
    priority: "deadline-soon",
    sourceType: "audio",
    practiceArea: "residential_conveyancing",
    riskLevel: "high",
    conflictCheckCompleted: true,
    conflictCheckNote: "No conflict identified. Seller (Mr J. Fielding) not a client of this firm. Seller's solicitors (Blake Morgan) — no conflict.",
    reviewed: true,
    createdAt: daysAgo(21),
  }).returning() as Case[];

  // Session 1: Full meeting — Initial consultation (3 weeks ago, 55 min)
  const s1Date = daysAgoAt(21, 14, 0);
  const [ses1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting", startedAt: s1Date, durationSeconds: 3300, status: "completed",
    notes: "Initial consultation — residential purchase, first-time buyer", createdBy: userId,
  }).returning();

  await db.insert(consentLogs).values({
    caseId: newCase.id, solicitorId: userId, consentGiven: true, disclaimerScriptVersion: "v2.1", consentModality: "verbal_recorded",
  });

  const t1Content = `Meeting transcript — Residential Purchase, Initial Consultation

SOLICITOR: Good afternoon, Miss Henderson. This meeting is being recorded for accuracy purposes. Do you consent?

CLIENT: Yes, I do.

SOLICITOR: Thank you. So, you're purchasing 14 Ashfield Close, Bath — your first property purchase. Congratulations. Let me take you through the current position. I've reviewed the draft contract from the seller's solicitors, Blake Morgan. The property is registered freehold, Title Number ST245891. The title is clean — no restrictive covenants that would cause concern.

CLIENT: That's good to hear.

SOLICITOR: Now, the searches. The local authority search has come back clear. The environmental search shows no issues. There was a query on the drainage search — it initially showed that the property might not be connected to the public sewer. However, I raised an additional enquiry with Wessex Water and they've confirmed the property is connected. So that's resolved.

CLIENT: I was worried about that one. My parents mentioned it could be a problem.

SOLICITOR: It can be in rural areas, but this is fine. Now, let's talk about the finances. The purchase price is three hundred and eighty-five thousand pounds. Your mortgage offer from Nationwide is for three hundred and eight thousand. That leaves a deposit of seventy-seven thousand. Can you talk me through the source of the deposit?

CLIENT: Yes. I've saved fifty-two thousand pounds — I can show you the bank statements. The remaining twenty-five thousand is a gift from my parents.

SOLICITOR: I'll need to see your bank statements showing the savings, and I'll need a gift letter from your parents confirming that the twenty-five thousand is a gift, not a loan, and that they have no interest in the property. This is standard practice for both mortgage and AML purposes.

CLIENT: My parents have already prepared the letter. I've got it here actually.

SOLICITOR: Excellent. Let me take a copy. Now, SDLT — Stamp Duty Land Tax. As a first-time buyer purchasing below four hundred and twenty-five thousand, you're eligible for the first-time buyer relief. The SDLT on three hundred and eighty-five thousand with that relief comes to nine thousand, seven hundred and fifty pounds. That's payable on completion and I'll submit the return to HMRC.

CLIENT: Nine thousand seven hundred and fifty. OK, I've budgeted for that.

SOLICITOR: Good. Now, the mortgage offer has a condition — there's a valuation retention of two thousand five hundred pounds pending a roof inspection report. The surveyor flagged some potential issues with the ridge tiles. You'll need to get that inspection done before Nationwide will release the full advance.

CLIENT: I've already arranged that — the roofer is going next Tuesday.

SOLICITOR: Perfect. Once you have the report and it's clear, send it to me and I'll submit it to Nationwide. Now, fixtures and fittings. The current list from the seller includes curtains and carpets. Is there anything else you specifically want included?

CLIENT: Yes — there's a garden studio at the back of the property. It's a timber-frame structure, about three metres by four. I specifically want that included in the sale. It was one of the reasons I chose the property.

SOLICITOR: I'll add a specific enquiry about the garden studio and request that it's included on the TA10 fixtures list. If the seller tries to exclude it, we'll negotiate. Is there anything else?

CLIENT: No, that covers everything I wanted to ask about.

SOLICITOR: Good. Let me summarise the next steps. I'll send you a formal report on title within the next few days. Once we have the roof report and Nationwide releases the retention, we'll be in a position to exchange. I'd suggest we target exchange within the next two to three weeks.

CLIENT: That would be wonderful. Thank you so much.`;

  const [tr1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses1.id, content: t1Content,
    utterances: [
      { speaker: "A", text: "Good afternoon, Miss Henderson. This meeting is being recorded for accuracy purposes. Do you consent?", start: 0, end: 6000, confidence: 0.96 },
      { speaker: "B", text: "Yes, I do.", start: 6500, end: 8000, confidence: 0.98 },
    ],
    speakerCount: 2, createdAt: s1Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses1.id, transcriptSnapshotId: tr1.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Sophie Henderson
**Matter:** Purchase of 14 Ashfield Close, Bath, BA2 5NP
**Reference:** DEMO_CONV/2024/1147
**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Sophie Henderson (Client)
**Duration:** 55 minutes

---

## 1. RECORDING CONSENT

Consent obtained at commencement of meeting.

## 2. TITLE AND SEARCHES

- Property: 14 Ashfield Close, Bath, BA2 5NP — registered freehold, Title Number ST245891
- Title is clean — no restrictive covenants of concern
- Local authority search: clear
- Environmental search: no issues
- Drainage search: initial query regarding public sewer connection — resolved. Wessex Water confirmed property is connected.

## 3. FINANCIAL SUMMARY

| Item | Amount |
|------|--------|
| Purchase price | £385,000 |
| Mortgage offer (Nationwide) | £308,000 |
| Deposit required | £77,000 |
| — Client savings (bank statements provided) | £52,000 |
| — Parental gift (gift letter obtained) | £25,000 |
| SDLT (first-time buyer relief) | £9,750 |

## 4. SOURCE OF FUNDS — AML

- £52,000 savings: evidenced by bank statements (reviewed)
- £25,000 parental gift: gift letter obtained confirming no interest in property, funds are a gift not a loan
- AML check: SATISFIED

## 5. MORTGAGE CONDITIONS

Nationwide mortgage offer includes a valuation retention of £2,500 pending roof inspection report. Surveyor flagged potential issues with ridge tiles. Client has arranged roofer inspection for next Tuesday.

## 6. FIXTURES AND FITTINGS

- Current TA10 list includes: curtains and carpets
- Client specifically requests inclusion of garden studio (timber-frame, approx. 3m x 4m) — to be added to enquiries
- If seller attempts to exclude, negotiate

## 7. NEXT STEPS

**Solicitor Actions:**
1. Send report on title to client
2. Raise enquiry regarding garden studio on TA10
3. Submit roof inspection report to Nationwide once received
4. Target exchange within 2–3 weeks

**Client Actions:**
1. Obtain roof inspection report (Tuesday)
2. Forward report to solicitor

## 8. CLIENT CONFIRMATION

Client confirmed understanding of all matters discussed. No further questions at this stage.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Client care letter
  await db.insert(documents).values({
    caseId: newCase.id, type: "client_care_letter",
    content: `# CLIENT CARE LETTER\n\n**To:** Sophie Henderson\nFlat 6, 29 Westmoreland Terrace, Bath BA1 5HG\n\n**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n**Our Reference:** DEMO_CONV/2024/1147\n\n---\n\nDear Miss Henderson,\n\nThank you for instructing us in connection with your purchase of 14 Ashfield Close, Bath, BA2 5NP.\n\n## Scope of Work\n\nWe have been instructed to act on your behalf in connection with the purchase of the above property at a price of £385,000. Our work will include reviewing title, carrying out searches, reporting on the mortgage conditions, dealing with exchange and completion, and attending to all post-completion matters including Land Registry registration and SDLT submission.\n\n## Fees\n\nOur charges for this conveyancing matter will be £1,650 plus VAT (£1,980 inclusive). Disbursements (searches, Land Registry fees, bank transfer fees) are estimated at £500–£700.\n\nYours sincerely,\n\n**Attending Solicitor**\nConveyancing Department`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId, createdAt: s1Date,
  });

  await db.update(cases).set({ clientCareLetterSentAt: s1Date }).where(eq(cases.id, newCase.id));

  // Session 2: Telephone call (4 days ago, 7 min)
  const s2Date = daysAgoAt(4, 11, 14);
  const [ses2] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "telephone_call", startedAt: s2Date, durationSeconds: 420, status: "completed",
    notes: "Telephone call — roof report confirmed, instruction to proceed to exchange", createdBy: userId,
  }).returning();

  const t2Content = `Telephone call transcript — Henderson purchase

SOLICITOR: Good morning, Miss Henderson. This call is being recorded — is that alright?

CLIENT: Yes, fine. I'm calling about the roof report.

SOLICITOR: Go ahead.

CLIENT: The roofer went out on Tuesday as planned. He confirmed the ridge tiles are in good condition — there was some minor moss growth but nothing structural. He's provided a written report confirming the roof is satisfactory.

SOLICITOR: That's excellent news. Can you email the report to me today?

CLIENT: I've already sent it — should be in your inbox.

SOLICITOR: Let me check. Yes, I have it. I'll forward this to Nationwide today and request release of the retention. Once that's confirmed, we'll be in a position to exchange. Can I take your instructions to proceed to exchange?

CLIENT: Yes, please go ahead. I'd like to exchange as soon as possible.

SOLICITOR: Understood. I'll contact Blake Morgan to agree an exchange date. We're targeting Friday the twenty-first. I'll confirm once everything is in place.

CLIENT: Perfect. Thank you.

SOLICITOR: Thank you, Miss Henderson. I'll be in touch.`;

  const [tr2] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses2.id, content: t2Content,
    utterances: [
      { speaker: "A", text: "Good morning, Miss Henderson. This call is being recorded — is that alright?", start: 0, end: 5000, confidence: 0.96 },
      { speaker: "B", text: "Yes, fine. I'm calling about the roof report.", start: 5500, end: 8000, confidence: 0.97 },
    ],
    speakerCount: 2, createdAt: s2Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses2.id, transcriptSnapshotId: tr2.id,
    type: "attendance_note",
    content: `# TELEPHONE ATTENDANCE NOTE

**Client:** Sophie Henderson
**Matter:** Purchase of 14 Ashfield Close, Bath
**Reference:** DEMO_CONV/2024/1147
**Date:** ${s2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Time:** 11:14am
**Duration:** 7 minutes
**Type:** Incoming call from client

---

Call received from Miss Henderson. Client confirmed roof inspection report satisfactory — ridge tiles in good condition, minor moss growth only, no structural issues. Written report provided by roofer (received by email). Report to be forwarded to Nationwide today to request release of valuation retention (£2,500). Client instructed to proceed to exchange. Agreed exchange target: Friday 21st. Solicitor to contact seller's solicitors (Blake Morgan) to confirm.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Undertaking — outstanding
  await db.insert(undertakings).values({
    caseId: newCase.id, meetingSessionId: ses1.id,
    wording: "We undertake to exchange contracts within 5 working days of receipt of the signed contract and deposit funds from our client.",
    speaker: "Solicitor",
    sourceQuote: "I'd suggest we target exchange within the next two to three weeks.",
    deadline: daysAgo(-3),
    status: "outstanding",
    dateGiven: s1Date,
    createdAt: s1Date,
  });

  // Time entries
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: ses1.id, userId, durationMinutes: 54, description: "Full meeting — Initial consultation, contract review, search results, source of funds", hourlyRate: "220.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: ses2.id, userId, durationMinutes: 6, description: "Telephone call — Roof report confirmation, instruction to exchange", hourlyRate: "220.00", status: "confirmed" },
    { caseId: newCase.id, userId, durationMinutes: 90, description: "File review — Title report preparation, search analysis, mortgage conditions review", hourlyRate: "220.00", status: "confirmed" },
  ]);

  // Audit trail
  const auditEvents = [
    { eventType: "case_created", timestamp: daysAgo(21), metadata: { clientName: "Sophie Henderson", practiceArea: "residential_conveyancing" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(21).getTime() + 30 * 60 * 1000), metadata: { result: "clear", note: "No conflict identified" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(21).getTime() + 60 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "consent_given", timestamp: s1Date, metadata: { consentModality: "verbal_recorded" } },
    { eventType: "transcript_generated", timestamp: new Date(s1Date.getTime() + 60 * 60 * 1000), metadata: { speakerCount: 2 } },
    { eventType: "document_generated", timestamp: new Date(s1Date.getTime() + 65 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "document_approved", timestamp: new Date(s1Date.getTime() + 90 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "transcript_generated", timestamp: new Date(s2Date.getTime() + 10 * 60 * 1000), metadata: { speakerCount: 2 } },
    { eventType: "document_generated", timestamp: new Date(s2Date.getTime() + 12 * 60 * 1000), metadata: { documentType: "attendance_note", sessionType: "telephone_call" } },
  ];
  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: "info", metadata: evt.metadata });
  }
}

// ——— CASE 3: Daniel Hartley — Employment (Employee) — Undertakings Showcase ———

async function seedCase3Hartley(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Daniel Hartley",
    email: "d.hartley@protonmail.com",
    phone: "07712 308 441",
    address: "22 Birchwood Avenue, Reading, RG1 4PX",
    amlRiskLevel: "medium",
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Constructive Dismissal Claim — Hartley v TechLogic Solutions Ltd",
    clientName: "Daniel Hartley",
    clientId: client.id,
    matterReference: "DEMO_EMP/2024/0889",
    createdBy: userId,
    status: "review_required",
    priority: "urgent",
    sourceType: "audio",
    practiceArea: "employment_employee",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "No conflict. TechLogic Solutions Ltd not a client. No connection to respondent.",
    reviewed: true,
    createdAt: daysAgo(35),
  }).returning() as Case[];

  // Session 1: Full meeting — Initial consultation (5 weeks ago, 1h 40m)
  const s1Date = daysAgoAt(35, 10, 0);
  const [ses1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting", startedAt: s1Date, durationSeconds: 6000, status: "completed",
    notes: "Initial consultation — constructive dismissal claim", createdBy: userId,
  }).returning();

  await db.insert(consentLogs).values({ caseId: newCase.id, solicitorId: userId, consentGiven: true, disclaimerScriptVersion: "v2.1", consentModality: "verbal_recorded" });

  const t1Content = `Meeting transcript — Constructive Dismissal, Initial Consultation

SOLICITOR: Good morning, Mr Hartley. I'm recording this meeting for accuracy — do you consent?

CLIENT: Yes, I do.

SOLICITOR: Thank you. You've told me you resigned from TechLogic Solutions Limited after seven years as Senior Systems Engineer. You're characterising this as constructive dismissal. I need to hear the full factual background.

CLIENT: Yes. I'd been at TechLogic since 2017. For the first five years, everything was fine — good reviews, promoted to Senior Systems Engineer in 2019. Things started going wrong about eight months before I resigned.

SOLICITOR: Talk me through what happened over those eight months.

CLIENT: It started when we got a new CTO — Mark Salter. From day one, he seemed to have a problem with me. First, he excluded me from the weekly architecture meetings. These were meetings I'd attended for three years — I was the most senior systems engineer on the team. He told me they were "restructuring the attendee list."

SOLICITOR: Did he give a reason?

CLIENT: No. When I asked, he said it was a "strategic decision." Two months later, he reassigned my two direct reports to another team lead without discussing it with me. My role was effectively demoted without any formal process or consultation.

SOLICITOR: Was there any documentation of this change?

CLIENT: Nothing formal. No letter, no meeting, no HR involvement. I found out when my reports told me they'd been reassigned. A month after that, I raised a formal grievance through HR about the exclusion from meetings and the removal of my reports. HR acknowledged the grievance but the investigation was — frankly — a sham. They spoke to Salter, he denied everything, and they closed it within a week. No notes, no witness statements, no appeal offered.

SOLICITOR: Did you receive the outcome in writing?

CLIENT: Just an email. One paragraph. "Having investigated your concerns, we are satisfied that no further action is required."

SOLICITOR: I see. What happened after the grievance was dismissed?

CLIENT: It got worse. Salter started excluding me from the Slack channels where technical decisions were made. Then he moved my desk to a different floor — away from the rest of the engineering team. The final straw was when he announced at a company meeting that they were "bringing in a new technical lead" for the project I'd been running for eighteen months. He didn't tell me beforehand. I heard about it in the same meeting as the interns.

SOLICITOR: And that's when you resigned?

CLIENT: Not immediately. I took two days to think about it. Then I resigned by email, citing the sustained course of conduct as making my position untenable.

SOLICITOR: Good. Now, let me explain the legal framework. Under section 95(1)(c) of the Employment Rights Act 1996, an employee is treated as dismissed if they terminate the contract — with or without notice — in circumstances where they're entitled to terminate without notice by reason of the employer's conduct. That's constructive dismissal. The test is whether the employer committed a fundamental breach of the implied term of mutual trust and confidence.

CLIENT: And do you think what happened to me meets that test?

SOLICITOR: Based on what you've told me, I'd assess your prospects as reasonable to good. The sustained course of conduct over eight months — exclusion from meetings, effective demotion, inadequate grievance investigation, physical isolation, and public humiliation — is exactly the kind of pattern that tribunals recognise as a breach of mutual trust and confidence. The key is that you didn't delay too long after the final incident before resigning.

CLIENT: I resigned within two days of the company meeting.

SOLICITOR: That's good. Delay can be fatal to a constructive dismissal claim because it can be treated as affirmation of the breach. Two days is well within acceptable limits. Now, the ACAS early conciliation certificate — have you obtained one?

CLIENT: Yes, I went through the process last week. I have the certificate here.

SOLICITOR: Good. That's a prerequisite to filing the ET1. Now, let me go through the schedule of loss. Your annual salary was twenty-eight thousand, four hundred and forty-eight pounds.

CLIENT: That's right.

SOLICITOR: The basic award is calculated using the statutory formula: one week's pay for each complete year of service where you were aged between twenty-two and forty. You're thirty-four and have seven complete years. The statutory weekly cap is five hundred and forty-four pounds. So the basic award is seven weeks times five hundred and forty-four — that's three thousand, eight hundred and eight pounds.

CLIENT: OK.

SOLICITOR: The compensatory award is where the significant value lies. Your net monthly salary was approximately two thousand, one hundred. If the tribunal awards nine months' future loss — which is a realistic estimate given the current employment market for your skillset — that's approximately eighteen thousand, nine hundred. Adding notice pay — you were entitled to seven weeks' notice, so that's approximately five thousand, four hundred and forty-five pounds based on your gross weekly salary of approximately seven hundred and seventy-eight. Plus accrued but untaken holiday — how many days?

CLIENT: Eight days.

SOLICITOR: That adds approximately one thousand, seven hundred and fifty pounds. So the total schedule of loss comes to approximately thirty-one thousand, four hundred and fifty pounds. I'll draft this formally for filing with the ET1.

CLIENT: That's more than I expected, honestly.

SOLICITOR: The compensatory award can be substantial when future loss is properly quantified. Now, I need you to do three things before our next meeting. First, obtain all written correspondence from TechLogic — emails, Slack messages, the grievance outcome email. Second, provide your payslips for the last three months. Third, sign the ACAS early conciliation form if you haven't already.

CLIENT: I'll get all of that together this week.

SOLICITOR: Good. We'll meet again in two weeks to review the draft ET1 and finalise the schedule of loss. Any questions?

CLIENT: No, thank you. I feel much better having a clear picture of where I stand.`;

  const [tr1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses1.id, content: t1Content,
    utterances: [
      { speaker: "A", text: "Good morning, Mr Hartley. I'm recording this meeting for accuracy — do you consent?", start: 0, end: 5000, confidence: 0.96 },
      { speaker: "B", text: "Yes, I do.", start: 5500, end: 7000, confidence: 0.98 },
    ],
    speakerCount: 2, createdAt: s1Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses1.id, transcriptSnapshotId: tr1.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Daniel Hartley
**Matter:** Constructive Dismissal Claim — Hartley v TechLogic Solutions Ltd
**Reference:** DEMO_EMP/2024/0889
**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Daniel Hartley (Client)
**Duration:** 1 hour 40 minutes

---

## 1. BACKGROUND

Client employed for 7 years as Senior Systems Engineer at TechLogic Solutions Ltd (promoted 2019). Resigned citing sustained course of conduct by new CTO (Mark Salter) over approximately 8 months.

## 2. FACTUAL CHRONOLOGY

1. Excluded from weekly architecture meetings (attended for 3 years) — "restructuring attendee list"
2. Two direct reports reassigned to another team lead without consultation or documentation
3. Formal grievance raised through HR — inadequately investigated. Outcome: one-paragraph email dismissing concerns. No witness statements, no notes, no appeal offered.
4. Excluded from Slack channels where technical decisions were made
5. Desk moved to different floor — physical isolation from engineering team
6. CTO announced replacement technical lead for client's project at company meeting without prior notification

Client resigned by email within 2 days of final incident, citing sustained course of conduct as making his position untenable.

## 3. LEGAL ASSESSMENT

**Claim:** Constructive dismissal under section 95(1)(c) Employment Rights Act 1996

**Test:** Whether employer committed a fundamental breach of the implied term of mutual trust and confidence (Malik v Bank of Credit and Commerce International [1998] AC 20).

**Assessment:** Prospects are reasonable to good. Sustained pattern of conduct over 8 months — exclusion, effective demotion, inadequate grievance process, isolation, public humiliation — is consistent with breach of mutual trust and confidence. Client resigned promptly (2 days) — no risk of affirmation argument.

**ACAS:** Early conciliation certificate obtained (prerequisite for ET1).

## 4. SCHEDULE OF LOSS

| Head of Loss | Amount |
|-------------|--------|
| Basic Award (7 years x 1 week x £544 cap) | £3,808 |
| Compensatory Award — future loss (9 months x £2,100 net) | £18,900 |
| Notice pay (7 weeks x £778 gross) | £5,445 |
| Accrued holiday (8 days) | £1,750 |
| **Estimated Total** | **£31,450** |

*Note: Compensatory award subject to adjustment based on actual mitigation efforts and tribunal assessment of future loss period.*

## 5. NEXT STEPS

**Solicitor Actions:**
1. Draft ET1 and particulars of claim
2. Prepare formal schedule of loss

**Client Actions:**
1. Obtain all written correspondence from TechLogic (emails, Slack messages, grievance outcome)
2. Provide payslips (last 3 months)
3. Sign ACAS form

**Next meeting:** In 2 weeks — review draft ET1 and finalise schedule of loss.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Client care letter
  await db.insert(documents).values({
    caseId: newCase.id, type: "client_care_letter",
    content: `# CLIENT CARE LETTER\n\n**To:** Daniel Hartley\n22 Birchwood Avenue, Reading, RG1 4PX\n\n**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n**Our Reference:** DEMO_EMP/2024/0889\n\n---\n\nDear Mr Hartley,\n\nThank you for instructing us in connection with your employment claim against TechLogic Solutions Ltd.\n\n## Scope of Work\n\nWe are instructed to advise and represent you in connection with a claim for constructive dismissal before the Employment Tribunal.\n\n## Fees\n\nOur hourly rate for this matter is £195 plus VAT.\n\nYours sincerely,\n\n**Attending Solicitor**\nEmployment Department`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId, createdAt: s1Date,
  });
  await db.update(cases).set({ clientCareLetterSentAt: s1Date }).where(eq(cases.id, newCase.id));

  // Session 2: Full meeting — Strategy review and ET1 sign-off (1 week ago, 50 min)
  const s2Date = daysAgoAt(7, 14, 30);
  const [ses2] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting", startedAt: s2Date, durationSeconds: 3000, status: "completed",
    notes: "Strategy review — ET1 sign-off, schedule of loss finalised", createdBy: userId,
  }).returning();

  const t2Content = `Meeting transcript — ET1 Review and Sign-Off

SOLICITOR: Good afternoon, Mr Hartley. Recording is on — you consent?

CLIENT: Yes.

SOLICITOR: Thank you. I've drafted the ET1 and the particulars of claim. Let me take you through it. The particulars set out the sustained detriment narrative in chronological order — from the exclusion from architecture meetings through to the announcement of your replacement at the company meeting. I've included specific dates where you've been able to provide them, and I've referenced the grievance process and its inadequacy.

CLIENT: I've read through the draft. I think it's very thorough. There's one thing I wanted to add — Salter also refused to approve my request for training that had been pre-approved by my previous manager. That happened about four months before I resigned.

SOLICITOR: Good point. I'll add that to the particulars. It strengthens the pattern of sustained detriment. Now, the schedule of loss — I've finalised it at thirty-one thousand, four hundred and fifty pounds, broken down as we discussed. The respondent details are confirmed — TechLogic Solutions Limited, registered office at Innovation House, Thames Valley Park, Reading.

CLIENT: That's correct.

SOLICITOR: Good. I need your formal instructions to file the ET1. Are you content to proceed?

CLIENT: Yes, absolutely. Please go ahead and file it.

SOLICITOR: Understood. I'll file the ET1 this week. Once the tribunal acknowledges receipt, we'll receive a case number and the respondent will have twenty-eight days to file an ET3 response. I should also mention — I'm giving an undertaking to serve the schedule of loss on the respondent within three working days of filing the ET1. This is standard practice.

CLIENT: That's fine.

SOLICITOR: Now, one more thing. There's always a possibility that TechLogic's solicitors may make an early approach for settlement through ACAS. If they do, we should discuss it, but my advice would be not to settle for less than the full schedule of loss unless there's a compelling reason. Your case is strong.

CLIENT: Agreed. I'm not looking to settle cheaply.

SOLICITOR: Good. I'll be in touch once the ET1 is filed. Any other questions?

CLIENT: No, I'm happy to proceed. Thank you.`;

  const [tr2] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses2.id, content: t2Content,
    utterances: [
      { speaker: "A", text: "Good afternoon, Mr Hartley. Recording is on — you consent?", start: 0, end: 4000, confidence: 0.96 },
      { speaker: "B", text: "Yes.", start: 4500, end: 5000, confidence: 0.99 },
    ],
    speakerCount: 2, createdAt: s2Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses2.id, transcriptSnapshotId: tr2.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Daniel Hartley
**Matter:** Constructive Dismissal Claim — Hartley v TechLogic Solutions Ltd
**Reference:** DEMO_EMP/2024/0889
**Date:** ${s2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Daniel Hartley (Client)
**Duration:** 50 minutes

---

## 1. ET1 REVIEW

Draft ET1 and particulars of claim reviewed with client. Particulars cover the sustained detriment narrative in chronological order. Client approved the draft and requested one addition: refusal of pre-approved training request approximately 4 months before resignation (to be added to strengthen the pattern).

## 2. SCHEDULE OF LOSS

Finalised at £31,450. Respondent details confirmed: TechLogic Solutions Ltd, Innovation House, Thames Valley Park, Reading.

## 3. CLIENT INSTRUCTIONS

Client confirmed instructions to file ET1 this week.

## 4. UNDERTAKING

I gave an undertaking to serve the schedule of loss on the respondent within 3 working days of filing the ET1.

## 5. NEXT STEPS

- File ET1 this week
- Await tribunal acknowledgement and case number
- Respondent has 28 days to file ET3 response
- Monitor for early settlement approach from respondent via ACAS

Client does not wish to settle for less than the full schedule of loss unless there is a compelling reason.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Undertaking — discharged
  const dischargeDate = daysAgo(4);
  await db.insert(undertakings).values({
    caseId: newCase.id, meetingSessionId: ses2.id,
    wording: "I undertake to serve the schedule of loss on the respondent within 3 working days of filing the ET1.",
    speaker: "Solicitor",
    sourceQuote: "I'm giving an undertaking to serve the schedule of loss on the respondent within three working days of filing the ET1.",
    deadline: daysAgo(4),
    status: "discharged",
    confirmedBy: userId,
    confirmedAt: s2Date,
    dischargedAt: dischargeDate,
    dischargedBy: userId,
    dischargeNote: "Schedule of loss served on respondent's solicitors by email and first-class post on " + dischargeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ". Confirmation of service on file.",
    dateGiven: s2Date,
    createdAt: s2Date,
  });

  // Time entries
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: ses1.id, userId, durationMinutes: 102, description: "Full meeting — Initial consultation, factual background, legal assessment, schedule of loss", hourlyRate: "195.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: ses2.id, userId, durationMinutes: 48, description: "Full meeting — ET1 review and sign-off, schedule of loss finalised", hourlyRate: "195.00", status: "confirmed" },
    { caseId: newCase.id, userId, durationMinutes: 150, description: "ET1 drafting — Particulars of claim, schedule of loss, respondent details", hourlyRate: "195.00", status: "confirmed" },
  ]);

  // Audit trail
  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(35), metadata: { clientName: "Daniel Hartley", practiceArea: "employment_employee" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(35).getTime() + 30 * 60 * 1000), metadata: { result: "clear", note: "No conflict with TechLogic Solutions Ltd" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(35).getTime() + 60 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "consent_given", timestamp: s1Date, metadata: { consentModality: "verbal_recorded" } },
    { eventType: "transcript_generated", timestamp: new Date(s1Date.getTime() + 90 * 60 * 1000), metadata: { speakerCount: 2 } },
    { eventType: "document_generated", timestamp: new Date(s1Date.getTime() + 100 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "document_approved", timestamp: new Date(s1Date.getTime() + 120 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "transcript_generated", timestamp: new Date(s2Date.getTime() + 50 * 60 * 1000), metadata: { speakerCount: 2 } },
    { eventType: "document_generated", timestamp: new Date(s2Date.getTime() + 55 * 60 * 1000), metadata: { documentType: "attendance_note" } },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: "info", metadata: evt.metadata });
  }
}

// ——— CASE 4: Yasmin Okafor — Family (Children / Arrangements) — Multi-Format ———

async function seedCase4Okafor(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Yasmin Okafor",
    email: "yasminokafor@outlook.com",
    phone: "07443 587 109",
    address: "38 Redland Park, Bristol, BS6 6SA",
    amlRiskLevel: "medium",
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Child Arrangements Order — Okafor",
    clientName: "Yasmin Okafor",
    clientId: client.id,
    matterReference: "DEMO_FAM/2024/0534",
    createdBy: userId,
    status: "review_required",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "family_children_arrangements",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Checked against client register. Michael Okafor (respondent) not a client of this firm. No conflict identified.",
    reviewed: true,
    createdAt: daysAgo(42),
  }).returning() as Case[];

  // Session 1: Full meeting — Initial consultation (6 weeks ago, 1h 15m)
  const s1Date = daysAgoAt(42, 10, 0);
  const [ses1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting", startedAt: s1Date, durationSeconds: 4500, status: "completed",
    notes: "Initial consultation — Child Arrangements Order application", createdBy: userId,
  }).returning();

  await db.insert(consentLogs).values({ caseId: newCase.id, solicitorId: userId, consentGiven: true, disclaimerScriptVersion: "v2.1", consentModality: "verbal_recorded" });

  const t1Content = `Meeting transcript — Child Arrangements, Initial Consultation

SOLICITOR: Good morning, Mrs Okafor. Before we begin, I need to let you know that I'm recording this meeting so that I can prepare an accurate attendance note afterwards. This is standard practice. Given the sensitive nature of family proceedings, I want to explain that the recording is used solely for note-taking purposes and is not shared with anyone outside this firm. Do you consent to the recording?

CLIENT: Yes, I understand. That's fine.

SOLICITOR: Thank you. Now, I understand you've separated from your partner and you're seeking a Child Arrangements Order. Can you tell me about the family situation?

CLIENT: Michael and I separated about eight months ago. We have two children — Amara, who's nine, and Kofi, who's six. For the first few months after the separation, we managed to agree an informal arrangement. The children lived with me during the week and spent alternate weekends with Michael. But it's broken down over the last two months.

SOLICITOR: What happened?

CLIENT: Michael started cancelling weekends at short notice — sometimes the night before. The children were getting upset because they'd be expecting to see their dad and then he wouldn't turn up. Then he started insisting on having the children on school nights, which was disrupting their routine. When I tried to discuss it, he became hostile.

SOLICITOR: Has there been any domestic abuse or any concerns about the children's safety with their father?

CLIENT: No, nothing like that. He's a good father when he's present. The problem is reliability and communication between us, not safety.

SOLICITOR: That's an important distinction. Now, let me explain the legal framework. The court's paramount consideration is the welfare of the children — that's section 1 of the Children Act 1989. The court uses the welfare checklist to assess what arrangement best serves the children's interests. The court strongly prefers arrangements agreed between parents, and it will want to see that you've attempted mediation before making an application.

CLIENT: I attended a MIAM — a mediation information and assessment meeting — two weeks ago. I have the certificate. Michael refused to attend mediation.

SOLICITOR: Good — the MIAM certificate is a prerequisite for the court application. Michael's refusal to mediate is noted, but it won't count against you. Now, what outcome are you seeking?

CLIENT: I want a clear arrangement that gives the children stability. I'd like them to live with me during the week and spend alternate weekends with Michael — Friday after school to Sunday evening. I'd also like to formalise school holiday arrangements — a week each during half-terms and two weeks each during summer.

SOLICITOR: That's a very reasonable starting point. The court is likely to view shared care favourably, and what you're proposing gives the children a stable base during the school week while maintaining a meaningful relationship with their father. I'd advise against seeking a Prohibited Steps Order at this stage — there's nothing in what you've described that would justify restricting Michael's contact.

CLIENT: I agree. I don't want to restrict his contact. I just want it to be predictable.

SOLICITOR: Understood. I'll prepare and file a Form C100 application for a Child Arrangements Order. The court will list a First Hearing Dispute Resolution Appointment — usually within four to eight weeks. Before that hearing, CAFCASS will make initial safeguarding checks.

CLIENT: What happens at the first hearing?

SOLICITOR: The purpose of the FHDRA is to explore whether an agreement can be reached. If Michael attends and is willing to negotiate, we may be able to agree the arrangements by consent at that hearing. If not, the court will give directions — typically ordering a CAFCASS Section 7 welfare report — and list a further hearing.

CLIENT: And how long does the whole process take?

SOLICITOR: If an agreement is reached at the FHDRA, it could be resolved within two to three months. If it's contested and a Section 7 report is needed, you're looking at five to seven months. I'll keep you informed at every stage.

CLIENT: Thank you. I just want what's best for the children.`;

  const [tr1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses1.id, content: t1Content,
    utterances: [
      { speaker: "A", text: "Good morning, Mrs Okafor. Before we begin, I need to let you know that I'm recording this meeting...", start: 0, end: 18000, confidence: 0.95 },
      { speaker: "B", text: "Yes, I understand. That's fine.", start: 18500, end: 21000, confidence: 0.97 },
    ],
    speakerCount: 2, createdAt: s1Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses1.id, transcriptSnapshotId: tr1.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Yasmin Okafor
**Matter:** Child Arrangements Order — Okafor
**Reference:** DEMO_FAM/2024/0534
**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Present:** Attending Solicitor, Yasmin Okafor (Client)
**Duration:** 1 hour 15 minutes

---

## 1. RECORDING CONSENT

Consent obtained. I explained the recording is used solely for note-taking and is not shared outside the firm, given the sensitive nature of family proceedings.

## 2. FAMILY BACKGROUND

- Separated from partner (Michael Okafor) approximately 8 months ago
- Children: Amara (age 9), Kofi (age 6)
- Informal arrangement (children with mother weekdays, alternate weekends with father) worked for first 6 months
- Arrangement broke down over last 2 months: father cancelling weekends at short notice, children upset, father then insisting on school nights, hostile communication
- No domestic abuse concerns. No child safety concerns. Father described as "good father when present."

## 3. MIAM

MIAM certificate obtained (attended 2 weeks ago). Michael Okafor refused to attend mediation.

## 4. LEGAL ADVICE

- Paramount consideration: welfare of the children (s.1 Children Act 1989)
- Welfare checklist applies
- Court strongly prefers parental agreement
- Prohibited Steps Order not appropriate at this stage — no safety concerns

## 5. CLIENT'S PROPOSED ARRANGEMENT

- **Term time:** Children live with mother. Alternate weekends with father (Friday after school to Sunday evening).
- **School holidays:** One week each during half-terms. Two weeks each during summer.
- **Assessment:** Reasonable proposal. Court likely to view shared care favourably.

## 6. PROCEDURE

1. File Form C100 application
2. CAFCASS safeguarding checks
3. First Hearing Dispute Resolution Appointment (FHDRA) — within 4–8 weeks
4. If agreement reached at FHDRA: consent order (2–3 months total)
5. If contested: Section 7 CAFCASS report directed, further hearing (5–7 months total)

## 7. NEXT STEPS

**Solicitor Actions:**
1. Prepare and file Form C100
2. Advise client on CAFCASS process

**Client Actions:**
1. Provide MIAM certificate (provided at meeting)`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Client care letter
  await db.insert(documents).values({
    caseId: newCase.id, type: "client_care_letter",
    content: `# CLIENT CARE LETTER\n\n**To:** Yasmin Okafor\n38 Redland Park, Bristol, BS6 6SA\n\n**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n**Our Reference:** DEMO_FAM/2024/0534\n\n---\n\nDear Mrs Okafor,\n\nThank you for instructing us in connection with your application for a Child Arrangements Order.\n\n## Fees\n\nOur hourly rate is £210 plus VAT.\n\nYours sincerely,\n\n**Attending Solicitor**\nFamily Department`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId, createdAt: s1Date,
  });
  await db.update(cases).set({ clientCareLetterSentAt: s1Date }).where(eq(cases.id, newCase.id));

  // Session 2: Telephone call (2 weeks ago, 12 min)
  const s2Date = daysAgoAt(14, 15, 22);
  const [ses2] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "telephone_call", startedAt: s2Date, durationSeconds: 720, status: "completed",
    notes: "Telephone call — CAFCASS allocation notification", createdBy: userId,
  }).returning();

  const t2Content = `Telephone call transcript — Okafor CAFCASS update

SOLICITOR: Good afternoon, Mrs Okafor. Recording is on — you consent?

CLIENT: Yes.

SOLICITOR: Thank you. What can I help with?

CLIENT: I've received a letter from CAFCASS. They've allocated an officer to our case — a J. Mercer. They want to arrange a first contact appointment.

SOLICITOR: Good — that's the standard process. The CAFCASS officer will want to speak to you and to Michael separately as part of the safeguarding checks. It's usually a telephone call lasting about twenty to thirty minutes. They'll ask about the children, the current arrangements, and any concerns you have. Just be honest and straightforward — there's no need to exaggerate or understate anything.

CLIENT: And after that?

SOLICITOR: After the initial contact, CAFCASS will file a safeguarding letter with the court before the FHDRA. If the court directs a full Section 7 report — which I expect it will, given that Michael isn't engaging with mediation — then Officer Mercer will carry out a more thorough assessment. That usually involves home visits and speaking to the children.

CLIENT: OK, I'll arrange the appointment. Thank you.

SOLICITOR: You're welcome. Let me know the date once it's confirmed.`;

  const [tr2] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses2.id, content: t2Content,
    utterances: [
      { speaker: "A", text: "Good afternoon, Mrs Okafor. Recording is on — you consent?", start: 0, end: 4000, confidence: 0.96 },
      { speaker: "B", text: "Yes.", start: 4500, end: 5000, confidence: 0.99 },
    ],
    speakerCount: 2, createdAt: s2Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses2.id, transcriptSnapshotId: tr2.id,
    type: "attendance_note",
    content: `# TELEPHONE ATTENDANCE NOTE

**Client:** Yasmin Okafor
**Matter:** Child Arrangements Order — Okafor
**Reference:** DEMO_FAM/2024/0534
**Date:** ${s2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Time:** 3:22pm
**Duration:** 12 minutes
**Type:** Incoming call from client

---

Call received from Mrs Okafor. CAFCASS officer allocated: J. Mercer. First contact appointment to be arranged. Advised client on what to expect from CAFCASS initial contact — telephone call (20–30 minutes), questions about children and current arrangements, be honest and straightforward. CAFCASS will file safeguarding letter with court before FHDRA. If Section 7 report directed, Officer Mercer will conduct full assessment including home visits.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Session 3: Court hearing (5 days ago, Bristol Family Court)
  const s3Date = daysAgoAt(5, 10, 0);
  const [ses3] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "court_hearing", startedAt: s3Date, durationSeconds: 2100, status: "completed",
    notes: "FHDRA — Bristol Family Court — District Judge Pemberton", createdBy: userId,
  }).returning();

  const [tr3] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses3.id,
    content: `Court attendance — FHDRA — Bristol Family Court

Matter: Child Arrangements Order — Okafor v Okafor. Before District Judge Pemberton. Applicant represented by attending solicitor. Respondent appeared in person as litigant in person.

CAFCASS safeguarding letter filed. No safeguarding concerns identified for either parent. CAFCASS officer J. Mercer not present but available by telephone if required.

DJ Pemberton explored possibility of agreement at this hearing. Respondent confirmed desire for regular contact with children but stated inability to commit to fixed alternate weekend pattern due to shift work. Applicant expressed willingness to accommodate shift patterns provided arrangements agreed in advance and communicated to children.

DJ Pemberton noted absence of welfare concerns and clear desire of both parents to maintain children's relationships. Given respondent's position on flexibility, DJ Pemberton concluded that full CAFCASS Section 7 welfare report necessary to recommend workable arrangement.

Orders made: (1) CAFCASS Section 7 report directed, to be filed by 14 March; (2) Respondent to file statement of shift pattern (last 6 months) within 14 days; (3) Interim arrangement confirmed by consent — children to live with applicant, contact with respondent on alternate Saturdays 10am–6pm pending final order.

Next hearing: Dispute Resolution Appointment, 28 March, 10:30am, Bristol Family Court. Estimated duration 1 hour.

No order as to costs (standard in children proceedings).`,
    utterances: [],
    speakerCount: 1, createdAt: s3Date,
  }).returning();

  // Court attendance note — completely different format
  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses3.id, transcriptSnapshotId: tr3.id,
    type: "attendance_note",
    content: `# COURT ATTENDANCE NOTE

**Matter:** Child Arrangements Order — Okafor
**Reference:** DEMO_FAM/2024/0534

---

| | |
|---|---|
| **Hearing type** | First Hearing Dispute Resolution Appointment (FHDRA) |
| **Court** | Bristol Family Court |
| **Judge** | District Judge Pemberton |
| **Date** | ${s3Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} |
| **Start time** | 10:00am |
| **Duration** | 35 minutes |

---

## PARTIES

| Party | Representation |
|-------|---------------|
| **Applicant:** Yasmin Okafor | Represented (Attending Solicitor) |
| **Respondent:** Michael Okafor | In person (litigant in person) |

## CAFCASS

Safeguarding letter filed. No safeguarding concerns identified for either parent. CAFCASS officer (J. Mercer) not present but available by telephone.

## HEARING SUMMARY

District Judge Pemberton explored the possibility of agreement at this hearing. The respondent (Michael Okafor) confirmed he wants regular contact with the children but stated he cannot commit to a fixed alternate weekend pattern due to his shift work. The applicant expressed willingness to accommodate shift patterns provided the arrangements are agreed in advance and communicated to the children.

DJ Pemberton noted the absence of any welfare concerns and the clear desire of both parents to maintain the children's relationships. However, given the respondent's position on flexibility, DJ Pemberton concluded that a full CAFCASS Section 7 welfare report is necessary to recommend a workable arrangement.

## ORDERS MADE

1. CAFCASS Section 7 report directed — to be filed by 14 March
2. Respondent to file a statement of his shift pattern (last 6 months) within 14 days
3. Interim arrangement confirmed by consent: children to live with applicant; contact with respondent on alternate Saturdays 10am–6pm pending final order

## NEXT HEARING

| | |
|---|---|
| **Type** | Dispute Resolution Appointment |
| **Date** | 28 March |
| **Time** | 10:30am |
| **Court** | Bristol Family Court |
| **Estimated duration** | 1 hour |

## COSTS

No order as to costs (standard in children proceedings).

---
*Court attendance note prepared same day.*`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Time entries
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: ses1.id, userId, durationMinutes: 72, description: "Full meeting — Initial consultation, welfare checklist, C100 preparation", hourlyRate: "210.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: ses2.id, userId, durationMinutes: 12, description: "Telephone call — CAFCASS allocation update", hourlyRate: "210.00", status: "confirmed" },
    { caseId: newCase.id, meetingSessionId: ses3.id, userId, durationMinutes: 210, description: "Court hearing — FHDRA, Bristol Family Court (including travel and waiting)", hourlyRate: "210.00", status: "confirmed" },
  ]);

  // Audit trail
  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(42), metadata: { clientName: "Yasmin Okafor", practiceArea: "family_children_arrangements" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(42).getTime() + 30 * 60 * 1000), metadata: { result: "clear", note: "No conflict identified" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(42).getTime() + 60 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "consent_given", timestamp: s1Date, metadata: { consentModality: "verbal_recorded" } },
    { eventType: "document_generated", timestamp: new Date(s1Date.getTime() + 80 * 60 * 1000), metadata: { documentType: "attendance_note" } },
    { eventType: "transcript_generated", timestamp: new Date(s3Date.getTime() + 60 * 60 * 1000), metadata: { speakerCount: 1, sessionType: "court_hearing" } },
    { eventType: "document_generated", timestamp: new Date(s2Date.getTime() + 15 * 60 * 1000), metadata: { documentType: "attendance_note", sessionType: "telephone_call" } },
    { eventType: "document_generated", timestamp: new Date(s3Date.getTime() + 120 * 60 * 1000), metadata: { documentType: "court_attendance_note", sessionType: "court_hearing" } },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: "info", metadata: evt.metadata });
  }
}

// ——— CASE 5: Margaret & Geoffrey Whitmore — Wills & Probate — Complex Document ———

async function seedCase5Whitmore(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Margaret Whitmore & Geoffrey Whitmore",
    email: "m.whitmore@btinternet.com",
    phone: "01483 776 442",
    address: "The Willows, 8 Oakdene Lane, Guildford, Surrey, GU1 3RD",
    amlRiskLevel: "medium",
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Mirror Wills — Whitmore",
    clientName: "Margaret & Geoffrey Whitmore",
    clientId: client.id,
    matterReference: "DEMO_PROB/2024/0203",
    createdBy: userId,
    status: "completed",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "wills_probate",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "No conflict identified. Neither Whitmore has been a client previously.",
    reviewed: true,
    createdAt: daysAgo(56),
  }).returning() as Case[];

  // Session 1: Full meeting — Will instructions (8 weeks ago, 1h 50m)
  const s1Date = daysAgoAt(56, 10, 0);
  const [ses1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting", startedAt: s1Date, durationSeconds: 6600, status: "completed",
    notes: "Will instructions meeting — mirror wills, IHT planning, four speakers", createdBy: userId,
  }).returning();

  await db.insert(consentLogs).values({ caseId: newCase.id, solicitorId: userId, consentGiven: true, disclaimerScriptVersion: "v2.1", consentModality: "verbal_recorded" });

  const t1Content = `Meeting transcript — Mirror Wills Instructions

SOLICITOR: Good morning, Mr and Mrs Whitmore. Thank you both for coming in today. I should let you know that this meeting is being recorded so we can prepare an accurate note afterwards. Do you both consent?

MRS WHITMORE: Yes, that's fine.

MR WHITMORE: Yes, I agree.

SOLICITOR: Thank you. My colleague, Mr Hughes — the senior partner — is also attending today given the complexity of your estate. David?

PARTNER: Good morning. I'm here because the estate value and the IHT considerations mean this matter benefits from two pairs of eyes. I'll be contributing on the tax-planning aspects.

MRS WHITMORE: That's reassuring. We know our estate is complicated.

SOLICITOR: Let's start with the estate overview. Can you talk me through the assets?

MR WHITMORE: Our main asset is the house — The Willows in Guildford. We had it valued last month at one point one million pounds. It's mortgage-free.

MRS WHITMORE: Then there's the investment portfolio. It's managed by Brewin Dolphin. Current value is approximately six hundred and eighty thousand.

MR WHITMORE: Cash savings across various accounts — about one hundred and ninety thousand. And then there are some personal effects of value — Margaret's jewellery collection, my vintage car, some antique furniture. Perhaps another thirty thousand in total, but we don't need to worry about those for IHT purposes.

PARTNER: So the total estate is approximately one point nine seven million. Let me walk you through the IHT position. Each of you has a nil-rate band of three hundred and twenty-five thousand pounds. Together, that's six hundred and fifty thousand. You also each have a residence nil-rate band of one hundred and seventy-five thousand — provided the property passes to direct descendants. That's an additional three hundred and fifty thousand, giving a combined shelter of one million pounds.

MRS WHITMORE: So we'd pay tax on the remainder?

PARTNER: Precisely. The taxable estate would be approximately nine hundred and seventy thousand pounds. At forty percent, the IHT liability would be approximately three hundred and eighty-eight thousand pounds. That's a significant sum.

MR WHITMORE: Is there anything we can do about that?

PARTNER: Several things. First, I'd recommend you consider annual gifting. Each of you can give away three thousand pounds per year using the annual exemption — that's six thousand combined, and if you haven't used last year's exemption, you can carry it forward for one year. Over a seven-year period, regular gifting of around twenty thousand per year from surplus income would reduce the taxable estate substantially.

SOLICITOR: We should also discuss the structure of the wills themselves. You mentioned you'd like mirror wills — that means each will leaves everything to the surviving spouse, and on the second death, the estate passes to the children and grandchildren. Is that your intention?

MRS WHITMORE: Yes. We have two children — our son Andrew and our daughter Claire. Andrew has two children — Thomas, who's fourteen, and Isabelle, who's eleven. Claire has one daughter — Emily, who's eight.

MR WHITMORE: We'd like the estate to pass equally to Andrew and Claire on the second death. But we'd also like to provide something directly for the grandchildren.

PARTNER: A common approach is to create a discretionary trust for the grandchildren's shares. This gives the trustees — typically your children — flexibility to distribute funds at appropriate times. For example, you might direct that each grandchild receives a specified sum at age twenty-one, with the trustees having discretion to release funds earlier for education or housing.

MRS WHITMORE: We were thinking fifty thousand each for the grandchildren — so one hundred and fifty thousand in total into the trust. And the remainder split equally between Andrew and Claire.

SOLICITOR: That's workable. We'd recommend using STEP standard provisions in the trust — they're widely recognised and give the trustees clear guidance. Now, have you considered mutual wills?

MR WHITMORE: What are those?

SOLICITOR: Mutual wills are legally binding agreements between spouses that neither will change their will after the first death. They create an equitable obligation. We discussed this and I'd recommend against it in your case — mirror wills give you the same practical effect while preserving the surviving spouse's ability to adjust the provisions if circumstances change.

MRS WHITMORE: That makes sense. I wouldn't want to be locked in if something changed.

PARTNER: One more item — lasting powers of attorney. Have you considered those?

MR WHITMORE: We haven't, but I know we should.

PARTNER: I'd recommend both property and financial affairs LPAs and health and welfare LPAs for each of you. We can deal with those as a separate matter — I'll open a file for that.

SOLICITOR: Now, a letter of wishes. This isn't legally binding, but it's a very useful guide for your executors and trustees. It sets out your wishes for things like funeral arrangements, personal belongings, and any specific distributions you'd like the trustees to consider. Shall we draft one?

MRS WHITMORE: Yes, please. I'd like to leave my jewellery collection to Claire specifically, and Geoffrey wants his vintage car to go to Andrew.

SOLICITOR: We'll include those in the letter of wishes. Now, who would you like as executors?

MR WHITMORE: Andrew and Claire, jointly. And perhaps this firm as a professional executor as well?

SOLICITOR: That's a sensible arrangement — it provides continuity and professional oversight. We'd charge for acting as executor, which I'll set out in the client care letter.

PARTNER: Before we finish — one final recommendation on IHT planning. You mentioned surplus income. If your income exceeds your regular expenditure, gifts out of surplus income are immediately exempt from IHT — they don't require the seven-year survival period. This is the most powerful exemption available and I'd encourage you to keep detailed records of income and expenditure to support any claim.

MR WHITMORE: We certainly have surplus income. Our combined pensions are more than we spend.

PARTNER: Then regular gifting from surplus income should be a priority. I'll set out a recommended gifting strategy in a follow-up letter. I think we've covered everything — shall we proceed?

MRS WHITMORE: Yes, please go ahead. Thank you both.`;

  const [tr1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses1.id, content: t1Content,
    utterances: [
      { speaker: "A", text: "Good morning, Mr and Mrs Whitmore. Thank you both for coming in today...", start: 0, end: 15000, confidence: 0.95 },
      { speaker: "C", text: "Yes, that's fine.", start: 15500, end: 17000, confidence: 0.97 },
      { speaker: "D", text: "Yes, I agree.", start: 17500, end: 19000, confidence: 0.98 },
      { speaker: "B", text: "Good morning. I'm here because the estate value and the IHT considerations mean this matter benefits from two pairs of eyes.", start: 19500, end: 28000, confidence: 0.94 },
    ],
    speakerCount: 4, createdAt: s1Date,
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses1.id, transcriptSnapshotId: tr1.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Margaret Whitmore & Geoffrey Whitmore (joint matter)
**Matter:** Mirror Wills — Whitmore
**Reference:** DEMO_PROB/2024/0203
**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Attending Solicitor
**Also present:** David Hughes, Senior Partner
**Clients present:** Margaret Whitmore, Geoffrey Whitmore
**Duration:** 1 hour 50 minutes

---

## 1. RECORDING CONSENT

Both clients consented to the recording. Senior Partner (David Hughes) attending due to estate complexity and IHT considerations.

## 2. ESTATE OVERVIEW

| Asset | Estimated Value |
|-------|----------------|
| The Willows, 8 Oakdene Lane, Guildford (freehold, mortgage-free) | £1,100,000 |
| Investment portfolio (Brewin Dolphin) | £680,000 |
| Cash savings (various accounts) | £190,000 |
| Personal effects (jewellery, vintage car, antiques) | ~£30,000 |
| **Total estimated estate** | **~£1,970,000** |

## 3. INHERITANCE TAX ANALYSIS

| Allowance | Per person | Combined |
|-----------|-----------|----------|
| Nil-Rate Band (NRB) | £325,000 | £650,000 |
| Residence Nil-Rate Band (RNRB) | £175,000 | £350,000 |
| **Combined shelter** | | **£1,000,000** |

| | Amount |
|---|---|
| Total estate | £1,970,000 |
| Less combined shelter | (£1,000,000) |
| **Taxable estate** | **£970,000** |
| **IHT at 40%** | **£388,000** |

*Note: RNRB only available if property passes to direct descendants.*

## 4. IHT MITIGATION — ADVICE

**David Hughes (Senior Partner) advised:**

1. **Annual exemption gifting:** Each spouse can gift £3,000 per year (£6,000 combined). Carry forward available if previous year's exemption unused.
2. **Regular gifting programme:** Target £20,000 per year from surplus income over 7-year period to reduce taxable estate.
3. **Gifts from surplus income:** If income exceeds regular expenditure, gifts are immediately exempt (no 7-year rule). Both clients confirmed surplus pension income. Detailed income/expenditure records recommended.

## 5. WILL INSTRUCTIONS

**Structure:** Mirror wills — each spouse leaves everything to survivor; on second death, estate passes to children and grandchildren.

**Children:**
- Andrew Whitmore (son) — two children: Thomas (14), Isabelle (11)
- Claire Whitmore (daughter) — one child: Emily (8)

**Distribution on second death:**
- £150,000 into discretionary trust for grandchildren (£50,000 per grandchild)
- Trust governed by STEP standard provisions
- Trustees have discretion to release funds for education or housing; specified sum at age 21
- Residuary estate split equally between Andrew and Claire

**Mutual wills:** Discussed and rejected. Mirror wills preferred — preserve surviving spouse's ability to adjust provisions if circumstances change.

**Executors:** Andrew Whitmore, Claire Whitmore (jointly), and this firm as professional executor.

## 6. LASTING POWERS OF ATTORNEY

Recommended: Property & Financial Affairs LPA and Health & Welfare LPA for each client. To be dealt with as a separate matter (separate file to be opened).

## 7. LETTER OF WISHES

To be drafted. Specific requests:
- Jewellery collection to Claire Whitmore
- Vintage car to Andrew Whitmore
- Funeral arrangements to be included

## 8. NEXT STEPS

**Solicitor Actions:**
1. Draft mirror wills incorporating discretionary trust for grandchildren
2. Draft letter of wishes
3. Open separate LPA file
4. David Hughes to prepare IHT gifting strategy letter

**Client Actions:**
1. Review draft wills when received
2. Consider and record surplus income/expenditure for gifts from surplus income claim

## 9. DOCUMENT VERIFICATION

Verified — all statements traceable to transcript. Four speakers identified: Solicitor (fee earner), David Hughes (Senior Partner), Margaret Whitmore, Geoffrey Whitmore.

---
*Wills executed at a subsequent appointment. Matter now completed.*`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Client care letter
  await db.insert(documents).values({
    caseId: newCase.id, type: "client_care_letter",
    content: `# CLIENT CARE LETTER\n\n**To:** Margaret Whitmore & Geoffrey Whitmore\nThe Willows, 8 Oakdene Lane, Guildford, Surrey, GU1 3RD\n\n**Date:** ${s1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n**Our Reference:** DEMO_PROB/2024/0203\n\n---\n\nDear Mr and Mrs Whitmore,\n\nThank you for instructing us in connection with the preparation of your wills.\n\n## Fees\n\nPartner rate: £320 per hour. Fee earner rate: £195 per hour.\n\nYours sincerely,\n\n**Attending Solicitor**\nWills & Probate Department`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId, createdAt: s1Date,
  });
  await db.update(cases).set({ clientCareLetterSentAt: s1Date }).where(eq(cases.id, newCase.id));

  // Time entries
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: ses1.id, userId, durationMinutes: 108, description: "Full meeting — Will instructions, IHT analysis, estate planning (partner rate)", hourlyRate: "320.00", status: "confirmed" },
    { caseId: newCase.id, userId, durationMinutes: 180, description: "File preparation — Estate analysis, trust research, STEP provisions review (fee earner rate)", hourlyRate: "195.00", status: "confirmed" },
    { caseId: newCase.id, userId, durationMinutes: 150, description: "Will drafting — Mirror wills with discretionary trust, letter of wishes (fee earner rate)", hourlyRate: "195.00", status: "confirmed" },
  ]);

  // Audit trail
  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(56), metadata: { clientName: "Margaret & Geoffrey Whitmore", practiceArea: "wills_probate" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(56).getTime() + 30 * 60 * 1000), metadata: { result: "clear", note: "No conflict identified" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(56).getTime() + 60 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "consent_given", timestamp: s1Date, metadata: { consentModality: "verbal_recorded", speakerCount: 4 } },
    { eventType: "transcript_generated", timestamp: new Date(s1Date.getTime() + 110 * 60 * 1000), metadata: { speakerCount: 4 } },
    { eventType: "document_generated", timestamp: new Date(s1Date.getTime() + 120 * 60 * 1000), metadata: { documentType: "attendance_note", note: "Complex multi-speaker document" } },
    { eventType: "document_approved", timestamp: new Date(s1Date.getTime() + 180 * 60 * 1000), metadata: { documentType: "attendance_note" } },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: "info", metadata: evt.metadata });
  }
}

// ——— CASE 6: Leon Treadwell — Criminal Defence — Police Station ———

async function seedCase6Treadwell(userId: string) {
  const [client] = await db.insert(clients).values({
    name: "Leon Treadwell",
    email: null,
    phone: "07555 201 883",
    address: "Flat 2, 117 Camberwell New Road, London SE5 0TH",
    amlRiskLevel: "low",
    createdBy: userId,
  }).returning();

  const [newCase] = await db.insert(cases).values({
    title: "Police Station Attendance — Treadwell (s.18 GBH)",
    clientName: "Leon Treadwell",
    clientId: client.id,
    matterReference: "DEMO_CRIM/2024/2201",
    createdBy: userId,
    status: "completed",
    priority: "urgent",
    sourceType: "audio",
    practiceArea: "criminal_defence",
    riskLevel: "low",
    conflictCheckCompleted: true,
    conflictCheckNote: "Duty solicitor attendance. No conflict — Treadwell not previously known to the firm.",
    reviewed: true,
    createdAt: daysAgo(14),
  }).returning() as Case[];

  // Session 1: Police station (11:47pm, 3h 25m)
  const s1Date = new Date(daysAgo(14));
  s1Date.setHours(23, 47, 0, 0);
  const [ses1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "police_station", startedAt: s1Date, durationSeconds: 12300, status: "completed",
    notes: "Police station attendance — duty solicitor — s.18 OAPA 1861", createdBy: userId,
  }).returning();

  const t1Content = `Police station attendance record — Leon Treadwell

Arrived at Walworth Police Station custody suite at 23:47. Instructed as duty solicitor. Client arrested on suspicion of Section 18 Wounding with Intent (Offences Against the Person Act 1861). Custody number WPS/2024/08814.

Consulted with client in private consultation room. Client's account: was involved in an altercation outside a pub on Camberwell Road at approximately 22:15. States he was acting in self-defence after the complainant threw a glass at him. Client sustained a cut to his left forearm. Complainant sustained a laceration to the face requiring stitches. Client denies any intent to cause grievous bodily harm.

Reviewed custody record and disclosure. Disclosure limited: CCTV from the pub exterior is being reviewed but not yet available. One witness statement obtained — states they saw "two men fighting" but could not identify who started the altercation. Complainant's statement alleges Treadwell struck him with a bottle. Client denies using any weapon.

Advised client: given the state of disclosure — no CCTV, one equivocal witness, and a s.18 charge requiring proof of specific intent — I recommended a no comment interview. Explained to client that this is not an admission of guilt but a tactical decision given the incomplete disclosure. Client understood and agreed.

Interview conducted under PACE Code C at 01:22. Interview lasted 28 minutes. Client gave no comment responses throughout. Interviewing officer asked 14 questions covering the events of the evening, the client's relationship with the complainant, and whether the client used a weapon. No comment to all questions.

No identification procedure (VIPER) conducted — identity not in dispute.

Legal basis for detention reviewed: detention authorised to 24 hours under s.37 PACE 1984. Representations made for release — argued incomplete disclosure and absence of CCTV undermines the evidential basis for continued detention.

Client released under investigation at 03:12 pending forensic results (analysis of glass fragments and clothing). Custody sergeant confirmed no bail conditions imposed.

Follow-up: await CPS charging decision. If CCTV supports self-defence account, NFA likely. If not, anticipate charge reduction to s.20 (GBH without intent) at most.

UPDATE: NFA confirmed by CPS the following morning. No further action. Matter closed.`;

  const [tr1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: ses1.id, content: t1Content,
    utterances: [],
    speakerCount: 1, createdAt: s1Date,
  }).returning();

  // Police Station Attendance Record — entirely different format
  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: ses1.id, transcriptSnapshotId: tr1.id,
    type: "attendance_note",
    content: `# POLICE STATION ATTENDANCE RECORD

**Reference:** DEMO_CRIM/2024/2201

---

| | |
|---|---|
| **Client** | Leon Treadwell |
| **Station** | Walworth Police Station |
| **Custody number** | WPS/2024/08814 |
| **Arrival time** | 23:47 |
| **Capacity** | Duty solicitor |
| **Arresting offence** | Section 18 Wounding with Intent (OAPA 1861) |

---

## GROUNDS OF ARREST

Client arrested on suspicion of s.18 GBH following an altercation outside a public house on Camberwell Road at approximately 22:15. Complainant sustained a facial laceration requiring stitches. Client sustained a cut to left forearm.

## CLIENT'S ACCOUNT

Client states he was acting in self-defence. Complainant threw a glass at him. Client denies using any weapon. Denies intent to cause grievous bodily harm.

## DISCLOSURE

- CCTV from pub exterior: being reviewed, not yet available
- One witness statement: saw "two men fighting," could not identify aggressor
- Complainant's statement: alleges client struck him with a bottle
- Client denies using a bottle

## ADVICE GIVEN

Recommended no comment interview. Basis: incomplete disclosure (no CCTV), s.18 requires proof of specific intent, single equivocal witness statement. Explained tactical basis to client. Client understood and agreed.

## INTERVIEW

| | |
|---|---|
| **Time** | 01:22 |
| **Duration** | 28 minutes |
| **Format** | PACE Code C |
| **Questions asked** | 14 |
| **Responses** | No comment throughout |

## IDENTIFICATION PROCEDURE

VIPER not conducted. Identity not in dispute.

## DETENTION

Detention authorised to 24 hours (s.37 PACE 1984). Representations made for release — argued incomplete disclosure and absence of CCTV evidence.

## OUTCOME

| | |
|---|---|
| **Released** | 03:12 — released under investigation |
| **Bail conditions** | None |
| **Pending** | Forensic results (glass fragments, clothing) |
| **CPS decision** | NFA confirmed following morning |

## RESULT

**No further action.** Matter closed.

---
*Total time at station: 3 hours 25 minutes.*`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Client care letter
  await db.insert(documents).values({
    caseId: newCase.id, type: "client_care_letter",
    content: `# CLIENT CARE LETTER

**Our Reference:** DEMO_CRIM/2024/2201
**Date:** ${daysAgo(14).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Dear Mr Treadwell,

Thank you for instructing us. We write to confirm the terms on which we will act for you.

**Your Matter**
We are instructed to represent you in connection with an allegation of Section 18 Wounding with Intent (Offences Against the Person Act 1861) arising from an incident on Camberwell Road. You were attended at Walworth Police Station as duty solicitor.

**People Responsible for Your Matter**
Your matter will be handled by the duty solicitor who attended you at the police station. Day-to-day conduct of the matter may be delegated to other qualified members of the team as appropriate.

**Costs**
As this was a duty solicitor attendance, the costs of the police station attendance are met by the Legal Aid Agency. Should the matter proceed to charge, we will discuss funding options with you including eligibility for legal aid in the Crown Court or Magistrates' Court.

**Your Responsibilities**
You must keep us informed of any change of address or contact details. If you are contacted by the police or CPS directly, please notify us immediately.

**Complaints**
If you are unhappy with the service you receive, please contact our complaints partner in the first instance. We have a written complaints procedure, a copy of which is available on request.

**Regulatory Information**
This firm is authorised and regulated by the Solicitors Regulation Authority (SRA). Our SRA number is displayed on our letterhead.

Yours sincerely,

**[Solicitor Name]**
Duty Solicitor`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved", approvedBy: userId,
  });

  // Time entries
  await db.insert(timeEntries).values([
    { caseId: newCase.id, meetingSessionId: ses1.id, userId, durationMinutes: 204, description: "Police station attendance — duty solicitor, s.18 GBH (out-of-hours rate)", hourlyRate: "195.00", status: "confirmed" },
  ]);

  // Audit trail
  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(14), metadata: { clientName: "Leon Treadwell", practiceArea: "criminal_defence" } },
    { eventType: "conflict_check_completed", timestamp: new Date(daysAgo(14).getTime() + 15 * 60 * 1000), metadata: { result: "clear", note: "Duty solicitor — no prior instructions from Treadwell" } },
    { eventType: "client_care_letter_generated", timestamp: new Date(daysAgo(14).getTime() + 30 * 60 * 1000), metadata: { documentType: "client_care_letter" } },
    { eventType: "transcript_generated", timestamp: new Date(s1Date.getTime() + 3.5 * 60 * 60 * 1000), metadata: { speakerCount: 1 } },
    { eventType: "document_generated", timestamp: new Date(s1Date.getTime() + 4 * 60 * 60 * 1000), metadata: { documentType: "police_station_record" } },
    { eventType: "document_approved", timestamp: new Date(s1Date.getTime() + 5 * 60 * 60 * 1000), metadata: { documentType: "police_station_record" } },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: "info", metadata: evt.metadata });
  }
}

// ——— Main seed function ———

export async function seedDemoData(userId: string): Promise<{ success: boolean; message: string; casesCreated: number }> {
  try {
    await deleteAllUserCaseData(userId);

    await seedCase1Patterson(userId);
    await seedCase2Henderson(userId);
    await seedCase3Hartley(userId);
    await seedCase4Okafor(userId);
    await seedCase5Whitmore(userId);
    await seedCase6Treadwell(userId);

    return {
      success: true,
      message: "Demo data created successfully: 6 showcase cases with transcripts, documents, meeting sessions, time entries, undertakings, and compliance data",
      casesCreated: 6,
    };
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return {
      success: false,
      message: `Error creating demo data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      casesCreated: 0,
    };
  }
}

export async function clearDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    await deleteAllUserCaseData(userId);
    return { success: true, message: "Cleared all demo cases and related data" };
  } catch (error) {
    console.error("Error clearing demo data:", error);
    return { success: false, message: `Error clearing demo data: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function resetDemoData(userId: string): Promise<{ success: boolean; message: string; casesCreated: number }> {
  return seedDemoData(userId);
}
