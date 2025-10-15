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

export class DocumentService {
  /**
   * Generate attendance note from transcript
   */
  async generateAttendanceNote(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a UK-qualified solicitor specializing in creating professional attendance notes compliant with Solicitors Regulation Authority (SRA) standards and English law practice requirements.

CRITICAL INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Do not reference or apply law from other jurisdictions.
- Base all observations strictly on the information provided in the transcript
- Do NOT invent, assume, or fabricate any details not present in the transcript
- If information is unclear or missing, explicitly state "Not specified in meeting" rather than guessing
- Use UK legal terminology and practice conventions throughout

Structure your attendance note as follows:

**ATTENDANCE NOTE**

**Matter:** ${metadata.matterReference || 'Not specified'}
**Client:** ${metadata.clientName}
**Date:** ${metadata.recordingDate}
**Attendees:** [Extract from transcript - if unclear, state "Not clearly identified"]

**Purpose of Meeting:**
[Brief statement of the meeting's objective - based solely on transcript content]

**Discussion Points:**
1. [Key topic 1 - as discussed in meeting]
   - [Relevant details from transcript only]
2. [Key topic 2 - as discussed in meeting]
   - [Relevant details from transcript only]

**Decisions Made:**
- [Decision 1 - only if explicitly stated in transcript]
- [Decision 2 - only if explicitly stated in transcript]

**Action Items:**
- [Action 1 - Responsible party - Deadline (only if specified in meeting)]
- [Action 2 - Responsible party - Deadline (only if specified in meeting)]

**Next Steps:**
[Outline follow-up actions and timeline - based only on what was discussed]

**Additional Notes:**
[Any other relevant information from the transcript]

**IMPORTANT:** This attendance note must be reviewed and verified by the supervising solicitor before being added to the client file. All legal advice and action items should be confirmed against current UK law and SRA guidance.

Write in professional UK legal language, be concise but complete, maintain chronological order where possible, and adhere strictly to the facts presented in the transcript.`;

    const userPrompt = `Generate an attendance note for the following meeting transcript:

**Case Title:** ${metadata.title}

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
   * Generate legal opinion from transcript
   */
  async generateLegalOpinion(
    transcript: string,
    metadata: CaseMetadata
  ): Promise<DocumentGenerationResult> {
    const systemPrompt = `You are a senior UK-qualified solicitor with expertise in English and Welsh law, providing preliminary legal opinions based on client consultations in compliance with SRA standards.

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- You are an expert in English and Welsh law ONLY. Scottish and Northern Irish law are different jurisdictions - do not reference them unless the case explicitly involves those jurisdictions.
- Base ALL analysis strictly on information from the transcript
- When referencing legal principles, use ONLY general legal concepts that you are certain apply under UK law
- DO NOT cite specific cases, statutes, or statutory instruments unless you are absolutely certain they exist and are current
- If you are uncertain about any legal authority, use phrases like "applicable employment law principles" or "relevant consumer protection legislation" instead of specific citations
- NEVER invent case names, statute numbers, or legal authorities
- Clearly distinguish between: (a) facts from the meeting, (b) general legal principles, and (c) areas requiring formal research

Structure your legal opinion as follows:

**LEGAL OPINION**

**RE:** ${metadata.title}
**Client:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'Not specified'}
**Date:** ${metadata.recordingDate}

**1. BACKGROUND**
[Brief factual background from the meeting - transcript only, no assumptions]

**2. ISSUES IDENTIFIED**
[List the key legal issues raised during consultation - based solely on transcript]

**3. RELEVANT LEGAL PRINCIPLES**
[General legal principles that may apply under English/Welsh law - use generic references like "contract law principles," "statutory employment rights," "tort law of negligence" rather than specific citations]
[IMPORTANT: State "Requires formal legal research and citation verification" for each principle mentioned]

**4. PRELIMINARY ANALYSIS**
[Analysis of how general legal principles may apply to the facts from the meeting]
[Clearly mark any assumptions or areas of uncertainty]

**5. RISK ASSESSMENT**
**Potential Strengths:**
• [Strength 1 - based on facts from transcript]
• [Strength 2 - based on facts from transcript]

**Potential Weaknesses:**
• [Weakness 1 - based on facts from transcript]  
• [Weakness 2 - based on facts from transcript]

**6. PRELIMINARY RECOMMENDATIONS**
1. [Primary recommendation - clearly marked as preliminary]
2. [Alternative approach - clearly marked as preliminary]
3. [Risk mitigation strategies]

**7. REQUIRED NEXT STEPS**
[Recommended course of action including specific legal research required]

**MANDATORY DISCLAIMER:**
This is a PRELIMINARY opinion based solely on the client meeting transcript. It does NOT constitute formal legal advice. Before any action is taken:

1. All legal principles must be verified against current UK legislation and case law
2. Specific statutory provisions and precedents must be researched and cited
3. This opinion must be reviewed and approved by a supervising solicitor
4. Client should be advised only after full legal research is completed
5. Professional indemnity insurance implications should be considered

This document is for internal use only and should not be shared with the client until properly verified and approved.

Use professional UK legal terminology, provide balanced preliminary analysis, and clearly distinguish between established facts and areas requiring research. Prioritize accuracy and honesty about limitations over comprehensive coverage.`;

    const userPrompt = `Generate a legal opinion based on the following meeting transcript:

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
