/**
 * Sample family (financial remedy) matter: Reeve conference fixture.
 * Seeds a complete matter with diarized transcript, attendance note
 * (REASONING_GAP markers left open), action items, and audit trail.
 *
 * Fixture source: Fixture_Family_MultiRegister_Conference_Reeve.md
 */
import { db } from "../db";
import {
  cases,
  meetingSessions,
  audioRecordings,
  consentLogs,
  transcripts,
  documents,
  auditTrail,
  actionItems,
  users,
} from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const MATTER_REFERENCE = "REE/FAM26-01188";
const DURATION_MINUTES = 156;
const DURATION_SECONDS = DURATION_MINUTES * 60;
const DURATION_MS = DURATION_SECONDS * 1000;
const UNITS = 26; // 156 / 6

type Turn = { speaker: "Priya" | "Adam" | "Ellis"; text: string };

const TURNS: Turn[] = [
  { speaker: "Priya", text: "Adam, can you hear me all right? Your video's frozen a bit." },
  { speaker: "Adam", text: "Yeah, I can hear you. Let me just... is that better?" },
  { speaker: "Priya", text: "That's better. Right. Adam, this is Ellis Warner, he's a paralegal here and he'll be sitting in and taking a note, if that's all right with you." },
  { speaker: "Adam", text: "Yeah, that's fine." },
  { speaker: "Ellis", text: "Morning, Adam." },
  { speaker: "Priya", text: "So before we get going, let me tell you who I am, because I should. I'm a solicitor, I'm fully qualified, and I'm a partner here, which means I've got overall responsibility for my own work. My work still gets peer reviewed by my colleagues, so there's a check on me as well." },
  { speaker: "Adam", text: "Okay." },
  { speaker: "Priya", text: "I'm regulated by the Solicitors Regulation Authority for this kind of work, and that brings certain protections with it, which are set out in the terms of business letter you've had. If something goes wrong and we can't sort it out between us quickly, you can take it to the Legal Ombudsman. You've signed the terms of business, haven't you?" },
  { speaker: "Adam", text: "I signed them, yeah. And the privacy thing, the data one." },
  { speaker: "Priya", text: "Good. Any questions on any of that?" },
  { speaker: "Adam", text: "No, I read it. It was fine." },
  { speaker: "Priya", text: "Fees are all in that same letter, so I won't go over them now, but we'll come back to costs properly at the end because there's something specific for you there. Now, this meeting is going to be in three parts. First I want to get your instructions on the background, the whole picture, and I'll fill in the fact find as we go. Second I'll explain where the law sits at the moment. Third we get down to what your actual options are. And we should talk about wills and powers of attorney too, because they matter here." },
  { speaker: "Adam", text: "Okay. That's a lot." },
  { speaker: "Priya", text: "It is, but we've got the time booked. One more thing before we start, and I ask everybody this. We've got a policy about clients who might be vulnerable in some way, and all our staff are trained to spot it, because we want to be sensitive to that. How would you describe yourself on that? Do you think you're vulnerable?" },
  { speaker: "Adam", text: "No. No, I don't think so. I'm knackered, but I'm not vulnerable. I'm all right." },
  { speaker: "Priya", text: "I'd agree with that, from what I've seen so far. But I want to say two things. One, I'm going to work to that policy anyway. Two, if that changes, or if you decide you'd like a different level of support, you tell me, and you can do that quietly, just between us. That door's always open." },
  { speaker: "Adam", text: "Understood. Thanks." },
  { speaker: "Priya", text: "Right. Take me back to the beginning. How long have you and Nadia been together?" },
  { speaker: "Adam", text: "We met in 2011. Got together straight away really, moved in together that autumn, and we were together from then on. Never split up, nothing like that. We got married later, much later, in 2022. June 2022." },
  { speaker: "Priya", text: "And when did that end?" },
  { speaker: "Adam", text: "February last year. 2025. She told me it was over in the February and I moved out that same month, went to my mum's, and I'm still there." },
  { speaker: "Priya", text: "And is it over? In your mind, is there any way back?" },
  { speaker: "Adam", text: "No. There's nothing there any more. I'm not angry about it, that's just how it is. I want it finished so I can get on with sorting the kids out properly." },
  { speaker: "Priya", text: "Has anything been started, on the divorce?" },
  { speaker: "Adam", text: "She did it. Her solicitors did it, in September, September last year. I got the papers. And then there was another bit of paper a few months back saying something had been granted, conditional, I think it said. But nothing since. Nobody's told me it's finished." },
  { speaker: "Priya", text: "So a conditional order, and no final order yet. That's normal, people often leave it there while the money is being sorted. Both of you British?" },
  { speaker: "Adam", text: "Yeah. Both born here." },
  { speaker: "Priya", text: "Then there's nothing extra I need to advise you on there. Tell me about her family, because you mentioned them on the phone." },
  { speaker: "Adam", text: "They've cut her off, basically. Her mum, her aunt, all of them. She's only got her brother left and that's it, and I think that's part of why she's like she is at the moment, she's got nobody. And between you and me, that whole family's got something going on. They're all on something. Her mum's on antidepressants, I know that for a fact because I've seen them in the cupboard, and I reckon half of them have got undiagnosed something-or-other." },
  { speaker: "Priya", text: "I'm noting that's your view of it. Does her brother see the children?" },
  { speaker: "Adam", text: "Yeah, he's good with them. He's all right, he's not the problem." },
  { speaker: "Priya", text: "Tell me about the children." },
  { speaker: "Adam", text: "Sasha's nine. She's got cerebral palsy. She can walk a bit, around the house, but anything more than that she's in the chair. She needs everything ground floor, she can't do stairs at all really. The house has been done up for her, they put a ramp in and turned the downstairs into a wet room, we got a grant for it, the council one." },
  { speaker: "Priya", text: "A Disabled Facilities Grant." },
  { speaker: "Adam", text: "That's the one. And then Reuben's six. He's on the list for an autism assessment. He's been on it about a year. Nothing's come back yet, so we don't know officially, but anybody who's spent an hour with him would tell you." },
  { speaker: "Priya", text: "So Reuben is awaiting assessment and there's no diagnosis at this stage. I'll record it that way, because that's where it actually stands. Now, what are the arrangements for the children?" },
  { speaker: "Adam", text: "There's an order. From last year, we went to court over it. It says three days and two nights a week with me, worked round my shifts, because I'm a signaller on the railway so I'm on a rota, days and nights." },
  { speaker: "Priya", text: "And is that working?" },
  { speaker: "Adam", text: "No. Not really. She'll give me six days in a row, back to back, and then I'll get nothing for a fortnight. And she does it deliberately, she'll book them in with me the day before I start four nights, so I've had them from half five in the morning, because Sasha's up at half five every day without fail, and then I'm going straight onto nights. I'm not safe doing that. I'm on the railway." },
  { speaker: "Priya", text: "Right. I need to explain the framework here, and then you'll see why I'm not going to charge in. When a court looks at children, it does what is best for the children. Not what you want, not what she wants. The children's welfare comes above everything else. And you both have parental responsibility for them, equally, so I'd remind you that you need to exercise that reasonably and responsibly, whatever she's doing. If the balance is broadly right and the children are happy and looked after, a court is not going to want to interfere." },
  { speaker: "Adam", text: "So there's no point going back?" },
  { speaker: "Priya", text: "I didn't say that. I said the court starts from a high bar for interfering, and the reason I'm telling you that first is so you don't spend money finding it out. What you've described, the pattern being unpredictable and the handovers landing before night shifts, that's a real issue and it's worth putting to them. Have a think and come back to me on whether you want to raise it." },
  { speaker: "Adam", text: "I'll think about it." },
  { speaker: "Priya", text: "Right, money. I've got the full picture on the fact find as we've gone along, so the asset schedule is there and I won't repeat all of it, but let's go through the classes. The house." },
  { speaker: "Adam", text: "It's worth about three hundred and forty. There's a hundred and ninety-six left on the mortgage. It's in both names. She's in it with the kids and I'm at my mum's." },
  { speaker: "Priya", text: "And it's the adapted one." },
  { speaker: "Adam", text: "Yeah, that's the one with the ramp and the wet room." },
  { speaker: "Priya", text: "What do you earn?" },
  { speaker: "Adam", text: "Two thousand one hundred a month, that's what lands in my account after everything. And I've got a pension coming in already from the Army, I did twelve years in the Royal Engineers, and that's eleven fifty a month, every month, been paying since I came out." },
  { speaker: "Priya", text: "So that's in payment already, it's not a pot sitting there." },
  { speaker: "Adam", text: "No, it's money in, every month." },
  { speaker: "Priya", text: "Anything else pension-wise?" },
  { speaker: "Adam", text: "There's the railway one, I've been paying into it about five years, there's maybe eleven thousand in it. Nadia's got a bit from before the kids, a few thousand, I don't know exactly." },
  { speaker: "Priya", text: "And what's she on?" },
  { speaker: "Adam", text: "Well, this is it. She does twelve hours a week at the school office, so that's five hundred and twenty a month, but then there's all the disability money for Sasha, and the carer's allowance, and by the time you add it all up she's on just over three thousand nine hundred a month. More than me. And I'm paying her on top." },
  { speaker: "Priya", text: "How much are you paying her?" },
  { speaker: "Adam", text: "Eight hundred and twenty a month. That's the child maintenance and half the mortgage, together, in one go, straight out of my account." },
  { speaker: "Priya", text: "Is that eight twenty broken down anywhere? Do you know what portion is which?" },
  { speaker: "Adam", text: "No. I worked it out on the calculator on the website and then just rounded it with the mortgage half and that's what I've paid ever since." },
  { speaker: "Priya", text: "All right, I'll record it as the composite figure, because that's what it is and I don't want to guess at the split. Banking. What accounts are there?" },
  { speaker: "Adam", text: "The joint one, there's about fourteen hundred in it, that's the one the bills come out of. And I've got my own account with about six thousand in it, that's from a lump sum when I came out of the Army." },
  { speaker: "Priya", text: "Two things there. One is whether we restrict any borrowing on the joint account so nothing gets drawn down. The other is ring-fencing your sole account. And the reason for both is that once things are moving, you want the position frozen as it is, so nobody can change the picture while we're trying to agree it. Investments, anything?" },
  { speaker: "Adam", text: "There's a thing, an ISA or something, I'd have to look." },
  { speaker: "Priya", text: "We're not going to tackle investments today. I want to do it properly rather than half do it now, so we'll come to that in due course, but I'm noting today that we haven't dealt with it." },
  { speaker: "Adam", text: "Fine." },
  { speaker: "Priya", text: "Now let me tell you what a court actually looks at, because there's a list of factors it goes through when it decides who gets what at the end of a marriage. Length of the marriage is one of them. And this is interesting in your case, because you were married in June 2022 and it was over in February 2025. That's a short marriage. But you were together and living together from 2011, without a break, and that changes how it's looked at." },
  { speaker: "Adam", text: "So which one counts?" },
  { speaker: "Priya", text: "Both get looked at, and the fact that they pull in different directions is the point. But I'll tell you what really drives this case, and it isn't the dates. It's Sasha. Her needs are the thing that everything else has to bend around, and that will be the single most important feature of this case by a distance." },
  { speaker: "Adam", text: "Because of the house being done up." },
  { speaker: "Priya", text: "Partly. That house has had money and work put into it specifically so that she can live in it. And you also need somewhere she can stay, properly, not on a sofa at your mum's. So we've got a situation where the equity has to stretch to two homes, and both of them have to work for a child who can't manage stairs. That is a hard problem and I'm not going to pretend to you today that I know the answer to it." },
  { speaker: "Adam", text: "So what happens? Is it fifty-fifty? Because everyone tells me it's fifty-fifty, you split it down the middle." },
  { speaker: "Priya", text: "That is not the law and I'd rather you heard that from me now than believed it for six months. There's no rule that says half. What there is, is a list of factors, and needs sit at the top of it when there are children involved. It may well end up that you both need a similar amount, because the children have to be comfortable in both homes, and that is a likely shape here. But that's me telling you the likely direction, not a promise, and the figures have to come first." },
  { speaker: "Adam", text: "Okay. That's not what I'd been told." },
  { speaker: "Priya", text: "No. Right. Stop paying the mortgage." },
  { speaker: "Adam", text: "Stop paying it?" },
  { speaker: "Priya", text: "Stop paying it. We'll write to the other side this week and tell them." },
  { speaker: "Adam", text: "...Right. Okay. If you say so." },
  { speaker: "Priya", text: "Two more things and they're both important, and then costs. You haven't got a will, have you?" },
  { speaker: "Adam", text: "No." },
  { speaker: "Priya", text: "You need one, and you need to do it now, not in six months. I'll tell you exactly why in a minute, but let me do the other one first because they sit together. Power of attorney. Have you got one of those?" },
  { speaker: "Adam", text: "No. What is it?" },
  { speaker: "Priya", text: "It's a document where you appoint somebody to make decisions for you if you ever can't make them yourself. And here's why I'm raising it with you specifically. You work nights on the railway and you're driving home shattered. If something happened to you tomorrow, and you couldn't make decisions, the person who'd be dealing with all of it is Nadia, because you're still married to her. That's the position, today, unless you put something in place." },
  { speaker: "Adam", text: "I hadn't thought about that at all." },
  { speaker: "Priya", text: "Most people haven't. So I'd want you to sort both of those out, and quickly." },
  { speaker: "Adam", text: "Can you do them?" },
  { speaker: "Priya", text: "Not me personally, we've got a wills and probate team. Do you want me to send it over to them?" },
  { speaker: "Adam", text: "Yeah, do that. Refer me over." },
  { speaker: "Priya", text: "I'll do it today and they'll be in touch. Now, the house is in both names, and there's a question about how it's held, whether you two hold it in a way where it automatically passes to the survivor, or in defined shares. You can change that. There are advantages and disadvantages both ways and I'll go through those with you properly when we've got the wills conversation going, because they interact." },
  { speaker: "Adam", text: "I think that got done. When I first saw someone, before you, at the other firm, I think they did that. Or they said they'd do it." },
  { speaker: "Priya", text: "You're not sure." },
  { speaker: "Adam", text: "No, I'm not sure. I'd have to check." },
  { speaker: "Priya", text: "Then I'm not going to record it as done. We'll check it against the title. Now, two other things I want to cover because they're on the file. There's a category of court order called a non-molestation order, which stops somebody doing certain things to you, and another one called an occupation order, which deals with who lives in a property. Let me explain how they work, because people hear the names and don't know what they mean." },
  { speaker: "Adam", text: "Go on." },
  { speaker: "Priya", text: "A non-molestation order is about behaviour, it prohibits somebody from doing specified things. An occupation order is about the home, it can regulate who occupies it or parts of it. Either can be applied for in two ways. You can apply without notice, meaning the other person doesn't know until it's made, which courts only do where the circumstances justify it, and then there's a return date where they come back and put their side. Or you apply on notice, they know from the start, and both sides are heard." },
  { speaker: "Adam", text: "Would I be able to get one?" },
  { speaker: "Priya", text: "I'm not advising you on that today. I've explained what they are because you should know, and if it becomes relevant we'd look at it properly and on the facts. I'm not going anywhere near that on what I've got in front of me today." },
  { speaker: "Adam", text: "Fair enough." },
  { speaker: "Priya", text: "The other thing. You told Ellis on the phone there'd been something with the police." },
  { speaker: "Adam", text: "Yeah. In February. There was a row on the doorstep at handover, she wouldn't let me have Reuben's bag, it got shouty, and next thing I know I've got a phone call asking me to come in. I went in voluntarily, they interviewed me, harassment they said. And then in April I got a letter saying no further action. Nothing's happened since." },
  { speaker: "Priya", text: "So you attended voluntarily, you were interviewed under caution, and it was closed with no further action in April." },
  { speaker: "Adam", text: "Yeah. And she made that up, that's the thing, she did it because we were in the middle of the court stuff with the kids." },
  { speaker: "Priya", text: "I'm going to record what happened and what you say about it, and I'm going to keep those two separate, because they are separate. Costs. Broadly, for the sort of work we've talked about, here's the shape of what it would cost. If you instruct me, I'll put that in writing properly with figures." },
  { speaker: "Adam", text: "Please." },
  { speaker: "Priya", text: "There's a discount because of your service, we do that for forces and former forces, and it'll show on every bill. It doesn't come off anything we pay out to third parties on your behalf, so court fees and so on stay at full whack. Now, funding. There's public funding, which for most of this you won't qualify for. There's insurance you take out after the event, and there's insurance you might already have, which is the one worth checking, because a lot of home insurance policies have legal expenses cover bolted on and people don't know it's there." },
  { speaker: "Adam", text: "I've got home insurance. I've no idea what's on it." },
  { speaker: "Priya", text: "Go and look at the policy documents before you do anything else, because if it's on there it changes the picture." },
  { speaker: "Adam", text: "I'll dig it out this weekend." },
  { speaker: "Priya", text: "Right, let's agree who's doing what. You: check the home insurance for legal expenses cover. Stop the payment into the joint account and pay Nadia direct instead. And send me the child arrangements order, the actual sealed one from last year." },
  { speaker: "Adam", text: "I've got that somewhere, yeah. And I'll send you the screenshot of the maintenance calculator, the one I used to work out the figure." },
  { speaker: "Priya", text: "Do, that's useful. Ellis, from our side: write to the other side about the mortgage, refer Adam to wills and probate, and get a copy of the title so we can see how the house is held." },
  { speaker: "Ellis", text: "Will do. I'll get the letter out this week." },
  { speaker: "Priya", text: "Anything else, Adam?" },
  { speaker: "Adam", text: "No, I think that's... that's a lot clearer than it was. Thanks." },
  { speaker: "Priya", text: "I'll write to you with all of this. Speak soon." },
];

function buildUtterances(turns: Turn[]) {
  const wordWeights = turns.map((t) => Math.max(1, t.text.trim().split(/\s+/).length));
  const totalWeight = wordWeights.reduce((a, b) => a + b, 0);
  // Stretch compressed dialogue across the authoritative 156-minute duration.
  // Leave ~8% headroom at the end so the last utterance does not sit on the wire.
  const usableMs = Math.floor(DURATION_MS * 0.92);
  const pauseBudget = Math.floor(usableMs * 0.35);
  const speechBudget = usableMs - pauseBudget;
  const pausePerGap = turns.length > 1 ? Math.floor(pauseBudget / (turns.length - 1)) : 0;

  let cursor = 18_000; // brief remote-meeting settle-in
  return turns.map((turn, i) => {
    const speechMs = Math.max(
      1_800,
      Math.round((wordWeights[i] / totalWeight) * speechBudget),
    );
    const start = cursor;
    const end = start + speechMs;
    cursor = end + (i < turns.length - 1 ? pausePerGap : 0);
    return {
      speaker: turn.speaker,
      text: turn.text,
      start,
      end,
      confidence: 0.92,
    };
  });
}

function buildTranscriptContent(sessionDate: Date, utterances: ReturnType<typeof buildUtterances>): string {
  const dateLabel = sessionDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const body = utterances
    .map((u) => `[${u.speaker}]: ${u.text}`)
    .join("\n\n");
  return `Attendance Note — Reeve v Reeve (Financial Remedy)
Client: Adam Reeve
Matter Reference: ${MATTER_REFERENCE}
Date: ${dateLabel}
Fee Earner: Priya Raval (Partner, Solicitor)
Also in attendance: Ellis Warner (Paralegal)
Duration: ${DURATION_MINUTES} minutes (${UNITS} units)
Practice Area: Family — Divorce / Financial Remedy
Location: Remote, via Teams

---

${body}`;
}

function buildAttendanceNote(sessionDate: Date): string {
  const dateLabel = sessionDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `**ATTENDANCE NOTE**

**File Ref:** ${MATTER_REFERENCE}  
**Advisor:** Priya Raval, Partner, Solicitor

**Client Name:** Adam Reeve  
**Date:** ${dateLabel}

**Time Spent (Units):** ${UNITS}  
**Duration:** ${DURATION_MINUTES} minutes

**MATTERS DISCUSSED**

Client consent to audio recording obtained. Also in attendance: Ellis Warner, Paralegal.

**1. PRELIMINARY MATTERS, REGULATORY POSITION AND VULNERABILITY**

   **What was discussed:**
   I confirmed my status as a solicitor and partner of the firm, with overall responsibility for my own work and peer review by colleagues. I explained that I am regulated by the Solicitors Regulation Authority and that the complaints route includes the Legal Ombudsman, as set out in the terms of business. The client confirmed that he had signed the terms of business and the privacy / data protection documentation, and that he had no questions on those. I outlined the structure of the meeting: instructions and fact-find; explanation of the legal position; options; and wills and lasting powers of attorney.

   On vulnerability, the client stated that he did not consider himself vulnerable ("I'm knackered, but I'm not vulnerable. I'm all right."). I agreed with that assessment on what I had seen so far. I confirmed that I would nonetheless work to the firm's vulnerable persons policy, and that the client could ask for a different level of support at any time, including privately.

   **Advice given:**
   I advised the client of my regulatory status, the peer-review arrangement, the SRA / Legal Ombudsman protections, and the availability of the vulnerable persons policy route. Specifically:
   - Terms of business and privacy documentation were confirmed as signed and understood.
   - The vulnerable persons policy would be applied in any event, with an open route to revisit support.

   Reasoning behind advice and decisions:
   I applied the firm's vulnerable persons policy as a matter of course, having regard to the client's self-assessment and my own agreement with that assessment, while keeping the route to revisit support open.

   **Client's instructions and response:**
   The client confirmed understanding. He did not raise questions on the terms or regulatory position.

**2. RELATIONSHIP HISTORY AND DIVORCE STATUS**

   **What was discussed:**
   The parties met in 2011, began cohabiting that autumn, and remained together without a break until separation. They married in June 2022 and separated in February 2025. Marriage duration is approximately 2 years 8 months. Relationship duration (from cohabitation) is approximately 13 years 4 months. That presents as a short marriage within a long relationship; both spans are relevant and pull in different directions.
   - The wife issued divorce proceedings in September 2025. A conditional order has been granted. No final order has been made.
   - Both parties are British citizens, born in the UK. No further advice arose on jurisdiction or nationality.
   - The client stated that the marriage is over and that he wants it finished so that children arrangements can be sorted properly.
   - On the wife's family, the client reported estrangement of her mother and aunt, with continuing contact between her brother and the children. The client also expressed views about family members' health and medication. Those views were noted as his account only and were not treated as established fact.

   **Advice given:**
   I advised the client that a conditional order without a final order is a common position while finances are being resolved, and that both British nationality and UK birth meant no further advice was required on that point. I recorded the client's position that the relationship is over, without characterising that as confirmation of the statutory irretrievable breakdown test.

   Reasoning behind advice and decisions:
   I advised on the conditional / final order position having regard to the ordinary course of financial remedy proceedings, and on nationality having confirmed both parties were British citizens born in the UK.

   **Client's instructions and response:**
   The client confirmed the chronology and his wish for the matter to be concluded.

**3. CHILDREN, ARRANGEMENTS AND WELFARE FRAMEWORK**

   **What was discussed:**
   There are two children. Sasha (9) has cerebral palsy. She is ambulant for short distances around the home but otherwise uses a wheelchair and cannot manage stairs. The former matrimonial home has been adapted under a Disabled Facilities Grant (ramp and downstairs wet room). Reuben (6) has been awaiting an autism assessment for approximately one year. There is no diagnosis at this stage.
   - An existing child arrangements order from 2025 provides for three days and two nights per week with the client, worked around his railway signaller rota.
   - The client described the order as not operating as intended: periods of six consecutive days followed by a fortnight with no contact, and handovers landing immediately before night shifts, with Sasha routinely awake from 05:30. He raised a safety concern given his railway role. He characterised the pattern as deliberate on the wife's part; I recorded that as his account and did not find obstruction as fact.
   - Both parents hold parental responsibility equally.

   **Advice given:**
   I advised the client that the court's paramount consideration is the children's welfare, not either parent's preference, and that parental responsibility must be exercised reasonably and responsibly. Specifically:
   - The court starts from a high bar before interfering where the overall balance is broadly right and the children are well looked after.
   - The unpredictability of the pattern and handovers before night shifts are real issues worth putting to the other side, if he chooses to raise them.
   - He should consider and revert on whether he wants the arrangements issue taken further at this stage.

   Reasoning behind advice and decisions:
   I explained the welfare threshold first so that the client would not spend money discovering it. I recorded Reuben as awaiting assessment with no diagnosis, and declined to treat the client's informal view as clinical fact.

   **Client's instructions and response:**
   The client said he would think about whether to raise the arrangements issue and revert.

**4. FINANCIAL POSITION AND ASSET CLASSES**

   **What was discussed:**
   Former matrimonial home: approximately £340,000; mortgage approximately £196,000; equity approximately £144,000; held in joint names; occupied by the wife and children; adapted for Sasha under a Disabled Facilities Grant.
   - Client net employment income: £2,100 per month. Service pension in payment from 12 years in the Royal Engineers: £1,150 per month. Total client monthly income: £3,250.
   - Wife: £520 per month from 12 hours per week at a school office, plus disability-related benefits for Sasha and carer's allowance; total just over £3,900 per month. Her monthly income exceeds the client's by approximately £650.
   - Client pays the wife £820 per month as a composite of child maintenance and a mortgage contribution, not broken down. I recorded the composite figure and did not split it.
   - Joint account approximately £1,400 (bills). Client sole account approximately £6,000 (Army lump sum). Railway pension accrued approximately £11,000. Wife's pension a few thousand, unquantified.
   - Investments (possible ISA or similar) were expressly not dealt with on this occasion and will be addressed in due course.

   **Advice given:**
   I advised the client on two immediate banking steps: restricting borrowing on the joint account, and ring-fencing his sole account. Specifically:
   - The £820 payment would be recorded as a composite figure only.
   - The service pension would be treated as a pension in payment (income), distinct from accrued pension provision such as the railway pot.
   - Investments would not be half-dealt with today.

   Reasoning behind advice and decisions:
   I advised restricting joint borrowing and ring-fencing the sole account so that the financial position is frozen while negotiations proceed and nobody can change the picture unilaterally. I declined to invent a split of the £820 or to treat the pension in payment as a transferrable pot.

   **Client's instructions and response:**
   The client accepted the banking advice and confirmed he would stop paying into the joint account and pay Nadia direct instead (see Next Steps).

**5. FINANCIAL REMEDY FRAMEWORK, HOUSING NEED AND THE FIFTY-FIFTY PREMISE**

   **What was discussed:**
   I explained that a court deciding financial remedy looks at a list of statutory factors, of which marriage length is one. This case presents a short marriage within a long seamless pre-marital cohabitation. Sasha's needs are the factor of magnetic importance. The adapted home and the need for two suitable homes (including somewhere the client can properly accommodate Sasha, not a sofa at his mother's) mean the equity must stretch to two homes suitable for a child who cannot manage stairs. I expressly reserved position: I do not claim to know the answer today.
   - The client stated a confident understanding that assets are split fifty-fifty. I corrected that.

   **Advice given:**
   I advised the client that there is no rule that assets are divided equally. Specifically:
   - Needs sit at the top of the statutory factors where there are children.
   - A likely shape is that both parties may need a similar amount so the children are comfortable in both homes; that is a direction of travel, not a promise, and figures come first.
   - No housing outcome (retain, sell or transfer of the adapted home) was advised or decided.

   Reasoning behind advice and decisions:
   I corrected the fifty-fifty premise having regard to the statutory factors and the primacy of needs where children are involved, and I reserved position on the two-homes problem given Sasha's adaptation requirements and the limited equity.

   **Client's instructions and response:**
   The client acknowledged that the advice differed from what he had previously been told.

**6. MORTGAGE CONTRIBUTIONS**

   **What was discussed:**
   I advised the client to stop paying the mortgage. I confirmed that we would write to the other side this week to notify them. The client acquiesced ("If you say so"). That was treated as acquiescence in advice, not as a freestanding client instruction originating the step.

   **Advice given:**
   I advised the client to stop paying the mortgage, and that this firm would write to the other side this week.

   Reasoning behind advice and decisions:
<!-- REASONING_GAP: MORTGAGE CONTRIBUTIONS: stop paying the mortgage -->

   **Client's instructions and response:**
   The client accepted the advice. No independent instruction to stop the mortgage was taken beyond that acquiescence.

**7. WILLS, LASTING POWER OF ATTORNEY AND SEVERANCE**

   **What was discussed:**
   The client has no will and no lasting power of attorney. I advised that he needs a will now, not in six months, and said I would explain why shortly; that explanation was not returned to. I explained lasting power of attorney as a document appointing someone to make decisions if he cannot, and gave a full reason: if something happened tomorrow, Nadia would still deal with everything because they remain married, unless something is put in place. The client instructed me to refer him to the wills and probate team.
   - Severance of the joint tenancy was explained (survivor vs defined shares). The client thought a previous firm may have done this but was unsure. I recorded the position as unconfirmed. Title will be checked. I did not record severance as done or not done.

   **Advice given:**
   I advised the client to put a will and lasting power of attorney in place promptly, and to check how the former matrimonial home is held on the title. Specifically:
   - Referral to the wills and probate team today.
   - Severance explained; title check before any conclusion.

   Reasoning behind advice and decisions:
   On lasting power of attorney, I advised prompt action because the client works nights on the railway and, while still married, Nadia would be the person dealing with decisions if he could not make them himself.
<!-- REASONING_GAP: WILLS, LASTING POWER OF ATTORNEY AND SEVERANCE: need for a will now, not in six months -->

   **Client's instructions and response:**
   The client instructed me to refer him to the wills and probate team. He will await contact from that team.

**8. NON-MOLESTATION AND OCCUPATION ORDERS**

   **What was discussed:**
   I explained what a non-molestation order is (behavioural prohibitions) and what an occupation order is (regulation of occupation of a home). I explained the without-notice and on-notice routes, including that without-notice orders are made only where circumstances justify them, with a return date. The client asked whether he would be able to obtain one.

   **Advice given:**
   I explained the nature of both orders and the application routes. I expressly declined to advise on whether the client could or should apply on the facts available today. No application was contemplated, advised, or recorded as existing.

   Reasoning behind advice and decisions:
   I confined myself to explanation so the client understood the terminology, and declined to advise on any application because the facts before me today did not justify taking a position.

   **Client's instructions and response:**
   The client accepted that no advice on applying was being given today. No instruction to apply was taken.

**9. POLICE MATTER**

   **What was discussed:**
   Separately from the injunction explanation, the client reported a February 2026 doorstep argument at handover concerning Reuben's bag. He attended the police station voluntarily, was interviewed under caution on suspicion of harassment, and received a letter in April 2026 confirming no further action. The matter ran approximately two months to closure. The client disputes the allegation and asserts it was fabricated in the context of children proceedings. I recorded what happened and what the client says about it as separate matters. I did not find that he was arrested, charged, or that the allegation was established or fabricated.

   **Advice given:**
   I advised the client that the factual chronology and his dispute of the allegation would be recorded separately, and kept separate.

   Reasoning behind advice and decisions:
   I kept the record of what happened and the client's account of motive distinct, so that neither is laundered into the other and so that this matter is not connected to the injunction explanation given earlier in the meeting.

   **Client's instructions and response:**
   The client confirmed the chronology and his position on the allegation.

**10. COSTS AND FUNDING**

   **What was discussed:**
   I outlined the shape of costs for the work discussed and confirmed that written figures would follow on instruction. A service discount for forces / former forces applies and will appear on every bill; it does not reduce disbursements (including court fees). Funding options canvassed: public funding (unlikely for most of this work), after-the-event insurance, and before-the-event legal expenses cover that may already sit on a home insurance policy.

   **Advice given:**
   I advised the client to check his home insurance policy documents for legal expenses cover before doing anything else, because if cover is present it changes the funding picture.

   Reasoning behind advice and decisions:
   I prioritised the before-the-event check because many home policies include legal expenses cover that clients overlook, and because that check can change the funding analysis before further steps are taken.

   **Client's instructions and response:**
   The client confirmed he has home insurance and will dig out the policy documents this weekend.

**11. NEXT STEPS**

   Solicitor / paralegal to action:
   1. Write to the other side regarding the mortgage position.
      Due: this week
   2. Refer the client to the wills and probate team.
      Due: today
   3. Obtain a copy of the title to check how the former matrimonial home is held.
      Due: This was not discussed on this occasion

   Client to action:
   1. Check home insurance for legal expenses cover.
      Due: this weekend
   2. Stop the payment into the joint account and pay Nadia direct instead.
      Due: This was not discussed on this occasion
   3. Send the sealed child arrangements order from last year.
      Due: This was not discussed on this occasion
   4. Send the screenshot of the maintenance calculator used to work out the £820 figure.
      Due: This was not discussed on this occasion

   Next appointment: This was not discussed on this occasion

Time Engaged: ${DURATION_MINUTES} minutes

This attendance note is subject to legal professional privilege.

Prepared by: Priya Raval, Partner, Solicitor
Date Prepared: ${dateLabel}`;
}

export type SeedReeveResult = {
  success: boolean;
  message: string;
  caseId?: string;
  userId?: string;
  userEmail?: string;
};

/**
 * Seed the Reeve sample matter for a user (by id or email).
 * Does not archive existing matters.
 */
export async function seedReeveSampleMatter(opts: {
  userId?: string;
  userEmail?: string;
}): Promise<SeedReeveResult> {
  try {
    let userId = opts.userId;
    let userEmail = opts.userEmail;
    let firmId: string | null = null;

    if (!userId && userEmail) {
      const [row] = await db
        .select({ id: users.id, email: users.email, firmId: users.firmId })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${userEmail})`)
        .limit(1);
      if (!row) {
        return {
          success: false,
          message: `No user found for email ${userEmail}`,
        };
      }
      userId = row.id;
      userEmail = row.email ?? userEmail;
      firmId = row.firmId;
    } else if (userId) {
      const [row] = await db
        .select({ id: users.id, email: users.email, firmId: users.firmId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!row) {
        return { success: false, message: `No user found for id ${userId}` };
      }
      userEmail = row.email ?? undefined;
      firmId = row.firmId;
    } else {
      return { success: false, message: "Provide userId or userEmail" };
    }

    // Idempotent: archive any prior Reeve sample for this user before re-seeding.
    await db
      .update(cases)
      .set({ archived: true })
      .where(
        sql`${cases.createdBy} = ${userId} AND ${cases.matterReference} = ${MATTER_REFERENCE} AND ${cases.archived} = false`,
      );

    // Meeting date from fixture: Thursday 16 July 2026, remote Teams conference.
    const sessionDate = new Date(2026, 6, 16, 10, 0, 0, 0);
    const utterances = buildUtterances(TURNS);
    const transcriptContent = buildTranscriptContent(sessionDate, utterances);
    const attendanceNoteContent = buildAttendanceNote(sessionDate);

    const [newCase] = await db
      .insert(cases)
      .values({
        title: "Reeve v Reeve — Financial Remedy Conference",
        clientName: "Adam Reeve",
        matterReference: MATTER_REFERENCE,
        createdBy: userId!,
        assignedToUserId: userId!,
        firmId: firmId ?? undefined,
        status: "review_required",
        priority: "high",
        sourceType: "audio",
        practiceArea: "family_divorce_financial",
        riskLevel: "medium",
        conflictCheckCompleted: true,
        conflictCheckNote:
          "Other party Nadia Reeve not a current or former client. No conflict identified.",
        deadline: new Date(2026, 6, 23, 17, 0, 0, 0),
        createdAt: sessionDate,
      })
      .returning();

    const [session] = await db
      .insert(meetingSessions)
      .values({
        caseId: newCase.id,
        recordingType: "full_meeting",
        sessionTitle:
          "Initial Conference — Financial Remedy, Children, Wills & LPA (Teams)",
        startedAt: sessionDate,
        durationSeconds: DURATION_SECONDS,
        status: "completed",
        createdBy: userId!,
      })
      .returning();

    const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(audioRecordings).values({
      caseId: newCase.id,
      meetingSessionId: session.id,
      duration: DURATION_SECONDS,
      recordedAt: sessionDate,
      expiresAt: sessionExpiry,
      deletedAt: sessionExpiry,
      mimeType: "audio/webm",
    });

    await db.insert(consentLogs).values({
      caseId: newCase.id,
      audioRecordingId: null,
      solicitorId: userId!,
      consentGiven: true,
      consentTimestamp: new Date(sessionDate.getTime() + 45 * 1000),
      disclaimerScriptVersion: "v2.1",
      disclaimerWordingText:
        "I am recording this meeting to produce an accurate attendance note and to protect the integrity of your file. The recording is held confidentially within your case file and is deleted after seven days. Only I or a member of my immediate team will have access. Do you consent to this recording?",
      consentModality: "verbal_recorded",
      lawfulBasis: "consent",
    });

    const [transcript] = await db
      .insert(transcripts)
      .values({
        caseId: newCase.id,
        meetingSessionId: session.id,
        content: transcriptContent,
        utterances,
        speakerCount: 3,
        createdAt: new Date(sessionDate.getTime() + DURATION_MS + 8 * 60 * 1000),
      })
      .returning();

    await db.insert(documents).values({
      caseId: newCase.id,
      meetingSessionId: session.id,
      type: "attendance_note",
      content: attendanceNoteContent,
      version: 1,
      versionType: "ai_generated",
      createdBy: userId!,
      status: "draft",
      reasoningGapsIdentified: 2,
      reasoningGapsFilled: 0,
      reasoningGapsReviewed: false,
      createdAt: new Date(sessionDate.getTime() + DURATION_MS + 12 * 60 * 1000),
    });

    const actionItemsList = [
      {
        description: "Write to the other side regarding the mortgage position",
        assignee: "Ellis Warner (Paralegal)",
        priority: "high",
        dueDate: new Date(2026, 6, 18, 17, 0, 0, 0),
      },
      {
        description: "Refer Adam Reeve to the wills and probate team",
        assignee: "Ellis Warner (Paralegal)",
        priority: "high",
        dueDate: sessionDate,
      },
      {
        description:
          "Obtain title to former matrimonial home to check how it is held (joint tenancy / tenancy in common)",
        assignee: "Ellis Warner (Paralegal)",
        priority: "high",
        dueDate: new Date(2026, 6, 23, 17, 0, 0, 0),
      },
      {
        description: "Check home insurance policy for legal expenses (BTE) cover",
        assignee: "Client",
        priority: "high",
        dueDate: new Date(2026, 6, 19, 17, 0, 0, 0),
      },
      {
        description:
          "Stop payment into joint account; pay Nadia Reeve direct instead",
        assignee: "Client",
        priority: "high",
        dueDate: new Date(2026, 6, 18, 17, 0, 0, 0),
      },
      {
        description: "Send sealed child arrangements order from 2025",
        assignee: "Client",
        priority: "normal",
        dueDate: new Date(2026, 6, 23, 17, 0, 0, 0),
      },
      {
        description:
          "Send screenshot of CMS calculator used for the £820 composite figure",
        assignee: "Client",
        priority: "normal",
        dueDate: new Date(2026, 6, 23, 17, 0, 0, 0),
      },
    ];

    for (const item of actionItemsList) {
      await db.insert(actionItems).values({
        caseId: newCase.id,
        transcriptId: transcript.id,
        description: item.description,
        assignee: item.assignee,
        priority: item.priority,
        dueDate: item.dueDate,
        status: "approved",
        completed: false,
        createdAt: new Date(sessionDate.getTime() + DURATION_MS + 14 * 60 * 1000),
      });
    }

    const auditEvents = [
      {
        eventType: "case_created",
        timestamp: sessionDate,
        metadata: {
          practiceArea: "family_divorce_financial",
          matterReference: MATTER_REFERENCE,
          sampleMatter: "reeve_family_conference",
        },
        severity: "info" as const,
      },
      {
        eventType: "recording_started",
        timestamp: sessionDate,
        metadata: {
          sessionTitle:
            "Initial Conference — Financial Remedy, Children, Wills & LPA (Teams)",
          recordingType: "full_meeting",
          location: "remote_teams",
        },
        severity: "info" as const,
      },
      {
        eventType: "consent_given",
        timestamp: new Date(sessionDate.getTime() + 45 * 1000),
        metadata: {
          consentModality: "verbal_recorded",
          lawfulBasis: "consent",
          disclaimerVersion: "v2.1",
        },
        severity: "info" as const,
      },
      {
        eventType: "transcript_generated",
        timestamp: new Date(sessionDate.getTime() + DURATION_MS + 8 * 60 * 1000),
        metadata: {
          speakerCount: 3,
          durationSeconds: DURATION_SECONDS,
          speakers: ["Priya", "Adam", "Ellis"],
        },
        transcriptId: transcript.id,
        severity: "info" as const,
      },
      {
        eventType: "document_generated",
        timestamp: new Date(sessionDate.getTime() + DURATION_MS + 12 * 60 * 1000),
        metadata: {
          documentType: "attendance_note",
          versionType: "ai_generated",
          version: 1,
          reasoningGapsIdentified: 2,
        },
        severity: "info" as const,
      },
    ];

    for (const evt of auditEvents) {
      await db.insert(auditTrail).values({
        eventType: evt.eventType,
        userId: userId!,
        caseId: newCase.id,
        timestamp: evt.timestamp,
        severity: evt.severity,
        metadata: evt.metadata,
        transcriptId: (evt as { transcriptId?: string }).transcriptId || null,
      });
    }

    return {
      success: true,
      message: `Reeve sample matter seeded (${MATTER_REFERENCE}) for ${userEmail ?? userId}`,
      caseId: newCase.id,
      userId,
      userEmail,
    };
  } catch (error: any) {
    console.error("[SEED-REEVE] Error:", error);
    return { success: false, message: error.message ?? String(error) };
  }
}
