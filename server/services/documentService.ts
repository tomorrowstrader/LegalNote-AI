import { openaiClient, MODELS, calculateGPT4oCost } from '../config/openai';

export interface DocumentGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CaseMetadata {
  title: string;
  clientName: string;
  matterReference?: string;
  recordingDate: string;
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
    firmPreferences?: FirmPreferences
  ): Promise<DocumentGenerationResult> {
    // Apply firm preferences (default to true if not specified)
    const prefs = {
      includeLocation: firmPreferences?.includeLocation ?? true,
      showFullSolicitorName: firmPreferences?.showFullSolicitorName ?? true,
      includeClientConfirmation: firmPreferences?.includeClientConfirmation ?? false,
    };

    // Build metadata header based on preferences
    let metadataFields = `File Reference:  ${metadata.matterReference || 'TBD'}
Date:           ${metadata.recordingDate}
Time:           {Meeting start time in 24-hour format from transcript, or "Not recorded"}
Duration:       {Total meeting duration from transcript, or "Not recorded"}`;

    if (prefs.includeLocation) {
      metadataFields += `\nLocation:       {Meeting location from transcript, or "Not recorded"}`;
    }

    if (prefs.showFullSolicitorName) {
      metadataFields += `\nSolicitor:      {Solicitor full name and title from transcript, or "Not recorded"}`;
    } else {
      metadataFields += `\nSolicitor:      {Solicitor initials from transcript, or "Not recorded"}`;
    }

    // Build footer with optional client confirmation
    const preparedByFormat = prefs.showFullSolicitorName 
      ? '{Solicitor name and title from transcript, or "To be completed"}'
      : '{Solicitor initials from transcript, or "To be completed"}';

    let footerSection = `Time Engaged: {Total meeting duration from transcript, or "Not recorded"}

This attendance note is subject to legal professional privilege.

Prepared by: ${preparedByFormat}
Date Prepared: ${metadata.recordingDate}`;

    if (prefs.includeClientConfirmation) {
      footerSection += `\n\n**CLIENT CONFIRMATION**

I confirm the above is an accurate record of our meeting.

Client Signature: ________________

Date: ________________`;
    }

    const systemPrompt = `You are a UK-qualified solicitor specializing in creating professional attendance notes compliant with Solicitors Regulation Authority (SRA) standards and English law practice requirements.

CRITICAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Base all observations strictly on the information provided in the transcript
- Do NOT invent, assume, or fabricate any details not present in the transcript
- If information is unclear or missing, explicitly state "Not specified in meeting" rather than guessing
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
      Due: [Specific date if mentioned, or "To be determined"]
   
   2. [Second action step]
      Due: [Specific date if mentioned]
   
   Client to action:
   1. [Action required from client]
      Due: [Specific date if mentioned]
   
   2. [Action required from client]
      Due: [Specific date if mentioned]
   
   Next appointment: [Date/time if scheduled, or "To be arranged"]

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

Adhere strictly to the facts presented in the transcript. Where information is missing, explicitly state "Not specified" or "Not recorded" rather than inventing details.`;

    const userPrompt = `Generate a professional attendance note for the following meeting transcript:

**Case Title:** ${metadata.title}
**Client Name:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'TBD'}

**Transcript:**
${transcript}`;

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

CRITICAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Extract information ONLY from the provided transcript - do not invent, assume, or fabricate details
- If any section cannot be completed from the transcript, state "Not discussed in meeting" rather than speculating
- Use UK legal terminology and practice conventions
- Prioritize accuracy over completeness - it is better to omit information than to guess

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

  /**
   * Core document generation with GPT-4o
   */
  private async generateDocument(
    systemPrompt: string,
    userPrompt: string
  ): Promise<DocumentGenerationResult> {
    try {
      console.log('Generating document with GPT-4o...');
      
      const response = await openaiClient.chat.completions.create({
        model: MODELS.DOCUMENT_GENERATION,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for consistent, professional output
        max_tokens: 4000, // Allow for detailed documents
      });

      const content = response.choices[0]?.message?.content || '';
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = calculateGPT4oCost(inputTokens, outputTokens);

      console.log(`Document generated. Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${cost.toFixed(4)}`);

      return {
        content,
        inputTokens,
        outputTokens,
        cost,
      };
    } catch (error: any) {
      console.error('Document generation failed:', error);
      throw new Error(`Document generation failed: ${error.message}`);
    }
  }
}
