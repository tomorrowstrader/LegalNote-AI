import { ObjectStorageService } from '../objectStorage';

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DiarizedTranscriptionResult {
  text: string;
  utterances: SpeakerUtterance[];
  speakerCount: number;
  duration: number;
  cost: number;
}

interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string | null;
  utterances: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }> | null;
  audio_duration: number | null;
  error: string | null;
}

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';
const ASSEMBLYAI_COST_PER_HOUR = 0.27;

export class AssemblyAIService {
  private objectStorageService: ObjectStorageService;
  private apiKey: string;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY is not configured');
    }
    this.apiKey = apiKey;
  }

  async transcribeWithDiarization(
    audioPath: string,
    audioDuration: number,
    expectedSpeakers?: number
  ): Promise<DiarizedTranscriptionResult> {
    console.log(`[AssemblyAI] Starting diarized transcription for: ${audioPath}`);

    try {
      const buffer = await this.objectStorageService.getObjectEntityFile(audioPath);
      console.log(`[AssemblyAI] Downloaded audio file: ${buffer.length} bytes`);

      const uploadUrl = await this.uploadAudio(buffer);
      console.log(`[AssemblyAI] Audio uploaded to: ${uploadUrl}`);

      const transcriptId = await this.createTranscript(uploadUrl, expectedSpeakers);
      console.log(`[AssemblyAI] Transcript job created: ${transcriptId}`);

      const result = await this.pollForCompletion(transcriptId);
      console.log(`[AssemblyAI] Transcription completed with ${result.utterances?.length || 0} utterances`);

      const cost = this.calculateCost(result.audio_duration || audioDuration);

      const utterances: SpeakerUtterance[] = (result.utterances || []).map(u => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
        confidence: u.confidence,
      }));

      const speakerSet = new Set(utterances.map(u => u.speaker));

      return {
        text: result.text || '',
        utterances,
        speakerCount: speakerSet.size,
        duration: result.audio_duration || audioDuration,
        cost,
      };
    } catch (error: any) {
      console.error('[AssemblyAI] Transcription failed:', error);
      throw new Error(`AssemblyAI transcription failed: ${error.message}`);
    }
  }

  private async uploadAudio(buffer: Buffer): Promise<string> {
    const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload audio: ${error}`);
    }

    const data = await response.json() as { upload_url: string };
    return data.upload_url;
  }

  private async createTranscript(audioUrl: string, expectedSpeakers?: number): Promise<string> {
    const body: Record<string, any> = {
      audio_url: audioUrl,
      speaker_labels: true,
      language_code: 'en_uk',
    };

    if (expectedSpeakers && expectedSpeakers >= 2) {
      body.speakers_expected = expectedSpeakers;
    }

    const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create transcript: ${error}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  private async pollForCompletion(transcriptId: string): Promise<AssemblyAITranscript> {
    const maxWaitTime = 10 * 60 * 1000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: {
          'Authorization': this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to poll transcript: ${error}`);
      }

      const result = await response.json() as AssemblyAITranscript;

      if (result.status === 'completed') {
        return result;
      }

      if (result.status === 'error') {
        throw new Error(`Transcription error: ${result.error}`);
      }

      console.log(`[AssemblyAI] Status: ${result.status}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Transcription timed out after 10 minutes');
  }

  private calculateCost(durationSeconds: number): number {
    const hours = durationSeconds / 3600;
    return hours * ASSEMBLYAI_COST_PER_HOUR;
  }
}

export function formatDiarizedTranscript(utterances: SpeakerUtterance[]): string {
  if (!utterances || utterances.length === 0) {
    return '';
  }

  return utterances
    .map(u => `[Speaker ${u.speaker}]: ${u.text}`)
    .join('\n\n');
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
