import { QueryClient } from "@tanstack/react-query";

const DEMO_ALLOWED_WRITE_PATHS = [
  "/api/demo/send-share",
  "/api/demo/send-consent-sms",
  "/api/demo/send-colleague-link",
  "/api/demo/capture-lead",
];

interface DemoUrlRewrite {
  match: RegExp;
  rewrite: (url: string, body: Record<string, unknown>) => { url: string; body: Record<string, unknown> };
}

const DEMO_URL_REWRITES: DemoUrlRewrite[] = [
  {
    match: /\/api\/cases\/[^/]+\/share-link$/,
    rewrite: (url, body) => ({
      url: "/api/demo/send-share",
      body: {
        recipientEmail: body.recipientEmail,
        caseTitle: body.caseTitle || "Demo Case",
        senderName: body.senderName || "Demo Solicitor",
        firmName: body.firmName || "Demo Firm",
      },
    }),
  },
  {
    match: /\/api\/cases\/[^/]+\/send-consent-sms$/,
    rewrite: (url, body) => ({
      url: "/api/demo/send-consent-sms",
      body: {
        phone: body.phone,
        clientName: body.clientName || "Demo Client",
        solicitorName: body.solicitorName || "Demo Solicitor",
      },
    }),
  },
];

let _originalFetch: typeof window.fetch | null = null;
let _demoToastFn: ((msg: string) => void) | null = null;

export function installDemoFetchInterceptor(toastFn: (msg: string) => void) {
  if (_originalFetch) return;
  _originalFetch = window.fetch;
  _demoToastFn = toastFn;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || "GET").toUpperCase();
    const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    if (!isWriteMethod) return _originalFetch!(input, init);

    const isAllowed = DEMO_ALLOWED_WRITE_PATHS.some((p) => url.includes(p));
    if (isAllowed) return _originalFetch!(input, init);

    const rewrite = DEMO_URL_REWRITES.find((r) => r.match.test(url));
    if (rewrite) {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(init?.body as string || "{}"); } catch (_) { /* ignore */ }
      const { url: newUrl, body: newBody } = rewrite.rewrite(url, body);
      return _originalFetch!(newUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBody),
      });
    }

    _demoToastFn?.("This action is not available in the demo environment.");
    return new Response(JSON.stringify({ message: "Demo mode" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export function uninstallDemoFetchInterceptor() {
  if (_originalFetch) {
    window.fetch = _originalFetch;
    _originalFetch = null;
    _demoToastFn = null;
  }
}

export interface DemoParams {
  name: string;
  lastName?: string;
  firm: string;
  practiceArea: string;
  sraNumber?: string;
  rate?: number;
}

function relDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function relDateTime(daysOffset: number, timeStr = "09:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.toISOString().slice(0, 10)}T${timeStr}:00.000Z`;
}

export const DEMO_CASE_ID = "demo-case-family-001";
export const DEMO_SESSION_ID = "demo-session-001";
export const DEMO_SESSION_ID_2 = "demo-session-002";
export const DEMO_SESSION_ID_3 = "demo-session-003";
export const DEMO_DOC_ID = "demo-doc-attendance-001";
export const DEMO_DOC_CCL_ID = "demo-doc-ccl-001";
export const DEMO_TRANSCRIPT_ID = "demo-transcript-001";
export const DEMO_USER_ID = "demo-user";
export const DEMO_FIRM_ID = "demo-firm";

export function createDemoQueryClient(params: DemoParams): { qc: QueryClient; revealCase: () => void } {
  const clientName = params.lastName
    ? `S. ${params.lastName}`
    : params.name
      ? `${params.name.trim().split(/\s+/).slice(-1)[0]}, Client`
      : "Demo Client";

  const solicitorName = params.name || "Rachel Thornton";
  const firmName = params.firm || "Demo Law Firm";
  const rate = params.rate || 220;
  const sraNumber = params.sraNumber || "SRA123456";

  const demoUser = {
    id: DEMO_USER_ID,
    firstName: params.name || "Rachel",
    lastName: params.lastName || "Thornton",
    email: "demo@legalnote.app",
    firmId: DEMO_FIRM_ID,
    primaryRole: "solicitor",
    regulatoryDesignations: ["is_firm_admin"],
    complianceThread: true,
    hourlyRate: String(rate),
    role: "solicitor",
    inviteStatus: "active",
    isAdmin: false,
  };

  const demoFirmProfile = {
    id: "demo-firm-profile",
    firmName: firmName,
    sraNumber: sraNumber,
    complianceBadgeEnabled: false,
    includeLocation: true,
    showFullSolicitorName: true,
    includeClientConfirmation: false,
    digestEnabled: false,
  };

  const now = new Date().toISOString();

  const demoCaseBase = {
    id: DEMO_CASE_ID,
    firmId: DEMO_FIRM_ID,
    title: `Child Arrangements Order — ${clientName}`,
    clientName: clientName,
    clientId: null,
    matterReference: "FAM/2025/0412",
    createdBy: DEMO_USER_ID,
    assignedToUserId: DEMO_USER_ID,
    createdAt: relDateTime(-45),
    status: "completed",
    priority: "normal",
    sourceType: "audio",
    templateId: null,
    parentCaseId: null,
    riskLevel: "medium",
    practiceArea: "family_children_arrangements",
    conflictCheckCompleted: true,
    conflictCheckNote: null,
    clientCareLetterId: DEMO_DOC_CCL_ID,
    clientCareLetterSentAt: relDateTime(-44, "16:00"),
    costsEstimate: "£2,000–£3,000 plus VAT to FHDRA",
    textNotes: null,
    reviewed: false,
    archived: false,
    aiProcessingMetadata: {},
    deadline: relDateTime(14),
    syncToCalendar: false,
    deadlineIsAllDay: true,
    litigationHold: false,
    litigationHoldAppliedAt: null,
    litigationHoldAppliedBy: null,
    litigationHoldReason: null,
    litigationHoldReleasedAt: null,
    litigationHoldReleasedBy: null,
    supervisorId: null,
    supervisorName: null,
  };

  const lockedCases = [
    {
      ...demoCaseBase,
      id: "demo-case-002",
      title: "Residential Conveyancing — Patel / 14 Elm Grove",
      clientName: "R. Patel",
      matterReference: "CONV/2025/0198",
      status: "review_required",
      priority: "urgent",
      practiceArea: "residential_conveyancing",
      deadline: relDateTime(3),
      riskLevel: "low",
      conflictCheckCompleted: true,
      clientCareLetterId: null,
    },
    {
      ...demoCaseBase,
      id: "demo-case-003",
      title: "Employment Tribunal — K. Okafor v Meridian Ltd",
      clientName: "K. Okafor",
      matterReference: "EMP/2025/0071",
      status: "pending",
      priority: "urgent",
      practiceArea: "employment_employee",
      deadline: relDateTime(1),
      riskLevel: "high",
      conflictCheckCompleted: false,
      clientCareLetterId: null,
    },
    {
      ...demoCaseBase,
      id: "demo-case-004",
      title: "Wills & Probate — H. Beaumont Estate",
      clientName: "H. Beaumont",
      matterReference: "PRO/2025/0055",
      status: "completed",
      priority: "normal",
      practiceArea: "wills_probate",
      deadline: null,
      riskLevel: "low",
      reviewed: true,
      conflictCheckCompleted: true,
    },
    {
      ...demoCaseBase,
      id: "demo-case-005",
      title: "Housing Disrepair — T. Nguyen v Riverside HA",
      clientName: "T. Nguyen",
      matterReference: "HDR/2025/0302",
      status: "completed",
      priority: "deadline-soon",
      practiceArea: "housing_tenancy",
      deadline: relDateTime(-2),
      riskLevel: "medium",
      reviewed: false,
      conflictCheckCompleted: true,
    },
    {
      ...demoCaseBase,
      id: "demo-case-006",
      title: "Criminal Defence — M. Walsh (ABH)",
      clientName: "M. Walsh",
      matterReference: "CRIM/2025/0411",
      status: "completed",
      priority: "normal",
      practiceArea: "criminal_defence",
      deadline: null,
      riskLevel: null,
      reviewed: true,
      archived: true,
      conflictCheckCompleted: true,
    },
    {
      ...demoCaseBase,
      id: "demo-case-007",
      title: "Immigration — D. Osei (ILR Application)",
      clientName: "D. Osei",
      matterReference: "IMM/2025/0114",
      status: "pending",
      priority: "normal",
      practiceArea: "immigration",
      deadline: relDateTime(60),
      riskLevel: "low",
      reviewed: false,
      archived: false,
      conflictCheckCompleted: true,
    },
  ];

  const demoSessions = [
    {
      id: DEMO_SESSION_ID,
      caseId: DEMO_CASE_ID,
      recordingType: "full_meeting",
      sessionTitle: "Initial Consultation",
      startedAt: relDateTime(-44, "10:00"),
      durationSeconds: 3314,
      status: "completed",
      notes: null,
      createdBy: DEMO_USER_ID,
    },
    {
      id: DEMO_SESSION_ID_2,
      caseId: DEMO_CASE_ID,
      recordingType: "full_meeting",
      sessionTitle: "Strategy Review — CAFCASS letter",
      startedAt: relDateTime(-28, "11:30"),
      durationSeconds: 2400,
      status: "completed",
      notes: null,
      createdBy: DEMO_USER_ID,
    },
    {
      id: DEMO_SESSION_ID_3,
      caseId: DEMO_CASE_ID,
      recordingType: "court_hearing",
      sessionTitle: "DRA Hearing Debrief",
      startedAt: relDateTime(-7, "16:00"),
      durationSeconds: 1500,
      status: "completed",
      notes: null,
      createdBy: DEMO_USER_ID,
    },
  ];

  const demoAttendanceNote = {
    id: DEMO_DOC_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    transcriptSnapshotId: DEMO_TRANSCRIPT_ID,
    type: "attendance_note",
    content: `ATTENDANCE NOTE

Matter Reference: FAM/2025/0412
Matter: Child Arrangements Order — ${clientName}
Solicitor: ${solicitorName}
Date: ${relDate(-44)}
Duration: 55 minutes
Attendees: ${solicitorName} (Solicitor), ${clientName} (Client)

---

PURPOSE OF MEETING

Initial consultation to advise on the client's position following separation and to discuss the appropriate steps to secure a Child Arrangements Order regarding two minor children.

---

BACKGROUND

The client and her husband separated approximately three months ago. The husband vacated the former matrimonial home. There are two children of the relationship: Emily (aged 7, currently in Year 3) and Oliver (aged 5, currently in Reception). Both children reside with the client following the separation.

The husband has proposed a week-on week-off shared care arrangement. The client does not consider this to be in the children's best interests given: (a) the disruption to the children's established school routine; and (b) the fact that the client was the primary carer throughout the marriage.

---

KEY DISCUSSION POINTS

1. Mediation / MIAM
The solicitor advised that attendance at a Mediation Information and Assessment Meeting (MIAM) is a pre-condition to issuing proceedings under Part 3 of the Family Procedure Rules 2010. The client confirmed that the husband has refused to engage with mediation. The solicitor advised the client to attend a MIAM independently. A list of approved mediators will be provided.

2. C100 Application
The solicitor explained the C100 application process. The client's proposed position is for the children to reside with her, with the husband having alternate weekend contact (Friday after school to Sunday evening) and midweek contact on Wednesdays (for tea). This is confirmed as the initial position in proceedings.

3. Court Timeline
The solicitor advised that following issue of the C100, the matter will typically be listed for an FHDRA within four to six weeks. If the matter is not resolved at the FHDRA, it may proceed to a DRA with a CAFCASS Section 7 report ordered. The overall timeline from issue to final hearing is typically six to nine months.

4. International Travel
The solicitor advised that once proceedings are issued, an automatic stay prevents either party from removing the children from the jurisdiction without the written consent of the other party or a court order. The client noted that the husband has mentioned a summer holiday to Portugal.

5. Costs
The solicitor provided a costs estimate. Court fee: £232. MIAM: approximately £100–£150. Solicitor fees to resolution at FHDRA: approximately £2,000–£3,000 plus VAT. Legal aid eligibility noted as unlikely given the absence of any domestic abuse history.

---

ACTION POINTS

Client:
- Book MIAM as a matter of priority (this week)
- Commence contemporaneous diary of contact arrangements
- Await client care letter and mediator list

Solicitor:
- Issue client care letter today
- Provide list of approved MIAM mediators
- Commence drafting of C100 application

---

Compiled from session recording. Manual compilation typically takes 45-60 minutes per hour of meeting. Verified and approved by ${solicitorName}.`,
    contentHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    version: 1,
    versionType: "ai_generated",
    createdAt: relDateTime(-44, "11:15"),
    createdBy: DEMO_USER_ID,
    isActive: true,
    parentVersionId: null,
    status: "approved",
    approvedBy: DEMO_USER_ID,
    approvedAt: relDateTime(-44, "14:30"),
    approvalComment: null,
    verificationWarnings: [],
    isShortRecording: false,
    acknowledgedAt: null,
    acknowledgedByEmail: null,
    acknowledgedIp: null,
    acknowledgedToken: null,
  };

  const demoClientCareLetter = {
    id: DEMO_DOC_CCL_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    transcriptSnapshotId: null,
    type: "client_care_letter",
    content: `CLIENT CARE LETTER

${firmName}
${sraNumber ? `SRA Number: ${sraNumber}` : ""}

Date: ${relDate(-44)}

Dear ${clientName},

We are pleased to confirm that we are instructed to act on your behalf in relation to your Child Arrangements Order application. This letter sets out the terms on which we will act for you.

SOLICITOR WITH CONDUCT: ${solicitorName}
MATTER REFERENCE: FAM/2025/0412

OUR CHARGES
Our current hourly rate is £${rate} plus VAT at 20%.

ESTIMATE OF COSTS
To resolution at FHDRA: £2,000–£3,000 plus VAT
If proceeding to DRA: £4,000–£7,000 plus VAT
Court filing fee (C100): £232

Yours sincerely,
${solicitorName}
${firmName}`,
    contentHash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    version: 1,
    versionType: "ai_generated",
    createdAt: relDateTime(-44, "16:00"),
    createdBy: DEMO_USER_ID,
    isActive: true,
    parentVersionId: null,
    status: "approved",
    approvedBy: DEMO_USER_ID,
    approvedAt: relDateTime(-44, "16:05"),
    approvalComment: null,
    verificationWarnings: [],
    isShortRecording: false,
    acknowledgedAt: null,
    acknowledgedByEmail: null,
    acknowledgedIp: null,
    acknowledgedToken: null,
  };

  const demoDocuments = [demoAttendanceNote, demoClientCareLetter];

  const demoTranscript = {
    id: DEMO_TRANSCRIPT_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    content: "Initial consultation covering child arrangements, MIAM requirements, C100 application, timeline, costs and international travel implications.",
    utterances: [
      { speaker: "Solicitor", text: `Good morning. Thank you for coming in today. I'm ${solicitorName}, your solicitor. Before we begin, I need to confirm a few things with you. I'll be recording this meeting with your consent — the recording will be used solely to produce an accurate attendance note and will be stored securely. Do you consent to the recording?`, start: 0, end: 18000 },
      { speaker: "Client", text: "Yes, that's fine. I consent to the recording.", start: 18000, end: 22000 },
      { speaker: "Solicitor", text: "Thank you. I've made a note of your consent. Right, so let's start from the beginning. Can you tell me about your current living situation and the circumstances that have brought you here today?", start: 22000, end: 31000 },
      { speaker: "Client", text: "So, me and my husband — we separated about three months ago. He moved out of the family home. We have two children together — Emily, she's seven, and Oliver who's just turned five. At the moment they're living with me, but my husband is saying he wants shared care and we can't seem to agree on anything. Every time we try to talk about it, it becomes an argument.", start: 31000, end: 65000 },
      { speaker: "Solicitor", text: "I understand. That must be a very difficult situation. When you say shared care — has your husband made a specific proposal, or is it more of a general statement that he wants equal time with the children?", start: 65000, end: 78000 },
      { speaker: "Client", text: "He's said he wants them every other week. Week on, week off. But Emily is in Year 3 and she's really settled in her school, and Oliver's just started reception. I don't want that routine disrupted. And honestly, my husband — he was never the main carer. I did the school runs, I did the pickups, I dealt with the homework. He worked long hours. I don't think suddenly going to week-on week-off is in their best interests.", start: 78000, end: 115000 },
      { speaker: "Solicitor", text: "That's helpful context. The court will always focus on what's in the best interests of the children, and the reality of the pre-separation care arrangements is very relevant to that. Can I ask — has there been any involvement from social services or CAFCASS, or any concerns about either parent's ability to care for the children?", start: 115000, end: 138000 },
      { speaker: "Client", text: "No, nothing like that. We're both good parents. There's no history of anything like that. It's just that we can't agree, and he can be very — he's quite forceful, and I find it hard to deal with him directly. That's why I'm here. I need someone to help me through this.", start: 138000, end: 162000 },
      { speaker: "Solicitor", text: "Absolutely, that's exactly why we're here. Before we look at the application for a Child Arrangements Order, I want to make sure you've considered mediation. The court will expect you to have attempted mediation, or at least attended a Mediation Information and Assessment Meeting — what's called a MIAM — before issuing proceedings. Have you explored that route at all?", start: 162000, end: 185000 },
      { speaker: "Client", text: "I did look into it. My husband refused. He said he doesn't see the point of mediation and he wants to go straight to court. So that's why I'm having to take this step.", start: 185000, end: 205000 },
      { speaker: "Solicitor", text: "Right. Well, if he's refused mediation, that's important. You'll need to attend a MIAM yourself — with a mediator — and the mediator will then issue a certificate confirming that mediation is not suitable or has been attempted and failed. That certificate is required before we can file the C100 application. You'll need to do that as a matter of priority, ideally this week.", start: 205000, end: 228000 },
      { speaker: "Client", text: "Okay. Can you recommend someone for the MIAM?", start: 228000, end: 232000 },
      { speaker: "Solicitor", text: "Yes, we work with a few local mediators. I'll provide you with a list of approved mediators in your area. Now, in terms of the C100 — that's the application form for a Child Arrangements Order — I want to talk you through what you're asking the court for. The standard order will specify who the children live with, when they see the other parent, and the arrangements for holidays and special occasions. Are you seeking a sole residency arrangement, or are you open to some shared time with your husband, just on more structured terms?", start: 232000, end: 275000 },
      { speaker: "Client", text: "I'm open to him having the children regularly. I think they need their dad in their lives. I just don't want the week-on week-off arrangement because I think it's too disruptive for them at their ages. I'd be comfortable with him having them every other weekend, and maybe one evening during the week — say, Wednesday evenings for tea.", start: 275000, end: 300000 },
      { speaker: "Solicitor", text: "That's a very reasonable starting position. Alternate weekends from Friday after school to Sunday evening, plus a midweek contact on Wednesdays is a very commonly seen arrangement in court orders. I think that's something we can build a strong case around. Now, let's talk about the timeline. Once we have the MIAM certificate, we can file the C100. The court will then list what's called a First Hearing Dispute Resolution Appointment — an FHDRA — usually within four to six weeks. At that hearing, a CAFCASS officer will have prepared a brief safeguarding letter, and the judge will try to narrow the issues and encourage the parties to agree.", start: 300000, end: 351000 },
      { speaker: "Client", text: "And what if we can't agree at that first hearing?", start: 351000, end: 356000 },
      { speaker: "Solicitor", text: "If the case can't be resolved at the FHDRA, it will be listed for a Dispute Resolution Appointment — a DRA. Before that, CAFCASS may be asked to prepare a full Section 7 report, which involves interviews with both parents and often the children. The Section 7 is really the court's main tool for understanding what the children want and need. It can take anywhere from eight to sixteen weeks to produce, which does mean the overall timeline for these proceedings can be six months or more.", start: 356000, end: 417000 },
      { speaker: "Client", text: "Six months — that feels like a very long time. Is there anything we can do to speed things up?", start: 417000, end: 426000 },
      { speaker: "Solicitor", text: "There are a few options. If there's genuine urgency — for example, if there's a risk that one parent might remove the children from the jurisdiction, or there's a safeguarding concern — we can apply for an emergency order. But on the facts as you've described them, I don't think we're in emergency territory. The best thing you can do to help the timeline is to be very responsive, to keep records of all contact that takes place, and to continue to encourage your husband to engage reasonably.", start: 426000, end: 480000 },
      { speaker: "Client", text: "That makes sense. I'll try to keep a diary.", start: 480000, end: 490000 },
      { speaker: "Solicitor", text: "That's an excellent idea. A contemporaneous diary of contact — when it happened, how long it lasted, any incidents or notable events — is extremely useful evidence if the matter becomes contested. I'd encourage you to start that today. Now, let's turn to costs. I want to be transparent with you about how this is likely to proceed financially. These are private family law proceedings, so you'll be funding this privately. My hourly rate is £${rate} plus VAT. The MIAM itself you'll pay directly to the mediator — typically around £100 to £150. The court fee for the C100 is currently £232. If the matter resolves at the FHDRA, you're looking at roughly £2,000 to £3,000 in total in solicitor's fees. If it goes to a DRA or beyond, that can rise significantly.", start: 490000, end: 560000 },
      { speaker: "Client", text: "I see. And what about legal aid? Is that something available to me?", start: 560000, end: 577000 },
      { speaker: "Solicitor", text: "Legal aid for private children proceedings is very limited now. It's generally only available where there's evidence of domestic abuse or child abuse. As you've described the situation, where there's no history of abuse and both parents are loving, legal aid is unlikely to be available. However, I want to make sure you have the full picture, so I'll include details of the legal aid eligibility criteria in your client care letter.", start: 577000, end: 623000 },
      { speaker: "Client", text: "Okay. I think I can manage the costs, especially if it resolves early. What's the next step then?", start: 623000, end: 644000 },
      { speaker: "Solicitor", text: "The next step is for you to book the MIAM as soon as possible. I'll send you the list of mediators today along with your client care letter, which will confirm my terms of engagement and our costs information. Once you have the MIAM certificate, we can file the C100 application. In the meantime, I'll start drafting the application so we're ready to go the moment you have the certificate. Is there anything else you wanted to ask me today before we close?", start: 644000, end: 692000 },
      { speaker: "Client", text: "I was wondering — can I stop my husband taking the children abroad? He mentioned a holiday to Portugal with them this summer. I'm not sure how I feel about that.", start: 692000, end: 724000 },
      { speaker: "Solicitor", text: "Good question. Under the current law, as both parents have parental responsibility, your husband is entitled to take the children abroad for up to 28 days without your consent provided he gives you reasonable notice. However, once proceedings are issued, there will be an automatic stay preventing either parent from removing the children from the jurisdiction without the other's written consent or a court order. So if your husband is planning a trip for this summer, that's actually another reason to proceed promptly with the C100.", start: 724000, end: 800000 },
      { speaker: "Client", text: "I hadn't thought of that. Okay, that does make me feel better about moving quickly.", start: 800000, end: 815000 },
      { speaker: "Solicitor", text: "Right. Well, I think we've covered everything for today. Let me summarise what we've agreed. You're going to book a MIAM this week. I'm going to send you the client care letter and the list of mediators today. I'll start drafting the C100 application. You're going to start keeping a diary of contact and any relevant events. And we'll be in touch as soon as you have the MIAM certificate to move forward with the court application. Does that all sound right?", start: 815000, end: 868000 },
      { speaker: "Client", text: "Yes, that all sounds right. Thank you so much — I feel a lot clearer about where we're going with this. It's been quite overwhelming.", start: 868000, end: 888000 },
      { speaker: "Solicitor", text: "Of course. These are really difficult circumstances and it's completely understandable to feel overwhelmed. We'll guide you through every step of the process. I'll have those documents across to you by this evening. Take care.", start: 888000, end: 910000 },
    ],
    speakerCount: 2,
    createdAt: relDateTime(-44, "11:10"),
    redactions: [],
  };

  const demoAuditLogs = [
    {
      id: "audit-001",
      eventType: "consent_given",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "10:02"),
      ipAddress: "192.168.1.1",
      userAgent: "LegalNote/2.0",
      metadata: { consentModality: "verbal_recorded", disclaimerVersion: "v3.1" },
      severity: "info",
      hmacFingerprint: "a3f7c2e9b41d8056",
    },
    {
      id: "audit-002",
      eventType: "recording_started",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "10:03"),
      ipAddress: "192.168.1.1",
      userAgent: "LegalNote/2.0",
      metadata: { sessionId: DEMO_SESSION_ID, matterRef: "FAM/2025/0412" },
      severity: "info",
      hmacFingerprint: "f9d1b73e2a6c0847",
    },
    {
      id: "audit-003",
      eventType: "transcript_generated",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:12"),
      ipAddress: null,
      userAgent: "LegalNote AI Engine",
      metadata: { wordCount: 2124, speakerCount: 2, confidence: 98.4 },
      severity: "info",
      hmacFingerprint: "b60a3f7e142d9c85",
    },
    {
      id: "audit-004",
      eventType: "document_generated",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:15"),
      ipAddress: null,
      userAgent: "LegalNote AI Engine",
      metadata: { documentType: "attendance_note", matterRef: "FAM/2025/0412" },
      severity: "info",
      hmacFingerprint: "7e2d5c9a0b4f1638",
    },
    {
      id: "audit-005",
      eventType: "document_approved",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "14:30"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "attendance_note", approvedBy: solicitorName },
      severity: "info",
      hmacFingerprint: "d41c9f3b7a2e5081",
    },
    {
      id: "audit-006",
      eventType: "case_email_sent",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_CCL_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "15:02"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "client_care_letter", recipientEmail: "client@example.com" },
      severity: "info",
      hmacFingerprint: "8f3a1c7b04d2e569",
    },
    {
      id: "audit-007",
      eventType: "case_created",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-45, "09:00"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { matterRef: "FAM/2025/0412", practiceArea: "family_children_arrangements" },
      severity: "info",
      hmacFingerprint: "3b9e0f4a7c1d2865",
    },
    {
      id: "audit-008",
      eventType: "document_exported_pdf",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-7, "16:20"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "attendance_note", exportedBy: solicitorName },
      severity: "info",
      hmacFingerprint: "5e81d2c4f07a9b36",
    },
  ];

  const demoCalendarEvents = [
    {
      id: "demo-cal-001",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      provider: "google",
      providerEventId: "google-event-001",
      eventType: "hearing",
      syncedAt: relDateTime(-10),
      lastUpdatedAt: null,
      title: "FHDRA — Family Court",
      startTime: relDateTime(14, "10:00"),
      endTime: relDateTime(14, "12:00"),
    },
    {
      id: "demo-cal-002",
      caseId: "demo-case-002",
      userId: DEMO_USER_ID,
      provider: "outlook",
      providerEventId: "outlook-event-002",
      eventType: "meeting",
      syncedAt: relDateTime(-5),
      lastUpdatedAt: null,
      title: "Patel — Exchange Completion Call",
      startTime: relDateTime(3, "14:00"),
      endTime: relDateTime(3, "15:00"),
    },
  ];

  const demoUndertakings = [
    {
      id: "demo-ut-001",
      caseId: DEMO_CASE_ID,
      description: "Provide client care letter and list of approved MIAM mediators to client by close of business",
      givenBy: solicitorName,
      givenTo: clientName,
      dueDate: relDateTime(-44),
      status: "completed",
      completedAt: relDateTime(-44, "16:00"),
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
    {
      id: "demo-ut-002",
      caseId: DEMO_CASE_ID,
      description: "Commence drafting of C100 Child Arrangements Order application",
      givenBy: solicitorName,
      givenTo: clientName,
      dueDate: relDateTime(-37),
      status: "completed",
      completedAt: relDateTime(-38, "11:00"),
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
    {
      id: "demo-ut-003",
      caseId: DEMO_CASE_ID,
      description: "File C100 application with Family Court upon receipt of MIAM certificate",
      givenBy: solicitorName,
      givenTo: "Family Court",
      dueDate: relDateTime(3),
      status: "outstanding",
      completedAt: null,
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
  ];

  const demoTimeEntries = [
    {
      id: "demo-te-001",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Initial consultation — 55 minutes",
      duration: 55,
      rate: rate,
      amount: String(Math.round(rate * 55 / 60)),
      date: relDate(-44),
      createdAt: relDateTime(-44, "14:00"),
    },
    {
      id: "demo-te-002",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Client care letter — preparation and issue",
      duration: 30,
      rate: rate,
      amount: String(Math.round(rate * 30 / 60)),
      date: relDate(-44),
      createdAt: relDateTime(-44, "16:00"),
    },
    {
      id: "demo-te-003",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Drafting C100 application form",
      duration: 90,
      rate: rate,
      amount: String(Math.round(rate * 90 / 60)),
      date: relDate(-38),
      createdAt: relDateTime(-38, "09:40"),
    },
    {
      id: "demo-te-004",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Strategy review meeting — 40 minutes",
      duration: 40,
      rate: rate,
      amount: String(Math.round(rate * 40 / 60)),
      date: relDate(-28),
      createdAt: relDateTime(-28, "12:30"),
    },
  ];

  const demoNotifications = [
    {
      id: "demo-notif-001",
      userId: DEMO_USER_ID,
      type: "deadline_approaching",
      title: "Deadline in 3 days",
      body: "Case: Employment Tribunal — K. Okafor v Meridian Ltd",
      read: false,
      createdAt: relDateTime(-1, "09:00"),
      caseId: "demo-case-003",
    },
    {
      id: "demo-notif-002",
      userId: DEMO_USER_ID,
      type: "document_generated",
      title: "Attendance note ready for review",
      body: "Child Arrangements Order — " + clientName,
      read: false,
      createdAt: relDateTime(-44, "11:15"),
      caseId: DEMO_CASE_ID,
    },
  ];

  const demoUserPreferences = {
    id: "demo-prefs",
    userId: DEMO_USER_ID,
    dismissedReviewBanner: false,
    completedOnboarding: true,
    consentWorkflowPreferences: {},
    sendRecordingConfirmationEmails: false,
  };

  const demoFirmMembers = [
    demoUser,
    {
      id: "demo-user-2",
      firstName: "James",
      lastName: "Whitmore",
      email: "james.whitmore@demo.legalnote.app",
      firmId: DEMO_FIRM_ID,
      primaryRole: "senior_solicitor",
      regulatoryDesignations: ["is_supervisor"],
      complianceThread: false,
      hourlyRate: String(rate + 40),
      role: "supervisor",
      inviteStatus: "active",
      isAdmin: false,
    },
    {
      id: "demo-user-3",
      firstName: "Priya",
      lastName: "Patel",
      email: "priya.patel@demo.legalnote.app",
      firmId: DEMO_FIRM_ID,
      primaryRole: "paralegal",
      regulatoryDesignations: [],
      complianceThread: false,
      hourlyRate: String(Math.round(rate * 0.6)),
      role: "solicitor",
      inviteStatus: "active",
      isAdmin: false,
    },
  ];

  const demoUnassignedRecording = {
    id: "demo-import-001",
    botId: null,
    status: "completed",
    createdAt: relDateTime(-1, "15:30"),
    title: "Teams call — unnamed meeting",
    durationSeconds: 1800,
  };

  const demoSessionWithDetails = {
    ...demoSessions[0],
    transcript: demoTranscript,
    documents: demoDocuments.filter(d => d.meetingSessionId === DEMO_SESSION_ID),
  };

  const demoSessionWithDetails2 = {
    ...demoSessions[1],
    transcript: {
      id: "demo-transcript-002",
      caseId: DEMO_CASE_ID,
      meetingSessionId: DEMO_SESSION_ID_2,
      content: "Strategy review meeting covering CAFCASS safeguarding letter and DRA preparation.",
      utterances: [
        { speaker: "Solicitor", text: "Good morning. Before we start today, just to confirm your consent to the recording as before — do you still consent?", start: 0, end: 8000 },
        { speaker: "Client", text: "Yes, I consent.", start: 8000, end: 10000 },
        { speaker: "Solicitor", text: "Thank you. So, we've received the CAFCASS safeguarding letter. Overall it's positive — no safeguarding concerns raised about either parent. Let me walk you through the key findings.", start: 10000, end: 22000 },
      ],
      speakerCount: 2,
      createdAt: relDateTime(-28, "12:30"),
      redactions: [],
    },
    documents: [],
  };

  const demoSessionWithDetails3 = {
    ...demoSessions[2],
    transcript: null,
    documents: [],
  };

  const demoProductivityStats = {
    totalCases: 7,
    awaitingReview: 1,
    evidenceCompletePercent: 85,
    documentationRate: 92,
    thisMonthCases: 3,
    monthlyTrend: "up" as const,
    monthlyChange: 1,
  };

  const demoAttentionStats = {
    audioExpiringCount: 0,
  };

  const demoSraReadiness = {
    overall: "amber" as const,
    outstandingCount: 2,
    criteria: [
      { key: "client_care_letter", label: "Client Care Letter", status: "green" as const, detail: "Sent on " + relDate(-44), sraRef: "SRA Code 8.6", actionRoute: null, externalNote: null },
      { key: "conflict_check", label: "Conflict Check", status: "green" as const, detail: "Completed", sraRef: "SRA Code 6.1", actionRoute: null, externalNote: null },
      { key: "consent_recorded", label: "Consent Recorded", status: "green" as const, detail: "Verbal consent confirmed in recording", sraRef: "UK GDPR Art. 7", actionRoute: null, externalNote: null },
      { key: "undertakings", label: "Undertakings", status: "amber" as const, detail: "1 outstanding undertaking", sraRef: "SRA Code 1.3", actionRoute: null, externalNote: null },
      { key: "time_recording", label: "Time Recording", status: "amber" as const, detail: "4 entries — last updated " + relDate(-28), sraRef: "SRA Code 8.7", actionRoute: null, externalNote: null },
      { key: "practice_area", label: "Practice Area Tagged", status: "green" as const, detail: "Family (Children / Arrangements)", sraRef: "SRA Code 1.1", actionRoute: null, externalNote: null },
    ],
    disclaimer: "This SRA Readiness check is indicative only. Always verify against the full SRA Standards and Regulations.",
  };

  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: async ({ queryKey }) => {
          const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
          if (typeof key === "string") {
            if (key.endsWith("/sessions") || key.endsWith("/documents") || key.endsWith("/time-entries") || key.endsWith("/undertakings") || key.endsWith("/action-items")) return [];
            if (key === "/api/cases" || key === "/api/notifications" || key === "/api/calendar/events" || key === "/api/firm/members" || key === "/api/audit/logs" || key === "/api/recall/imports/unassigned") return [];
          }
          return null;
        },
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const setData = (key: unknown[], data: unknown) => {
    qc.setQueryData(key, data);
  };

  setData(["/api/auth/user"], demoUser);
  setData(["/api/firm-profile"], demoFirmProfile);
  setData(["/api/cases"], lockedCases);
  setData([`/api/cases/${DEMO_CASE_ID}`], demoCaseBase);
  setData(["/api/cases", DEMO_CASE_ID], demoCaseBase);
  setData([`/api/cases/${DEMO_CASE_ID}/sessions`], demoSessions);
  setData([`/api/cases/${DEMO_CASE_ID}/documents`], demoDocuments);
  setData([`/api/cases/${DEMO_CASE_ID}/transcript`], demoTranscript);
  setData([`/api/cases/${DEMO_CASE_ID}/time-entries`], demoTimeEntries);
  setData([`/api/cases/${DEMO_CASE_ID}/undertakings`], demoUndertakings);
  setData([`/api/cases/${DEMO_CASE_ID}/action-items`], []);
  setData([`/api/cases/${DEMO_CASE_ID}/processing-status`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/live-import`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/sra-readiness`], demoSraReadiness);
  setData([`/api/cases/${DEMO_CASE_ID}/sra-report/preview`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/compliance`], null);
  setData([`/api/consent/by-case/${DEMO_CASE_ID}`], []);
  setData([`/api/audio/by-case/${DEMO_CASE_ID}`], null);
  setData(["/api/sessions", DEMO_SESSION_ID], demoSessionWithDetails);
  setData(["/api/sessions", DEMO_SESSION_ID_2], demoSessionWithDetails2);
  setData(["/api/sessions", DEMO_SESSION_ID_3], demoSessionWithDetails3);
  setData([`/api/audio/by-session/${DEMO_SESSION_ID}`], null);
  setData([`/api/audio/by-session/${DEMO_SESSION_ID_2}`], null);
  setData([`/api/audio/by-session/${DEMO_SESSION_ID_3}`], null);
  setData(["/api/audit/logs"], demoAuditLogs);
  setData(["/api/audit/logs", DEMO_CASE_ID], demoAuditLogs);
  setData(["/api/audit/case", DEMO_CASE_ID], demoAuditLogs);
  setData(["/api/calendar/events"], demoCalendarEvents);
  setData(["/api/recall/imports/unassigned"], [demoUnassignedRecording]);
  setData(["/api/notifications"], demoNotifications);
  setData(["/api/user/preferences"], demoUserPreferences);
  setData(["/api/firm/members"], demoFirmMembers);
  setData(["/api/dashboard/productivity-stats"], demoProductivityStats);
  setData(["/api/dashboard/productivity-stats", "all"], demoProductivityStats);
  setData(["/api/dashboard/productivity-stats", "30d"], demoProductivityStats);
  setData(["/api/dashboard/productivity-stats", "7d"], { ...demoProductivityStats, thisMonthCases: 1 });
  setData(["/api/dashboard/attention-stats"], demoAttentionStats);
  setData(["/api/aml-activity-dates", []], {});
  setData(["/api/aml-activity-dates", ["demo-case-003", "demo-case-005"]], {
    "demo-case-003": relDateTime(-1),
    "demo-case-005": relDateTime(-3),
  });
  setData(["/api/cases/demo-case-002"], lockedCases[0]);
  setData(["/api/cases/demo-case-003"], lockedCases[1]);
  setData(["/api/cases/demo-case-004"], lockedCases[2]);
  setData(["/api/cases/demo-case-005"], lockedCases[3]);
  setData(["/api/cases/demo-case-006"], lockedCases[4]);
  setData(["/api/cases/demo-case-007"], lockedCases[5]);

  function revealCase() {
    qc.setQueryData(["/api/cases"], [...lockedCases, demoCaseBase]);
  }

  return { qc, revealCase };
}
