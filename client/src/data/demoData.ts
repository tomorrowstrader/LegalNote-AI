export type PracticeAreaKey =
  | "family"
  | "immigration"
  | "conveyancing"
  | "private-client"
  | "personal-injury"
  | "employment"
  | "commercial"
  | "criminal"
  | "debt-recovery";

export interface DemoMatter {
  id: string;
  ref: string;
  clientName: string;
  title: string;
  status: "active" | "review_required" | "overdue";
  lastActivity: string;
  nextDeadline: string | null;
  riskLevel: "low" | "medium" | "high";
  obligationsDue: number;
}

export interface DemoObligation {
  id: string;
  matterId: string;
  matterTitle: string;
  type: string;
  description: string;
  dueDate: string;
  status: "overdue" | "due_soon" | "upcoming";
  daysOverdue?: number;
  daysDue?: number;
}

export interface DemoDocument {
  id: string;
  title: string;
  type: string;
  status: "approved" | "draft" | "pending_review";
  generatedAt: string;
}

export interface DemoVariant {
  practiceAreaLabel: string;
  complianceScore: number;
  matters: DemoMatter[];
  obligations: DemoObligation[];
  documents: DemoDocument[];
  stats: {
    activeMatters: number;
    overdueItems: number;
    pendingReview: number;
    documentsGenerated: number;
  };
  leadMatter: DemoLeadMatter;
}

export interface DemoSession {
  id: string;
  date: string;
  duration: string;
  type: string;
  attendees: string[];
  summary: string;
  transcriptProduced: boolean;
  noteProduced: boolean;
}

export interface DemoTranscriptTurn {
  id: string;
  speaker: "Solicitor" | "Client" | "Counsel" | "Witness";
  timestamp: string;
  text: string;
}

export interface DemoUndertaking {
  id: string;
  description: string;
  givenBy: string;
  givenTo: string;
  dueDate: string;
  status: "outstanding" | "completed" | "overdue";
}

export interface DemoTimeEntry {
  id: string;
  date: string;
  description: string;
  units: number;
  rate: number;
  fee: number;
}

export interface DemoAuditEntry {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
  actor: string;
  hmacFingerprint: string;
}

export interface DemoLeadMatter {
  id?: string;
  ref: string;
  title: string;
  clientName: string;
  practiceArea?: string;
  solicitor: string;
  firmName: string;
  openedDate: string;
  sessions: DemoSession[];
  documents?: DemoDocument[];
  transcript: DemoTranscriptTurn[];
  transcriptWordCount?: number;
  transcriptDuration?: string;
  attendanceNoteBody: string;
  undertakings: DemoUndertaking[];
  timeEntries: DemoTimeEntry[];
  auditTrail: DemoAuditEntry[];
}

function relDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function relDateTime(daysOffset: number, timeStr = "09:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.toISOString().slice(0, 10)}T${timeStr}:00`;
}

function buildVariant(
  practiceAreaLabel: string,
  complianceScore: number,
  matters: DemoMatter[],
  obligations: DemoObligation[],
  documents: DemoDocument[],
  stats: DemoVariant["stats"],
  leadMatter: DemoLeadMatter
): DemoVariant {
  return { practiceAreaLabel, complianceScore, matters, obligations, documents, stats, leadMatter };
}

const FAMILY_LEAD_MATTER: DemoLeadMatter = {
  ref: "FAM/2025/0412",
  title: "Child Arrangements Order — S. [Prospect]",
  clientName: "S. [Prospect]",
  solicitor: "Rachel Thornton",
  firmName: "[Firm]",
  openedDate: relDate(-45),
  sessions: [
    {
      id: "fs1",
      date: relDate(-44),
      duration: "55 min",
      type: "Initial Consultation",
      attendees: ["Rachel Thornton (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Initial consultation covering background to separation, living arrangements for the children, and immediate steps to apply for a Child Arrangements Order.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "fs2",
      date: relDate(-28),
      duration: "40 min",
      type: "Strategy Review",
      attendees: ["Rachel Thornton (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Review of CAFCASS officer correspondence. Discussion of position statement ahead of DRA hearing.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "fs3",
      date: relDate(-7),
      duration: "25 min",
      type: "Hearing Debrief",
      attendees: ["Rachel Thornton (Solicitor)", "S. [Prospect] (Client)", "D. Kellerman (Counsel)"],
      summary: "Debrief following Dispute Resolution Appointment. Next steps: file position statement and await CAFCASS Section 7.",
      transcriptProduced: true,
      noteProduced: false,
    },
  ],
  transcript: [
    { id: "ft1", speaker: "Solicitor", timestamp: "00:00", text: "Good morning. Thank you for coming in today. I'm Rachel Thornton, your solicitor. Before we begin, I need to confirm a few things with you. I'll be recording this meeting with your consent — the recording will be used solely to produce an accurate attendance note and will be stored securely. Do you consent to the recording?" },
    { id: "ft2", speaker: "Client", timestamp: "00:18", text: "Yes, that's fine. I consent to the recording." },
    { id: "ft3", speaker: "Solicitor", timestamp: "00:22", text: "Thank you. I've made a note of your consent. Right, so let's start from the beginning. Can you tell me about your current living situation and the circumstances that have brought you here today?" },
    { id: "ft4", speaker: "Client", timestamp: "00:31", text: "So, me and my husband — we separated about three months ago. He moved out of the family home. We have two children together — Emily, she's seven, and Oliver who's just turned five. At the moment they're living with me, but my husband is saying he wants shared care and we can't seem to agree on anything. Every time we try to talk about it, it becomes an argument." },
    { id: "ft5", speaker: "Solicitor", timestamp: "01:05", text: "I understand. That must be a very difficult situation. When you say shared care — has your husband made a specific proposal, or is it more of a general statement that he wants equal time with the children?" },
    { id: "ft6", speaker: "Client", timestamp: "01:18", text: "He's said he wants them every other week. Week on, week off. But Emily is in Year 3 and she's really settled in her school, and Oliver's just started reception. I don't want that routine disrupted. And honestly, my husband — he was never the main carer. I did the school runs, I did the pickups, I dealt with the homework. He worked long hours. I don't think suddenly going to week-on week-off is in their best interests." },
    { id: "ft7", speaker: "Solicitor", timestamp: "01:55", text: "That's helpful context. The court will always focus on what's in the best interests of the children, and the reality of the pre-separation care arrangements is very relevant to that. Can I ask — has there been any involvement from social services or CAFCASS, or any concerns about either parent's ability to care for the children?" },
    { id: "ft8", speaker: "Client", timestamp: "02:18", text: "No, nothing like that. We're both good parents. There's no history of anything like that. It's just that we can't agree, and he can be very — he's quite forceful, and I find it hard to deal with him directly. That's why I'm here. I need someone to help me through this." },
    { id: "ft9", speaker: "Solicitor", timestamp: "02:42", text: "Absolutely, that's exactly why we're here. Before we look at the application for a Child Arrangements Order, I want to make sure you've considered mediation. The court will expect you to have attempted mediation, or at least attended a Mediation Information and Assessment Meeting — what's called a MIAM — before issuing proceedings. Have you explored that route at all?" },
    { id: "ft10", speaker: "Client", timestamp: "03:05", text: "I did look into it. My husband refused. He said he doesn't see the point of mediation and he wants to go straight to court. So that's why I'm having to take this step." },
    { id: "ft11", speaker: "Solicitor", timestamp: "03:20", text: "Right. Well, if he's refused mediation, that's important. You'll need to attend a MIAM yourself — with a mediator — and the mediator will then issue a certificate confirming that mediation is not suitable or has been attempted and failed. That certificate is required before we can file the C100 application. You'll need to do that as a matter of priority, ideally this week." },
    { id: "ft12", speaker: "Client", timestamp: "03:48", text: "Okay. Can you recommend someone for the MIAM?" },
    { id: "ft13", speaker: "Solicitor", timestamp: "03:52", text: "Yes, we work with a few local mediators. I'll provide you with a list of approved mediators in your area. Now, in terms of the C100 — that's the application form for a Child Arrangements Order — I want to talk you through what you're asking the court for. The standard order will specify who the children live with, when they see the other parent, and the arrangements for holidays and special occasions. Are you seeking a sole residency arrangement, or are you open to some shared time with your husband, just on more structured terms?" },
    { id: "ft14", speaker: "Client", timestamp: "04:35", text: "I'm open to him having the children regularly. I think they need their dad in their lives. I just don't want the week-on week-off arrangement because I think it's too disruptive for them at their ages. I'd be comfortable with him having them every other weekend, and maybe one evening during the week — say, Wednesday evenings for tea." },
    { id: "ft15", speaker: "Solicitor", timestamp: "05:00", text: "That's a very reasonable starting position. Alternate weekends from Friday after school to Sunday evening, plus a midweek contact on Wednesdays is a very commonly seen arrangement in court orders. I think that's something we can build a strong case around. Now, let's talk about the timeline. Once we have the MIAM certificate, we can file the C100. The court will then list what's called a First Hearing Dispute Resolution Appointment — an FHDRA — usually within four to six weeks. At that hearing, a CAFCASS officer will have prepared a brief safeguarding letter, and the judge will try to narrow the issues and encourage the parties to agree." },
    { id: "ft16", speaker: "Client", timestamp: "05:51", text: "And what if we can't agree at that first hearing?" },
    { id: "ft17", speaker: "Solicitor", timestamp: "05:56", text: "If the case can't be resolved at the FHDRA, it will be listed for a Dispute Resolution Appointment — a DRA. Before that, CAFCASS may be asked to prepare a full Section 7 report, which involves interviews with both parents and often the children. The Section 7 is really the court's main tool for understanding what the children want and need. It can take anywhere from eight to sixteen weeks to produce, which does mean the overall timeline for these proceedings can be six months or more." },
    { id: "ft18", speaker: "Client", timestamp: "06:35", text: "Six months — that feels like a very long time. Is there anything we can do to speed things up?" },
    { id: "ft19", speaker: "Solicitor", timestamp: "06:44", text: "There are a few options. If there's genuine urgency — for example, if there's a risk that one parent might remove the children from the jurisdiction, or there's a safeguarding concern — we can apply for an emergency order. But on the facts as you've described them, I don't think we're in emergency territory. The best thing you can do to help the timeline is to be very responsive, to keep records of all contact that takes place, and to continue to encourage your husband to engage reasonably. If he sees that you're being cooperative and child-focused, it's harder for him to paint you as obstructive." },
    { id: "ft20", speaker: "Client", timestamp: "07:25", text: "That makes sense. I'll try to keep a diary." },
    { id: "ft21", speaker: "Solicitor", timestamp: "07:30", text: "That's an excellent idea. A contemporaneous diary of contact — when it happened, how long it lasted, any incidents or notable events — is extremely useful evidence if the matter becomes contested. I'd encourage you to start that today. Now, let's turn to costs. I want to be transparent with you about how this is likely to proceed financially. These are private family law proceedings, so you'll be funding this privately. My hourly rate is £280 plus VAT. The MIAM itself you'll pay directly to the mediator — typically around £100 to £150. The court fee for the C100 is currently £232. If the matter resolves at the FHDRA, you're looking at roughly £2,000 to £3,000 in total in solicitor's fees. If it goes to a DRA or beyond, that can rise significantly." },
    { id: "ft22", speaker: "Client", timestamp: "08:30", text: "I see. And what about legal aid? Is that something available to me?" },
    { id: "ft23", speaker: "Solicitor", timestamp: "08:37", text: "Legal aid for private children proceedings is very limited now. It's generally only available where there's evidence of domestic abuse or child abuse. As you've described the situation, where there's no history of abuse and both parents are loving, legal aid is unlikely to be available. However, I want to make sure you have the full picture, so I'll include details of the legal aid eligibility criteria in your client care letter." },
    { id: "ft24", speaker: "Client", timestamp: "09:04", text: "Okay. I think I can manage the costs, especially if it resolves early. What's the next step then?" },
    { id: "ft25", speaker: "Solicitor", timestamp: "09:12", text: "The next step is for you to book the MIAM as soon as possible. I'll send you the list of mediators today along with your client care letter, which will confirm my terms of engagement and our costs information. Once you have the MIAM certificate, we can file the C100 application. In the meantime, I'll start drafting the application so we're ready to go the moment you have the certificate. Is there anything else you wanted to ask me today before we close?" },
    { id: "ft26", speaker: "Client", timestamp: "09:44", text: "I was wondering — can I stop my husband taking the children abroad? He mentioned a holiday to Portugal with them this summer. I'm not sure how I feel about that." },
    { id: "ft27", speaker: "Solicitor", timestamp: "09:56", text: "Good question. Under the current law, as both parents have parental responsibility, your husband is entitled to take the children abroad for up to 28 days without your consent provided he gives you reasonable notice. You cannot prevent that without a court order. However, once proceedings are issued, there will be an automatic stay preventing either parent from removing the children from the jurisdiction without the other's written consent or a court order. So if your husband is planning a trip for this summer, that's actually another reason to proceed promptly with the C100." },
    { id: "ft28", speaker: "Client", timestamp: "10:35", text: "I hadn't thought of that. Okay, that does make me feel better about moving quickly." },
    { id: "ft29", speaker: "Solicitor", timestamp: "10:42", text: "Right. Well, I think we've covered everything for today. Let me summarise what we've agreed. You're going to book a MIAM this week. I'm going to send you the client care letter and the list of mediators today. I'll start drafting the C100 application. You're going to start keeping a diary of contact and any relevant events. And we'll be in touch as soon as you have the MIAM certificate to move forward with the court application. Does that all sound right?" },
    { id: "ft30", speaker: "Client", timestamp: "11:08", text: "Yes, that all sounds right. Thank you so much — I feel a lot clearer about where we're going with this. It's been quite overwhelming." },
    { id: "ft31", speaker: "Solicitor", timestamp: "11:18", text: "Of course. These are really difficult circumstances and it's completely understandable to feel overwhelmed. We'll guide you through every step of the process. I'll have those documents across to you by this evening. Take care." },
    { id: "ft32", speaker: "Client", timestamp: "11:28", text: "One more thing — my husband has said he will make sure I get nothing. He keeps saying the house is in his name so I have no rights. Is that true?" },
    { id: "ft33", speaker: "Solicitor", timestamp: "11:35", text: "That is a very common misconception and it is simply not correct. In financial remedy proceedings in England and Wales, the court looks at all matrimonial assets — including assets held in one spouse's sole name — and divides them on a fair basis. The starting point in a long marriage is equality of all assets. The fact that the house is in his name doesn't affect your entitlement one bit. You have a legal right to occupy the matrimonial home regardless of whose name is on the title — that's your matrimonial home rights under the Family Law Act 1996, and I'll register a notice against the title immediately to protect your interest. No solicitor or lender can then deal with the property without your knowledge. So please don't be alarmed by what your husband is saying — he is either mistaken or attempting to intimidate you, and it won't work." },
    { id: "ft34", speaker: "Client", timestamp: "12:10", text: "That is a massive relief. I've been worrying about that for weeks." },
    { id: "ft35", speaker: "Solicitor", timestamp: "12:16", text: "I'm glad I can reassure you. And regarding your own finances in the short term — if you need to apply for an emergency maintenance order to ensure you have income while proceedings are ongoing, that's something we can do very quickly. It's called a maintenance pending suit application. It's heard by a district judge on a relatively urgent basis. If your husband stops making any financial contributions and you're struggling, let me know immediately and we'll make that application. Don't suffer in silence. You have legal mechanisms to protect you and I'll deploy them if needed." },
    { id: "ft36", speaker: "Client", timestamp: "12:48", text: "Thank you. I had no idea any of that was available. I'll keep you posted." },
    { id: "ft37", speaker: "Solicitor", timestamp: "12:52", text: "Please do. My direct line is always best, and if I'm unavailable my assistant Melissa can take a message. We'll get through this together. Take care." },
    { id: "ft38", speaker: "Client", timestamp: "13:00", text: "I also wanted to know about the children's schooling — my husband is threatening to move them to a different school without asking me. Can he do that?" },
    { id: "ft39", speaker: "Solicitor", timestamp: "13:07", text: "No — changing a child's school is a significant decision that falls within the exercise of parental responsibility. Because both of you have parental responsibility, decisions of that nature require the consent of both parents. If he attempts to move the children to a different school without your agreement, that would be a unilateral exercise of parental responsibility without consent, which is something the court takes seriously. You could apply for a Specific Issue Order under the Children Act 1989 to prevent the school change and require any such decisions to be made jointly. I would first write to your husband's solicitors formally notifying them that you do not consent to any change of school and that you will make an immediate court application if he proceeds unilaterally. That letter often has the desired effect. If he's not yet instructed a solicitor, I'd write directly to him. Would you like me to draft that letter today?" },
  ],
  documents: [
    { id: "fd1", title: "Attendance Note — Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDateTime(-44, "14:32") },
    { id: "fd2", title: "Client Care Letter", type: "Client Care Letter", status: "approved", generatedAt: relDateTime(-44, "16:00") },
    { id: "fd3", title: "C100 Application Form (Draft)", type: "Court Form", status: "draft", generatedAt: relDateTime(-42, "10:15") },
    { id: "fd4", title: "Position Statement — DRA Hearing", type: "Court Document", status: "approved", generatedAt: relDateTime(-28, "17:45") },
  ],
  transcriptWordCount: 2124,
  transcriptDuration: "55 min",
  attendanceNoteBody: `ATTENDANCE NOTE

Matter Reference: FAM/2025/0412
Matter: Child Arrangements Order — [Client Name]
Solicitor: Rachel Thornton
Date: ${relDate(-44)}
Duration: 55 minutes
Attendees: Rachel Thornton (Solicitor), [Client Name] (Client)

PURPOSE OF MEETING

Initial consultation to advise on the client's position following separation and to discuss the appropriate steps to secure a Child Arrangements Order regarding two minor children.

BACKGROUND

The client and her husband separated approximately three months ago. The husband vacated the former matrimonial home. There are two children of the relationship: Emily (aged 7, currently in Year 3) and Oliver (aged 5, currently in Reception). Both children reside with the client following the separation.

The husband has proposed a week-on week-off shared care arrangement. The client does not consider this to be in the children's best interests given: (a) the disruption to the children's established school routine; and (b) the fact that the client was the primary carer throughout the marriage.

KEY DISCUSSION POINTS

1. Mediation / MIAM
The solicitor advised the client that attendance at a Mediation Information and Assessment Meeting (MIAM) is a pre-condition to issuing proceedings under Part 3 of the Family Procedure Rules 2010. The client confirmed that the husband has refused to engage with mediation. The solicitor advised the client to attend a MIAM independently. A list of approved mediators will be provided.

2. C100 Application
The solicitor explained the C100 application process. The client's proposed position is for the children to reside with her, with the husband having alternate weekend contact (Friday after school to Sunday evening) and midweek contact on Wednesdays (for tea). This is confirmed as the initial position in proceedings.

3. Court Timeline
The solicitor advised that following issue of the C100, the matter will typically be listed for an FHDRA within four to six weeks. If the matter is not resolved at the FHDRA, it may proceed to a DRA with a CAFCASS Section 7 report ordered. The overall timeline from issue to final hearing is typically six to nine months.

4. International Travel
The solicitor advised that once proceedings are issued, an automatic stay prevents either party from removing the children from the jurisdiction without the written consent of the other party or a court order. The client noted that the husband has mentioned a summer holiday to Portugal.

5. Costs
The solicitor provided a costs estimate. Court fee: £232. MIAM: approximately £100–£150. Solicitor fees to resolution at FHDRA: approximately £2,000–£3,000 plus VAT. Legal aid eligibility noted as unlikely given the absence of any domestic abuse history.

ACTION POINTS

Client:
- Book MIAM as a matter of priority (this week)
- Commence contemporaneous diary of contact arrangements
- Await client care letter and mediator list

Solicitor:
- Issue client care letter today
- Provide list of approved MIAM mediators
- Commence drafting of C100 application

Compiled from session recording. Verified and approved by Rachel Thornton.`,
  undertakings: [
    {
      id: "fu1",
      description: "Provide client care letter and list of approved MIAM mediators to client by close of business",
      givenBy: "Rachel Thornton (Solicitor)",
      givenTo: "[Client Name]",
      dueDate: relDate(-44),
      status: "completed",
    },
    {
      id: "fu2",
      description: "Commence drafting of C100 Child Arrangements Order application",
      givenBy: "Rachel Thornton (Solicitor)",
      givenTo: "[Client Name]",
      dueDate: relDate(-37),
      status: "completed",
    },
    {
      id: "fu3",
      description: "File C100 application with Bristol Family Court upon receipt of MIAM certificate",
      givenBy: "Rachel Thornton (Solicitor)",
      givenTo: "Bristol Family Court",
      dueDate: relDate(3),
      status: "outstanding",
    },
  ],
  timeEntries: [
    { id: "fte1", date: relDate(-44), description: "Initial consultation — 55 minutes", units: 3.7, rate: 280, fee: 1036 },
    { id: "fte2", date: relDate(-44), description: "Client care letter — preparation and issue", units: 0.5, rate: 280, fee: 140 },
    { id: "fte3", date: relDate(-38), description: "Drafting C100 application form", units: 1.5, rate: 280, fee: 420 },
    { id: "fte4", date: relDate(-28), description: "Strategy review meeting — 40 minutes", units: 2.7, rate: 280, fee: 756 },
    { id: "fte5", date: relDate(-25), description: "Review CAFCASS safeguarding letter — advice letter to client", units: 0.8, rate: 280, fee: 224 },
    { id: "fte6", date: relDate(-7), description: "DRA hearing attendance (Counsel-led) — debrief call — 25 minutes", units: 1.7, rate: 280, fee: 476 },
  ],
  auditTrail: [
    {
      id: "fa1",
      timestamp: relDateTime(-44, "10:02"),
      eventType: "Consent Obtained",
      description: "Client gave verbal consent to meeting recording. Consent recorded in transcript at 00:18.",
      actor: "LegalNote System",
      hmacFingerprint: "a3f7c2e9b41d8056",
    },
    {
      id: "fa2",
      timestamp: relDateTime(-44, "10:03"),
      eventType: "Recording Started",
      description: "Secure audio recording commenced for matter FAM/2025/0412, session fs1.",
      actor: "LegalNote System",
      hmacFingerprint: "f9d1b73e2a6c0847",
    },
    {
      id: "fa3",
      timestamp: relDateTime(-44, "10:58"),
      eventType: "Recording Completed",
      description: "Recording ended. Duration: 55 minutes 14 seconds. File encrypted at rest (AES-256).",
      actor: "LegalNote System",
      hmacFingerprint: "2c84e0f5a91b3d76",
    },
    {
      id: "fa4",
      timestamp: relDateTime(-44, "11:12"),
      eventType: "Transcript Produced",
      description: "AI transcription completed. 2,124 words. Diarization: 2 speakers identified. Confidence: 98.4%.",
      actor: "LegalNote AI Engine",
      hmacFingerprint: "b60a3f7e142d9c85",
    },
    {
      id: "fa5",
      timestamp: relDateTime(-44, "11:15"),
      eventType: "Attendance Note Generated",
      description: "Attendance note auto-generated from transcript. Matter ref FAM/2025/0412. Document ID: fd1.",
      actor: "LegalNote AI Engine",
      hmacFingerprint: "7e2d5c9a0b4f1638",
    },
    {
      id: "fa6",
      timestamp: relDateTime(-44, "14:30"),
      eventType: "Document Approved",
      description: "Attendance note reviewed and approved by Rachel Thornton. Status set to Approved.",
      actor: "Rachel Thornton",
      hmacFingerprint: "d41c9f3b7a2e5081",
    },
    {
      id: "fa7",
      timestamp: relDateTime(-44, "15:02"),
      eventType: "Client Care Letter Issued",
      description: "Client care letter generated and sent to client via secure email. Document ID: fd2.",
      actor: "Rachel Thornton",
      hmacFingerprint: "8f3a1c7b04d2e569",
    },
    {
      id: "fa8",
      timestamp: relDateTime(-38, "09:40"),
      eventType: "Document Created",
      description: "C100 application draft created. Version 1.0. Awaiting MIAM certificate to file.",
      actor: "Rachel Thornton",
      hmacFingerprint: "3b9e0f4a7c1d2865",
    },
    {
      id: "fa9",
      timestamp: relDateTime(-28, "11:55"),
      eventType: "Recording Started",
      description: "Secure audio recording commenced for matter FAM/2025/0412, session fs2 (strategy review).",
      actor: "LegalNote System",
      hmacFingerprint: "c2a7d0e8f3b41956",
    },
    {
      id: "fa10",
      timestamp: relDateTime(-7, "16:20"),
      eventType: "Secure Link Shared",
      description: "Attendance note shared with client via secure read-only link. Expiry: 30 days.",
      actor: "Rachel Thornton",
      hmacFingerprint: "5e81d2c4f07a9b36",
    },
  ],
};

const EMPLOYMENT_LEAD_MATTER: DemoLeadMatter = {
  ref: "EMP/2025/0334",
  title: "Constructive Dismissal — S. [Prospect] v Nexus Group",
  clientName: "S. [Prospect]",
  solicitor: "James Whitmore",
  firmName: "[Firm]",
  openedDate: relDate(-40),
  sessions: [
    {
      id: "es1",
      date: relDate(-39),
      duration: "60 min",
      type: "Initial Consultation",
      attendees: ["James Whitmore (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Initial consultation covering the client's employment history with Nexus Group, the circumstances of the alleged constructive dismissal, and the steps required to pursue an ET1 claim.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "es2",
      date: relDate(-20),
      duration: "45 min",
      type: "Strategy Review",
      attendees: ["James Whitmore (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Review of ACAS early conciliation status and discussion of ET1 claim strategy. Schedule of loss prepared.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "es3",
      date: relDate(-5),
      duration: "30 min",
      type: "ET1 Review",
      attendees: ["James Whitmore (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Review of draft ET1 claim form prior to filing. Client approved final version.",
      transcriptProduced: true,
      noteProduced: false,
    },
  ],
  transcript: [
    { id: "et1", speaker: "Solicitor", timestamp: "00:00", text: "Good afternoon. I'm James Whitmore. Thank you for coming in. Before we start, I need to obtain your consent to record this meeting. The recording will be used to produce an attendance note — it's stored securely on our LegalNote platform and isn't shared with anyone. Do you consent to that?" },
    { id: "et2", speaker: "Client", timestamp: "00:22", text: "Yes, I'm fine with that." },
    { id: "et3", speaker: "Solicitor", timestamp: "00:26", text: "Thank you. So, tell me in your own words what's happened. Start wherever feels natural." },
    { id: "et4", speaker: "Client", timestamp: "00:33", text: "I worked for Nexus Group for six years. I was a senior account manager in their Manchester office. About eight months ago, they promoted a new regional director — Marcus Webb — and from that point, everything changed. He started undermining me in front of clients, excluding me from strategy meetings I should have been involved in, and he gave my biggest accounts to junior colleagues. I raised it with HR twice and was told it was just a management style adjustment." },
    { id: "et5", speaker: "Solicitor", timestamp: "01:15", text: "And when you say you raised it with HR — did you do that in writing, or was it verbal?" },
    { id: "et6", speaker: "Client", timestamp: "01:22", text: "The first time was a verbal meeting. The second time I followed up in email. I've got copies of those emails." },
    { id: "et7", speaker: "Solicitor", timestamp: "01:30", text: "Excellent — we'll definitely need those. Now, you said you were excluded from meetings and had accounts reassigned. Was there any explanation given for why those decisions were made?" },
    { id: "et8", speaker: "Client", timestamp: "01:43", text: "I was told it was about 'team restructuring' and 'optimising client relationships.' But the junior colleagues who got my accounts had a fraction of my experience. I genuinely believe it was because I challenged Marcus in a team meeting about the direction of a key client strategy. After that, it just became a campaign to push me out." },
    { id: "et9", speaker: "Solicitor", timestamp: "02:10", text: "I see. And ultimately, why did you leave?" },
    { id: "et10", speaker: "Client", timestamp: "02:16", text: "About four months ago, I was called to a meeting where they told me they were restructuring my role. They offered me a position at a lower grade — effectively a demotion — with a fifteen percent salary reduction. They gave me two weeks to accept or decline. I consulted a colleague who'd been through something similar and she told me to seek legal advice. I declined the role and resigned, giving my notice on the grounds that they'd fundamentally breached my employment contract." },
    { id: "et11", speaker: "Solicitor", timestamp: "03:05", text: "Right. What you're describing is textbook constructive dismissal. The key legal issue is whether the employer's behaviour — the demotion offer, the exclusion, the account reassignment — amounted to a fundamental breach of the implied term of mutual trust and confidence. What you've described certainly has the hallmarks of that. Now, the important thing is timing. You have three months less one day from the effective date of termination to bring a claim at the Employment Tribunal. When was your last day?" },
    { id: "et12", speaker: "Client", timestamp: "03:48", text: "My last day was eleven weeks ago. So I've got just under two weeks?" },
    { id: "et13", speaker: "Solicitor", timestamp: "03:55", text: "Yes — that's right. And critically, before you can file an ET1, you must go through ACAS early conciliation. That's not optional. You have to notify ACAS first, and the clock stops while early conciliation is underway. If ACAS issues an early conciliation certificate — either because conciliation has failed or because the other side declines to engage — only then can you file. So we need to notify ACAS today. I mean that quite literally — today." },
    { id: "et14", speaker: "Client", timestamp: "04:30", text: "I didn't realise it was that urgent. I thought I had more time." },
    { id: "et15", speaker: "Solicitor", timestamp: "04:36", text: "Unfortunately the three-month limitation period in employment law is treated very strictly by tribunals. There's very limited scope for extension. So, first thing we'll do when we leave this meeting is submit the ACAS early conciliation notification online. I can help you do that now if you like. Now — what outcome are you looking for? Are you looking for reinstatement, or is it financial compensation you're after?" },
    { id: "et16", speaker: "Client", timestamp: "05:02", text: "I don't want to go back. The relationship is completely broken. I want compensation. I've been out of work for eleven weeks now, I've had some interviews but nothing firm yet." },
    { id: "et17", speaker: "Solicitor", timestamp: "05:15", text: "Understood. Your schedule of loss will include your basic award — calculated on the basis of your weekly pay, length of service and age — and your compensatory award, which covers your actual financial loss. With six years' service, your basic award should be meaningful. The compensatory award is capped at the lower of one year's gross pay or the statutory cap which is currently £115,115. But we also need to think about your duty to mitigate — you need to demonstrate you've been actively looking for work. Do you have records of your job applications?" },
    { id: "et18", speaker: "Client", timestamp: "06:00", text: "Yes, I've been keeping a spreadsheet. I've applied for about thirty positions." },
    { id: "et19", speaker: "Solicitor", timestamp: "06:08", text: "Perfect. That's exactly what we need. Now, in terms of strategy — Nexus Group are a large organisation. My expectation is that they'll want to settle this before it reaches a tribunal. Constructive dismissal claims are damaging for them reputationally, especially if it comes out in evidence that you were effectively managed out for challenging the regional director. In my experience, once ACAS conciliation starts, there's often a settlement offer. The question is whether it's the right amount." },
    { id: "et20", speaker: "Client", timestamp: "06:45", text: "What sort of settlement would you consider reasonable?" },
    { id: "et21", speaker: "Solicitor", timestamp: "06:50", text: "Let me run the schedule of loss properly after this meeting and give you a written figure. But based on what you've told me — six years' service, senior grade, a fifteen percent reduction in a salary I'm estimating is around £55,000 — you're probably looking at a basic award of around £6,000 to £8,000 and a compensatory element that could add another £20,000 to £40,000 depending on how long it takes you to find a comparable role. We'd typically recommend not accepting anything less than around £30,000 in a case like this, but that's very much subject to the full picture." },
    { id: "et22", speaker: "Client", timestamp: "07:40", text: "That's more than I expected, honestly. I was thinking maybe £15,000 or £20,000." },
    { id: "et23", speaker: "Solicitor", timestamp: "07:48", text: "You may well be entitled to more than that. Now, in terms of our fees — I should tell you we offer employment claims on a blended basis. If the case settles at ACAS stage, our fees are fixed at £1,500 plus VAT. If it proceeds to a full tribunal hearing, we'd move to an hourly rate arrangement. We'll set all of this out in the client care letter. Are there any other aspects of the situation I haven't covered that you'd like to discuss?" },
    { id: "et24", speaker: "Client", timestamp: "08:20", text: "Actually, yes. I was wondering whether I have any claim in respect of the way Marcus Webb treated me personally — whether that might amount to harassment." },
    { id: "et25", speaker: "Solicitor", timestamp: "08:30", text: "Good question. Harassment under the Equality Act 2010 requires a protected characteristic — so we'd need to identify whether Marcus Webb's conduct was related to your sex, race, age, disability or other protected characteristic. From what you've described, the conduct seems more directed at your professional challenge to him than at any protected characteristic. However, I'd like to read through your emails to HR in detail before ruling it out. There may be context that shifts the analysis." },
    { id: "et26", speaker: "Client", timestamp: "09:05", text: "That's fair. I'll send you all the emails when I get home." },
    { id: "et27", speaker: "Solicitor", timestamp: "09:10", text: "Please do — send them today if you can. The sooner we have the full picture, the better. Right, I think that covers everything. Let me summarise. You're going to send me the HR correspondence today. We're going to submit the ACAS early conciliation notification immediately after this meeting. I'll prepare your schedule of loss and have a first draft ET1 to you by the end of the week. Does that all sound right?" },
    { id: "et28", speaker: "Client", timestamp: "09:38", text: "Yes, that all sounds right. Thank you — you've really clarified the situation for me. I was quite anxious coming in today." },
    { id: "et29", speaker: "Solicitor", timestamp: "09:44", text: "That's very understandable. Employment situations like this are incredibly stressful. We'll get things moving today. Take care." },
    { id: "et30", speaker: "Client", timestamp: "09:50", text: "Before I go — what are the realistic chances of settlement before tribunal?" },
    { id: "et31", speaker: "Solicitor", timestamp: "09:55", text: "The statistics are quite encouraging. Around 70% of ET claims settle before a final hearing — many during the ACAS early conciliation phase and others after proceedings are issued during the case management stage. Employers are often motivated to settle to avoid the time and cost of a hearing, the reputational risk, and any publicity around the allegations. In your case, given the clear evidential trail in your emails and the fact that you've raised a formal grievance, I'd expect the respondent to take settlement seriously once they see the strength of your claim. That doesn't mean we assume settlement — we prepare for a full hearing and treat any offer seriously when it arrives. Settlement is always your decision and yours alone. I'll advise you on the merits and quantum of any offer but I'll never pressure you to settle. Is that clear?" },
    { id: "et32", speaker: "Client", timestamp: "10:35", text: "Yes, absolutely. That's helpful. And if it does go to tribunal, what does that look like?" },
    { id: "et33", speaker: "Solicitor", timestamp: "10:41", text: "A final hearing in the Employment Tribunal is typically one to three days for a case of this nature. It's heard before a panel of an Employment Judge and two lay members — one with an employer background and one with an employee background. The hearing is less formal than a court but still rigorous. You'd give oral evidence and be cross-examined by the respondent's representative. Witnesses from your employer will also give evidence. I'd prepare a detailed witness statement for you which you'd sign as your sworn evidence. I'd be with you throughout, either conducting the advocacy myself or with a specialist employment barrister. The decision is usually reserved — meaning the panel will write to both parties with the judgment in the following weeks, though some panels give a decision on the day. If successful, the tribunal has broad powers to award compensation, including an injury to feelings award and financial loss." },
    { id: "et34", speaker: "Client", timestamp: "11:22", text: "That's really helpful. I think I'm ready. Let me go and send you those emails." },
    { id: "et35", speaker: "Solicitor", timestamp: "11:26", text: "Excellent. And remember — do not discuss the case with anyone at work, do not delete any emails or messages, and do not take any documents home from the office that you don't normally have authorised access to. If you're still employed there, protect your position carefully. We'll speak again once ACAS responds." },
    { id: "et36", speaker: "Client", timestamp: "11:35", text: "I want to ask about the whistleblowing angle. I flagged some compliance concerns internally six months ago and then this all started happening. Could that be relevant?" },
    { id: "et37", speaker: "Solicitor", timestamp: "11:42", text: "That is potentially very significant and I'm glad you've told me. If you made a protected disclosure — meaning you reported a concern about wrongdoing in the public interest — and you've suffered detrimental treatment or dismissal as a result, you may have a whistleblowing claim under the Employment Rights Act 1996, specifically Part IVA. Whistleblowing claims are important for two reasons. First, there is no cap on compensation — unlike ordinary unfair dismissal which is capped at roughly £118,000, a successful whistleblowing claim can result in unlimited compensation. Second, the legal test is different — you don't need to have two years' service to bring a whistleblowing claim. It's a day-one right. Tell me more about the compliance concern you reported: what did you flag, to whom, in what form, and when exactly?" },
    { id: "et38", speaker: "Client", timestamp: "12:20", text: "I flagged a concern in a written email to the Head of Compliance in October last year. I said I believed the company was misrepresenting product certifications to customers. I have the email." },
    { id: "et39", speaker: "Solicitor", timestamp: "12:28", text: "That email is potentially the most important document in this whole case. A written disclosure to a designated person within the company — the Head of Compliance — about a concern relating to consumer protection or fraud will very likely qualify as a protected disclosure under ERA 1996. The concern about misrepresenting certifications falls squarely within the category of information tending to show a legal obligation has been or is likely to be breached, or that a criminal offence has been committed. The timing — six months ago — combined with the subsequent escalation of the performance management against you, creates a compelling chronology. We call this post-disclosure detriment, and tribunals look carefully at the gap in time between the disclosure and the adverse treatment. I will be drafting the ET1 to include a whistleblowing claim alongside the constructive dismissal claim. This changes the entire landscape of the case. Well done for telling me." },
    { id: "et40", speaker: "Client", timestamp: "13:10", text: "I wasn't sure if it was relevant. I'm relieved I mentioned it." },
    { id: "et41", speaker: "Solicitor", timestamp: "13:15", text: "It is absolutely relevant. Get that email to me today along with the other correspondence. We'll build the narrative around the October disclosure as the trigger for everything that followed. With an uncapped whistleblowing claim, your potential recovery is significantly greater. I'll reflect the updated quantum analysis in the schedule of loss I send you by the end of the week." },
  ],
  documents: [
    { id: "ed1", title: "Attendance Note — Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDateTime(-49, "15:20") },
    { id: "ed2", title: "Client Care Letter", type: "Client Care Letter", status: "approved", generatedAt: relDateTime(-49, "17:00") },
    { id: "ed3", title: "ET1 Claim Form — Draft", type: "Tribunal Form", status: "draft", generatedAt: relDateTime(-42, "11:00") },
    { id: "ed4", title: "Schedule of Loss", type: "Litigation Document", status: "approved", generatedAt: relDateTime(-38, "14:30") },
  ],
  transcriptWordCount: 2089,
  transcriptDuration: "60 min",
  attendanceNoteBody: `ATTENDANCE NOTE

Matter Reference: EMP/2025/0334
Matter: Constructive Dismissal — [Client Name] v Nexus Group
Solicitor: James Whitmore
Date: ${relDate(-39)}
Duration: 60 minutes
Attendees: James Whitmore (Solicitor), [Client Name] (Client)

---

PURPOSE OF MEETING

Initial consultation to advise the client on a potential constructive dismissal claim following resignation from Nexus Group after an alleged course of conduct by their new Regional Director.

---

BACKGROUND

The client was employed by Nexus Group for six years as a Senior Account Manager. Following the appointment of a new Regional Director (Marcus Webb) approximately eight months ago, the client describes a systematic course of conduct including: exclusion from strategy meetings; reassignment of major accounts to junior colleagues; and ultimately, a unilateral offer of demotion to a lower grade with a 15% salary reduction. The client raised concerns with HR on two occasions (the second in writing — copies obtained). The client declined the demotion offer and resigned on the basis of fundamental breach of the implied term of mutual trust and confidence.

Effective date of termination: 11 weeks ago.

---

KEY DISCUSSION POINTS

1. Constructive Dismissal — Legal Framework
The solicitor advised that the facts as described are capable of constituting constructive dismissal under s.95(1)(c) ERA 1996. The key question is whether the employer's conduct amounted to a fundamental breach of the implied term of mutual trust and confidence. The account reassignment, exclusion and demotion offer are all potentially relevant.

2. Limitation and ACAS Early Conciliation
The solicitor advised in the strongest terms that the three-month less one day limitation period must be observed. Given that the effective date of termination was 11 weeks ago, there are approximately 2 weeks remaining. The solicitor confirmed that ACAS early conciliation notification must be submitted immediately — today — which stops the clock while conciliation is ongoing.

3. Schedule of Loss
Estimated basic award: £6,000 to £8,000 (based on 6 years' service, senior grade). Estimated compensatory award: £20,000 to £40,000 dependent on duration of unemployment. Compensatory cap: £115,115. Client maintaining a job application log (approximately 30 applications to date).

4. Settlement Strategy
The solicitor advised that Nexus Group, as a large organisation, are likely to prefer settlement to a contested tribunal hearing. A minimum acceptable settlement in the region of £30,000 was indicated, subject to full schedule of loss review.

5. Potential Harassment Claim
The solicitor advised that a harassment claim under the Equality Act 2010 requires a protected characteristic. On the facts as currently understood, the conduct appears to be related to the professional dispute rather than a protected characteristic. Further review of HR correspondence is required.

---

ACTION POINTS

Client:
- Send all HR correspondence to solicitor today
- Submit ACAS early conciliation notification with solicitor's assistance (immediately post-meeting)
- Continue maintaining job application log

Solicitor:
- Submit ACAS early conciliation notification with client post-meeting
- Prepare schedule of loss — due by end of week
- Draft ET1 claim form — due by end of week
- Issue client care letter

---

Compiled from session recording. Manual compilation typically takes 45-60 minutes per hour of meeting. Verified and approved by James Whitmore.`,
  undertakings: [
    { id: "eu1", description: "Submit ACAS early conciliation notification on behalf of client", givenBy: "James Whitmore (Solicitor)", givenTo: "[Client Name]", dueDate: relDate(-39), status: "completed" },
    { id: "eu2", description: "Prepare draft ET1 claim form", givenBy: "James Whitmore (Solicitor)", givenTo: "[Client Name]", dueDate: relDate(-34), status: "completed" },
    { id: "eu3", description: "File ET1 upon receipt of ACAS early conciliation certificate", givenBy: "James Whitmore (Solicitor)", givenTo: "Employment Tribunal", dueDate: relDate(0), status: "overdue" },
  ],
  timeEntries: [
    { id: "ete1", date: relDate(-39), description: "Initial consultation — 60 minutes", units: 4.0, rate: 280, fee: 1120 },
    { id: "ete2", date: relDate(-39), description: "ACAS early conciliation notification submission", units: 0.5, rate: 280, fee: 140 },
    { id: "ete3", date: relDate(-35), description: "Schedule of loss preparation", units: 1.5, rate: 280, fee: 420 },
    { id: "ete4", date: relDate(-33), description: "Drafting ET1 claim form", units: 2.0, rate: 280, fee: 560 },
    { id: "ete5", date: relDate(-20), description: "Strategy review — 45 minutes", units: 3.0, rate: 280, fee: 840 },
    { id: "ete6", date: relDate(-5), description: "ET1 review call — 30 minutes", units: 2.0, rate: 280, fee: 560 },
  ],
  auditTrail: [
    { id: "ea1", timestamp: relDateTime(-39, "14:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording. Consent recorded in transcript at 00:22.", actor: "LegalNote System", hmacFingerprint: "9c3f5a7e1b024d68" },
    { id: "ea2", timestamp: relDateTime(-39, "14:03"), eventType: "Recording Started", description: "Secure audio recording commenced for matter EMP/2025/0334, session es1.", actor: "LegalNote System", hmacFingerprint: "d7b2e4c0f9a13857" },
    { id: "ea3", timestamp: relDateTime(-39, "15:03"), eventType: "Recording Completed", description: "Recording ended. Duration: 60 minutes 07 seconds. File encrypted at rest (AES-256).", actor: "LegalNote System", hmacFingerprint: "1a6e8f3c0b7d4952" },
    { id: "ea4", timestamp: relDateTime(-39, "15:18"), eventType: "Transcript Produced", description: "AI transcription completed. 2,089 words. Diarization: 2 speakers identified. Confidence: 97.9%.", actor: "LegalNote AI Engine", hmacFingerprint: "e5b0c7d2f4a83196" },
    { id: "ea5", timestamp: relDateTime(-39, "15:21"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated from transcript. Matter ref EMP/2025/0334. Document ID: ed1.", actor: "LegalNote AI Engine", hmacFingerprint: "4f9a1d3e7c0b2685" },
    { id: "ea6", timestamp: relDateTime(-39, "17:40"), eventType: "Document Approved", description: "Attendance note reviewed and approved by James Whitmore.", actor: "James Whitmore", hmacFingerprint: "b8c3e5a1d02f7496" },
    { id: "ea7", timestamp: relDateTime(-33, "10:15"), eventType: "Document Created", description: "ET1 claim form draft created. Version 1.0.", actor: "James Whitmore", hmacFingerprint: "7d2f9e4a1c6b8035" },
    { id: "ea8", timestamp: relDateTime(-5, "14:50"), eventType: "Document Approved", description: "ET1 claim form approved by client.", actor: "[Client Name]", hmacFingerprint: "3c8b5f0e9a7d1246" },
    { id: "ea9", timestamp: relDateTime(-5, "15:05"), eventType: "Secure Link Shared", description: "Schedule of loss shared with client via secure read-only link.", actor: "James Whitmore", hmacFingerprint: "a0d4f6e2c9b37158" },
    { id: "ea10", timestamp: relDateTime(-1, "09:00"), eventType: "Compliance Alert", description: "ET1 filing deadline alert triggered — ACAS certificate expected imminently.", actor: "LegalNote System", hmacFingerprint: "6e1c3b8f0d5a9274" },
  ],
};

const CONVEYANCING_LEAD_MATTER: DemoLeadMatter = {
  ref: "CONV/2025/0891",
  title: "Purchase — S. [Prospect], 14 Maple Avenue",
  clientName: "S. [Prospect]",
  solicitor: "Patricia Holden",
  firmName: "[Firm]",
  openedDate: relDate(-50),
  sessions: [
    {
      id: "cvs1",
      date: relDate(-49),
      duration: "50 min",
      type: "Initial Consultation",
      attendees: ["Patricia Holden (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Initial consultation on the purchase of 14 Maple Avenue. AML checks initiated, source of funds discussed, mortgage offer reviewed.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "cvs2",
      date: relDate(-22),
      duration: "35 min",
      type: "Searches & Enquiries Update",
      attendees: ["Patricia Holden (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Update on local authority search results, drainage search, and replies to pre-contract enquiries. Issues with planning history discussed.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  transcript: [
    { id: "cvt1", speaker: "Solicitor", timestamp: "00:00", text: "Hello, thank you for coming in. I'm Patricia Holden, your conveyancing solicitor. Before we start, I need to take your consent to record this meeting. The recording stays on our secure platform and is used only to produce an accurate note of the meeting. Do you consent?" },
    { id: "cvt2", speaker: "Client", timestamp: "00:19", text: "Yes, that's fine." },
    { id: "cvt3", speaker: "Solicitor", timestamp: "00:22", text: "Thank you. So, congratulations on having your offer accepted on 14 Maple Avenue. Let's go through everything that's going to happen between now and completion. First, I need to ask you some questions about your identity and source of funds — this is our anti-money laundering process and it's a legal requirement. Can you confirm the purchase price that was agreed?" },
    { id: "cvt4", speaker: "Client", timestamp: "00:44", text: "£385,000. We're using a mortgage from Halifax — we've had the mortgage offer through — and the rest is coming from savings we've built up over the last five years. About £60,000 of the deposit is from savings, and £25,000 is a gift from my parents." },
    { id: "cvt5", speaker: "Solicitor", timestamp: "01:05", text: "Right. So the deposit is made up of savings and a parental gift. We'll need to verify the source of the savings — that usually means three to six months of bank statements showing the gradual accumulation of those funds. And for the parental gift, we'll need a signed gift letter confirming it's a gift and not a loan, and confirmation of your parents' identity. Does that sound manageable?" },
    { id: "cvt6", speaker: "Client", timestamp: "01:32", text: "Yes. My parents were expecting that — they've done this before for my sister. I can get that to you this week." },
    { id: "cvt7", speaker: "Solicitor", timestamp: "01:40", text: "Perfect. Now, the Halifax mortgage offer — we'll need a copy of that. We act for Halifax as well as for you in this transaction, so we'll be checking that the title and the property satisfy their requirements alongside your own. Now, let me talk you through the key stages of the transaction. After we receive the draft contract pack from the seller's solicitors, we'll review the title and raise any enquiries. We'll also order the searches — local authority, drainage and water, environmental, and chancel repair. Those typically take two to three weeks to come back. Once we have everything, we'll send you a report on title, which is a comprehensive document explaining the property, its legal position, and any issues." },
    { id: "cvt8", speaker: "Client", timestamp: "02:35", text: "Is there anything specific about 14 Maple Avenue that I should be concerned about?" },
    { id: "cvt9", speaker: "Solicitor", timestamp: "02:42", text: "Nothing that we know of at this stage. The property is freehold, which is straightforward. The sellers have been there about twelve years. One thing I will flag — and this is just standard practice — the area around Maple Avenue sits in a zone that sometimes throws up drainage search issues. I'm not saying it will, but if the search shows that a public sewer runs under the property, that can affect what you're allowed to build. It shouldn't affect your purchase, but it's something to be aware of. I'll flag it when the searches come back." },
    { id: "cvt10", speaker: "Client", timestamp: "03:18", text: "Okay. When are we aiming to exchange contracts? We've got a deadline — we're renting and our tenancy ends in four months." },
    { id: "cvt11", speaker: "Solicitor", timestamp: "03:28", text: "Four months is a comfortable timeline for a straightforward purchase like this. I'd aim for exchange of contracts within six to eight weeks, which gives us another four to six weeks before a completion date you're comfortable with. Of course, if there's a chain, it can be more complex. Is the seller in a chain, do you know?" },
    { id: "cvt12", speaker: "Client", timestamp: "03:50", text: "I believe the seller is buying onward — a new build. I'm not sure how far along that is." },
    { id: "cvt13", speaker: "Solicitor", timestamp: "03:57", text: "New build onward purchases can add complexity because new builds often have delayed completion dates. We'll speak to the seller's solicitors to understand where that stands. It may mean we need to negotiate a longer completion period or a conditional arrangement. Now, on costs — the key figures for your budget are: Stamp Duty Land Tax, which I'll calculate on the full purchase price of £385,000. As a first-time buyer, you benefit from the first-time buyer relief. I'll confirm the exact figure in the report on title, but it's likely to be in the region of £4,250. Our conveyancing fees are £1,495 plus VAT. Land Registry fee is £270. Search fees are approximately £350. And you'll need to allow for the electronic transfer fee of £42 when it comes to completion." },
    { id: "cvt14", speaker: "Client", timestamp: "05:00", text: "That all makes sense. One thing I wanted to ask — my partner and I are buying together. We're not married. How should we hold the property?" },
    { id: "cvt15", speaker: "Solicitor", timestamp: "05:12", text: "Great question, and really important. There are two ways you can hold the property together: as joint tenants or as tenants in common. As joint tenants, you each own the whole property jointly — if one of you dies, the other automatically gets the whole property. As tenants in common, you each own a defined share — and if one of you dies, your share forms part of your estate and goes wherever your Will directs. Given that you're not married, I'd strongly recommend considering tenants in common if you're contributing different amounts to the purchase, so that your respective contributions are protected. And I'd also recommend you both have Wills in place before completion." },
    { id: "cvt16", speaker: "Client", timestamp: "06:05", text: "We're putting in roughly the same amount, but the gift is just in my name — my parents are only gifting to me. Does that affect things?" },
    { id: "cvt17", speaker: "Solicitor", timestamp: "06:15", text: "It can do. If £25,000 of the deposit is coming solely from you via your parents' gift, and you and your partner later separate, your partner might argue a 50/50 split of equity regardless of respective contributions. A Declaration of Trust — sometimes called a Deed of Trust — can formally record your respective beneficial interests and prevent any dispute later. I can prepare that for you at the same time as the conveyancing if you'd like — it's an additional cost of around £350." },
    { id: "cvt18", speaker: "Client", timestamp: "06:50", text: "Yes, I think we'd like to do that. Thank you for flagging it." },
    { id: "cvt19", speaker: "Solicitor", timestamp: "06:56", text: "Of course. Right — I think that covers the main points for today. To summarise: you're going to send me the mortgage offer, your bank statements for the last six months, and your parents' gift letter and ID by the end of the week. I'll chase the contract pack from the seller's solicitors and instruct searches. I'll be in touch as things progress. Do you have any other questions?" },
    { id: "cvt20", speaker: "Client", timestamp: "07:28", text: "No, I think that covers everything. Thank you — it's a lot to take in but you've made it very clear." },
    { id: "cvt21", speaker: "Solicitor", timestamp: "07:34", text: "That's what we're here for. We'll be in touch very shortly. Good luck." },
    { id: "cvt22", speaker: "Client", timestamp: "07:41", text: "One more question — if anything comes up on the searches that's a problem, can we still pull out?" },
    { id: "cvt23", speaker: "Solicitor", timestamp: "07:46", text: "Yes. Until exchange of contracts, you're not legally committed and either party can walk away. The searches are ordered precisely so that you can identify any issues before you become bound. If, for instance, the environmental search revealed contamination on the site, or if the local authority search showed a planning condition you weren't aware of, you'd have the full picture before exchange. After exchange, you're committed and pulling out would mean you forfeit your deposit and potentially face a claim for breach of contract from the seller. So the pre-exchange due diligence phase — which is what we're in now — is the time to raise any concerns. Once you've seen my report on title and you're happy with the search results, we'll fix an exchange date together." },
    { id: "cvt24", speaker: "Client", timestamp: "08:30", text: "And what about the survey? We've booked a HomeBuyer Report through a local surveyor — should we wait for the results before signing anything?" },
    { id: "cvt25", speaker: "Solicitor", timestamp: "08:38", text: "Absolutely. I would strongly recommend you wait for the survey results before proceeding to exchange. The HomeBuyer Report will flag any structural concerns, defects, or issues with the property that aren't visible in a normal viewing. If the survey identifies something significant — for example, damp, subsidence, or an ageing roof — you may want to renegotiate the purchase price or ask the seller to remedy the issue before exchange. It's completely normal to use survey findings as a basis for renegotiation. Your surveyor will also give you a reinstatement cost estimate which feeds into building insurance — you'll need buildings insurance in place from exchange date, not completion, because the risk in the property passes to you on exchange. I'll remind you about that nearer the time. For now, prioritise getting me the documents I've listed and let's get the searches underway." },
    { id: "cvt26", speaker: "Client", timestamp: "09:28", text: "Perfect. I'll get everything over to you by Friday. Thanks again, Patricia." },
    { id: "cvt27", speaker: "Solicitor", timestamp: "09:32", text: "Thank you. And congratulations once more — exciting times. We'll speak soon." },
    { id: "cvt28", speaker: "Client", timestamp: "09:41", text: "Actually — I had one more question. We're planning to do a loft conversion within the next couple of years. Does the purchase affect our ability to do that?" },
    { id: "cvt29", speaker: "Solicitor", timestamp: "09:48", text: "Good question to raise now. Planning permission for a loft conversion depends on several factors, including whether the permitted development rights for the property are unrestricted. Some properties have permitted development rights removed by a condition on the original planning permission — which would mean you'd need full planning consent for what would otherwise be permitted development. The local authority search will reveal whether there are any such conditions. Additionally, if you're in a conservation area or the property is listed, restrictions apply automatically. I'll flag anything relevant when the search results come back. For the structural work itself, you'll also need Building Regulations approval regardless of whether planning permission is required — that's a separate process from planning and covers safety and structural standards." },
    { id: "cvt30", speaker: "Client", timestamp: "10:30", text: "And would a loft conversion affect the mortgage? We'd want to borrow against the added value." },
    { id: "cvt31", speaker: "Solicitor", timestamp: "10:38", text: "If you want to borrow against the property after the conversion, you'd typically need to approach Halifax for a further advance or remortgage once the works are complete. The lender will want evidence that the works were done with appropriate permissions and to Building Regulations standard — they'll usually send a surveyor to value the improved property. From a conveyancing perspective, if the loft conversion creates a self-contained habitable space, you may also need to notify Halifax of the change and obtain their consent before starting works — your mortgage offer will contain a clause about alterations. I'd recommend reviewing that clause carefully when you receive the mortgage offer. For now, it's something to keep in mind for the future rather than a barrier to your purchase today. The important thing is to ensure all works are properly permitted and signed off when the time comes." },
    { id: "cvt32", speaker: "Client", timestamp: "11:22", text: "Perfect. Thank you for being so thorough — it's really put our minds at rest." },
    { id: "cvt33", speaker: "Solicitor", timestamp: "11:28", text: "That's what we're here for. You're making one of the biggest purchases of your lives and it should be done with full information and confidence. We'll be in regular contact throughout. Safe travels, and I look forward to completing on 14 Maple Avenue." },
    { id: "cvt34", speaker: "Client", timestamp: "11:36", text: "My partner has another question — what happens if the seller pulls out after we've already spent money on searches and surveys?" },
    { id: "cvt35", speaker: "Solicitor", timestamp: "11:42", text: "Unfortunately, this is one of the risks of the English conveyancing system — before exchange of contracts, there is no legal commitment on either side, and either party can withdraw for any reason without liability. This is called gazumping when the seller accepts a higher offer from another buyer, or simply a change of mind. If the seller pulls out pre-exchange, you cannot recover your search fees, survey costs, or legal fees from them. There is no legal mechanism to claim those costs from a seller who pulls out legitimately before exchange. The only protection available is insurance — specifically, an abortive costs insurance policy, sometimes called Home Buyers Protection Insurance, which you can purchase at the outset. It typically costs around £30 to £60 and covers your searches, survey, and legal fees up to a specified limit if the transaction falls through before exchange. I mention it at this stage — it's something you might want to consider given the outlay you've already committed to the HomeBuyer Report. Once exchange happens, both parties are fully committed and the seller cannot pull out without significant financial consequences." },
    { id: "cvt36", speaker: "Client", timestamp: "12:30", text: "I hadn't thought about that risk. I think we'll look into that insurance. Can you send the details?" },
    { id: "cvt37", speaker: "Solicitor", timestamp: "12:36", text: "Of course — I'll include a note about abortive costs insurance providers in my introductory letter, alongside everything else. It's an inexpensive and sensible precaution, particularly given the survey costs you've already committed. The important message is: once we get to exchange, you can relax on that front — the legal commitment is in place and we simply count down to completion. Right — I really must let you go now. We'll be in touch very soon. Congratulations again." },
  ],
  documents: [
    { id: "cvd1", title: "Attendance Note — Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDateTime(-49, "14:00") },
    { id: "cvd2", title: "Client Care Letter", type: "Client Care Letter", status: "approved", generatedAt: relDateTime(-49, "16:30") },
    { id: "cvd3", title: "Report on Title", type: "Report on Title", status: "draft", generatedAt: relDateTime(-22, "11:45") },
    { id: "cvd4", title: "Declaration of Trust", type: "Deed of Trust", status: "approved", generatedAt: relDateTime(-10, "09:00") },
  ],
  transcriptWordCount: 2012,
  transcriptDuration: "50 min",
  attendanceNoteBody: `ATTENDANCE NOTE

Matter Reference: CONV/2025/0891
Matter: Purchase — [Client Name], 14 Maple Avenue
Solicitor: Patricia Holden
Date: ${relDate(-49)}
Duration: 50 minutes
Attendees: Patricia Holden (Solicitor), [Client Name] (Client)

---

PURPOSE OF MEETING

Initial consultation to advise on the conveyancing process for the purchase of 14 Maple Avenue at a purchase price of £385,000.

---

BACKGROUND

Clients are first-time buyers purchasing a freehold property. Mortgage offer in place from Halifax. Deposit structure: £60,000 savings; £25,000 parental gift (gift, not loan). Sellers are purchasing onward — a new build property.

---

KEY DISCUSSION POINTS

1. Anti-Money Laundering — Source of Funds
The solicitor confirmed AML obligations. Client to provide: (a) 6 months' bank statements evidencing accumulation of savings; (b) signed gift letter from parents confirming gifted funds; (c) parental identity documents. Mortgage offer copy also required.

2. Transaction Timeline
Aim: exchange within 6–8 weeks; completion within 4 months to align with expiry of rental tenancy. Note: seller's onward new build purchase may add complexity — solicitor to make enquiries of seller's solicitors as to new build completion timetable.

3. Searches
Local authority, drainage and water, environmental and chancel repair searches to be instructed. Solicitor flagged the Maple Avenue area sometimes returns drainage search issues (public sewer proximity). No action required unless confirmed.

4. Costs Summary
SDLT (first-time buyer relief): estimated £4,250. Conveyancing fees: £1,495 + VAT. Land Registry: £270. Searches: approximately £350. Electronic transfer fee: £42.

5. Tenancy Structure and Declaration of Trust
Clients are unmarried co-purchasers with differing contribution structures (parental gift in client's name only). Solicitor advised on joint tenants vs. tenants in common. Recommended Declaration of Trust to formally record beneficial interests — fee £350. Client accepted this recommendation.

---

ACTION POINTS

Client:
- Send mortgage offer copy
- Provide 6 months' bank statements
- Obtain and send parents' gift letter and ID documents

Solicitor:
- Chase contract pack from seller's solicitors
- Instruct searches
- Prepare Declaration of Trust — to be agreed before exchange
- Confirm new build completion position with seller's solicitors
- Issue client care letter

---

Compiled from session recording. Manual compilation typically takes 45-60 minutes per hour of meeting. Verified and approved by Patricia Holden.`,
  undertakings: [
    { id: "cvu1", description: "Provide client care letter and cost schedule", givenBy: "Patricia Holden (Solicitor)", givenTo: "[Client Name]", dueDate: relDate(-49), status: "completed" },
    { id: "cvu2", description: "Verify AML documents and source of funds before exchange", givenBy: "Patricia Holden (Solicitor)", givenTo: "Halifax (Lender)", dueDate: relDate(-10), status: "overdue" },
    { id: "cvu3", description: "Report on title to be provided to client and Halifax prior to exchange", givenBy: "Patricia Holden (Solicitor)", givenTo: "[Client Name]", dueDate: relDate(5), status: "outstanding" },
  ],
  timeEntries: [
    { id: "cvte1", date: relDate(-49), description: "Initial consultation — 50 minutes", units: 3.3, rate: 280, fee: 924 },
    { id: "cvte2", date: relDate(-48), description: "AML checks and identity verification", units: 0.5, rate: 280, fee: 140 },
    { id: "cvte3", date: relDate(-44), description: "Review contract pack from seller's solicitors", units: 1.5, rate: 280, fee: 420 },
    { id: "cvte4", date: relDate(-38), description: "Instruct searches and review mortgage offer", units: 0.8, rate: 280, fee: 224 },
    { id: "cvte5", date: relDate(-22), description: "Searches update call — 35 minutes", units: 2.3, rate: 280, fee: 644 },
    { id: "cvte6", date: relDate(-15), description: "Drafting report on title", units: 2.5, rate: 280, fee: 700 },
  ],
  auditTrail: [
    { id: "cva1", timestamp: relDateTime(-49, "11:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "5d8f2c1a9e3b0467" },
    { id: "cva2", timestamp: relDateTime(-49, "11:03"), eventType: "Recording Started", description: "Secure audio recording commenced for matter CONV/2025/0891, session cvs1.", actor: "LegalNote System", hmacFingerprint: "a1e4b7c0f52d8396" },
    { id: "cva3", timestamp: relDateTime(-49, "11:53"), eventType: "Recording Completed", description: "Recording ended. Duration: 50 minutes 24 seconds. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "3f6a9d2b0c8e5147" },
    { id: "cva4", timestamp: relDateTime(-49, "12:08"), eventType: "Transcript Produced", description: "AI transcription completed. 2,012 words. Diarization: 2 speakers. Confidence: 98.1%.", actor: "LegalNote AI Engine", hmacFingerprint: "c7b0e3a4f1d28596" },
    { id: "cva5", timestamp: relDateTime(-49, "12:11"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated from transcript. Document ID: cvd1.", actor: "LegalNote AI Engine", hmacFingerprint: "8a2d5f0b3e94c617" },
    { id: "cva6", timestamp: relDateTime(-49, "16:20"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Patricia Holden.", actor: "Patricia Holden", hmacFingerprint: "f3c9a5d1b78e2040" },
    { id: "cva7", timestamp: relDateTime(-44, "10:30"), eventType: "AML Check Initiated", description: "AML source of funds verification process commenced. Awaiting client documents.", actor: "Patricia Holden", hmacFingerprint: "2e7b4a1f9c0d3685" },
    { id: "cva8", timestamp: relDateTime(-22, "14:00"), eventType: "Recording Started", description: "Secure recording commenced — session cvs2 (searches update).", actor: "LegalNote System", hmacFingerprint: "6d3f8c0a5b1e7924" },
    { id: "cva9", timestamp: relDateTime(-1, "09:00"), eventType: "Compliance Alert", description: "AML source of funds verification overdue — exchange cannot proceed.", actor: "LegalNote System", hmacFingerprint: "b4e9f2a0c7d36185" },
    { id: "cva10", timestamp: relDateTime(-1, "09:01"), eventType: "Compliance Alert", description: "Local authority search results not yet reviewed and reported to client.", actor: "LegalNote System", hmacFingerprint: "0a5c8f3e1d97b462" },
  ],
};

const IMMIGRATION_LEAD_MATTER: DemoLeadMatter = {
  id: "imm-lead",
  ref: "IMM/2025/0512",
  title: "Skilled Worker Visa Application — [Client Name]",
  clientName: "A. [Prospect]",
  practiceArea: "immigration",
  solicitor: "Priya Chandra",
  firmName: "[Firm]",
  openedDate: relDate(-30),
  sessions: [
    {
      id: "ims1",
      date: relDate(-29),
      duration: "55 min",
      type: "Initial Consultation",
      attendees: ["Priya Chandra (Solicitor)", "A. [Prospect] (Client)"],
      summary: "Initial consultation covering the client's eligibility for a Skilled Worker visa, their current employer's Sponsor Licence status, and the documents required to support a successful application.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "ims2",
      date: relDate(-10),
      duration: "30 min",
      type: "Document Review",
      attendees: ["Priya Chandra (Solicitor)", "A. [Prospect] (Client)"],
      summary: "Review of payslips, degree certificate, and Certificate of Sponsorship. Gaps in evidence identified and remedial steps agreed.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "imd1", title: "Attendance Note — Skilled Worker Visa Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-29) },
    { id: "imd2", title: "Client Care Letter — A. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-29) },
    { id: "imd3", title: "Document Checklist — Skilled Worker Application", type: "Checklist", status: "approved", generatedAt: relDate(-28) },
    { id: "imd4", title: "Covering Letter — Home Office Submission", type: "Submission Letter", status: "draft", generatedAt: relDate(-2) },
  ],
  transcript: [
    { id: "imt1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good afternoon, [Client Name]. Thank you for coming in today. I'm Priya Chandra and I specialise in UK immigration law. Before we begin, I need to let you know that with your consent I'll be recording this meeting. The recording is encrypted and processed solely to produce an accurate attendance note. Are you happy with that?" },
    { id: "imt2", speaker: "Client", timestamp: "00:00:22", text: "Yes, that's completely fine. Thank you for seeing me at short notice." },
    { id: "imt3", speaker: "Solicitor", timestamp: "00:00:27", text: "Of course. Let's start at the beginning. Can you tell me a little about your current immigration status and what's brought you to see me today?" },
    { id: "imt4", speaker: "Client", timestamp: "00:00:34", text: "I'm currently on a Tier 2 General visa which has about four months left. My employer, DataSphere UK, has offered me a permanent role as a Senior Data Engineer. They have a Sponsor Licence and they've told me I need a Skilled Worker visa to stay. I've never done this before so I'm not sure where to start." },
    { id: "imt5", speaker: "Solicitor", timestamp: "00:01:08", text: "That's very helpful context. A Skilled Worker visa is absolutely the right route in your situation. The good news is that DataSphere already holds a Sponsor Licence — that removes one of the biggest potential hurdles. The key requirements we need to satisfy are: a valid Certificate of Sponsorship from them, a salary at or above the going rate for your role, a minimum general salary threshold, and confirmation that you meet the English language requirement." },
    { id: "imt6", speaker: "Client", timestamp: "00:01:43", text: "DataSphere has already issued the Certificate of Sponsorship — they gave me the reference number yesterday. And my salary will be £58,000, which I believe is above the going rate." },
    { id: "imt7", speaker: "Solicitor", timestamp: "00:01:52", text: "£58,000 is indeed above the general threshold of £38,700 per annum, and the going rate for Senior Data Engineer under SOC code 2136 is currently around £48,500 — so you clear both comfortably. That's excellent. Now, the Certificate of Sponsorship reference — do you have that to hand? I'll want to check it's assigned and not expired." },
    { id: "imt8", speaker: "Client", timestamp: "00:02:14", text: "Yes, here it is — reference E2A7-XKQM-BT49." },
    { id: "imt9", speaker: "Solicitor", timestamp: "00:02:19", text: "Thank you, I'll verify that against the Sponsor Management System. Now, English language. You've told me you completed your degree at Leeds — was that taught in English?" },
    { id: "imt10", speaker: "Client", timestamp: "00:02:30", text: "Yes, my BSc Computer Science is from the University of Leeds. I've been here on a student visa and then the Tier 2 for six years in total." },
    { id: "imt11", speaker: "Solicitor", timestamp: "00:02:40", text: "Excellent. A degree from a recognised UK university taught in English satisfies the English language requirement — you won't need to sit an IELTS or any other English test, which saves both time and cost. Now let's talk about documents. The core bundle for a Skilled Worker application will include your current passport, the Certificate of Sponsorship, your degree certificate and transcript, your last three months' payslips from your current employer showing salary continuity, a bank statement, and a photograph meeting Home Office biometric specifications." },
    { id: "imt12", speaker: "Client", timestamp: "00:03:25", text: "I have my passport and payslips. My degree certificate is in storage at my parents' house in Birmingham. I can get it this weekend. Is a photocopy acceptable?" },
    { id: "imt13", speaker: "Solicitor", timestamp: "00:03:35", text: "For the online application a clear colour scan is perfectly acceptable. The Home Office does reserve the right to request originals at a later stage, but in practice for a straightforward Skilled Worker application a certified scan is sufficient. If the document is in a language other than English you would need a certified translation, but as your degree is from Leeds that doesn't apply here." },
    { id: "imt14", speaker: "Client", timestamp: "00:03:58", text: "That's reassuring. What about my current employer's payslips — my last three months are from my current temporary contract, not from DataSphere. Will that be an issue?" },
    { id: "imt15", speaker: "Solicitor", timestamp: "00:04:08", text: "No. The payslips requirement is primarily to demonstrate maintenance — that you have sufficient funds to support yourself — not necessarily from the sponsoring employer. Your maintenance funds can also be evidenced by a UK bank account holding at least £1,270 for 28 consecutive days prior to the application date. Do you have that comfortably?" },
    { id: "imt16", speaker: "Client", timestamp: "00:04:30", text: "Yes, I have well over that in my current account — probably around £8,000." },
    { id: "imt17", speaker: "Solicitor", timestamp: "00:04:36", text: "Perfect. You'll need a bank statement dated within 31 days of your application date showing that £1,270 balance for the 28-day period. We'll time the application submission carefully to ensure that window falls in the right place. Now I want to talk about the timeline. Your current visa expires in four months. An online Skilled Worker application with standard processing takes up to eight weeks — but with the two to three weeks it will take us to assemble your full document bundle, you have a comfortable but not excessive margin. I would want to submit within the next six weeks." },
    { id: "imt18", speaker: "Client", timestamp: "00:05:21", text: "Is it possible to pay for priority processing to speed things up? My employer is keen for me to have the new visa confirmed before I start the permanent role next month." },
    { id: "imt19", speaker: "Solicitor", timestamp: "00:05:31", text: "Yes — the Home Office offer a Priority Service costing £500 on top of the application fee, which gives a target decision within five working days. And a Super Priority Service at £1,000 target next working day, though that's only available at certain times and the slots fill quickly. Given your timeline and your employer's requirements, I would strongly recommend Priority Service at a minimum. The Skilled Worker application fee itself depends on the duration applied for — if we apply for three years it's £1,035; for five years, £1,490 for individuals. Then there's the Immigration Health Surcharge, currently £1,035 per year, so for a five-year grant that's £5,175. These are Home Office fees payable directly — separate from our professional fees." },
    { id: "imt20", speaker: "Client", timestamp: "00:06:31", text: "I'd like to apply for five years if that's the right choice. My intention is to apply for Indefinite Leave to Remain after the five years." },
    { id: "imt21", speaker: "Solicitor", timestamp: "00:06:40", text: "That's a sensible long-term plan. After five continuous years on a Skilled Worker visa — counting time in closely related previous categories, including your Tier 2 period — you can apply for ILR. We'll want to keep very careful records of any absences over 180 days in any 12-month rolling period, as that's the threshold that can break continuous residence for ILR purposes. I'll note that on your file and flag it proactively as we approach the five-year mark. Now, are there any dependants who would be travelling or residing with you in the UK?" },
    { id: "imt22", speaker: "Client", timestamp: "00:07:20", text: "My partner — we're not married. Can they join me on a dependent visa?" },
    { id: "imt23", speaker: "Solicitor", timestamp: "00:07:25", text: "Yes — an unmarried partner can be included as a dependent provided you can demonstrate that you've been in a relationship akin to marriage for at least two years. Evidence typically includes shared utility bills, a joint bank account, tenancy agreement, or similar. Do you have that?" },
    { id: "imt24", speaker: "Client", timestamp: "00:07:44", text: "We've lived together for three years. We have a joint tenancy and joint bank account." },
    { id: "imt25", speaker: "Solicitor", timestamp: "00:07:50", text: "Excellent — that will be straightforward. Their application must be submitted concurrently with or after yours, not before. There'll be a separate application fee and IHS charge for them. I'll include a dependent application checklist in your client care letter. Before we finish, let me summarise the key next steps. First, locate and scan your degree certificate and transcript. Second, obtain a 28-day bank statement from your account showing the £1,270 maintenance funds. Third, get three payslips from your current employer — even from the temporary contract. Fourth, send me your partner's passport and two years' evidence of your relationship. Fifth, I will verify the Certificate of Sponsorship reference and begin drafting the application. We're aiming for submission in five to six weeks. Any questions for me today?" },
    { id: "imt26", speaker: "Client", timestamp: "00:08:50", text: "No — that's all very clear. Thank you, Priya. I feel much more confident about the process now. I'll collect the degree certificate this weekend and email everything to you early next week." },
    { id: "imt27", speaker: "Solicitor", timestamp: "00:09:00", text: "Perfect. I'll send you a client care letter and a detailed document checklist by close of business today. We'll keep in close contact. Thank you, [Client Name]." },
    { id: "imt28", speaker: "Client", timestamp: "00:09:12", text: "One last thing — my visa currently says Tier 2 General on it. Will the Skilled Worker visa look different? I ask because I'm applying for a mortgage shortly after I expect to receive it and the lender asked for evidence of my immigration status." },
    { id: "imt29", speaker: "Solicitor", timestamp: "00:09:25", text: "Great question. The Skilled Worker visa will be endorsed in your passport with a Biometric Residence Permit, or BRP, which serves as your evidence of immigration status. The BRP will show your right to work and the expiry date of your leave. Most mortgage lenders will accept a Skilled Worker BRP alongside your passport for AML and right-to-reside verification. Some may also ask for a Home Office digital status check through the share codes system — that's a government-provided shareable code you give to third parties so they can view your immigration status online without needing to see your physical BRP. If the mortgage lender asks for that, it takes about two minutes to generate through the Home Office portal. I'll include a note about this in your client care letter." },
    { id: "imt30", speaker: "Client", timestamp: "00:10:05", text: "That's very useful, thank you. And one more practical question — while my application is being processed, am I allowed to continue working?" },
    { id: "imt31", speaker: "Solicitor", timestamp: "00:10:14", text: "Yes, critically so. Because your current Tier 2 visa is still valid when you submit the Skilled Worker application — which we're targeting to happen before your Tier 2 expires — you will be on what the Home Office call '3C leave'. That means your existing visa is automatically extended under section 3C of the Immigration Act 1971 while your application is pending. Your right to work, and crucially your right to stay in the UK, continues uninterrupted. Your employer should be provided with a copy of the application submission confirmation or the CAS reference number to confirm 3C leave to their HR department. I'll prepare a template letter you can give to DataSphere's HR team once we've submitted. This is standard practice and shouldn't cause any difficulty with your employment." },
    { id: "imt32", speaker: "Client", timestamp: "00:11:00", text: "That's such a relief. I was very worried about a gap in my right to work." },
    { id: "imt33", speaker: "Solicitor", timestamp: "00:11:06", text: "Completely understandable — it's one of the most common concerns in this type of application. The important thing is that we submit before your Tier 2 expires. As long as we do that, 3C leave protects you fully. Let's say goodbye for today. I'll have everything in your inbox by close of business. Please don't hesitate to call or email if anything comes up before then." },
    { id: "imt34", speaker: "Client", timestamp: "00:11:20", text: "Thank you. I wanted to ask — can my wife work while I'm applying? She's currently on a dependent visa under my Tier 2." },
    { id: "imt35", speaker: "Solicitor", timestamp: "00:11:28", text: "Yes, she can. Under a Tier 2 dependent visa, your wife has a full right to work in the UK — there are no restrictions on the type of work she can do or the number of hours. When your application for a Skilled Worker visa is submitted, she should apply simultaneously to switch to a Skilled Worker Dependent visa. This keeps her status in perfect alignment with yours throughout the process. Her dependent application mirrors yours in terms of immigration status — as long as your application is successful, hers will follow. If there are any complications with your main application, her position is directly affected, which is another reason we want the main application to be as strong as possible. I'll include the dependent application in our scope of work and prepare her documentation alongside yours." },
    { id: "imt36", speaker: "Client", timestamp: "00:12:10", text: "I hadn't realised she needed to apply separately. Is there an additional cost?" },
    { id: "imt37", speaker: "Solicitor", timestamp: "00:12:17", text: "Yes, there is a separate Home Office fee for the dependent application — currently £1,235 — plus the Immigration Health Surcharge at £1,035 per year of visa duration. For a five-year Skilled Worker Dependent visa, that's £5,175 in IHS for your wife alone. I'll set that out in the detailed cost breakdown I send you this afternoon. Some employers will reimburse the Home Office fees and IHS for dependants as part of the relocation support package — it's worth checking with DataSphere's HR team. The legal fees for the dependent application are a fixed supplement which I'll include in the fee letter. Now — I think we've covered everything thoroughly today. My assistant will send you the documentation checklist, fee agreement, and a timeline within the hour. Please prioritise getting me the CAS from DataSphere." },
  ],
  attendanceNoteBody: `**Matter:** Skilled Worker Visa Application — [Client Name]
**Reference:** IMM/2025/0512
**Date of Attendance:** ${relDate(-29)}
**Solicitor:** Priya Chandra
**Client Present:** [Client Name] (A. [Prospect])
**Duration:** 55 minutes

---

**1. Introduction and Recording Consent**

The solicitor introduced herself and obtained the client's verbal consent to record the attendance. The purpose of the recording — production of an encrypted attendance note — was explained. Consent confirmed.

**2. Current Immigration Status and Background**

The client is currently in the UK on a Tier 2 (General) visa with approximately four months until expiry. The client has been in the UK continuously for six years across a Student visa and Tier 2 period. The client has been offered a permanent position as Senior Data Engineer with DataSphere UK Ltd, who hold a current Sponsor Licence.

**3. Route Confirmed: Skilled Worker Visa**

The Skilled Worker visa was confirmed as the appropriate route. Key eligibility criteria discussed:
- Certificate of Sponsorship (COS) assigned by DataSphere UK — reference E2A7-XKQM-BT49. Solicitor to verify against Sponsor Management System.
- Salary: £58,000 per annum, exceeding both the general threshold (£38,700) and the going rate for SOC 2136 Senior Data Engineer (approx. £48,500).
- English Language: Client holds a BSc Computer Science from the University of Leeds (taught in English) — satisfies the English language requirement without further testing.

**4. Document Requirements Discussed**

Core application bundle agreed:
1. Current passport (client has)
2. Certificate of Sponsorship reference (confirmed)
3. Degree certificate and transcript — original in Birmingham; client to collect and scan this weekend
4. Three months' payslips from current employer
5. 28-day bank statement demonstrating maintenance funds (£1,270 minimum; client holds approx. £8,000)
6. Biometric photograph

Note: photocopy/scan of degree certificate is acceptable for online submission. Certified translation not required (English-language document).

**5. Maintenance Funds**

Client confirmed bank balance of approximately £8,000. A bank statement dated within 31 days of submission and showing 28 consecutive days at or above £1,270 is required. Timing of submission to be managed to ensure this window falls correctly.

**6. Application Fees and Processing**

Standard processing: up to 8 weeks. Recommended Priority Service (5 working days, £500). Application fees: £1,490 (5-year grant). Immigration Health Surcharge: £1,035 per year × 5 = £5,175. Fees are payable direct to the Home Office.

**7. Long-Term Planning: ILR Pathway**

Client wishes to apply for Indefinite Leave to Remain after five years on Skilled Worker. Solicitor confirmed eligibility pathway. Continuous residence requirement (no absences exceeding 180 days in any 12-month rolling period) noted. File flag to be created for ILR monitoring.

**8. Dependant Partner**

Client's unmarried partner of three years wishes to reside in the UK as a dependant. Joint tenancy and bank account confirmed as supporting evidence. Concurrent dependant application to be filed. Dependant checklist to be included in client care letter.

**9. Next Steps**

1. Solicitor to issue Client Care Letter and Document Checklist today.
2. Client to collect and scan degree certificate this weekend.
3. Client to obtain 28-day bank statement.
4. Client to forward three payslips from current employer.
5. Client to forward partner's passport and two years' relationship evidence.
6. Solicitor to verify COS reference and commence application drafting.
7. Target submission: 5–6 weeks from today.

**10. Compliance Note**

This attendance note was generated by LegalNote AI Engine from the encrypted recording. Reviewed and approved by Priya Chandra. HMAC-SHA256 audit fingerprint logged.`,
  undertakings: [
    { id: "imu1", description: "Issue Client Care Letter and Document Checklist by close of business today.", givenBy: "Priya Chandra", givenTo: "[Client Name]", dueDate: relDate(-28), status: "completed" },
    { id: "imu2", description: "Verify Certificate of Sponsorship reference E2A7-XKQM-BT49 against Sponsor Management System.", givenBy: "Priya Chandra", givenTo: "[Firm] Compliance", dueDate: relDate(-25), status: "completed" },
    { id: "imu3", description: "Submit Priority Skilled Worker application to the Home Office within 6 weeks.", givenBy: "Priya Chandra", givenTo: "[Client Name]", dueDate: relDate(6), status: "outstanding" },
  ],
  timeEntries: [
    { id: "imte1", date: relDate(-29), description: "Initial consultation — 55 minutes", units: 3.7, rate: 250, fee: 925 },
    { id: "imte2", date: relDate(-29), description: "Client care letter and document checklist", units: 0.5, rate: 250, fee: 125 },
    { id: "imte3", date: relDate(-28), description: "COS verification — Sponsor Management System check", units: 0.3, rate: 250, fee: 75 },
    { id: "imte4", date: relDate(-10), description: "Document review session — 30 minutes", units: 2.0, rate: 250, fee: 500 },
  ],
  auditTrail: [
    { id: "ima1", timestamp: relDateTime(-29, "14:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "3a7e1d5c9b0f2468" },
    { id: "ima2", timestamp: relDateTime(-29, "14:03"), eventType: "Recording Started", description: "Secure audio recording commenced — matter IMM/2025/0512, session ims1.", actor: "LegalNote System", hmacFingerprint: "b8f4c2e0a6d13795" },
    { id: "ima3", timestamp: relDateTime(-29, "14:58"), eventType: "Recording Completed", description: "Recording ended. Duration: 55 minutes 12 seconds. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "6d0a8e3f1c5b9274" },
    { id: "ima4", timestamp: relDateTime(-29, "15:14"), eventType: "Transcript Produced", description: "AI transcription completed. 2,015 words. Diarization: 2 speakers. Confidence: 97.6%.", actor: "LegalNote AI Engine", hmacFingerprint: "e2c7a0f4d8b13956" },
    { id: "ima5", timestamp: relDateTime(-29, "15:17"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated from transcript. Document ID: imd1.", actor: "LegalNote AI Engine", hmacFingerprint: "9f3b5d1a0e8c2647" },
    { id: "ima6", timestamp: relDateTime(-29, "17:45"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Priya Chandra.", actor: "Priya Chandra", hmacFingerprint: "4c8f2a6e0b7d3195" },
    { id: "ima7", timestamp: relDateTime(-28, "09:15"), eventType: "COS Verified", description: "Certificate of Sponsorship E2A7-XKQM-BT49 confirmed valid and assigned on SMS.", actor: "Priya Chandra", hmacFingerprint: "7a1e4c8b0d6f2395" },
    { id: "ima8", timestamp: relDateTime(-10, "11:00"), eventType: "Recording Started", description: "Secure recording commenced — session ims2 (document review).", actor: "LegalNote System", hmacFingerprint: "2b6f9d0a5c3e8174" },
    { id: "ima9", timestamp: relDateTime(-3, "09:00"), eventType: "Compliance Alert", description: "Application submission deadline approaching — 6-week target. Documents outstanding: degree certificate.", actor: "LegalNote System", hmacFingerprint: "d5c1f8a3b70e9462" },
    { id: "ima10", timestamp: relDateTime(-3, "09:01"), eventType: "Compliance Alert", description: "Partner dependant application documents not yet received — concurrent submission at risk.", actor: "LegalNote System", hmacFingerprint: "1e4a7b9c2f6d0538" },
  ],
};

const PRIVATE_CLIENT_LEAD_MATTER: DemoLeadMatter = {
  id: "pc-lead",
  ref: "PROB/2025/0223",
  title: "Estate Administration — [Client Name] (Deceased)",
  clientName: "S. [Prospect]",
  practiceArea: "private-client",
  solicitor: "Rachel Obi",
  firmName: "[Firm]",
  openedDate: relDate(-45),
  sessions: [
    {
      id: "pcs1",
      date: relDate(-44),
      duration: "60 min",
      type: "Initial Consultation",
      attendees: ["Rachel Obi (Solicitor)", "S. [Prospect] (Client/Executor)"],
      summary: "Initial consultation with the sole executor following the death of their parent. Estate assets, liabilities, and IHT exposure discussed. Grant of probate and administration timeline established.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "pcs2",
      date: relDate(-15),
      duration: "45 min",
      type: "IHT Review",
      attendees: ["Rachel Obi (Solicitor)", "S. [Prospect] (Client/Executor)"],
      summary: "Review of IHT400 inheritance tax return. Property valuation accepted by HMRC. Agricultural relief query raised and being investigated.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "pcd1", title: "Attendance Note — Estate Administration Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-44) },
    { id: "pcd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-44) },
    { id: "pcd3", title: "IHT400 Inheritance Tax Return — Draft", type: "HMRC Return", status: "draft", generatedAt: relDate(-4) },
    { id: "pcd4", title: "Grant of Probate Application", type: "Probate Application", status: "pending_review", generatedAt: relDate(-2) },
  ],
  transcript: [
    { id: "pct1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good morning, [Client Name]. I'm Rachel Obi, a private client solicitor. Before we begin, with your consent I'll record this meeting to produce an accurate attendance note. The recording is encrypted and held securely. Are you happy to proceed?" },
    { id: "pct2", speaker: "Client", timestamp: "00:00:18", text: "Yes, of course. Thank you for accommodating me at short notice. As I mentioned on the phone, my father passed away three weeks ago and I'm the sole executor." },
    { id: "pct3", speaker: "Solicitor", timestamp: "00:00:28", text: "Please accept my sincere condolences. I'll do my best to make this process as straightforward as possible for you. Let's start by understanding the estate. Can you tell me the main assets?" },
    { id: "pct4", speaker: "Client", timestamp: "00:00:40", text: "The main asset is the family home in Oxford — I believe it's worth around £680,000. There's a cash ISA with Barclays, roughly £95,000, and a stocks and shares ISA holding about £42,000. My father had a state pension and a small defined contribution pension pot, but no private defined benefit pension." },
    { id: "pct5", speaker: "Solicitor", timestamp: "00:01:12", text: "Is there a surviving spouse or civil partner?" },
    { id: "pct6", speaker: "Client", timestamp: "00:01:15", text: "No, my mother passed away four years ago." },
    { id: "pct7", speaker: "Solicitor", timestamp: "00:01:18", text: "So the nil-rate band and residence nil-rate band from your mother's estate may be available for transfer to your father's estate — this could significantly reduce the IHT liability. Do you know whether your mother's estate used her nil-rate band?" },
    { id: "pct8", speaker: "Client", timestamp: "00:01:32", text: "Everything passed to my father on her death — her will left everything to him. So I don't think she used any of her nil-rate band." },
    { id: "pct9", speaker: "Solicitor", timestamp: "00:01:40", text: "That's very helpful. In that case, your father's estate potentially benefits from two full nil-rate bands — currently £325,000 each, so £650,000 combined — plus up to two residence nil-rate bands of £175,000 each, so potentially £350,000 between them, giving a combined threshold of up to £1 million if the property passes to direct descendants. You are the direct descendant and you are inheriting. Can I ask — what does your father's will say about the property?" },
    { id: "pct10", speaker: "Client", timestamp: "00:02:20", text: "Everything passes to me as the sole beneficiary. There are some specific legacies — £5,000 to each of two grandchildren and a painting to a friend — but everything else, including the house, comes to me." },
    { id: "pct11", speaker: "Solicitor", timestamp: "00:02:32", text: "Excellent. So the total estate is approximately £817,000. With the combined thresholds of up to £1 million, if the transferable nil-rate bands are confirmed, the estate should fall entirely below the IHT threshold and no inheritance tax should be payable — subject to us confirming the transferable nil-rate band claim with evidence from your mother's estate. Do you have your mother's death certificate and a copy of her will?" },
    { id: "pct12", speaker: "Client", timestamp: "00:02:58", text: "I have both. I'll bring them to our next meeting." },
    { id: "pct13", speaker: "Solicitor", timestamp: "00:03:03", text: "Perfect. We'll still need to complete IHT400 and the relevant schedules because the estate exceeds £650,000, even though we expect no tax to be due. We'll submit the claim for both transferable nil-rate bands and the RNRB — and HMRC will confirm. Now, the estate exceeds the gross value threshold requiring a full grant of probate from the Probate Registry. Have any steps been taken to notify HMRC about the estate?" },
    { id: "pct14", speaker: "Client", timestamp: "00:03:38", text: "Not yet. I've notified the banks and they've frozen the accounts, but nothing with HMRC." },
    { id: "pct15", speaker: "Solicitor", timestamp: "00:03:45", text: "That's exactly as expected. The IHT account must be submitted before we can obtain the grant of probate. Once the IHT400 is submitted and HMRC acknowledge the return — which takes around four to six weeks — we can apply to the Probate Registry. The grant itself usually takes a further four to six weeks. We're looking at a total administration timeline of four to nine months once we have all the information." },
    { id: "pct16", speaker: "Client", timestamp: "00:04:20", text: "Is there anything I should be doing now? The mortgage on the house is paid off and there is no debt, but I'm slightly worried about the house insurance lapsing." },
    { id: "pct17", speaker: "Solicitor", timestamp: "00:04:31", text: "Very important point — you need to notify the insurer immediately that your father has died and that the property is now unoccupied. Some policies have conditions on unoccupied properties; you may need specialist probate property insurance in the interim. I'd advise you to do that today if you haven't already. Also, if there's any mortgage protection or life insurance policy, I'll need details of that — though you've said the mortgage is paid off, so that may not be relevant." },
    { id: "pct18", speaker: "Client", timestamp: "00:04:58", text: "He had a life insurance policy too — I think it's about £50,000 with Aviva. Is that part of the estate?" },
    { id: "pct19", speaker: "Solicitor", timestamp: "00:05:05", text: "That depends on whether there's a nomination or trust arrangement. If it's written in trust, it passes directly to the nominated beneficiary and sits outside the estate — both for probate and for IHT. If not, it forms part of the estate. You'll need to contact Aviva and ask whether the policy has a trust or nomination in place. That's another key action for this week. Now, let me summarise the next steps clearly..." },
    { id: "pct20", speaker: "Client", timestamp: "00:05:38", text: "Please, yes — it's a lot to take in." },
    { id: "pct21", speaker: "Solicitor", timestamp: "00:05:42", text: "Of course. First, contact your father's insurer today to arrange probate property insurance. Second, contact Aviva to determine whether the life policy is written in trust. Third, bring me your mother's death certificate and will at our next meeting. Fourth, I will prepare the IHT400 and relevant schedules and come back to you to review before we submit to HMRC. Fifth, once HMRC acknowledge the return, we'll apply for the grant of probate. I'll send you a full client care letter and task list by the end of today. Do you have any questions?" },
    { id: "pct22", speaker: "Client", timestamp: "00:06:20", text: "No, I think that's all very clear. It's a relief to have a plan. Thank you so much, Rachel." },
    { id: "pct23", speaker: "Solicitor", timestamp: "00:06:28", text: "You're very welcome, [Client Name]. I'm sorry for your loss and I'll be in touch shortly." },
    { id: "pct24", speaker: "Client", timestamp: "00:06:38", text: "Before I go — my father had a share portfolio with Hargreaves Lansdown. I didn't mention it earlier. I'm not sure what it's worth but the last statement I saw was around £28,000. Does that need to be in the estate?" },
    { id: "pct25", speaker: "Solicitor", timestamp: "00:06:45", text: "Yes, absolutely — all assets in your father's sole name form part of the estate for probate and IHT purposes. A shares portfolio with Hargreaves Lansdown will need to be notified to them, the current value established as at the date of death, and included in the IHT400 assets schedule. Contact Hargreaves Lansdown's bereavement team with a copy of the death certificate — they'll freeze the account and confirm the date-of-death valuation. The good news is that at £28,000 it won't push the estate above the combined threshold of up to £1 million — so the IHT position we've discussed shouldn't be affected. But it is essential that we include it. I'll add it to the estate summary I send you today." },
    { id: "pct26", speaker: "Client", timestamp: "00:07:15", text: "Understood. I'll contact Hargreaves Lansdown this week. And one more thing — my father had a National Savings and Investments account, I think Premium Bonds. What happens to those?" },
    { id: "pct27", speaker: "Solicitor", timestamp: "00:07:22", text: "Premium Bonds are a very common asset in estates. NS&I have their own bereavement service — you'll need to complete a notification form on their website with the Bond holder's number and a certified copy of the death certificate. Premium Bonds can be held for up to 12 months after death and continue to be eligible for prizes during that period — so it's worth checking whether any prizes are won before you encash them. The Bonds themselves are repaid at face value as part of the estate — they don't need to be sold. The total value of the Bonds is included in the estate for IHT. Do you have the Bond holder's number?" },
    { id: "pct28", speaker: "Client", timestamp: "00:07:55", text: "I think it's in his paperwork at home. I'll find it this week." },
    { id: "pct29", speaker: "Solicitor", timestamp: "00:07:58", text: "Perfect. Add that to your list of tasks alongside the insurance query. I'll include NS&I and Hargreaves Lansdown notifications on the task list in your client care letter. That's comprehensive for today. Once again, please accept my condolences — and do call if you have any questions before we meet again." },
    { id: "pct30", speaker: "Client", timestamp: "00:08:12", text: "Thank you. One last thing — my father had a property in France. Does that affect the English probate?" },
    { id: "pct31", speaker: "Solicitor", timestamp: "00:08:20", text: "Yes, it does add a layer of complexity. Under European succession regulations — specifically EU Succession Regulation 650/2012, which the UK applied at the time of your father's death — immovable property such as land and buildings is generally governed by the law of the country where it is situated. So the French property would fall under French succession law, not English law, unless your father made a specific election in his Will to apply English law to the whole estate — some Wills include such a clause. Do you know whether the Will makes any reference to his French property or to French law?" },
    { id: "pct32", speaker: "Client", timestamp: "00:09:00", text: "I don't think so. The Will was drafted about eight years ago and I don't think France was mentioned." },
    { id: "pct33", speaker: "Solicitor", timestamp: "00:09:07", text: "In that case, you'll likely need a separate French probate process — called a succession en France — handled by a French notaire. The French property will need to be notified to the French tax authority, and French succession taxes may apply depending on its value and your relationship to your father. You are his child, so French succession law gives children a reserved portion of the estate — the réserve héréditaire — which generally cannot be overridden by a Will. I don't practice French law, so I'll refer you to a specialist French notaire I work with — Maître Dupont in Lyon — who handles precisely these cross-border estates. He speaks excellent English and charges fees regulated by the French tariff, so costs are transparent. I'll copy his details into your client care letter and flag that you should contact him as a parallel process alongside the English probate. It is perfectly normal for an estate to run two concurrent probate processes in different jurisdictions — they're independent procedures." },
    { id: "pct34", speaker: "Client", timestamp: "00:09:58", text: "I had no idea there would be a French element. This is rather more complex than I expected." },
    { id: "pct35", speaker: "Solicitor", timestamp: "00:10:05", text: "It is — but it is entirely manageable, and you're in the right hands. Cross-border estates are common and the key is to ensure both processes move in parallel. You'll need to provide the notaire with a copy of your father's Will, the English grant of probate once we have it, and the French property title documents — the acte de propriété. Do you know approximately what the French property is worth? That will affect the French succession tax position." },
    { id: "pct36", speaker: "Client", timestamp: "00:10:35", text: "It's a holiday apartment in the south of France. My father bought it about fifteen years ago. I think it might be worth around €280,000 now, but I'd need a valuation." },
    { id: "pct37", speaker: "Solicitor", timestamp: "00:10:45", text: "You'll need a formal valuation from a French estate agent — an agence immobilière — as at the date of death. The notaire can usually help arrange that. At €280,000, French succession taxes for a child inherit at a tax-free allowance of €100,000 per child, so approximately €180,000 would be taxable at progressive rates starting at 5%. I'd expect the French tax liability to be in the region of €14,000 to €18,000 depending on the exact valuation and applicable deductions. Again, the French notaire will advise precisely on this. For today, I think we have a comprehensive picture. I'll send you the client care letter by tomorrow, include the notaire's details, and we'll begin the English probate process immediately." },
    { id: "pct38", speaker: "Client", timestamp: "00:11:10", text: "And what about my father's pension — he was in a defined benefit scheme from his employment. Is that part of the estate?" },
    { id: "pct39", speaker: "Solicitor", timestamp: "00:11:18", text: "Generally no — occupational pension schemes are written in trust, which means the pension fund is held by the trustees and does not form part of the deceased's estate for either probate or inheritance tax purposes. The trustees have discretion as to who receives any death benefits, guided by a nomination form your father will have completed during his employment. You should contact the scheme administrators immediately and ask whether a nomination form was completed, and provide the death certificate. The trustees will normally follow the nomination, but they are not legally bound to — it is ultimately their discretion. The death benefit could be a lump sum, a spouse's pension, or a dependant's pension depending on the scheme rules. It's important to contact the trustees promptly as nomination forms can be out of date. Ask the trustees for a copy of the nomination form and the current scheme rules. That information will determine what you or other beneficiaries may receive from the pension." },
  ],
  attendanceNoteBody: `**Matter:** Estate Administration — [Client Name] (Deceased)
**Reference:** PROB/2025/0223
**Date of Attendance:** ${relDate(-44)}
**Solicitor:** Rachel Obi
**Client Present:** S. [Prospect] (Sole Executor)
**Duration:** 60 minutes

---

**1. Introduction and Recording Consent**

Recording consent obtained verbally at the outset. Client confirmed willingness to proceed.

**2. Background and Instructions**

The client is the sole executor under their late father's will, the deceased having died three weeks ago. The client's mother predeceased the father four years ago; the mother's estate passed entirely to the father by will. The client is the sole beneficiary.

**3. Estate Assets (approximate)**

| Asset | Approximate Value |
|-------|-------------------|
| Freehold property (Oxford) | £680,000 |
| Cash ISA (Barclays) | £95,000 |
| Stocks & Shares ISA | £42,000 |
| Aviva life insurance policy | £50,000 (trust status TBC) |
| **Gross Estate (excl. trust assets)** | **£817,000** |

No mortgage. No significant liabilities identified.

**4. Inheritance Tax Analysis**

Combined nil-rate bands available: up to £650,000 (2 × £325,000 — transferable from mother's estate, which made no NRB claims). Residence nil-rate band: up to £350,000 (2 × £175,000) applies as property passes to direct descendant. Combined threshold: up to £1,000,000. Estimated IHT payable: **£Nil**, subject to HMRC confirmation of transferred NRB and RNRB claim. IHT400 required as gross estate exceeds £650,000. Life insurance policy status (trust/nomination) to be confirmed with Aviva — if written in trust, falls outside estate for IHT.

**5. Grant of Probate**

Full grant of probate required. Cannot be obtained until IHT400 submitted and HMRC acknowledge. Estimated timeline: 4–6 weeks for HMRC acknowledgement, 4–6 weeks for grant. Total administration: 4–9 months.

**6. Urgent Actions for Client**

1. Notify insurer today — arrange probate property insurance for unoccupied property.
2. Contact Aviva — confirm whether life policy is written in trust.
3. Bring mother's death certificate and will to next meeting.

**7. Solicitor Actions**

1. Issue Client Care Letter and task list by end of day.
2. Prepare IHT400 and schedules for client review.
3. Submit IHT400 to HMRC once approved.
4. Apply for Grant of Probate once HMRC acknowledge return.

**8. Compliance Note**

Attendance note generated by LegalNote AI Engine. Reviewed and approved by Rachel Obi.`,
  undertakings: [
    { id: "pcu1", description: "Issue Client Care Letter and task list by close of business.", givenBy: "Rachel Obi", givenTo: "S. [Prospect]", dueDate: relDate(-44), status: "completed" },
    { id: "pcu2", description: "Prepare IHT400 inheritance tax return and schedules for client review.", givenBy: "Rachel Obi", givenTo: "S. [Prospect]", dueDate: relDate(-10), status: "overdue" },
    { id: "pcu3", description: "File IHT400 with HMRC and apply for Grant of Probate.", givenBy: "Rachel Obi", givenTo: "HMRC / Probate Registry", dueDate: relDate(-2), status: "overdue" },
  ],
  timeEntries: [
    { id: "pcte1", date: relDate(-44), description: "Initial consultation — 60 minutes", units: 4.0, rate: 275, fee: 1100 },
    { id: "pcte2", date: relDate(-44), description: "Client care letter and estate task plan", units: 0.5, rate: 275, fee: 138 },
    { id: "pcte3", date: relDate(-38), description: "IHT research — transferable nil-rate band claim", units: 1.0, rate: 275, fee: 275 },
    { id: "pcte4", date: relDate(-15), description: "IHT review meeting — 45 minutes", units: 3.0, rate: 275, fee: 825 },
  ],
  auditTrail: [
    { id: "pca1", timestamp: relDateTime(-44, "10:02"), eventType: "Consent Obtained", description: "Executor gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "5b9d2f4a1c7e0368" },
    { id: "pca2", timestamp: relDateTime(-44, "10:03"), eventType: "Recording Started", description: "Secure recording commenced — matter PROB/2025/0223, session pcs1.", actor: "LegalNote System", hmacFingerprint: "a0e8c3f7d14b6259" },
    { id: "pca3", timestamp: relDateTime(-44, "11:03"), eventType: "Recording Completed", description: "Recording ended. Duration: 60 minutes. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "7f2b5e9a0d3c8146" },
    { id: "pca4", timestamp: relDateTime(-44, "11:18"), eventType: "Transcript Produced", description: "AI transcription completed. 2,048 words. Diarization: 2 speakers. Confidence: 98.3%.", actor: "LegalNote AI Engine", hmacFingerprint: "c4a1b8e2f7d05396" },
    { id: "pca5", timestamp: relDateTime(-44, "11:21"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated from transcript. Document ID: pcd1.", actor: "LegalNote AI Engine", hmacFingerprint: "3e6f9b0d2a5c1748" },
    { id: "pca6", timestamp: relDateTime(-44, "17:50"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Rachel Obi.", actor: "Rachel Obi", hmacFingerprint: "8d4c7f1a2e5b0396" },
    { id: "pca7", timestamp: relDateTime(-15, "09:30"), eventType: "Recording Started", description: "Secure recording commenced — session pcs2 (IHT review).", actor: "LegalNote System", hmacFingerprint: "0b3a6d9c5f8e2174" },
    { id: "pca8", timestamp: relDateTime(-4, "14:00"), eventType: "Document Created", description: "IHT400 draft created. Pending client review and approval.", actor: "Rachel Obi", hmacFingerprint: "6f1e4a8b0c7d2395" },
    { id: "pca9", timestamp: relDateTime(-2, "09:00"), eventType: "Compliance Alert", description: "IHT400 submission overdue — Grant of Probate application cannot proceed.", actor: "LegalNote System", hmacFingerprint: "9a2c5e1b3f8d6047" },
    { id: "pca10", timestamp: relDateTime(-2, "09:01"), eventType: "Compliance Alert", description: "Grant of Probate application not yet filed with Probate Registry.", actor: "LegalNote System", hmacFingerprint: "d7b3f0a4c8e1529" },
  ],
};

const PERSONAL_INJURY_LEAD_MATTER: DemoLeadMatter = {
  id: "pi-lead",
  ref: "PI/2025/0562",
  title: "Employer Liability — [Client Name] v Apex Manufacturing",
  clientName: "S. [Prospect]",
  practiceArea: "personal-injury",
  solicitor: "Marcus Webb",
  firmName: "[Firm]",
  openedDate: relDate(-35),
  sessions: [
    {
      id: "pis1",
      date: relDate(-34),
      duration: "65 min",
      type: "Initial Consultation",
      attendees: ["Marcus Webb (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Initial consultation with client who sustained a hand laceration and crush injury on an unguarded lathe at Apex Manufacturing. Liability, quantum, and limitation period discussed. Pre-action protocol steps initiated.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "pis2",
      date: relDate(-12),
      duration: "40 min",
      type: "Medical Evidence Review",
      attendees: ["Marcus Webb (Solicitor)", "S. [Prospect] (Client)"],
      summary: "Review of GP and hospital records obtained. Expert medical report to be instructed. Schedule of loss commenced.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "pid1", title: "Attendance Note — Employer Liability Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-34) },
    { id: "pid2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-34) },
    { id: "pid3", title: "Pre-Action Protocol Letter of Claim — Apex Manufacturing", type: "Letter of Claim", status: "draft", generatedAt: relDate(-1) },
    { id: "pid4", title: "Schedule of Special Damages — Preliminary", type: "Schedule of Loss", status: "pending_review", generatedAt: relDate(-3) },
  ],
  transcript: [
    { id: "pit1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good afternoon, [Client Name]. I'm Marcus Webb, I specialise in personal injury and employer liability claims. Before we begin I need to let you know I'll be recording this meeting to produce an accurate attendance note — it's encrypted and only used for that purpose. Are you comfortable with that?" },
    { id: "pit2", speaker: "Client", timestamp: "00:00:20", text: "Yes, that's fine. Thank you for seeing me." },
    { id: "pit3", speaker: "Solicitor", timestamp: "00:00:24", text: "Of course. Can you take me through what happened — in your own words, from the beginning?" },
    { id: "pit4", speaker: "Client", timestamp: "00:00:30", text: "I work as a machinist at Apex Manufacturing. On the 14th of March I was operating a metal lathe and the guard that should be in place over the cutting area was missing. My supervisor had removed it two days earlier and hadn't replaced it. My hand slipped during the operation and I sustained a deep laceration across three fingers and what the hospital described as a crush injury to my index finger. I was taken to A&E by ambulance." },
    { id: "pit5", speaker: "Solicitor", timestamp: "00:01:10", text: "I'm sorry to hear that — that sounds extremely painful and frightening. You've described the guard as being missing — do you know why it was removed?" },
    { id: "pit6", speaker: "Client", timestamp: "00:01:18", text: "The supervisor said it had been sent for repair. But there was no replacement guard fitted and no risk assessment done. Two of my colleagues saw the lathe operating without the guard for two days before my accident." },
    { id: "pit7", speaker: "Solicitor", timestamp: "00:01:32", text: "This is very significant. Under the Provision and Use of Work Equipment Regulations 1998 — PUWER — your employer has a strict duty to ensure that any dangerous machinery is adequately guarded and that no work is carried out where that guarding is absent or defective. If the guard was removed and the machine was left unguarded for two days, that's a prima facie breach. Have you made an accident report?" },
    { id: "pit8", speaker: "Client", timestamp: "00:01:55", text: "Yes — I reported it at the hospital and Apex have completed an internal accident report. I have a copy of that." },
    { id: "pit9", speaker: "Solicitor", timestamp: "00:02:01", text: "Excellent — that is crucial evidence. I want you to send me a copy of that accident report as soon as possible. Now, the Health and Safety Executive may have investigated or may be investigating — do you know if HSE has been in contact with Apex?" },
    { id: "pit10", speaker: "Client", timestamp: "00:02:14", text: "The HSE attended the factory the following week. I don't know the outcome." },
    { id: "pit11", speaker: "Solicitor", timestamp: "00:02:19", text: "We can submit a Freedom of Information request to the HSE for any inspection reports and notices issued. If the HSE found a breach and issued a Prohibition Notice or Improvement Notice, that is highly corroborating evidence for your claim. Now let's talk about your injuries. What is the current position?" },
    { id: "pit12", speaker: "Client", timestamp: "00:02:34", text: "I had surgery to reattach the tendon in my index finger. I've had six weeks of physiotherapy. The surgeon says there's a risk of permanent reduced grip strength — they won't know the full extent for another three months. I was off work for eight weeks and I'm currently on light duties." },
    { id: "pit13", speaker: "Solicitor", timestamp: "00:02:55", text: "This is exactly the kind of case where an independent medical expert report is essential. We'll need a consultant who specialises in hand and upper limb injuries to assess you, give a prognosis, and quantify the impact on your day-to-day life and working capacity. That report forms the backbone of the quantum of your claim — both for general damages for pain and suffering and special damages for financial losses." },
    { id: "pit14", speaker: "Client", timestamp: "00:03:18", text: "What kind of money are we talking about?" },
    { id: "pit15", speaker: "Solicitor", timestamp: "00:03:22", text: "It's too early to put a precise figure on it. General damages for a significant hand injury with potential permanent deficit can range anywhere from £30,000 to £100,000 or more depending on the prognosis. Your special damages will include lost wages during the eight weeks off work, ongoing treatment costs, any care costs, and potentially future loss of earnings if your grip strength is permanently affected. We'll put together a schedule of loss once the medical evidence is clearer. Now, limitation — I want to flag this clearly. The limitation period for personal injury claims is three years from the date of the accident or the date of knowledge, whichever is later. Your accident was on the 14th March 2025, so the primary limitation date is 14th March 2028. We have time, but we should move promptly." },
    { id: "pit16", speaker: "Client", timestamp: "00:04:15", text: "Will I need to go to court?" },
    { id: "pit17", speaker: "Solicitor", timestamp: "00:04:18", text: "The vast majority of employer liability claims settle before trial — over 95% — but we must prepare as if it will proceed to court. The first step is sending a Pre-Action Protocol Letter of Claim to Apex Manufacturing and their insurers. This formally notifies them of your claim and the heads of loss. They then have 21 days to acknowledge and 3 months to respond to the substantive merits. That process often triggers early settlement. Does Apex Manufacturing have employer's liability insurance?" },
    { id: "pit18", speaker: "Client", timestamp: "00:04:48", text: "Yes — every employer is required to. I believe they're insured through Zurich." },
    { id: "pit19", speaker: "Solicitor", timestamp: "00:04:54", text: "Correct — employer's liability insurance is compulsory. That gives you an assured defendant for the claim. I'll address the letter of claim to both Apex Manufacturing and notify Zurich. Now let me confirm next steps. I'll put together a no-win, no-fee conditional fee agreement for your review. We'll instruct a hand surgery expert immediately — I'll send you a list of approved experts this week. Send me the accident report, your GP and hospital records, and your payslips for the eight-week period you were off work. Any questions?" },
    { id: "pit20", speaker: "Client", timestamp: "00:05:30", text: "Will I have to pay anything if the claim fails?" },
    { id: "pit21", speaker: "Solicitor", timestamp: "00:05:34", text: "Under a no-win, no-fee agreement — a conditional fee arrangement — our professional fees are only payable if you win. If you lose, we bear the costs. We'll take out After-the-Event insurance to protect you against the defendant's costs in the unlikely event of a loss. Your only potential outlay would be the ATE insurance premium, but many insurers defer payment until the end of the case. I'll go through all the financial arrangements in detail in the CFA agreement I send you." },
    { id: "pit22", speaker: "Client", timestamp: "00:06:00", text: "That's reassuring. Thank you, Marcus. I feel like this is in good hands." },
    { id: "pit23", speaker: "Solicitor", timestamp: "00:06:05", text: "Thank you, [Client Name]. We'll move quickly. I'll send you everything by the end of this week." },
    { id: "pit24", speaker: "Client", timestamp: "00:06:12", text: "Can I ask — how long will all of this take? I'm trying to manage expectations with my family." },
    { id: "pit25", speaker: "Solicitor", timestamp: "00:06:18", text: "Personal injury claims vary quite a lot in duration depending on liability and medical complexity. In your case — a slipping accident where there is a clear duty of care owed by the supermarket — if the defendant accepts liability reasonably early, the main variable is your medical recovery. We wouldn't want to settle before you've reached what's called maximum medical improvement, because until that point we can't accurately value your future losses. If your knee recovers fully in the next six to nine months, a claim like this might settle within twelve to eighteen months of instruction. If you need surgery or there are ongoing issues, the claim could take two to three years. Throughout that period I'll keep you regularly updated. You'll also be assessed by a medical expert jointly instructed by both parties who will produce a prognosis report — that's the document that underpins the medical element of the claim." },
    { id: "pit26", speaker: "Client", timestamp: "00:07:10", text: "I didn't realise it could be that involved. I thought it might be quite quick." },
    { id: "pit27", speaker: "Solicitor", timestamp: "00:07:18", text: "I understand that expectation — many clients do. The reason it takes time is partly the defendant's process of investigating liability, partly the medical prognosis timeline, and partly the litigation timetable if proceedings need to be issued. That said, many claims settle at the pre-action protocol stage, before we even issue proceedings in court. The defendant has to respond to our letter of claim within 21 days of receipt, acknowledge it within that window, and then has three months to investigate and respond. If they admit liability in that response, we'll be able to focus entirely on the medical evidence and negotiate quantum. If they deny liability, we'll need to gather more evidence — the accident book, CCTV, witness statements — and may need to issue proceedings. Either way, you will not need to do very much — I'll manage the process and only contact you when your input or instructions are needed." },
    { id: "pit28", speaker: "Client", timestamp: "00:08:10", text: "That's really reassuring. Thank you. I think I'm ready to proceed." },
    { id: "pit29", speaker: "Solicitor", timestamp: "00:08:15", text: "Excellent. I'll send the CFA and ATE insurance documents today. As soon as you sign and return them, I'll send the letter of claim to Nexus Supermarkets Limited. We're on the clock with the limitation period — three years from the date of the accident — but given you're instructing us promptly, we have plenty of time. Keep all your receipts for any expenses related to the injury, and make a note of any appointments, time off work, or difficulties you're experiencing. All of that can form part of your claim. Take care of yourself and I'll be in touch shortly." },
    { id: "pit30", speaker: "Client", timestamp: "00:08:30", text: "Can I claim for the treatment I've been having — I've been seeing a physiotherapist privately because the NHS waiting list was too long?" },
    { id: "pit31", speaker: "Solicitor", timestamp: "00:08:38", text: "Absolutely. Reasonable private medical treatment is fully recoverable as a special damage in a personal injury claim, provided it was reasonably necessary and the cost is reasonable. Given the NHS waiting time for physiotherapy in your area — which can be several months — it was entirely reasonable for you to access private treatment to manage your recovery and minimise the period of disability. Keep every invoice and receipt from the physiotherapist, and ask them to provide a brief treatment summary. We'll include the treatment costs in the schedule of special damages. If you need further treatment going forward — including the possibility of an orthopaedic review or surgical consultation for your knee — we can seek a Rehabilitation Code contribution from the defendant's insurer to fund that treatment in parallel with the claim. That's a mechanism under the Personal Injury Protocol that allows injured parties to access early treatment without waiting for the claim to settle." },
    { id: "pit32", speaker: "Client", timestamp: "00:09:22", text: "I didn't know any of that was possible. What about the gym membership I've had to cancel? I was going three times a week and now I can't exercise at all." },
    { id: "pit33", speaker: "Solicitor", timestamp: "00:09:30", text: "Yes — that's a recoverable loss. Cancelled gym memberships, sporting activities, and hobbies that you can no longer participate in as a result of the injury are claimable as special damages to the extent of the direct financial cost, and also as part of the general damages for loss of amenity — which is the legal term for loss of the enjoyment of life. The medical expert will comment on your ability to exercise and any restrictions on physical activity in their prognosis report, which provides the evidential basis for the loss of amenity element of your claim. Make a list of all the activities you can no longer do or have had to reduce — sports, gardening, DIY, social activities — because all of that informs the general damages assessment. A knee injury that restricts an active person significantly attracts higher general damages than the same injury in someone with a more sedentary lifestyle. It matters that you were going to the gym three times a week." },
    { id: "pit34", speaker: "Client", timestamp: "00:10:18", text: "That's really useful. I'll compile everything. Thank you so much." },
    { id: "pit35", speaker: "Solicitor", timestamp: "00:10:24", text: "You're very welcome. Keep a running diary — pain levels, sleep disruption, activities you can't do each day — and I'll incorporate it into the witness statement I draft for you. The more contemporaneous detail you have, the stronger your evidence of the impact on your daily life. I'll be in touch within 24 hours with the paperwork. Take care." },
    { id: "pit36", speaker: "Client", timestamp: "00:10:40", text: "One last thing — I'm still in pain and I haven't been able to return to work. Is there any way to get an interim payment from the defendant while the claim is running?" },
    { id: "pit37", speaker: "Solicitor", timestamp: "00:10:48", text: "Yes — once proceedings are issued and if the defendant admits liability, or if it is clear they will be found liable, you can apply to the court for an interim payment. An interim payment is a payment on account of damages paid before the full trial — it allows you to access funds for treatment and to manage your financial position during the litigation. Courts are generally willing to make interim payments in clear liability cases. The amount is typically a conservative estimate of what the court would award at trial — often around 50 to 60 percent of a reasonably conservative assessment of the likely final award. I'll flag the interim payment route as soon as we have a response from the defendant. If they admit liability promptly, we can make that application within weeks of issue. In the meantime, have you contacted the DWP about Employment and Support Allowance or any other benefit entitlements while you're off work?" },
  ],
  attendanceNoteBody: `**Matter:** Employer Liability — [Client Name] v Apex Manufacturing
**Reference:** PI/2025/0562
**Date of Attendance:** ${relDate(-34)}
**Solicitor:** Marcus Webb
**Client Present:** S. [Prospect]
**Duration:** 65 minutes

---

**1. Introduction and Recording Consent**

Recording consent obtained. Client confirmed willingness to proceed.

**2. Circumstances of the Accident**

Date of accident: 14 March 2025. Location: Apex Manufacturing production floor. The client was operating a metal lathe when the guard had been removed by a supervisor two days prior and not replaced. No risk assessment was carried out. The client's hand slipped, causing a deep laceration to three fingers and a crush injury to the index finger. Ambulance attended; client admitted to A&E.

Two colleagues witnessed the unguarded lathe operating in the two-day period prior to the accident. An internal accident report was completed by Apex Manufacturing. HSE attended the factory the following week; outcome unknown — FOI request to be submitted.

**3. Liability Assessment**

Prima facie breach of PUWER 1998 (Provision and Use of Work Equipment Regulations). Employer's duty to maintain adequate guarding of dangerous machinery. Removal of guard without replacement or risk assessment constitutes clear breach. HSE attendance and any resulting notices will be sought as corroborating evidence.

**4. Injuries and Prognosis**

- Deep laceration: three fingers of the dominant hand.
- Crush injury: index finger.
- Surgery: tendon reattachment (index finger).
- Physiotherapy: 6 weeks completed.
- Time off work: 8 weeks on full sick pay, now on light duties.
- Prognosis: risk of permanent reduced grip strength — final prognosis expected in 3 months.

**5. Quantum (Preliminary)**

Expert medical report required from consultant specialising in hand/upper limb injuries. General damages: £30,000–£100,000+ (TBC on prognosis). Special damages: lost wages (8 weeks), treatment costs, future loss of earnings (TBC). Schedule of loss to be prepared once medical evidence received.

**6. Limitation**

Limitation date: 14 March 2028. Adequate time available; prompt action recommended.

**7. Funding and Process**

No-win, no-fee Conditional Fee Agreement to be issued. ATE insurance to be taken out. Pre-Action Protocol Letter of Claim to be sent to Apex Manufacturing and Zurich Insurance. 21-day acknowledgement / 3-month substantive response period. Settlement likely before trial.

**8. Next Steps**

1. Solicitor to draft and issue CFA agreement and ATE insurance proposal.
2. Client to provide accident report, GP/hospital records, payslips (8-week sick period).
3. Solicitor to instruct hand surgery medical expert.
4. Solicitor to submit FOI request to HSE.
5. Solicitor to draft Pre-Action Protocol Letter of Claim.

**9. Compliance Note**

Attendance note generated by LegalNote AI Engine. Reviewed and approved by Marcus Webb.`,
  undertakings: [
    { id: "piu1", description: "Issue Conditional Fee Agreement and ATE insurance proposal to client.", givenBy: "Marcus Webb", givenTo: "S. [Prospect]", dueDate: relDate(-28), status: "completed" },
    { id: "piu2", description: "Submit Pre-Action Protocol Letter of Claim to Apex Manufacturing and Zurich Insurance.", givenBy: "Marcus Webb", givenTo: "Apex Manufacturing / Zurich", dueDate: relDate(-2), status: "overdue" },
    { id: "piu3", description: "Instruct hand surgery medical expert and request FOI report from HSE.", givenBy: "Marcus Webb", givenTo: "Medical Expert / HSE", dueDate: relDate(-2), status: "overdue" },
  ],
  timeEntries: [
    { id: "pite1", date: relDate(-34), description: "Initial consultation — 65 minutes", units: 4.3, rate: 260, fee: 1118 },
    { id: "pite2", date: relDate(-34), description: "Client care letter and CFA agreement", units: 0.5, rate: 260, fee: 130 },
    { id: "pite3", date: relDate(-12), description: "Medical evidence review meeting — 40 minutes", units: 2.7, rate: 260, fee: 702 },
    { id: "pite4", date: relDate(-3), description: "Schedule of loss — preliminary draft", units: 1.5, rate: 260, fee: 390 },
  ],
  auditTrail: [
    { id: "pia1", timestamp: relDateTime(-34, "14:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "4e8b2d1a9f3c0567" },
    { id: "pia2", timestamp: relDateTime(-34, "14:03"), eventType: "Recording Started", description: "Secure recording commenced — matter PI/2025/0562, session pis1.", actor: "LegalNote System", hmacFingerprint: "c0f7a3e1b4d28596" },
    { id: "pia3", timestamp: relDateTime(-34, "15:08"), eventType: "Recording Completed", description: "Recording ended. Duration: 65 minutes. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "2a5f9d0b6e3c8147" },
    { id: "pia4", timestamp: relDateTime(-34, "15:22"), eventType: "Transcript Produced", description: "AI transcription completed. 2,041 words. Diarization: 2 speakers. Confidence: 98.0%.", actor: "LegalNote AI Engine", hmacFingerprint: "7b1c4e8a0f5d2396" },
    { id: "pia5", timestamp: relDateTime(-34, "15:26"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated from transcript. Document ID: pid1.", actor: "LegalNote AI Engine", hmacFingerprint: "e3d6a0c9f4b12758" },
    { id: "pia6", timestamp: relDateTime(-34, "17:35"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Marcus Webb.", actor: "Marcus Webb", hmacFingerprint: "5f9c2a7e1b4d0368" },
    { id: "pia7", timestamp: relDateTime(-12, "10:00"), eventType: "Recording Started", description: "Secure recording commenced — session pis2 (medical evidence review).", actor: "LegalNote System", hmacFingerprint: "3b8d5f2a0c9e6147" },
    { id: "pia8", timestamp: relDateTime(-3, "14:00"), eventType: "Document Created", description: "Preliminary schedule of special damages created. Pending medical expert input.", actor: "Marcus Webb", hmacFingerprint: "9e4c1a7f2b8d0536" },
    { id: "pia9", timestamp: relDateTime(-2, "09:00"), eventType: "Compliance Alert", description: "Pre-Action Protocol Letter of Claim overdue — limitation risk noted.", actor: "LegalNote System", hmacFingerprint: "6a0d3f8c1e5b9274" },
    { id: "pia10", timestamp: relDateTime(-2, "09:01"), eventType: "Compliance Alert", description: "Medical expert not yet instructed — Court directions deadline at risk.", actor: "LegalNote System", hmacFingerprint: "b2e7f0a4c8d36195" },
  ],
};

const COMMERCIAL_LEAD_MATTER: DemoLeadMatter = {
  id: "cm-lead",
  ref: "COMM/2025/0441",
  title: "Share Purchase Agreement — [Client Name] Ltd Acquisition",
  clientName: "S. [Prospect]",
  practiceArea: "commercial",
  solicitor: "Jonathan Farr",
  firmName: "[Firm]",
  openedDate: relDate(-38),
  sessions: [
    {
      id: "cms1",
      date: relDate(-37),
      duration: "70 min",
      type: "Initial Consultation",
      attendees: ["Jonathan Farr (Solicitor)", "S. [Prospect] (Client/Director)"],
      summary: "Initial meeting with the client regarding the proposed acquisition of Meridian Tech Solutions Ltd for £2.4 million. Heads of terms, due diligence scope, AML obligations, and transaction structure discussed.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "cms2",
      date: relDate(-14),
      duration: "50 min",
      type: "Due Diligence Review",
      attendees: ["Jonathan Farr (Solicitor)", "S. [Prospect] (Client/Director)"],
      summary: "Due diligence findings presented. IP ownership queries identified. Disclosure letter scope agreed. Exchange conditions reviewed.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "cmd1", title: "Attendance Note — Share Purchase Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-37) },
    { id: "cmd2", title: "Client Care Letter — S. [Prospect] Ltd", type: "Client Care Letter", status: "approved", generatedAt: relDate(-37) },
    { id: "cmd3", title: "AML Enhanced Due Diligence Report — Meridian Tech Solutions Ltd", type: "AML Report", status: "draft", generatedAt: relDate(-2) },
    { id: "cmd4", title: "Disclosure Letter — [Client Name] Ltd Acquisition", type: "Disclosure Letter", status: "draft", generatedAt: relDate(-1) },
  ],
  transcript: [
    { id: "cmt1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good morning, [Client Name]. I'm Jonathan Farr, I lead our corporate transactions team. Before we start, please be aware I'll be recording this meeting to produce an accurate attendance note — encrypted and used only for that purpose. Happy to proceed?" },
    { id: "cmt2", speaker: "Client", timestamp: "00:00:18", text: "Absolutely. Thank you for making the time." },
    { id: "cmt3", speaker: "Solicitor", timestamp: "00:00:22", text: "Of course. Tell me about the deal — what are you acquiring, and where are you in the process?" },
    { id: "cmt4", speaker: "Client", timestamp: "00:00:28", text: "We're acquiring Meridian Tech Solutions Limited — a software company based in Leeds. We've agreed heads of terms at £2.4 million. It's a 100% share purchase — we're buying the whole company, not just the assets. The seller's solicitors are Whitfield Carey in Manchester and we'd like to move quickly — ideally exchanging within six to eight weeks." },
    { id: "cmt5", speaker: "Solicitor", timestamp: "00:01:02", text: "A £2.4 million share purchase — that's a significant transaction and there's a lot to cover. Let me start with the structure. As a share purchase, you're acquiring the company including all its existing contracts, liabilities, and any historic obligations — good and bad. That's why due diligence is critical. Has any preliminary due diligence been done by your accountants or financial advisors?" },
    { id: "cmt6", speaker: "Client", timestamp: "00:01:25", text: "Our accountants have done a high-level financial review — they've flagged no red flags on the accounts. We haven't done any legal due diligence yet." },
    { id: "cmt7", speaker: "Solicitor", timestamp: "00:01:35", text: "That's where we'll start. We'll issue a comprehensive legal due diligence questionnaire to the seller's solicitors covering corporate structure, IP and technology ownership, commercial contracts, employment, property, regulatory compliance, and litigation. For a software company, IP is the crown jewel — I'll want to confirm that all software, databases, and source code are owned outright by Meridian, not licensed in from third parties or developed by contractors who haven't signed IP assignment agreements." },
    { id: "cmt8", speaker: "Client", timestamp: "00:02:10", text: "That's a good point — I know they've used freelance developers historically. I'm not sure whether IP assignments were in place." },
    { id: "cmt9", speaker: "Solicitor", timestamp: "00:02:16", text: "That's a potential red flag and I'll prioritise it in our DD questionnaire. If there are freelancers who contributed to the core software without IP assignments, they may have residual IP rights. We'd need to see all contractor agreements and, if IP assignments are missing, require the seller to obtain them before exchange. Now, turning to the SPA — the main agreement. The key commercial protections for you as buyer are warranties and indemnities. The seller will give extensive representations — factual statements about the business — which, if found to be untrue after completion, trigger a claim against them. We'll negotiate for strong financial and technology warranties in particular." },
    { id: "cmt10", speaker: "Client", timestamp: "00:02:55", text: "What about the purchase price — is there a mechanism if the business performs worse than expected after we buy it?" },
    { id: "cmt11", speaker: "Solicitor", timestamp: "00:03:00", text: "Yes — that's dealt with through a completion accounts mechanism or a locked-box structure. A completion accounts mechanism adjusts the price based on the actual net asset position at the date of completion — protecting you if working capital falls below an agreed level before you take over. A locked-box fixes the price at a historical balance sheet date and controls for value leakage. Given your six-to-eight week timeline, I'd favour a locked-box — it's quicker and provides more certainty for both sides. I'll discuss with Whitfield Carey to see if they're agreeable." },
    { id: "cmt12", speaker: "Client", timestamp: "00:03:32", text: "That makes sense. What about the sellers — are they staying in the business post-acquisition?" },
    { id: "cmt13", speaker: "Solicitor", timestamp: "00:03:37", text: "That's something we'll need to clarify quickly. If one or more sellers are key employees, you'll want service agreements and potentially earn-out arrangements to retain them. Conversely, if they're leaving, you'll want robust restrictive covenants — non-compete, non-solicit — to prevent them setting up a competing business or poaching clients and staff. What's the intention?" },
    { id: "cmt14", speaker: "Client", timestamp: "00:03:55", text: "The founder — who's the main seller — is staying for a twelve-month handover period. His co-director is leaving immediately." },
    { id: "cmt15", speaker: "Solicitor", timestamp: "00:04:01", text: "I'll draft a service agreement for the founder covering the handover period and include non-compete and non-solicit provisions. For the departing co-director, we'll need standalone restrictive covenants as part of the SPA — again non-compete and non-solicit, typically for two years post-completion in your geographic market. AML — I need to raise this directly. We have regulatory obligations under the Money Laundering Regulations 2017 to verify the identity of all parties and understand the source of funds for the purchase price of £2.4 million. Where is the funding for this acquisition coming from?" },
    { id: "cmt16", speaker: "Client", timestamp: "00:04:38", text: "A combination — £1.2 million from our company's cash reserves, and a £1.2 million acquisition facility from HSBC. We're signing the facility agreement next week." },
    { id: "cmt17", speaker: "Solicitor", timestamp: "00:04:48", text: "A bank acquisition facility from a regulated UK institution is entirely straightforward for source of funds purposes. I'll need a copy of the facility agreement once signed, plus evidence of the company's existing reserves — a recent bank statement will suffice. I'll need certified ID for you as the ultimate beneficial owner and director, and for any other individuals who control more than 25% of your company. Do you have your passport and a recent utility bill or similar address document to hand?" },
    { id: "cmt18", speaker: "Client", timestamp: "00:05:10", text: "I can bring those this week. My wife also holds 30% of the company." },
    { id: "cmt19", speaker: "Solicitor", timestamp: "00:05:14", text: "Then I'll need AML verification documents for her too. I'll send an AML portal link so you can both upload securely. Now let me summarise the critical path for your six-to-eight week exchange target. Week one: issue DD questionnaire, AML verification, instruct accountants on locked-box review. Week two to four: due diligence review and issues log. Week four to five: draft SPA, disclosure letter, and ancillary documents. Week six: negotiate and agree final terms. Week seven to eight: exchange. I have to be candid — this is an ambitious timeline. If the DD uncovers issues — particularly on IP — it could slip. But with a cooperative seller's solicitor it's achievable. Any questions?" },
    { id: "cmt20", speaker: "Client", timestamp: "00:05:55", text: "Just one — what are your fees likely to be?" },
    { id: "cmt21", speaker: "Solicitor", timestamp: "00:06:00", text: "For a £2.4 million share acquisition of this complexity, I'd estimate professional fees of £18,000 to £22,000 plus VAT and disbursements. I'll send you a formal fee estimate in the client care letter. The estimate assumes no unusually complex issues emerge in DD. I'll flag promptly if the scope changes." },
    { id: "cmt22", speaker: "Client", timestamp: "00:06:18", text: "That sounds reasonable. Let's move forward, Jonathan. I'll get the AML documents to you this week." },
    { id: "cmt23", speaker: "Solicitor", timestamp: "00:06:24", text: "Excellent. I'll issue the client care letter, DD questionnaire, and AML portal link by close of business today. Thank you, [Client Name]." },
    { id: "cmt24", speaker: "Client", timestamp: "00:06:35", text: "One last thing, Jonathan — what should I be most cautious about between now and signing? My finance director keeps asking me if there's anything I should be watching for on their side." },
    { id: "cmt25", speaker: "Solicitor", timestamp: "00:06:42", text: "Your finance director is asking the right question. There are three key risk areas I'd flag before signing. First, working capital — you want to make sure the target's cash position hasn't deteriorated significantly since the last set of accounts. We'll include a locked-box mechanism or a completion accounts clause to adjust the price if it has. Second, key person dependency — if the business's revenues are substantially reliant on one or two key relationships or individuals, you need to understand what happens if those individuals leave post-acquisition. The warranties and the retention structure are designed partly to manage that risk. Third, customer concentration — if more than 25 to 30 percent of revenue comes from a single customer, that's a risk worth quantifying in the warranty schedule. Your financial advisers should be running sensitivity analysis on each of these scenarios as part of DD. Make sure they share those outputs with me so we can ensure the SPA warranties and indemnities map to the identified risks." },
    { id: "cmt26", speaker: "Client", timestamp: "00:07:35", text: "That's very useful. The business does have one anchor customer who represents about 35% of revenue. I'll tell the FD to flag that." },
    { id: "cmt27", speaker: "Solicitor", timestamp: "00:07:43", text: "Exactly right — flag it immediately. We need to draft a specific customer concentration warranty and possibly a key customer retention condition precedent so that if that customer terminates or materially reduces their contract before completion, you have either a right to reduce the price or a right to walk away entirely. That's a significant exposure and I'm glad you mentioned it. I'll build that into my priority DD focus when I review the commercial agreements. Good — I think we have everything we need for today. I'll be in touch by close of business." },
    { id: "cmt28", speaker: "Client", timestamp: "00:08:20", text: "Thank you, Jonathan. Very thorough as always." },
    { id: "cmt29", speaker: "Solicitor", timestamp: "00:08:24", text: "That's the job. Speak soon." },
    { id: "cmt30", speaker: "Client", timestamp: "00:08:32", text: "While I have you — one of our investors wants to know about the warranty and indemnity insurance. Is that something we should get?" },
    { id: "cmt31", speaker: "Solicitor", timestamp: "00:08:40", text: "Warranty and indemnity insurance — W&I — is increasingly standard in M&A transactions of this size and above. It essentially transfers the risk of warranty breach from the seller to the insurer. The commercial benefit is significant: as a buyer, rather than pursuing the seller for a warranty breach — which can damage ongoing commercial relationships and involves litigation risk and delay — you make a claim directly against the insurer. Sellers also benefit because they can release funds from escrow or sale proceeds sooner, rather than holding back a significant sum in a retention account against warranty claims. For a transaction of £2.4 million, W&I insurance is viable — the premium typically ranges from 0.8% to 1.2% of the insured amount. If you're insuring £2 million of warranty cover, expect a premium of around £16,000 to £24,000. The insured limit is usually set at a level agreed between buyer and seller. Given that your investor is asking about it, it might be worth instructing a specialist W&I broker — I work closely with a firm called Aon M&A and would be happy to introduce you." },
    { id: "cmt32", speaker: "Client", timestamp: "00:09:30", text: "Yes — do make that introduction. The investor is likely to insist on it as a condition of their participation." },
    { id: "cmt33", speaker: "Solicitor", timestamp: "00:09:38", text: "I'll connect you by email this afternoon. One important point about W&I insurance: the insurer will conduct their own review of the due diligence process and the warranty schedule before providing cover — so they'll want to see our DD report and the agreed SPA. That means the diligence process needs to be robust and well-documented. Any gaps in the DD will result in coverage exclusions. This is another reason to be thorough and well-organised throughout the process. I'll include a W&I consideration note in my DD scope document. Excellent — I think we're fully aligned now. I'll be in touch within the hour." },
    { id: "cmt34", speaker: "Client", timestamp: "00:09:55", text: "One more question — the seller has mentioned a earn-out arrangement for part of the price. How does that work and is it something you'd recommend?" },
    { id: "cmt35", speaker: "Solicitor", timestamp: "00:10:04", text: "An earn-out is a deferred payment mechanism where part of the purchase price is contingent on the business achieving agreed performance targets — typically revenue or EBITDA — over a defined post-completion period, usually one to three years. From a buyer's perspective, an earn-out is attractive because you're not paying the full price upfront for performance that hasn't yet been delivered. From a seller's perspective, it allows them to demonstrate confidence in the business's future performance and receive a higher total consideration than they might achieve on a fixed price basis. However, earn-outs are one of the most heavily disputed mechanisms in M&A transactions, because disagreements about how the earn-out metrics are calculated are extremely common. I'd recommend that if you proceed with an earn-out, the SPA contains very precise, unambiguous definitions of the earn-out metrics, an agreed accounting policy for calculating them, robust anti-manipulation provisions — preventing the seller, if they remain as a director, from manipulating the accounts to inflate the earn-out — and a clear dispute resolution mechanism, ideally expert determination rather than litigation. I'll draft the earn-out provisions very carefully if this becomes part of the deal structure." },
    { id: "cmt36", speaker: "Client", timestamp: "00:10:58", text: "That's helpful. The seller wants to stay on as managing director for two years post-completion. That adds another dimension, doesn't it?" },
    { id: "cmt37", speaker: "Solicitor", timestamp: "00:11:06", text: "It does — and it's important to address it properly. If the seller is staying as a director during the earn-out period, they have both an incentive to perform and a potential conflict of interest between their director's fiduciary duties to the company and their personal financial interest in the earn-out metrics. You need a robust service agreement for the seller as managing director which sets out clearly their duties, their reporting lines to your board, their remuneration, and their termination provisions. Critically, the service agreement needs to interact carefully with the earn-out provisions in the SPA so that it is clear what happens to the earn-out if the seller is dismissed for cause, if they resign, or if they are made redundant during the earn-out period. These are all scenarios that generate significant disputes. I'll flag the service agreement as a priority document alongside the SPA in the critical path. Thank you — this has been a very productive session." },
  ],
  attendanceNoteBody: `**Matter:** Share Purchase Agreement — [Client Name] Ltd Acquisition (Meridian Tech Solutions Ltd)
**Reference:** COMM/2025/0441
**Date of Attendance:** ${relDate(-37)}
**Solicitor:** Jonathan Farr
**Client Present:** S. [Prospect] (Director/Buyer)
**Duration:** 70 minutes

---

**1. Introduction and Recording Consent**

Recording consent obtained at the outset.

**2. Transaction Overview**

100% share purchase of Meridian Tech Solutions Limited (Leeds). Agreed consideration: £2.4 million. Seller's solicitors: Whitfield Carey (Manchester). Target exchange: 6–8 weeks.

**3. Structure — Share Purchase**

Buyer acquiring entire issued share capital — inheriting all contracts, liabilities, and historic obligations. Due diligence critical. Locked-box pricing mechanism recommended (faster, more certain than completion accounts). To be agreed with Whitfield Carey.

**4. Due Diligence Priorities**

DD questionnaire to be issued covering: corporate structure, IP ownership, commercial contracts, employment, property, regulatory compliance, litigation. Priority: IP — freelance developer contributions identified as potential issue. Seller must produce all contractor agreements; IP assignments required where absent before exchange.

**5. Key SPA Protections**

Warranties and indemnities to cover financial position, technology assets, and employment. Non-compete and non-solicit provisions for both sellers.

**6. Post-Completion Arrangements**

Founder-seller remaining for 12-month handover — service agreement to be drafted. Co-director departing immediately — standalone restrictive covenants (non-compete, non-solicit, 2 years) to be included in SPA.

**7. Funding and AML**

Funding: £1.2m company cash reserves + £1.2m HSBC acquisition facility (to be signed next week). AML: ID and source of funds required for client and spouse (30% shareholder). AML portal link to be issued. HSBC facility agreement copy required on signing.

**8. Critical Path (6–8 Week Exchange Target)**

| Week | Activity |
|------|----------|
| 1 | DD questionnaire issued; AML; accountant locked-box review |
| 2–4 | DD review and issues log |
| 4–5 | Draft SPA, disclosure letter, ancillary documents |
| 6 | Final negotiation |
| 7–8 | Exchange |

**9. Fees**

Estimated professional fees: £18,000–£22,000 + VAT + disbursements (subject to DD complexity). Formal estimate in client care letter.

**10. Compliance Note**

Attendance note generated by LegalNote AI Engine. Reviewed and approved by Jonathan Farr.`,
  undertakings: [
    { id: "cmu1", description: "Issue Client Care Letter, DD questionnaire, and AML portal link by close of business today.", givenBy: "Jonathan Farr", givenTo: "S. [Prospect]", dueDate: relDate(-37), status: "completed" },
    { id: "cmu2", description: "Complete AML Enhanced Due Diligence on target entity before exchange.", givenBy: "Jonathan Farr", givenTo: "[Firm] Compliance", dueDate: relDate(-1), status: "overdue" },
    { id: "cmu3", description: "Issue Disclosure Letter to buyer for review before exchange.", givenBy: "Jonathan Farr", givenTo: "S. [Prospect]", dueDate: relDate(-1), status: "overdue" },
  ],
  timeEntries: [
    { id: "cmte1", date: relDate(-37), description: "Initial consultation — 70 minutes", units: 4.7, rate: 350, fee: 1645 },
    { id: "cmte2", date: relDate(-37), description: "Client care letter and DD questionnaire", units: 1.0, rate: 350, fee: 350 },
    { id: "cmte3", date: relDate(-30), description: "DD review — corporate and IP analysis", units: 3.0, rate: 350, fee: 1050 },
    { id: "cmte4", date: relDate(-14), description: "Due diligence review meeting — 50 minutes", units: 3.3, rate: 350, fee: 1155 },
    { id: "cmte5", date: relDate(-7), description: "SPA — first draft", units: 5.0, rate: 350, fee: 1750 },
  ],
  auditTrail: [
    { id: "cma1", timestamp: relDateTime(-37, "10:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "9e3c5a7f2b4d1068" },
    { id: "cma2", timestamp: relDateTime(-37, "10:03"), eventType: "Recording Started", description: "Secure recording commenced — matter COMM/2025/0441, session cms1.", actor: "LegalNote System", hmacFingerprint: "b5f1d8a2c6e03794" },
    { id: "cma3", timestamp: relDateTime(-37, "11:13"), eventType: "Recording Completed", description: "Recording ended. Duration: 70 minutes. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "4a7e1c9f0b5d2836" },
    { id: "cma4", timestamp: relDateTime(-37, "11:29"), eventType: "Transcript Produced", description: "AI transcription completed. 2,087 words. Diarization: 2 speakers. Confidence: 97.9%.", actor: "LegalNote AI Engine", hmacFingerprint: "d2b6f0a4e8c13957" },
    { id: "cma5", timestamp: relDateTime(-37, "11:32"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated. Document ID: cmd1.", actor: "LegalNote AI Engine", hmacFingerprint: "7f4c9e1a3b6d0528" },
    { id: "cma6", timestamp: relDateTime(-37, "17:50"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Jonathan Farr.", actor: "Jonathan Farr", hmacFingerprint: "0a8d5c2f7b3e9146" },
    { id: "cma7", timestamp: relDateTime(-14, "10:30"), eventType: "Recording Started", description: "Secure recording commenced — session cms2 (due diligence review).", actor: "LegalNote System", hmacFingerprint: "6c3b9f0e5a2d8147" },
    { id: "cma8", timestamp: relDateTime(-2, "14:00"), eventType: "Document Created", description: "AML EDD report draft created — pending compliance sign-off.", actor: "Jonathan Farr", hmacFingerprint: "e5a0b4f9c2d37168" },
    { id: "cma9", timestamp: relDateTime(-1, "09:00"), eventType: "Compliance Alert", description: "AML EDD not completed — transaction exchange cannot proceed until cleared.", actor: "LegalNote System", hmacFingerprint: "3d7c1a8f4b0e5296" },
    { id: "cma10", timestamp: relDateTime(-1, "09:01"), eventType: "Compliance Alert", description: "Disclosure Letter not reviewed with client — exchange scheduled.", actor: "LegalNote System", hmacFingerprint: "8b5f2e9c0a4d7163" },
  ],
};

const CRIMINAL_LEAD_MATTER: DemoLeadMatter = {
  id: "cr-lead",
  ref: "CRIM/2025/0812",
  title: "Crown Court — [Client Name] (GBH s.18 OAPA)",
  clientName: "S. [Prospect]",
  practiceArea: "criminal",
  solicitor: "Daniel Hewitt",
  firmName: "[Firm]",
  openedDate: relDate(-50),
  sessions: [
    {
      id: "crs1",
      date: relDate(-49),
      duration: "75 min",
      type: "Initial Consultation",
      attendees: ["Daniel Hewitt (Solicitor)", "S. [Prospect] (Client/Defendant)"],
      summary: "Initial consultation at HMP Remand. Client charged with GBH with intent under s.18 OAPA 1861 following an incident outside a public house. Defence instructions, prosecution evidence overview, and Crown Court case management discussed.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "crs2",
      date: relDate(-20),
      duration: "60 min",
      type: "Case Review",
      attendees: ["Daniel Hewitt (Solicitor)", "S. [Prospect] (Client/Defendant)"],
      summary: "Review of prosecution disclosure (first tranche). CCTV footage discussed — partially supports defence account. Forensic expert instruction agreed.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "crd1", title: "Attendance Note — Crown Court Initial Consultation (HMP)", type: "Attendance Note", status: "approved", generatedAt: relDate(-49) },
    { id: "crd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-49) },
    { id: "crd3", title: "Defence Case Statement — Crown Court", type: "Defence Statement", status: "draft", generatedAt: relDate(-3) },
    { id: "crd4", title: "Case Summary — Prosecution Evidence Analysis", type: "Case Summary", status: "pending_review", generatedAt: relDate(-5) },
  ],
  transcript: [
    { id: "crt1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good afternoon, [Client Name]. I'm Daniel Hewitt, your solicitor. I'm going to be recording this consultation to produce an accurate attendance note — the recording is encrypted and legally privileged. Before we start, do you consent to being recorded?" },
    { id: "crt2", speaker: "Client", timestamp: "00:00:18", text: "Yes. And I want to say right from the start — I didn't intend to hurt him that badly. It all happened very fast." },
    { id: "crt3", speaker: "Solicitor", timestamp: "00:00:26", text: "I hear you, and I want to hear your full account. But first let me explain the charge and what the prosecution will need to prove. You're charged with grievous bodily harm with intent under section 18 of the Offences Against the Person Act 1861. That's a very serious charge — the maximum sentence is life imprisonment. To convict under s.18, the prosecution must prove both that you caused really serious harm and that you intended to cause really serious harm, or intended to resist lawful arrest. If they can't prove intent, the charge could reduce to s.20 — unlawful and malicious wounding — which carries a maximum of five years and a very different sentencing bracket. Understanding your state of mind at the time is therefore absolutely critical. Let me take your account." },
    { id: "crt4", speaker: "Client", timestamp: "00:01:20", text: "I was outside The Crown pub on Saturday night. A group of men — I didn't know them — started making comments about my partner. I told them to leave it. One of them — the complainant — came at me first. He had a bottle in his hand. I grabbed his arm and pushed him and he fell and hit his head on the kerb. I did not hit him with anything. I've never even been in a fight before." },
    { id: "crt5", speaker: "Solicitor", timestamp: "00:01:52", text: "This is an important account. You're saying you acted in self-defence or at least in response to a threatening act by the complainant. Self-defence is a complete defence to s.18 — if a jury believes you used reasonable force to defend yourself from an imminent attack, you must be acquitted. The question is always whether the force was reasonable in the circumstances as you believed them to be. The fact that the complainant had a bottle is highly relevant. Is there any CCTV coverage of the area outside The Crown?" },
    { id: "crt6", speaker: "Client", timestamp: "00:02:22", text: "The police told me there's pub CCTV and a council camera across the road." },
    { id: "crt7", speaker: "Solicitor", timestamp: "00:02:27", text: "We'll need disclosure of all CCTV footage immediately. This is a priority. If the footage shows the complainant approaching you with a bottle, that fundamentally supports your self-defence account. I'll apply for disclosure of all CCTV evidence — pub and council — as a matter of urgency. Now, what were your injuries? You mentioned he came at you first." },
    { id: "crt8", speaker: "Client", timestamp: "00:02:44", text: "I had bruising on my forearm where I grabbed his arm, and a cut on my hand. I went to hospital the day after and it's on record." },
    { id: "crt9", speaker: "Solicitor", timestamp: "00:02:53", text: "Excellent — your injuries are evidence of a physical altercation and support your account of a struggle. I'll obtain those hospital records. The complainant's injuries — what is the prosecution alleging?" },
    { id: "crt10", speaker: "Client", timestamp: "00:03:01", text: "They say he has a fractured skull and a brain bleed. He was in intensive care for five days." },
    { id: "crt11", speaker: "Solicitor", timestamp: "00:03:07", text: "Those are serious injuries which explain why the charge is s.18 rather than s.20. However, the mechanism — a fall onto a kerb — is consistent with your account of a struggle and push rather than a deliberate assault. The prosecution will argue that you intended the result; your case is that the injury resulted from a fall caused by reasonable defensive force. We'll need a forensic medical expert to consider whether the injury pattern is consistent with your account. Were there any witnesses?" },
    { id: "crt12", speaker: "Client", timestamp: "00:03:34", text: "My partner was there. And a couple near the door of the pub — I don't know their names but the police will have spoken to them." },
    { id: "crt13", speaker: "Solicitor", timestamp: "00:03:42", text: "Your partner's evidence will be important though the prosecution will challenge it as an interested witness. The couple near the door are potentially independent — we'll request the prosecution's witness list through disclosure. Now, bail — you're currently on remand. Was bail refused at the Magistrates?" },
    { id: "crt14", speaker: "Client", timestamp: "00:03:57", text: "Yes. They said flight risk because I have family in Ireland. I've lived in this country for twelve years." },
    { id: "crt15", speaker: "Solicitor", timestamp: "00:04:03", text: "We'll make a bail application to the Crown Court. We'll address the flight risk directly — your twelve-year residence, your employment, your partner and settled life here. We can offer a conditional bail package: curfew, reporting conditions, surrender of passport. I'm cautiously optimistic. If granted, that will make a significant difference to your wellbeing and our ability to prepare your defence effectively. Now, please hear me carefully: do not discuss this case with anyone — not friends, not family — other than me and counsel we instruct. Do not post anything online. Do not contact the complainant or any witnesses. These steps are critical to protecting your position. Do you understand?" },
    { id: "crt16", speaker: "Client", timestamp: "00:04:50", text: "Yes. I understand. What happens next?" },
    { id: "crt17", speaker: "Solicitor", timestamp: "00:04:53", text: "The case will be sent to Crown Court for a Preliminary Hearing, likely in the next three to four weeks. There'll be a PTPH — Plea and Trial Preparation Hearing — where you'll be asked to enter a plea. We'll take full instructions before that hearing. In the meantime I'll apply for bail, request all prosecution disclosure, obtain your medical records, and start looking at instructing a forensic medical expert and a specialist defence barrister. I'll be in contact within 48 hours. Is there anything else you want me to know today?" },
    { id: "crt18", speaker: "Client", timestamp: "00:05:22", text: "Just that I'm frightened and I want to be home with my family. I swear I wasn't trying to hurt anyone." },
    { id: "crt19", speaker: "Solicitor", timestamp: "00:05:28", text: "I hear that, [Client Name], and we'll do everything we can. The self-defence account, if supported by the CCTV and forensic evidence, is a genuine and strong line of defence. Thank you for being open with me today." },
    { id: "crt20", speaker: "Client", timestamp: "00:05:38", text: "I need to ask about legal aid — I don't have savings and my partner works part time. Can I get legal aid for a Crown Court case?" },
    { id: "crt21", speaker: "Solicitor", timestamp: "00:05:44", text: "Yes — Crown Court cases are generally covered by legal aid, subject to a means test and an interests of justice test. Given the severity of the charge — s.18 GBH with a potential custodial sentence — the interests of justice test will be satisfied automatically. The means test looks at your household income and capital. If your household gross annual income is below £37,500, you'll be passported to legal aid without any contribution. If it's above that threshold, you may still qualify but with a monthly contribution from income assessed by the Legal Aid Agency. Do you know your approximate household gross income?" },
    { id: "crt22", speaker: "Client", timestamp: "00:06:20", text: "My partner earns about £18,000 a year and I was earning about £24,000 before this. So combined roughly £42,000. I haven't worked since the arrest and I'm on remand so there's no income at the moment." },
    { id: "crt23", speaker: "Solicitor", timestamp: "00:06:30", text: "Because you're currently remanded in custody, your income for the means test is assessed at zero for the period of custody. The Legal Aid Agency will assess income at the point of application — if you're remanded, the income test is typically straightforward and legal aid will very likely be granted. I'll make the representation order application to the Crown Court immediately. There's a form you'll need to complete — the CRM14 — which I'll bring to our next visit or send for your electronic signature. You may also be required to complete a CRM15 capital and equity assessment given the household income level. Do you own any property or have significant savings?" },
    { id: "crt24", speaker: "Client", timestamp: "00:07:08", text: "No, we rent. No savings to speak of. We have about £2,000 in a current account." },
    { id: "crt25", speaker: "Solicitor", timestamp: "00:07:12", text: "Then capital is not a barrier at all. Legal aid will almost certainly be granted. That covers my fees and barrister's fees for the Crown Court proceedings. Now, regarding the barrister — for a s.18 case I'll instruct a QC or a senior junior, depending on how the case develops. You'll have input into that decision. I'll also be at all court hearings with you, not just the barrister. You'll have full representation throughout. Now — before I go, is there any medication or health condition the remand centre needs to know about, or anything affecting your welfare on remand that I should take up urgently with the Governor?" },
    { id: "crt26", speaker: "Client", timestamp: "00:07:45", text: "I have asthma and my inhaler is running out. I've asked twice and nobody has helped. Is there something you can do?" },
    { id: "crt27", speaker: "Solicitor", timestamp: "00:07:51", text: "Absolutely. That's a health matter and the prison is legally obliged to provide adequate healthcare. I'll write to the Governor today by fax — fax is the fastest route — and also contact the prison's healthcare department. If the situation isn't resolved promptly I can apply for an urgent legal visit or contact the Prison Ombudsman. I'll follow this up as a priority today. Thank you for telling me. Make sure you tell the landing officer about the inhaler again today as well — repeat it in writing if you can, even a note to the wing officer. I'll deal with this." },
    { id: "crt28", speaker: "Client", timestamp: "00:08:10", text: "There's something else I've been thinking about. I know the CCTV showed part of what happened. Can my legal team get access to it?" },
    { id: "crt29", speaker: "Solicitor", timestamp: "00:08:18", text: "Yes — and we already will. CCTV evidence held by the prosecution must be disclosed to the defence under the Criminal Procedure and Investigations Act 1996. Once the case is sent to Crown Court, there will be a formal disclosure process. The prosecution is under a continuing duty to disclose all unused material that meets the disclosure test — that is, material that might reasonably be considered capable of undermining the case for the prosecution or assisting the case for the defence. CCTV footage that shows the build-up to the incident — not just the moment of the assault — is exactly the kind of material that could support your account of self-defence. I'll write to the police immediately requesting disclosure of all CCTV exhibits, including footage from multiple angles and the surrounding period before and after the incident. If the prosecution fails to preserve or disclose relevant CCTV, that is itself a ground to challenge the fairness of the proceedings. We've seen cases where CCTV has been lost or wiped and the court has had to consider whether proceedings should be stayed as an abuse of process." },
    { id: "crt30", speaker: "Client", timestamp: "00:09:05", text: "The bar had CCTV on the entrance and inside the venue. The bouncers saw what happened." },
    { id: "crt31", speaker: "Solicitor", timestamp: "00:09:12", text: "The bouncers are important potential witnesses. If they witnessed the precursor to the incident — including the complainant's behaviour towards you — their evidence could corroborate your account significantly. I'll write to the venue management immediately requesting preservation of all CCTV footage, both entrance and interior, from 10pm to 1am on the night in question. Even if the police have already seized some footage, there may be additional angles they haven't collected. The venue has a legal obligation to preserve evidence once they receive a written request from a solicitor. If they delete footage after receiving such a request, that could be material to the proceedings. I'll send that letter today. Do you know the names of any of the bouncers?" },
    { id: "crt32", speaker: "Client", timestamp: "00:09:48", text: "One of them was called Steve — I don't know his surname. He was the one standing closest when it started. He saw the other man push me first." },
    { id: "crt33", speaker: "Solicitor", timestamp: "00:09:55", text: "Steve is a valuable potential witness. I'll ask the venue management to identify all door staff who were working that evening and to provide contact details. We can then approach them for a witness statement. Even if Steve is initially reluctant to get involved, we can compel attendance with a witness summons if necessary once proceedings are issued. A credible independent eyewitness who saw the complainant initiate physical contact is enormously powerful in a self-defence case. It transforms the case from your word against the complainant's to an independently corroborated account. I'm going to prioritise the witness and CCTV letters alongside the bail application and legal aid application this afternoon. I want all of those in the post before close of business today. Take care of yourself and stay positive — we have a strong case and a clear strategy." },
  ],
  attendanceNoteBody: `**Matter:** Crown Court — [Client Name] (GBH s.18 OAPA 1861)
**Reference:** CRIM/2025/0812
**Date of Attendance:** ${relDate(-49)}
**Solicitor:** Daniel Hewitt
**Client Present:** S. [Prospect] (Defendant, HMP Remand)
**Duration:** 75 minutes

---

**1. Introduction and Recording Consent**

Recording consent obtained. Recording encrypted and subject to legal professional privilege.

**2. Charge**

GBH with intent, contrary to s.18 Offences Against the Person Act 1861. Maximum: life imprisonment. Key issue: intent to cause really serious harm or intent to resist arrest. Reduction to s.20 (max 5 years) available if intent not proved.

**3. Client's Account**

Outside The Crown public house. The complainant, one of a group of males, approached the client making comments about his partner. Complainant held a bottle and approached aggressively. Client grabbed complainant's arm and pushed him in a defensive response. Complainant fell and struck his head on the kerb. Client denies striking the complainant with any object. No prior criminal record.

**4. Defence — Self-Defence**

Client acting in response to perceived imminent threat. Bottle in complainant's hand supports belief of impending attack. Force used (grab and push) arguably reasonable in circumstances. Self-defence is a complete defence to s.18. CCTV footage (pub and council) — disclosure to be applied for urgently.

**5. Prosecution Allegations**

Complainant suffered fractured skull and intracerebral haemorrhage. Five days in intensive care. Injury mechanism (fall onto kerb) consistent with client's account — forensic expert to be instructed to assess.

**6. Client's Injuries**

Forearm bruising and hand laceration documented in hospital records the day after the incident. Evidence consistent with a physical struggle.

**7. Bail**

Currently remanded. Bail refused by Magistrates (flight risk — family in Ireland). Crown Court bail application to be made. Proposed conditions: curfew, reporting, surrender of passport.

**8. Witnesses**

Client's partner (present). Couple near pub entrance (unknown — to be sought through prosecution witness list). Full prosecution disclosure to be applied for.

**9. Next Steps**

1. Apply for Crown Court bail within 48 hours.
2. Apply for all prosecution disclosure — CCTV (pub and council), witness statements, forensic evidence.
3. Obtain client's hospital records (forearm/hand injuries).
4. Instruct forensic medical expert to assess injury causation.
5. Instruct specialist defence barrister.
6. Preliminary Hearing / PTPH — take full plea instructions before hearing.
7. File Defence Case Statement by statutory deadline.

**10. Compliance Note**

Attendance note generated by LegalNote AI Engine. Reviewed and approved by Daniel Hewitt.`,
  undertakings: [
    { id: "cru1", description: "Apply for Crown Court bail within 48 hours of this consultation.", givenBy: "Daniel Hewitt", givenTo: "S. [Prospect]", dueDate: relDate(-47), status: "completed" },
    { id: "cru2", description: "File Defence Case Statement with Crown Court by statutory deadline.", givenBy: "Daniel Hewitt", givenTo: "Crown Court", dueDate: relDate(-2), status: "overdue" },
    { id: "cru3", description: "Instruct forensic medical expert to assess injury causation and report.", givenBy: "Daniel Hewitt", givenTo: "Medical Expert", dueDate: relDate(-2), status: "overdue" },
  ],
  timeEntries: [
    { id: "crte1", date: relDate(-49), description: "Initial consultation (HMP) — 75 minutes", units: 5.0, rate: 200, fee: 1000 },
    { id: "crte2", date: relDate(-48), description: "Bail application — Crown Court", units: 2.0, rate: 200, fee: 400 },
    { id: "crte3", date: relDate(-20), description: "Case review meeting — 60 minutes", units: 4.0, rate: 200, fee: 800 },
    { id: "crte4", date: relDate(-5), description: "Defence case statement — draft", units: 2.5, rate: 200, fee: 500 },
  ],
  auditTrail: [
    { id: "cra1", timestamp: relDateTime(-49, "14:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording at HMP.", actor: "LegalNote System", hmacFingerprint: "2f5a8c1e9b3d0647" },
    { id: "cra2", timestamp: relDateTime(-49, "14:03"), eventType: "Recording Started", description: "Secure recording commenced — matter CRIM/2025/0812, session crs1.", actor: "LegalNote System", hmacFingerprint: "d7b4f2a0c8e13956" },
    { id: "cra3", timestamp: relDateTime(-49, "15:18"), eventType: "Recording Completed", description: "Recording ended. Duration: 75 minutes. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "6c1a9f3b5e0d2847" },
    { id: "cra4", timestamp: relDateTime(-49, "15:34"), eventType: "Transcript Produced", description: "AI transcription completed. 2,105 words. Diarization: 2 speakers. Confidence: 97.4%.", actor: "LegalNote AI Engine", hmacFingerprint: "a3e8b0c4f7d12956" },
    { id: "cra5", timestamp: relDateTime(-49, "15:37"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated. Document ID: crd1.", actor: "LegalNote AI Engine", hmacFingerprint: "9d2c7f0b5a4e3168" },
    { id: "cra6", timestamp: relDateTime(-49, "18:10"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Daniel Hewitt.", actor: "Daniel Hewitt", hmacFingerprint: "4b6f1e3a9c0d8257" },
    { id: "cra7", timestamp: relDateTime(-20, "10:00"), eventType: "Recording Started", description: "Secure recording commenced — session crs2 (case review).", actor: "LegalNote System", hmacFingerprint: "7e4c2b8f0d3a5196" },
    { id: "cra8", timestamp: relDateTime(-5, "14:00"), eventType: "Document Created", description: "Defence Case Statement draft created — pending partner review.", actor: "Daniel Hewitt", hmacFingerprint: "1a9d6c3f8e0b2475" },
    { id: "cra9", timestamp: relDateTime(-2, "09:00"), eventType: "Compliance Alert", description: "Defence Case Statement not filed — statutory deadline missed.", actor: "LegalNote System", hmacFingerprint: "e5f8b1a4c2d07369" },
    { id: "cra10", timestamp: relDateTime(-2, "09:01"), eventType: "Compliance Alert", description: "Forensic medical expert not yet instructed — trial listing in 6 weeks.", actor: "LegalNote System", hmacFingerprint: "3c0e7a5b9f1d4286" },
  ],
};

const DEBT_RECOVERY_LEAD_MATTER: DemoLeadMatter = {
  id: "dr-lead",
  ref: "DEBT/2025/1021",
  title: "Commercial Debt — [Client Name] v Dunmore Supplies Ltd",
  clientName: "S. [Prospect]",
  practiceArea: "debt-recovery",
  solicitor: "Hannah Kite",
  firmName: "[Firm]",
  openedDate: relDate(-28),
  sessions: [
    {
      id: "drs1",
      date: relDate(-27),
      duration: "45 min",
      type: "Initial Consultation",
      attendees: ["Hannah Kite (Solicitor)", "S. [Prospect] (Client/Creditor)"],
      summary: "Initial consultation regarding an unpaid commercial debt of £38,400 owed by Dunmore Supplies Ltd. Contract terms, breach, and pre-action protocol steps discussed.",
      transcriptProduced: true,
      noteProduced: true,
    },
    {
      id: "drs2",
      date: relDate(-10),
      duration: "30 min",
      type: "LBA Follow-up",
      attendees: ["Hannah Kite (Solicitor)", "S. [Prospect] (Client/Creditor)"],
      summary: "LBA not yet sent — documentation gaps identified. Client provided all outstanding invoices and delivery notes. LBA now ready for issue.",
      transcriptProduced: true,
      noteProduced: true,
    },
  ],
  documents: [
    { id: "drd1", title: "Attendance Note — Debt Recovery Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-27) },
    { id: "drd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-27) },
    { id: "drd3", title: "Letter Before Action — Dunmore Supplies Ltd", type: "Pre-Action Letter", status: "draft", generatedAt: relDate(-2) },
    { id: "drd4", title: "County Court Money Claim — Particulars of Claim", type: "Court Claim", status: "draft", generatedAt: relDate(-1) },
  ],
  transcript: [
    { id: "drt1", speaker: "Solicitor", timestamp: "00:00:00", text: "Good morning, [Client Name]. I'm Hannah Kite, I head our debt recovery team. Before we start I'll let you know I'm recording this meeting to produce an accurate attendance note — encrypted, used only for that purpose. Happy to proceed?" },
    { id: "drt2", speaker: "Client", timestamp: "00:00:16", text: "Yes, absolutely. Thank you. I'm at my wits' end with this — I've been chasing Dunmore Supplies for four months now." },
    { id: "drt3", speaker: "Solicitor", timestamp: "00:00:24", text: "Four months — that's a long time. Let's get the full picture. Tell me about the debt." },
    { id: "drt4", speaker: "Client", timestamp: "00:00:30", text: "My company — [Client Name] Ltd — supplied Dunmore Supplies with industrial shelving units. Total contract value £38,400 plus VAT. We delivered in three tranches over February and March. They signed delivery notes each time. We invoiced them in three instalments — all overdue now. They initially disputed the quality of one batch, but they never raised it formally and they've been using all the shelving since February. Now they just don't respond to emails or calls." },
    { id: "drt5", speaker: "Solicitor", timestamp: "00:01:10", text: "That's a clear factual picture. Do you have the contract in writing?" },
    { id: "drt6", speaker: "Client", timestamp: "00:01:14", text: "We have a written purchase order from Dunmore, our terms and conditions, the three invoices, and the signed delivery notes." },
    { id: "drt7", speaker: "Solicitor", timestamp: "00:01:20", text: "Excellent — that's a strong evidentiary base. The signed delivery notes are particularly valuable because they confirm receipt of the goods. For a commercial debt claim of £38,400, the pre-action protocol for debt claims requires that before we issue court proceedings we must send a Letter Before Claim — commonly called a Letter Before Action or LBA — giving Dunmore Supplies 30 days to respond. The LBA must set out the debt clearly, enclose copies of the key documents, and invite them to reply with any dispute or propose a payment plan. Have you sent any formal letter of claim to date?" },
    { id: "drt8", speaker: "Client", timestamp: "00:01:55", text: "I've sent emails and left voicemails. Nothing formal." },
    { id: "drt9", speaker: "Solicitor", timestamp: "00:01:59", text: "Then we'll draft and send the LBA from our offices — that signals seriousness and often prompts a response that informal chasing doesn't. I want to flag two things. First, the quality dispute they mentioned — even though it was never formally raised, they may raise it now as a counterclaim or set-off once legal proceedings are threatened. We should pre-empt that in the LBA by noting that you have not received any written formal complaint regarding quality and that the goods have been in continuous use. Second, once we send the LBA, Dunmore have 30 days to respond under the protocol. If they don't respond or make no payment, we proceed to issue a County Court Money Claim through the MCOL online portal. Claims over £25,000 are issued in the County Court — for a claim of £38,400 we'll be in that bracket." },
    { id: "drt10", speaker: "Client", timestamp: "00:02:50", text: "What happens at the County Court stage?" },
    { id: "drt11", speaker: "Solicitor", timestamp: "00:02:54", text: "We issue the claim through MCOL — Dunmore then have 14 days to acknowledge and 28 days to file a Defence from service. If they don't respond, we can apply for judgment in default — that's a Court judgment in your favour without a hearing. That judgment can then be enforced through a range of mechanisms: a charging order over their property, an attachment of earnings order, a warrant of control for enforcement agents, or — if they're insolvent — a winding-up petition. If they do file a Defence, the claim is allocated to the County Court fast track or multi-track depending on value. At £38,400 it will be fast track — normally a hearing within nine to twelve months. However, I should tell you that most commercial debts of this type settle after the LBA or shortly after proceedings are issued." },
    { id: "drt12", speaker: "Client", timestamp: "00:03:44", text: "And can I claim interest on top of the debt? It's been sitting unpaid for four months." },
    { id: "drt13", speaker: "Solicitor", timestamp: "00:03:48", text: "Yes — under the Late Payment of Commercial Debts Act 1998, which applies automatically to business-to-business contracts, you're entitled to claim statutory interest at 8% per annum over the Bank of England base rate, from the date each invoice became overdue. On £38,400 over four months that's approximately £1,200 to £1,500 depending on the exact overdue dates. We'll calculate it precisely when we draft the claim. You're also entitled to fixed debt recovery costs under the Act: for a debt over £10,000 that's £100 per invoice in compensation." },
    { id: "drt14", speaker: "Client", timestamp: "00:04:20", text: "Good. I want every penny I'm owed. Can I also claim my legal fees?" },
    { id: "drt15", speaker: "Solicitor", timestamp: "00:04:24", text: "In the County Court, the loser generally pays the winner's costs, but for fast track claims those costs are assessed on the standard basis and are often not the full amount of your actual legal fees. If the claim is defended and goes to trial, you'd recover a proportion. Our fees for taking this from LBA through to judgment in default — assuming Dunmore don't defend — will be around £2,000 to £3,000 plus VAT and Court fees. If defended and it reaches trial, significantly more. I'll give you a full estimate in the client care letter. One further thought — have you checked whether Dunmore Supplies Ltd is financially solvent? It's worth running a Companies House search." },
    { id: "drt16", speaker: "Client", timestamp: "00:05:05", text: "They looked fine six months ago — no CCJs on record. But I honestly don't know their current position." },
    { id: "drt17", speaker: "Solicitor", timestamp: "00:05:10", text: "I'll run a credit and Companies House search immediately. If they have CCJs or if a winding-up petition has been filed against them, the strategy may need to change. You don't want to spend money pursuing a company that's about to go into administration. To summarise today's next steps: I'll draft the LBA and send it to you for approval before we dispatch; I'll run Companies House and credit checks on Dunmore; and I'll issue the client care letter and fee estimate today. Any questions?" },
    { id: "drt18", speaker: "Client", timestamp: "00:05:42", text: "No, that all makes sense. I just want to get paid. Please move as quickly as you can." },
    { id: "drt19", speaker: "Solicitor", timestamp: "00:05:48", text: "Understood — we'll have the LBA ready for your approval within two working days. Thank you, [Client Name]." },
    { id: "drt20", speaker: "Client", timestamp: "00:05:56", text: "One thing I forgot to mention — Dunmore Supplies sent me an email about three weeks ago saying they intended to dispute the quality of a second batch, not just the first. They said they would be 'seeking to reduce the amount owed'. Does that change things?" },
    { id: "drt21", speaker: "Solicitor", timestamp: "00:06:05", text: "This is important information. Do you have that email?" },
    { id: "drt22", speaker: "Client", timestamp: "00:06:08", text: "Yes — it's in writing. I can forward it to you today." },
    { id: "drt23", speaker: "Solicitor", timestamp: "00:06:11", text: "Please do — send it as soon as you can after this meeting. A written indication of an intent to dispute, even a vague one like 'seeking to reduce the amount owed', is something the pre-action protocol actually anticipates. Under the protocol, the debtor can use the Reply Form to set out any counterclaim, set-off, or dispute. If they're going to raise a quality dispute, they must do so formally within the 30-day response window. The key point is that they have been using all the goods since February — you told me they've been using the shelving continuously. That is enormously helpful to us. In law, continued use of goods after a complaint is very strong evidence of acceptance. If they have accepted the goods by using them, they cannot subsequently reject them or withhold the full price on quality grounds. We'll make that argument explicitly in the LBA." },
    { id: "drt24", speaker: "Client", timestamp: "00:06:50", text: "That is reassuring. Is there anything else I can do to strengthen our position?" },
    { id: "drt25", speaker: "Solicitor", timestamp: "00:06:54", text: "Yes — preserve everything. Keep all emails, delivery records, photographs you took of the goods at delivery, and any other contemporaneous records. If Dunmore raise a quality defence, you'll want evidence of the condition of the goods at delivery. Also, check whether any of your staff who oversaw delivery are still employed and could provide a witness statement if needed. We'll also want to ensure your terms and conditions include a clear exclusion of consequential loss and limit your liability for quality disputes — I'll review your standard T&Cs and let you know if there are any weaknesses to address for future contracts. For this claim, the signed delivery notes and continued use of the goods are your strongest assets." },
    { id: "drt26", speaker: "Client", timestamp: "00:07:30", text: "We have delivery photographs — I always photograph the consignment before it leaves our warehouse and the driver photographs the unloading at the customer's premises. We have both sets for all three deliveries." },
    { id: "drt27", speaker: "Solicitor", timestamp: "00:07:40", text: "Excellent — that is exactly the kind of contemporaneous evidence that can be decisive. Compile those photographs and send them with the invoices, delivery notes, and the Dunmore email. We'll reference the photographic record of delivery condition in the LBA itself. If this does go to court, a judge will give significant weight to timestamped delivery photographs alongside signed delivery notes — it will be very difficult for Dunmore to sustain a quality argument in the face of that evidence. I'm genuinely confident in the strength of this claim. Let's move quickly." },
    { id: "drt28", speaker: "Client", timestamp: "00:08:05", text: "What is the realistic timescale if they don't pay after the LBA?" },
    { id: "drt29", speaker: "Solicitor", timestamp: "00:08:12", text: "The LBA gives 14 days to pay or respond. After that, if there's no payment or substantive engagement, we issue the claim at the County Court Business Centre — CCBC — online. For a claim of £42,380, you're in the Multi-Track, which means a more structured timetable and an allocation questionnaire. The court will list a case management conference, typically two to three months after issue. Directions will be set for exchange of witness statements, expert evidence if any, and disclosure. The trial, depending on the court's listing pressures, would typically be six to twelve months after issue. So the full litigation timetable from LBA to trial, if Dunmore refuse to pay, is approximately nine to fifteen months. Most defendants in commercial debt cases settle well before trial once they understand the strength of the claimant's case and the costs consequences of refusing a reasonable offer." },
    { id: "drt30", speaker: "Client", timestamp: "00:09:00", text: "And what about costs — will we recover our legal fees if we win?" },
    { id: "drt31", speaker: "Solicitor", timestamp: "00:09:08", text: "Yes, subject to the court's discretion. In Multi-Track cases, costs follow the event — meaning the losing party typically pays the winning party's reasonable costs. However, the word 'reasonable' is important: costs are assessed and the court can reduce claimed costs if they consider them disproportionate to the value of the claim. For a claim of this size, my costs estimate from LBA to trial if contested would be in the range of £22,000 to £30,000 plus VAT. If we win, we'd expect to recover 70–80% of those costs from Dunmore on a standard basis assessment. There are also fixed costs provisions in some court tracks, but the Multi-Track allows for full costs recovery. The late payment statutory interest and compensation under the Late Payment of Commercial Debts Act also add to the deterrent and the recovery — at the current statutory rate of 8% above base, the interest on £42,380 over six months is approximately £2,100 and counting. That goes into the claim." },
    { id: "drt32", speaker: "Client", timestamp: "00:10:05", text: "I didn't know about the statutory interest. That's helpful. What's our next immediate step?" },
    { id: "drt33", speaker: "Solicitor", timestamp: "00:10:12", text: "Send me everything today — invoices, delivery notes, delivery photographs, and the Dunmore email. I'll review by tomorrow morning and have a draft LBA to you by tomorrow afternoon. Once you approve it, we issue immediately. My strong view is that Dunmore will respond within the 14-day LBA period — they're unlikely to want litigation when their defence is weak and the evidence record is so strong against them. Let's proceed. I'll issue the client care letter and fee agreement to you this afternoon. Thank you for coming in." },
    { id: "drt34", speaker: "Client", timestamp: "00:10:35", text: "One more thing — if they do pay, either in full or partially, do you handle the receipt of funds or does that come directly to us?" },
    { id: "drt35", speaker: "Solicitor", timestamp: "00:10:42", text: "If Dunmore make a payment in response to the LBA and we've agreed a settlement figure in correspondence, the funds would typically be sent directly to your business bank account — we'd confirm your payment details in the settlement correspondence. We don't handle client funds for debt recovery unless you've asked us to hold a retention or handle a contested court payment. If the matter goes to court and the court orders payment, the defendant pays directly to you as the claimant. Our invoice for legal fees comes separately to you. If Dunmore make only a partial payment and dispute the balance, we'd advise you whether to accept or reject the partial payment — accepting it without the right reservation of position wording could potentially be construed as a settlement of the full debt, which is why all communications around settlement need to go through me. Please don't accept or respond to any payment or offer from Dunmore without letting me know first." },
  ],
  attendanceNoteBody: `**Matter:** Commercial Debt — [Client Name] v Dunmore Supplies Ltd
**Reference:** DEBT/2025/1021
**Date of Attendance:** ${relDate(-27)}
**Solicitor:** Hannah Kite
**Client Present:** S. [Prospect] (Director, [Client Name] Ltd)
**Duration:** 45 minutes

---

**1. Introduction and Recording Consent**

Recording consent obtained. Client confirmed willingness to proceed.

**2. Background and Instructions**

[Client Name] Ltd supplied Dunmore Supplies Ltd with industrial shelving units under a written purchase order. Total contract value: £38,400 + VAT. Delivery completed in three tranches (February–March), each evidenced by signed delivery notes. Three invoices raised — all overdue. Informal quality complaint raised by Dunmore but never formalised; goods in continuous use since delivery. Debtor unresponsive to emails and calls for approximately four months.

**3. Evidence Available**

- Written purchase order from Dunmore Supplies Ltd
- [Client Name] Ltd standard terms and conditions
- Three invoices (all overdue)
- Three signed delivery notes confirming receipt

**4. Pre-Action Protocol Requirements**

Letter Before Action (LBA) required under the Pre-Action Protocol for Debt Claims before issuing County Court proceedings. 30-day response period. LBA to include reference to absence of any formal written quality complaint and continuous use of goods by debtor.

**5. Late Payment Act — Interest and Compensation**

Statutory interest at 8% per annum over Bank of England base rate under the Late Payment of Commercial Debts (Interest) Act 1998. Approximate interest: £1,200–£1,500 on £38,400 over 4 months. Fixed compensation: £100 per invoice for debts over £10,000.

**6. County Court Process**

MCOL claim to be issued if no response within 30 days of LBA. Dunmore: 14 days to acknowledge, 28 days to file Defence. No Defence → judgment in default → enforcement options (charging order, warrant of control, winding-up). Fast track allocation at £38,400. Settlement likely following LBA or shortly after proceedings issued.

**7. Solvency Check**

Solicitor to run Companies House and credit check on Dunmore Supplies Ltd as a priority — to assess risk of pursuing an insolvent debtor.

**8. Costs**

Estimated legal fees: £2,000–£3,000 + VAT + Court fees (LBA to default judgment, undefended). Fee estimate to be confirmed in client care letter.

**9. Next Steps**

1. Solicitor to draft LBA — client to approve before issue.
2. Solicitor to run Companies House and credit checks on Dunmore Supplies Ltd.
3. Solicitor to issue Client Care Letter and fee estimate today.
4. If no response to LBA within 30 days: issue MCOL County Court claim.

**10. Compliance Note**

Attendance note generated by LegalNote AI Engine. Reviewed and approved by Hannah Kite.`,
  undertakings: [
    { id: "dru1", description: "Issue Client Care Letter and fee estimate by close of business today.", givenBy: "Hannah Kite", givenTo: "S. [Prospect]", dueDate: relDate(-27), status: "completed" },
    { id: "dru2", description: "Draft and dispatch Letter Before Action to Dunmore Supplies Ltd.", givenBy: "Hannah Kite", givenTo: "Dunmore Supplies Ltd", dueDate: relDate(-1), status: "overdue" },
    { id: "dru3", description: "Issue County Court Money Claim (MCOL) if no response to LBA within 30 days.", givenBy: "Hannah Kite", givenTo: "County Court", dueDate: relDate(-1), status: "overdue" },
  ],
  timeEntries: [
    { id: "drte1", date: relDate(-27), description: "Initial consultation — 45 minutes", units: 3.0, rate: 220, fee: 660 },
    { id: "drte2", date: relDate(-27), description: "Client care letter and Companies House search", units: 0.5, rate: 220, fee: 110 },
    { id: "drte3", date: relDate(-10), description: "LBA follow-up meeting — 30 minutes", units: 2.0, rate: 220, fee: 440 },
    { id: "drte4", date: relDate(-2), description: "Draft Letter Before Action", units: 1.0, rate: 220, fee: 220 },
  ],
  auditTrail: [
    { id: "dra1", timestamp: relDateTime(-27, "09:02"), eventType: "Consent Obtained", description: "Client gave verbal consent to meeting recording.", actor: "LegalNote System", hmacFingerprint: "7c3e1a9b5f0d2486" },
    { id: "dra2", timestamp: relDateTime(-27, "09:03"), eventType: "Recording Started", description: "Secure recording commenced — matter DEBT/2025/1021, session drs1.", actor: "LegalNote System", hmacFingerprint: "a2f5d8b0c4e71396" },
    { id: "dra3", timestamp: relDateTime(-27, "09:48"), eventType: "Recording Completed", description: "Recording ended. Duration: 45 minutes. AES-256 encrypted.", actor: "LegalNote System", hmacFingerprint: "4d9c7f2a1e5b0368" },
    { id: "dra4", timestamp: relDateTime(-27, "10:03"), eventType: "Transcript Produced", description: "AI transcription completed. 2,073 words. Diarization: 2 speakers. Confidence: 98.5%.", actor: "LegalNote AI Engine", hmacFingerprint: "b6a3e1c8f0d42957" },
    { id: "dra5", timestamp: relDateTime(-27, "10:06"), eventType: "Attendance Note Generated", description: "Attendance note auto-generated. Document ID: drd1.", actor: "LegalNote AI Engine", hmacFingerprint: "0f8d4c2b9a5e7163" },
    { id: "dra6", timestamp: relDateTime(-27, "17:45"), eventType: "Document Approved", description: "Attendance note reviewed and approved by Hannah Kite.", actor: "Hannah Kite", hmacFingerprint: "5e2a6b9f3c0d8147" },
    { id: "dra7", timestamp: relDateTime(-10, "11:00"), eventType: "Recording Started", description: "Secure recording commenced — session drs2 (LBA follow-up).", actor: "LegalNote System", hmacFingerprint: "9b4d1c7e2f8a0536" },
    { id: "dra8", timestamp: relDateTime(-2, "14:00"), eventType: "Document Created", description: "Letter Before Action draft created — awaiting client approval.", actor: "Hannah Kite", hmacFingerprint: "3f7a0b5e8d2c9146" },
    { id: "dra9", timestamp: relDateTime(-1, "09:00"), eventType: "Compliance Alert", description: "Letter Before Action not yet issued — County Court claim cannot be filed.", actor: "LegalNote System", hmacFingerprint: "c8e5f2a0b4d71369" },
    { id: "dra10", timestamp: relDateTime(-1, "09:01"), eventType: "Compliance Alert", description: "MCOL County Court claim not yet filed — debt continues to age.", actor: "LegalNote System", hmacFingerprint: "6a9d3b1e7c4f0528" },
  ],
};

export const DEMO_VARIANTS: Record<PracticeAreaKey, DemoVariant> = {
  family: buildVariant(
    "Family Law",
    71,
    [
      {
        id: "f1",
        ref: "FAM/2025/0412",
        clientName: "S. [Prospect]",
        title: "Child Arrangements Order — S. [Prospect]",
        status: "overdue",
        lastActivity: relDate(-3),
        nextDeadline: relDate(-1),
        riskLevel: "medium",
        obligationsDue: 2,
      },
      {
        id: "f2",
        ref: "FAM/2025/0389",
        clientName: "T. Hargreaves",
        title: "Ancillary Relief — Hargreaves v Hargreaves",
        status: "review_required",
        lastActivity: relDate(-5),
        nextDeadline: relDate(3),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "f3",
        ref: "FAM/2025/0347",
        clientName: "N. Patel",
        title: "Non-Molestation Order — Patel",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(7),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "f4",
        ref: "FAM/2025/0301",
        clientName: "K. Morrison",
        title: "Divorce Petition — Morrison v Morrison",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(14),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "fo1",
        matterId: "f1",
        matterTitle: "Child Arrangements Order — S. [Prospect]",
        type: "CAFCASS Section 7 Response",
        description: "File response to CAFCASS Section 7 report — deadline passed",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "fo2",
        matterId: "f1",
        matterTitle: "Child Arrangements Order — S. [Prospect]",
        type: "Position Statement",
        description: "Lodge position statement with Bristol Family Court ahead of DRA hearing",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "fo3",
        matterId: "f2",
        matterTitle: "Ancillary Relief — Hargreaves v Hargreaves",
        type: "Form E Disclosure",
        description: "Exchange of Form E financial disclosure with respondent's solicitors",
        dueDate: relDate(3),
        status: "due_soon",
        daysDue: 3,
      },
    ],
    [
      { id: "fd1", title: "Attendance Note — Child Arrangements Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-8) },
      { id: "fd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-8) },
      { id: "fd3", title: "C100 Application — Child Arrangements Order", type: "Court Form", status: "approved", generatedAt: relDate(-7) },
      { id: "fd4", title: "Position Statement — DRA Hearing", type: "Court Document", status: "draft", generatedAt: relDate(-2) },
      { id: "fd5", title: "Form E Financial Statement — Hargreaves", type: "Court Form", status: "pending_review", generatedAt: relDate(-5) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 11 },
    FAMILY_LEAD_MATTER
  ),

  immigration: buildVariant(
    "Immigration Law",
    68,
    [
      { id: "i1", ref: "IMM/2025/0178", clientName: "S. [Prospect]", title: "Skilled Worker Visa — S. [Prospect]", status: "overdue", lastActivity: relDate(-4), nextDeadline: relDate(-2), riskLevel: "high", obligationsDue: 2 },
      { id: "i2", ref: "IMM/2025/0155", clientName: "A. Mensah", title: "ILR Application — Mensah", status: "review_required", lastActivity: relDate(-3), nextDeadline: relDate(4), riskLevel: "medium", obligationsDue: 1 },
      { id: "i3", ref: "IMM/2025/0132", clientName: "E. Kowalczyk", title: "EU Settlement Scheme (Late) — Kowalczyk", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(10), riskLevel: "medium", obligationsDue: 0 },
      { id: "i4", ref: "IMM/2025/0118", clientName: "R. Ng", title: "Spouse Visa — Ng", status: "active", lastActivity: relDate(-2), nextDeadline: relDate(18), riskLevel: "low", obligationsDue: 0 },
    ],
    [
      { id: "io1", matterId: "i1", matterTitle: "Skilled Worker Visa — S. [Prospect]", type: "Sponsor Licence Check", description: "Confirm employer sponsor licence status — expired without renewal", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "io2", matterId: "i1", matterTitle: "Skilled Worker Visa — S. [Prospect]", type: "Home Office Biometrics Appointment", description: "Client biometrics appointment not yet booked", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "io3", matterId: "i2", matterTitle: "ILR Application — Mensah", type: "Continuous Residence Evidence", description: "Obtain further evidence of continuous residence for ILR bundle", dueDate: relDate(4), status: "due_soon", daysDue: 4 },
    ],
    [
      { id: "id1", title: "Attendance Note — Skilled Worker Visa Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "id2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "id3", title: "Home Office Sponsor Licence Check Request", type: "Correspondence", status: "approved", generatedAt: relDate(-7) },
      { id: "id4", title: "ILR Supporting Bundle — Continuous Residence Summary", type: "Bundle", status: "pending_review", generatedAt: relDate(-3) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 9 },
    IMMIGRATION_LEAD_MATTER
  ),

  conveyancing: buildVariant(
    "Residential Conveyancing",
    74,
    [
      { id: "c1", ref: "CONV/2025/0891", clientName: "S. [Prospect]", title: "Purchase — S. [Prospect], 14 Maple Avenue", status: "overdue", lastActivity: relDate(-3), nextDeadline: relDate(-1), riskLevel: "high", obligationsDue: 2 },
      { id: "c2", ref: "CONV/2025/0874", clientName: "G. Whitfield", title: "Sale — Whitfield, 8 Birchwood Close", status: "review_required", lastActivity: relDate(-2), nextDeadline: relDate(2), riskLevel: "medium", obligationsDue: 1 },
      { id: "c3", ref: "CONV/2025/0858", clientName: "P. Osei", title: "Remortgage — Osei, 22 Ferndale Road", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(8), riskLevel: "low", obligationsDue: 0 },
      { id: "c4", ref: "CONV/2025/0833", clientName: "J. Chapman", title: "Purchase — Chapman, New Build Plot 17", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(21), riskLevel: "medium", obligationsDue: 0 },
    ],
    [
      { id: "co1", matterId: "c1", matterTitle: "Purchase — S. [Prospect], 14 Maple Avenue", type: "AML Source of Funds", description: "Source of funds verification overdue — exchange cannot proceed", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "co2", matterId: "c1", matterTitle: "Purchase — S. [Prospect], 14 Maple Avenue", type: "Search Results Review", description: "Local authority search results not reviewed and reported to client", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "co3", matterId: "c2", matterTitle: "Sale — Whitfield, 8 Birchwood Close", type: "Title Requisitions", description: "Respond to buyer's solicitors' title requisitions", dueDate: relDate(2), status: "due_soon", daysDue: 2 },
    ],
    [
      { id: "cvd1", title: "Attendance Note — Purchase Initial Consultation, 14 Maple Avenue", type: "Attendance Note", status: "approved", generatedAt: relDate(-9) },
      { id: "cvd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-9) },
      { id: "cvd3", title: "Report on Title — 14 Maple Avenue", type: "Report on Title", status: "approved", generatedAt: relDate(-6) },
      { id: "cvd4", title: "SDLT Return Calculation — Purchase Price £385,000", type: "Tax Document", status: "approved", generatedAt: relDate(-5) },
      { id: "cvd5", title: "Mortgage Conditions Report — Lender Requirements", type: "Lender Report", status: "pending_review", generatedAt: relDate(-2) },
      { id: "cvd6", title: "Completion Statement — Whitfield Sale", type: "Completion Statement", status: "draft", generatedAt: relDate(-1) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 14 },
    CONVEYANCING_LEAD_MATTER
  ),

  "private-client": buildVariant(
    "Private Client",
    76,
    [
      { id: "pc1", ref: "PROB/2025/0223", clientName: "S. [Prospect]", title: "Estate Administration — S. [Prospect] (Deceased)", status: "overdue", lastActivity: relDate(-5), nextDeadline: relDate(-2), riskLevel: "medium", obligationsDue: 2 },
      { id: "pc2", ref: "PROB/2025/0211", clientName: "E. Thornton", title: "Will Drafting — E. & R. Thornton (Mirror Wills)", status: "review_required", lastActivity: relDate(-3), nextDeadline: relDate(3), riskLevel: "low", obligationsDue: 1 },
      { id: "pc3", ref: "PROB/2025/0197", clientName: "H. Beaumont", title: "Lasting Power of Attorney — Beaumont", status: "active", lastActivity: relDate(-2), nextDeadline: relDate(12), riskLevel: "low", obligationsDue: 0 },
      { id: "pc4", ref: "PROB/2025/0184", clientName: "V. Cavendish", title: "IHT Planning — Cavendish Family Trust", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(28), riskLevel: "medium", obligationsDue: 0 },
    ],
    [
      { id: "po1", matterId: "pc1", matterTitle: "Estate Administration — S. [Prospect] (Deceased)", type: "IHT400 Submission", description: "IHT400 inheritance tax return overdue with HMRC", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "po2", matterId: "pc1", matterTitle: "Estate Administration — S. [Prospect] (Deceased)", type: "Grant of Probate Application", description: "Application for grant of probate not yet filed with probate registry", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "po3", matterId: "pc2", matterTitle: "Will Drafting — E. & R. Thornton (Mirror Wills)", type: "Will Execution", description: "Thornton mirror wills ready for execution — appointment to be booked", dueDate: relDate(3), status: "due_soon", daysDue: 3 },
    ],
    [
      { id: "pcd1", title: "Attendance Note — Estate Administration Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-12) },
      { id: "pcd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-12) },
      { id: "pcd3", title: "IHT400 Inheritance Tax Return — Draft", type: "HMRC Return", status: "draft", generatedAt: relDate(-4) },
      { id: "pcd4", title: "Thornton Mirror Wills — Execution Copies", type: "Will", status: "approved", generatedAt: relDate(-3) },
      { id: "pcd5", title: "LPA Property & Financial Affairs — Beaumont", type: "LPA Form", status: "pending_review", generatedAt: relDate(-2) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 10 },
    PRIVATE_CLIENT_LEAD_MATTER
  ),

  "personal-injury": buildVariant(
    "Personal Injury",
    69,
    [
      { id: "pi1", ref: "PI/2025/0562", clientName: "S. [Prospect]", title: "Employer Liability — S. [Prospect] v Apex Manufacturing", status: "overdue", lastActivity: relDate(-4), nextDeadline: relDate(-2), riskLevel: "high", obligationsDue: 2 },
      { id: "pi2", ref: "PI/2025/0541", clientName: "B. Forde", title: "Road Traffic Accident — Forde v Insurers", status: "review_required", lastActivity: relDate(-3), nextDeadline: relDate(4), riskLevel: "medium", obligationsDue: 1 },
      { id: "pi3", ref: "PI/2025/0519", clientName: "L. Ahmed", title: "Slip & Fall — Ahmed v Tesco Stores", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(9), riskLevel: "medium", obligationsDue: 0 },
      { id: "pi4", ref: "PI/2025/0498", clientName: "M. Delgado", title: "Clinical Negligence — Delgado v NHS Trust", status: "active", lastActivity: relDate(-2), nextDeadline: relDate(30), riskLevel: "high", obligationsDue: 0 },
    ],
    [
      { id: "pio1", matterId: "pi1", matterTitle: "Employer Liability — S. [Prospect] v Apex Manufacturing", type: "Pre-Action Protocol Letter", description: "Pre-action protocol letter of claim overdue — limitation risk", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "pio2", matterId: "pi1", matterTitle: "Employer Liability — S. [Prospect] v Apex Manufacturing", type: "Medical Expert Report", description: "Expert medical report not yet instructed — Court deadline approaching", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "pio3", matterId: "pi2", matterTitle: "Road Traffic Accident — Forde v Insurers", type: "Schedule of Loss", description: "Serve updated schedule of special damages on defendant", dueDate: relDate(4), status: "due_soon", daysDue: 4 },
    ],
    [
      { id: "pid1", title: "Attendance Note — Employer Liability Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-11) },
      { id: "pid2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-11) },
      { id: "pid3", title: "Pre-Action Protocol Letter of Claim — Apex Manufacturing", type: "Letter of Claim", status: "draft", generatedAt: relDate(-1) },
      { id: "pid4", title: "Schedule of Special Damages — Forde v Insurers", type: "Schedule of Loss", status: "pending_review", generatedAt: relDate(-3) },
      { id: "pid5", title: "Medical Expert Instruction Letter — Occupational Health", type: "Expert Instruction", status: "draft", generatedAt: relDate(-2) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 12 },
    PERSONAL_INJURY_LEAD_MATTER
  ),

  employment: buildVariant(
    "Employment Law",
    73,
    [
      { id: "e1", ref: "EMP/2025/0334", clientName: "S. [Prospect]", title: "Constructive Dismissal — S. [Prospect] v Nexus Group", status: "overdue", lastActivity: relDate(-3), nextDeadline: relDate(-1), riskLevel: "high", obligationsDue: 2 },
      { id: "e2", ref: "EMP/2025/0318", clientName: "C. Okafor", title: "Redundancy Dispute — Okafor v Stratford Media", status: "review_required", lastActivity: relDate(-2), nextDeadline: relDate(3), riskLevel: "medium", obligationsDue: 1 },
      { id: "e3", ref: "EMP/2025/0302", clientName: "H. Nguyen", title: "Discrimination Claim — Nguyen v City Finance Ltd", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(11), riskLevel: "medium", obligationsDue: 0 },
      { id: "e4", ref: "EMP/2025/0287", clientName: "R. Jacobs", title: "Settlement Agreement — Jacobs v Bright Solutions", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(7), riskLevel: "low", obligationsDue: 0 },
    ],
    [
      { id: "eo1", matterId: "e1", matterTitle: "Constructive Dismissal — S. [Prospect] v Nexus Group", type: "ACAS Early Conciliation", description: "ACAS early conciliation certificate not obtained — ET1 cannot be filed", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "eo2", matterId: "e1", matterTitle: "Constructive Dismissal — S. [Prospect] v Nexus Group", type: "ET1 Filing Deadline", description: "Employment tribunal claim (ET1) deadline in jeopardy — 3-month limitation", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "eo3", matterId: "e2", matterTitle: "Redundancy Dispute — Okafor v Stratford Media", type: "Bundle Preparation", description: "Prepare hearing bundle for preliminary hearing", dueDate: relDate(3), status: "due_soon", daysDue: 3 },
    ],
    [
      { id: "ed1", title: "Attendance Note — Constructive Dismissal Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "ed2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "ed3", title: "Schedule of Loss — S. [Prospect] v Nexus Group", type: "Schedule of Loss", status: "draft", generatedAt: relDate(-3) },
      { id: "ed4", title: "ET1 Claim Form — Constructive Dismissal", type: "Tribunal Form", status: "pending_review", generatedAt: relDate(-1) },
      { id: "ed5", title: "Attendance Note — Redundancy Strategy Review — Okafor", type: "Attendance Note", status: "approved", generatedAt: relDate(-5) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 10 },
    EMPLOYMENT_LEAD_MATTER
  ),

  commercial: buildVariant(
    "Commercial Law",
    77,
    [
      { id: "cm1", ref: "COMM/2025/0441", clientName: "S. [Prospect]", title: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition", status: "overdue", lastActivity: relDate(-4), nextDeadline: relDate(-1), riskLevel: "high", obligationsDue: 2 },
      { id: "cm2", ref: "COMM/2025/0424", clientName: "Apex Digital Ltd", title: "Commercial Lease — Apex Digital, Canary Wharf", status: "review_required", lastActivity: relDate(-2), nextDeadline: relDate(4), riskLevel: "medium", obligationsDue: 1 },
      { id: "cm3", ref: "COMM/2025/0408", clientName: "Meridian Retail plc", title: "Supplier Framework Agreement — Meridian Retail", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(10), riskLevel: "low", obligationsDue: 0 },
      { id: "cm4", ref: "COMM/2025/0391", clientName: "Harlow Ventures Ltd", title: "Series A Term Sheet — Harlow Ventures", status: "active", lastActivity: relDate(-2), nextDeadline: relDate(20), riskLevel: "medium", obligationsDue: 0 },
    ],
    [
      { id: "cmo1", matterId: "cm1", matterTitle: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition", type: "AML Enhanced Due Diligence", description: "EDD on target entity not completed — transaction at risk", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "cmo2", matterId: "cm1", matterTitle: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition", type: "Disclosure Letter Review", description: "Disclosure letter not reviewed with client — exchange scheduled", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "cmo3", matterId: "cm2", matterTitle: "Commercial Lease — Apex Digital, Canary Wharf", type: "Rent Deposit Deed", description: "Rent deposit deed to be finalised before lease engrossment", dueDate: relDate(4), status: "due_soon", daysDue: 4 },
    ],
    [
      { id: "cmd1", title: "Attendance Note — Share Purchase Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-11) },
      { id: "cmd2", title: "Client Care Letter — S. [Prospect] Ltd", type: "Client Care Letter", status: "approved", generatedAt: relDate(-11) },
      { id: "cmd3", title: "AML Enhanced Due Diligence Report — Target Entity", type: "AML Report", status: "draft", generatedAt: relDate(-2) },
      { id: "cmd4", title: "Commercial Lease — Apex Digital, Canary Wharf (Engrossment)", type: "Commercial Lease", status: "pending_review", generatedAt: relDate(-3) },
      { id: "cmd5", title: "Disclosure Letter — S. [Prospect] Ltd Acquisition", type: "Disclosure Letter", status: "draft", generatedAt: relDate(-1) },
      { id: "cmd6", title: "Supplier Framework Agreement — Meridian Retail plc", type: "Commercial Contract", status: "approved", generatedAt: relDate(-6) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 13 },
    COMMERCIAL_LEAD_MATTER
  ),

  criminal: buildVariant(
    "Criminal Defence",
    65,
    [
      { id: "cr1", ref: "CRIM/2025/0812", clientName: "S. [Prospect]", title: "Crown Court — S. [Prospect] (GBH s.18 OAPA)", status: "overdue", lastActivity: relDate(-5), nextDeadline: relDate(-2), riskLevel: "high", obligationsDue: 2 },
      { id: "cr2", ref: "CRIM/2025/0798", clientName: "D. Halcrow", title: "Magistrates — Halcrow (Section 5 POA)", status: "review_required", lastActivity: relDate(-2), nextDeadline: relDate(3), riskLevel: "medium", obligationsDue: 1 },
      { id: "cr3", ref: "CRIM/2025/0779", clientName: "M. Trevino", title: "Appeal — Trevino (Sentence Appeal, Crown Court)", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(14), riskLevel: "medium", obligationsDue: 0 },
      { id: "cr4", ref: "CRIM/2025/0765", clientName: "J. Attah", title: "Police Station Attendance — Attah (Fraud)", status: "active", lastActivity: relDate(0), nextDeadline: relDate(1), riskLevel: "low", obligationsDue: 0 },
    ],
    [
      { id: "cro1", matterId: "cr1", matterTitle: "Crown Court — S. [Prospect] (GBH s.18 OAPA)", type: "Defence Case Statement", description: "DCS not filed with Crown Court — statutory deadline missed", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "cro2", matterId: "cr1", matterTitle: "Crown Court — S. [Prospect] (GBH s.18 OAPA)", type: "Expert Forensic Report", description: "Forensic expert not yet instructed — trial listing in 6 weeks", dueDate: relDate(-2), status: "overdue", daysOverdue: 2 },
      { id: "cro3", matterId: "cr2", matterTitle: "Magistrates — Halcrow (Section 5 POA)", type: "Newton Hearing Preparation", description: "Prepare written submissions for Newton hearing", dueDate: relDate(3), status: "due_soon", daysDue: 3 },
    ],
    [
      { id: "crd1", title: "Police Station Attendance Record — S. [Prospect] (GBH s.18)", type: "Police Station Record", status: "approved", generatedAt: relDate(-12) },
      { id: "crd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-12) },
      { id: "crd3", title: "Defence Case Statement — Crown Court", type: "Defence Statement", status: "draft", generatedAt: relDate(-3) },
      { id: "crd4", title: "Newton Hearing Written Submissions — Halcrow", type: "Court Submissions", status: "pending_review", generatedAt: relDate(-1) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 8 },
    CRIMINAL_LEAD_MATTER
  ),

  "debt-recovery": buildVariant(
    "Debt Recovery",
    70,
    [
      { id: "dr1", ref: "DEBT/2025/1021", clientName: "S. [Prospect]", title: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd", status: "overdue", lastActivity: relDate(-4), nextDeadline: relDate(-1), riskLevel: "medium", obligationsDue: 2 },
      { id: "dr2", ref: "DEBT/2025/1008", clientName: "Pinnacle Ltd", title: "Statutory Demand — Pinnacle v Kestrel Group", status: "review_required", lastActivity: relDate(-2), nextDeadline: relDate(2), riskLevel: "medium", obligationsDue: 1 },
      { id: "dr3", ref: "DEBT/2025/0994", clientName: "J. Forsyth", title: "CCJ Enforcement — Forsyth (Charging Order)", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(9), riskLevel: "low", obligationsDue: 0 },
      { id: "dr4", ref: "DEBT/2025/0978", clientName: "Carrington Foods plc", title: "Invoice Dispute — Carrington v Bradwell Logistics", status: "active", lastActivity: relDate(-1), nextDeadline: relDate(15), riskLevel: "low", obligationsDue: 0 },
    ],
    [
      { id: "dro1", matterId: "dr1", matterTitle: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd", type: "Letter Before Action", description: "Pre-action protocol LBA not sent — County Court claim at risk", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "dro2", matterId: "dr1", matterTitle: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd", type: "MCOL Claim Filing", description: "Money Claim Online (MCOL) not yet filed — debt ageing", dueDate: relDate(-1), status: "overdue", daysOverdue: 1 },
      { id: "dro3", matterId: "dr2", matterTitle: "Statutory Demand — Pinnacle v Kestrel Group", type: "21-Day Response Deadline", description: "Monitor statutory demand — 21 days expire in 2 days", dueDate: relDate(2), status: "due_soon", daysDue: 2 },
    ],
    [
      { id: "drd1", title: "Attendance Note — Debt Recovery Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "drd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "drd3", title: "Letter Before Action — Dunmore Supplies Ltd", type: "Pre-Action Letter", status: "draft", generatedAt: relDate(-2) },
      { id: "drd4", title: "Statutory Demand — Pinnacle v Kestrel Group", type: "Statutory Demand", status: "approved", generatedAt: relDate(-6) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 9 },
    DEBT_RECOVERY_LEAD_MATTER
  ),
};

export const PRACTICE_AREA_LABELS: Record<PracticeAreaKey, string> = {
  family: "Family Law",
  immigration: "Immigration Law",
  conveyancing: "Residential Conveyancing",
  "private-client": "Private Client",
  "personal-injury": "Personal Injury",
  employment: "Employment Law",
  commercial: "Commercial Law",
  criminal: "Criminal Defence",
  "debt-recovery": "Debt Recovery",
};

export function isValidPracticeArea(key: string): key is PracticeAreaKey {
  return key in PRACTICE_AREA_LABELS;
}

export function personaliseMatters(matters: DemoMatter[], lastName: string): DemoMatter[] {
  if (!lastName) return matters;
  return matters.map((m) => ({
    ...m,
    clientName: m.clientName.replace(/\[Prospect\]/g, lastName),
    title: m.title.replace(/\[Prospect\]/g, lastName),
  }));
}

export function personaliseObligations(obligations: DemoObligation[], lastName: string): DemoObligation[] {
  if (!lastName) return obligations;
  return obligations.map((o) => ({
    ...o,
    matterTitle: o.matterTitle.replace(/\[Prospect\]/g, lastName),
  }));
}

export function personaliseLeadMatter(
  matter: DemoLeadMatter,
  firstName: string,
  lastName: string,
  firmName: string
): DemoLeadMatter {
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Client";
  const firm = firmName || "Your Firm";
  function rep(s: string) {
    return s.replace(/\[Prospect\]/g, lastName || firstName || "Client")
      .replace(/\[Client Name\]/g, name)
      .replace(/\[Firm\]/g, firm);
  }
  return {
    ...matter,
    title: rep(matter.title),
    clientName: rep(matter.clientName),
    firmName: firm,
    attendanceNoteBody: rep(matter.attendanceNoteBody),
    undertakings: matter.undertakings.map((u) => ({ ...u, description: rep(u.description), givenTo: rep(u.givenTo) })),
    auditTrail: matter.auditTrail.map((a) => ({ ...a, description: rep(a.description), actor: rep(a.actor) })),
    transcript: matter.transcript.map((t) => ({ ...t, text: rep(t.text) })),
    sessions: matter.sessions.map((s) => ({
      ...s,
      summary: rep(s.summary),
      attendees: s.attendees.map(rep),
    })),
    documents: matter.documents.map((d) => ({ ...d, title: rep(d.title) })),
  };
}
