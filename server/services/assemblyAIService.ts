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
  speech_model_used: string | null;
  error: string | null;
}

// EU endpoint for GDPR compliance - data processed in AWS Dublin (Ireland)
const ASSEMBLYAI_API_URL = 'https://api.eu.assemblyai.com/v2';
const ASSEMBLYAI_COST_PER_HOUR = 0.37; // Universal-3 Pro pricing

/**
 * @deprecated Use KeytermsConfig instead. WordBoostConfig is kept for backward compatibility.
 * Universal-3 Pro uses keyterms_prompt instead of word_boost/boost_param.
 */
export interface WordBoostConfig {
  words: string[];
  boost: 'low' | 'default' | 'high';
}

export interface KeytermsConfig {
  keyterms: string[];
  /**
   * Plain-English context prompt for Universal-3 Pro's native prompting feature.
   * Up to 1,500 words. Cannot be used in the same request as keyterms_prompt —
   * when nativePrompt is set, keyterms are omitted from the request.
   */
  nativePrompt?: string;
}

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

  /**
   * Transcribe an in-memory audio buffer (no diarization). Used by Quick Note.
   * Universal-2 for speed; succeeds or throws — no fallback.
   */
  async transcribeBuffer(buffer: Buffer): Promise<string> {
    console.log(`[AssemblyAI] Starting buffer transcription (Universal-2, no diarization): ${buffer.length} bytes`);

    const uploadUrl = await this.uploadAudio(buffer);
    console.log(`[AssemblyAI] Audio uploaded to: ${uploadUrl}`);

    const transcriptId = await this.createPlainTranscript(uploadUrl);
    console.log(`[AssemblyAI] Plain transcript job created: ${transcriptId}`);

    const result = await this.pollForCompletion(transcriptId);
    console.log(`[AssemblyAI] Buffer transcription completed (${result.text?.length ?? 0} chars)`);

    return result.text || '';
  }

  async transcribeWithDiarization(
    audioPath: string,
    audioDuration: number,
    expectedSpeakers?: number,
    keytermsConfig?: KeytermsConfig
  ): Promise<DiarizedTranscriptionResult> {
    console.log(`[AssemblyAI] Starting diarized transcription (Universal-3 Pro → Universal-2 fallback) for: ${audioPath}`);
    if (keytermsConfig?.nativePrompt) {
      console.log(`[AssemblyAI] Native prompting enabled (prompt field); keyterms_prompt not used in this request`);
    } else if (keytermsConfig?.keyterms?.length) {
      console.log(`[AssemblyAI] Keyterms prompt enabled with ${keytermsConfig.keyterms.length} terms (keyterms_prompt array)`);
    }

    try {
      const buffer = await this.objectStorageService.getObjectEntityFile(audioPath);
      console.log(`[AssemblyAI] Downloaded audio file: ${buffer.length} bytes`);

      const uploadUrl = await this.uploadAudio(buffer);
      console.log(`[AssemblyAI] Audio uploaded to: ${uploadUrl}`);

      let transcriptId: string;
      let modelUsed: 'universal-3-pro' | 'universal-2' = 'universal-3-pro';
      try {
        transcriptId = await this.createTranscript(uploadUrl, expectedSpeakers, keytermsConfig, 'universal-3-pro');
        console.log(`[AssemblyAI] Transcript job created with Universal-3 Pro: ${transcriptId}`);
      } catch (modelError: any) {
        // Explicit Universal-2 fallback: retry with Universal-2 if Universal-3 Pro
        // is unavailable. Native prompting (prompt) and keyterms_prompt are not sent on
        // the Universal-2 fallback path since they are Universal-3 Pro exclusive features.
        // word_boost (Universal-2's legacy vocabulary mechanism) is not restored since
        // the Universal-2 fallback is expected to be rare and transient.
        console.warn(`[AssemblyAI] Universal-3 Pro unavailable, falling back to Universal-2: ${modelError.message}`);
        modelUsed = 'universal-2';
        transcriptId = await this.createTranscript(uploadUrl, expectedSpeakers, undefined, 'universal-2');
        console.log(`[AssemblyAI] Transcript job created with Universal-2 fallback: ${transcriptId}`);
      }

      const result = await this.pollForCompletion(transcriptId);
      const reportedModel = result.speech_model_used || modelUsed;
      console.log(`[AssemblyAI] Transcription completed with ${result.utterances?.length || 0} utterances (model: ${reportedModel})`);

      const cost = this.calculateCost(result.audio_duration || audioDuration, reportedModel);

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

  private async createPlainTranscript(audioUrl: string): Promise<string> {
    const body: Record<string, unknown> = {
      audio_url: audioUrl,
      speech_models: ['universal-2'],
      speaker_labels: false,
      language_code: 'en_uk',
    };

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

  private async createTranscript(
    audioUrl: string,
    expectedSpeakers?: number,
    keytermsConfig?: KeytermsConfig,
    speechModel: 'universal-3-pro' | 'universal-2' = 'universal-3-pro'
  ): Promise<string> {
    const body: Record<string, any> = {
      audio_url: audioUrl,
      // Model selection: universal-3-pro is the primary choice; universal-2 is the
      // explicit fallback used when universal-3-pro is unavailable (see caller).
      speech_models: [speechModel],
      speaker_labels: true,
      language_code: 'en_uk',
    };

    if (expectedSpeakers && expectedSpeakers >= 2) {
      body.speakers_expected = expectedSpeakers;
    }

    if (keytermsConfig?.nativePrompt) {
      // Native prompting is used as the primary vocabulary strategy for Universal-3 Pro.
      // It replaces word_boost/boost_param (the Universal-2 API) with plain-English context
      // injection. The `prompt` and `keyterms_prompt` parameters are mutually exclusive
      // per the AssemblyAI API — when nativePrompt is set, keyterms_prompt is not sent.
      body.prompt = keytermsConfig.nativePrompt;
    } else if (keytermsConfig?.keyterms?.length) {
      // Fallback: if native prompting is unavailable, send keyterms_prompt as an array
      // (replaces the old word_boost array parameter). Max 1,000 terms, 6 words each.
      body.keyterms_prompt = keytermsConfig.keyterms.slice(0, 1000);
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

  private calculateCost(durationSeconds: number, model?: string): number {
    const hours = durationSeconds / 3600;
    // Universal-3 Pro is priced higher than Universal-2; use the actual model cost
    const costPerHour = (model === 'universal-2') ? 0.27 : ASSEMBLYAI_COST_PER_HOUR;
    return hours * costPerHour;
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
