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
    const systemPrompt = `You are a legal documentation expert specializing in creating professional attendance notes for solicitors.

Your task is to generate a comprehensive attendance note from a meeting transcript following strict legal documentation standards.

Structure your attendance note as follows:

**ATTENDANCE NOTE**

**Matter:** ${metadata.matterReference || 'Not specified'}
**Client:** ${metadata.clientName}
**Date:** ${metadata.recordingDate}
**Attendees:** [Extract from transcript]

**Purpose of Meeting:**
[Brief statement of the meeting's objective]

**Discussion Points:**
1. [Key topic 1]
   - [Relevant details]
2. [Key topic 2]
   - [Relevant details]

**Decisions Made:**
- [Decision 1]
- [Decision 2]

**Action Items:**
- [Action 1 - Responsible party - Deadline]
- [Action 2 - Responsible party - Deadline]

**Next Steps:**
[Outline follow-up actions and timeline]

**Additional Notes:**
[Any other relevant information]

Write in professional legal language, be concise but complete, and maintain chronological order where possible.`;

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
    const systemPrompt = `You are a legal documentation expert specializing in creating concise, actionable summaries for solicitors.

Your task is to distill the meeting transcript into a clear executive summary that highlights the most critical information.

Structure your summary as follows:

**MEETING SUMMARY**

**Case:** ${metadata.title}
**Client:** ${metadata.clientName}
**Date:** ${metadata.recordingDate}

**Key Points:**
• [Most important point 1]
• [Most important point 2]
• [Most important point 3]

**Critical Issues Identified:**
• [Issue 1]
• [Issue 2]

**Immediate Actions Required:**
1. [Urgent action 1]
2. [Urgent action 2]

**Client Concerns:**
[Brief list of client's main concerns or questions]

**Solicitor Recommendations:**
[Key advice or recommendations provided]

Keep it brief (1-2 pages maximum), prioritize urgency and importance, and use clear, accessible language.`;

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
    const systemPrompt = `You are a senior legal professional specializing in providing detailed legal opinions based on client consultations.

Your task is to analyze the meeting transcript and provide a structured legal opinion that identifies issues, applicable law, analysis, and recommendations.

Structure your legal opinion as follows:

**LEGAL OPINION**

**RE:** ${metadata.title}
**Client:** ${metadata.clientName}
**Matter Reference:** ${metadata.matterReference || 'Not specified'}
**Date:** ${metadata.recordingDate}

**1. BACKGROUND**
[Brief factual background from the meeting]

**2. ISSUES IDENTIFIED**
[List the key legal issues raised during consultation]

**3. RELEVANT LAW & PRECEDENT**
[Applicable legislation, case law, or legal principles - note: this should be verified by the solicitor]

**4. LEGAL ANALYSIS**
[Detailed analysis of how the law applies to the facts]

**5. RISK ASSESSMENT**
**Strengths:**
• [Strength 1]
• [Strength 2]

**Weaknesses:**
• [Weakness 1]
• [Weakness 2]

**6. RECOMMENDATIONS**
1. [Primary recommendation]
2. [Alternative approach]
3. [Risk mitigation strategies]

**7. NEXT STEPS**
[Recommended course of action with timeline]

**IMPORTANT DISCLAIMER:**
This opinion is based solely on the information provided during the client meeting. Further research and verification of legal authorities is required. This document should be reviewed and validated by the supervising solicitor before being relied upon.

Use professional legal terminology, cite principles (even if not specific cases), and provide balanced analysis of risks and opportunities.`;

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
