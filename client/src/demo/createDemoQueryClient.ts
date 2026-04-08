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
        firmName: body.firmName || "Demo Firm",
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

function getFamilyContent(clientName: string, solicitorName: string, firmName: string, rate: number, sraNumber: string) {
  const caseBase = {
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

  const sessions = [
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

  const transcript1 = {
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
      { speaker: "Solicitor", text: `That's an excellent idea. A contemporaneous diary of contact — when it happened, how long it lasted, any incidents or notable events — is extremely useful evidence if the matter becomes contested. I'd encourage you to start that today. Now, let's turn to costs. I want to be transparent with you about how this is likely to proceed financially. These are private family law proceedings, so you'll be funding this privately. My hourly rate is £${rate} plus VAT. The MIAM itself you'll pay directly to the mediator — typically around £100 to £150. The court fee for the C100 is currently £232. If the matter resolves at the FHDRA, you're looking at roughly £2,000 to £3,000 in total in solicitor's fees. If it goes to a DRA or beyond, that can rise significantly.`, start: 490000, end: 560000 },
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

  const transcript2 = {
    id: "demo-transcript-002",
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID_2,
    content: "Strategy review covering CAFCASS safeguarding letter, DRA preparation, contact schedule and expert evidence.",
    utterances: [
      { speaker: "Solicitor", text: "Good morning. Just to confirm your consent to recording as before — are you happy for this meeting to be recorded?", start: 0, end: 8000 },
      { speaker: "Client", text: "Yes, I consent to the recording.", start: 8000, end: 11000 },
      { speaker: "Solicitor", text: "Thank you. So, the main purpose of today's meeting is to go through the CAFCASS safeguarding letter that's come through, and to plan our approach ahead of the DRA. The letter arrived yesterday and I want to walk you through the key findings before we discuss strategy.", start: 11000, end: 28000 },
      { speaker: "Client", text: "I've been quite anxious about it, to be honest. What did it say?", start: 28000, end: 35000 },
      { speaker: "Solicitor", text: "I'm pleased to say the letter is positive. CAFCASS carried out the standard safeguarding checks — police, children's services, and a brief telephone enquiry with each parent — and they found no safeguarding concerns in relation to either parent. They confirmed that both you and your husband are assessed as safe carers for Emily and Oliver.", start: 35000, end: 60000 },
      { speaker: "Client", text: "That's a relief. So what does that mean for the hearing?", start: 60000, end: 67000 },
      { speaker: "Solicitor", text: "It means the DRA will focus entirely on the arrangements dispute rather than any welfare concerns. The judge won't be dealing with any red flags. The DRA is about finding a workable arrangement for the children. CAFCASS didn't recommend a Section 7 report at this stage, which is good — it suggests they don't see this as a case requiring detailed investigation.", start: 67000, end: 95000 },
      { speaker: "Client", text: "My husband is still insisting on week-on week-off. Has anything changed on that front?", start: 95000, end: 105000 },
      { speaker: "Solicitor", text: "He has made a revised proposal through his solicitors. He's stepped back slightly from the rigid week-on week-off and is now proposing extended alternate weekends — Friday after school to Monday morning — plus a midweek overnight on Wednesdays. That's a significant movement from his original position.", start: 105000, end: 132000 },
      { speaker: "Client", text: "Wednesday overnights though — that's still more than I'm comfortable with. The children would need to get to school from his house on Thursdays. He lives on the other side of town.", start: 132000, end: 155000 },
      { speaker: "Solicitor", text: "That's a very reasonable concern and one we can put squarely to the court if needed. The children's school routine and the logistics of the school run are factors the court will weigh carefully. Our position remains: alternate weekends Friday after school to Sunday evening, plus Wednesday evening contact for tea without an overnight. I'm going to ask you to think about whether there's any flexibility on midweek overnights in the future, as Emily and Oliver get older, but for now your position is entirely defensible.", start: 155000, end: 205000 },
      { speaker: "Client", text: "I'm happy to be flexible as they get older. I just don't think it's right for them now.", start: 205000, end: 215000 },
      { speaker: "Solicitor", text: "We'll make that clear in the position statement — that you are not seeking to limit the children's relationship with their father, but that the current proposals are not age-appropriate given Emily and Oliver's developmental stage and established routine.", start: 215000, end: 235000 },
      { speaker: "Client", text: "What about the Portugal holiday? My husband mentioned it again.", start: 235000, end: 243000 },
      { speaker: "Solicitor", text: "We discussed this at our last meeting. The proceedings are live now, so the automatic stay is in place. Your husband cannot take the children abroad without your written consent. I would suggest we agree in correspondence to permit the Portugal holiday subject to you having details of the accommodation, travel dates, and a direct phone number for the children whilst they're away. That's a reasonable and proportionate response — it shows the court you're willing to facilitate contact, including international contact.", start: 243000, end: 290000 },
      { speaker: "Client", text: "That seems reasonable. I don't want to stop him taking them on holiday. I just want to know where they are.", start: 290000, end: 303000 },
      { speaker: "Solicitor", text: "Exactly. We'll write to his solicitors along those lines. Now, one other thing I want to raise — we've been considering whether expert evidence might assist in this case. A child psychologist could provide an assessment of the children's emotional needs and the appropriateness of the proposed contact arrangement. It would be an independent voice supporting our position.", start: 303000, end: 335000 },
      { speaker: "Client", text: "Would that be expensive?", start: 335000, end: 338000 },
      { speaker: "Solicitor", text: "A jointly instructed child psychologist would typically cost in the region of £2,000 to £3,500 for a report, split equally between the parties. The question is whether the cost is proportionate given that CAFCASS has raised no concerns. My honest view is that it's probably not necessary at this stage — the DRA may well resolve the matter on the basis of the position statements alone. But it's an option if we find the case is not settling.", start: 338000, end: 383000 },
      { speaker: "Client", text: "Let's leave that for now and see how the DRA goes.", start: 383000, end: 391000 },
      { speaker: "Solicitor", text: "Agreed. So to summarise our action points from today: I'll draft the position statement for the DRA setting out your position on residence and contact, including the school run concern and your willingness to permit the Portugal holiday on appropriate terms. We'll write to the other side regarding the Portugal consent. We'll also prepare the DRA bundle. Is there anything else you'd like to cover before we close?", start: 391000, end: 430000 },
      { speaker: "Client", text: "No, I think that covers everything. When is the DRA?", start: 430000, end: 437000 },
      { speaker: "Solicitor", text: "The DRA is listed for three weeks' time. I'll have the position statement with you for approval within the week. We should be in good shape. Thank you for coming in today.", start: 437000, end: 455000 },
    ],
    speakerCount: 2,
    createdAt: relDateTime(-28, "12:30"),
    redactions: [],
  };

  const transcript3 = {
    id: "demo-transcript-003",
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID_3,
    content: "DRA hearing debrief — consent order agreed in principle, terms confirmed, final approval hearing listed.",
    utterances: [
      { speaker: "Solicitor", text: "Right, do you consent to me recording this debrief as before?", start: 0, end: 6000 },
      { speaker: "Client", text: "Yes, I consent.", start: 6000, end: 9000 },
      { speaker: "Solicitor", text: "Thank you. Well, I want to start by saying that today went about as well as it possibly could. The judge managed to bring the parties together and we have a consent order agreed in principle. I know it's been a long and stressful process, but this is a very good outcome.", start: 9000, end: 32000 },
      { speaker: "Client", text: "I still can't quite believe it. What exactly have we agreed?", start: 32000, end: 40000 },
      { speaker: "Solicitor", text: "The agreed terms are: primary residence with you. Emily and Oliver will live with you as their main home. Your husband will have the children on alternate weekends — Friday collection from school to Sunday drop-off at 6pm. There will also be Wednesday evening contact from after school collection to 7:30pm, but no overnight. Those are the core terms.", start: 40000, end: 78000 },
      { speaker: "Client", text: "That's exactly what I was asking for. And the holidays?", start: 78000, end: 84000 },
      { speaker: "Solicitor", text: "Holidays were dealt with separately. School holidays to be split roughly equally, with each parent having a two-week summer holiday block. The Portugal trip — we agreed that your husband may take the children to Portugal this summer for up to ten days, provided he gives you at least four weeks' written notice with accommodation details and a contact number for the children. You very graciously agreed to that and the judge noted it positively.", start: 84000, end: 130000 },
      { speaker: "Client", text: "I'm glad we sorted that out sensibly. And what about costs — where do we stand?", start: 130000, end: 140000 },
      { speaker: "Solicitor", text: "The judge made no order as to costs, which is standard in private children proceedings. Each party bears their own costs. In terms of your costs to date, you've incurred approximately £4,200 plus VAT. That's across the initial consultation, the MIAM preparation, filing of the C100, the FHDRA, the position statement and DRA preparation, and attendance at today's DRA. That's actually at the lower end of what I would have anticipated for proceedings that have run to a DRA.", start: 140000, end: 190000 },
      { speaker: "Client", text: "That's more than I hoped, but given what we've achieved, it feels worth it.", start: 190000, end: 200000 },
      { speaker: "Solicitor", text: "I think you've got a very fair outcome. Now, the order isn't sealed yet. The judge directed us to file a draft consent order within 21 days. I'll draft that this week and send it to you for approval before it goes to the other side. Once both parties have approved it and signed, we file it with the court. The judge will consider it on the papers — we don't need to attend — and if satisfied will seal the order. That's what we call the final approval hearing, though technically no one appears.", start: 200000, end: 255000 },
      { speaker: "Client", text: "So there's one more step — just the paperwork?", start: 255000, end: 262000 },
      { speaker: "Solicitor", text: "Exactly. Just the paperwork. Once the order is sealed, that's legally binding. Both parties must comply with its terms. If either party breaches the order — for example, if your husband fails to return the children at the agreed time — there are enforcement mechanisms available to you.", start: 262000, end: 290000 },
      { speaker: "Client", text: "I really hope it doesn't come to that. I just want us to be able to co-parent without any more conflict.", start: 290000, end: 302000 },
      { speaker: "Solicitor", text: "That's the best outcome for Emily and Oliver, and from what I saw today, your husband's solicitor also indicated that he wants to move forward constructively. I'd encourage you to try to build a workable communication channel — even just a shared app or a brief handover note at contact changeovers. Consistency is really important for children at this age.", start: 302000, end: 340000 },
      { speaker: "Client", text: "Agreed. What do I need to do now?", start: 340000, end: 345000 },
      { speaker: "Solicitor", text: "Nothing from your side right now. I'll send you the draft consent order by end of this week. Once you've reviewed and approved it, I'll forward it to the other side. We aim to have the sealed order back from the court within four to six weeks. I'll update you throughout. Congratulations — you've navigated this really well.", start: 345000, end: 385000 },
      { speaker: "Client", text: "Thank you so much. I couldn't have done it without your help.", start: 385000, end: 395000 },
      { speaker: "Solicitor", text: "That's very kind of you. It's been a pleasure acting for you. Take care.", start: 395000, end: 405000 },
    ],
    speakerCount: 2,
    createdAt: relDateTime(-7, "17:00"),
    redactions: [],
  };

  const attendanceNote = {
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

Attendance note produced from session recording. Verified and approved by ${solicitorName}.`,
    contentHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    version: 1,
    versionType: "auto",
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

  const ccl = {
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
    versionType: "auto",
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

  const auditLogs = [
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
      eventType: "transcript_completed",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:12"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
      metadata: { wordCount: 2124, speakerCount: 2, confidence: 98.4 },
      severity: "info",
      hmacFingerprint: "b60a3f7e142d9c85",
    },
    {
      id: "audit-004",
      eventType: "document_produced",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:15"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
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

  const undertakings = [
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

  const timeEntries = [
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

  const sraReadiness = {
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

  const complianceData = {
    amlRiskLevel: "medium",
    idVerified: true,
    idType: "passport",
    idCountry: "UK",
    sourceOfFundsConfirmed: true,
    sourceOfFundsNote: "Employment income",
    colpReviewRequired: true,
    colpReviewed: false,
    colpReviewPending: true,
    colpReviewerId: "demo-user-2",
    colpReviewerName: "James Whitmore",
  };

  const consentLogs = [
    {
      id: "demo-consent-001",
      caseId: DEMO_CASE_ID,
      sessionId: DEMO_SESSION_ID,
      consentGiven: true,
      consentType: "verbal_recorded",
      consentTimestamp: relDateTime(-44, "10:02"),
      consentText: "Client confirmed verbal consent to recording at 00:18 of session.",
      consentedBy: clientName,
      recordedBy: solicitorName,
    },
  ];

  return { caseBase, sessions, transcript1, transcript2, transcript3, attendanceNote, ccl, auditLogs, undertakings, timeEntries, sraReadiness, complianceData, consentLogs };
}

function getEmploymentContent(clientName: string, solicitorName: string, firmName: string, rate: number, sraNumber: string) {
  const caseBase = {
    id: DEMO_CASE_ID,
    firmId: DEMO_FIRM_ID,
    title: `Constructive Dismissal — ${clientName} v Nexus Group Ltd`,
    clientName: clientName,
    clientId: null,
    matterReference: "EMP/2025/0071",
    createdBy: DEMO_USER_ID,
    assignedToUserId: DEMO_USER_ID,
    createdAt: relDateTime(-45),
    status: "review_required",
    priority: "urgent",
    sourceType: "audio",
    templateId: null,
    parentCaseId: null,
    riskLevel: "medium",
    practiceArea: "employment_employee",
    conflictCheckCompleted: true,
    conflictCheckNote: null,
    clientCareLetterId: DEMO_DOC_CCL_ID,
    clientCareLetterSentAt: relDateTime(-44, "16:00"),
    costsEstimate: "£1,500 + VAT to ACAS stage; hourly rate if proceeding to tribunal",
    textNotes: null,
    reviewed: false,
    archived: false,
    aiProcessingMetadata: {},
    deadline: relDateTime(1),
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

  const sessions = [
    {
      id: DEMO_SESSION_ID,
      caseId: DEMO_CASE_ID,
      recordingType: "full_meeting",
      sessionTitle: "Initial Consultation",
      startedAt: relDateTime(-44, "10:00"),
      durationSeconds: 3600,
      status: "completed",
      notes: null,
      createdBy: DEMO_USER_ID,
    },
  ];

  const transcript1 = {
    id: DEMO_TRANSCRIPT_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    content: "Initial consultation — constructive dismissal claim, ACAS early conciliation, compensation calculation, client care.",
    utterances: [
      { speaker: "Solicitor", text: `Good morning. I'm ${solicitorName}. Before we begin I'd like to confirm that I'll be recording this meeting with your consent. The recording is used solely to produce an accurate attendance note and is stored securely. Do you consent?`, start: 0, end: 16000 },
      { speaker: "Client", text: "Yes, I consent to the recording.", start: 16000, end: 20000 },
      { speaker: "Solicitor", text: "Thank you, I've noted that. Can you start by telling me about your employment situation — how long you worked at Nexus Group, what your role was, and what's led you to come and see me today?", start: 20000, end: 35000 },
      { speaker: "Client", text: "I was at Nexus Group for ten years. Senior Marketing Manager, reporting directly to the Group Marketing Director. I had a team of six and managed a budget of around two million. Then earlier this year the company announced a restructuring. I was told my role was at risk and that I had two options — accept a demotion to Marketing Manager with a fifteen percent salary reduction, or leave. They gave me two weeks to decide.", start: 35000, end: 78000 },
      { speaker: "Solicitor", text: "And what did you decide?", start: 78000, end: 82000 },
      { speaker: "Client", text: "I refused the demotion. I resigned. I've been in that role for ten years, I had an exemplary record, and what they were proposing was a fundamental change to my contract without my consent. I feel I had no real choice.", start: 82000, end: 108000 },
      { speaker: "Solicitor", text: "I understand. What you're describing is a classic constructive dismissal scenario. The legal basis is breach of the implied term of mutual trust and confidence. By imposing a significant demotion and a fifteen percent pay cut without your agreement, Nexus Group arguably repudiated your contract, and you accepted that repudiation by resigning. That's the essential structure of a constructive dismissal claim. Do you have your resignation letter?", start: 108000, end: 145000 },
      { speaker: "Client", text: "Yes, I have it. I resigned in writing. I made clear in the letter that I was resigning in response to the proposed changes and that I considered myself constructively dismissed.", start: 145000, end: 165000 },
      { speaker: "Solicitor", text: "Excellent — that's very helpful. Having a resignation letter that expressly identifies the breach is important. It shows you resigned in response to the employer's conduct rather than simply leaving. Now, the first thing we need to do is notify ACAS of a potential employment tribunal claim. This is mandatory — you cannot issue an ET1 claim form without first going through ACAS early conciliation. The limitation period for unfair dismissal claims is three months less one day from the effective date of termination. When did your employment end?", start: 165000, end: 212000 },
      { speaker: "Client", text: "My last day was six weeks ago.", start: 212000, end: 216000 },
      { speaker: "Solicitor", text: "So you have approximately six weeks of the limitation period remaining. That is tight but manageable. I want to stress that limitation periods in employment tribunals are extremely strict — the tribunal has very limited discretion to extend time, far more so than in civil courts. We need to submit the ACAS notification today. Can you confirm the full legal entity name of your employer?", start: 216000, end: 248000 },
      { speaker: "Client", text: "It's Nexus Group Limited. Registered in England. I have the company number somewhere.", start: 248000, end: 260000 },
      { speaker: "Solicitor", text: "We can obtain that from Companies House. Let me turn to compensation. For a constructive dismissal claim, there are two elements: the basic award and the compensatory award. The basic award is calculated using a statutory formula based on your age, your length of service, and your weekly pay — subject to a statutory cap on weekly pay. With ten years' service and, I assume, a salary above the statutory cap, your basic award would be at or near the maximum. Can you tell me your current salary?", start: 260000, end: 304000 },
      { speaker: "Client", text: "I was on sixty-two thousand per year. So about eleven hundred and ninety per week.", start: 304000, end: 317000 },
      { speaker: "Solicitor", text: "The current statutory weekly pay cap is £643. With ten years' service and your age — can I ask how old you are?", start: 317000, end: 328000 },
      { speaker: "Client", text: "I'm forty-two.", start: 328000, end: 331000 },
      { speaker: "Solicitor", text: "With ten years' service and age forty-two, your basic award calculation gives you ten weeks multiplied by the statutory cap of £643, which is £6,430. That's a straightforward calculation. The compensatory award is more significant — it's based on your actual financial loss. It covers loss of earnings from the date of termination to the date of the tribunal hearing, and future loss of earnings if you haven't found equivalent employment by then. Are you currently employed?", start: 331000, end: 378000 },
      { speaker: "Client", text: "No, I've been looking but I haven't found anything yet. I've had a couple of interviews.", start: 378000, end: 390000 },
      { speaker: "Solicitor", text: "You'll also be able to claim for loss of benefits — pension contributions, private health insurance, any other contractual benefits. Was your package at Nexus Group above the base salary?", start: 390000, end: 408000 },
      { speaker: "Client", text: "Yes — I had pension at six percent employer contribution, private health cover, and a car allowance of five hundred a month.", start: 408000, end: 422000 },
      { speaker: "Solicitor", text: "Those will all form part of the compensatory award calculation. One thing I should clarify — you mentioned feelings of humiliation and distress about the way this was handled. In a pure dismissal claim, you cannot claim injury to feelings. That's only available in discrimination claims. However, if you believe any of the treatment was connected to a protected characteristic — for example, age, sex, or any disability — that would be a separate head of claim and we'd need to explore that.", start: 422000, end: 465000 },
      { speaker: "Client", text: "I haven't thought about it in those terms. I'm not sure discrimination played a part. It felt more like a cost-cutting exercise.", start: 465000, end: 480000 },
      { speaker: "Solicitor", text: "Understood. We'll proceed on the constructive dismissal basis. Let me tell you about our costs structure. For the ACAS early conciliation stage and preparation of the ET1 claim form, we charge a fixed fee of £1,500 plus VAT. That covers the ACAS notification today, any conciliation correspondence, and if conciliation fails, the drafting and filing of the ET1. If the matter proceeds to a full tribunal hearing, I'd revert to our hourly rate of £${rate} plus VAT for the remaining work. Does that sound acceptable?", start: 480000, end: 528000 },
      { speaker: "Client", text: "Yes, that's fine. I want to proceed. I feel strongly that what they did was wrong.", start: 528000, end: 540000 },
      { speaker: "Solicitor", text: "I understand, and I think you have a strong case. Let me summarise the action points from today. I'm going to submit the ACAS early conciliation notification on your behalf immediately after this meeting — that's the critical step. I'll also begin drafting the ET1 claim form and the schedule of loss, which sets out your financial claim in detail. I'll send you the client care letter today, which confirms our terms of engagement. Is there anything else you'd like to cover before we close?", start: 540000, end: 590000 },
      { speaker: "Client", text: "Just — what are the chances of this succeeding?", start: 590000, end: 597000 },
      { speaker: "Solicitor", text: "Constructive dismissal cases turn heavily on the facts. The combination of a ten-year unblemished record, a significant demotion, a material pay reduction, and — critically — a resignation letter that identifies the breach contemporaneously gives you a solid factual foundation. Employers do sometimes settle at ACAS rather than face a tribunal. I'd say the prospects are reasonable, but litigation always carries risk and I wouldn't want to overstate that. We'll have a clearer picture once we see how Nexus responds through ACAS.", start: 597000, end: 655000 },
      { speaker: "Client", text: "Thank you. That's helpful. I just needed to know there was a real case here.", start: 655000, end: 667000 },
      { speaker: "Solicitor", text: "There is. Thank you for coming in. I'll be in touch with the ACAS submission confirmation and the client care letter today.", start: 667000, end: 680000 },
    ],
    speakerCount: 2,
    createdAt: relDateTime(-44, "11:10"),
    redactions: [],
  };

  const attendanceNote = {
    id: DEMO_DOC_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    transcriptSnapshotId: DEMO_TRANSCRIPT_ID,
    type: "attendance_note",
    content: `ATTENDANCE NOTE

Matter Reference: EMP/2025/0071
Matter: Constructive Dismissal — ${clientName} v Nexus Group Ltd
Solicitor: ${solicitorName}
Date: ${relDate(-44)}
Duration: 60 minutes
Attendees: ${solicitorName} (Solicitor), ${clientName} (Client)

---

PURPOSE OF MEETING

Initial consultation to advise on constructive dismissal claim following employer's imposition of demotion and salary reduction without client's consent.

---

BACKGROUND

The client was employed by Nexus Group Ltd as Senior Marketing Manager for ten years, earning £62,000 per annum. Following a company restructuring, the client was offered a demotion to Marketing Manager with a 15% salary reduction. Given two weeks to accept, the client declined and resigned. The resignation letter expressly identified the proposed changes as a fundamental breach of contract and stated that the client considered herself constructively dismissed.

---

LEGAL ANALYSIS

The claim proceeds on the basis of constructive unfair dismissal pursuant to s.95(1)(c) Employment Rights Act 1996. The employer's conduct — imposing a material demotion and pay reduction without agreement — constitutes a breach of the implied term of mutual trust and confidence (Malik v BCCI [1997] IRLR 462). The client's resignation in response to that breach completes the constructive dismissal.

---

KEY DISCUSSION POINTS

1. ACAS Early Conciliation
Mandatory notification to ACAS required before any ET1 filing. Limitation period: three months less one day from effective date of termination. Solicitor to submit ACAS notification immediately following this meeting. Client cautioned that employment tribunal limitation periods are extremely strict with very limited scope for extension.

2. Compensation — Basic Award
Calculated per statutory formula: age/service multiplier × statutory weekly pay cap (£643). Client: 10 years' service, age 42. Basic award: 10 × £643 = £6,430.

3. Compensation — Compensatory Award
Covers actual financial loss: loss of earnings to hearing date, future loss if not re-employed, loss of pension (employer 6% contribution), private health insurance, car allowance (£500/month). Client currently unemployed. Schedule of loss to be prepared.

4. Injury to Feelings
Not applicable in a pure dismissal claim. Advised that this head of loss is only available in discrimination claims. No discrimination element identified on current facts.

5. Costs
Fixed fee of £1,500 + VAT to ACAS stage (includes ACAS notification, conciliation correspondence, ET1 drafting and filing if required). Hourly rate of £${rate} + VAT if proceeding to full tribunal hearing.

---

ACTION POINTS

Solicitor:
- Submit ACAS early conciliation notification today (urgent — limitation)
- Issue client care letter today
- Commence drafting ET1 claim form and schedule of loss

Client:
- Provide company registration number for Nexus Group Ltd
- Gather evidence of benefits package (pension statements, health insurance details)
- Keep record of job search activity (mitigation of loss)

---

Attendance note produced from session recording. Verified and approved by ${solicitorName}.`,
    contentHash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    version: 1,
    versionType: "auto",
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

  const ccl = {
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

We are pleased to confirm that we are instructed to act on your behalf in relation to your constructive dismissal claim against Nexus Group Ltd. This letter sets out the terms on which we will act for you.

SOLICITOR WITH CONDUCT: ${solicitorName}
MATTER REFERENCE: EMP/2025/0071

OUR CHARGES
Fixed fee to ACAS early conciliation stage: £1,500 plus VAT at 20%.
If proceeding to tribunal hearing: £${rate} per hour plus VAT.

ESTIMATE OF COSTS
To ACAS stage (including ET1 if required): £1,500 + VAT
Full tribunal representation (if required): £8,000–£15,000 + VAT (estimate only)

LIMITATION PERIOD
We draw your attention to the strict three-month limitation period for employment tribunal claims. Time runs from the effective date of termination. Failure to comply may result in your claim being time-barred. We will take immediate steps to notify ACAS on your behalf.

Yours sincerely,
${solicitorName}
${firmName}`,
    contentHash: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    version: 1,
    versionType: "auto",
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

  const auditLogs = [
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
      metadata: { sessionId: DEMO_SESSION_ID, matterRef: "EMP/2025/0071" },
      severity: "info",
      hmacFingerprint: "f9d1b73e2a6c0847",
    },
    {
      id: "audit-003",
      eventType: "transcript_completed",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:12"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
      metadata: { wordCount: 2318, speakerCount: 2, confidence: 97.9 },
      severity: "info",
      hmacFingerprint: "b60a3f7e142d9c85",
    },
    {
      id: "audit-004",
      eventType: "document_produced",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:15"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
      metadata: { documentType: "attendance_note", matterRef: "EMP/2025/0071" },
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
      eventType: "case_created",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-45, "09:00"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { matterRef: "EMP/2025/0071", practiceArea: "employment_employee" },
      severity: "info",
      hmacFingerprint: "3b9e0f4a7c1d2865",
    },
    {
      id: "audit-007",
      eventType: "case_email_sent",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_CCL_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "16:05"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "client_care_letter", recipientEmail: "client@example.com" },
      severity: "info",
      hmacFingerprint: "8f3a1c7b04d2e569",
    },
    {
      id: "audit-008",
      eventType: "document_exported_pdf",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-40, "09:20"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "attendance_note", exportedBy: solicitorName },
      severity: "info",
      hmacFingerprint: "5e81d2c4f07a9b36",
    },
  ];

  const undertakings = [
    {
      id: "demo-ut-001",
      caseId: DEMO_CASE_ID,
      description: "Submit ACAS early conciliation notification on behalf of client — urgent, limitation period running",
      givenBy: solicitorName,
      givenTo: "ACAS",
      dueDate: relDateTime(-44),
      status: "completed",
      completedAt: relDateTime(-44, "17:00"),
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
    {
      id: "demo-ut-002",
      caseId: DEMO_CASE_ID,
      description: "File ET1 claim form with Employment Tribunal upon conclusion of ACAS conciliation",
      givenBy: solicitorName,
      givenTo: "Employment Tribunal",
      dueDate: relDateTime(5),
      status: "outstanding",
      completedAt: null,
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
  ];

  const timeEntries = [
    {
      id: "demo-te-001",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Initial consultation — 60 minutes",
      duration: 60,
      rate: rate,
      amount: String(rate),
      date: relDate(-44),
      createdAt: relDateTime(-44, "14:00"),
    },
    {
      id: "demo-te-002",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "ACAS early conciliation submission and client care letter",
      duration: 45,
      rate: rate,
      amount: String(Math.round(rate * 45 / 60)),
      date: relDate(-44),
      createdAt: relDateTime(-44, "17:00"),
    },
  ];

  const sraReadiness = {
    overall: "amber" as const,
    outstandingCount: 2,
    criteria: [
      { key: "client_care_letter", label: "Client Care Letter", status: "green" as const, detail: "Sent on " + relDate(-44), sraRef: "SRA Code 8.6", actionRoute: null, externalNote: null },
      { key: "conflict_check", label: "Conflict Check", status: "green" as const, detail: "Completed", sraRef: "SRA Code 6.1", actionRoute: null, externalNote: null },
      { key: "consent_recorded", label: "Consent Recorded", status: "green" as const, detail: "Verbal consent confirmed in recording", sraRef: "UK GDPR Art. 7", actionRoute: null, externalNote: null },
      { key: "undertakings", label: "Undertakings", status: "amber" as const, detail: "1 outstanding undertaking — ET1 filing", sraRef: "SRA Code 1.3", actionRoute: null, externalNote: null },
      { key: "time_recording", label: "Time Recording", status: "amber" as const, detail: "2 entries — last updated " + relDate(-44), sraRef: "SRA Code 8.7", actionRoute: null, externalNote: null },
      { key: "practice_area", label: "Practice Area Tagged", status: "green" as const, detail: "Employment (Employee)", sraRef: "SRA Code 1.1", actionRoute: null, externalNote: null },
    ],
    disclaimer: "This SRA Readiness check is indicative only. Always verify against the full SRA Standards and Regulations.",
  };

  const complianceData = {
    amlRiskLevel: "medium",
    idVerified: true,
    idType: "passport",
    idCountry: "UK",
    sourceOfFundsConfirmed: true,
    sourceOfFundsNote: "Employment income",
    colpReviewRequired: true,
    colpReviewed: false,
    colpReviewPending: true,
    colpReviewerId: "demo-user-2",
    colpReviewerName: "James Whitmore",
  };

  const consentLogs = [
    {
      id: "demo-consent-001",
      caseId: DEMO_CASE_ID,
      sessionId: DEMO_SESSION_ID,
      consentGiven: true,
      consentType: "verbal_recorded",
      consentTimestamp: relDateTime(-44, "10:02"),
      consentText: "Client confirmed verbal consent to recording at 00:18 of session.",
      consentedBy: clientName,
      recordedBy: solicitorName,
    },
  ];

  const transcript2 = null;
  const transcript3 = null;

  return { caseBase, sessions, transcript1, transcript2, transcript3, attendanceNote, ccl, auditLogs, undertakings, timeEntries, sraReadiness, complianceData, consentLogs };
}

function getConveyancingContent(clientName: string, solicitorName: string, firmName: string, rate: number, sraNumber: string) {
  const caseBase = {
    id: DEMO_CASE_ID,
    firmId: DEMO_FIRM_ID,
    title: `Residential Purchase — ${clientName} / 14 Maple Avenue £385,000`,
    clientName: clientName,
    clientId: null,
    matterReference: "CONV/2025/0198",
    createdBy: DEMO_USER_ID,
    assignedToUserId: DEMO_USER_ID,
    createdAt: relDateTime(-45),
    status: "review_required",
    priority: "normal",
    sourceType: "audio",
    templateId: null,
    parentCaseId: null,
    riskLevel: "medium",
    practiceArea: "residential_conveyancing",
    conflictCheckCompleted: true,
    conflictCheckNote: null,
    clientCareLetterId: DEMO_DOC_CCL_ID,
    clientCareLetterSentAt: relDateTime(-44, "16:00"),
    costsEstimate: "£1,400 + VAT + disbursements",
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

  const sessions = [
    {
      id: DEMO_SESSION_ID,
      caseId: DEMO_CASE_ID,
      recordingType: "full_meeting",
      sessionTitle: "Initial Consultation",
      startedAt: relDateTime(-44, "10:00"),
      durationSeconds: 3200,
      status: "completed",
      notes: null,
      createdBy: DEMO_USER_ID,
    },
  ];

  const transcript1 = {
    id: DEMO_TRANSCRIPT_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    content: "Initial conveyancing consultation — property details, mortgage, searches, title, survey, SDLT and exchange timeline.",
    utterances: [
      { speaker: "Solicitor", text: `Good morning. I'm ${solicitorName}. Before we begin I'd like to confirm that I'll be recording this meeting with your consent. The recording is used solely to produce an accurate attendance note and is stored securely. Do you consent?`, start: 0, end: 15000 },
      { speaker: "Client", text: "Yes, that's fine. I consent to the recording.", start: 15000, end: 19000 },
      { speaker: "Solicitor", text: "Thank you, I've noted that. Congratulations on your offer being accepted. Can you walk me through the property and the transaction? Purchase price, type of property, and how you're funding it?", start: 19000, end: 33000 },
      { speaker: "Client", text: "Thank you. It's 14 Maple Avenue. Semi-detached house, three bedrooms. The purchase price is three hundred and eighty-five thousand. I've got a Halifax mortgage offer — three hundred and eight thousand, eighty percent loan-to-value. The rest I'm funding from savings.", start: 33000, end: 65000 },
      { speaker: "Solicitor", text: "And is this your first property purchase?", start: 65000, end: 68000 },
      { speaker: "Client", text: "Yes, first time buyer.", start: 68000, end: 72000 },
      { speaker: "Solicitor", text: "That's helpful — we'll come to the Stamp Duty Land Tax implications of that in a moment. The property is registered freehold?", start: 72000, end: 82000 },
      { speaker: "Client", text: "Yes, the estate agent said it's freehold. Registered title.", start: 82000, end: 89000 },
      { speaker: "Solicitor", text: "Good. I'll obtain the title register from the Land Registry. I'm also instructed by Halifax as their conveyancer for the mortgage, which is standard practice on residential purchases. Now, let's talk about the searches. We'll be ordering a full search pack: local authority search, drainage and water search, environmental search, and — given the property's age and location — I'll recommend a chancel repair indemnity insurance policy. Chancel repair liability is a historic obligation that occasionally attaches to registered properties, and the insurance is inexpensive, usually around thirty to fifty pounds.", start: 89000, end: 148000 },
      { speaker: "Client", text: "I'd heard about chancel repair before. That's fine — I'll take the insurance.", start: 148000, end: 157000 },
      { speaker: "Solicitor", text: "Sensible. The searches will take approximately two to three weeks to come back. Once we have them, we'll raise any necessary enquiries with the seller's solicitors. Have you had a survey done on the property?", start: 157000, end: 175000 },
      { speaker: "Client", text: "Yes, I had a HomeBuyer Report. It came back last week. There was a flag on damp — in the utility room. The surveyor said further investigation is recommended. I'm a bit worried about it.", start: 175000, end: 198000 },
      { speaker: "Solicitor", text: "It's right to flag that. A HomeBuyer Report flag on damp doesn't necessarily mean a major defect — it could be minor condensation or an isolated issue. What I'd suggest is that we raise it as a specific enquiry with the seller, asking for details of any known damp or remedial works, and you may also want to commission a specialist damp survey. The cost is typically one hundred to two hundred pounds and it would give you a much clearer picture before you commit.", start: 198000, end: 240000 },
      { speaker: "Client", text: "I'll arrange that. Can we also raise it in the enquiries?", start: 240000, end: 248000 },
      { speaker: "Solicitor", text: "Absolutely, we'll include it in the standard CPSE enquiries. Now, I've reviewed the draft contract pack the seller's solicitors sent through. The title itself looks clean — no significant restrictions or charges. There is a restrictive covenant on the register noting no commercial use of the property, but for a residential buyer that's irrelevant and won't affect you.", start: 248000, end: 280000 },
      { speaker: "Client", text: "Good. What about the risk of the deal falling through? I've heard about gazumping.", start: 280000, end: 292000 },
      { speaker: "Solicitor", text: "Gazumping is a real risk until exchange of contracts — at exchange, the contract becomes legally binding and neither party can pull out without financial consequences. Until then, either party can withdraw at any time. Abortive costs insurance is available — it covers your survey, search and legal costs if the transaction falls through before exchange. Premiums are typically thirty-five to sixty pounds. I'd recommend considering it given your survey and search costs.", start: 292000, end: 338000 },
      { speaker: "Client", text: "Yes, please arrange that for me.", start: 338000, end: 342000 },
      { speaker: "Solicitor", text: "I'll get that in place. Let's talk about Stamp Duty Land Tax. At a purchase price of three hundred and eighty-five thousand, the standard SDLT calculation would give you a liability of nine thousand two hundred and fifty pounds. However, as a first-time buyer, you benefit from first-time buyer relief. The first three hundred thousand is exempt, and the rate on the balance — eighty-five thousand — is five percent, giving you four thousand two hundred and fifty pounds SDLT. That's a saving of five thousand pounds compared to a standard purchaser.", start: 342000, end: 405000 },
      { speaker: "Client", text: "Oh, that's significant. I hadn't realised how much the relief was worth.", start: 405000, end: 415000 },
      { speaker: "Solicitor", text: "It's a meaningful saving. Now, the Halifax mortgage offer — have you had a chance to review the conditions?", start: 415000, end: 425000 },
      { speaker: "Client", text: "I've looked through it. They want buildings insurance in place from exchange, which I expected. Is there anything else?", start: 425000, end: 440000 },
      { speaker: "Solicitor", text: "There's a standard alterations clause — Halifax require their written consent before you carry out any structural alterations to the property. That includes loft conversions, extensions, and any works that might affect the structural integrity. Speaking of which, you mentioned a loft conversion at the viewing?", start: 440000, end: 465000 },
      { speaker: "Client", text: "Yes — it's something I'd like to do in the future. Not immediately, but within the next two or three years. Would I need planning permission?", start: 465000, end: 480000 },
      { speaker: "Solicitor", text: "For most loft conversions, you'd be looking at either permitted development — where no planning permission is required — or a more complex conversion that would need a full planning application. Either way, you'd need to notify Halifax before starting works given the mortgage condition. I'd recommend keeping them in the loop from the outset. You'll also need a party wall agreement with your neighbours if the works affect shared walls, which they typically do with semi-detached properties.", start: 480000, end: 528000 },
      { speaker: "Client", text: "Noted. I'll keep Halifax informed when the time comes.", start: 528000, end: 537000 },
      { speaker: "Solicitor", text: "Let's talk about the timeline. We're targeting exchange in approximately six weeks, subject to searches coming back and replies to enquiries being satisfactory. Completion would be two weeks after exchange, assuming the chain allows. Is there a chain above you — is the seller purchasing elsewhere?", start: 537000, end: 570000 },
      { speaker: "Client", text: "Yes, there's a chain. The seller is buying a new build. I think the new build is almost ready.", start: 570000, end: 583000 },
      { speaker: "Solicitor", text: "New build chains can be unpredictable — developers sometimes push back on dates. I'd manage expectations slightly on the six-week target. We'll do everything on our side promptly, but the chain position is outside our control. I'll keep you updated at every stage.", start: 583000, end: 612000 },
      { speaker: "Client", text: "That's fine. Is there anything I need to do before we meet again?", start: 612000, end: 622000 },
      { speaker: "Solicitor", text: "A few things. Arrange the specialist damp survey as soon as possible. Arrange your buildings insurance to be ready to activate at exchange. I'll order the searches this week and send you the client care letter today. I'll also chase the seller's solicitors for outstanding replies to our initial enquiries. Is there anything else you'd like to ask?", start: 622000, end: 660000 },
      { speaker: "Client", text: "No, I think that covers everything. Thank you — this has been really helpful.", start: 660000, end: 672000 },
      { speaker: "Solicitor", text: "My pleasure. You're in a good position — clean title, reasonable chain, and your first-time buyer relief is confirmed. I'll be in touch shortly with the client care letter and an update on the searches. Thank you for coming in.", start: 672000, end: 695000 },
    ],
    speakerCount: 2,
    createdAt: relDateTime(-44, "11:10"),
    redactions: [],
  };

  const attendanceNote = {
    id: DEMO_DOC_ID,
    caseId: DEMO_CASE_ID,
    meetingSessionId: DEMO_SESSION_ID,
    transcriptSnapshotId: DEMO_TRANSCRIPT_ID,
    type: "attendance_note",
    content: `ATTENDANCE NOTE

Matter Reference: CONV/2025/0198
Matter: Residential Purchase — ${clientName} / 14 Maple Avenue £385,000
Solicitor: ${solicitorName}
Date: ${relDate(-44)}
Duration: 55 minutes
Attendees: ${solicitorName} (Solicitor), ${clientName} (Client)

---

PURPOSE OF MEETING

Initial conveyancing consultation in connection with the residential purchase of 14 Maple Avenue at a purchase price of £385,000. Client is a first-time buyer funding the purchase with a Halifax mortgage of £308,000 (80% LTV) and £77,000 savings.

---

PROPERTY DETAILS

Property: 14 Maple Avenue — semi-detached freehold, 3 bedrooms
Purchase price: £385,000
Mortgage: Halifax, £308,000, 80% LTV
Client status: First-time buyer

---

KEY DISCUSSION POINTS

1. Searches
Full search pack to be ordered: local authority, drainage and water, environmental. Chancel repair indemnity insurance recommended and accepted by client (est. £30–50).

2. Title
Draft contract pack reviewed. Title clean — registered freehold, no significant restrictions. Restrictive covenant re: no commercial use noted — irrelevant for residential purchaser.

3. Survey — HomeBuyer Report
Damp flagged in utility room. Client instructed to commission specialist damp survey (est. £100–200). Damp to be raised as specific enquiry in CPSE enquiries with seller's solicitors.

4. Abortive Costs Insurance
Risk of gazumping discussed. Client instructed to arrange abortive costs insurance (est. £35–60 premium). To be organised by solicitor.

5. Stamp Duty Land Tax
Standard SDLT at £385,000: £9,250. First-time buyer relief applies: £4,250. Saving: £5,000.

6. Halifax Mortgage Conditions
Buildings insurance required from exchange. Alterations clause noted — Halifax written consent required before any structural alterations including loft conversions. Client intends future loft conversion — advised to notify Halifax before works commence, and party wall agreement with neighbours will be required.

7. Transaction Timeline
Target exchange: 6 weeks (subject to searches and enquiry replies). Completion: 2 weeks post-exchange. Chain in place — seller purchasing new build (risk of delay noted).

---

ACTION POINTS

Solicitor:
- Order search pack this week
- Issue client care letter today
- Chase seller's solicitors for replies to initial enquiries
- Arrange abortive costs insurance

Client:
- Commission specialist damp survey urgently
- Arrange buildings insurance policy (ready to activate at exchange)
- Review Halifax mortgage offer conditions

---

Attendance note produced from session recording. Verified and approved by ${solicitorName}.`,
    contentHash: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
    version: 1,
    versionType: "auto",
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

  const ccl = {
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

We are pleased to confirm that we are instructed to act on your behalf in relation to the purchase of 14 Maple Avenue at a price of £385,000. We are also instructed by Halifax plc as their conveyancer in connection with the mortgage advance. This letter sets out the terms on which we will act for you.

SOLICITOR WITH CONDUCT: ${solicitorName}
MATTER REFERENCE: CONV/2025/0198

OUR CHARGES
Our legal fee for this transaction: £1,400 plus VAT at 20%.

ESTIMATED DISBURSEMENTS
Land Registry search: £3
Land Registry registration fee: £270
Local authority search: £200 (approx)
Drainage and water search: £60 (approx)
Environmental search: £55 (approx)
Chancel repair indemnity insurance: £35–50
SDLT (first-time buyer relief applied): £4,250
Electronic transfer fee: £40 + VAT
CHAPS fee (mortgage advance): £30

TOTAL ESTIMATED COMPLETION FUNDS REQUIRED (approx): £82,400

Yours sincerely,
${solicitorName}
${firmName}`,
    contentHash: "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
    version: 1,
    versionType: "auto",
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

  const auditLogs = [
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
      metadata: { sessionId: DEMO_SESSION_ID, matterRef: "CONV/2025/0198" },
      severity: "info",
      hmacFingerprint: "f9d1b73e2a6c0847",
    },
    {
      id: "audit-003",
      eventType: "transcript_completed",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:12"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
      metadata: { wordCount: 2205, speakerCount: 2, confidence: 98.1 },
      severity: "info",
      hmacFingerprint: "b60a3f7e142d9c85",
    },
    {
      id: "audit-004",
      eventType: "document_produced",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: DEMO_TRANSCRIPT_ID,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "11:15"),
      ipAddress: null,
      userAgent: "LegalNote Platform",
      metadata: { documentType: "attendance_note", matterRef: "CONV/2025/0198" },
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
      eventType: "case_created",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-45, "09:00"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { matterRef: "CONV/2025/0198", practiceArea: "residential_conveyancing" },
      severity: "info",
      hmacFingerprint: "3b9e0f4a7c1d2865",
    },
    {
      id: "audit-007",
      eventType: "case_email_sent",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_CCL_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-44, "16:05"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "client_care_letter", recipientEmail: "client@example.com" },
      severity: "info",
      hmacFingerprint: "8f3a1c7b04d2e569",
    },
    {
      id: "audit-008",
      eventType: "document_exported_pdf",
      userId: DEMO_USER_ID,
      caseId: DEMO_CASE_ID,
      documentId: DEMO_DOC_ID,
      transcriptId: null,
      audioRecordingId: null,
      timestamp: relDateTime(-40, "10:15"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      metadata: { documentType: "attendance_note", exportedBy: solicitorName },
      severity: "info",
      hmacFingerprint: "5e81d2c4f07a9b36",
    },
  ];

  const undertakings = [
    {
      id: "demo-ut-001",
      caseId: DEMO_CASE_ID,
      description: "Order full search pack (local authority, drainage, environmental) and chancel repair indemnity insurance",
      givenBy: solicitorName,
      givenTo: clientName,
      dueDate: relDateTime(-42),
      status: "completed",
      completedAt: relDateTime(-42, "14:00"),
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
    {
      id: "demo-ut-002",
      caseId: DEMO_CASE_ID,
      description: "Chase outstanding search results and raise enquiries on damp issue with seller's solicitors",
      givenBy: solicitorName,
      givenTo: clientName,
      dueDate: relDateTime(3),
      status: "outstanding",
      completedAt: null,
      createdAt: relDateTime(-44, "10:00"),
      createdBy: DEMO_USER_ID,
    },
  ];

  const timeEntries = [
    {
      id: "demo-te-001",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      description: "Initial conveyancing consultation — 55 minutes",
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
      description: "Client care letter and search pack instruction",
      duration: 30,
      rate: rate,
      amount: String(Math.round(rate * 30 / 60)),
      date: relDate(-44),
      createdAt: relDateTime(-44, "16:00"),
    },
  ];

  const sraReadiness = {
    overall: "amber" as const,
    outstandingCount: 2,
    criteria: [
      { key: "client_care_letter", label: "Client Care Letter", status: "green" as const, detail: "Sent on " + relDate(-44), sraRef: "SRA Code 8.6", actionRoute: null, externalNote: null },
      { key: "conflict_check", label: "Conflict Check", status: "green" as const, detail: "Completed", sraRef: "SRA Code 6.1", actionRoute: null, externalNote: null },
      { key: "consent_recorded", label: "Consent Recorded", status: "green" as const, detail: "Verbal consent confirmed in recording", sraRef: "UK GDPR Art. 7", actionRoute: null, externalNote: null },
      { key: "undertakings", label: "Undertakings", status: "amber" as const, detail: "1 outstanding undertaking — searches and enquiries", sraRef: "SRA Code 1.3", actionRoute: null, externalNote: null },
      { key: "time_recording", label: "Time Recording", status: "amber" as const, detail: "2 entries — last updated " + relDate(-44), sraRef: "SRA Code 8.7", actionRoute: null, externalNote: null },
      { key: "practice_area", label: "Practice Area Tagged", status: "green" as const, detail: "Residential Conveyancing", sraRef: "SRA Code 1.1", actionRoute: null, externalNote: null },
    ],
    disclaimer: "This SRA Readiness check is indicative only. Always verify against the full SRA Standards and Regulations.",
  };

  const complianceData = {
    amlRiskLevel: "medium",
    idVerified: true,
    idType: "passport",
    idCountry: "UK",
    sourceOfFundsConfirmed: true,
    sourceOfFundsNote: "Employment income and savings",
    colpReviewRequired: true,
    colpReviewed: false,
    colpReviewPending: true,
    colpReviewerId: "demo-user-2",
    colpReviewerName: "James Whitmore",
  };

  const consentLogs = [
    {
      id: "demo-consent-001",
      caseId: DEMO_CASE_ID,
      sessionId: DEMO_SESSION_ID,
      consentGiven: true,
      consentType: "verbal_recorded",
      consentTimestamp: relDateTime(-44, "10:02"),
      consentText: "Client confirmed verbal consent to recording at 00:18 of session.",
      consentedBy: clientName,
      recordedBy: solicitorName,
    },
  ];

  const transcript2 = null;
  const transcript3 = null;

  return { caseBase, sessions, transcript1, transcript2, transcript3, attendanceNote, ccl, auditLogs, undertakings, timeEntries, sraReadiness, complianceData, consentLogs };
}

const PRACTICE_AREA_META: Record<string, { title: (c: string) => string; prefix: string; label: string; internalKey: string }> = {
  family_children_arrangements: { title: (c) => `Child Arrangements Order — ${c}`, prefix: "FAM", label: "Family (Children / Arrangements)", internalKey: "family_children_arrangements" },
  family: { title: (c) => `Family Law Matter — ${c}`, prefix: "FAM", label: "Family Law", internalKey: "family_children_arrangements" },
  family_divorce: { title: (c) => `Divorce Proceedings — ${c}`, prefix: "FAM", label: "Family (Divorce)", internalKey: "family_divorce" },
  wills_probate: { title: (c) => `Wills & Probate — ${c} Estate`, prefix: "PRO", label: "Wills & Probate", internalKey: "wills_probate" },
  "private-client": { title: (c) => `Private Client — ${c}`, prefix: "PC", label: "Private Client", internalKey: "wills_probate" },
  housing_tenancy: { title: (c) => `Housing Matter — ${c}`, prefix: "HDR", label: "Housing / Tenancy", internalKey: "housing_tenancy" },
  criminal_defence: { title: (c) => `Criminal Defence — ${c}`, prefix: "CRIM", label: "Criminal Defence", internalKey: "criminal_defence" },
  criminal: { title: (c) => `Criminal Defence — ${c}`, prefix: "CRIM", label: "Criminal Defence", internalKey: "criminal_defence" },
  immigration: { title: (c) => `Immigration Matter — ${c}`, prefix: "IMM", label: "Immigration Law", internalKey: "immigration" },
  "personal-injury": { title: (c) => `Personal Injury — ${c}`, prefix: "PI", label: "Personal Injury", internalKey: "personal_injury" },
  personal_injury: { title: (c) => `Personal Injury — ${c}`, prefix: "PI", label: "Personal Injury", internalKey: "personal_injury" },
  civil_litigation: { title: (c) => `Civil Litigation — ${c}`, prefix: "LIT", label: "Civil Litigation", internalKey: "civil_litigation" },
  commercial: { title: (c) => `Commercial Matter — ${c}`, prefix: "COM", label: "Commercial Law", internalKey: "commercial" },
  "debt-recovery": { title: (c) => `Debt Recovery — ${c}`, prefix: "DR", label: "Debt Recovery", internalKey: "debt_recovery" },
  debt_recovery: { title: (c) => `Debt Recovery — ${c}`, prefix: "DR", label: "Debt Recovery", internalKey: "debt_recovery" },
};

function normalizePracticeAreaKey(practiceArea: string): string {
  return practiceArea.replace(/-/g, "_").toLowerCase();
}

function getPracticeAreaContent(practiceArea: string, clientName: string, solicitorName: string, firmName: string, rate: number, sraNumber: string) {
  const normalized = normalizePracticeAreaKey(practiceArea);
  if (normalized === "employment_employee" || normalized === "employment_employer" || normalized === "employment") {
    return getEmploymentContent(clientName, solicitorName, firmName, rate, sraNumber);
  }
  if (normalized === "residential_conveyancing" || normalized === "commercial_conveyancing" || normalized === "conveyancing") {
    return getConveyancingContent(clientName, solicitorName, firmName, rate, sraNumber);
  }
  const familyContent = getFamilyContent(clientName, solicitorName, firmName, rate, sraNumber);
  const meta = PRACTICE_AREA_META[practiceArea] || PRACTICE_AREA_META[normalized];
  if (!meta || normalized === "family_children_arrangements") {
    return familyContent;
  }
  const year = new Date().getFullYear();
  const matterNum = Math.floor(Math.random() * 900 + 100);
  const matterRef = `${meta.prefix}/${year}/${String(matterNum).padStart(4, "0")}`;
  const internalPA = meta.internalKey || normalized;
  const updatedCaseBase = {
    ...familyContent.caseBase,
    title: meta.title(clientName),
    matterReference: matterRef,
    practiceArea: internalPA,
    clientCareLetterId: DEMO_DOC_CCL_ID,
  };
  const patchDoc = (doc: typeof familyContent.attendanceNote) => ({
    ...doc,
    content: doc.content.replace(/FAM\/2025\/0412/g, matterRef),
  });
  const patchCcl = (doc: typeof familyContent.ccl) => ({
    ...doc,
    content: doc.content.replace(/FAM\/2025\/0412/g, matterRef),
  });
  const patchAudit = (logs: typeof familyContent.auditLogs) =>
    logs.map(l => ({
      ...l,
      metadata: {
        ...l.metadata,
        ...(l.metadata && "matterRef" in l.metadata ? { matterRef } : {}),
        ...(l.metadata && "practiceArea" in l.metadata ? { practiceArea: internalPA } : {}),
      },
    }));
  return {
    ...familyContent,
    caseBase: updatedCaseBase,
    attendanceNote: patchDoc(familyContent.attendanceNote),
    ccl: patchCcl(familyContent.ccl),
    auditLogs: patchAudit(familyContent.auditLogs),
    sraReadiness: {
      ...familyContent.sraReadiness,
      criteria: familyContent.sraReadiness.criteria.map(c =>
        c.key === "practice_area" ? { ...c, detail: meta.label } : c
      ),
    },
  };
}

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
  const practiceArea = params.practiceArea || "family_children_arrangements";

  const content = getPracticeAreaContent(practiceArea, clientName, solicitorName, firmName, rate, sraNumber);
  const { caseBase: demoCaseBase, sessions: demoSessions, transcript1, transcript2, transcript3,
    attendanceNote: demoAttendanceNote, ccl: demoClientCareLetter, auditLogs: demoAuditLogs,
    undertakings: demoUndertakings, timeEntries: demoTimeEntries, sraReadiness: demoSraReadiness,
    complianceData: demoComplianceData, consentLogs: demoConsentLogs } = content;

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

  const demoDocuments = [demoAttendanceNote, demoClientCareLetter];

  const demoSessionWithDetails = {
    ...demoSessions[0],
    transcript: transcript1,
    documents: demoDocuments.filter(d => d.meetingSessionId === DEMO_SESSION_ID),
  };

  const demoSessionWithDetails2 = demoSessions[1] ? {
    ...demoSessions[1],
    transcript: transcript2 ?? {
      id: "demo-transcript-002",
      caseId: DEMO_CASE_ID,
      meetingSessionId: DEMO_SESSION_ID_2,
      content: "Strategy review meeting.",
      utterances: [],
      speakerCount: 2,
      createdAt: relDateTime(-28, "12:30"),
      redactions: [],
    },
    documents: [],
  } : null;

  const demoSessionWithDetails3 = demoSessions[2] ? {
    ...demoSessions[2],
    transcript: transcript3 ?? null,
    documents: [],
  } : null;

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
      type: "document_produced",
      title: "Attendance note ready for review",
      body: demoCaseBase.title,
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
    {
      id: "demo-cal-003",
      caseId: DEMO_CASE_ID,
      userId: DEMO_USER_ID,
      provider: "outlook",
      providerEventId: "outlook-event-003",
      eventType: "meeting",
      syncedAt: relDateTime(-1),
      lastUpdatedAt: null,
      title: "Follow-up — Child Arrangements",
      description: "Second consultation to review CAFCASS report",
      startTime: relDateTime(3, "10:00"),
      endTime: relDateTime(3, "11:00"),
      location: "Microsoft Teams",
      meetingUrl: "https://teams.microsoft.com/l/meetup-join/demo-consultation",
      consentStatus: "awaiting",
    },
    {
      id: "demo-cal-004",
      caseId: null,
      userId: DEMO_USER_ID,
      provider: "google",
      providerEventId: "google-event-004",
      eventType: "meeting",
      syncedAt: relDateTime(-2),
      lastUpdatedAt: null,
      title: "Initial Consultation — Estate Planning",
      description: "New client intake — probate and inheritance matters",
      startTime: relDateTime(5, "14:30"),
      endTime: relDateTime(5, "15:30"),
      location: "Zoom Meeting",
      meetingUrl: "https://zoom.us/j/demo-estate-planning",
      consentStatus: "granted",
    },
  ];

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
  setData([`/api/cases/${DEMO_CASE_ID}/transcript`], transcript1);
  setData([`/api/cases/${DEMO_CASE_ID}/time-entries`], demoTimeEntries);
  setData([`/api/cases/${DEMO_CASE_ID}/undertakings`], demoUndertakings);
  setData([`/api/cases/${DEMO_CASE_ID}/action-items`], []);
  setData([`/api/cases/${DEMO_CASE_ID}/processing-status`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/live-import`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/sra-readiness`], demoSraReadiness);
  setData([`/api/cases/${DEMO_CASE_ID}/sra-report/preview`], null);
  setData([`/api/cases/${DEMO_CASE_ID}/compliance`], demoComplianceData);
  setData([`/api/consent/by-case/${DEMO_CASE_ID}`], demoConsentLogs);
  setData([`/api/audio/by-case/${DEMO_CASE_ID}`], null);
  setData(["/api/sessions", DEMO_SESSION_ID], demoSessionWithDetails);
  if (demoSessionWithDetails2) setData(["/api/sessions", DEMO_SESSION_ID_2], demoSessionWithDetails2);
  if (demoSessionWithDetails3) setData(["/api/sessions", DEMO_SESSION_ID_3], demoSessionWithDetails3);
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
