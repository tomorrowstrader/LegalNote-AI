/**
 * Demo Seeding Service
 * Creates sample data for LegalNote AI demonstrations
 * 
 * Sample Cases:
 * 1. Sarah Thompson - Conveyancing (property purchase)
 * 2. Marcus Webb - Employment Dispute (unfair dismissal)
 * 3. Eleanor Chen - Commercial Contract (business partnership)
 * 4. David Patterson - Family Law (divorce settlement)
 */

import { db } from "../db";
import { cases, transcripts, documents, consentLogs, actionItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Demo case data with realistic UK legal scenarios
const DEMO_CASES = [
  {
    title: "Property Purchase - 42 Maple Grove",
    clientName: "Sarah Thompson",
    matterReference: "CONV/2024/0847",
    status: "completed" as const,
    priority: "normal" as const,
    sourceType: "audio" as const,
    transcript: {
      content: `Meeting transcript - Property Purchase consultation

SOLICITOR: Good morning, Mrs Thompson. Thank you for coming in today. Before we begin, I need to inform you that this meeting is being recorded for accuracy and compliance purposes. Do you consent to this recording?

CLIENT: Yes, that's fine. I understand.

SOLICITOR: Thank you. So, you're looking to purchase 42 Maple Grove in Hampstead. I've reviewed the draft contract from the seller's solicitors. There are a few points we need to discuss.

CLIENT: Of course. Is everything in order?

SOLICITOR: Mostly, yes. The property is freehold, which is straightforward. However, the local authority search has revealed a potential issue - there's a proposed cycle lane that may affect the front boundary.

CLIENT: Oh, that sounds concerning. What does that mean for us?

SOLICITOR: It's not necessarily a problem, but we should factor it in. The council plans are at consultation stage, so nothing is certain. I'd recommend we include a retention on completion of five thousand pounds pending clarification.

CLIENT: That seems sensible. What about the chain situation?

SOLICITOR: The sellers have found their onward purchase and are keen to complete within eight weeks. Your mortgage offer is valid until March, so timing works well. I'd suggest we aim for completion on the fifteenth of February.

CLIENT: Perfect. And the fixtures and fittings - I wanted to clarify about the garden shed.

SOLICITOR: Yes, I'll add that to the enquiries. The current list only includes curtains and carpets. We'll specifically request confirmation that the shed is included.

CLIENT: Wonderful. What are the next steps?

SOLICITOR: I'll respond to the contract enquiries this week, chase the management company for service charge information, and send you a report on title once I have all the searches back. We should also arrange for the balance of your deposit - that's forty-seven thousand, five hundred pounds.

CLIENT: I can transfer that tomorrow.

SOLICITOR: Excellent. Any other questions at this stage?

CLIENT: No, I think that covers everything. Thank you for explaining it so clearly.

SOLICITOR: My pleasure. I'll be in touch within the week with an update.`,
      utterances: [
        { speaker: "A", text: "Good morning, Mrs Thompson. Thank you for coming in today. Before we begin, I need to inform you that this meeting is being recorded for accuracy and compliance purposes. Do you consent to this recording?", start: 0, end: 12000, confidence: 0.95 },
        { speaker: "B", text: "Yes, that's fine. I understand.", start: 12500, end: 15000, confidence: 0.97 },
        { speaker: "A", text: "Thank you. So, you're looking to purchase 42 Maple Grove in Hampstead. I've reviewed the draft contract from the seller's solicitors. There are a few points we need to discuss.", start: 15500, end: 28000, confidence: 0.94 },
        { speaker: "B", text: "Of course. Is everything in order?", start: 28500, end: 31000, confidence: 0.96 },
        { speaker: "A", text: "Mostly, yes. The property is freehold, which is straightforward. However, the local authority search has revealed a potential issue - there's a proposed cycle lane that may affect the front boundary.", start: 31500, end: 48000, confidence: 0.93 },
        { speaker: "B", text: "Oh, that sounds concerning. What does that mean for us?", start: 48500, end: 52000, confidence: 0.95 },
        { speaker: "A", text: "It's not necessarily a problem, but we should factor it in. The council plans are at consultation stage, so nothing is certain. I'd recommend we include a retention on completion of five thousand pounds pending clarification.", start: 52500, end: 72000, confidence: 0.92 },
        { speaker: "B", text: "That seems sensible. What about the chain situation?", start: 72500, end: 76000, confidence: 0.96 },
        { speaker: "A", text: "The sellers have found their onward purchase and are keen to complete within eight weeks. Your mortgage offer is valid until March, so timing works well. I'd suggest we aim for completion on the fifteenth of February.", start: 76500, end: 95000, confidence: 0.94 },
        { speaker: "B", text: "Perfect. And the fixtures and fittings - I wanted to clarify about the garden shed.", start: 95500, end: 101000, confidence: 0.95 },
        { speaker: "A", text: "Yes, I'll add that to the enquiries. The current list only includes curtains and carpets. We'll specifically request confirmation that the shed is included.", start: 101500, end: 115000, confidence: 0.93 },
        { speaker: "B", text: "Wonderful. What are the next steps?", start: 115500, end: 118000, confidence: 0.97 },
        { speaker: "A", text: "I'll respond to the contract enquiries this week, chase the management company for service charge information, and send you a report on title once I have all the searches back. We should also arrange for the balance of your deposit - that's forty-seven thousand, five hundred pounds.", start: 118500, end: 145000, confidence: 0.91 },
        { speaker: "B", text: "I can transfer that tomorrow.", start: 145500, end: 148000, confidence: 0.98 },
        { speaker: "A", text: "Excellent. Any other questions at this stage?", start: 148500, end: 152000, confidence: 0.96 },
        { speaker: "B", text: "No, I think that covers everything. Thank you for explaining it so clearly.", start: 152500, end: 158000, confidence: 0.95 },
        { speaker: "A", text: "My pleasure. I'll be in touch within the week with an update.", start: 158500, end: 164000, confidence: 0.97 }
      ],
      speakerCount: 2
    },
    attendanceNote: `ATTENDANCE NOTE

Client: Sarah Thompson
Matter: Property Purchase - 42 Maple Grove
Reference: CONV/2024/0847
Date: [Meeting Date]
Present: [Solicitor Name], Sarah Thompson (Client)

1. INTRODUCTION
Client attended the office to discuss the purchase of 42 Maple Grove, Hampstead. Recording consent was obtained at the start of the meeting.

2. CONTRACT REVIEW
The draft contract from the seller's solicitors has been reviewed. Key points discussed:
- The property is freehold
- Local authority search revealed a proposed cycle lane that may affect the front boundary (currently at consultation stage)

3. RECOMMENDATIONS
It was recommended to include a retention on completion of £5,000 pending clarification of the cycle lane proposal.

4. CHAIN AND TIMING
- Sellers have found their onward purchase
- Target completion: 8 weeks (15th February)
- Client's mortgage offer valid until March - timing confirmed as workable

5. FIXTURES AND FITTINGS
- Current list includes curtains and carpets only
- Client requested confirmation that garden shed is included
- Solicitor to add this to enquiries

6. FINANCIAL MATTERS
- Balance of deposit required: £47,500
- Client confirmed transfer will be made tomorrow

7. NEXT STEPS
a) Respond to contract enquiries this week
b) Chase management company for service charge information
c) Send report on title once all searches returned
d) Await deposit transfer

8. CLIENT CONFIRMATION
Client confirmed understanding of all matters discussed and had no further questions at this stage.

Fee earner to update client within the week.`,
    summary: `Property purchase consultation for 42 Maple Grove, Hampstead. Contract reviewed - property is freehold. Local search revealed proposed cycle lane affecting boundary (at consultation stage). Recommended £5,000 retention on completion. Chain progressing well with 8-week target. Client to transfer £47,500 deposit. Action items: respond to enquiries, chase service charge info, add garden shed query.`,
    actionItems: [
      { description: "Respond to contract enquiries", assignee: "Solicitor", priority: "high" },
      { description: "Chase management company for service charge information", assignee: "Solicitor", priority: "medium" },
      { description: "Add garden shed to fixtures enquiry", assignee: "Solicitor", priority: "medium" },
      { description: "Transfer deposit balance of £47,500", assignee: "Client", priority: "high" },
      { description: "Send report on title once searches returned", assignee: "Solicitor", priority: "medium" }
    ]
  },
  {
    title: "Unfair Dismissal Claim",
    clientName: "Marcus Webb",
    matterReference: "EMP/2024/0312",
    status: "completed" as const,
    priority: "urgent" as const,
    sourceType: "audio" as const,
    transcript: {
      content: `Meeting transcript - Employment Dispute consultation

SOLICITOR: Good afternoon, Mr Webb. Before we start, I need to let you know this meeting is being recorded. Is that acceptable to you?

CLIENT: Yes, that's fine.

SOLICITOR: Thank you. So, you've been dismissed from Hartley Technologies after twelve years of service. Can you walk me through what happened?

CLIENT: It was completely out of the blue. Last Tuesday, my manager called me into a meeting with HR. They said I was being made redundant due to restructuring.

SOLICITOR: Did they follow a proper redundancy consultation process? Were you given any warning?

CLIENT: Nothing at all. No consultation, no discussion of alternatives. They just handed me a letter and said my employment was terminated immediately.

SOLICITOR: That's concerning. In genuine redundancy situations, employers are required to follow a fair process including consultation. Were there others made redundant at the same time?

CLIENT: That's the thing - no. And two weeks later, I saw they'd advertised my exact role on LinkedIn.

SOLICITOR: I see. That significantly changes the picture. If they've replaced you in the same role, this may not be a genuine redundancy at all. It could constitute unfair dismissal.

CLIENT: I thought so. I loved that job. I had excellent performance reviews.

SOLICITOR: Do you have documentation of your performance reviews?

CLIENT: Yes, I kept copies. I also have emails from last month where my manager praised my project work.

SOLICITOR: Excellent - that's very helpful. Now, there's a strict time limit for employment tribunal claims. We have three months less one day from your dismissal date. When exactly were you dismissed?

CLIENT: The fourteenth of November.

SOLICITOR: So we need to lodge the claim by the twelfth of February. Before that, we must go through ACAS early conciliation. I'd recommend we start that process immediately.

CLIENT: What does that involve?

SOLICITOR: I'll submit a notification to ACAS. They'll contact your former employer to see if the matter can be resolved without a tribunal. If not, they'll issue a certificate that allows us to proceed with a claim.

CLIENT: And if we go to tribunal, what could I expect?

SOLICITOR: For twelve years' service, the basic award could be around twenty-five thousand pounds based on your age and salary. Compensatory award for loss of earnings could be significantly more. However, we should also explore whether they'd consider a negotiated settlement.

CLIENT: I'd prefer to settle out of court if possible. I just want fair compensation.

SOLICITOR: Understood. Let's proceed with ACAS and see how they respond. Can you gather all your documentation - contract, performance reviews, the dismissal letter, and those LinkedIn screenshots?

CLIENT: I'll get everything together tonight.

SOLICITOR: Perfect. I'll prepare the ACAS notification today and call you tomorrow with an update.`,
      utterances: [
        { speaker: "A", text: "Good afternoon, Mr Webb. Before we start, I need to let you know this meeting is being recorded. Is that acceptable to you?", start: 0, end: 8000, confidence: 0.96 },
        { speaker: "B", text: "Yes, that's fine.", start: 8500, end: 10000, confidence: 0.98 },
        { speaker: "A", text: "Thank you. So, you've been dismissed from Hartley Technologies after twelve years of service. Can you walk me through what happened?", start: 10500, end: 20000, confidence: 0.94 },
        { speaker: "B", text: "It was completely out of the blue. Last Tuesday, my manager called me into a meeting with HR. They said I was being made redundant due to restructuring.", start: 20500, end: 32000, confidence: 0.93 },
        { speaker: "A", text: "Did they follow a proper redundancy consultation process? Were you given any warning?", start: 32500, end: 38000, confidence: 0.95 },
        { speaker: "B", text: "Nothing at all. No consultation, no discussion of alternatives. They just handed me a letter and said my employment was terminated immediately.", start: 38500, end: 50000, confidence: 0.92 },
        { speaker: "A", text: "That's concerning. In genuine redundancy situations, employers are required to follow a fair process including consultation. Were there others made redundant at the same time?", start: 50500, end: 65000, confidence: 0.94 },
        { speaker: "B", text: "That's the thing - no. And two weeks later, I saw they'd advertised my exact role on LinkedIn.", start: 65500, end: 73000, confidence: 0.91 },
        { speaker: "A", text: "I see. That significantly changes the picture. If they've replaced you in the same role, this may not be a genuine redundancy at all. It could constitute unfair dismissal.", start: 73500, end: 88000, confidence: 0.93 }
      ],
      speakerCount: 2
    },
    attendanceNote: `ATTENDANCE NOTE

Client: Marcus Webb
Matter: Unfair Dismissal Claim
Reference: EMP/2024/0312
Date: [Meeting Date]
Present: [Solicitor Name], Marcus Webb (Client)

1. INTRODUCTION
Client attended for initial consultation regarding potential unfair dismissal claim against Hartley Technologies Ltd. Recording consent obtained.

2. BACKGROUND
- Client employed for 12 years
- Dismissed on 14th November citing "redundancy due to restructuring"
- No prior warning or consultation provided
- No other redundancies at the same time

3. KEY EVIDENCE
- Same role advertised on LinkedIn two weeks after dismissal
- Client has excellent performance reviews
- Recent emails from manager praising project work

4. LEGAL ASSESSMENT
The circumstances suggest this may not be a genuine redundancy:
- No consultation process followed
- No discussion of alternatives
- Role immediately re-advertised
This could constitute unfair dismissal under the Employment Rights Act 1996.

5. LIMITATION PERIOD
- Dismissal date: 14th November
- Tribunal claim deadline: 12th February
- ACAS Early Conciliation must be completed first

6. POTENTIAL REMEDIES
- Basic Award: Approximately £25,000 (based on age, salary, length of service)
- Compensatory Award: To be calculated based on loss of earnings
- Settlement negotiation to be explored

7. CLIENT INSTRUCTIONS
Client prefers negotiated settlement if possible but willing to proceed to tribunal if necessary.

8. NEXT STEPS
a) Submit ACAS Early Conciliation notification immediately
b) Client to provide: employment contract, performance reviews, dismissal letter, LinkedIn screenshots
c) Solicitor to call client tomorrow with update

9. COSTS
Initial consultation fee discussed. Conditional fee arrangement to be considered if matter proceeds.`,
    summary: `Employment dispute consultation. Client dismissed after 12 years at Hartley Technologies, purportedly for redundancy. No consultation process followed. Same role advertised on LinkedIn 2 weeks later - suggests sham redundancy. Deadline for tribunal claim: 12th February. Estimated basic award ~£25,000. Client prefers settlement. Immediate action: submit ACAS notification.`,
    actionItems: [
      { description: "Submit ACAS Early Conciliation notification", assignee: "Solicitor", priority: "high" },
      { description: "Gather all documentation - contract, reviews, dismissal letter, LinkedIn screenshots", assignee: "Client", priority: "high" },
      { description: "Call client tomorrow with ACAS update", assignee: "Solicitor", priority: "high" },
      { description: "Calculate detailed compensatory award", assignee: "Solicitor", priority: "medium" }
    ]
  },
  {
    title: "Partnership Agreement Review",
    clientName: "Eleanor Chen",
    matterReference: "COMM/2024/0156",
    status: "completed" as const,
    priority: "deadline-soon" as const,
    sourceType: "audio" as const,
    transcript: {
      content: `Meeting transcript - Commercial Partnership consultation

SOLICITOR: Good morning, Ms Chen. I'm recording this meeting for our records - is that alright with you?

CLIENT: Yes, of course.

SOLICITOR: Thank you. You're looking at entering a partnership with David Morrison for a software development consultancy. Tell me about the arrangement you've discussed.

CLIENT: We've worked together for years as contractors. We want to formalise things. We'd each put in fifty thousand pounds and split profits equally.

SOLICITOR: And what about decision-making? Have you discussed how major business decisions would be made?

CLIENT: We assumed it would be fifty-fifty on everything.

SOLICITOR: That can work, but what happens when you disagree? With a fifty-fifty split, you could reach deadlock. We should include a dispute resolution mechanism.

CLIENT: I hadn't thought of that. What would you suggest?

SOLICITOR: Several options - mediation clauses, a swing vote from an independent party, or defined areas where each partner has final say. For example, you might handle technical decisions while David handles commercial ones.

CLIENT: That makes sense. David is better with clients, and I prefer the technical side.

SOLICITOR: Perfect. Now, what about if one of you wants to leave the partnership? Have you discussed exit mechanisms?

CLIENT: Briefly. We agreed we'd give each other first refusal on our shares.

SOLICITOR: Good start. We'll need to define the valuation method - book value, earnings multiple, or independent valuation. Also, what about restrictive covenants? Would you expect a non-compete clause if one partner leaves?

CLIENT: Yes, definitely. We wouldn't want an ex-partner setting up in competition immediately.

SOLICITOR: I'd recommend a twelve-month non-compete within a defined geographic area or client base. Courts will only enforce reasonable restrictions, so we need to be proportionate.

CLIENT: That sounds fair. What about liability? I'm worried about being personally liable for business debts.

SOLICITOR: In a traditional partnership, partners are jointly and severally liable. Have you considered a Limited Liability Partnership instead? The LLP structure gives you partnership flexibility with limited liability protection.

CLIENT: That sounds better. What's involved in setting up an LLP?

SOLICITOR: Registration with Companies House, a members' agreement instead of a partnership deed, and annual filing requirements. The costs are modest - perhaps a few hundred pounds in registration fees plus our professional fees for the documentation.

CLIENT: Let's go with the LLP then.

SOLICITOR: Excellent choice. I'll draft the LLP members' agreement incorporating everything we've discussed. I should have a first draft to you within two weeks.

CLIENT: Perfect. David and I are meeting next Friday - it would be helpful to have something to review.

SOLICITOR: I'll prioritise it. One more thing - have you considered intellectual property? Who owns the software you develop?

CLIENT: The LLP should own it, I think.

SOLICITOR: Agreed. We'll include an IP assignment clause. Also, we should address what happens to existing IP you or David bring to the partnership.

CLIENT: Good point. We both have some existing code libraries we'd want to keep personally.

SOLICITOR: We'll schedule those as excluded IP in the agreement. I think we've covered the main points. I'll send you a checklist of information I'll need.

CLIENT: Thank you. This has been incredibly helpful.`,
      utterances: [
        { speaker: "A", text: "Good morning, Ms Chen. I'm recording this meeting for our records - is that alright with you?", start: 0, end: 6000, confidence: 0.97 },
        { speaker: "B", text: "Yes, of course.", start: 6500, end: 8000, confidence: 0.98 },
        { speaker: "A", text: "Thank you. You're looking at entering a partnership with David Morrison for a software development consultancy. Tell me about the arrangement you've discussed.", start: 8500, end: 18000, confidence: 0.95 },
        { speaker: "B", text: "We've worked together for years as contractors. We want to formalise things. We'd each put in fifty thousand pounds and split profits equally.", start: 18500, end: 28000, confidence: 0.94 }
      ],
      speakerCount: 2
    },
    attendanceNote: `ATTENDANCE NOTE

Client: Eleanor Chen
Matter: Partnership Agreement Review
Reference: COMM/2024/0156
Date: [Meeting Date]
Present: [Solicitor Name], Eleanor Chen (Client)

1. INTRODUCTION
Client attended to discuss proposed business partnership with David Morrison for software development consultancy. Recording consent obtained.

2. PROPOSED STRUCTURE
Initial proposal: Traditional partnership
Revised recommendation: Limited Liability Partnership (LLP)
Reason: Limited liability protection with partnership flexibility

3. FINANCIAL ARRANGEMENTS
- Capital contribution: £50,000 each
- Profit split: 50/50

4. DECISION-MAKING
- Equal voting on major decisions
- Deadlock mechanism to be included
- Defined areas of authority:
  * Eleanor Chen: Technical decisions
  * David Morrison: Commercial/client decisions

5. EXIT PROVISIONS
- First refusal rights on departure
- Valuation method to be defined (options: book value, earnings multiple, independent valuation)
- 12-month non-compete clause within reasonable scope

6. INTELLECTUAL PROPERTY
- LLP to own all IP developed during partnership
- Existing IP brought by partners to be scheduled as excluded IP
- Client and partner each have existing code libraries to retain personally

7. LIABILITY
Traditional partnership liability rejected in favour of LLP structure for limited liability protection.

8. NEXT STEPS
a) Solicitor to draft LLP members' agreement (target: 2 weeks, ideally before next Friday)
b) Solicitor to send checklist of required information
c) Client meeting with David Morrison scheduled for next Friday

9. LLP REGISTRATION
Companies House registration to be arranged once agreement finalised. Estimated registration cost: few hundred pounds.`,
    summary: `Commercial partnership consultation. Client forming software consultancy with David Morrison. Recommended LLP structure for limited liability. 50/50 capital (£50k each) and profit split. Decision-making areas defined - Chen handles technical, Morrison handles commercial. Exit provisions include first refusal and 12-month non-compete. IP developed by LLP; existing personal code libraries excluded. Draft LLP agreement needed before next Friday.`,
    actionItems: [
      { description: "Draft LLP members' agreement", assignee: "Solicitor", priority: "high" },
      { description: "Send information checklist to client", assignee: "Solicitor", priority: "medium" },
      { description: "Compile list of existing personal IP to exclude", assignee: "Client", priority: "medium" },
      { description: "Discuss LLP structure with David Morrison", assignee: "Client", priority: "high" },
      { description: "Register LLP with Companies House", assignee: "Solicitor", priority: "low" }
    ]
  },
  {
    title: "Divorce Financial Settlement",
    clientName: "David Patterson",
    matterReference: "FAM/2024/0089",
    status: "review_required" as const,
    priority: "normal" as const,
    sourceType: "audio" as const,
    transcript: {
      content: `Meeting transcript - Family Law consultation

SOLICITOR: Good afternoon, Mr Patterson. This meeting will be recorded for accuracy. Do you consent?

CLIENT: Yes, I consent.

SOLICITOR: Thank you. We're here to discuss the financial settlement in your divorce. I've reviewed the Form E disclosure from your wife's solicitors. Let's go through the key points.

CLIENT: I'm particularly concerned about the pension situation.

SOLICITOR: Understandably. Your pension is valued at seven hundred and forty thousand pounds - it's the largest single asset. Mrs Patterson is seeking a pension sharing order of forty percent.

CLIENT: That seems excessive. I built that pension over thirty years, fifteen of which were before we even met.

SOLICITOR: That's a valid point. The court will consider the length of the marriage - eighteen years - and the contributions made before marriage. However, the pension accrued during the marriage is the primary focus.

CLIENT: What would be a fair share in your view?

SOLICITOR: Given the pre-marital contributions and the other assets, I'd suggest pushing for twenty-five to thirty percent. We can argue the remainder of your pension predates the marriage.

CLIENT: And what about the house?

SOLICITOR: The family home is valued at eight hundred and fifty thousand with three hundred thousand outstanding on the mortgage. Net equity of five hundred and fifty thousand. Mrs Patterson's proposal is to retain the house until your youngest finishes education, then sell and split fifty-fifty.

CLIENT: That could be another six years. I need to move on with my life.

SOLICITOR: I understand. We could counter-propose an immediate sale with you retaining a slightly larger share to offset the pension sharing, or alternatively, you could buy her out.

CLIENT: What would buying her out cost me?

SOLICITOR: If we assume a fifty-fifty split of equity, that's two hundred and seventy-five thousand, plus you'd need to refinance the mortgage in your sole name. Given your income, the bank may require you to reduce the mortgage balance.

CLIENT: That might be difficult right now.

SOLICITOR: Then the cleanest solution may be an immediate sale with a negotiated split. Perhaps fifty-five percent to you, forty-five to her, in exchange for a reduced pension sharing order.

CLIENT: That sounds more workable. What about maintenance?

SOLICITOR: Mrs Patterson is seeking spousal maintenance of two thousand per month. Given her earning capacity and the asset division, I believe this should be limited - perhaps three years to allow her to re-establish herself.

CLIENT: I can live with that if it's time-limited.

SOLICITOR: Good. I'll draft a counter-proposal incorporating these points: twenty-eight percent pension sharing, immediate sale with fifty-five/forty-five split, and three years' maintenance at two thousand per month.

CLIENT: Please go ahead.

SOLICITOR: I should have the proposal ready by the end of the week. We'll then allow time for negotiation before any court involvement.`,
      utterances: [
        { speaker: "A", text: "Good afternoon, Mr Patterson. This meeting will be recorded for accuracy. Do you consent?", start: 0, end: 6000, confidence: 0.96 },
        { speaker: "B", text: "Yes, I consent.", start: 6500, end: 8000, confidence: 0.98 },
        { speaker: "A", text: "Thank you. We're here to discuss the financial settlement in your divorce. I've reviewed the Form E disclosure from your wife's solicitors. Let's go through the key points.", start: 8500, end: 20000, confidence: 0.94 }
      ],
      speakerCount: 2
    },
    attendanceNote: `ATTENDANCE NOTE

Client: David Patterson
Matter: Divorce Financial Settlement
Reference: FAM/2024/0089
Date: [Meeting Date]
Present: [Solicitor Name], David Patterson (Client)

1. INTRODUCTION
Meeting to discuss financial settlement in divorce proceedings. Form E disclosure from Mrs Patterson's solicitors reviewed. Recording consent obtained.

2. ASSETS SUMMARY
| Asset | Value |
|-------|-------|
| Husband's Pension | £740,000 |
| Family Home | £850,000 |
| Mortgage | (£300,000) |
| Net Equity in Home | £550,000 |

3. WIFE'S PROPOSALS
- Pension sharing order: 40% of husband's pension
- Family home: Retain until youngest finishes education (approx. 6 years), then 50/50 split
- Spousal maintenance: £2,000 per month

4. CLIENT'S POSITION
- Client concerned about pension share given 15 years of accrual pre-marriage
- Client wishes to conclude property matters promptly
- Client willing to accept time-limited maintenance

5. ADVICE PROVIDED
a) Pension: Given 18-year marriage with 15 years pre-marital pension accrual, 25-30% share more appropriate than 40%
b) Property: Options discussed:
   - Immediate sale with adjusted split
   - Client buyout (cost ~£275,000 + mortgage refinancing)
   - Recommended: Immediate sale with 55/45 split in client's favour
c) Maintenance: Should be time-limited to 3 years given wife's earning capacity

6. COUNTER-PROPOSAL TO BE DRAFTED
- Pension sharing: 28%
- Property: Immediate sale, 55% to husband / 45% to wife
- Maintenance: £2,000/month for 3 years only

7. NEXT STEPS
a) Solicitor to draft counter-proposal by end of week
b) Allow negotiation period before court involvement
c) Client to review draft when received

8. CLIENT CONFIRMATION
Client confirmed understanding and instructed solicitor to proceed with counter-proposal.`,
    summary: `Divorce financial settlement consultation. Key assets: pension £740k, home equity £550k. Wife seeking 40% pension share, retention of home for 6 years, and £2k/month maintenance. Advised 28% pension share is fairer given pre-marital contributions. Proposed counter: immediate property sale (55/45 in client's favour), 28% pension share, 3-year time-limited maintenance. Draft counter-proposal by end of week.`,
    actionItems: [
      { description: "Draft counter-proposal for financial settlement", assignee: "Solicitor", priority: "high" },
      { description: "Calculate exact pension values for pre/during marriage periods", assignee: "Solicitor", priority: "medium" },
      { description: "Review draft counter-proposal when received", assignee: "Client", priority: "medium" }
    ]
  }
];

export async function seedDemoData(userId: string): Promise<{ success: boolean; message: string; casesCreated: number }> {
  try {
    // Check if demo data already exists for this user
    const existingCases = await db.select()
      .from(cases)
      .where(and(
        eq(cases.createdBy, userId),
        eq(cases.matterReference, "CONV/2024/0847")
      ));

    if (existingCases.length > 0) {
      return { success: false, message: "Demo data already exists for this user", casesCreated: 0 };
    }

    let casesCreated = 0;

    for (const demoCase of DEMO_CASES) {
      // Create case
      const [newCase] = await db.insert(cases).values({
        title: demoCase.title,
        clientName: demoCase.clientName,
        matterReference: demoCase.matterReference,
        createdBy: userId,
        status: demoCase.status,
        priority: demoCase.priority,
        sourceType: demoCase.sourceType,
        reviewed: true
      }).returning();

      // Create consent log
      await db.insert(consentLogs).values({
        caseId: newCase.id,
        solicitorId: userId,
        consentGiven: true,
        disclaimerScriptVersion: "v1.0",
        consentModality: "verbal_recorded"
      });

      // Create transcript
      const [newTranscript] = await db.insert(transcripts).values({
        caseId: newCase.id,
        content: demoCase.transcript.content,
        utterances: demoCase.transcript.utterances,
        speakerCount: demoCase.transcript.speakerCount
      }).returning();

      // Create attendance note document
      await db.insert(documents).values({
        caseId: newCase.id,
        transcriptSnapshotId: newTranscript.id,
        type: "attendance_note",
        content: demoCase.attendanceNote,
        version: 1,
        versionType: "ai_generated",
        createdBy: userId,
        status: "approved",
        approvedBy: userId
      });

      // Create summary document
      await db.insert(documents).values({
        caseId: newCase.id,
        transcriptSnapshotId: newTranscript.id,
        type: "summary",
        content: demoCase.summary,
        version: 1,
        versionType: "ai_generated",
        createdBy: userId,
        status: "approved",
        approvedBy: userId
      });

      // Create action items
      for (const item of demoCase.actionItems) {
        await db.insert(actionItems).values({
          caseId: newCase.id,
          transcriptId: newTranscript.id,
          description: item.description,
          assignee: item.assignee,
          priority: item.priority
        });
      }

      casesCreated++;
    }

    // Note: Firm profile is NOT seeded by demo data - it should be configured 
    // through the normal admin settings flow to avoid overwriting production data

    return { 
      success: true, 
      message: `Demo data created successfully: ${casesCreated} cases with transcripts, documents, and action items`,
      casesCreated 
    };
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return { 
      success: false, 
      message: `Error creating demo data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      casesCreated: 0 
    };
  }
}

export async function clearDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Find demo cases by their unique matter references - strictly scoped to this user
    const demoMatterRefs = DEMO_CASES.map(c => c.matterReference);
    
    const demoCases = await db.select()
      .from(cases)
      .where(eq(cases.createdBy, userId));

    const casesToDelete = demoCases.filter(c => 
      c.matterReference && demoMatterRefs.includes(c.matterReference)
    );

    // Delete all demo data in a safe order, always scoped to both caseId AND verifying user ownership
    for (const demoCase of casesToDelete) {
      // Double-check this case belongs to the user (defense in depth)
      if (demoCase.createdBy !== userId) {
        console.warn(`[DEMO] Skipping case ${demoCase.id} - ownership mismatch`);
        continue;
      }
      
      // Delete action items for this case
      await db.delete(actionItems).where(eq(actionItems.caseId, demoCase.id));
      
      // Delete documents for this case
      await db.delete(documents).where(eq(documents.caseId, demoCase.id));
      
      // Delete transcripts for this case
      await db.delete(transcripts).where(eq(transcripts.caseId, demoCase.id));
      
      // Delete consent logs for this case
      await db.delete(consentLogs).where(eq(consentLogs.caseId, demoCase.id));
      
      // Delete the case itself - additional user check for safety
      await db.delete(cases).where(and(
        eq(cases.id, demoCase.id),
        eq(cases.createdBy, userId)
      ));
    }

    return { 
      success: true, 
      message: `Cleared ${casesToDelete.length} demo cases` 
    };
  } catch (error) {
    console.error("Error clearing demo data:", error);
    return { 
      success: false, 
      message: `Error clearing demo data: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function resetDemoData(userId: string): Promise<{ success: boolean; message: string; casesCreated: number }> {
  // Clear existing demo data
  await clearDemoData(userId);
  
  // Re-seed fresh demo data
  return seedDemoData(userId);
}
