import OpenAI, { toFile } from "openai";
import type { Readable } from "stream";

export interface TranscriptionResult {
  text: string;
  duration?: number;
}

export interface DocumentGenerationResult {
  attendanceNote: string;
  legalOpinion: string;
}

export class OpenAIService {
  private _client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this._client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured. Please add your OpenAI API key to enable AI features.');
      }
      this._client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this._client;
  }
  async transcribeAudio(audioBuffer: Buffer, filename: string = "audio.webm"): Promise<TranscriptionResult> {
    try {
      console.log(`Starting transcription for ${filename}, size: ${audioBuffer.length} bytes`);
      
      const client = this.getClient();
      
      // Use OpenAI's toFile helper to create a proper File-like object for Node.js
      const file = await toFile(audioBuffer, filename, {
        type: "audio/webm",
      });
      
      const transcription = await client.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
      });
      
      console.log(`Transcription completed: ${transcription.text.substring(0, 100)}...`);
      
      return {
        text: transcription.text,
        duration: transcription.duration,
      };
    } catch (error: any) {
      console.error('Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  async generateDocuments(
    transcript: string,
    caseMetadata: {
      title: string;
      clientName: string;
      matterReference?: string;
    }
  ): Promise<DocumentGenerationResult> {
    try {
      console.log(`Generating documents for case: ${caseMetadata.title}`);
      
      const [attendanceNote, legalOpinion] = await Promise.all([
        this.generateAttendanceNote(transcript, caseMetadata),
        this.generateLegalOpinion(transcript, caseMetadata),
      ]);
      
      return {
        attendanceNote,
        legalOpinion,
      };
    } catch (error: any) {
      console.error('Document generation error:', error);
      throw new Error(`Failed to generate documents: ${error.message}`);
    }
  }

  private async generateAttendanceNote(
    transcript: string,
    caseMetadata: {
      title: string;
      clientName: string;
      matterReference?: string;
    }
  ): Promise<string> {
    const prompt = `You are a UK solicitor drafting a professional attendance note from a client meeting transcript.

CASE DETAILS:
- Matter: ${caseMetadata.title}
- Client: ${caseMetadata.clientName}
${caseMetadata.matterReference ? `- Reference: ${caseMetadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Please draft a professional attendance note following UK legal standards. The note should include:
1. Date and time of meeting
2. Parties present
3. Matter reference
4. Clear, chronological summary of discussion points
5. Key facts disclosed
6. Instructions received
7. Advice given (if any)
8. Next steps and action points

FORMATTING REQUIREMENTS:
- Use markdown formatting with **bold** for section headings
- Always add a blank line before bullet point lists
- Use proper markdown lists (- or •) 
- Example:
  **Key Points:**
  
  - First point
  - Second point

Be concise but comprehensive.`;

    const client = this.getClient();
    
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an experienced UK solicitor with expertise in drafting clear, professional legal documentation. Your attendance notes are known for their clarity, accuracy, and compliance with UK legal standards.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || "Failed to generate attendance note";
  }

  private async generateLegalOpinion(
    transcript: string,
    caseMetadata: {
      title: string;
      clientName: string;
      matterReference?: string;
    }
  ): Promise<string> {
    const prompt = `You are a UK solicitor providing a draft legal opinion based on a client meeting transcript.

CASE DETAILS:
- Matter: ${caseMetadata.title}
- Client: ${caseMetadata.clientName}
${caseMetadata.matterReference ? `- Reference: ${caseMetadata.matterReference}` : ''}

TRANSCRIPT:
${transcript}

Please draft a professional legal opinion following UK legal standards. The opinion should include:
1. Brief summary of the matter
2. Key legal issues identified
3. Relevant UK law and regulations
4. Analysis of client's position
5. Potential risks and considerations
6. Preliminary recommendations
7. Disclaimer about need for further review

FORMATTING REQUIREMENTS:
- Use markdown formatting with **bold** for section headings
- Always add a blank line before bullet point lists
- Use proper markdown lists (- or •)
- Example:
  **Key Points:**
  
  - First point
  - Second point

Be thorough but acknowledge this is a preliminary assessment based on initial consultation.`;

    const client = this.getClient();
    
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an experienced UK solicitor providing preliminary legal opinions. You understand UK law and can identify key legal issues, risks, and provide sound initial guidance while appropriately disclaiming that comprehensive advice requires further analysis.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    return response.choices[0]?.message?.content || "Failed to generate legal opinion";
  }
}

export const openaiService = new OpenAIService();
