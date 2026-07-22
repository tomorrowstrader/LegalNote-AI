# DATA PROCESSING AGREEMENT

UK GDPR Article 28 · Personal Data and Privileged Material

| Party | Detail |
| --- | --- |
| Controller | [Firm legal name], registered in England and Wales (No. [company number]), authorised and regulated by the Solicitors Regulation Authority (SRA No. [SRA number]) ("the Firm"). |
| Processor | LegalNote Technologies Ltd, registered in England and Wales (No. 16788981), registered with the Information Commissioner's Office (Reg. ZC176177). "LegalNote". |
| Effective date | The date on which the Firm's acceptance is recorded under clause 18 |

## Background

A	The Firm is a law firm regulated by the Solicitors Regulation Authority. In the course of its practice it holds personal data and material subject to legal professional privilege.

B	LegalNote operates a software platform which records solicitor-client conversations and produces attendance notes, client letters, sealed consent records and a tamper-evident audit trail.

C	LegalNote acts as a processor on behalf of the Firm, which acts as controller, save as expressly provided at clause 10.6.

D	This agreement is made under Article 28 of the UK GDPR and governs all processing of personal data by LegalNote on the Firm's behalf.

## 1. Definitions

1.1	"UK GDPR", "controller", "processor", "personal data", "processing", "personal data breach", "data subject" and "supervisory authority" have the meanings given in the UK GDPR and the Data Protection Act 2018.

1.2	"Firm Data" means all personal data processed by LegalNote on behalf of the Firm under this agreement.

1.3	"Privileged Material" means the substantive record of a client matter: audio recordings, transcripts, attendance notes, client letters, consent records, action items and the audit trail. It is that part of Firm Data which is, or is capable of being, subject to legal professional privilege.

1.4	"Matter" means a discrete client engagement of the Firm to which recordings and records are attributed within the platform.

1.5	"Sub-processor" means a third party engaged by LegalNote to process Firm Data.

1.5A	"Session Audio" means the raw audio recording of the substantive solicitor-client conversation, excluding any Consent Evidence Segment.

1.5B	"Consent Evidence Segment" means a short audio extract of the consent disclosure and the participant's acceptance only, separated from the substantive recording and retained solely as evidence that consent to recording was obtained for the session. It does not comprise the substantive content of the conversation.

1.6	"Adoption" has the meaning given at clause 2.3 of the Evaluation Agreement.

1.7	"Evaluation Agreement" means the Governed Evaluation Agreement between the parties, or any subsequent agreement between the parties for the provision of the platform which replaces it.

## 2. Status of the parties

2.1	The Firm is the controller. LegalNote is the processor, save in respect of the records identified at clause 10.6, for which LegalNote is the controller.

2.2	The Firm determines the purposes and means of processing. LegalNote processes Firm Data only on the Firm's documented instructions.

2.3	The Firm is responsible for establishing a lawful basis for processing and for obtaining any consent required from clients and other participants to the recording of a conversation. The Firm warrants that it is entitled to disclose Firm Data to LegalNote and to instruct LegalNote to process it.

2.4	LegalNote does not use Firm Data for its own purposes, save as expressly provided at clause 10.6, and does not sell, share or disclose it to any third party except as set out in this agreement.

## 3. Processing instructions

3.1	LegalNote shall process Firm Data only on the Firm's documented instructions, including as to transfers outside the United Kingdom, unless required to do otherwise by law. Where so required, LegalNote shall inform the Firm before processing, unless prohibited by that law on important grounds of public interest.

3.2	The Firm's instructions are set out at Annex 1 and in the configuration of its account. They include an instruction to delete Session Audio in accordance with clause 10.1, and to retain Consent Evidence Segments in accordance with clause 10.1A. LegalNote shall immediately inform the Firm if, in its opinion, an instruction infringes the UK GDPR.

3.3	LegalNote shall not train, fine-tune or otherwise improve any machine learning model on Firm Data, and shall procure that no sub-processor which processes Privileged Material does so. This obligation is absolute in respect of Privileged Material and is not subject to consent. The only sub-processor that trains any model on personal data is the billing processor at Annex 2, Part B, which does so on the Firm's billing data alone, for its own fraud-prevention purposes, and never on Privileged Material or the content of any Matter.

## 4. Legal professional privilege

This clause is additional to, and does not limit, the confidentiality obligations at clause 5.

4.1	LegalNote acknowledges that Firm Data will routinely comprise Privileged Material, and that the privilege belongs to the Firm's client and not to the Firm or to LegalNote.

4.2	LegalNote processes Privileged Material solely as the Firm's agent for the purpose of enabling the Firm to give legal advice to its client. The parties record their common intention that such processing is not, and shall not be treated by LegalNote as, a waiver of privilege.

4.3	LegalNote personnel shall not access the content of Firm Data except where strictly necessary to provide, support, secure or repair the service. Every such access is recorded in the audit trail and is visible to the Firm.

4.4	If LegalNote receives any request, demand, subpoena, warrant or order from any court, law enforcement body, regulator or other third party for the disclosure of Firm Data, it shall:

(a)	make no voluntary disclosure, and disclose only that which it is compelled by law to disclose, and only to the minimum extent so compelled;

(b)	notify the Firm without undue delay and in any event within 24 hours, unless prohibited by law from doing so;

(c)	inform the person making the demand, in writing, that the material is or may be subject to legal professional privilege belonging to a client of the Firm, that LegalNote holds it only as the Firm's agent, and that LegalNote neither waives nor has any authority to waive that privilege;

(d)	direct the demand to the Firm, and afford the Firm a reasonable opportunity, and such assistance as LegalNote can reasonably give, to assert privilege and to intervene, resist, vary or set aside the demand; and

(e)	take no step which could be treated as a waiver of privilege.

4.5	Where LegalNote is prohibited from notifying the Firm, it shall notify the Firm at the earliest moment it is lawfully able to do so, and shall take such steps to seek permission to notify the Firm as are reasonable in the circumstances, having regard to their cost and to LegalNote's resources.

4.6	LegalNote shall procure that every sub-processor which processes Privileged Material is bound by obligations equivalent to clauses 4.1 to 4.5.

4.7	LegalNote's obligations under this clause are procedural. The privilege belongs to the Firm's client. LegalNote does not assert it, cannot waive it, and does not warrant that it will be upheld.

## 5. Confidentiality

5.1	LegalNote shall ensure that every person authorised to process Firm Data is subject to a binding written obligation of confidentiality which survives the termination of their engagement and continues without limit of time.

5.2	Access to Firm Data is restricted to those personnel who require it in order to perform LegalNote's obligations under this agreement.

## 6. Security

6.1	LegalNote shall implement and maintain the technical and organisational measures set out at Annex 3, Part 1, pursuant to Article 32 of the UK GDPR, and shall not materially reduce them during the term. Annex 3, Part 1 is binding.

6.2	Annex 3, Part 2 describes the means by which the outcomes at Part 1 are currently achieved. LegalNote may change those means provided that the outcomes at Part 1 are maintained, that no material reduction in the overall level of security results, and that it notifies the Firm of any material change.

6.3	The audit trail is cryptographically hash-chained. Each entry is sealed with an HMAC signature chained to the entry preceding it, so that any alteration or deletion of a historic record is detectable.

6.4	The audit trail distinguishes between an availability check and a retrieval. Confirming that a record exists is not recorded as access to its content.

6.5	The measures at Annex 3 are given as at the effective date. LegalNote tests the platform on an ongoing basis, including automated testing of the integrity, residency and document-generation controls described in Annex 3.

6.6	If such testing, or any other means, shows that a measure in Annex 3, Part 1 is not being met, LegalNote shall:

(a)	notify the Firm promptly, and in any event within the period required by clause 13 where the matter is also a personal data breach;

(b)	describe the nature of the shortfall, the Firm Data affected if any, and the steps being taken to remedy it; and

(c)	remedy it within a reasonable period, having regard to its severity.

6.7	Identifying, disclosing and remedying such a shortfall in good faith and without undue delay is not of itself a breach of this agreement. This clause does not limit the Firm's rights where LegalNote fails to notify, or fails to remedy within a reasonable period, and it does not apply to any shortfall which LegalNote knew of and did not disclose.

## 7. Sub-processors

7.1	The Firm gives LegalNote general written authorisation to engage the sub-processors listed at Annex 2.

7.2	LegalNote shall give the Firm at least 30 days' written notice before adding or replacing any sub-processor. The Firm may object on reasonable data protection grounds within that period, in which case the parties shall discuss the objection in good faith. If it is not resolved, the Firm may terminate this agreement and the Evaluation Agreement without penalty, and clause 10.5 applies. Where a change of sub-processor is necessary to address a security risk, LegalNote may make it immediately and notify the Firm as soon as practicable afterwards, giving its reasons.

7.3	Every sub-processor is bound by a written data processing agreement imposing obligations no less protective than those in this agreement, including confidentiality, security, breach notification, and an obligation to resist and to notify LegalNote of any third-party demand for data unless legally prohibited from doing so. Copies are available to the Firm on request.

7.4	LegalNote remains fully liable to the Firm for the acts and omissions of each sub-processor as if they were its own. The Firm need not pursue any sub-processor directly.

7.5	Any service which could receive personal data or fragments of client matter content, including any analytics, session-replay or error-reporting service, is a sub-processor for the purposes of this clause and may only be introduced in accordance with clause 7.2.

## 8. Data residency and international transfers

8.1	All Privileged Material is stored, and all processing of it by the platform is performed, on infrastructure located within the United Kingdom or the European Economic Area. This applies to every stage of processing: recording, storage, transcription, correction, generation of the attendance note and the client letter, automated verification, anti-money-laundering trigger detection, and the audit trail. The region of each sub-processor is set out at Annex 2, Part A. This clause is subject to clauses 8.2 and 8.2A, which record the two respects in which infrastructure region does not by itself place the data beyond all non-UK/EEA reach.

8.2	Each sub-processor at Annex 2, Part A is a United States company or has a United States parent, and may permit access to its systems by its own personnel located outside the United Kingdom or the EEA for support, security and administration purposes. No sub-processor's data processing agreement restricts such access to UK or EEA resident staff. Annex 2, Part A records, for each sub-processor, its jurisdiction, the position on non-UK/EEA personnel access so far as established, and the transfer mechanism under Chapter V of the UK GDPR on which any such access relies. LegalNote itself permits no access to the content of Privileged Material by its own personnel other than as logged under clause 4.3.

8.2A	Because each sub-processor at Annex 2, Part A has a United States nexus, the data it holds is subject to United States law, including the CLOUD Act, and that jurisdiction is not removed by the choice of a UK or EEA region. Where LegalNote or a sub-processor receives a demand for Privileged Material from any authority, clause 4 governs LegalNote's response, and each sub-processor is bound by equivalent government-access provisions in its own data processing agreement, including an obligation to redirect the demand to the customer and to give notice where lawful.

8.3	No transfer of Privileged Material outside the United Kingdom or the EEA shall be made, other than as recorded at Annex 2, Part A, without the Firm's prior written authorisation and an appropriate transfer mechanism under Chapter V of the UK GDPR. LegalNote shall configure each sub-processor to keep Privileged Material within the United Kingdom or the EEA, including by confining the AI processing to UK or EEA regions and disabling any cross-region routing that could send it elsewhere, by using the EEA transcription endpoint for every request, and by monitoring the hosting region on a continuing basis; and shall maintain those configurations for the term.

8.4	LegalNote shall verify the operating regions of its sub-processors on a periodic basis, and shall notify the Firm in writing before any change to the region in which any sub-processor processes Privileged Material, and before any change to the position recorded at Annex 2, Part A.

8.5	The single processor listed at Annex 2, Part B handles the Firm's own subscription billing. It processes no client personal data of any kind.

## 9. Consent and the recording of conversations

9.1	The Firm is responsible for obtaining the consent of each participant to the recording of a conversation, and for satisfying itself that the recording is lawful in the circumstances of the matter.

9.2	LegalNote captures and seals a consent record for every recorded session. The consent record comprises the disclosure text presented to the participant, the timestamp of the consent event, the identity of the consenting participant as supplied, and the session to which it relates. It is written into the tamper-evident audit trail and cannot subsequently be altered.

9.3	Where a recording is made through the meeting-bot integration, the consent record comprises the disclosure presented to participants and the logged acceptance event.

9.4	The consent record evidences the participant's agreement to the conversation being recorded. It is not the lawful basis for the Firm's processing of personal data, and the withdrawal of that agreement does not of itself require the erasure of a record which the Firm is required or entitled to retain.

## 10. Retention, deletion and litigation hold

10.1	Session Audio is put beyond use within 7 days of processing being completed, and is then deleted in accordance with LegalNote's retention controls, comprising application-enforced deletion and any applicable storage-layer lifecycle rule. Session Audio is not retained indefinitely.

10.1A	Consent Evidence Segments are retained for so long as the related consent record is retained under clause 10.2, or until deletion under clauses 10.5 and 10.6, whichever applies. They are retained solely as evidence that consent to recording was obtained, and are not used for transcription, document generation or model improvement.

10.1B	While a Matter is under litigation hold under clause 10.3, neither Session Audio nor any Consent Evidence Segment attributed to that Matter shall be deleted. Object Lock, where used, is applied only for such per-matter legal hold, and not as a blanket retention period on the object store.

10.2	Transcripts, attendance notes, client letters, consent records and audit records are retained for the term of the Evaluation Agreement, and thereafter only in accordance with clauses 10.5 and 10.6.

10.3	The Firm may place any Matter under litigation hold. While a hold is in force, no automatic deletion of any Firm Data attributed to that Matter shall occur, in any deletion path. The hold persists until the Firm expressly releases it. Both the application and the release of a hold are recorded in the audit trail.

10.4	The Firm may at any time export its data, including attendance notes, transcripts, consent records and the audit trail.

10.5	On termination or expiry, LegalNote shall, at the Firm's election, delete or return all Firm Data. Where deletion is elected, LegalNote shall complete it and confirm it in writing to the Firm within 5 working days of the later of (a) termination or expiry and (b) the Firm's written confirmation that it has completed its export under clause 10.4, save to the extent that retention is required by law or permitted by clause 10.6, in which case LegalNote shall inform the Firm. LegalNote shall give the Firm 5 working days' written notice before it deletes.

10.6	Notwithstanding clause 10.5, LegalNote may retain, as controller and for the sole purposes of establishing, exercising or defending legal claims and of complying with its own legal obligations, (a) audit trail metadata relating to the Firm's use of the platform and (b) records of its contractual and account relationship with the Firm, in each case for six years from the end of this agreement. The metadata retained under (a) comprises the identifier of the user, the type of event, the time of the event and the integrity hash. It does not comprise the content of any Matter, the name of any client of the Firm, or the title or content of any document. LegalNote shall process such records for no other purpose.

## 11. Delivery of documents to clients

11.1	No document produced by the platform may be shared with a client or with any third party until a fee earner of the Firm has reviewed it and adopted it as the Firm's record. The platform will not release an unadopted document. The Adoption is written into the tamper-evident audit trail: the identity of the fee earner who adopted it, and the time at which they did so.

11.2	No document produced by the platform is transmitted by electronic mail or by text message. Attendance notes, client letters and any other document derived from a privileged conversation are never sent as the body of a message and are never attached to one. Electronic mail and text messages are used only to deliver a notification, a share link, or a one-time access code; they never carry document content.

11.3	Where the Firm shares a document with a client or a third party, the recipient is sent a notification containing a link and no content. The document is read on LegalNote's infrastructure within the United Kingdom or the EEA, through an authenticated session.

11.4	Every access to a shared document is recorded in the tamper-evident audit trail: the identity of the recipient, the time at which the document was opened, and the number of times it has been accessed. The Firm therefore holds a record of whether, and when, the document was opened by the recipient.

11.5	A share link expires automatically after a period selected by the Firm, and may be revoked by the Firm at any time before then. Revocation prevents any further access through the link with immediate effect. It does not affect any copy of the document which the recipient has already viewed, downloaded or retained.

11.6	Access may be further protected by a password or by a one-time code sent by text message to a telephone number registered by the Firm. The one-time code is the only content sent by text message and is not a document.

## 12. Data subject rights

12.1	LegalNote shall assist the Firm, by appropriate technical and organisational measures and insofar as possible, in fulfilling its obligation to respond to requests to exercise data subject rights under Chapter III of the UK GDPR.

12.2	If LegalNote receives a request directly from a data subject in relation to Firm Data, it shall not respond substantively and shall forward the request to the Firm without undue delay.

12.3	LegalNote provides the Firm with the technical means to give effect to the Firm's decision on an erasure or redaction request, including the deletion of personal data and the segregation of material which the Firm determines is subject to legal professional privilege or otherwise exempt from erasure. The decision is the Firm's. Every action taken is logged, is attributable to an identified user, and records the basis on which the Firm instructed it.

## 13. Personal data breach

13.1	LegalNote shall notify the Firm without undue delay, and in any event within 24 hours, of becoming aware of a personal data breach affecting Firm Data.

13.2	The notification shall describe, so far as known, the nature of the breach, the categories and approximate number of data subjects and records affected, the likely consequences, and the measures taken or proposed. Information not available at the time of notification shall be provided as it becomes available.

13.3	LegalNote shall assist the Firm in meeting its obligations under Articles 33 and 34 of the UK GDPR, and in any consequential reporting to the Solicitors Regulation Authority.

13.4	LegalNote shall not notify any supervisory authority or data subject of a breach affecting Firm Data without the Firm's prior written consent, unless required to do so by law.

## 14. Data protection impact assessments

14.1	LegalNote shall provide reasonable assistance to the Firm with any data protection impact assessment and any prior consultation with the Information Commissioner relating to the processing under this agreement. LegalNote maintains a template assessment which the Firm may adopt and adapt.

## 15. Audit, inspection and regulatory access

15.1	LegalNote shall make available to the Firm all information reasonably necessary to demonstrate compliance with Article 28 of the UK GDPR, and shall complete the Firm's security questionnaire on reasonable request, no more than once in any 12-month period and at any time following a personal data breach or where reasonably required by the Firm's regulator or insurer.

15.2	The Firm, or an auditor mandated by it, may audit LegalNote's compliance with this agreement, including by inspection of LegalNote's premises and systems, once in any 12-month period on 30 days' written notice, and at any time following a personal data breach affecting Firm Data or where required by a supervisory authority or by the Firm's regulator. An audit is at the Firm's cost, is subject to reasonable confidentiality undertakings, and shall be conducted so as not to compromise the confidentiality of any other customer of LegalNote.

15.3	The Firm has direct, unmediated access to the audit trail for its own Matters at all times, and may export it. No audit right is required in order to obtain it.

15.4	In relation to the services provided to the Firm, LegalNote shall permit the Solicitors Regulation Authority, or its agent, to obtain information from LegalNote, to inspect LegalNote's records (including electronic records) relating to the Firm's Matters, and to enter LegalNote's premises, and shall co-operate reasonably with any such request, in each case in accordance with the SRA Standards and Regulations. LegalNote shall notify the Firm of any such request unless prohibited from doing so.

## 16. Liability and insurance

16.1	LegalNote's liability under or in connection with this agreement is limited as provided at clause 9 of the Evaluation Agreement, and that clause applies to liability under this agreement as if set out here in full.

16.2	LegalNote maintains professional indemnity insurance and cyber and data insurance with Hiscox Insurance Company Limited, and shall maintain such cover as provided at clause 9.6 of the Evaluation Agreement. Certificates of insurance are available to the Firm on request.

## 17. Term, variation and governing law

17.1	This agreement takes effect on the effective date and continues for so long as LegalNote processes Firm Data.

17.2	Any variation must be in writing and signed by both parties, save that Annex 2 may be updated in accordance with clause 7.2.

17.3	In the event of conflict between this agreement and any other agreement between the parties, this agreement prevails in respect of the processing of personal data, save as to liability, which is governed by clause 9 of the Evaluation Agreement.

17.4	This agreement is governed by the law of England and Wales, and the parties submit to the exclusive jurisdiction of the courts of England and Wales.

## 18. Execution

18.1	This agreement is accepted electronically. The Firm accepts it through the LegalNote platform by an authorised representative confirming acceptance on the Firm's behalf, together with the Evaluation Agreement.

18.2	LegalNote records each acceptance in its tamper-evident audit trail. The record comprises the identity of the accepting representative as supplied, the representative's confirmed email address, the date and time of acceptance, and a cryptographic hash of the exact text of this agreement and of the Evaluation Agreement as accepted. LegalNote retains the exact text corresponding to each recorded hash, so that the version accepted by the Firm can be reproduced. That record is the evidence of execution and of the version accepted.

18.3	By accepting, the representative confirms that they are authorised to enter into this agreement on the Firm's behalf, and that the details provided by the Firm are correct.

18.4	LegalNote Technologies Ltd, having made this agreement available for acceptance, is bound by it in respect of each Firm that accepts it.

## Annex 1: Details of Processing

| Item | Detail |
| --- | --- |
| Subject matter | Provision of the LegalNote platform: recording of solicitor-client conversations and production of attendance notes, client letters, consent records and a tamper-evident audit trail. |
| Duration | The term of the Evaluation Agreement, and thereafter only as provided at clauses 10.5 and 10.6. |
| Nature and purpose | Recording; transcription; correction of transcription; generation of an attendance note; generation of a client letter; automated verification of both documents against the source record; anti-money-laundering trigger detection; extraction of undertakings and action items; storage; audit logging; deletion. |
| Categories of data subject | Clients of the Firm; other participants in a recorded conversation; fee earners and staff of the Firm. |
| Categories of personal data | Name; contact details; voice; and the content of the conversation, which may include financial circumstances, family circumstances, health, immigration status, and allegations of criminal conduct, depending on the matter. |
| Special category and criminal offence data | Depending on the matter, the Firm may process special category data under Article 9(2)(f) UK GDPR (establishment, exercise or defence of legal claims) and criminal offence data under Schedule 1, Data Protection Act 2018. LegalNote processes such data only as processor, on the Firm's instructions. |
| Frequency | Continuous, for the duration of the Evaluation Agreement. |
| Standing instructions | Delete Session Audio in accordance with clause 10.1. Retain Consent Evidence Segments in accordance with clause 10.1A. Release no document to a client before Adoption. Transmit no document by electronic mail or text message; use these channels only for notifications, share links and one-time access codes. |

## Annex 2: Sub-processors

### Part A: Processors of Privileged Material and Client Personal Data

Every sub-processor below stores and processes Privileged Material within the United Kingdom or the EEA, in the region shown. Each is a United States company or has a United States parent. Two consequences follow, and both are recorded in the final column: no sub-processor's data processing agreement restricts support, security or administration access to UK or EEA resident personnel, so such access may occur and is a restricted transfer; and each is subject to United States law, including the CLOUD Act, which the choice of region does not remove. These are addressed at clauses 8.2 and 8.2A and, for government demands, at clause 4. Where a cell records that a fact is to be confirmed, it is confirmed against the vendor's executed data processing agreement before signature.

| Sub-processor and purpose | Region of Privileged Material | Jurisdiction, non-UK/EEA personnel access, and Chapter V transfer mechanism |
| --- | --- | --- |
| Neon (Neon, LLC, a Databricks company) / Database: notes, letters, transcripts, consent records, audit trail | AWS eu-west-2 (London). Region fixed at project creation. | Neon, LLC, a Databricks company; United States (Databricks, Inc. parent). DPA executed and countersigned via the Neon Platform Services Product Specific Schedule (neon.com/dpa) on the Databricks Master Cloud Services Agreement and Databricks DPA, through Databricks' Ironclad self-serve process, naming LegalNote Technologies Ltd as data exporter. Neon, LLC covered under Databricks' EU-US DPF including the UK Extension; transfers otherwise under the 2021 EU SCCs and the UK IDTA/Addendum. Non-UK/EEA personnel access not contractually excluded; controlled by role-based access and confidentiality. Residual US CLOUD Act exposure. |
| AWS Bedrock (Claude) / All AI processing: correction, attendance note, client letter, verification, AML detection | Confined to UK/EEA: a single UK or EEA region, or the EU geographic inference profile (eu.anthropic.*), with global cross-region routing disabled. | Amazon Web Services, Inc. / AWS EMEA SARL (Luxembourg). AWS GDPR DPA and UK GDPR Addendum, applying automatically (EU SCCs as amended by the UK IDTA); also DPF / UK Extension certified. Inputs and outputs are not used to train any model, and the model provider has no access (zero operator access). Non-UK/EEA personnel access not contractually excluded; region model and least-privilege controls apply. Residual US CLOUD Act exposure. |
| AssemblyAI / Transcription | AWS eu-west-1 (Dublin), via the EU endpoint enforced on every request. | AssemblyAI, Inc., United States. AssemblyAI DPA (EU SCCs Modules 1 to 3 + UK Addendum; UK ICO supervisory authority); also DPF / UK Extension certified. Use of the EU endpoint excludes Customer Data from model training. Non-UK/EEA personnel access not contractually excluded. Residual US CLOUD Act exposure. |
| Backblaze B2 / Audio object storage: Session Audio (transient, clause 10.1) and Consent Evidence Segments (retained, clause 10.1A) | EU Central (Amsterdam). Region fixed at account creation. | Backblaze, Inc. (San Mateo, California), United States. Backblaze EEA/EU DPA and UK Residents DPA (EU SCCs; UK IDTA to be confirmed). Support is US-based, so support access is an onward transfer to the United States and is not restricted to UK/EEA staff. No express no-training clause (object storage). Residual US CLOUD Act exposure. |
| Recall.ai (Hyperdoc Inc.) / Meeting-bot capture | EU deployment (Frankfurt); retention set to a short TTL or zero by configuration. | Hyperdoc Inc., United States. Recall.ai EU and UK DPA (EU SCCs + UK Addendum; UK ICO supervisory authority). Customer Data is not used to train or fine-tune any model. Non-UK/EEA personnel access not contractually excluded. Residual US CLOUD Act exposure. |
| Railway / Application hosting | Railway EU-West (Amsterdam), on a paid plan. EU region is a paid-plan option under the Railway DPA; region is user-changeable and is pinned and monitored to remain EU-West for every service and attached volume. | Railway Corporation (United States). DPA executed and countersigned (EU SCCs Module 2/3, Clause 9 Option 1, specific prior authorisation, governed by Irish law; UK Addendum at Exhibit D, governed by the law of England and Wales; UK ICO supervisory authority). Government-access clause requires Railway to redirect demands to the customer, give notice unless prohibited, and make no voluntary disclosure. Sub-processors published at trust.railway.com: Google Cloud, Cloudflare, Stripe. Non-UK/EEA personnel access not contractually excluded. No express no-training clause. Residual US CLOUD Act exposure. |
| AWS SES / Transactional email: notification and share link only, never document content (clause 11) | AWS eu-west-2 (London). | Amazon Web Services, Inc. / AWS EMEA SARL (Luxembourg). Same AWS GDPR DPA and UK GDPR Addendum as Neon and Bedrock (EU SCCs as amended by the UK IDTA; also DPF / UK Extension certified). Handles only a recipient email address and a content-free notification or link. Residual US CLOUD Act exposure. |
| Twilio / Text message delivery of one-time access codes only (clause 11.6); no document content | Twilio IE1 (Ireland) where EU SMS residency is enabled, to the point of carrier handoff; onward carriers may process outside the EU. | Twilio Inc. (United States) / Twilio Ireland Limited. Twilio DPA (EU SCCs 2021 + UK IDTA v B1.0; also DPF certified and BCRs). Handles only a recipient phone number and a one-time code. Message redaction and short log retention configured. Residual US CLOUD Act exposure. |

AWS Bedrock. The AI model is accessed through an AWS inference profile which AWS confirms routes requests only to the seven European regions listed above. LegalNote verifies this directly against the AWS API and re-verifies it periodically. The regions are all within the United Kingdom or the EEA, so no Chapter V transfer mechanism is required for this processing.

Contact-routing services. AWS SES and Twilio appear in Part A for completeness, but neither receives Privileged Material or the content of any Matter. AWS SES carries a recipient email address and a content-free notification or link; Twilio carries a recipient phone number and a one-time code. Notifications and access codes identify neither the client, the matter, nor the document, so no privileged or special-category content reaches either service.

No sub-processor which processes Privileged Material trains, fine-tunes or otherwise improves any model on it. AWS Bedrock, AssemblyAI (through the EU endpoint) and Recall.ai give express no-training commitments; the storage and hosting sub-processors do not train because they process no content capable of training a model.

### Part B: The Firm's own billing

| Sub-processor | Purpose | Data processed |
| --- | --- | --- |
| Stripe | Subscription billing | The Firm's billing contact and payment details. No client personal data. No matter content. |

There is no other sub-processor engaged directly by LegalNote. The sub-processors listed above engage their own infrastructure providers, which are identified in their respective data processing agreements; copies are available to the Firm on request. LegalNote uses no analytics, session-replay or error-reporting service which could receive personal data or fragments of client matter content, and shall not introduce one otherwise than in accordance with clause 7.2.

## Annex 3: Technical and Organisational Measures

### Part 1: Outcomes. These are binding under clause 6.1.

### Integrity of the record

-	The audit trail is cryptographically hash-chained. Each entry is sealed with an HMAC signature chained to the entry preceding it, so that any alteration or deletion of a historic record is detectable.

-	Every access to, and action upon, Firm Data is recorded and attributable to an identified user, including access by LegalNote personnel.

-	An availability check is distinguished from a retrieval. Confirming that a record exists is not recorded as access to its content.

### Residency

-	Privileged Material is stored, and processed by the platform, only on infrastructure within the United Kingdom or the EEA, as recorded at Annex 2, Part A.

-	The production environment holds no credential for any AI provider outside the United Kingdom or the EEA.

-	No document is transmitted by email or text message. Client-facing documents are read behind authentication on UK or EEA infrastructure, and every access is logged.

### Encryption and access control

-	In transit: TLS. At rest: server-side encryption on the object store and on the database.

-	Authentication through the Firm's identity provider; role-based access within the platform.

-	LegalNote personnel access to the content of Firm Data is restricted to the minimum necessary and is logged.

### Minimisation and deletion

-	Session Audio is put beyond use within 7 days of processing completion and then deleted under application retention controls and any applicable storage-layer lifecycle rule.

-	Consent Evidence Segments are retained as consent evidence only, separately from Session Audio, and are not deleted on the 7-day Session Audio cycle. They are not used for transcription, document generation or model improvement.

-	Object Lock is used only for per-matter litigation hold. No blanket retention period is applied to defeat the Session Audio deletion commitment.

-	Litigation hold is enforced in every deletion path, not only in the scheduled sweep.

### Document integrity and supervision

-	No document can be shared until a fee earner has adopted it as the Firm's record. Adoption is an affirmative act, it is recorded in the audit trail with the identity of the fee earner and the time, and the platform will not release an unadopted document. The Firm therefore holds evidence, on every file, that a qualified person reviewed the record and took responsibility for it.

-	Every generated document is passed through an automated verification stage against the source record before it is presented to the fee earner. Statements which that stage identifies as unsupported by the record are surfaced as warnings. The verification stage is a safeguard for the fee earner. It is not a guarantee that every unsupported statement will be detected, and it does not replace the fee earner's review.

-	The platform is designed and instructed not to supply reasoning which was not given. Where advice was given and no reason for it was recorded, the note is designed to mark the gap rather than to fill it.

-	The platform is designed and instructed to characterise an allegation and not to adjudicate it. A client's concern is designed to be recorded as a concern and not as a finding of fact.

-	The platform is designed and instructed not to record a person as having said, confirmed or instructed something unless the record shows that they did.

### Organisational

-	Written policies, available to the Firm on request: data retention; access control; incident response.

-	Personnel bound by written confidentiality obligations which survive the end of their engagement and continue without limit of time.

-	A written data processing agreement in place with every sub-processor listed at Annex 2, imposing obligations no less protective than this agreement.

-	LegalNote commissions an independent penetration test of the platform at least annually. The summary report is available to the Firm on request.

-	Professional indemnity and cyber and data insurance with Hiscox. Certificates available on request.

Part 2: Means. These describe how the outcomes at Part 1 are currently achieved, and may change under clause 6.2.

-	Transcription is hardcoded to the EU endpoint. There is no environment variable which can redirect it and no fallback to any other region.

-	The platform refuses to start in production if any component resolves to a region outside the United Kingdom or the EEA. This is a boot-time assertion, not a configuration convention.

-	Session Audio deletion is enforced in the application and, independently, by a lifecycle policy configured at the Backblaze B2 storage layer. Consent Evidence Segments sit outside that lifecycle rule and are retained as consent evidence.

-	The audit trail is held in the Neon database in AWS eu-west-2 and is exportable by the Firm at any time.

-	Document generation and verification run on AWS Bedrock through an EU-only inference profile.
