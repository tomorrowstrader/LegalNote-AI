import { db } from "../db";
import { cases, meetingSessions, audioRecordings, consentLogs, transcripts, documents, auditTrail, actionItems, preMeetingBriefings, timeEntries, undertakings, quickNotes, securityIncidents, calendarEvents, shareLinks, meetingImports, scheduledMeetings, preConsentEmails, clioMatterLinks, recordingSessions, amlMonitoringNotes, amlDecisionRecords, externalDocumentRefs, conflictChecks, supervisionSignoffs, clientVersionTracking, documentComments } from "../../shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysAgoAt(n: number, hour: number, minute: number): Date {
  const d = daysAgo(n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function deleteAllUserCaseData(userId: string) {
  const userCases = await db.select({ id: cases.id }).from(cases).where(eq(cases.createdBy, userId));
  if (userCases.length === 0) return;
  const ids = userCases.map(c => c.id);
  const idList = ids.map(id => `'${id}'`).join(',');
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT id FROM cases WHERE id IN (${sql.raw(idList)}))
      LOOP
        UPDATE cases SET client_care_letter_id = NULL WHERE id = r.id;
        UPDATE documents SET transcript_snapshot_id = NULL WHERE case_id = r.id;
        DELETE FROM document_comments WHERE document_id IN (SELECT id FROM documents WHERE case_id = r.id);
        DELETE FROM client_version_tracking WHERE document_id IN (SELECT id FROM documents WHERE case_id = r.id);
        DELETE FROM supervision_signoffs WHERE case_id = r.id;
        DELETE FROM conflict_checks WHERE case_id = r.id;
        DELETE FROM external_document_refs WHERE case_id = r.id;
        DELETE FROM aml_decision_records WHERE case_id = r.id;
        DELETE FROM aml_monitoring_notes WHERE case_id = r.id;
        DELETE FROM recording_sessions WHERE case_id = r.id;
        DELETE FROM clio_matter_links WHERE case_id = r.id;
        DELETE FROM pre_consent_emails WHERE case_id = r.id;
        DELETE FROM scheduled_meetings WHERE case_id = r.id;
        DELETE FROM meeting_imports WHERE case_id = r.id;
        DELETE FROM share_links WHERE case_id = r.id;
        DELETE FROM calendar_events WHERE case_id = r.id;
        DELETE FROM security_incidents WHERE affected_case_id = r.id;
        DELETE FROM quick_notes WHERE case_id = r.id;
        DELETE FROM time_entries WHERE case_id = r.id;
        DELETE FROM undertakings WHERE case_id = r.id;
        DELETE FROM documents WHERE case_id = r.id;
        DELETE FROM action_items WHERE case_id = r.id;
        DELETE FROM audit_trail WHERE case_id = r.id;
        DELETE FROM transcripts WHERE case_id = r.id;
        DELETE FROM consent_logs WHERE case_id = r.id;
        DELETE FROM pre_meeting_briefings WHERE case_id = r.id;
        DELETE FROM audio_recordings WHERE case_id = r.id;
        DELETE FROM meeting_sessions WHERE case_id = r.id;
        DELETE FROM cases WHERE id = r.id;
      END LOOP;
    END $$;
  `);
}

// ─── Matter 1: Family — Private Children (COLP Showcase) ────────────────────

async function seedMatter1Webb(userId: string) {
  const sessionDate = daysAgoAt(7, 10, 0);
  const deadlineDate = daysFromNow(7);

  const [newCase] = await db.insert(cases).values({
    title: "Re W (Contact) — Webb v Webb",
    clientName: "Marcus Webb",
    matterReference: "HART_FAM/2024/0391",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "family_children_arrangements",
    riskLevel: "high",
    conflictCheckCompleted: true,
    conflictCheckNote: "Opposing party Diane Webb not a current or former client. No connection to opposing solicitors. Conflict check clear.",
    deadline: deadlineDate,
    litigationHold: true,
    litigationHoldAppliedAt: daysAgo(7),
    litigationHoldReason: "Active fact-finding hearing listed in 7 days. All session records, transcripts and attendance notes to be preserved pending court disclosure assessment.",
    supervisorName: "James Hartwell",
    aiProcessingMetadata: {
      amlTriggers: [
        {
          label: "Undisclosed business account",
          category: "asset_concealment",
          excerpt: "There is a business account I opened eighteen months ago that I have not included in the Form E. It receives payments from a contact in Dubai."
        },
        {
          label: "Unexplained overseas payments",
          category: "source_of_funds",
          excerpt: "The payments come in quarterly. I have not documented the source formally. My accountant knows about it but it is not on any declaration."
        }
      ]
    },
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Attendance — Fact-Finding Preparation & Scott Schedule Review",
    startedAt: sessionDate,
    durationSeconds: 3240,
    status: "completed",
    createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    duration: 3240,
    recordedAt: sessionDate,
    expiresAt: sessionExpiry,
    deletedAt: sessionExpiry,
    mimeType: "audio/webm",
  });

  await db.insert(consentLogs).values({
    caseId: newCase.id,
    audioRecordingId: null,
    solicitorId: userId,
    consentGiven: true,
    consentTimestamp: new Date(sessionDate.getTime() + 52 * 1000),
    disclaimerScriptVersion: "v2.1",
    disclaimerWordingText: "I am recording this meeting to produce an accurate attendance note and to protect the integrity of your file. The recording is held confidentially within your case file and is deleted after seven days. Only I or a member of my immediate team will have access. Do you consent to this recording?",
    consentModality: "verbal_recorded",
    lawfulBasis: "consent",
  });

  const transcriptContent = `Attendance Note — Re W (Contact) — Webb v Webb
Client: Marcus Webb
Matter Reference: HART_FAM/2024/0391
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Sarah Okafor
Duration: Approximately 54 minutes
Practice Area: Family — Private Children Arrangements

---

SOLICITOR: Good morning Mr Webb. Before we start I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is deleted after seven days and stays within your file. Are you content?

CLIENT: Yes, that is fine.

SOLICITOR: Thank you. So we have the fact-finding hearing listed in seven days. I want to go through each of the eight allegations on the Scott Schedule and take your full instructions. I will also need certain documents from you before we can finalise your position. Let us start with Allegation One — financial control.

CLIENT: Right. So Diane says I controlled all the finances and prevented her from spending. That is simply not true. There was one conversation — early 2023, probably February — when I asked her to be careful with spending because the business had a difficult quarter. I am self-employed, income is not consistent. I sent her a WhatsApp about it. That WhatsApp needs to be found because it shows the context. It was not a prohibition. It was a practical conversation.

SOLICITOR: What was the approximate wording of that message as you recall it?

CLIENT: Something like — we need to be sensible this month, cash flow is tight, can we hold off on any big purchases. That was it. She went on three holidays in the eight weeks before that. I have her bank statements that show that. She had full access to her own account throughout.

SOLICITOR: Good. I will need bank statements for both of you from January to June 2023. And the WhatsApp — can you locate that today?

CLIENT: I will look tonight. I think it is still on my phone.

SOLICITOR: Allegation Two — social isolation. She says you monitored her social contacts and prevented her from seeing friends.

CLIENT: There was one occasion where I asked who she was spending time with. New people had come into her life around the time she started going out more — late 2022. I asked because I was concerned, not because I wanted to control her. She has always had an active social life. She travelled without me multiple times.

SOLICITOR: Did you ever attempt to prevent her from seeing any specific person?

CLIENT: No. Never.

SOLICITOR: Allegation Three — location monitoring. She says you required her to share her location at all times.

CLIENT: We both set up location sharing when our eldest was born. Nine years ago. It was her suggestion. She sent me the setup message. I still have it. That message is probably the most important document in this entire case. It shows she initiated it. We both had reciprocal access throughout the marriage. The one time I raised it was about six weeks before we separated — she had turned off location sharing and was not where she had said she would be. I called to check she was safe. That is the incident she is referring to.

SOLICITOR: Where was she?

CLIENT: She said she was at her sister's. She was not. She gave me a different explanation later. I did not pursue it.

SOLICITOR: Allegation Four — demeaning her in front of the children.

CLIENT: Categorically denied. I have never spoken to Diane in a degrading way in front of the children. Her own sister attended family gatherings with us regularly until about four months before we separated. She would be a witness to how we interacted. Logan's class teacher also — both of us attended parents' evenings together without any incident.

SOLICITOR: Allegation Five — the physical incident in January. She says you pushed her in the hallway.

CLIENT: I placed my hands on her shoulders during an argument. She was very distressed. I was trying to de-escalate. I deny pushing her. I deny causing any injury. There were no witnesses — the children were at my parents. The same evening I sent a WhatsApp apologising for the argument. Not for pushing — because I did not push her — but for the argument getting to that point. That message will be presented as an admission. It is not one.

SOLICITOR: I need that WhatsApp immediately. Do not delete anything. We need to manage how that is presented carefully.

CLIENT: I have it. I can send it to you tonight.

SOLICITOR: Allegation Six — verbal intimidation in October. She says you raised your voice and made threats in front of Ethan.

CLIENT: The argument happened. I raised my voice. Ethan was present and I regret that deeply. But I made no threats. I have never threatened Diane. My strategy should be — do not deny the argument, acknowledge it, contextualise it as an isolated failure of composure. I think full denial of that incident would damage my credibility on the others.

SOLICITOR: I agree with that approach entirely. Allegations Seven and Eight?

CLIENT: Seven is about the school run — she says I would interrogate the children when I picked them up. I speak to my children about their day. That is parenting, not interrogation. Eight is about the financial disclosure. She says I have hidden assets. I have assets that are not on the Form E. I need to tell you about that.

SOLICITOR: Go on.

CLIENT: There is a business account I opened eighteen months ago that I have not included in the Form E. It receives payments from a contact in Dubai. The payments come in quarterly. I have not documented the source formally. My accountant knows about it but it is not on any declaration. I know how that sounds. I need advice.

SOLICITOR: Mr Webb, I have to be direct with you. This is a serious disclosure issue. Non-disclosure in financial proceedings is a contempt risk. But beyond that, the nature of these payments — undisclosed account, overseas source, quarterly, undocumented — I need to consider whether there are additional obligations on this firm. I am not in a position to advise you further on the financial disclosure aspect of this matter today. I am going to need to take this away and speak to our MLRO before our next conversation. I want to be clear — I am not saying anything improper has occurred, but I have professional obligations I need to discharge. Do you understand?

CLIENT: I understand. I just need to know what to do.

SOLICITOR: I will be in touch within 48 hours. In the meantime, the court proceedings continue. I will prepare your position on Allegations One through Seven. Do not discuss the account with anyone — not Diane, not your accountant further, not anyone. Can you commit to that?

CLIENT: Yes.

SOLICITOR: On the contact arrangements — you currently have supervised contact at the Family Connections Centre in Lewisham, two hours alternate Saturdays. The contact workers have observed the children as settled and happy. I will be requesting the contemporaneous notes from the contact centre before the hearing. There was an incident at the last handover — Logan arrived withdrawn. You observed Diane speaking to him immediately before handing him over?

CLIENT: Yes. He recovered within about fifteen minutes but it was noticeable to the contact worker. I asked the manager to ensure a note was made at the time.

SOLICITOR: Good. I will write to the contact centre today to formally request those notes. I will also write to opposing solicitors regarding the handover incident. Before I close — bail conditions. You mentioned last time that the CPS discontinued. Have you received written confirmation?

CLIENT: I have a verbal discharge from the custody sergeant. No written confirmation yet.

SOLICITOR: That is not sufficient. I will write today to both the custody sergeant and the CPS requesting written confirmation. Do not treat the conditions as discharged until you have that in writing.

CLIENT: Understood.

SOLICITOR: Summary of what I need from you by close of business today: the WhatsApp from February 2023, the WhatsApp from January this year, the location sharing setup message from nine years ago, and bank statements for both of you January to June 2023. I will be in touch about the other matter within 48 hours.

CLIENT: Thank you.

---

ACTION ITEMS

1. Client to provide WhatsApp from February 2023 re spending conversation — by COB today
2. Client to provide WhatsApp from January re hallway incident — by COB today  
3. Client to provide location sharing setup message — by COB today
4. Client to provide bank statements Jan-Jun 2023 for both parties — by COB today
5. Solicitor to write to Family Connections Centre requesting contemporaneous contact notes
6. Solicitor to write to opposing solicitors re Logan handover incident
7. Solicitor to write to custody sergeant and CPS requesting written bail discharge confirmation
8. Solicitor to refer undisclosed account matter to MLRO within 48 hours — URGENT
9. Solicitor to prepare position statements on Allegations 1-7 for fact-finding hearing`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Mr Webb. Before we start I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is deleted after seven days and stays within your file. Are you content?", start: 52000, end: 72000 },
    { speaker: "SPEAKER_2", text: "Yes, that is fine.", start: 73000, end: 76000 },
    { speaker: "SPEAKER_1", text: "Thank you. So we have the fact-finding hearing listed in seven days. I want to go through each of the eight allegations on the Scott Schedule and take your full instructions. I will also need certain documents from you before we can finalise your position. Let us start with Allegation One — financial control.", start: 77000, end: 98000 },
    { speaker: "SPEAKER_2", text: "Right. So Diane says I controlled all the finances and prevented her from spending. That is simply not true. There was one conversation — early 2023, probably February — when I asked her to be careful with spending because the business had a difficult quarter. I am self-employed, income is not consistent. I sent her a WhatsApp about it. That WhatsApp needs to be found because it shows the context. It was not a prohibition. It was a practical conversation.", start: 99000, end: 130000 },
    { speaker: "SPEAKER_1", text: "What was the approximate wording of that message as you recall it?", start: 131000, end: 136000 },
    { speaker: "SPEAKER_2", text: "Something like — we need to be sensible this month, cash flow is tight, can we hold off on any big purchases. That was it. She went on three holidays in the eight weeks before that. I have her bank statements that show that. She had full access to her own account throughout.", start: 137000, end: 158000 },
    { speaker: "SPEAKER_1", text: "Good. I will need bank statements for both of you from January to June 2023. And the WhatsApp — can you locate that today?", start: 159000, end: 167000 },
    { speaker: "SPEAKER_2", text: "I will look tonight. I think it is still on my phone.", start: 168000, end: 173000 },
    { speaker: "SPEAKER_1", text: "Allegation Two — social isolation. She says you monitored her social contacts and prevented her from seeing friends.", start: 174000, end: 182000 },
    { speaker: "SPEAKER_2", text: "There was one occasion where I asked who she was spending time with. New people had come into her life around the time she started going out more — late 2022. I asked because I was concerned, not because I wanted to control her. She has always had an active social life. She travelled without me multiple times.", start: 183000, end: 205000 },
    { speaker: "SPEAKER_1", text: "Did you ever attempt to prevent her from seeing any specific person?", start: 206000, end: 211000 },
    { speaker: "SPEAKER_2", text: "No. Never.", start: 212000, end: 214000 },
    { speaker: "SPEAKER_1", text: "Allegation Three — location monitoring. She says you required her to share her location at all times.", start: 215000, end: 223000 },
    { speaker: "SPEAKER_2", text: "We both set up location sharing when our eldest was born. Nine years ago. It was her suggestion. She sent me the setup message. I still have it. That message is probably the most important document in this entire case. It shows she initiated it. We both had reciprocal access throughout the marriage. The one time I raised it was about six weeks before we separated — she had turned off location sharing and was not where she had said she would be. I called to check she was safe. That is the incident she is referring to.", start: 224000, end: 267000 },
    { speaker: "SPEAKER_1", text: "Where was she?", start: 268000, end: 270000 },
    { speaker: "SPEAKER_2", text: "She said she was at her sister's. She was not. She gave me a different explanation later. I did not pursue it.", start: 271000, end: 281000 },
    { speaker: "SPEAKER_1", text: "Allegation Four — demeaning her in front of the children.", start: 282000, end: 287000 },
    { speaker: "SPEAKER_2", text: "Categorically denied. I have never spoken to Diane in a degrading way in front of the children. Her own sister attended family gatherings with us regularly until about four months before we separated. She would be a witness to how we interacted. Logan's class teacher also — both of us attended parents' evenings together without any incident.", start: 288000, end: 314000 },
    { speaker: "SPEAKER_1", text: "Allegation Five — the physical incident in January. She says you pushed her in the hallway.", start: 315000, end: 323000 },
    { speaker: "SPEAKER_2", text: "I placed my hands on her shoulders during an argument. She was very distressed. I was trying to de-escalate. I deny pushing her. I deny causing any injury. There were no witnesses — the children were at my parents. The same evening I sent a WhatsApp apologising for the argument. Not for pushing — because I did not push her — but for the argument getting to that point. That message will be presented as an admission. It is not one.", start: 324000, end: 362000 },
    { speaker: "SPEAKER_1", text: "I need that WhatsApp immediately. Do not delete anything. We need to manage how that is presented carefully.", start: 363000, end: 371000 },
    { speaker: "SPEAKER_2", text: "I have it. I can send it to you tonight.", start: 372000, end: 377000 },
    { speaker: "SPEAKER_1", text: "Allegation Six — verbal intimidation in October. She says you raised your voice and made threats in front of Ethan.", start: 378000, end: 386000 },
    { speaker: "SPEAKER_2", text: "The argument happened. I raised my voice. Ethan was present and I regret that deeply. But I made no threats. I have never threatened Diane. My strategy should be — do not deny the argument, acknowledge it, contextualise it as an isolated failure of composure. I think full denial of that incident would damage my credibility on the others.", start: 387000, end: 420000 },
    { speaker: "SPEAKER_1", text: "I agree with that approach entirely. Allegations Seven and Eight?", start: 421000, end: 426000 },
    { speaker: "SPEAKER_2", text: "Seven is about the school run — she says I would interrogate the children when I picked them up. I speak to my children about their day. That is parenting, not interrogation. Eight is about the financial disclosure. She says I have hidden assets. I have assets that are not on the Form E. I need to tell you about that.", start: 427000, end: 460000 },
    { speaker: "SPEAKER_1", text: "Go on.", start: 461000, end: 463000 },
    { speaker: "SPEAKER_2", text: "There is a business account I opened eighteen months ago that I have not included in the Form E. It receives payments from a contact in Dubai. The payments come in quarterly. I have not documented the source formally. My accountant knows about it but it is not on any declaration. I know how that sounds. I need advice.", start: 464000, end: 500000 },
    { speaker: "SPEAKER_1", text: "Mr Webb, I have to be direct with you. This is a serious disclosure issue. Non-disclosure in financial proceedings is a contempt risk. But beyond that, the nature of these payments — undisclosed account, overseas source, quarterly, undocumented — I need to consider whether there are additional obligations on this firm. I am not in a position to advise you further on the financial disclosure aspect of this matter today. I am going to need to take this away and speak to our MLRO before our next conversation. I want to be clear — I am not saying anything improper has occurred, but I have professional obligations I need to discharge. Do you understand?", start: 501000, end: 556000 },
    { speaker: "SPEAKER_2", text: "I understand. I just need to know what to do.", start: 557000, end: 562000 },
    { speaker: "SPEAKER_1", text: "I will be in touch within 48 hours. In the meantime, the court proceedings continue. I will prepare your position on Allegations One through Seven. Do not discuss the account with anyone — not Diane, not your accountant further, not anyone. Can you commit to that?", start: 563000, end: 585000 },
    { speaker: "SPEAKER_2", text: "Yes.", start: 586000, end: 587000 },
    { speaker: "SPEAKER_1", text: "On the contact arrangements — you currently have supervised contact at the Family Connections Centre in Lewisham, two hours alternate Saturdays. The contact workers have observed the children as settled and happy. I will be requesting the contemporaneous notes from the contact centre before the hearing. There was an incident at the last handover — Logan arrived withdrawn. You observed Diane speaking to him immediately before handing him over?", start: 588000, end: 625000 },
    { speaker: "SPEAKER_2", text: "Yes. He recovered within about fifteen minutes but it was noticeable to the contact worker. I asked the manager to ensure a note was made at the time.", start: 626000, end: 641000 },
    { speaker: "SPEAKER_1", text: "Good. I will write to the contact centre today to formally request those notes. I will also write to opposing solicitors regarding the handover incident. Before I close — bail conditions. You mentioned last time that the CPS discontinued. Have you received written confirmation?", start: 642000, end: 663000 },
    { speaker: "SPEAKER_2", text: "I have a verbal discharge from the custody sergeant. No written confirmation yet.", start: 664000, end: 671000 },
    { speaker: "SPEAKER_1", text: "That is not sufficient. I will write today to both the custody sergeant and the CPS requesting written confirmation. Do not treat the conditions as discharged until you have that in writing.", start: 672000, end: 685000 },
    { speaker: "SPEAKER_2", text: "Understood.", start: 686000, end: 688000 },
    { speaker: "SPEAKER_1", text: "Summary of what I need from you by close of business today: the WhatsApp from February 2023, the WhatsApp from January this year, the location sharing setup message from nine years ago, and bank statements for both of you January to June 2023. I will be in touch about the other matter within 48 hours.", start: 689000, end: 715000 },
    { speaker: "SPEAKER_2", text: "Thank you.", start: 716000, end: 718000 },
  ];

  const redactions = [
    {
      id: "rdx-webb-1",
      start: 464000,
      end: 500000,
      reasonType: "redaction_third_party",
      reasonNotes: "Third party financial contact — identity protected pending MLRO referral",
      redactedBy: userId,
      timestamp: new Date(sessionDate.getTime() + 52 * 60 * 1000).toISOString(),
      status: "committed",
      selectedText: null,
    }
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    content: transcriptContent,
    utterances: utterances,
    speakerCount: 2,
    redactions: redactions,
    createdAt: new Date(sessionDate.getTime() + 58 * 60 * 1000),
  }).returning();

  const attendanceNoteContent = `# ATTENDANCE NOTE

**Client:** Marcus Webb  
**Matter:** Re W (Contact) — Webb v Webb  
**Reference:** HART_FAM/2024/0391  
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}  
**Fee Earner:** Sarah Okafor  
**Present:** Sarah Okafor (Solicitor), Marcus Webb (Client)  
**Duration:** 54 minutes  
**Practice Area:** Family — Private Children Arrangements  
**Hearing:** Fact-Finding — listed in 7 days  

---

## NATURE OF ATTENDANCE

Client attended in person for initial attendance to review Scott Schedule of allegations (8 allegations) filed by Diane Webb. Instructions taken on all allegations. Litigation hold in place — all file records to be preserved.

**MLRO referral required — see confidential matter note.**

---

## CONFLICT CHECK

Completed. Diane Webb not a current or former client of this firm. No connection to opposing solicitors. No conflict identified.

---

## INSTRUCTIONS TAKEN ON ALLEGATIONS

**Allegation 1 — Financial Control:** Denied. Client sent one WhatsApp in February 2023 requesting spending restraint during a cash-flow pressure period. Three overseas trips by opposing party in preceding eight weeks. WhatsApp required urgently. Bank and card statements January to June 2023 required for both parties.

**Allegation 2 — Social Isolation:** Denied. Client asked about new social contacts on one occasion. Opposing party maintained active social life throughout marriage including overseas travel. No attempt to prevent contact with any specific person.

**Allegation 3 — Location Monitoring:** Denied as coercive. Mutual location-sharing arrangement established at opposing party's suggestion when eldest child born nine years ago. Both parties had reciprocal access throughout marriage. Location sharing setup message sent by opposing party to client — potentially the most significant document in these proceedings. Must be located and provided urgently. One incident six weeks pre-separation where client called opposing party after noting location sharing had been disabled.

**Allegation 4 — Demeaning Conduct:** Categorically denied. Character witnesses identified: client's sister-in-law (regular family contact); eldest child's class teacher (both parents attended parents' evenings without incident).

**Allegation 5 — Physical Incident, January:** Physical contact accepted — client placed hands on opposing party's shoulders during argument. Client characterises this as attempt to de-escalate. Denies push. Denies injury caused. No witnesses present. WhatsApp sent same evening apologising for argument (not for physical contact) — required urgently. Strategy: do not conflate apology for argument with admission of assault.

**Allegation 6 — Verbal Intimidation, October:** Argument accepted. Voice raised. Child present — client expresses regret. Threats categorically denied. Agreed strategy: acknowledge incident, contextualise as isolated failure of composure, do not deny. Partial acknowledgement strengthens credibility on full denials.

**Allegation 7 — School Run Interrogation:** Denied. Client characterises this as normal parental conversation about children's day.

**Allegation 8 — Financial Disclosure:** [REDACTED — THIRD PARTY INFORMATION] MLRO referral required. Further instructions on this allegation suspended pending MLRO advice.

---

## CONTACT ARRANGEMENTS

Current: supervised contact, Family Connections Centre, Lewisham. Two hours, alternate Saturdays. Contact workers observe children as settled and happy throughout sessions. Contemporaneous contact centre notes to be formally requested before hearing.

Handover incident at most recent session: Logan Webb (9) arrived withdrawn, recovered within fifteen minutes. Client observed opposing party speaking to Logan immediately prior to handover. Contact worker present. Letter to opposing solicitors to be sent today. Contact centre manager asked to ensure contemporaneous note made.

---

## BAIL CONDITIONS

Client reports verbal discharge confirmation from custody sergeant following CPS discontinuance. No written confirmation received. Written confirmation required from custody sergeant and CPS. Client advised not to treat conditions as discharged until written confirmation received. Letters to be sent today.

---

## ACTION ITEMS

1. Client to provide WhatsApp from February 2023 (spending conversation) — COB today
2. Client to provide WhatsApp from January (hallway incident) — COB today
3. Client to provide location sharing setup message — COB today
4. Client to provide bank statements Jan-Jun 2023 (both parties) — COB today
5. Solicitor: write to Family Connections Centre requesting contact session notes
6. Solicitor: write to opposing solicitors re Logan handover incident
7. Solicitor: write to custody sergeant and CPS re written bail discharge
8. Solicitor: MLRO referral within 48 hours — URGENT — confidential
9. Solicitor: prepare position statements Allegations 1-7 for fact-finding hearing`;

  await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    type: "attendance_note",
    content: attendanceNoteContent,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "draft",
    createdAt: new Date(sessionDate.getTime() + 62 * 60 * 1000),
  });

  const actionItemsList = [
    { description: "Obtain WhatsApp from February 2023 — spending conversation", assignee: "Client", priority: "high", dueDate: daysAgo(6) },
    { description: "Obtain WhatsApp from January — hallway incident apology", assignee: "Client", priority: "high", dueDate: daysAgo(6) },
    { description: "Obtain location sharing setup message from nine years ago", assignee: "Client", priority: "high", dueDate: daysAgo(6) },
    { description: "Obtain bank statements January to June 2023 for both parties", assignee: "Client", priority: "high", dueDate: daysAgo(6) },
    { description: "Write to Family Connections Centre requesting contemporaneous contact session notes", assignee: "Solicitor", priority: "high", dueDate: daysAgo(6) },
    { description: "Write to opposing solicitors regarding Logan handover incident", assignee: "Solicitor", priority: "high", dueDate: daysAgo(6) },
    { description: "Write to custody sergeant and CPS requesting written bail discharge confirmation", assignee: "Solicitor", priority: "high", dueDate: daysAgo(6) },
    { description: "MLRO referral — undisclosed financial account — CONFIDENTIAL — within 48 hours", assignee: "Solicitor", priority: "high", dueDate: daysAgo(5), completed: true, completedAt: daysAgo(5) },
    { description: "Prepare position statements on Allegations 1-7 for fact-finding hearing", assignee: "Solicitor", priority: "high", dueDate: daysFromNow(3) },
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
      completed: item.completed || false,
      completedAt: item.completedAt || null,
      createdAt: new Date(sessionDate.getTime() + 65 * 60 * 1000),
    });
  }

  const auditEvents = [
    { eventType: "case_created", timestamp: daysAgo(7), metadata: { practiceArea: "family_children_arrangements", matterReference: "HART_FAM/2024/0391" }, severity: "info" as const },
    { eventType: "case_updated", timestamp: daysAgo(7), metadata: { field: "litigationHold", value: true, reason: "Active fact-finding hearing", appliedBy: "James Hartwell (COLP)" }, severity: "warning" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Attendance — Fact-Finding Preparation", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 52 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent", disclaimerVersion: "v2.1", audioSecondsAtConsent: 52 }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 58 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 3240 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "transcript_redacted", timestamp: new Date(sessionDate.getTime() + 61 * 60 * 1000), metadata: { reasonType: "redaction_third_party", status: "committed", redactionId: "rdx-webb-1" }, transcriptId: transcript.id, severity: "warning" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 62 * 60 * 1000), metadata: { documentType: "attendance_note", versionType: "ai_generated", version: 1 }, severity: "info" as const },
    { eventType: "aml_flag_raised", timestamp: new Date(sessionDate.getTime() + 63 * 60 * 1000), metadata: { flagCount: 2, categories: ["asset_concealment", "source_of_funds"], referredToMLRO: true }, severity: "critical" as const },
    { eventType: "case_updated", timestamp: new Date(sessionDate.getTime() + 64 * 60 * 1000), metadata: { field: "supervisorReview", note: "MLRO referral actioned within 48 hours. Matter under enhanced supervision pending outcome. File to be reviewed by COLP before any further client contact.", reviewedBy: "James Hartwell (COLP)" }, severity: "warning" as const },
  ];

  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({
      eventType: evt.eventType,
      userId,
      caseId: newCase.id,
      timestamp: evt.timestamp,
      severity: evt.severity,
      metadata: evt.metadata,
      transcriptId: (evt as any).transcriptId || null,
    });
  }
}

// ─── Matter 2: M&A — Nursery Sector Acquisition (Kestrel Care Group) ──────────────

async function seedMatter2Kestrel(userId: string) {
  const sessionDate = daysAgoAt(14, 9, 30);

  const [newCase] = await db.insert(cases).values({
    title: "Kestrel Care Group — Acquisition of Brightfield Nurseries Ltd",
    clientName: "Kestrel Care Group (Rohan Mehta / Priya Kapoor)",
    matterReference: "HART_COM/2024/0847",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "commercial_property",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Brightfield Nurseries Ltd and its directors not current or former clients. Vendor solicitors Keane & Partners — no current matters. No conflict identified.",
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Share Purchase Agreement Review & Due Diligence Strategy",
    startedAt: sessionDate,
    durationSeconds: 3060,
    status: "completed",
    createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    duration: 3060,
    recordedAt: sessionDate,
    expiresAt: sessionExpiry,
    deletedAt: sessionExpiry,
    mimeType: "audio/webm",
  });

  await db.insert(consentLogs).values({
    caseId: newCase.id,
    audioRecordingId: null,
    solicitorId: userId,
    consentGiven: true,
    consentTimestamp: new Date(sessionDate.getTime() + 38 * 1000),
    disclaimerScriptVersion: "v2.1",
    disclaimerWordingText: "I am recording this meeting to produce an accurate attendance note. The recording is held confidentially within your file and deleted after seven days. Do you consent?",
    consentModality: "verbal_recorded",
    lawfulBasis: "consent",
  });

  const transcriptContent = `Attendance Note — Kestrel Care Group — Acquisition of Brightfield Nurseries Ltd
Client: Kestrel Care Group (Rohan Mehta, CEO; Priya Kapoor, General Counsel)
Matter Reference: HART_COM/2024/0847
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: James Hartwell
Duration: Approximately 51 minutes

---

SOLICITOR: Good morning Rohan, Priya. Before we begin I need to confirm you are both happy to be recorded for note-taking purposes. The recording is deleted after seven days and is confidential to this file. Are you both content?

ROHAN MEHTA: Yes, absolutely.

PRIYA KAPOOR: That is fine.

SOLICITOR: Thank you. So we have the heads of terms signed last week. The proposed consideration is twelve point four million — a combination of cash on completion and an eighteen-month earn-out tied to occupancy rates across all six settings. I want to work through the key issues before we begin the due diligence process. Priya, you have reviewed the draft SPA — where do you want to start?

PRIYA KAPOOR: The warranties are the main concern. The vendor is offering a standard package but given that four of the six settings are Ofsted-rated Outstanding, I want much stronger protection on the regulatory standing. If any of those ratings deteriorate between exchange and completion we need the right to walk or to reprice.

SOLICITOR: That is eminently sensible. We will push for a specific warranty on regulatory compliance status at the date of exchange and a condition precedent that no material Ofsted action — improvement notice, enforcement notice or downgrade — has been received in the period between exchange and completion. What is the gap we are looking at?

PRIYA KAPOOR: The vendor wants a six-week exchange to completion. We think that is too tight for the Ofsted check cycle. We would prefer twelve weeks minimum.

SOLICITOR: I agree. Six weeks is inadequate for this type of acquisition. Twelve weeks is reasonable and I will push for that in our response to the SPA. Rohan — from a commercial perspective, what are the key value drivers you are protecting?

ROHAN MEHTA: The Outstanding ratings are everything. We are paying a significant premium over asset value precisely because of the regulatory standing. Priya is right — if those ratings move we have overpaid materially. The other driver is the management team. The target has a regional operations manager who has been there eleven years. If she leaves in the earn-out period we are exposed. I want a retention clause on her specifically.

SOLICITOR: We can include a key person clause in the SPA tied to the earn-out. If she departs before the end of the earn-out period and the occupancy targets are not met, we build in a mechanism to adjust the earn-out payment downward. Is there a separate employment agreement in place with her?

ROHAN MEHTA: There is but I have not seen it. It should be in the data room. Priya, can you check today?

PRIYA KAPOOR: I will look this afternoon. I have not seen it in the index but it may be filed under a different reference.

SOLICITOR: The data room — what is the current state of disclosure?

PRIYA KAPOOR: Incomplete. We have the last three years' audited accounts for the group entity and the individual settings. We have the property titles — four freehold, two leasehold. We do not yet have the Ofsted inspection reports for three of the six settings, the staff contracts, the parent contracts, or the regulatory correspondence file. We pushed back on this last week but the vendor's solicitors have been slow.

SOLICITOR: I am going to write to Keane and Partners today with a formal data room deficiency schedule. We cannot begin substantive due diligence without the Ofsted reports and the regulatory correspondence. In the meantime I can begin reviewing the property titles. On the two leasehold settings — do you know the unexpired terms?

PRIYA KAPOOR: One has approximately fourteen years remaining. The other is a periodic tenancy — we think month to month. That one concerns us significantly.

SOLICITOR: The periodic tenancy is a serious problem. The vendor should not have presented this in the heads of terms without flagging it. A month-to-month tenancy for a nursery setting with planning and registration tied to that address is a material risk. If the landlord serves notice we lose the setting entirely. We need either a new lease negotiated as a condition precedent or a significant price adjustment to reflect the risk. Which setting is it?

PRIYA KAPOOR: The Stratford setting. It is one of the two Outstanding-rated ones.

SOLICITOR: That changes the calculus significantly. An Outstanding-rated setting on a periodic tenancy is an unacceptable risk at this price. I will flag this as a red-line issue in our response. Either we get a minimum ten-year lease on the Stratford setting as a condition precedent to exchange, or we reduce the consideration to reflect the exposure.

ROHAN MEHTA: Agreed. We would not proceed on the current terms for Stratford.

SOLICITOR: On the earn-out mechanism itself — eighteen months tied to occupancy. What is the base occupancy assumed in the earn-out model?

ROHAN MEHTA: Eighty-two percent average across the six settings. The vendor is projecting eighty-seven percent by month twelve. We think those projections are aggressive given that two settings are in catchment areas where new competitors have opened.

SOLICITOR: I would want to see the catchment analysis underlying those projections. If the vendor cannot support eighty-seven percent with credible data we should push the earn-out trigger down — say seventy-eight percent — and cap the earn-out payment accordingly. The current structure gives the vendor a full earn-out even in scenarios where performance deteriorates from current levels.

PRIYA KAPOOR: That is exactly the concern. We want the earn-out to be genuinely contingent, not a deferred payment dressed up as performance-linked.

SOLICITOR: Understood. I will redraft the earn-out mechanics with a tiered structure — partial payments at seventy-five, eighty, and eighty-five percent occupancy respectively, with the full earn-out only payable if eighty-seven percent is sustained for at least three consecutive months. Is that the sort of structure you have in mind?

ROHAN MEHTA: Yes. That gives us much better protection.

SOLICITOR: One more item before we close — the NDA. The existing confidentiality agreement was signed at heads of terms stage. Does it cover the data room materials adequately?

PRIYA KAPOOR: It covers the financial information but I am not sure it extends to the regulatory correspondence and Ofsted reports. If those become public before completion it could damage relationships with the Ofsted regional team.

SOLICITOR: I will review the NDA today and advise whether it needs to be extended. In the meantime, treat all data room materials as confidential regardless of what the agreement says. I will close with a summary. Data room deficiency schedule to vendor today. SPA response within ten working days — pushing for twelve-week exchange to completion, condition precedent on Ofsted standing, key person clause, red-line on Stratford tenancy, tiered earn-out structure. NDA review today. I will send you a matter timeline this afternoon.

ROHAN MEHTA: Thank you James, that is exactly what we needed.

PRIYA KAPOOR: Very helpful, thank you.

---

ACTION ITEMS

1. Solicitor to write to Keane & Partners with data room deficiency schedule — today
2. Solicitor to review NDA for data room coverage — today
3. Solicitor to begin review of property titles (four freehold) — this week
4. Solicitor to send matter timeline to clients — today
5. Solicitor to draft SPA response within 10 working days
6. Priya Kapoor to locate regional operations manager employment agreement — today
7. Investigate Stratford setting lease status — urgent (red-line issue)`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Rohan, Priya. Before we begin I need to confirm you are both happy to be recorded for note-taking purposes. The recording is deleted after seven days and is confidential to this file. Are you both content?", start: 38000, end: 56000 },
    { speaker: "SPEAKER_2", text: "Yes, absolutely.", start: 57000, end: 59000 },
    { speaker: "SPEAKER_3", text: "That is fine.", start: 60000, end: 62000 },
    { speaker: "SPEAKER_1", text: "Thank you. So we have the heads of terms signed last week. The proposed consideration is twelve point four million — a combination of cash on completion and an eighteen-month earn-out tied to occupancy rates across all six settings. I want to work through the key issues before we begin the due diligence process. Priya, you have reviewed the draft SPA — where do you want to start?", start: 63000, end: 92000 },
    { speaker: "SPEAKER_3", text: "The warranties are the main concern. The vendor is offering a standard package but given that four of the six settings are Ofsted-rated Outstanding, I want much stronger protection on the regulatory standing. If any of those ratings deteriorate between exchange and completion we need the right to walk or to reprice.", start: 93000, end: 124000 },
    { speaker: "SPEAKER_1", text: "That is eminently sensible. We will push for a specific warranty on regulatory compliance status at the date of exchange and a condition precedent that no material Ofsted action has been received in the period between exchange and completion. What is the gap we are looking at?", start: 125000, end: 150000 },
    { speaker: "SPEAKER_3", text: "The vendor wants a six-week exchange to completion. We think that is too tight for the Ofsted check cycle. We would prefer twelve weeks minimum.", start: 151000, end: 166000 },
    { speaker: "SPEAKER_1", text: "I agree. Six weeks is inadequate for this type of acquisition. Twelve weeks is reasonable and I will push for that in our response to the SPA. Rohan — from a commercial perspective, what are the key value drivers you are protecting?", start: 167000, end: 184000 },
    { speaker: "SPEAKER_2", text: "The Outstanding ratings are everything. We are paying a significant premium over asset value precisely because of the regulatory standing. The other driver is the management team. The target has a regional operations manager who has been there eleven years. If she leaves in the earn-out period we are exposed. I want a retention clause on her specifically.", start: 185000, end: 220000 },
    { speaker: "SPEAKER_1", text: "We can include a key person clause in the SPA tied to the earn-out. Is there a separate employment agreement in place with her?", start: 221000, end: 232000 },
    { speaker: "SPEAKER_2", text: "There is but I have not seen it. It should be in the data room. Priya, can you check today?", start: 233000, end: 244000 },
    { speaker: "SPEAKER_3", text: "I will look this afternoon. I have not seen it in the index but it may be filed under a different reference.", start: 245000, end: 257000 },
    { speaker: "SPEAKER_1", text: "The data room — what is the current state of disclosure?", start: 258000, end: 263000 },
    { speaker: "SPEAKER_3", text: "Incomplete. We have the last three years audited accounts and the property titles. We do not yet have the Ofsted inspection reports for three of the six settings, the staff contracts, the parent contracts, or the regulatory correspondence file.", start: 264000, end: 294000 },
    { speaker: "SPEAKER_1", text: "I am going to write to Keane and Partners today with a formal data room deficiency schedule. On the two leasehold settings — do you know the unexpired terms?", start: 295000, end: 312000 },
    { speaker: "SPEAKER_3", text: "One has approximately fourteen years remaining. The other is a periodic tenancy — we think month to month. That one concerns us significantly.", start: 313000, end: 328000 },
    { speaker: "SPEAKER_1", text: "The periodic tenancy is a serious problem. A month-to-month tenancy for a nursery setting with planning and registration tied to that address is a material risk. Which setting is it?", start: 329000, end: 346000 },
    { speaker: "SPEAKER_3", text: "The Stratford setting. It is one of the two Outstanding-rated ones.", start: 347000, end: 355000 },
    { speaker: "SPEAKER_1", text: "That changes the calculus significantly. An Outstanding-rated setting on a periodic tenancy is an unacceptable risk at this price. I will flag this as a red-line issue. Either we get a minimum ten-year lease on the Stratford setting as a condition precedent to exchange, or we reduce the consideration to reflect the exposure.", start: 356000, end: 385000 },
    { speaker: "SPEAKER_2", text: "Agreed. We would not proceed on the current terms for Stratford.", start: 386000, end: 393000 },
    { speaker: "SPEAKER_1", text: "On the earn-out mechanism — eighteen months tied to occupancy. What is the base occupancy assumed in the earn-out model?", start: 394000, end: 406000 },
    { speaker: "SPEAKER_2", text: "Eighty-two percent average across the six settings. The vendor is projecting eighty-seven percent by month twelve. We think those projections are aggressive given that two settings are in catchment areas where new competitors have opened.", start: 407000, end: 432000 },
    { speaker: "SPEAKER_1", text: "I would want to see the catchment analysis underlying those projections. I will redraft the earn-out mechanics with a tiered structure. Is that the sort of structure you have in mind?", start: 433000, end: 452000 },
    { speaker: "SPEAKER_2", text: "Yes. That gives us much better protection.", start: 453000, end: 458000 },
    { speaker: "SPEAKER_3", text: "That is exactly the concern. We want the earn-out to be genuinely contingent, not a deferred payment dressed up as performance-linked.", start: 459000, end: 474000 },
    { speaker: "SPEAKER_1", text: "Understood. One more item — the NDA. Does it cover the data room materials adequately?", start: 475000, end: 484000 },
    { speaker: "SPEAKER_3", text: "It covers the financial information but I am not sure it extends to the regulatory correspondence and Ofsted reports.", start: 485000, end: 498000 },
    { speaker: "SPEAKER_1", text: "I will review the NDA today. In the meantime treat all data room materials as confidential. I will close with a summary. Data room deficiency schedule to vendor today. SPA response within ten working days. NDA review today. Matter timeline this afternoon.", start: 499000, end: 528000 },
    { speaker: "SPEAKER_2", text: "Thank you James, that is exactly what we needed.", start: 529000, end: 535000 },
    { speaker: "SPEAKER_3", text: "Very helpful, thank you.", start: 536000, end: 539000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    content: transcriptContent,
    utterances: utterances,
    speakerCount: 3,
    redactions: [],
    createdAt: new Date(sessionDate.getTime() + 55 * 60 * 1000),
  }).returning();

  const attendanceNoteContent = `# ATTENDANCE NOTE

**Client:** Kestrel Care Group (Rohan Mehta, CEO; Priya Kapoor, General Counsel)  
**Matter:** Acquisition of Brightfield Nurseries Ltd  
**Reference:** HART_COM/2024/0847  
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}  
**Fee Earner:** James Hartwell  
**Present:** James Hartwell (Partner), Rohan Mehta (CEO, Kestrel Care Group), Priya Kapoor (General Counsel, Kestrel Care Group)  
**Duration:** 51 minutes  

---

## NATURE OF ATTENDANCE

Initial instructions following execution of heads of terms. Proposed consideration £12.4m (cash on completion plus 18-month earn-out tied to occupancy). Six nursery settings — four Ofsted-rated Outstanding.

---

## KEY ISSUES IDENTIFIED

**1. Warranty Package — Regulatory Standing**
Standard warranty package inadequate given Outstanding ratings. Agreed to push for: specific warranty on regulatory compliance status at exchange; condition precedent that no material Ofsted action received between exchange and completion; 12-week minimum exchange-to-completion period (vendor proposing 6 weeks — inadequate).

**2. Key Person Risk — Regional Operations Manager**
11-year employee identified as critical to earn-out performance. Key person clause to be included in SPA tied to earn-out adjustment mechanism. Employment agreement not yet located in data room — Priya Kapoor to check today.

**3. Data Room — Material Deficiencies**
Currently missing: Ofsted inspection reports (3 of 6 settings), staff contracts, parent contracts, regulatory correspondence file. Formal deficiency schedule to be sent to Keane & Partners today.

**4. Stratford Setting — Periodic Tenancy (RED LINE)**
One of two Outstanding-rated settings operates on month-to-month periodic tenancy. This is a material and unacceptable risk at current price. Client confirmed they would not proceed on current terms for Stratford. Red-line position: minimum 10-year lease as condition precedent to exchange, or material price reduction.

**5. Earn-Out Mechanics**
Vendor projecting 87% average occupancy by month 12. Clients consider this aggressive given competitive pressures in two catchment areas. Agreed to restructure earn-out as tiered mechanism (75%, 80%, 85% trigger points) with full earn-out only payable if 87% sustained for minimum 3 consecutive months.

**6. NDA Coverage**
Existing NDA may not extend to Ofsted reports and regulatory correspondence. Review required today.

---

## ACTION ITEMS

1. Solicitor: write to Keane & Partners with data room deficiency schedule — today
2. Solicitor: review NDA coverage — today  
3. Solicitor: begin property title reviews (four freehold settings) — this week
4. Solicitor: send matter timeline to clients — today
5. Solicitor: draft SPA response within 10 working days
6. Priya Kapoor: locate regional operations manager employment agreement — today
7. Solicitor: flag Stratford periodic tenancy as red-line in SPA response`;

  await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    type: "attendance_note",
    content: attendanceNoteContent,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "approved",
    approvedAt: new Date(sessionDate.getTime() + 90 * 60 * 1000),
    createdAt: new Date(sessionDate.getTime() + 58 * 60 * 1000),
  });

  const auditEvents = [
    { eventType: "case_created", timestamp: daysAgo(14), metadata: { practiceArea: "commercial", matterReference: "HART_COM/2024/0847" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Instructions — SPA Review", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 38 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent", disclaimerVersion: "v2.1" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 55 * 60 * 1000), metadata: { speakerCount: 3, durationSeconds: 3060 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 58 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(sessionDate.getTime() + 90 * 60 * 1000), metadata: { approvedBy: "James Hartwell", documentType: "attendance_note" }, severity: "info" as const },
  ];

  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({
      eventType: evt.eventType,
      userId,
      caseId: newCase.id,
      timestamp: evt.timestamp,
      severity: evt.severity,
      metadata: evt.metadata,
      transcriptId: (evt as any).transcriptId || null,
    });
  }
}

// ─── Matter 3: Medical Negligence ───────────────────────────────────────────

async function seedMatter3Osei(userId: string) {
  const sessionDate = daysAgoAt(21, 14, 0);

  const [newCase] = await db.insert(cases).values({
    title: "Osei v Royal Greenwich NHS Trust",
    clientName: "Patricia Osei",
    matterReference: "HART_MED/2024/0156",
    createdBy: userId,
    status: "review_required",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "personal_injury_rta",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Royal Greenwich NHS Trust not a current or former client. No conflicts identified.",
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Consultation — Surgical Negligence Claim",
    startedAt: sessionDate,
    durationSeconds: 2880,
    status: "completed",
    createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    duration: 2880,
    recordedAt: sessionDate,
    expiresAt: sessionExpiry,
    deletedAt: sessionExpiry,
    mimeType: "audio/webm",
  });

  await db.insert(consentLogs).values({
    caseId: newCase.id,
    audioRecordingId: null,
    solicitorId: userId,
    consentGiven: true,
    consentTimestamp: new Date(sessionDate.getTime() + 44 * 1000),
    disclaimerScriptVersion: "v2.1",
    disclaimerWordingText: "I am recording this meeting to produce an accurate attendance note. The recording is held confidentially within your file and deleted after seven days. Do you consent?",
    consentModality: "verbal_recorded",
    lawfulBasis: "consent",
  });

  const transcriptContent = `Attendance Note — Osei v Royal Greenwich NHS Trust
Client: Patricia Osei
Matter Reference: HART_MED/2024/0156
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Claire Donnelly
Duration: Approximately 48 minutes

---

SOLICITOR: Good afternoon Mrs Osei. Before we start I want to confirm you consent to me recording our meeting today to help me produce an accurate note. The recording is confidential to your file and deleted after seven days. Are you happy with that?

CLIENT: Yes, that is fine. I just want to tell someone what happened.

SOLICITOR: And I want to hear it. Take your time. Start from when you first presented at the hospital if you can.

CLIENT: I went to the Queen Elizabeth Hospital in February last year. I had been having pain in my lower abdomen for about three months — my GP had referred me on the two-week pathway. They did an ultrasound and found a fibroid. They said it was significant in size — about seven centimetres. They recommended a myomectomy.

SOLICITOR: That is a surgical procedure to remove fibroids while leaving the uterus intact?

CLIENT: Yes. I am forty-four. I have not had children. I wanted to preserve my options. They said that was the appropriate procedure given my age and that I had specifically said I wanted to preserve fertility.

SOLICITOR: Who did you see in that consultation?

CLIENT: A Mr Adeyemi. He was a consultant gynaecologist. He was very confident. He said the procedure was routine, recovery two to three weeks, back to work within a month. He did not mention any significant risks beyond the standard surgical ones — infection, bleeding. He did not mention conversion.

SOLICITOR: When you say conversion — can you tell me what happened?

CLIENT: During the surgery they converted to a hysterectomy. I woke up and I had had a full hysterectomy. I had not consented to that. I did not know until a nurse told me. Mr Adeyemi came to see me the next morning. He said there had been significant bleeding and conversion was necessary to save my life. He may be right. But I was never given the option to discuss that possibility beforehand. He knew it was a risk. It should have been in my consent form. It was not.

SOLICITOR: Can I ask — how are you doing now? I mean physically and otherwise.

CLIENT: I am managing. Physically the recovery has been difficult — I was off work for nearly four months. I am a secondary school teacher. I lost earnings. But honestly what has been harder is — I cannot have children now. I know at forty-four the chances were lower. But they were not zero. And the decision was taken from me without my knowledge. I feel I was not treated as someone whose choices mattered.

SOLICITOR: I understand. And I want you to know that what you have just described — if accurate — is a serious matter of clinical negligence and consent law. The right of a patient to make an informed decision about their own treatment, including accepting risks that others might not, is fundamental. The question of whether you were adequately counselled on the risk of conversion to hysterectomy, given that you had specifically expressed a wish to preserve fertility, is the heart of this claim.

CLIENT: That is exactly it.

SOLICITOR: I will need your full medical records — GP records going back five years, and the hospital records from the Royal Greenwich Trust including the surgical notes, the consent form, the anaesthetic record, and any post-operative notes. Can I make a request to the Trust on your behalf?

CLIENT: Yes please.

SOLICITOR: We will also need an independent medical expert — a consultant gynaecologist who can review the clinical decision and advise whether the standard of care was met and whether the consent process was adequate. This is a clinical negligence claim and liability will need to be established through expert evidence.

CLIENT: How long does this take?

SOLICITOR: Honestly — medical negligence claims take time. The records request typically takes four to six weeks. Finding and instructing an appropriate expert takes another four to six weeks. We are looking at six to twelve months before we have a full letter of claim ready to send. I want to be honest with you about that.

CLIENT: I understand. I just want it on record. I want them to know that what they did to me mattered.

SOLICITOR: It will be on record. Before I close — limitation. The incident was February of last year. You have three years from the date of knowledge — which is typically the date of the procedure or the date you became aware of the negligence — to issue proceedings. We have time but we should not delay unnecessarily. I will open a file today.

CLIENT: Thank you. I feel better having spoken to someone.

---

ACTION ITEMS

1. Solicitor to submit Subject Access Request to Royal Greenwich NHS Trust for full medical records
2. Solicitor to obtain GP records (5 years)
3. Solicitor to identify and instruct independent expert consultant gynaecologist
4. Solicitor to note limitation date — February limitation deadline
5. Solicitor to confirm funding arrangements (CFA/CCFA) at next appointment`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good afternoon Mrs Osei. Before we start I want to confirm you consent to me recording our meeting today to help me produce an accurate note. The recording is confidential to your file and deleted after seven days. Are you happy with that?", start: 44000, end: 62000 },
    { speaker: "SPEAKER_2", text: "Yes, that is fine. I just want to tell someone what happened.", start: 63000, end: 69000 },
    { speaker: "SPEAKER_1", text: "And I want to hear it. Take your time. Start from when you first presented at the hospital if you can.", start: 70000, end: 79000 },
    { speaker: "SPEAKER_2", text: "I went to the Queen Elizabeth Hospital in February last year. I had been having pain in my lower abdomen for about three months — my GP had referred me on the two-week pathway. They did an ultrasound and found a fibroid. They said it was significant in size — about seven centimetres. They recommended a myomectomy.", start: 80000, end: 118000 },
    { speaker: "SPEAKER_1", text: "That is a surgical procedure to remove fibroids while leaving the uterus intact?", start: 119000, end: 126000 },
    { speaker: "SPEAKER_2", text: "Yes. I am forty-four. I have not had children. I wanted to preserve my options. They said that was the appropriate procedure given my age and that I had specifically said I wanted to preserve fertility.", start: 127000, end: 150000 },
    { speaker: "SPEAKER_1", text: "Who did you see in that consultation?", start: 151000, end: 154000 },
    { speaker: "SPEAKER_2", text: "A Mr Adeyemi. He was a consultant gynaecologist. He was very confident. He said the procedure was routine, recovery two to three weeks, back to work within a month. He did not mention any significant risks beyond the standard surgical ones — infection, bleeding. He did not mention conversion.", start: 155000, end: 186000 },
    { speaker: "SPEAKER_1", text: "When you say conversion — can you tell me what happened?", start: 187000, end: 192000 },
    { speaker: "SPEAKER_2", text: "During the surgery they converted to a hysterectomy. I woke up and I had had a full hysterectomy. I had not consented to that. I did not know until a nurse told me. Mr Adeyemi came to see me the next morning. He said there had been significant bleeding and conversion was necessary to save my life. He may be right. But I was never given the option to discuss that possibility beforehand. He knew it was a risk. It should have been in my consent form. It was not.", start: 193000, end: 248000 },
    { speaker: "SPEAKER_1", text: "Can I ask — how are you doing now? I mean physically and otherwise.", start: 249000, end: 256000 },
    { speaker: "SPEAKER_2", text: "I am managing. Physically the recovery has been difficult — I was off work for nearly four months. I am a secondary school teacher. I lost earnings. But honestly what has been harder is — I cannot have children now. I know at forty-four the chances were lower. But they were not zero. And the decision was taken from me without my knowledge. I feel I was not treated as someone whose choices mattered.", start: 257000, end: 304000 },
    { speaker: "SPEAKER_1", text: "I understand. And I want you to know that what you have just described — if accurate — is a serious matter of clinical negligence and consent law. The right of a patient to make an informed decision about their own treatment is fundamental. The question of whether you were adequately counselled on the risk of conversion to hysterectomy, given that you had specifically expressed a wish to preserve fertility, is the heart of this claim.", start: 305000, end: 346000 },
    { speaker: "SPEAKER_2", text: "That is exactly it.", start: 347000, end: 349000 },
    { speaker: "SPEAKER_1", text: "I will need your full medical records. We will also need an independent medical expert — a consultant gynaecologist who can review the clinical decision. This is a clinical negligence claim and liability will need to be established through expert evidence.", start: 350000, end: 378000 },
    { speaker: "SPEAKER_2", text: "How long does this take?", start: 379000, end: 382000 },
    { speaker: "SPEAKER_1", text: "Honestly — medical negligence claims take time. We are looking at six to twelve months before we have a full letter of claim ready to send. I want to be honest with you about that.", start: 383000, end: 400000 },
    { speaker: "SPEAKER_2", text: "I understand. I just want it on record. I want them to know that what they did to me mattered.", start: 401000, end: 412000 },
    { speaker: "SPEAKER_1", text: "It will be on record. Before I close — limitation. The incident was February of last year. You have three years from the date of knowledge to issue proceedings. We have time but we should not delay unnecessarily.", start: 413000, end: 432000 },
    { speaker: "SPEAKER_2", text: "Thank you. I feel better having spoken to someone.", start: 433000, end: 439000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    content: transcriptContent,
    utterances: utterances,
    speakerCount: 2,
    redactions: [],
    createdAt: new Date(sessionDate.getTime() + 52 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id,
    meetingSessionId: session.id,
    type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Patricia Osei  
**Matter:** Osei v Royal Greenwich NHS Trust  
**Reference:** HART_MED/2024/0156  
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}  
**Fee Earner:** Claire Donnelly  
**Duration:** 48 minutes  

---

## NATURE OF ATTENDANCE

Initial consultation — potential clinical negligence claim arising from surgical procedure at Queen Elizabeth Hospital, Royal Greenwich NHS Trust, February of last year.

---

## FACTS AS PRESENTED BY CLIENT

Client, aged 44, referred on two-week pathway for abdominal pain. Ultrasound identified 7cm fibroid. Consultant gynaecologist (Mr Adeyemi) recommended myomectomy. Client expressly stated wish to preserve fertility. Procedure performed. During surgery, conversion to full hysterectomy made. Client was not forewarned of this possibility. Client woke to find hysterectomy had been performed without prior consent. Surgeon attended following day — stated conversion necessary to control life-threatening bleeding.

Client reports: four months off work (secondary school teacher), loss of earnings, permanent loss of fertility, significant psychological impact.

---

## LEGAL ANALYSIS

Potential claim in clinical negligence and consent law. Central question: whether client was adequately counselled regarding risk of conversion to hysterectomy, given express wish to preserve fertility. Montgomery v Lanarkshire Health Board [2015] UKSC 11 — duty to warn of material risks that a reasonable patient in client's position would attach significance to. Conversion risk in myomectomy — material risk well-documented in obstetric literature. Failure to disclose arguable.

---

## NEXT STEPS

Subject Access Request to Royal Greenwich NHS Trust — full medical records including surgical notes, consent form, anaesthetic record, post-operative notes. GP records (5 years). Identification and instruction of independent expert consultant gynaecologist. Limitation date: February — 3 years from procedure or date of knowledge. File opened today. Funding to be discussed at next appointment.`,
    version: 1,
    versionType: "ai_generated",
    createdBy: userId,
    status: "draft",
    createdAt: new Date(sessionDate.getTime() + 52 * 60 * 1000),
  });

  const auditEvents = [
    { eventType: "case_created", timestamp: daysAgo(21), metadata: { practiceArea: "clinical_negligence", matterReference: "HART_MED/2024/0156" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Consultation — Surgical Negligence", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 44 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 52 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 2880 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 54 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
  ];

  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({
      eventType: evt.eventType,
      userId,
      caseId: newCase.id,
      timestamp: evt.timestamp,
      severity: evt.severity,
      metadata: evt.metadata,
      transcriptId: (evt as any).transcriptId || null,
    });
  }
}


// ─── Matter 4: Residential Conveyancing (Neurodiversity Showcase) ────────────

async function seedMatter4Okonkwo(userId: string) {
  const session1Date = daysAgoAt(35, 10, 0);
  const session2Date = daysAgoAt(14, 11, 0);
  const completionDate = daysFromNow(21);

  const [newCase] = await db.insert(cases).values({
    title: "Okonkwo — Purchase of 14 Elmwood Rise, SE22",
    clientName: "Mr and Mrs Okonkwo",
    matterReference: "HART_CON/2024/1204",
    createdBy: userId,
    status: "active",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "residential_conveyancing",
    riskLevel: "low",
    conflictCheckCompleted: true,
    conflictCheckNote: "Vendor and vendor solicitors Pemberton & Co — no current matters. No conflict identified.",
    deadline: completionDate,
    reviewed: true,
    supervisorName: "James Hartwell",
  }).returning();

  const [session1] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Purchase of 14 Elmwood Rise",
    startedAt: session1Date,
    durationSeconds: 2760,
    status: "completed",
    createdBy: userId,
  }).returning();

  const s1Expiry = new Date(session1Date.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session1.id, duration: 2760, recordedAt: session1Date, expiresAt: s1Expiry, deletedAt: s1Expiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(session1Date.getTime() + 41 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I record meetings to produce accurate attendance notes. The recording is deleted after seven days and is confidential to your file. Do you both consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const s1Content = `Attendance Note — Okonkwo Purchase — 14 Elmwood Rise SE22
Clients: Mr Emeka Okonkwo and Mrs Adaeze Okonkwo
Matter Reference: HART_CON/2024/1204
Date: ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Daniel Park
Duration: Approximately 46 minutes

---

SOLICITOR: Good morning Mr and Mrs Okonkwo. Before we start I want to confirm you are both happy for me to record this meeting for note-taking purposes. The recording stays within your file and is deleted after seven days. Are you both content?

MR OKONKWO: Yes, absolutely.

MRS OKONKWO: Yes, that is fine thank you.

SOLICITOR: Perfect. Congratulations on the purchase — number 14 Elmwood Rise. Let me take you through the process so you know exactly what to expect at each stage. I will make a note of everything so nothing gets missed. That is one of the things I find most important — having a complete record of every conversation, every instruction, every commitment. Nothing falls through the cracks.

MR OKONKWO: That is one of the reasons we chose you. Our last solicitor on the flat — we never quite knew where things stood.

SOLICITOR: I understand completely. You will always know where things stand with me. I send updates at every material stage. So — the property is freehold, purchase price three hundred and eighty-two thousand. You are purchasing jointly in equal shares?

MR OKONKWO: Yes, fifty-fifty. We are married so joint tenants made sense.

SOLICITOR: Joint tenants it is. The mortgage — have you had a formal offer yet?

MR OKONKWO: We have the offer in principle. The full offer is expected this week. Nationwide, twenty-five year term, fixed for five years.

SOLICITOR: Good. As soon as you have the formal offer please send me a copy. I act for the lender as well as for you — that is standard practice — so I will need to report to them before exchange. Now, the searches. I will order the local authority search, water and drainage, and environmental search today. Local authority in Southwark can take four to five weeks — I want to flag that so it does not surprise you.

MRS OKONKWO: Our moving date — we want to be in by the end of next month. Is that realistic?

SOLICITOR: Honestly — it is tight. It is achievable but several things need to go right. I will push hard but I want to be honest with you rather than promise something I cannot control.

MR OKONKWO: We appreciate that.

SOLICITOR: The survey — you had the HomeBuyer Report?

MRS OKONKWO: Yes. It flagged some pointing work on the front elevation and a minor damp issue in the rear reception. Surveyor said neither was urgent.

SOLICITOR: Please send it today. I may ask the vendor to provide damp treatment records. Now — the title. One restrictive covenant from 1962 prohibiting commercial use. Entirely standard for residential — does not affect your intended use at all. I just want you to know everything on the title.

MRS OKONKWO: That is absolutely fine. We just want to live there.

SOLICITOR: And the SDLT — at three hundred and eighty-two thousand, both confirmed as first-time buyers?

MR OKONKWO: Yes. Both of us.

SOLICITOR: First-time buyer relief applies. SDLT liability approximately four thousand one hundred pounds. I will confirm the exact figure on the completion statement. And you will have that completion statement at least five working days before completion — no surprises on the day.

MRS OKONKWO: Our solicitor on the previous purchase only told us what we owed the day before completion.

SOLICITOR: That should not happen. My aim is that by the time you hand over the money, every figure has been reviewed and approved by you. Summary — I order searches today, I will send you a first report on title within three weeks, and please send me the mortgage offer and survey today if you can.

MRS OKONKWO: No questions. This has been much clearer than we expected. Thank you.

MR OKONKWO: Yes, thank you Daniel. We feel in good hands.

---

ACTION ITEMS
1. Solicitor to order searches — today
2. Clients to send mortgage offer when received — this week
3. Clients to send HomeBuyer Report — today
4. Solicitor to review title documents when received
5. Solicitor to send first report on title within 3 weeks
6. Solicitor to calculate exact SDLT liability`;

  const s1Utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Mr and Mrs Okonkwo. Before we start I want to confirm you are both happy for me to record this meeting for note-taking purposes. The recording stays within your file and is deleted after seven days. Are you both content?", start: 41000, end: 59000 },
    { speaker: "SPEAKER_2", text: "Yes, absolutely.", start: 60000, end: 62000 },
    { speaker: "SPEAKER_3", text: "Yes, that is fine thank you.", start: 63000, end: 67000 },
    { speaker: "SPEAKER_1", text: "Perfect. Congratulations on the purchase. Let me take you through the process so you know exactly what to expect at each stage. I will make a note of everything so nothing gets missed. That is one of the things I find most important — having a complete record of every conversation, every instruction, every commitment. Nothing falls through the cracks.", start: 68000, end: 95000 },
    { speaker: "SPEAKER_2", text: "That is one of the reasons we chose you. Our last solicitor on the flat — we never quite knew where things stood.", start: 96000, end: 108000 },
    { speaker: "SPEAKER_1", text: "I understand completely. You will always know where things stand with me. I send updates at every material stage. The property is freehold, purchase price three hundred and eighty-two thousand. You are purchasing jointly in equal shares?", start: 109000, end: 132000 },
    { speaker: "SPEAKER_2", text: "Yes, fifty-fifty. We are married so joint tenants made sense.", start: 133000, end: 142000 },
    { speaker: "SPEAKER_1", text: "Joint tenants it is. The mortgage — have you had a formal offer yet?", start: 143000, end: 150000 },
    { speaker: "SPEAKER_2", text: "We have the offer in principle. The full offer is expected this week. Nationwide, twenty-five year term, fixed for five years.", start: 151000, end: 166000 },
    { speaker: "SPEAKER_1", text: "Good. I act for the lender as well as for you — standard practice. I will order the local authority search, water and drainage, and environmental search today. Local authority in Southwark can take four to five weeks — flagging that now.", start: 167000, end: 196000 },
    { speaker: "SPEAKER_3", text: "Our moving date — we want to be in by the end of next month. Is that realistic?", start: 197000, end: 206000 },
    { speaker: "SPEAKER_1", text: "Honestly — it is tight. It is achievable but several things need to go right. I will push hard but I want to be honest with you rather than promise something I cannot control.", start: 207000, end: 227000 },
    { speaker: "SPEAKER_2", text: "We appreciate that.", start: 228000, end: 231000 },
    { speaker: "SPEAKER_1", text: "The survey — you had the HomeBuyer Report?", start: 232000, end: 237000 },
    { speaker: "SPEAKER_3", text: "Yes. It flagged some pointing work on the front elevation and a minor damp issue in the rear reception. Surveyor said neither was urgent.", start: 238000, end: 255000 },
    { speaker: "SPEAKER_1", text: "Please send it today. There is a restrictive covenant from 1962 prohibiting commercial use — entirely standard for residential, no impact on your intended use. At three hundred and eighty-two thousand, both confirmed first-time buyers?", start: 256000, end: 284000 },
    { speaker: "SPEAKER_2", text: "Yes. Both of us.", start: 285000, end: 288000 },
    { speaker: "SPEAKER_1", text: "First-time buyer relief applies. SDLT approximately four thousand one hundred pounds. You will have the completion statement at least five working days before completion — no surprises on the day.", start: 289000, end: 310000 },
    { speaker: "SPEAKER_3", text: "Our solicitor on the previous purchase only told us what we owed the day before completion.", start: 311000, end: 322000 },
    { speaker: "SPEAKER_1", text: "That should not happen. My aim is that by the time you hand over the money, every figure has been reviewed and approved by you. I order searches today and will send a first report on title within three weeks.", start: 323000, end: 346000 },
    { speaker: "SPEAKER_3", text: "No questions. This has been much clearer than we expected. Thank you.", start: 347000, end: 355000 },
    { speaker: "SPEAKER_2", text: "Yes, thank you Daniel. We feel in good hands.", start: 356000, end: 362000 },
  ];

  const [transcript1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session1.id, content: s1Content, utterances: s1Utterances,
    speakerCount: 3, redactions: [], createdAt: new Date(session1Date.getTime() + 50 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session1.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Clients:** Mr Emeka Okonkwo and Mrs Adaeze Okonkwo
**Matter:** Purchase of 14 Elmwood Rise, SE22
**Reference:** HART_CON/2024/1204
**Date:** ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Daniel Park (Licensed Conveyancer)
**Duration:** 46 minutes

---

## PROPERTY DETAILS

Freehold. Registered title. Purchase price £382,000. Joint purchase as joint tenants — equal beneficial interests confirmed, equal financial contributions from both clients.

---

## MORTGAGE

Nationwide Building Society. 25-year term, 5-year fixed rate. Formal offer in principle received — full offer expected imminently. Solicitor acts for lender (standard dual representation). Formal offer to be sent on receipt.

---

## SEARCHES

Ordered today: Local Authority (Southwark — 4-5 week turnaround advised), Water and Drainage, Environmental.

---

## SURVEY

HomeBuyer Report obtained. Flagged: (i) pointing work required to front elevation; (ii) minor damp in rear reception — both assessed as non-urgent by surveyor. Report to be reviewed alongside title. Vendor may be asked for damp treatment records or guarantees.

---

## TITLE

Freehold, registered. One restrictive covenant (1962) — commercial use prohibition. Standard residential restriction. No impact on clients' intended use confirmed.

---

## SDLT

Both clients confirmed first-time buyers. Estimated SDLT liability: approximately £4,100. Exact figure to follow in completion statement. Full completion statement to be provided minimum 5 working days before completion.

---

## SUPERVISOR NOTE

File review — 35 days in. Searches received clean. Mortgage offer received and reported to lender. Title report sent. All action items cleared on schedule. Daniel's file management on this matter has been exemplary — every client update sent within 24 hours of each material development. Completion statement prepared 8 working days before completion. No missed steps. Client feedback outstanding. No supervision concerns.`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved",
    approvedAt: new Date(session1Date.getTime() + 75 * 60 * 1000),
    createdAt: new Date(session1Date.getTime() + 52 * 60 * 1000),
  });

  // Session 2
  const [session2] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "telephone_call",
    sessionTitle: "Pre-Exchange Call — Search Results and Mortgage Offer Confirmed",
    startedAt: session2Date, durationSeconds: 1560, status: "completed", createdBy: userId,
  }).returning();

  const s2Expiry = new Date(session2Date.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session2.id, duration: 1560, recordedAt: session2Date, expiresAt: s2Expiry, deletedAt: s2Expiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(session2Date.getTime() + 18 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I am recording this call for note-taking purposes. Deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const s2Content = `Attendance Note — Okonkwo — Pre-Exchange Call
Client: Mr Emeka Okonkwo (call)
Reference: HART_CON/2024/1204
Date: ${session2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Daniel Park | Duration: ~26 minutes

---

SOLICITOR: Good morning Mr Okonkwo. Recording is on — you consent?

CLIENT: Yes, go ahead.

SOLICITOR: All four searches have come back clean. Local authority: clear — no enforcement, no planning applications, no road schemes. Water and drainage: mains connected, no issues. Environmental: very low risk, no industrial use, no flood risk, no contamination. Your mortgage offer from Nationwide has also arrived. I have reviewed it in detail — the offer is in order, conditions are standard. I have reported to Nationwide on the title and they are satisfied. We are in a position to exchange.

CLIENT: When could we exchange?

SOLICITOR: I can exchange this week if the vendor is ready. Completion on the twenty-first — you wanted end of next month. Does that work?

CLIENT: Yes, the twenty-first is perfect. We have booked the removal company provisionally.

SOLICITOR: Good. Before exchange I need two things — the deposit: thirty-eight thousand two hundred pounds. Have you arranged the transfer?

CLIENT: Yes. Adaeze transferred it from our joint savings this morning. You should have it.

SOLICITOR: I will check this afternoon. I also need the signed contract. I sent it last week — have you received it?

CLIENT: Yes, we have both signed. I can bring it in this afternoon.

SOLICITOR: Bring it in — that is faster. The completion statement — I sent it yesterday. Have you had a chance to review it?

CLIENT: I looked at it last night. The figures all make sense. SDLT four thousand one hundred and sixty. Legal fees one thousand four hundred plus VAT. Land Registry fee two hundred and seventy. All looks right.

SOLICITOR: Exactly right. Balance due on completion: three hundred and forty-eight thousand, four hundred and thirty pounds. By the morning of the twenty-first.

CLIENT: We have the mortgage funds and our savings ready.

SOLICITOR: Perfect. I will call you as soon as exchange happens. Any questions?

CLIENT: No. I just want to say — this has been completely stress-free compared to our last purchase. We always knew what was happening.

SOLICITOR: That is exactly how it should be.

---

ACTION ITEMS
1. Confirm deposit receipt — today
2. Collect signed contract — this afternoon
3. Exchange — this week
4. Completion confirmed: 21st`;

  const s2Utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Mr Okonkwo. Recording is on — you consent?", start: 18000, end: 24000 },
    { speaker: "SPEAKER_2", text: "Yes, go ahead.", start: 25000, end: 27000 },
    { speaker: "SPEAKER_1", text: "All four searches have come back clean. Local authority clear. Water and drainage clear. Environmental very low risk. Your mortgage offer from Nationwide has arrived and is in order. I have reported to Nationwide — they are satisfied. We are in a position to exchange.", start: 28000, end: 65000 },
    { speaker: "SPEAKER_2", text: "When could we exchange?", start: 66000, end: 69000 },
    { speaker: "SPEAKER_1", text: "I can exchange this week if the vendor is ready. Completion on the twenty-first — you wanted end of next month. Does that work?", start: 70000, end: 86000 },
    { speaker: "SPEAKER_2", text: "Yes, the twenty-first is perfect. We have booked the removal company provisionally.", start: 87000, end: 97000 },
    { speaker: "SPEAKER_1", text: "Good. Before exchange I need the deposit — thirty-eight thousand two hundred pounds — and the signed contract. Have you arranged the transfer?", start: 98000, end: 115000 },
    { speaker: "SPEAKER_2", text: "Yes. Adaeze transferred it from our joint savings this morning. You should have it.", start: 116000, end: 126000 },
    { speaker: "SPEAKER_1", text: "I will check this afternoon. The completion statement — I sent it yesterday. Have you reviewed it?", start: 127000, end: 139000 },
    { speaker: "SPEAKER_2", text: "I looked at it last night. The figures all make sense. SDLT four thousand one hundred and sixty. Legal fees one thousand four hundred plus VAT. Land Registry fee two hundred and seventy. All looks right.", start: 140000, end: 164000 },
    { speaker: "SPEAKER_1", text: "Exactly right. Balance due on completion: three hundred and forty-eight thousand, four hundred and thirty pounds.", start: 165000, end: 180000 },
    { speaker: "SPEAKER_2", text: "We have the mortgage funds and our savings ready.", start: 181000, end: 188000 },
    { speaker: "SPEAKER_1", text: "Perfect. I will call you as soon as exchange happens. Any questions?", start: 189000, end: 198000 },
    { speaker: "SPEAKER_2", text: "No. I just want to say — this has been completely stress-free compared to our last purchase. We always knew what was happening.", start: 199000, end: 213000 },
    { speaker: "SPEAKER_1", text: "That is exactly how it should be.", start: 214000, end: 218000 },
  ];

  const [transcript2] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session2.id, content: s2Content, utterances: s2Utterances,
    speakerCount: 2, redactions: [], createdAt: new Date(session2Date.getTime() + 30 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session2.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE — TELEPHONE CALL

**Client:** Mr Emeka Okonkwo
**Reference:** HART_CON/2024/1204
**Date:** ${session2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Daniel Park | Duration: 26 minutes

---

All searches clear. Mortgage offer reviewed and reported to lender — satisfied. Ready to exchange.

Proposed completion: 21st (confirmed by client — removal company booked). Exchange this week.

Deposit (£38,200): transferred by Mrs Okonkwo — to confirm on receipt. Signed contract: both clients signed — to be delivered in person this afternoon.

**Completion statement approved by client:**
- Purchase price: £382,000
- SDLT: £4,160
- Legal fees: £1,400 + VAT
- Land Registry: £270
- Less deposit: (£38,200)
- **Balance due: £348,430**`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved",
    approvedAt: new Date(session2Date.getTime() + 45 * 60 * 1000),
    createdAt: new Date(session2Date.getTime() + 32 * 60 * 1000),
  });

  const auditEvents = [
    { eventType: "case_created", timestamp: daysAgo(35), metadata: { practiceArea: "residential_conveyancing", matterReference: "HART_CON/2024/1204" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: session1Date, metadata: { sessionTitle: "Initial Instructions", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(session1Date.getTime() + 41 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(session1Date.getTime() + 50 * 60 * 1000), metadata: { speakerCount: 3, durationSeconds: 2760 }, transcriptId: transcript1.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(session1Date.getTime() + 52 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(session1Date.getTime() + 75 * 60 * 1000), metadata: { approvedBy: "Daniel Park" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: session2Date, metadata: { sessionTitle: "Pre-Exchange Call", recordingType: "telephone_call" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(session2Date.getTime() + 18 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(session2Date.getTime() + 30 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 1560 }, transcriptId: transcript2.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(session2Date.getTime() + 32 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(session2Date.getTime() + 45 * 60 * 1000), metadata: { approvedBy: "Daniel Park" }, severity: "info" as const },
    { eventType: "case_updated", timestamp: daysAgo(10), metadata: { field: "supervisorReview", note: "File review complete. Daniel's file management on this matter has been exemplary. Every client update sent within 24 hours of each material development. Completion statement prepared 8 working days before completion. No missed steps. Client feedback outstanding. No supervision concerns.", reviewedBy: "James Hartwell (Supervisor)" }, severity: "info" as const },
  ];

  for (const evt of auditEvents) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}


// ─── Matter 5: Employment — Constructive Dismissal ──────────────────────────

async function seedMatter5Hassan(userId: string) {
  const sessionDate = daysAgoAt(10, 15, 0);

  const [newCase] = await db.insert(cases).values({
    title: "Hassan v Meridian Capital Partners LLP",
    clientName: "Tariq Hassan",
    matterReference: "HART_EMP/2024/0723",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "employment_employee",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Meridian Capital Partners LLP — not a current or former client. No connection identified. Conflict clear.",
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Constructive Dismissal and Protected Disclosure",
    startedAt: sessionDate,
    durationSeconds: 3060,
    status: "completed",
    createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session.id, duration: 3060, recordedAt: sessionDate, expiresAt: sessionExpiry, deletedAt: sessionExpiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(sessionDate.getTime() + 35 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I am recording this meeting to produce an accurate attendance note. The recording is confidential to your file and deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const transcriptContent = `Attendance Note — Hassan v Meridian Capital Partners LLP
Client: Tariq Hassan
Matter Reference: HART_EMP/2024/0723
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Sarah Okafor
Duration: Approximately 51 minutes

---

SOLICITOR: Good afternoon Mr Hassan. Before we begin I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is confidential to your file and deleted after seven days. Do you consent?

CLIENT: Yes. Thank you for seeing me at short notice.

SOLICITOR: Of course. Tell me what has happened.

CLIENT: I was Head of Compliance at Meridian Capital Partners. I had been there six years. My last appraisal — eighteen months ago — was outstanding. Everything changed after I raised a concern in October last year.

SOLICITOR: What was the concern?

CLIENT: I identified what I believed to be a pattern of irregular trade reporting. Certain transactions were not being reported to the FCA within the required timeframe. I raised it internally — first with my line manager, then in writing to the COO. Within a week of the written complaint I was moved to a different role. Same grade, same salary, but effectively sidelined. My direct reports were reassigned. My access to certain systems was removed. I had no meaningful work to do.

SOLICITOR: Was there any explanation given for the role change?

CLIENT: They called it a restructure. There was no consultation. No other roles were affected. It was just me.

SOLICITOR: Did you respond to the restructure in writing?

CLIENT: Yes. I wrote to HR and to the Managing Partner in November. I set out that the restructure had followed immediately from my protected disclosure and that I believed it was retaliatory. I received a response saying the restructure was genuine and unrelated to my concern. I did not accept that.

SOLICITOR: And what happened after November?

CLIENT: Things deteriorated. I was excluded from meetings I had previously attended as a matter of course. My successor in the compliance role — a more junior colleague — was given my former responsibilities and my former direct reports. I was given administrative tasks. By February I was attending the office but had literally nothing to do. I raised a grievance in March. The grievance was not upheld. I appealed. The appeal was not upheld. I resigned in April. Fourteen days ago.

SOLICITOR: Let me be precise about the legal framework. What you are describing is potentially two overlapping claims. The first is constructive dismissal — the argument that the employer's conduct was so unreasonable as to constitute a fundamental breach of your employment contract, entitling you to treat yourself as dismissed. The second, and in some ways more significant, is automatic unfair dismissal on grounds of having made a protected disclosure — a whistleblowing claim. If the tribunal accepts that you made a protected disclosure and that the detriment you suffered was as a result of that disclosure, the compensation is uncapped. There is no two-year service requirement for whistleblowing claims.

CLIENT: I did not know about the uncapped element.

SOLICITOR: It is significant. Six years of service at a senior level in a financial services firm — your losses, if liability is established, could be substantial. I want to manage expectations — these claims are not straightforward. Establishing the causal link between the disclosure and the detriment is frequently contested. But the facts you have described — the immediacy of the role change, the absence of any other restructuring, the written complaint — those are strong indicators.

CLIENT: What do I need to do now?

SOLICITOR: First — ACAS Early Conciliation. Before you can issue proceedings in the Employment Tribunal you must notify ACAS. That process starts the clock. The limitation period for unfair dismissal is three months from the effective date of termination — your resignation date. We have time but we must not be complacent. I will notify ACAS today on your behalf.

CLIENT: I have all my written correspondence — the original disclosure, the letters to HR and the Managing Partner, the grievance, the appeal, all the responses. I have emails too.

SOLICITOR: I need all of it. Everything in writing. I also need your contract of employment, your job description, any appraisal documents, your payslips for the last twelve months, and any communications — email, Teams messages, anything — that relate to the period after the disclosure. Do not delete anything. Do not discuss this matter with any current colleagues.

CLIENT: There is one more thing. I was asked to sign a settlement agreement in March. I did not sign it. But the fact that it was offered — does that help me?

SOLICITOR: It is relevant context. It suggests the employer was aware of potential exposure. It does not by itself establish liability but it is consistent with your account. What were the terms?

CLIENT: Three months pay in lieu plus a reference. And a full and final settlement of all claims. I walked away because I felt it was inadequate and because I wanted what happened documented properly.

SOLICITOR: Your instinct may prove correct if the claim succeeds. I will advise you on the relative merits of settlement versus litigation as we progress. For now — ACAS notification today, full document review this week, and I will come back to you with an initial assessment of the claim within ten working days.

---

ACTION ITEMS
1. Solicitor to notify ACAS Early Conciliation — today
2. Client to provide all written correspondence (disclosures, grievances, responses)
3. Client to provide contract of employment, job description, appraisals
4. Client to provide payslips (12 months)
5. Client to provide all relevant email and digital communications
6. Solicitor to produce initial claim assessment within 10 working days
7. Note limitation date — 3 months from resignation`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good afternoon Mr Hassan. Before we begin I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is confidential to your file and deleted after seven days. Do you consent?", start: 35000, end: 54000 },
    { speaker: "SPEAKER_2", text: "Yes. Thank you for seeing me at short notice.", start: 55000, end: 61000 },
    { speaker: "SPEAKER_1", text: "Of course. Tell me what has happened.", start: 62000, end: 66000 },
    { speaker: "SPEAKER_2", text: "I was Head of Compliance at Meridian Capital Partners. I had been there six years. My last appraisal — eighteen months ago — was outstanding. Everything changed after I raised a concern in October last year.", start: 67000, end: 90000 },
    { speaker: "SPEAKER_1", text: "What was the concern?", start: 91000, end: 94000 },
    { speaker: "SPEAKER_2", text: "I identified what I believed to be a pattern of irregular trade reporting. Certain transactions were not being reported to the FCA within the required timeframe. I raised it internally — first with my line manager, then in writing to the COO. Within a week of the written complaint I was moved to a different role. Same grade, same salary, but effectively sidelined. My direct reports were reassigned. My access to certain systems was removed. I had no meaningful work to do.", start: 95000, end: 144000 },
    { speaker: "SPEAKER_1", text: "Was there any explanation given for the role change?", start: 145000, end: 151000 },
    { speaker: "SPEAKER_2", text: "They called it a restructure. There was no consultation. No other roles were affected. It was just me.", start: 152000, end: 164000 },
    { speaker: "SPEAKER_1", text: "Did you respond to the restructure in writing?", start: 165000, end: 171000 },
    { speaker: "SPEAKER_2", text: "Yes. I wrote to HR and to the Managing Partner in November. I set out that the restructure had followed immediately from my protected disclosure and that I believed it was retaliatory. I received a response saying the restructure was genuine and unrelated. I did not accept that.", start: 172000, end: 200000 },
    { speaker: "SPEAKER_1", text: "And what happened after November?", start: 201000, end: 205000 },
    { speaker: "SPEAKER_2", text: "Things deteriorated. I was excluded from meetings. My successor was given my former responsibilities. I was given administrative tasks. By February I had literally nothing to do. I raised a grievance in March. Not upheld. I appealed. Not upheld. I resigned in April. Fourteen days ago.", start: 206000, end: 238000 },
    { speaker: "SPEAKER_1", text: "What you are describing is potentially two overlapping claims. Constructive dismissal — the employer's conduct constituting a fundamental breach. And automatic unfair dismissal on grounds of protected disclosure — a whistleblowing claim. The compensation is uncapped. There is no two-year service requirement for whistleblowing claims.", start: 239000, end: 284000 },
    { speaker: "SPEAKER_2", text: "I did not know about the uncapped element.", start: 285000, end: 290000 },
    { speaker: "SPEAKER_1", text: "It is significant. Six years of service at senior level in financial services — your losses could be substantial. The immediacy of the role change, the absence of other restructuring, the written complaint — those are strong indicators.", start: 291000, end: 322000 },
    { speaker: "SPEAKER_2", text: "What do I need to do now?", start: 323000, end: 327000 },
    { speaker: "SPEAKER_1", text: "First — ACAS Early Conciliation. The limitation period for unfair dismissal is three months from the effective date of termination. I will notify ACAS today on your behalf.", start: 328000, end: 353000 },
    { speaker: "SPEAKER_2", text: "I have all my written correspondence — the original disclosure, the letters to HR and the Managing Partner, the grievance, the appeal, all the responses. I have emails too.", start: 354000, end: 372000 },
    { speaker: "SPEAKER_1", text: "I need all of it. Do not delete anything. Do not discuss this matter with any current colleagues.", start: 373000, end: 384000 },
    { speaker: "SPEAKER_2", text: "There is one more thing. I was asked to sign a settlement agreement in March. I did not sign it. But the fact that it was offered — does that help me?", start: 385000, end: 400000 },
    { speaker: "SPEAKER_1", text: "It is relevant context. It suggests the employer was aware of potential exposure. What were the terms?", start: 401000, end: 413000 },
    { speaker: "SPEAKER_2", text: "Three months pay in lieu plus a reference. Full and final settlement of all claims. I walked away because I felt it was inadequate and because I wanted what happened documented properly.", start: 414000, end: 434000 },
    { speaker: "SPEAKER_1", text: "Your instinct may prove correct. ACAS notification today, full document review this week, initial assessment within ten working days.", start: 435000, end: 460000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session.id, content: transcriptContent,
    utterances, speakerCount: 2, redactions: [],
    createdAt: new Date(sessionDate.getTime() + 55 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Tariq Hassan
**Matter:** Hassan v Meridian Capital Partners LLP
**Reference:** HART_EMP/2024/0723
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Sarah Okafor | **Duration:** 51 minutes

---

## NATURE OF ATTENDANCE

Initial instructions — potential constructive dismissal and protected disclosure (whistleblowing) claim following resignation after 6 years' service as Head of Compliance.

---

## CHRONOLOGY

**October — Protected Disclosure:** Client identified pattern of irregular FCA trade reporting. Raised internally with line manager and in writing to COO.

**Within one week of written disclosure:** Role change — same grade and salary but direct reports reassigned, system access removed, no meaningful work. Employer characterised as "restructure" — no consultation, no other roles affected.

**November:** Client wrote to HR and Managing Partner asserting retaliatory restructure. Employer denied connection.

**February:** Client attending office without substantive work.

**March:** Formal grievance raised — not upheld. Appeal — not upheld. Settlement agreement offered (3 months PILON, full and final settlement) — client declined.

**April (14 days ago):** Resignation.

---

## LEGAL ANALYSIS

**Claim 1 — Constructive Dismissal (s.95(1)(c) ERA 1996):** Sustained course of conduct — effective demotion, exclusion, removal of responsibilities — arguable fundamental breach of implied term of trust and confidence.

**Claim 2 — Automatic Unfair Dismissal / Whistleblowing Detriment (ERA 1996 ss.47B, 103A):** FCA reporting obligations — qualifying disclosure arguable under FSMA 2000 and MAR. Temporal proximity (disclosure October → role change within one week) — strong indicator of causation. No two-year service requirement. Compensation uncapped.

**Settlement agreement offered by employer within 5 months of disclosure** — consistent with awareness of exposure. Background context.

**Limitation:** 3 months from effective date of termination. ACAS Early Conciliation to be notified today.

---

## NEXT STEPS

1. Notify ACAS Early Conciliation — today
2. Obtain all written correspondence, contract, appraisals, payslips, digital communications
3. Note limitation deadline
4. Produce initial claim assessment within 10 working days`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "draft",
    createdAt: new Date(sessionDate.getTime() + 57 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(10), metadata: { practiceArea: "employment_employee", matterReference: "HART_EMP/2024/0723" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Instructions — Constructive Dismissal", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 35 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 55 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 3060 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 57 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}

// ─── Matter 6: Personal Injury — Road Traffic ───────────────────────────────

async function seedMatter6Diallo(userId: string) {
  const sessionDate = daysAgoAt(28, 10, 30);

  const [newCase] = await db.insert(cases).values({
    title: "Diallo v Insurers of Ahmed (RTA — 14 March)",
    clientName: "Amara Diallo",
    matterReference: "HART_PI/2024/0512",
    createdBy: userId,
    status: "active",
    priority: "normal",
    sourceType: "audio",
    practiceArea: "personal_injury_rta",
    riskLevel: "low",
    conflictCheckCompleted: true,
    conflictCheckNote: "Third party and insurer — no conflict identified.",
    reviewed: true,
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id,
    recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Road Traffic Accident Claim",
    startedAt: sessionDate,
    durationSeconds: 2700,
    status: "completed",
    createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session.id, duration: 2700, recordedAt: sessionDate, expiresAt: sessionExpiry, deletedAt: sessionExpiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(sessionDate.getTime() + 29 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I record meetings to produce accurate attendance notes. The recording is confidential to your file and deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const transcriptContent = `Attendance Note — Diallo v Insurers of Ahmed
Client: Amara Diallo
Matter Reference: HART_PI/2024/0512
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Claire Donnelly
Duration: Approximately 45 minutes

---

SOLICITOR: Good morning Ms Diallo. Before we start I want to confirm you are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days. Do you consent?

CLIENT: Yes, that is fine.

SOLICITOR: Good. Take me through what happened on the fourteenth of March.

CLIENT: I was driving south on Lewisham High Street at approximately half past eight in the morning. I was on my way to work. I had stopped at traffic lights — they were on red. A vehicle came from behind and hit me. Hard. I was pushed forward into the car in front.

SOLICITOR: Were you wearing your seatbelt?

CLIENT: Yes. Always.

SOLICITOR: What was the impact like from your perspective?

CLIENT: I did not see it coming at all. The first thing I knew was the impact from behind. My head went forward and then back. I remember thinking my neck felt wrong immediately. There was a horrible pain across the top of my shoulders.

SOLICITOR: What happened immediately after?

CLIENT: The driver behind got out. He was on his phone — I think he had been looking at his phone when he drove into me. He seemed shocked. He apologised at the scene. The car in front — a woman — she was not injured. She was shaken. We all exchanged details. I called the police because the damage was significant. They came. A report was made.

SOLICITOR: Did you receive medical attention at the scene?

CLIENT: An ambulance attended. They assessed me at the roadside — said there were no signs of serious injury but recommended I attend A&E given the neck pain. I went to Lewisham Hospital that afternoon. X-rays showed no fracture. Diagnosis was soft tissue injury — whiplash — to the cervical spine.

SOLICITOR: How have you been since?

CLIENT: The first two weeks were very bad. I could not turn my head properly. I needed help washing my hair. I took two weeks off work — I am a nursery nurse, I cannot work with children if I cannot move my neck safely. After two weeks I went back but I was on restricted duties for another three weeks. I still get discomfort when I am tired or if I sit at a desk for too long. My GP has referred me for physiotherapy — I have had four sessions so far.

SOLICITOR: And the car?

CLIENT: It was written off. I had comprehensive insurance. The insurer dealt with the third party but they want me to use their recommended solicitor. I was not happy with that — I wanted independent advice.

SOLICITOR: You were right to come here. You are entitled to your own legal representation. The third party's insurer — Hastings Direct — they have already been in contact. That suggests liability is not going to be contested. A rear-end shunt at a red light with a police report makes liability straightforward in the vast majority of cases. Our focus will be on establishing the full extent of your injuries and losses.

CLIENT: What counts as losses?

SOLICITOR: General damages — compensation for the pain, suffering and loss of amenity. Special damages — your out-of-pocket financial losses. In your case: two weeks of lost earnings, travel costs if you could not use your car, physiotherapy costs, prescription costs, and any other evidenced expenses. If symptoms persist you may need further treatment — that is also recoverable.

CLIENT: I have kept receipts. My payslips. I was careful because I thought this might happen.

SOLICITOR: That is very helpful. I will commission an independent medico-legal report from an orthopaedic specialist. That report is the backbone of your claim. Cases of this type typically resolve in twelve to eighteen months. Most settle without trial.

CLIENT: I just want to be fairly compensated. I am not trying to take advantage of anyone.

SOLICITOR: That is the right approach. I will open the file today, write to Hastings Direct to put them on notice, and commission the medico-legal report.

---

ACTION ITEMS
1. Solicitor to write to Hastings Direct — notice of claim and preservation of evidence
2. Solicitor to commission independent medico-legal report (orthopaedic)
3. Client to provide payslips and evidence of lost earnings
4. Client to provide all receipts for out-of-pocket expenses
5. Solicitor to obtain GP and hospital records
6. Solicitor to advise on CFA funding at next appointment`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Ms Diallo. Before we start I want to confirm you are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days. Do you consent?", start: 29000, end: 47000 },
    { speaker: "SPEAKER_2", text: "Yes, that is fine.", start: 48000, end: 51000 },
    { speaker: "SPEAKER_1", text: "Good. Take me through what happened on the fourteenth of March.", start: 52000, end: 58000 },
    { speaker: "SPEAKER_2", text: "I was driving south on Lewisham High Street at approximately half past eight in the morning. I was on my way to work. I had stopped at traffic lights — they were on red. A vehicle came from behind and hit me. Hard. I was pushed forward into the car in front.", start: 59000, end: 88000 },
    { speaker: "SPEAKER_1", text: "Were you wearing your seatbelt?", start: 89000, end: 93000 },
    { speaker: "SPEAKER_2", text: "Yes. Always.", start: 94000, end: 97000 },
    { speaker: "SPEAKER_2", text: "I did not see it coming at all. The first thing I knew was the impact from behind. My head went forward and then back. I remember thinking my neck felt wrong immediately. There was a horrible pain across the top of my shoulders.", start: 104000, end: 128000 },
    { speaker: "SPEAKER_2", text: "The driver behind got out. He was on his phone — I think he had been looking at his phone when he drove into me. He apologised at the scene. We all exchanged details. I called the police because the damage was significant. A report was made.", start: 135000, end: 164000 },
    { speaker: "SPEAKER_2", text: "An ambulance attended. They recommended I attend A&E given the neck pain. I went to Lewisham Hospital that afternoon. X-rays showed no fracture. Diagnosis was soft tissue injury — whiplash — to the cervical spine.", start: 171000, end: 200000 },
    { speaker: "SPEAKER_2", text: "The first two weeks were very bad. I could not turn my head properly. I needed help washing my hair. I took two weeks off work — I am a nursery nurse. After two weeks I went back but was on restricted duties for another three weeks. My GP has referred me for physiotherapy — I have had four sessions so far.", start: 205000, end: 248000 },
    { speaker: "SPEAKER_2", text: "It was written off. My insurer dealt with the third party but they want me to use their recommended solicitor. I was not happy with that — I wanted independent advice.", start: 252000, end: 267000 },
    { speaker: "SPEAKER_1", text: "You were right to come here. You are entitled to your own legal representation. The third party's insurer has already been in contact — liability is not going to be contested. A rear-end shunt at a red light with a police report makes liability straightforward.", start: 268000, end: 298000 },
    { speaker: "SPEAKER_2", text: "What counts as losses?", start: 299000, end: 302000 },
    { speaker: "SPEAKER_1", text: "General damages — pain, suffering and loss of amenity. Special damages — your financial losses. Two weeks of lost earnings, travel costs, physiotherapy costs. I will commission an independent medico-legal report from an orthopaedic specialist. Cases of this type typically resolve in twelve to eighteen months.", start: 303000, end: 336000 },
    { speaker: "SPEAKER_2", text: "I have kept receipts. My payslips. I was careful because I thought this might happen.", start: 337000, end: 348000 },
    { speaker: "SPEAKER_2", text: "I just want to be fairly compensated. I am not trying to take advantage of anyone.", start: 368000, end: 378000 },
    { speaker: "SPEAKER_1", text: "That is the right approach. I will open the file today, write to Hastings Direct, and commission the medico-legal report.", start: 379000, end: 400000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session.id, content: transcriptContent,
    utterances, speakerCount: 2, redactions: [],
    createdAt: new Date(sessionDate.getTime() + 48 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Amara Diallo
**Matter:** Diallo v Insurers of Ahmed (RTA — 14 March)
**Reference:** HART_PI/2024/0512
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Claire Donnelly | **Duration:** 45 minutes

---

## ACCIDENT CIRCUMSTANCES

Date/time: 14 March, approximately 08:30. Location: Lewisham High Street, southbound. Client stationary at red traffic lights. Rear-end collision — third party struck client's vehicle, pushing it into vehicle in front. Third party driver admitted mobile phone use. Apology at scene. Police attended — report made. Third party insured with Hastings Direct.

---

## INJURIES

Immediate: severe cervical pain, restricted movement. A&E (Lewisham Hospital, same day). X-rays clear — no fracture. Diagnosis: soft tissue cervical spine injury (whiplash). Two weeks off work (nursery nurse — unsafe to work with restricted movement). Restricted duties for further three weeks on return. Ongoing discomfort on fatigue and prolonged sitting. GP referral to physiotherapy — 4 sessions to date.

---

## LOSSES

Lost earnings: 2 weeks at nursery nurse rate. Vehicle: written off — comprehensive insurer handling. Physiotherapy: NHS-referred (4 sessions, potential further). Travel costs: to be quantified. Client has retained all relevant receipts.

---

## LEGAL ANALYSIS

Liability: strong. Rear-end at red light, police report, at-scene admission — uncontested expected. Client correctly declined third-party insurer's recommended solicitor. Quantum: JCG soft tissue neck injury bracket (moderate/minor Category 2). Pre-Action Protocol for Personal Injury Claims applies.

---

## NEXT STEPS

1. Write to Hastings Direct — notice and preserve dashcam/CCTV evidence
2. Commission medico-legal report (orthopaedic specialist)
3. Obtain GP and hospital records
4. Client to provide payslips and expense receipts
5. Confirm CFA funding`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved",
    approvedAt: new Date(sessionDate.getTime() + 70 * 60 * 1000),
    createdAt: new Date(sessionDate.getTime() + 50 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(28), metadata: { practiceArea: "personal_injury_rta", matterReference: "HART_PI/2024/0512" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Instructions — RTA", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 29 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 48 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 2700 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 50 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(sessionDate.getTime() + 70 * 60 * 1000), metadata: { approvedBy: "Claire Donnelly" }, severity: "info" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}

// ─── Matter 7: Wills & Probate — Contested Estate ───────────────────────────

async function seedMatter7Whitfield(userId: string) {
  const sessionDate = daysAgoAt(42, 14, 30);

  const [newCase] = await db.insert(cases).values({
    title: "Estate of Gerald Whitfield (Deceased) — Contested",
    clientName: "Mrs Eleanor Whitfield",
    matterReference: "HART_PRO/2024/0334",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "wills_probate",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Other beneficiaries Robert Whitfield and Catherine Marsh — not current clients. Acting for named executor only. No conflict.",
    supervisorName: "James Hartwell",
    aiProcessingMetadata: {
      amlTriggers: [
        { label: "Disputed estate assets — potential undisclosed offshore account", category: "asset_concealment", excerpt: "Robert mentioned to me at the funeral that father had an account in the Channel Islands. I have never seen any statements for it and it is not in the will." }
      ]
    },
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Probate and Contested Estate",
    startedAt: sessionDate, durationSeconds: 3120, status: "completed", createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session.id, duration: 3120, recordedAt: sessionDate, expiresAt: sessionExpiry, deletedAt: sessionExpiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(sessionDate.getTime() + 48 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I record meetings to produce accurate attendance notes. The recording is confidential to your file and deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const transcriptContent = `Attendance Note — Estate of Gerald Whitfield (Deceased)
Client: Mrs Eleanor Whitfield (Executor and Beneficiary)
Matter Reference: HART_PRO/2024/0334
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: James Hartwell
Duration: Approximately 52 minutes

---

SOLICITOR: Good afternoon Mrs Whitfield. Before we begin I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is confidential to your file and deleted after seven days. Do you consent?

CLIENT: Yes. Gerald always said to me — write everything down. I think he would have approved.

SOLICITOR: I am sure he would. I am sorry for your loss. Your husband Gerald passed away three weeks ago. You are the named sole executor in his will?

CLIENT: Yes. The will was made eight years ago. I went with him to the solicitor. He was very clear about what he wanted.

SOLICITOR: The terms of the will?

CLIENT: The house goes to me absolutely. The investments — a portfolio with Hargreaves Lansdown — divided equally between myself, our son Robert, and our daughter Catherine. There are some personal items — watches, his father's cufflinks — specifically bequeathed to Robert. And there is a bequest to the RNLI.

SOLICITOR: The estate — approximate value?

CLIENT: The house is an Edwardian semi in Herne Hill. We had it valued last year — about eight hundred and fifty thousand. The investment portfolio at the last statement was around three hundred and forty thousand. There is a current account, savings account, some Premium Bonds. Total estate probably in the region of one point two million.

SOLICITOR: Is the house mortgaged?

CLIENT: No. We paid it off fifteen years ago.

SOLICITOR: Good. At one point two million, after the nil-rate band, there will be an inheritance tax liability. With the residential nil-rate band — the estate passes to you so the spousal exemption applies on your share. The division to the children will be subject to IHT. I will calculate the precise liability when we have the full asset schedule. Are Robert and Catherine in agreement with the terms of the will?

CLIENT: Catherine is fine. She accepts everything. Robert — Robert is the problem.

SOLICITOR: Tell me about Robert.

CLIENT: He says the will does not reflect what father told him. He says Gerald promised him the house when he was alive. Gerald never mentioned this to me and the will — which was made when Gerald had full capacity, eight years ago — does not say anything of the sort.

SOLICITOR: Has Robert said he intends to challenge the will?

CLIENT: He has instructed a solicitor. We received a letter last week from Morrison and Foyle saying Robert is investigating the circumstances of the will and reserves his right to bring a claim.

SOLICITOR: On what grounds? A proprietary estoppel claim perhaps — he was promised something and acted in reliance on it?

CLIENT: That might be what he is suggesting but he has not said specifically.

SOLICITOR: Proprietary estoppel requires three elements — a representation or assurance, reasonable reliance on that assurance, and detriment suffered in reliance. An alleged oral promise by a testator, unsupported by anything in writing, and contradicted by a properly executed will, is not a straightforward claim. But it is not impossible.

CLIENT: There is also a question about capacity. Robert has suggested — and I find this deeply upsetting — that Gerald did not have full capacity when the will was made. He was not diagnosed with dementia until two years ago. The will is eight years old.

SOLICITOR: If the will was made eight years ago and Gerald was not diagnosed until six years later, that is a very difficult case to establish. Testamentary capacity requires that the testator understood the nature of making a will, the extent of their estate, the natural objects of their bounty, and the claims of those persons. A diagnosis subsequent to the will by six years faces a very high evidential burden. Who prepared the will?

CLIENT: Hadley and Carmichael in Brixton. Mr Hadley himself. He knew Gerald well.

SOLICITOR: Good. I will write to Hadley and Carmichael today to obtain the will file and any attendance notes they have from the meeting at which the will was executed. A solicitor's contemporaneous notes on capacity are powerful evidence in any challenge.

CLIENT: There is one more thing Robert said at the funeral. He mentioned that father had an account in the Channel Islands. I have never seen any statements for it and it is not in the will. I do not know if it exists or what the value is.

SOLICITOR: That is significant in two respects. First, as a potential estate asset — if it exists it must be included in the estate for IHT purposes and probate. Second, I have an obligation to advise you that undisclosed offshore assets in an estate can give rise to reporting obligations. I am going to need to investigate this further. Do not distribute any estate assets until we have clarity on this.

CLIENT: I would not dream of it. Gerald was an honest man. If it exists it should be in the estate.

SOLICITOR: I am sure he was. But I need to ensure we handle it correctly.

---

ACTION ITEMS
1. Solicitor to apply for grant of probate — obtain death certificate and will
2. Solicitor to write to Hadley and Carmichael for will file and capacity notes
3. Solicitor to investigate Channel Islands account — write to known banks
4. Solicitor to calculate provisional IHT liability
5. Solicitor to write to Morrison and Foyle requesting particulars of Robert's claim
6. MLRO referral re Channel Islands account`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good afternoon Mrs Whitfield. Before we begin I want to confirm you are happy for me to record this meeting to produce your attendance note. The recording is confidential to your file and deleted after seven days. Do you consent?", start: 48000, end: 66000 },
    { speaker: "SPEAKER_2", text: "Yes. Gerald always said to me — write everything down. I think he would have approved.", start: 67000, end: 77000 },
    { speaker: "SPEAKER_1", text: "I am sure he would. I am sorry for your loss. You are the named sole executor in his will?", start: 78000, end: 88000 },
    { speaker: "SPEAKER_2", text: "Yes. The will was made eight years ago. I went with him to the solicitor. He was very clear about what he wanted.", start: 89000, end: 103000 },
    { speaker: "SPEAKER_2", text: "The house goes to me absolutely. The investments divided equally between myself, Robert, and Catherine. Some personal items to Robert specifically. And a bequest to the RNLI.", start: 108000, end: 135000 },
    { speaker: "SPEAKER_2", text: "The house is an Edwardian semi in Herne Hill — about eight hundred and fifty thousand. The investment portfolio around three hundred and forty thousand. Total estate probably one point two million.", start: 144000, end: 172000 },
    { speaker: "SPEAKER_2", text: "Catherine is fine. She accepts everything. Robert — Robert is the problem.", start: 193000, end: 200000 },
    { speaker: "SPEAKER_2", text: "He says the will does not reflect what father told him. He says Gerald promised him the house. Gerald never mentioned this to me and the will does not say anything of the sort.", start: 205000, end: 230000 },
    { speaker: "SPEAKER_2", text: "He has instructed a solicitor. We received a letter from Morrison and Foyle saying Robert is investigating the circumstances of the will and reserves his right to bring a claim.", start: 241000, end: 263000 },
    { speaker: "SPEAKER_1", text: "Proprietary estoppel requires three elements — a representation, reasonable reliance on that assurance, and detriment suffered in reliance. An alleged oral promise unsupported by anything in writing and contradicted by a properly executed will is not a straightforward claim.", start: 264000, end: 295000 },
    { speaker: "SPEAKER_2", text: "There is also a question about capacity. Robert has suggested — and I find this deeply upsetting — that Gerald did not have full capacity when the will was made. He was not diagnosed with dementia until two years ago. The will is eight years old.", start: 296000, end: 322000 },
    { speaker: "SPEAKER_1", text: "A will made eight years ago with a diagnosis six years later faces a very high evidential burden. Who prepared the will?", start: 323000, end: 340000 },
    { speaker: "SPEAKER_2", text: "Hadley and Carmichael in Brixton. Mr Hadley himself. He knew Gerald well.", start: 341000, end: 351000 },
    { speaker: "SPEAKER_1", text: "I will write to Hadley and Carmichael today to obtain the will file and any attendance notes from the meeting at which the will was executed. A solicitor's contemporaneous notes on capacity are powerful evidence in any challenge.", start: 352000, end: 374000 },
    { speaker: "SPEAKER_2", text: "There is one more thing Robert said at the funeral. He mentioned that father had an account in the Channel Islands. I have never seen any statements for it and it is not in the will.", start: 375000, end: 395000 },
    { speaker: "SPEAKER_1", text: "That is significant. If it exists it must be included in the estate for IHT and probate. I have an obligation to advise you that undisclosed offshore assets in an estate can give rise to reporting obligations. Do not distribute any estate assets until we have clarity.", start: 396000, end: 424000 },
    { speaker: "SPEAKER_2", text: "I would not dream of it. Gerald was an honest man. If it exists it should be in the estate.", start: 425000, end: 437000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session.id, content: transcriptContent,
    utterances, speakerCount: 2, redactions: [],
    createdAt: new Date(sessionDate.getTime() + 56 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Mrs Eleanor Whitfield (Executor and Residuary Beneficiary)
**Matter:** Estate of Gerald Whitfield (Deceased)
**Reference:** HART_PRO/2024/0334
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** James Hartwell | **Duration:** 52 minutes

---

## ESTATE DETAILS

Deceased: Gerald Whitfield. Date of death: three weeks ago. Will dated 8 years ago — prepared by Hadley and Carmichael, Brixton (Mr Hadley). Client is sole named executor. Estimated estate: £1.2m (house ~£850k, investment portfolio ~£340k, current/savings accounts, Premium Bonds). House unencumbered.

---

## WILL PROVISIONS

Matrimonial home: to Mrs Whitfield absolutely. Investment portfolio (Hargreaves Lansdown): equally between Mrs Whitfield, Robert Whitfield, Catherine Marsh. Personal items: to Robert Whitfield. Charitable bequest: RNLI.

---

## CONTESTED ELEMENTS

**Robert Whitfield:** Instructed Morrison and Foyle. Letter received reserving right to bring claim. Two potential heads: (1) Proprietary estoppel — alleged oral promise of house. No written evidence, contradicted by valid will. (2) Testamentary capacity — alleges lack of capacity. Dementia diagnosis was 2 years ago; will is 8 years old. High evidential burden.

**Catherine Marsh:** No objection.

---

## OFFSHORE ASSET — AML FLAG

Client reports Robert mentioned at funeral a Channel Islands account not in the will. Existence unconfirmed. If asset exists: must be included in estate for IHT. Potential reporting obligations — MLRO referral required. No estate assets to be distributed pending investigation.

---

## NEXT STEPS

1. Apply for grant of probate
2. Write to Hadley and Carmichael for will file and capacity notes
3. Investigate Channel Islands account
4. MLRO referral
5. Calculate provisional IHT liability
6. Write to Morrison and Foyle for particulars of Robert's claim`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "draft",
    createdAt: new Date(sessionDate.getTime() + 58 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(42), metadata: { practiceArea: "wills_probate", matterReference: "HART_PRO/2024/0334" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Instructions — Probate", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 48 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 56 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 3120 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 58 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "aml_flag_raised", timestamp: new Date(sessionDate.getTime() + 60 * 60 * 1000), metadata: { flagCount: 1, categories: ["asset_concealment"], referredToMLRO: true, note: "Potential undisclosed Channel Islands account — investigation required before estate distributed" }, severity: "critical" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}

// ─── Matter 8: Criminal Defence ─────────────────────────────────────────────

async function seedMatter8Callahan(userId: string) {
  const sessionDate = daysAgoAt(5, 16, 0);
  const hearingDate = daysFromNow(28);

  const [newCase] = await db.insert(cases).values({
    title: "R v Callahan — GBH s.18 (Crown Court)",
    clientName: "Ryan Callahan",
    matterReference: "HART_CRI/2024/0089",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "criminal_defence",
    riskLevel: "high",
    conflictCheckCompleted: true,
    conflictCheckNote: "Complainant not a current or former client. No connection to prosecution witnesses. Conflict clear.",
    deadline: hearingDate,
    litigationHold: true,
    litigationHoldAppliedAt: daysAgo(5),
    litigationHoldReason: "Crown Court matter — all records to be preserved for disclosure purposes.",
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting",
    sessionTitle: "Conference in Chambers — Pre-Trial Preparation",
    startedAt: sessionDate, durationSeconds: 3180, status: "completed", createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session.id, duration: 3180, recordedAt: sessionDate, expiresAt: sessionExpiry, deletedAt: sessionExpiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(sessionDate.getTime() + 44 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I am recording this conference to produce an accurate attendance note for your file. The recording is confidential and deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const transcriptContent = `Attendance Note — R v Callahan — GBH s.18
Client: Ryan Callahan
Matter Reference: HART_CRI/2024/0089
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Daniel Park
Duration: Approximately 53 minutes

---

SOLICITOR: Mr Callahan, before we begin I want to confirm you are happy for me to record this conference for note-taking purposes. The recording is confidential to your file and deleted after seven days. Do you consent?

CLIENT: Yes. I want everything recorded. I want everything on the record.

SOLICITOR: Understood. You are charged with grievous bodily harm with intent under section 18 of the Offences Against the Person Act 1861. The trial is listed at Southwark Crown Court in twenty-eight days. You have counsel — Mr Obi Adeyinka of 3 Harcourt Buildings — instructed and ready.

The prosecution case: the incident occurred outside the Anchor public house on a Saturday evening. The complainant, Mr Trent, sustained a fractured orbital bone to the left eye socket, a broken nose, and lacerations requiring twelve stitches. He says you attacked him without provocation. There is CCTV footage from the exterior of the Anchor. I have reviewed it. The footage shows a confrontation and then a physical altercation. It is not entirely clear from the footage who was the initial aggressor.

CLIENT: That is the whole point. He came at me. He was aggressive all evening. He had been making comments about my girlfriend inside the pub. I asked him to stop. He followed me outside. He pushed me first.

SOLICITOR: The CCTV — from the angle, the initial push is partially obscured. Two prosecution witnesses have given statements saying they saw you strike first. Both are friends of the complainant. Were there any other people outside at the time who might support your account?

CLIENT: There was a couple leaving. A man and a woman. I do not know who they are. The woman seemed shocked — she grabbed the man and pulled him away. They might have seen what happened.

SOLICITOR: I will instruct an investigator to make enquiries in the area. If those witnesses exist and can be found, their account of the initial aggressor could be determinative.

The defence of self-defence — I want to be direct with you. The jury will be asked to consider whether you genuinely believed force was necessary and whether the force used was reasonable in the circumstances. A fractured orbital bone and a broken nose is significant injury. The jury will need to understand why that level of force was proportionate to the threat you perceived.

CLIENT: He is bigger than me. He was drunk. He was aggressive. I was scared. I reacted.

SOLICITOR: That is the narrative and it is credible. A section 18 charge requires the prosecution to prove intent. The level of injury is relevant to that question. Our barrister will argue the injury is consistent with a single strike in self-defence that caused more damage than anticipated.

CLIENT: I only hit him once.

SOLICITOR: That is important. The CCTV is consistent with that — it shows one strike. Do you have any previous convictions I need to know about?

CLIENT: I have a caution from eight years ago. Drunk and disorderly. Nothing else.

SOLICITOR: A caution from eight years ago — depending on how it was obtained, it may not be admissible. I will review this. Your character evidence — no convictions — is a significant asset. The jury will be directed that a defendant of good character is more likely to be telling the truth and less likely to have committed the offence.

CLIENT: What are my chances?

SOLICITOR: I am not going to give you a percentage. What I will say is this — the CCTV does not establish you as the initial aggressor. Your account is consistent and has not changed. There are potential civilian witnesses. The prosecution witnesses are interested parties. A section 18 charge is serious but it is not unanswerable. Mr Adeyinka is an experienced Crown Court advocate. This is a case that can be won.

CLIENT: My girlfriend — can she give evidence?

SOLICITOR: She was inside the pub during the incident. She can give evidence about the complainant's behaviour towards you and her inside the pub — that goes to background context and your state of mind when you went outside. I will take a witness statement from her this week.

---

ACTION ITEMS
1. Solicitor to instruct inquiry agent — identify and locate civilian witnesses
2. Solicitor to take witness statement from client's girlfriend this week
3. Solicitor to review caution — admissibility assessment
4. Update counsel with conference notes
5. Review prosecution disclosure schedule
6. Pre-trial review with counsel — end of this week`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Mr Callahan, before we begin I want to confirm you are happy for me to record this conference for note-taking purposes. The recording is confidential to your file and deleted after seven days. Do you consent?", start: 44000, end: 62000 },
    { speaker: "SPEAKER_2", text: "Yes. I want everything recorded. I want everything on the record.", start: 63000, end: 70000 },
    { speaker: "SPEAKER_1", text: "Understood. You are charged with grievous bodily harm with intent under section 18. The trial is listed at Southwark Crown Court in twenty-eight days. The prosecution case: the incident occurred outside the Anchor public house. The complainant sustained a fractured orbital bone, a broken nose, and lacerations requiring twelve stitches. He says you attacked him without provocation. There is CCTV footage. It is not entirely clear from the footage who was the initial aggressor.", start: 71000, end: 128000 },
    { speaker: "SPEAKER_2", text: "That is the whole point. He came at me. He was aggressive all evening. He had been making comments about my girlfriend inside the pub. I asked him to stop. He followed me outside. He pushed me first.", start: 129000, end: 153000 },
    { speaker: "SPEAKER_1", text: "The CCTV — from the angle, the initial push is partially obscured. Two prosecution witnesses say they saw you strike first. Both are friends of the complainant. Were there any other people outside who might support your account?", start: 154000, end: 176000 },
    { speaker: "SPEAKER_2", text: "There was a couple leaving. A man and a woman. I do not know who they are. The woman seemed shocked — she grabbed the man and pulled him away. They might have seen what happened.", start: 177000, end: 197000 },
    { speaker: "SPEAKER_1", text: "I will instruct an investigator to make enquiries. The defence of self-defence — the jury will consider whether you genuinely believed force was necessary and whether the force used was reasonable. A fractured orbital bone and a broken nose is significant injury.", start: 198000, end: 232000 },
    { speaker: "SPEAKER_2", text: "He is bigger than me. He was drunk. He was aggressive. I was scared. I reacted.", start: 233000, end: 245000 },
    { speaker: "SPEAKER_1", text: "That is the narrative and it is credible. A section 18 charge requires the prosecution to prove intent. Our barrister will argue the injury is consistent with a single strike in self-defence.", start: 246000, end: 275000 },
    { speaker: "SPEAKER_2", text: "I only hit him once.", start: 276000, end: 279000 },
    { speaker: "SPEAKER_1", text: "That is important. The CCTV is consistent with that — it shows one strike. Do you have any previous convictions?", start: 280000, end: 296000 },
    { speaker: "SPEAKER_2", text: "I have a caution from eight years ago. Drunk and disorderly. Nothing else.", start: 297000, end: 307000 },
    { speaker: "SPEAKER_1", text: "Your character evidence — no convictions — is a significant asset. The CCTV does not establish you as the initial aggressor. Your account is consistent. There are potential civilian witnesses. The prosecution witnesses are interested parties. This is a case that can be won.", start: 308000, end: 372000 },
    { speaker: "SPEAKER_2", text: "My girlfriend — can she give evidence?", start: 373000, end: 378000 },
    { speaker: "SPEAKER_1", text: "She was inside the pub during the incident. She can give evidence about the complainant's behaviour towards you and her inside the pub — that goes to background context and your state of mind. I will take a witness statement from her this week.", start: 379000, end: 403000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session.id, content: transcriptContent,
    utterances, speakerCount: 2, redactions: [],
    createdAt: new Date(sessionDate.getTime() + 57 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE — CONFERENCE IN CHAMBERS

**Client:** Ryan Callahan
**Matter:** R v Callahan — GBH s.18 (Crown Court)
**Reference:** HART_CRI/2024/0089
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Daniel Park | **Present:** Daniel Park, Ryan Callahan
**Duration:** 53 minutes | **Trial:** Southwark Crown Court — 28 days

---

## CHARGE

Grievous bodily harm with intent — s.18 Offences Against the Person Act 1861.

---

## PROSECUTION CASE

Incident: outside Anchor public house, Saturday evening. Complainant (Mr Trent): fractured orbital bone (left), broken nose, 12 stitches. CCTV: exterior — confrontation and physical altercation. Initial aggressor not clearly identifiable from footage angle. Two prosecution witnesses: both friends of complainant — state defendant struck first.

---

## DEFENCE CASE

Complainant aggressive throughout evening, made repeated comments about defendant's girlfriend. Defendant asked him to stop. Complainant followed defendant outside. Complainant pushed defendant first. Defendant struck in self-defence — one strike. CCTV consistent with single strike.

Potential civilian witnesses: unidentified couple at scene. Inquiry agent to be instructed.

---

## LEGAL ANALYSIS

**Intent (s.18):** Prosecution must prove intent to cause GBH. Defence: single strike in self-defence — injury beyond what was anticipated. CCTV confirms one strike — undermines inference of intent.

**Self-Defence:** Credible basis — complainant larger, drunk, aggressive, initial aggressor. Jury question.

**Character:** Caution (8 years — drunk and disorderly). Admissibility to be assessed. If inadmissible — good character direction applies.

---

## COUNSEL

Mr Obi Adeyinka, 3 Harcourt Buildings. Instructed and ready.

---

## NEXT STEPS

1. Instruct inquiry agent — civilian witnesses
2. Witness statement from defendant's girlfriend
3. Assess admissibility of caution
4. Update counsel
5. Review prosecution disclosure schedule
6. Pre-trial review with counsel this week`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "draft",
    createdAt: new Date(sessionDate.getTime() + 59 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(5), metadata: { practiceArea: "criminal_defence", matterReference: "HART_CRI/2024/0089" }, severity: "info" as const },
    { eventType: "case_updated", timestamp: daysAgo(5), metadata: { field: "litigationHold", value: true, reason: "Crown Court matter — records preserved for disclosure" }, severity: "warning" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Conference in Chambers", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 44 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 57 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 3180 }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 59 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}

// ─── Matter 9: Immigration ───────────────────────────────────────────────────

async function seedMatter9AlRashidi(userId: string) {
  const sessionDate = daysAgoAt(18, 13, 0);

  const [newCase] = await db.insert(cases).values({
    title: "Al-Rashidi — Application for Further Leave to Remain (Human Rights)",
    clientName: "Fatima Al-Rashidi",
    matterReference: "HART_IMM/2024/0641",
    createdBy: userId,
    status: "review_required",
    priority: "high",
    sourceType: "audio",
    practiceArea: "immigration",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "No conflict identified.",
    supervisorName: "James Hartwell",
  }).returning();

  const [session] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting",
    sessionTitle: "Initial Consultation — Leave to Remain Application (with interpreter)",
    startedAt: sessionDate, durationSeconds: 3000, status: "completed", createdBy: userId,
  }).returning();

  const sessionExpiry = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session.id, duration: 3000, recordedAt: sessionDate, expiresAt: sessionExpiry, deletedAt: sessionExpiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(sessionDate.getTime() + 62 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I am recording this meeting to produce an accurate attendance note for your file. The recording is confidential and deleted after seven days. The interpreter has also consented to the recording. Do you both consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const transcriptContent = `Attendance Note — Al-Rashidi — Leave to Remain Application
Client: Fatima Al-Rashidi
Matter Reference: HART_IMM/2024/0641
Date: ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: Sarah Okafor
Interpreter: Nadia Karimov (Arabic — Levantine dialect)
Duration: Approximately 50 minutes

---

SOLICITOR: Good afternoon. Before we begin I want to confirm both you and the interpreter are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days.

INTERPRETER: [Translating to client]

CLIENT: [Via interpreter] Yes. She says yes, she is happy.

SOLICITOR: Thank you. Mrs Al-Rashidi, I understand you came to the UK four years ago from Syria. You have leave to remain which expires in six weeks. Can you tell me about your situation?

CLIENT: [Via interpreter] She came in 2020. She had humanitarian protection for three years. This was extended once, by one year. It expires at the end of next month. She has three children. Her oldest is fourteen, in secondary school. The youngest is six, in primary. Her husband — he did not come with her. He died in 2022. She received confirmation from the Red Cross.

SOLICITOR: I am sorry for her loss. And in Syria — what is her situation if she were to return?

CLIENT: [Via interpreter] She says she cannot return. Her home — it no longer exists. The city where she lived — she has seen photographs from relatives, there is nothing there. Her brother-in-law is also here in the UK. Her children were born partly here — the youngest was born in London. She has no family remaining in Syria. She has built a life here. Her children speak English, they are doing well at school. Her oldest received an award at school last term.

SOLICITOR: Does she work?

CLIENT: [Via interpreter] She volunteers at her youngest child's school — helping with reading. She also volunteers at a local food bank on Wednesdays. She has been trying to learn English — she attends a community class twice a week. She is getting better but she still needs support with complex documents.

SOLICITOR: Her current leave is humanitarian protection. Article 8 — family and private life — given four years of residence, three children, one UK-born, integration into the community, bereavement, and the absence of any remaining family or stable situation in Syria — the Article 8 claim is substantial. Is she from any particular area that would put her at additional risk?

CLIENT: [Via interpreter] She is from Aleppo. She was there in 2013 to 2015 during the siege. She and her husband fled to Turkey and then came to the UK after two years in Turkey. She says there were very bad things that happened. She does not want to speak about the details today. She says she is not ready.

SOLICITOR: She does not have to. I will note that further details of her experiences in Aleppo may be relevant to the application and she can share them when she is ready. There is no pressure. What I want to do now is begin assembling the supporting evidence. I will need her current BRP card, the letter confirming her humanitarian protection, the Red Cross confirmation for her husband, school records for all three children, and evidence of her community involvement.

CLIENT: [Via interpreter] She says she has brought documents today. She has the BRP, the protection letter, the Red Cross document, school reports for the oldest two, and a letter from the school about volunteering.

SOLICITOR: That is a very strong start. I will also commission a country conditions report on Syria and a psychological report on the impact on her and the children. That would strengthen the Article 8 claim significantly.

CLIENT: [Via interpreter] She says she would be willing to speak to a psychologist but asks if it can be a woman.

SOLICITOR: Absolutely. I will ensure the psychologist I instruct is a woman.

CLIENT: [Via interpreter] She says — she wants her children to be able to stay. That is all she wants. She is not asking for anything else. Just to stay.

SOLICITOR: I understand. And I will do everything I can to make that case as strong as it can be.

---

ACTION ITEMS
1. Solicitor to take copies of documents provided today
2. Solicitor to draft Article 8 Leave to Remain application
3. Solicitor to commission country conditions report (Syria — Aleppo)
4. Solicitor to instruct female clinical psychologist
5. Solicitor to obtain letters from school and food bank
6. Advise on Legal Aid eligibility at next appointment
7. Note application deadline — 6 weeks`;

  const utterances = [
    { speaker: "SPEAKER_1", text: "Good afternoon. Before we begin I want to confirm both you and the interpreter are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days.", start: 62000, end: 80000 },
    { speaker: "SPEAKER_3", text: "[Translating consent request to client]", start: 81000, end: 86000 },
    { speaker: "SPEAKER_2", text: "Yes. She says yes, she is happy.", start: 87000, end: 92000 },
    { speaker: "SPEAKER_1", text: "Thank you. Mrs Al-Rashidi, I understand you came to the UK four years ago from Syria. You have leave to remain which expires in six weeks. Can you tell me about your situation?", start: 93000, end: 110000 },
    { speaker: "SPEAKER_3", text: "[Translating question to client]", start: 111000, end: 116000 },
    { speaker: "SPEAKER_2", text: "She came in 2020. She had humanitarian protection for three years. This was extended once, by one year. It expires at the end of next month. She has three children. Her oldest is fourteen, in secondary school. The youngest is six, in primary. Her husband — he did not come with her. He died in 2022. She received confirmation from the Red Cross.", start: 117000, end: 158000 },
    { speaker: "SPEAKER_1", text: "I am sorry for her loss. And in Syria — what is her situation if she were to return?", start: 159000, end: 168000 },
    { speaker: "SPEAKER_3", text: "[Translating to client]", start: 169000, end: 173000 },
    { speaker: "SPEAKER_2", text: "She says she cannot return. Her home — it no longer exists. The city where she lived — she has seen photographs, there is nothing there. Her youngest was born in London. She has no family remaining in Syria. Her children speak English, they are doing well at school. Her oldest received an award at school last term.", start: 174000, end: 225000 },
    { speaker: "SPEAKER_3", text: "[Translating to client]", start: 233000, end: 236000 },
    { speaker: "SPEAKER_2", text: "She volunteers at her youngest child's school — helping with reading. She also volunteers at a local food bank on Wednesdays. She attends an English community class twice a week.", start: 237000, end: 272000 },
    { speaker: "SPEAKER_1", text: "Article 8 — family and private life — given four years of residence, three children, one UK-born, integration, bereavement, and absence of any remaining family or stable situation in Syria — the Article 8 claim is substantial. Is she from any particular area that would put her at additional risk?", start: 273000, end: 310000 },
    { speaker: "SPEAKER_3", text: "[Translating to client]", start: 311000, end: 316000 },
    { speaker: "SPEAKER_2", text: "She is from Aleppo. She was there in 2013 to 2015 during the siege. She and her husband fled to Turkey and then came to the UK after two years in Turkey. She says there were very bad things that happened. She does not want to speak about the details today. She says she is not ready.", start: 317000, end: 355000 },
    { speaker: "SPEAKER_1", text: "She does not have to. I will note that further details of her experiences in Aleppo may be relevant and she can share them when she is ready. There is no pressure. I will need her current BRP card, the protection letter, the Red Cross confirmation, school records, and evidence of her community involvement.", start: 356000, end: 395000 },
    { speaker: "SPEAKER_3", text: "[Translating to client]", start: 396000, end: 401000 },
    { speaker: "SPEAKER_2", text: "She says she has brought documents today. She has the BRP, the protection letter, the Red Cross document, school reports for the oldest two, and a letter from the school about volunteering.", start: 402000, end: 423000 },
    { speaker: "SPEAKER_1", text: "That is a very strong start. I will also commission a country conditions report on Syria and a psychological report on the impact on her and the children.", start: 424000, end: 450000 },
    { speaker: "SPEAKER_3", text: "[Translating to client]", start: 451000, end: 455000 },
    { speaker: "SPEAKER_2", text: "She says she would be willing to speak to a psychologist but asks if it can be a woman.", start: 456000, end: 466000 },
    { speaker: "SPEAKER_1", text: "Absolutely. I will ensure the psychologist I instruct is a woman.", start: 467000, end: 476000 },
    { speaker: "SPEAKER_3", text: "[Translating response to client]", start: 477000, end: 480000 },
    { speaker: "SPEAKER_2", text: "She says — she wants her children to be able to stay. That is all she wants. She is not asking for anything else. Just to stay.", start: 481000, end: 498000 },
    { speaker: "SPEAKER_1", text: "I understand. And I will do everything I can to make that case as strong as it can be.", start: 499000, end: 509000 },
  ];

  const [transcript] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session.id, content: transcriptContent,
    utterances, speakerCount: 3, redactions: [],
    createdAt: new Date(sessionDate.getTime() + 54 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** Fatima Al-Rashidi
**Interpreter:** Nadia Karimov (Arabic — Levantine dialect)
**Matter:** Application for Further Leave to Remain (Human Rights — Article 8)
**Reference:** HART_IMM/2024/0641
**Date:** ${sessionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** Sarah Okafor | **Duration:** 50 minutes

---

## CLIENT BACKGROUND

Nationality: Syrian. Location: Aleppo (fled 2015). Route: Turkey (2 years) → UK (2020). Immigration history: 3-year humanitarian protection, extended 1 year. Current leave expires: end of next month (~6 weeks). Widowed: husband deceased 2022 — Red Cross confirmation.

---

## FAMILY

Three children: aged 14, 9, and 6. Two born in Syria, one (youngest, age 6) born in London. All three in UK education — eldest in secondary school. Children English-speaking and well-integrated. Eldest received school award.

---

## COMMUNITY INTEGRATION

Volunteering: school reading support (weekly), food bank (Wednesdays). English language classes: twice weekly — progressing but requires support for complex documents. UK residence: 4 years. No family remaining in Syria.

---

## BASIS OF APPLICATION

**Primary: Article 8 ECHR (Family and Private Life)**
Four years' residence. Three children — one UK-born. Complete absence of family or viable conditions in Syria. Widowed. Community integration. Article 8 claim is substantial.

**Secondary: Continuing Humanitarian Protection**
Country conditions in Syria — Aleppo in particular — remain severe. Client present during 2013-2015 siege. Client not yet ready to disclose full details of experiences — noted for future appointment. No pressure applied.

---

## IMPORTANT NOTE

Client experienced significant trauma in Aleppo 2013-2015. Client not ready to disclose details today — noted with sensitivity. Future appointment to be arranged when client feels ready.

---

## NEXT STEPS

1. Copy documents provided today
2. Draft Article 8 application
3. Commission country conditions report (Aleppo focus)
4. Instruct female clinical psychologist
5. Obtain letters from school and food bank
6. Legal Aid eligibility to be confirmed
7. Application deadline: 6 weeks`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "draft",
    createdAt: new Date(sessionDate.getTime() + 56 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(18), metadata: { practiceArea: "immigration", matterReference: "HART_IMM/2024/0641" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: sessionDate, metadata: { sessionTitle: "Initial Consultation with Interpreter", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(sessionDate.getTime() + 62 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent", note: "Consent given by client via interpreter. Interpreter also consented." }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(sessionDate.getTime() + 54 * 60 * 1000), metadata: { speakerCount: 3, durationSeconds: 3000, note: "Three-speaker diarisation: solicitor, interpreter, client (via interpreter)" }, transcriptId: transcript.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(sessionDate.getTime() + 56 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}

// ─── Matter 10: Commercial Litigation ───────────────────────────────────────

async function seedMatter10Northgate(userId: string) {
  const session1Date = daysAgoAt(56, 9, 0);
  const session2Date = daysAgoAt(21, 14, 0);

  const [newCase] = await db.insert(cases).values({
    title: "Northgate Freight Ltd v Vantage Logistics Group Ltd",
    clientName: "Northgate Freight Ltd",
    matterReference: "HART_LIT/2024/0278",
    createdBy: userId,
    status: "active",
    priority: "high",
    sourceType: "audio",
    practiceArea: "corporate_commercial",
    riskLevel: "medium",
    conflictCheckCompleted: true,
    conflictCheckNote: "Vantage Logistics Group Ltd — not a current or former client. No connection identified. Conflict clear.",
    reviewed: true,
    supervisorName: "James Hartwell",
  }).returning();

  const [session1] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting",
    sessionTitle: "Initial Instructions — Breach of Logistics Contract",
    startedAt: session1Date, durationSeconds: 2880, status: "completed", createdBy: userId,
  }).returning();

  const s1Expiry = new Date(session1Date.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session1.id, duration: 2880, recordedAt: session1Date, expiresAt: s1Expiry, deletedAt: s1Expiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(session1Date.getTime() + 36 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I record meetings to produce accurate attendance notes. The recording is confidential to your file and deleted after seven days. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const s1Content = `Attendance Note — Northgate Freight Ltd v Vantage Logistics Group Ltd
Client: David Achebe (Managing Director, Northgate Freight Ltd)
Matter Reference: HART_LIT/2024/0278
Date: ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: James Hartwell
Duration: Approximately 48 minutes

---

SOLICITOR: Good morning Mr Achebe. Before we begin I want to confirm you are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days. Do you consent?

CLIENT: Yes, that is fine.

SOLICITOR: Good. Tell me what has happened.

CLIENT: We had a three-year contract with Vantage Logistics Group for the warehousing and distribution of our electrical components. The contract started in January 2022 and runs to December this year. The contract value is approximately two point four million over the term. Last September, Vantage gave us notice that they were terminating the contract effective March this year. The notice was six months. But the contract requires twelve months notice for termination.

SOLICITOR: So the termination notice was defective.

CLIENT: On its face, yes. They say there is a break clause that was triggered. We say the break clause conditions were not met.

SOLICITOR: What are the break clause conditions?

CLIENT: The break clause is exercisable if either party's revenue from the contract falls below a defined threshold for two consecutive quarters. Vantage says our volume of business with them fell below the threshold in Q2 and Q3 of last year. We dispute that. The volume figures they rely on exclude certain categories of goods that we say are within the scope of the contract.

SOLICITOR: Have you seen their calculation?

CLIENT: Yes. They sent it with the termination notice. They exclude what they call spot freight — ad hoc deliveries that were not part of the original agreed volume. We say spot freight is contractually included. We have been paying the contractual rate for spot freight throughout and Vantage has been accepting it. If spot freight is included in the volume calculation, the threshold was not breached.

SOLICITOR: What is the value of spot freight over the relevant period?

CLIENT: Approximately four hundred thousand pounds of the two-point-four million. Without it, yes, the threshold is arguably breached. With it, it is not.

SOLICITOR: So the heart of the case is a contractual interpretation dispute. What does the contract say about spot freight?

CLIENT: The contract defines the services as including — standard warehousing and distribution services as set out in Schedule 1, together with any ancillary or supplemental services agreed between the parties from time to time. We say spot freight falls within ancillary or supplemental services.

SOLICITOR: And Vantage says?

CLIENT: They say spot freight was always treated as a separate commercial arrangement and was never included in the Schedule 1 services or the revenue threshold.

SOLICITOR: This will come down to the construction of the contract and, if the language is ambiguous, potentially extrinsic evidence — the parties' course of dealing. The consistent payment and acceptance of spot freight at the contractual rate over three years is highly relevant. Do you have a paper trail?

CLIENT: Complete records. Every invoice, every payment, every delivery note. Three years of it.

SOLICITOR: That is the strongest possible position on course of dealing. The phrase ancillary or supplemental services agreed between the parties from time to time is in your favour — it is broad and forward-looking.

CLIENT: So what are our options?

SOLICITOR: Three. First — letter before action, inviting Vantage to withdraw the termination notice and continue the contract to its natural term. Second — if they maintain their position, we issue proceedings in the Commercial Court for wrongful termination and damages. Damages: the lost revenue for the remainder of the contract term — nine months at approximately seventy thousand per month — approximately six hundred and thirty thousand. Third — mediation. Given the contract has nine months to run, mediation may be pragmatic.

CLIENT: The relationship is finished whatever happens. They have already moved our stock to a different facility and we have had to find alternative logistics at short notice at additional cost. The additional cost alone is approximately forty-five thousand pounds.

SOLICITOR: That is a recoverable head of loss. Direct breach damages plus mitigation costs gives you approximately six hundred and seventy-five thousand in total. I will write the letter before action today.

---

ACTION ITEMS
1. Solicitor to write letter before action to Vantage — today
2. Client to provide full contract documentation including schedules
3. Client to provide all spot freight invoices and payment records
4. Solicitor to calculate total damages
5. Client to provide evidence of additional logistics costs`;

  const s1Utterances = [
    { speaker: "SPEAKER_1", text: "Good morning Mr Achebe. Before we begin I want to confirm you are happy for me to record this meeting for note-taking purposes. The recording is confidential and deleted after seven days. Do you consent?", start: 36000, end: 54000 },
    { speaker: "SPEAKER_2", text: "Yes, that is fine.", start: 55000, end: 58000 },
    { speaker: "SPEAKER_1", text: "Good. Tell me what has happened.", start: 59000, end: 63000 },
    { speaker: "SPEAKER_2", text: "We had a three-year contract with Vantage Logistics Group for the warehousing and distribution of our electrical components. The contract started in January 2022 and runs to December this year. The contract value is approximately two point four million over the term. Last September, Vantage gave us notice terminating the contract effective March this year. The notice was six months. But the contract requires twelve months notice for termination.", start: 64000, end: 108000 },
    { speaker: "SPEAKER_1", text: "So the termination notice was defective.", start: 109000, end: 114000 },
    { speaker: "SPEAKER_2", text: "On its face, yes. They say there is a break clause that was triggered. We say the break clause conditions were not met.", start: 115000, end: 129000 },
    { speaker: "SPEAKER_2", text: "The break clause is exercisable if revenue from the contract falls below a defined threshold for two consecutive quarters. Vantage says our volume fell below the threshold in Q2 and Q3 of last year. We dispute that. Approximately four hundred thousand pounds of the two-point-four million is spot freight. Without it, the threshold is arguably breached. With it, it is not.", start: 135000, end: 210000 },
    { speaker: "SPEAKER_1", text: "This will come down to construction of the contract and potentially extrinsic evidence — the parties' course of dealing. The consistent payment and acceptance of spot freight at the contractual rate over three years is highly relevant. Do you have a paper trail?", start: 263000, end: 290000 },
    { speaker: "SPEAKER_2", text: "Complete records. Every invoice, every payment, every delivery note. Three years of it.", start: 291000, end: 303000 },
    { speaker: "SPEAKER_1", text: "That is the strongest possible position on course of dealing. Three options: letter before action, Commercial Court proceedings for wrongful termination, or mediation.", start: 304000, end: 340000 },
    { speaker: "SPEAKER_2", text: "The relationship is finished whatever happens. They have already moved our stock to a different facility. The additional cost alone is approximately forty-five thousand pounds.", start: 341000, end: 368000 },
    { speaker: "SPEAKER_1", text: "That is a recoverable head of loss. Direct breach damages plus mitigation costs gives you approximately six hundred and seventy-five thousand. I will write the letter before action today.", start: 369000, end: 393000 },
  ];

  const [transcript1] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session1.id, content: s1Content,
    utterances: s1Utterances, speakerCount: 2, redactions: [],
    createdAt: new Date(session1Date.getTime() + 52 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session1.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE

**Client:** David Achebe (Managing Director, Northgate Freight Ltd)
**Matter:** Northgate Freight Ltd v Vantage Logistics Group Ltd
**Reference:** HART_LIT/2024/0278
**Date:** ${session1Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** James Hartwell | **Duration:** 48 minutes

---

## FACTUAL BACKGROUND

3-year warehousing and distribution contract (January 2022 — December current year). Total contract value approximately £2.4m. September: Vantage served termination notice effective March, giving 6 months' notice. Contract requires 12 months' notice. Vantage relies on break clause.

---

## BREAK CLAUSE DISPUTE

Break clause: exercisable if revenue falls below defined threshold for two consecutive quarters. Vantage's calculation excludes spot freight (~£400k of £2.4m). Client's position: spot freight falls within "ancillary or supplemental services agreed between the parties from time to time." Spot freight invoiced at contractual rates and accepted by Vantage throughout — 3 years' course of dealing.

---

## EVIDENCE

Complete records of all spot freight invoicing and payment for full contract term. Course of dealing argument: strong.

---

## LEGAL ANALYSIS

Contractual construction — broad language arguably includes spot freight. Arnold v Britton [2015] UKSC 36 — if language ambiguous, extrinsic evidence (course of dealing) admissible.

Damages if wrongful termination: lost revenue (9 months × ~£70k) ~£630,000 + additional logistics costs ~£45,000 = **~£675,000 total**.

---

## NEXT STEPS

1. Letter before action — today
2. Client to provide full contract and all spot freight records
3. Client to provide evidence of additional logistics costs
4. Calculate total damages schedule`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved",
    approvedAt: new Date(session1Date.getTime() + 75 * 60 * 1000),
    createdAt: new Date(session1Date.getTime() + 54 * 60 * 1000),
  });

  // Session 2 — Without Prejudice
  const [session2] = await db.insert(meetingSessions).values({
    caseId: newCase.id, recordingType: "full_meeting",
    sessionTitle: "Without Prejudice Meeting — Settlement Discussions with Vantage",
    startedAt: session2Date, durationSeconds: 2700, status: "completed", createdBy: userId,
  }).returning();

  const s2Expiry = new Date(session2Date.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(audioRecordings).values({ caseId: newCase.id, meetingSessionId: session2.id, duration: 2700, recordedAt: session2Date, expiresAt: s2Expiry, deletedAt: s2Expiry, mimeType: "audio/webm" });
  await db.insert(consentLogs).values({ caseId: newCase.id, audioRecordingId: null, solicitorId: userId, consentGiven: true, consentTimestamp: new Date(session2Date.getTime() + 28 * 1000), disclaimerScriptVersion: "v2.1", disclaimerWordingText: "I am recording this meeting for note-taking purposes. The recording is confidential to your file and deleted after seven days. This meeting is conducted on a without prejudice basis. Do you consent?", consentModality: "verbal_recorded", lawfulBasis: "consent" });

  const s2Content = `Attendance Note — Northgate Freight — Without Prejudice Meeting
Client: David Achebe (MD, Northgate Freight Ltd)
Also Present: Timothy Frost (MD, Vantage Logistics Group Ltd), Helen Crane (Solicitor, Ward & Co — for Vantage)
Matter Reference: HART_LIT/2024/0278
Date: ${session2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
Fee Earner: James Hartwell
Duration: Approximately 45 minutes

NOTE: This meeting was conducted on a without prejudice basis. The contents of this attendance note are privileged and protected from disclosure in any proceedings.

---

HARTWELL: Good afternoon. I want to confirm on the record — both parties agree this meeting is conducted on a without prejudice basis and nothing said today can be relied upon in any proceedings without consent. Mr Frost, Ms Crane — agreed?

CRANE: Agreed on behalf of Vantage.

FROST: Agreed.

HARTWELL: Northgate's position — the termination notice is defective. The break clause was not validly triggered. Northgate is entitled to approximately six hundred and seventy-five thousand pounds. That is not an opening position. That is what our case is worth at trial.

CRANE: Vantage's position remains that spot freight was always treated commercially as outside the principal contract.

HARTWELL: I have seen the correspondence and it does not support that characterisation. Three years of consistent course of dealing. If there is correspondence that says otherwise I would expect it to have been disclosed before now.

CRANE: We are not here to argue the merits. We are here to explore whether there is a commercial resolution. What is Vantage's proposal?

FROST: [REDACTED — WITHOUT PREJUDICE]

HARTWELL: [REDACTED — WITHOUT PREJUDICE]

CRANE: Let me take instructions. Can we have fourteen days?

HARTWELL: You have fourteen days.

---

NOTE: Settlement figures exchanged between the parties. Contents protected by without prejudice privilege. Full details preserved in privileged vault — accessible to COLP only.

ACTION ITEMS
1. Await Vantage response to counter-proposal — 14-day deadline
2. If no acceptable offer — issue Commercial Court proceedings immediately
3. Brief counsel on without prejudice position`;

  const s2Utterances = [
    { speaker: "SPEAKER_1", text: "Good afternoon. I want to confirm on the record — both parties agree this meeting is conducted on a without prejudice basis and nothing said today can be relied upon in any proceedings without consent. Mr Frost, Ms Crane — agreed?", start: 28000, end: 50000 },
    { speaker: "SPEAKER_3", text: "Agreed on behalf of Vantage.", start: 51000, end: 55000 },
    { speaker: "SPEAKER_4", text: "Agreed.", start: 56000, end: 58000 },
    { speaker: "SPEAKER_1", text: "Northgate's position — the termination notice is defective. The break clause was not validly triggered. Northgate is entitled to approximately six hundred and seventy-five thousand pounds. That is not an opening position. That is what our case is worth at trial.", start: 59000, end: 100000 },
    { speaker: "SPEAKER_3", text: "Vantage's position remains that spot freight was always treated commercially as outside the principal contract.", start: 101000, end: 120000 },
    { speaker: "SPEAKER_1", text: "Three years of consistent course of dealing. If there is correspondence that says otherwise I would expect it to have been disclosed before now.", start: 121000, end: 143000 },
    { speaker: "SPEAKER_3", text: "We are not here to argue the merits. We are here to explore whether there is a commercial resolution.", start: 144000, end: 157000 },
    { speaker: "SPEAKER_4", text: "[Settlement figure offered — without prejudice]", start: 164000, end: 191000 },
    { speaker: "SPEAKER_1", text: "[Counter-proposal made — without prejudice]", start: 192000, end: 220000 },
    { speaker: "SPEAKER_3", text: "Let me take instructions. Can we have fourteen days?", start: 257000, end: 264000 },
    { speaker: "SPEAKER_1", text: "You have fourteen days.", start: 265000, end: 268000 },
  ];

  const wpRedactions = [{
    id: "rdx-wp-northgate-1",
    start: 164000,
    end: 256000,
    reasonType: "redaction_without_prejudice",
    reasonNotes: "Settlement figures exchanged in without prejudice meeting — redacted from shared transcript. Full content preserved in privileged vault for COLP access.",
    redactedBy: userId,
    timestamp: new Date(session2Date.getTime() + 52 * 60 * 1000).toISOString(),
    status: "committed",
    selectedText: null,
  }];

  const [transcript2] = await db.insert(transcripts).values({
    caseId: newCase.id, meetingSessionId: session2.id, content: s2Content,
    utterances: s2Utterances, speakerCount: 4, redactions: wpRedactions,
    privilegedRedactions: [{
      id: "rdx-wp-northgate-1",
      originalText: "Vantage offered two hundred and fifty thousand in full and final settlement. Northgate counter-proposed five hundred and fifty thousand with payment within twenty-eight days. No admission of liability required.",
      start: 164000, end: 256000,
      reasonType: "redaction_without_prejudice",
      committedAt: new Date(session2Date.getTime() + 52 * 60 * 1000).toISOString(),
    }],
    createdAt: new Date(session2Date.getTime() + 48 * 60 * 1000),
  }).returning();

  await db.insert(documents).values({
    caseId: newCase.id, meetingSessionId: session2.id, type: "attendance_note",
    content: `# ATTENDANCE NOTE — WITHOUT PREJUDICE MEETING

**⚠ SUBJECT TO WITHOUT PREJUDICE PRIVILEGE AND LEGAL PROFESSIONAL PRIVILEGE. NOT FOR DISCLOSURE WITHOUT EXPRESS AUTHORISATION.**

**Client:** Northgate Freight Ltd (David Achebe, MD)
**Also Present:** Timothy Frost (MD, Vantage Logistics Group Ltd); Helen Crane (Solicitor, Ward & Co)
**Reference:** HART_LIT/2024/0278
**Date:** ${session2Date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Fee Earner:** James Hartwell | **Duration:** 45 minutes

---

## BASIS OF MEETING

Without prejudice. All parties confirmed. Nothing in this note may be relied upon in proceedings without consent of all parties.

---

## NORTHGATE'S POSITION STATED

Termination notice defective. Break clause not validly triggered. Full claim value ~£675,000. Stated as case value at trial, not an opening position.

---

## SETTLEMENT DISCUSSIONS

[REDACTED — WITHOUT PREJUDICE] Settlement figures exchanged. Northgate counter-proposal made. Vantage to take instructions. 14-day deadline for response.

---

## NEXT STEPS

1. Await Vantage response within 14 days
2. If no acceptable offer — issue Commercial Court proceedings immediately
3. Brief counsel on WP position`,
    version: 1, versionType: "ai_generated", createdBy: userId, status: "approved",
    approvedAt: new Date(session2Date.getTime() + 65 * 60 * 1000),
    createdAt: new Date(session2Date.getTime() + 52 * 60 * 1000),
  });

  for (const evt of [
    { eventType: "case_created", timestamp: daysAgo(56), metadata: { practiceArea: "corporate_commercial", matterReference: "HART_LIT/2024/0278" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: session1Date, metadata: { sessionTitle: "Initial Instructions", recordingType: "full_meeting" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(session1Date.getTime() + 36 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(session1Date.getTime() + 52 * 60 * 1000), metadata: { speakerCount: 2, durationSeconds: 2880 }, transcriptId: transcript1.id, severity: "info" as const },
    { eventType: "document_generated", timestamp: new Date(session1Date.getTime() + 54 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1 }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(session1Date.getTime() + 75 * 60 * 1000), metadata: { approvedBy: "James Hartwell" }, severity: "info" as const },
    { eventType: "recording_started", timestamp: session2Date, metadata: { sessionTitle: "Without Prejudice Meeting", recordingType: "full_meeting", note: "Without prejudice — consent from all parties recorded" }, severity: "info" as const },
    { eventType: "consent_given", timestamp: new Date(session2Date.getTime() + 28 * 1000), metadata: { consentModality: "verbal_recorded", lawfulBasis: "consent", note: "All four participants consented" }, severity: "info" as const },
    { eventType: "transcript_generated", timestamp: new Date(session2Date.getTime() + 48 * 60 * 1000), metadata: { speakerCount: 4, durationSeconds: 2700 }, transcriptId: transcript2.id, severity: "info" as const },
    { eventType: "transcript_redacted", timestamp: new Date(session2Date.getTime() + 52 * 60 * 1000), metadata: { reasonType: "redaction_without_prejudice", status: "committed", redactionId: "rdx-wp-northgate-1", note: "Settlement figures redacted — preserved in privilege vault" }, transcriptId: transcript2.id, severity: "warning" as const },
    { eventType: "document_generated", timestamp: new Date(session2Date.getTime() + 52 * 60 * 1000), metadata: { documentType: "attendance_note", version: 1, note: "Without prejudice — privileged document" }, severity: "info" as const },
    { eventType: "document_approved", timestamp: new Date(session2Date.getTime() + 65 * 60 * 1000), metadata: { approvedBy: "James Hartwell" }, severity: "info" as const },
  ]) {
    await db.insert(auditTrail).values({ eventType: evt.eventType, userId, caseId: newCase.id, timestamp: evt.timestamp, severity: evt.severity, metadata: evt.metadata, transcriptId: (evt as any).transcriptId || null });
  }
}


// ─── Main seed function ──────────────────────────────────────────────────────

export async function seedDemoData(userId: string): Promise<{ success: boolean; message: string; casesCreated: number }> {
  try {
    await deleteAllUserCaseData(userId);
    await seedMatter1Webb(userId);
    await seedMatter2Kestrel(userId);
    await seedMatter3Osei(userId);
    await seedMatter4Okonkwo(userId);
    await seedMatter5Hassan(userId);
    await seedMatter6Diallo(userId);
    await seedMatter7Whitfield(userId);
    await seedMatter8Callahan(userId);
    await seedMatter9AlRashidi(userId);
    await seedMatter10Northgate(userId);
    return { success: true, message: "Demo data seeded successfully — 10 matters.", casesCreated: 10 };
  } catch (error: any) {
    console.error("[SEED] Error seeding demo data:", error);
    return { success: false, message: error.message, casesCreated: 0 };
  }
}

export async function resetDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  const result = await seedDemoData(userId);
  return { success: result.success, message: result.message };
}

export async function clearDemoData(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    await deleteAllUserCaseData(userId);
    return { success: true, message: "Demo data cleared." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
