import { openaiClient, MODELS, calculateGPT4oCost } from '../config/openai';
import { anthropicClient, CLAUDE_MODELS, calculateClaudeCost } from '../config/anthropic';

/**
 * Post-process document content to ensure known section headings are bold.
 * Only matches specific legal document section headings to avoid false positives.
 * Idempotent - already bold headings are not re-wrapped.
 */
function ensureBoldHeadings(content: string): string {
  const knownHeadings = [
    'ATTENDANCE NOTE',
    'MEETING SUMMARY',
    'MATTERS DISCUSSED',
    'NEXT STEPS',
    'KEY POINTS',
    'CRITICAL ISSUES IDENTIFIED',
    'IMMEDIATE ACTIONS REQUIRED',
    'CLIENT CONCERNS',
    'SOLICITOR RECOMMENDATIONS',
    'MATTER SUMMARY',
    'OUTSTANDING ACTION ITEMS',
    'IMPORTANT DATES',
    'SUGGESTED AGENDA ITEMS',
    'CLIENT CONFIRMATION',
    'INTRODUCTION',
    'BACKGROUND',
    'SUMMARY',
    'CONCLUSION',
    'ASSETS SUMMARY',
    'DISCUSSION POINTS',
    'ACTION ITEMS',
    'DECISIONS MADE',
    'PURPOSE OF MEETING',
    'ADDITIONAL NOTES',
    'Attendance Note',
    'Meeting Summary',
    'Matters Discussed',
    'Next Steps',
    'Key Points',
    'Critical Issues Identified',
    'Immediate Actions Required',
    'Client Concerns',
    'Solicitor Recommendations',
    'Matter Summary',
    'Outstanding Action Items',
    'Important Dates',
    'Suggested Agenda Items',
    'Client Confirmation',
    'Introduction',
    'Background',
    'Summary',
    'Conclusion',
    'Assets Summary',
    'Discussion Points',
    'Action Items',
    'Decisions Made',
    'Purpose of Meeting',
    'Additional Notes',
    'Key Discussion Points from Previous Meeting',
    'AML COMPLIANCE SUMMARY',
    'AML Compliance Summary',
    'Identity Verification',
    'Nature and Purpose of Instruction',
    'Source of Funds',
    'Beneficial Ownership',
    'PEP/Sanctions Status',
    'Risk Assessment',
    'Enhanced Due Diligence (EDD)',
    'Solicitor Confirmation',
  ];
  
  let result = content;
  
  for (const heading of knownHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberedPattern = new RegExp(
      `^(\\d+\\.)\\s+(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`,
      'gm'
    );
    result = result.replace(numberedPattern, `$1 **${heading}**$2`);
    
    const standalonePattern = new RegExp(
      `^(?!\\*\\*)${escaped}(?!\\*\\*)(:?)$`,
      'gm'
    );
    result = result.replace(standalonePattern, `**${heading}**$1`);
  }
  
  result = ensureSectionSpacing(result);
  
  return result;
}

function ensureSectionSpacing(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isHeadingLine = trimmed.startsWith('## ') || trimmed.startsWith('### ') ||
      /^\*\*[A-Z]/.test(trimmed) || /^\d+\.\s+\*\*/.test(trimmed);
    
    if (isHeadingLine && i > 0) {
      const prevLine = result.length > 0 ? result[result.length - 1].trim() : '';
      if (prevLine !== '') {
        result.push('');
      }
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

export interface DocumentGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  verificationWarnings?: string[];
  isShortRecording?: boolean;
}

export interface CaseMetadata {
  title: string;
  clientName: string;
  matterReference?: string;
  recordingDate: string;
  templateId?: string;
  practiceArea?: string;
}

export interface FirmPreferences {
  includeLocation?: boolean;
  showFullSolicitorName?: boolean;
  includeClientConfirmation?: boolean;
}

export class DocumentService {
  /**
   * Generate attendance note from transcript
   */
  async generateAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences,
    utterances?: Array<{ text: string; start: number; end: number }>
  ): Promise<DocumentGenerationResult> {
    // Apply firm preferences (default to true if not specified)
    const prefs = {
      includeLocation: firmPreferences?.includeLocation ?? true,
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
      includeClientConfirmation: firmPreferences?.includeClientConfirmation ?? false,
    };

    // Build metadata header based on preferences
    // Labels are padded to 16 chars so the value column aligns consistently in PDF output
    let metadataFields = `File Reference: ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Time:           {Meeting start time in 24-hour format from transcript, or "Not recorded in this session"}
Duration:       {Total meeting duration from transcript, or "Not recorded in this session"}`;

    if (prefs.includeLocation) {
      metadataFields += `\nLocation:       {Meeting location from transcript, or "Not recorded in this session"}`;
    }

    if (prefs.showFullSolicitorName) {
      metadataFields += `\nSolicitor:      {Solicitor full name and title from transcript, or "Not recorded in this session"}`;
    } else {
      metadataFields += `\nSolicitor:      {Solicitor initials from transcript, or "Not recorded in this session"}`;
    }

    // Build footer with optional client confirmation
    const preparedByFormat = prefs.showFullSolicitorName 
      ? '{Solicitor name and title from transcript, or "Not recorded in this session"}'
      : '{Solicitor initials from transcript, or "Not recorded in this session"}';

    let footerSection = `Time Engaged: {Total meeting duration from transcript, or "Not recorded in this session"}

This attendance note is subject to legal professional privilege.

Prepared by: ${preparedByFormat}
Date Prepared: ${metadata.recordingDate}`;

    if (prefs.includeClientConfirmation) {
      footerSection += `\n\n**CLIENT CONFIRMATION**

I confirm the above is an accurate record of our meeting.

Client Signature: ________________

Date: ________________`;
    }

    let systemPrompt = `You are a UK-qualified solicitor specializing in creating professional attendance notes compliant with Solicitors Regulation Authority (SRA) standards and English law practice requirements.

ABSOLUTE ANTI-FABRICATION RULES — READ BEFORE GENERATING ANY CONTENT:
You MUST treat these rules as inviolable. Breach of any of them renders the document professionally negligent.

1. EVERY SINGLE STATEMENT in this attendance note must have a direct, traceable basis in the transcript provided. If you cannot point to a specific passage in the transcript that supports a statement, you MUST NOT include that statement.
2. You MUST NOT draw on your training knowledge to supplement, elaborate, or contextualise sparse transcripts. If the transcript says little, the attendance note must be correspondingly brief.
3. You MUST NOT infer, assume, or fabricate any legal advice, recommendations, case strategy, next steps, or factual details that are not explicitly stated in the transcript.
4. For any section or field that cannot be completed from the transcript, you MUST use the exact phrase: "Not recorded in this session" — do not paraphrase, do not guess, do not fill in plausible details.
5. Do NOT add substantive legal advice, case law references, statutory provisions, or procedural guidance unless the solicitor in the transcript explicitly stated them.
6. If the transcript records the solicitor giving advice, reproduce only the substance of what was said — do not expand, elaborate, or add further advice the solicitor did not give.

ADDITIONAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Use UK legal terminology and practice conventions throughout
- Format the document professionally with clean spacing (use white space for visual separation, NO horizontal lines or underscores)

SPEAKER-LABELED TRANSCRIPTS:
- The transcript may include speaker labels in the format "[Speaker A]: text" or "[Speaker B]: text"
- Use these labels to distinguish between client statements and solicitor advice
- Typically, the solicitor provides legal advice (identify by content like "I advised...", legal analysis, instructions)
- Use the speaker context to more accurately attribute statements and advice
- If speaker identities are unclear, use context clues from the content to determine roles

CONSENT RECORDING HANDLING:
- If the transcript includes consent dialogue for audio recording, acknowledge it ONCE in a single brief line at the start of "MATTERS DISCUSSED": "Client consent to audio recording obtained."
- Do NOT elaborate on the consent process, GDPR explanations, data protection details, or consent script language
- Do NOT include consent dialogue as a separate numbered topic or section
- Focus exclusively on substantive legal matters discussed AFTER consent was obtained
- If the recording consists primarily of consent dialogue with minimal legal discussion, produce a brief attendance note acknowledging limited substantive legal content was discussed

Your attendance note MUST follow this professional UK legal practice format:

**ATTENDANCE NOTE**

${metadataFields}

**MATTER:**     ${metadata.title}

**CLIENT:**     ${metadata.clientName}

**MATTERS DISCUSSED**

**1. [FIRST MAJOR TOPIC - USE CLEAR PROFESSIONAL HEADING IN CAPS]**

   [Opening paragraph describing the issue or matter discussed - based strictly on transcript. Use professional legal narrative style.]
   
   [Client's position/situation - describe what the client disclosed using formal language]
   
   [Legal advice provided - use professional terminology. Always write: "I advised the client that..." NOT "We discussed..." or "I told them..."]
   
   Key points advised:
   - [Advice point 1]
   - [Advice point 2]
   - [Advice point 3]
   
   [Client's response: "The client confirmed understanding and instructed..." or "The client requested..."]

**2. [SECOND MAJOR TOPIC - IN CAPS]**

   [Continue same professional structure for each topic discussed]
   
   Facts established:
   - [Fact 1 from transcript]
   - [Fact 2 from transcript]
   
   Legal position explained:
   I advised the client that [legal principle or position]. Specifically:
   
   - [Advice point 1]
   - [Advice point 2]

**3. [ADDITIONAL TOPICS AS NEEDED]**

   [Continue for each major discussion point]

**[FINAL NUMBERED SECTION]. NEXT STEPS**

   Solicitor to action:
   1. [First action step with clear description]
      Due: [Specific date if mentioned, or "Not recorded in this session"]
   
   2. [Second action step]
      Due: [Specific date if mentioned]
   
   Client to action:
   1. [Action required from client]
      Due: [Specific date if mentioned]
   
   2. [Action required from client]
      Due: [Specific date if mentioned]
   
   Next appointment: [Date/time if scheduled, or "Not recorded in this session"]

${footerSection}

FORMATTING GUIDELINES:
- Use **bold** for ALL section headings (ATTENDANCE NOTE, MATTERS DISCUSSED, each numbered topic, NEXT STEPS)
- Use clean white space between sections - NO horizontal lines or underscores
- Use dash (-) for ALL sub-points and bullet lists
- Use numbered lists (1. 2. 3.) for main topics and sequential action steps
- Write in formal but clear UK legal language throughout
- ALWAYS use professional terminology:
  * "I advised the client that..." NOT "We discussed..." or "I told them..."
  * "The client instructed..." NOT "They said..."
  * "The client confirmed..." NOT "They agreed..."
  * "I explained the legal position regarding..." NOT "I talked about..."
- Include specific amounts, dates, and deadlines where mentioned in transcript
- Use 24-hour time format (14:30 not 2:30 PM)
- Use full date format (10 November 2025 not 10/11/2025)
- If the client has vulnerabilities or special circumstances, note them where relevant to the legal position

IMPORTANT: This attendance note must be reviewed and verified by the supervising solicitor before being added to the client file. All legal advice and action items should be confirmed against current UK law and SRA guidance.

Adhere strictly to the facts presented in the transcript. Where information is missing, use the exact phrase "Not recorded in this session" rather than inventing details.`;

    if (metadata.templateId === 'matter_inception') {
      systemPrompt += `

MATTER INCEPTION RECORD — AML COMPLIANCE SUMMARY:
This meeting uses the Matter Inception Record template. After the standard attendance note content and NEXT STEPS section, you MUST append an additional section titled "AML COMPLIANCE SUMMARY". This section extracts and structures all AML-relevant information discussed during the meeting.

The AML COMPLIANCE SUMMARY section MUST follow this exact structure:

**AML COMPLIANCE SUMMARY**

**Identity Verification:**
[Summarise what identity documents were discussed, presented, or verified. If not addressed, state: "Not recorded in this session"]

**Nature and Purpose of Instruction:**
[Summarise the stated reason for the client seeking legal services. If not addressed, state: "Not recorded in this session"]

**Source of Funds:**
[Summarise what was discussed about where the funds for the transaction are coming from. Include specific amounts if mentioned. If not addressed, state: "Not recorded in this session"]

**Beneficial Ownership:**
[Summarise who the beneficial owner is, including whether the client is acting on behalf of a third party, company, or trust. If not addressed, state: "Not recorded in this session"]

**PEP/Sanctions Status:**
[Note whether the client or any connected party was identified as a Politically Exposed Person or subject to sanctions. If not addressed, state: "Not recorded in this session"]

**Risk Assessment:**
[Summarise any risk factors noted — client risk level (low/medium/high), geographic risk, transaction complexity, sector risk. If not addressed, state: "Not recorded in this session"]

**Enhanced Due Diligence (EDD):**
[Note whether EDD was considered necessary and the reasoning. If not addressed, state: "Not recorded in this session"]

**Solicitor Confirmation:**
[Note whether the solicitor confirmed they are satisfied to proceed with the matter on the basis of the information provided. If not addressed, state: "Not recorded in this session"]

CRITICAL: For each field, extract ONLY what was actually said in the transcript. Where an area was not covered in the meeting, you MUST state "Not recorded in this session" — do NOT fabricate or assume compliance information.`;
    }

    if (metadata.practiceArea) {
      try {
        const { getPracticeAreaPromptContext } = require('./practiceAreaConfig');
        const paContext = getPracticeAreaPromptContext(metadata.practiceArea);
        if (paContext) {
          systemPrompt += `\n\n${paContext}`;
        }
      } catch {}
    }

    const userPrompt = `Generate a professional attendance note for the following meeting transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    if (DocumentService.isShortRecording(transcript, utterances)) {
      console.log('Short recording detected — generating brief file note instead of full attendance note');
      return await this.generateBriefFileNote(transcript, metadata);
    }

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  /**
   * Generate summary from transcript
   */
  async generateSummary(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified solicitor specializing in creating concise, actionable case summaries for legal professionals working under English and Welsh law.

ABSOLUTE ANTI-FABRICATION RULES — READ BEFORE GENERATING ANY CONTENT:
You MUST treat these rules as inviolable. Breach of any of them renders the document professionally negligent.

1. EVERY SINGLE STATEMENT in this summary must have a direct, traceable basis in the transcript provided. If you cannot point to a specific passage in the transcript that supports a statement, you MUST NOT include that statement.
2. You MUST NOT draw on your training knowledge to supplement, elaborate, or contextualise sparse transcripts. If the transcript says little, the summary must be correspondingly brief.
3. You MUST NOT infer, assume, or fabricate any legal advice, recommendations, case strategy, next steps, or factual details that are not explicitly stated in the transcript.
4. For any section or field that cannot be completed from the transcript, you MUST use the exact phrase: "Not recorded in this session" — do not paraphrase, do not guess, do not fill in plausible details.
5. Do NOT add substantive legal advice, case law references, statutory provisions, or procedural guidance unless the solicitor in the transcript explicitly stated them.
6. Prioritize accuracy over completeness — it is far better to omit information than to guess or fabricate.

ADDITIONAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Use UK legal terminology and practice conventions

SPEAKER-LABELED TRANSCRIPTS:
- The transcript may include speaker labels in the format "[Speaker A]: text" or "[Speaker B]: text"
- Use these labels to distinguish between client statements and solicitor advice
- Identify the solicitor by content (legal advice, analysis) and the client by their concerns/questions
- Leverage speaker separation to more accurately summarize client concerns vs solicitor recommendations

CONSENT RECORDING HANDLING:
- If the transcript includes consent dialogue for audio recording, you may briefly note "Consent to recording obtained" if contextually relevant
- Do NOT include consent dialogue in "Key Points", "Critical Issues", or any substantive sections
- Do NOT elaborate on consent process, GDPR explanations, or data protection discussions
- Focus exclusively on substantive legal matters, client concerns, and action items
- Exclude all consent-related dialogue from the summary entirely

Structure your summary as follows:

**MEETING SUMMARY**

**Case:** ${metadata.title}
**Client:** ${metadata.clientName}
**Date:** ${metadata.recordingDate}

**Key Points:**
• [Most important point 1 - from transcript only]
• [Most important point 2 - from transcript only]
• [Most important point 3 - from transcript only]

**Critical Issues Identified:**
• [Issue 1 - only if explicitly identified in meeting]
• [Issue 2 - only if explicitly identified in meeting]

**Immediate Actions Required:**
1. [Urgent action 1 - only if specified in transcript]
2. [Urgent action 2 - only if specified in transcript]

**Client Concerns:**
[Brief list of client's main concerns or questions - based solely on transcript]

**Solicitor Recommendations:**
[Key advice or recommendations provided during the meeting - do not add additional legal advice]

**IMPORTANT:** This summary is based solely on the meeting transcript and must be reviewed by the supervising solicitor. All legal advice should be verified against current UK law and updated legal authorities before relying on it.

Keep it brief (1-2 pages maximum), prioritize urgency and importance, use clear UK legal language, and adhere strictly to the facts presented in the transcript.`;

    const userPrompt = `Generate a summary for the following meeting transcript:

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  private static get SHORT_RECORDING_SECONDS_THRESHOLD(): number {
    const envVal = process.env.SHORT_RECORDING_SECONDS_THRESHOLD;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 60;
  }

  static isShortRecording(transcript: string, utterances?: Array<{ text: string; start: number; end: number }>): boolean {
    const consentPhrases = [
      /consent to (?:being )?record/i,
      /recording (?:this|our) (?:meeting|conversation|call)/i,
      /do you (?:agree|consent)/i,
      /are you (?:happy|okay|ok) (?:for|with|to)/i,
      /permission to record/i,
      /this (?:meeting|call|conversation) (?:is|will be) (?:being )?recorded/i,
      /gdpr|data protection|privacy notice/i,
    ];

    if (utterances && utterances.length > 0) {
      const substantiveUtterances = utterances.filter(u =>
        !consentPhrases.some(pattern => pattern.test(u.text))
      );

      const substantiveDurationMs = substantiveUtterances.reduce(
        (total, u) => total + (u.end - u.start),
        0
      );
      const substantiveDurationSeconds = substantiveDurationMs / 1000;
      return substantiveDurationSeconds < DocumentService.SHORT_RECORDING_SECONDS_THRESHOLD;
    }

    const lines = transcript.split('\n');
    const substantiveLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return !consentPhrases.some(pattern => pattern.test(trimmed));
    });

    const substantiveText = substantiveLines.join(' ');
    const wordCount = substantiveText.split(/\s+/).filter(w => w.length > 0).length;
    const estimatedSeconds = (wordCount / 150) * 60;
    return estimatedSeconds < DocumentService.SHORT_RECORDING_SECONDS_THRESHOLD;
  }

  private async generateBriefFileNote(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified solicitor creating a brief file note for a short recording.

ABSOLUTE ANTI-FABRICATION RULES:
1. EVERY statement must have a direct basis in the transcript. If you cannot trace it to the transcript, do not include it.
2. Do NOT draw on training knowledge to supplement the transcript.
3. For anything not in the transcript, use: "Not recorded in this session"
4. Do NOT add legal advice, case law, or procedural guidance not explicitly stated in the transcript.

This recording was brief and contained limited substantive content. Generate a short file note (not a full attendance note) that captures only what was actually discussed.

Format:
**FILE NOTE**

File Reference: ${metadata.matterReference || 'TBD'}
Date: ${metadata.recordingDate}
Client: ${metadata.clientName}
Matter: ${metadata.title}

**Note:** This is a brief file note generated from a short recording with limited substantive legal content.

**Content:**
[Brief summary of what was actually said — only from the transcript]

This file note is subject to legal professional privilege.`;

    const userPrompt = `Generate a brief file note from this short recording transcript:\n\n${transcript}`;

    const result = await this.generateDocument(systemPrompt, userPrompt);
    return { ...result, isShortRecording: true };
  }

  async verifyDocumentAgainstTranscript(
    document: string,
    transcript: string
  ): Promise<{ warnings: string[]; inputTokens: number; outputTokens: number; cost: number }> {
    try {
      console.log('Running post-generation verification against transcript...');

      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        max_tokens: 2000,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are a legal document auditor. Your task is to compare a generated legal document against the source transcript and identify any statements in the document that CANNOT be traced to specific content in the transcript.

For each unverifiable statement, provide a brief description of the claim and why it cannot be found in the transcript.

RULES:
- Standard formatting elements (headings, boilerplate disclaimers like "subject to legal professional privilege") are NOT considered fabrications.
- "Not recorded in this session" placeholder entries are NOT fabrications.
- Focus on substantive claims: legal advice, factual assertions, action items, dates, amounts, and recommendations.
- A statement is unverifiable if the transcript does not contain content that directly supports it.

Return your response as a JSON object with this structure:
{"unverifiable_statements": ["description of statement 1 not found in transcript", "description of statement 2 not found in transcript"]}

If all substantive statements are traceable to the transcript, return: {"unverifiable_statements": []}`,
          },
          {
            role: 'user',
            content: `TRANSCRIPT:\n${transcript}\n\n---\n\nGENERATED DOCUMENT:\n${document}\n\nIdentify any substantive statements in the document that cannot be traced to the transcript. Return JSON only.`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      let warnings: string[] = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          warnings = parsed.unverifiable_statements || [];
        } else {
          warnings = ['Verification response could not be parsed — solicitor review is required before this document is added to the client file'];
        }
      } catch (parseError) {
        console.warn('Failed to parse verification response:', parseError);
        warnings = ['Verification response could not be parsed — solicitor review is required before this document is added to the client file'];
      }

      console.log(`Verification complete. Found ${warnings.length} unverifiable statement(s). Cost: $${cost.toFixed(4)}`);

      return { warnings, inputTokens, outputTokens, cost };
    } catch (error: any) {
      console.error('Verification pass failed:', error);
      return { warnings: ['Automated verification failed — solicitor review is required before this document is added to the client file'], inputTokens: 0, outputTokens: 0, cost: 0 };
    }
  }

  private async generateDocument(
    systemPrompt: string,
    userPrompt: string
  ): Promise<DocumentGenerationResult> {
    try {
      console.log('Generating document with GPT-4o...');

      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        max_tokens: 4000,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const rawContent = response.choices[0]?.message?.content || '';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      const content = ensureBoldHeadings(rawContent);

      console.log(`Document generated with GPT-4o. Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${cost.toFixed(4)}`);

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
      };
    } catch (error: any) {
      console.error('GPT-4o document generation failed:', error);
      throw new Error(`Document generation failed: ${error.message}`);
    }
  }

  async generateTelephoneAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a telephone attendance note compliant with SRA standards.

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate any details not present in the transcript
- If information is missing, state "Not specified" rather than guessing
- Keep the note concise and factual — telephone calls produce shorter notes than full meetings
- Use UK legal terminology throughout

Format:

**TELEPHONE ATTENDANCE NOTE**

File Reference:  ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Time:           {Call time from transcript, or "Not recorded"}
Duration:       {Call duration, or "Not recorded"}
Solicitor:      ${solicitorFormat}

**MATTER:**     ${metadata.title}
**CLIENT:**     ${metadata.clientName}

**CALL SUMMARY**

[Brief factual account of what was discussed, advice given, and instructions received. Use "I advised the client that..." phrasing. Keep to 2-4 paragraphs maximum.]

**ACTION POINTS**

Solicitor:
1. [Action if any]

Client:
1. [Action if any]

This telephone attendance note is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for headings. Keep the entire note to approximately half a page. Be factual and concise.`;

    const userPrompt = `Generate a telephone attendance note for this call transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateFileNote(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified solicitor creating a brief file note.

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript or notes provided
- Do NOT invent details
- A file note is a single-paragraph internal record — keep it brief and factual
- Use UK legal terminology

Format:

**FILE NOTE**

File Reference: ${metadata.matterReference || 'TBD'}
Date: ${metadata.recordingDate}
Matter: ${metadata.title}
Client: ${metadata.clientName}

[Single paragraph summarising the key point being recorded. This should be 3-6 sentences maximum, capturing the essential facts, any decision made, and any follow-up required.]

This file note is subject to legal professional privilege.`;

    const userPrompt = `Generate a file note from the following:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}

**Content:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateCourtAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a court attendance note compliant with SRA standards.

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate details
- If information is missing, state "Not specified in hearing" rather than guessing
- Use UK legal terminology and court conventions throughout

Format:

**COURT ATTENDANCE NOTE**

File Reference:  ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Court:          {Court name from transcript, or "Not recorded"}
Before:         {Judge name and title from transcript, or "Not recorded"}
Case Number:    {Case number from transcript, or "Not recorded"}

**MATTER:**     ${metadata.title}
**CLIENT:**     ${metadata.clientName}

**PARTIES PRESENT**

- [List parties and their representatives as identified in transcript]

**HEARING SUMMARY**

**1. [NATURE OF HEARING]**

[Description of the type of hearing and its purpose]

**2. [SUBMISSIONS AND ARGUMENTS]**

[Key submissions made by each party]

**3. [ORDERS MADE]**

[List all orders made by the court]

**4. [DIRECTIONS]**

[List any directions given with dates]

**NEXT STEPS**

Solicitor to action:
1. [Action with deadline]

Client to action:
1. [Action with deadline]

Next hearing: [Date if scheduled, or "To be listed"]

This court attendance note is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for all section headings. Be thorough but concise.`;

    const userPrompt = `Generate a court attendance note from this hearing transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generatePoliceStationAttendanceNote(
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    const prefs = {
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
    };

    const solicitorFormat = prefs.showFullSolicitorName
      ? '{Solicitor full name and title from transcript, or "Not recorded"}'
      : '{Solicitor initials from transcript, or "Not recorded"}';

    const systemPrompt = `You are a UK-qualified solicitor creating a police station attendance record compliant with PACE (Police and Criminal Evidence Act 1984) requirements and SRA standards.

CRITICAL INSTRUCTIONS:
- Base all content strictly on the transcript provided
- Do NOT invent or fabricate details
- This record must be PACE-compliant — accuracy is paramount
- Use UK criminal law terminology throughout

Format:

**POLICE STATION ATTENDANCE RECORD**

File Reference:     ${metadata.matterReference || 'TBD'}
Date:               ${metadata.recordingDate}
Station:            {Police station name from transcript, or "Not recorded"}
Custody Number:     {Custody reference from transcript, or "Not recorded"}
Arrival Time:       {Time of arrival from transcript, or "Not recorded"}
Departure Time:     {Time of departure from transcript, or "Not recorded"}

**CLIENT:**         ${metadata.clientName}
**OFFENCE(S):**     {Offence(s) as stated from transcript, or "Not specified"}

**1. INITIAL CONSULTATION**

[Summary of private consultation with client before interview, including advice given on right to silence, disclosure reviewed, and client's instructions]

**2. DISCLOSURE**

[Summary of disclosure provided by police, any issues with adequacy of disclosure]

**3. INTERVIEW SUMMARY**

[Chronological summary of the interview, questions asked, answers given or "no comment" responses, any significant statements]

**4. ADVICE GIVEN**

[Record of legal advice provided at each stage, including pre-interview, during breaks, and post-interview]

**5. REPRESENTATIONS**

[Any representations made to custody sergeant regarding detention, bail, or conditions]

**6. OUTCOME**

[Outcome of attendance — charged, released under investigation, NFA, bail conditions]

**7. FOLLOW-UP ACTIONS**

Solicitor:
1. [Action required]

Client:
1. [Action required]

This police station attendance record is subject to legal professional privilege.

Prepared by: ${solicitorFormat}
Date Prepared: ${metadata.recordingDate}

FORMATTING: Use **bold** for all section headings. Be thorough and PACE-compliant.`;

    const userPrompt = `Generate a police station attendance record from this transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateMeetingNotes(
    transcript: string,
    metadata: CaseMetadata,
    utterances?: Array<{ speaker?: string; text: string; start: number; end: number }>
  ): Promise<DocumentGenerationResult> {
    const speakerNames = utterances?.map(u => u.speaker).filter(Boolean) ?? [];
    const attendeesList = speakerNames.length > 0
      ? [...new Set(speakerNames)].join(', ')
      : '{Attendees from transcript, or "Not recorded in this session"}';

    const systemPrompt = `You are a UK legal professional creating a structured internal meeting notes document. This is for an internal firm meeting (not a client meeting) so it does NOT require client care provisions, billing prompts, or PACE references.

ABSOLUTE ANTI-FABRICATION RULES:
1. Every statement must have a direct basis in the transcript provided.
2. Do NOT invent details, decisions, or obligations not mentioned in the transcript.
3. For any section that cannot be completed from the transcript, use: "Not recorded in this session"
4. Be concise and professional.

ATTENDEES: Extract the names or roles of all speakers from the transcript. If speaker labels are present (e.g., [Speaker A]), use them.

Format the output as follows:

**MEETING NOTES**

Date: ${metadata.recordingDate}
Attendees: ${attendeesList}
Purpose: {State the stated purpose of the meeting from the transcript, or "Not recorded in this session"}

**Discussion Points**

[For each main topic discussed, provide a numbered heading and a brief factual summary. Only include topics explicitly discussed in the transcript.]

**Decisions Made**

[List any decisions made during the meeting. If none, state "No formal decisions recorded in this session."]

**Obligations**

[List any commitments, tasks, or undertakings agreed during the meeting with the responsible party and deadline if mentioned. If none, state "No obligations recorded in this session."]

---
*These meeting notes are for internal firm use only.*

FORMATTING GUIDELINES:
- Use **bold** for section headings
- Use numbered lists for discussion points
- Use dash (-) for bullet points within sections
- Keep language professional but less formal than client attendance notes
- Do NOT include billing time prompts, PACE references, or AML sections`;

    const userPrompt = `Generate structured meeting notes for this internal meeting transcript:

**Meeting Title:** ${metadata.title}
**Date:** ${metadata.recordingDate}

**Transcript:**
${transcript}`;

    return await this.generateDocument(systemPrompt, userPrompt);
  }

  async generateDocumentByRecordingType(
    recordingType: string,
    transcript: string,
    metadata: CaseMetadata,
    firmPreferences?: FirmPreferences,
    utterances?: Array<{ text: string; start: number; end: number }>
  ): Promise<DocumentGenerationResult> {
    switch (recordingType) {
      case 'telephone_call':
        return this.generateTelephoneAttendanceNote(transcript, metadata, firmPreferences);
      case 'file_note':
        return this.generateFileNote(transcript, metadata);
      case 'court_hearing':
        return this.generateCourtAttendanceNote(transcript, metadata, firmPreferences);
      case 'police_station':
        return this.generatePoliceStationAttendanceNote(transcript, metadata, firmPreferences);
      case 'internal_meeting':
        return this.generateMeetingNotes(transcript, metadata, utterances);
      case 'full_meeting':
      default:
        return this.generateAttendanceNote(transcript, metadata, firmPreferences, utterances);
    }
  }

  /**
   * Extract action items from transcript
   */
  async extractActionItems(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<{ items: ExtractedActionItem[], cost: number, inputTokens: number, outputTokens: number }> {
    const systemPrompt = `You are a legal assistant specializing in extracting action items and follow-ups from legal meeting transcripts.

TASK: Extract all action items, tasks, follow-ups, and deadlines mentioned in the transcript.

For each action item, identify:
1. A clear description of what needs to be done
2. Who should do it (Solicitor, Client, or specific name if mentioned)
3. Any deadline or timeframe mentioned (convert to ISO date format YYYY-MM-DD if possible)
4. Priority level based on urgency words used (high, medium, low)

IMPORTANT RULES:
- Only extract genuine action items that were explicitly discussed or agreed upon
- Do not invent or assume action items not mentioned in the transcript
- Capture follow-up calls, document requests, deadline commitments, research tasks
- Be conservative - when in doubt, mark as "medium" priority

OUTPUT FORMAT: Return a JSON object with an "items" array:
{
  "items": [
    {
      "description": "Brief description of the action item",
      "assignee": "Solicitor" | "Client" | "specific name",
      "dueDate": "YYYY-MM-DD" | null,
      "priority": "high" | "medium" | "low"
    }
  ]
}

If no clear action items are found, return: {"items": []}`;

    const userPrompt = `Extract action items from this legal meeting transcript:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Return the action items as a JSON object with an "items" array:`;

    try {
      console.log('Extracting action items with GPT-4o...');
      
      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '[]';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      let items: ExtractedActionItem[] = [];
      try {
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.action_items || []);
      } catch (parseError) {
        console.error('Failed to parse action items JSON:', parseError);
        items = [];
      }

      console.log(`Extracted ${items.length} action items. Cost: $${cost.toFixed(4)}`);

      return { items, cost, inputTokens, outputTokens };
    } catch (error: any) {
      console.error('Action item extraction failed:', error);
      throw new Error(`Action item extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate pre-meeting briefing from all documents and transcripts for a case
   */
  async generatePreMeetingBriefing(
    meetings: Array<{
      date: string;
      transcript: string;
      attendanceNote?: string;
      summary?: string;
    }>,
    metadata: CaseMetadata,
    outstandingUndertakings?: Array<{ wording: string; deadline: Date | null; dateGiven: Date; status: string }>
  ): Promise<DocumentGenerationResult> {
    let undertakingsSection = '';
    if (outstandingUndertakings && outstandingUndertakings.length > 0) {
      undertakingsSection = `\n7. **Outstanding Undertakings** - CRITICAL: List all outstanding undertakings given by this firm on this matter. These are binding professional commitments that MUST be addressed. Include deadlines where applicable. Mark any overdue undertakings clearly.\n`;
    }

    const systemPrompt = `You are a UK legal assistant preparing a concise pre-meeting briefing for a solicitor before their next client meeting.

TASK: Generate a 1-page professional briefing document summarizing all prior meetings on this matter.

The briefing should include:
1. **Matter Summary** - Brief overview of the case and client situation
2. **Key Discussion Points** - Main topics from previous meetings
3. **Outstanding Action Items** - Tasks that were assigned but may still be pending
4. **Important Dates & Deadlines** - Any critical dates mentioned
5. **Client Concerns** - Any worries or priorities the client has expressed
6. **Suggested Agenda Items** - Topics to discuss in the next meeting${undertakingsSection}

CRITICAL RULES:
- Be concise and scannable - solicitors need to review this quickly before meetings
- Only include information from the provided meeting records - do not fabricate details
- Use professional UK legal terminology
- Format for easy reading with clear headings and bullet points
- Keep the entire briefing to approximately one printed page
- If information is not available in the records, use the exact phrase "Not recorded in this session" rather than guessing
- If outstanding undertakings are provided, they MUST be prominently featured as they represent binding professional obligations`;

    const meetingsSummary = meetings.map((m, idx) => `
--- MEETING ${idx + 1} (${m.date}) ---
${m.summary ? `SUMMARY:\n${m.summary}\n` : ''}
${m.attendanceNote ? `ATTENDANCE NOTE:\n${m.attendanceNote}\n` : ''}
${m.transcript ? `TRANSCRIPT EXCERPT:\n${m.transcript.slice(0, 5000)}\n` : ''}
`).join('\n');

    let undertakingsData = '';
    if (outstandingUndertakings && outstandingUndertakings.length > 0) {
      undertakingsData = `\n\nOUTSTANDING UNDERTAKINGS (BINDING COMMITMENTS):\n${outstandingUndertakings.map((u, i) => {
        const deadlineStr = u.deadline ? new Date(u.deadline).toISOString().split('T')[0] : 'No deadline specified';
        const givenStr = new Date(u.dateGiven).toISOString().split('T')[0];
        const isOverdue = u.deadline && new Date(u.deadline) < new Date();
        return `${i + 1}. ${u.wording}\n   Given: ${givenStr} | Deadline: ${deadlineStr}${isOverdue ? ' [OVERDUE]' : ''}`;
      }).join('\n')}\n`;
    }

    const userPrompt = `Generate a pre-meeting briefing for:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}
Number of Prior Meetings: ${meetings.length}

MEETING RECORDS:
${meetingsSummary}${undertakingsData}

Generate the briefing document:`;

    return this.generateDocument(systemPrompt, userPrompt);
  }
  async generateClientCareLetter(params: {
    firmName: string;
    firmAddress?: string;
    firmPhone?: string;
    firmEmail?: string;
    sraNumber?: string;
    feeEarnerName: string;
    clientName: string;
    matterDescription: string;
    practiceArea: string;
    costsEstimate?: string;
    matterReference?: string;
  }): Promise<DocumentGenerationResult> {
    const { getClientCareLetterPrompt } = require('./practiceAreaConfig');
    const systemPrompt = getClientCareLetterPrompt(params);

    const userPrompt = `Generate the client care letter now based on the details provided. Output the complete letter in professional format ready for solicitor review.`;

    return this.generateDocument(systemPrompt, userPrompt);
  }

  async extractUndertakings(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<{ items: ExtractedUndertaking[], cost: number, inputTokens: number, outputTokens: number }> {
    const systemPrompt = `You are a UK legal compliance assistant specializing in identifying undertakings in legal meeting transcripts.

TASK: Identify all undertakings — binding commitments given by a solicitor on behalf of their firm — in the transcript.

Undertaking language includes phrases such as:
- "we undertake to..."
- "I give an undertaking that..."
- "we will provide by..."
- "I confirm we will..."
- "I undertake to..."
- "this firm undertakes..."
- "we give our undertaking..."
- "I/we confirm that we will..."
- Any promise or commitment by the solicitor to do something specific, especially with a deadline

For each undertaking found, extract:
1. The precise wording of the undertaking commitment
2. Who gave the undertaking (speaker name or role)
3. The exact quoted text from the transcript containing the undertaking language
4. Any deadline mentioned (convert to ISO date format YYYY-MM-DD if possible)

IMPORTANT RULES:
- Only extract genuine undertakings — binding professional commitments by the solicitor or firm
- Do NOT include general action items, to-do lists, or informal promises
- Focus on language that creates a binding professional obligation
- Be conservative — when in doubt, do NOT include it
- The source quote must be the exact text from the transcript

OUTPUT FORMAT: Return a JSON object with an "items" array:
{
  "items": [
    {
      "wording": "Clear description of the undertaking commitment",
      "speaker": "Solicitor" | "specific name",
      "sourceQuote": "Exact quoted text from transcript",
      "deadline": "YYYY-MM-DD" | null
    }
  ]
}

If no undertakings are found, return: {"items": []}`;

    const userPrompt = `Identify all undertakings in this legal meeting transcript:

Matter: ${metadata.title}
Client: ${metadata.clientName}
${metadata.matterReference ? `Reference: ${metadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Return the undertakings as a JSON object with an "items" array:`;

    try {
      console.log('Extracting undertakings with GPT-4o...');

      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"items":[]}';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      let items: ExtractedUndertaking[] = [];
      try {
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.undertakings || []);
      } catch (parseError) {
        console.error('Failed to parse undertakings JSON:', parseError);
        items = [];
      }

      console.log(`Extracted ${items.length} undertaking(s). Cost: $${cost.toFixed(4)}`);

      return { items, cost, inputTokens, outputTokens };
    } catch (error: any) {
      console.error('Undertaking extraction failed:', error);
      throw new Error(`Undertaking extraction failed: ${error.message}`);
    }
  }
}

export interface ExtractedActionItem {
  description: string;
  assignee: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
}

export interface ExtractedUndertaking {
  wording: string;
  speaker: string | null;
  sourceQuote: string;
  deadline: string | null;
}
