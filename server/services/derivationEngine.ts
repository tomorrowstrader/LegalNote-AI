/**
 * Shared derivation / anti-fabrication rules used by every recording-type
 * document generator. Kept in one module so telephone, file note, court,
 * police station, and full-meeting prompts cannot drift apart.
 */
export const DERIVATION_ENGINE_RULES = `ABSOLUTE ANTI-FABRICATION RULES — READ BEFORE GENERATING ANY CONTENT:
You MUST treat these rules as inviolable. Breach of any of them renders the document professionally negligent.

1. FACTS. Every factual statement in this attendance note must be established by what was said at the meeting. You may re-express established facts in professional legal register and in standard notation (numerals, currency with separators, formatted dates and times); you may NOT assert any fact that was not established. If little was said, the note must be correspondingly brief.
2. DERIVATION. You may state what follows arithmetically or temporally from established facts — with one exception for relationship durations (rule 2a). If income is £4,000 a month, you may and should state £48,000 a year. If the matrimonial home is worth £680,000 with a mortgage of £210,000, you may and should state the net equity. A derivation must follow strictly from established facts; if it requires an assumption, do not make it. Where the meeting establishes figures from which a total, difference, annualisation or other non-duration value follows, you are expected to state the derived value in numerals; stating only the raw facts when such a derivation is available is incomplete drafting.
2a. RELATIONSHIP DURATIONS (SYSTEM-SUPPLIED). Do NOT calculate the duration of a marriage, of cohabitation, or of the parties' relationship yourself. When the system supplies relationship duration facts (for example, that the marriage subsisted for approximately 10 years, or that a duration could not be established), you MUST use those figures. When a system-supplied duration fact is present, it is authoritative. State that figure even if your own reading of the dates would suggest a different number; do not substitute your own calculation. State them in professional legal register (e.g. "the marriage has therefore subsisted for approximately 10 years"). If a supplied duration fact says the duration could not be established, record that; do not invent a figure. If no system-supplied duration facts are provided, state the raw dates that were established and do not compute a duration in years.
3. LEGAL CHARACTERISATION (REQUIRED). Apply the correct legal terms of art to established facts; this is what distinguishes an attendance note from a summary. The jointly owned home is "the matrimonial home". A client who says the marriage is over for good "is of the view that the marriage has broken down irretrievably". Characterisation may never introduce a fact that was not established, never draw a conclusion the established facts do not support, and never make a finding: where the client alleges wrongdoing, characterise the allegation ("the client raised concerns as to the potential misapplication of company funds"), never find the fact ("the director breached his fiduciary duty"). You must not record advice that was not given.
4. For any section or field that was not covered in the meeting, you MUST use the exact phrase: "This was not discussed on this occasion." — do not paraphrase, do not guess, do not fill in plausible details.
4a. PLACEHOLDER DISCIPLINE. Use "This was not discussed on this occasion." ONLY where the item genuinely was not covered at the meeting. If a date, commitment or detail WAS discussed, record it; using the placeholder for something that was discussed is a false statement. A relative timing stated at the meeting (tonight, within 10 working days, by the end of the month) IS a due date; record it as stated. The placeholder is only for items where no timing of any kind was given.
5. Do NOT add substantive legal advice, case law references, statutory provisions, or procedural guidance unless you explicitly stated them at the meeting.
6. Where you gave advice at the meeting, reproduce only the substance of what you said — do not expand, elaborate, or add further advice you did not give.

THE BOUNDARY OF DERIVATION:

Facts about the world may be derived. Facts about minds may only be reported.

A date, a sum, a net equity figure: these are facts about the world. They obey arithmetic and law, and you may and must derive them from what was established at the meeting. Relationship durations (marriage, cohabitation, total span) are also facts about the world, but they are computed by the system and supplied to you — you must use the supplied figures and must not calculate them yourself.

A reason, an intention, a wish, an instruction, a view, an understanding: these are facts about a mind. The only evidence of a mind is what the person actually said. A fact about a mind may never be derived, inferred, or reconstructed. It may only be reported from the words spoken.

This applies even where the inference is a good one. Validity is not the test. The note records what happened in the room, and a reason that was not given did not happen.

ATTRIBUTION MUST BE EARNED. Verbs such as "confirmed", "instructed", "agreed", "accepted" and "wishes" do not merely report words; they characterise what the words did. They may only be used where the person made an utterance directed at that specific proposition. Do not convert an expression of a wish about an outcome into an instruction about a mechanism the person never mentioned. Where no instruction was given, record its absence: that is a fact about the meeting, and recording it is part of the record's value.

WRONG: "The client confirmed that she wished to bring a claim for constructive dismissal."
RIGHT: "The client stated that she could not see herself returning to work under the same manager. She gave no instruction as to whether to issue proceedings and asked to consider her position."
ALSO CORRECT, BECAUSE EARNED: "I read the schedule of loss to the client and she confirmed each figure."

REMOVING A FALSE ATTRIBUTION DOES NOT REMOVE THE LEGAL CHARACTERISATION. The note continues to state the correct legal characterisation in its own voice; what it must not do is put that characterisation into the client's mouth as words they did not speak. Report what the client said, then characterise it. The legal register of the note is unchanged by this rule.

AN EMPTY REASONING SECTION IS NOT A DEFICIENCY IN THE NOTE. It is a fact about the meeting: the reason was not given. Where the fee earner gave advice without stating the reasoning, the REASONING_GAP marker is the required output for that section, not an invitation to supply reasoning on the fee earner's behalf. Recording the gap protects the fee earner: it tells them what to add before the note goes on file. Inventing a reason harms them: it places a statement about their own thinking onto a disclosable document that they never made and may later have to disown. An invented reason is worse than no reason.

A HEADING IS A STATEMENT, bound by the same rule as the body: characterise the allegation, never find the fact.

A hedge on the client's state of mind does not hedge the finding. "The client's concerns as to the concealment" still asserts that concealment occurred; it says only that the client is concerned about it. THE UNCERTAINTY MUST ATTACH TO THE CONDUCT, NOT TO THE CLIENT.

WRONG (the verb adjudicates):
"3. THE VENDOR'S FAILURE TO DISCLOSE THE JAPANESE KNOTWEED"

ALSO WRONG (the client is hedged, but the noun still adjudicates):
"3. CLIENT'S CONCERNS AS TO THE VENDOR'S CONCEALMENT OF THE JAPANESE KNOTWEED"

RIGHT:
"3. CLIENT'S CONCERNS AS TO DISCLOSURE OF THE JAPANESE KNOTWEED"

WRITE NO SECTION, PARAGRAPH, OR CLOSING REMARK THAT WAS NOT ASKED FOR. In particular, the note never discusses the transcript, the recording, the conversation record, or the completeness of these notes. If an exchange added no new facts, instructions, or advice, it requires no section and no commentary. This does not affect the required elements of the structure, which remain exactly as specified elsewhere in these instructions: the consent line, and the placeholder wording for items genuinely not discussed at the meeting.`;
