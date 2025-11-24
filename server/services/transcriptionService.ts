import { openaiClient, MODELS, calculateTranscriptionCost } from '../config/openai';
import { ObjectStorageService } from '../objectStorage';

export interface TranscriptionResult {
  text: string;
  duration: number;
  cost: number;
}

export class TranscriptionService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Transcribe audio file from object storage using OpenAI Whisper
   * @param audioPath - Path to audio file in object storage
   * @param audioDuration - Duration in seconds
   * @param mimeType - MIME type of the audio file (defaults to audio/webm)
   */
  async transcribeAudio(audioPath: string, audioDuration: number, mimeType?: string): Promise<TranscriptionResult> {
    try {
      console.log(`Starting transcription for audio: ${audioPath}`);

      // Get audio file from Backblaze B2 storage (returns Buffer)
      const buffer = await this.objectStorageService.getObjectEntityFile(audioPath);
      
      // Use provided MIME type or default to webm (most common from MediaRecorder API)
      const contentType = mimeType || 'audio/webm';
      
      // Determine file extension from MIME type for OpenAI
      const extensionMap: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
      };
      const extension = extensionMap[contentType] || 'webm';
      
      // Convert buffer to File-like object for OpenAI
      const audioFile = this.bufferToFile(buffer, `audio.${extension}`, contentType);
      
      console.log(`Sending ${buffer.length} bytes to Whisper API...`);

      // Call Whisper API with retry logic
      const transcription = await this.transcribeWithRetry(audioFile);
      
      // Calculate cost
      const cost = calculateTranscriptionCost(audioDuration);
      
      console.log(`Transcription completed. Text length: ${transcription.text.length}, Cost: $${cost.toFixed(4)}`);

      return {
        text: transcription.text,
        duration: audioDuration,
        cost,
      };
    } catch (error: any) {
      console.error('Transcription failed:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe with exponential backoff retry logic
   */
  private async transcribeWithRetry(file: any, maxRetries: number = 3): Promise<{ text: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await openaiClient.audio.transcriptions.create({
          file: file,
          model: MODELS.TRANSCRIPTION,
          response_format: 'text', // Get plain text response
          language: 'en', // English language for legal documents
        });

        return { text: response as unknown as string };
      } catch (error: any) {
        lastError = error;
        console.error(`Transcription attempt ${attempt} failed:`, error.message);
        
        // Don't retry on client errors (400-499)
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Exponential backoff: wait 2^attempt seconds
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Transcription failed after retries');
  }

  /**
   * Convert buffer to File-like object for OpenAI API
   * OpenAI SDK expects a Blob-like object with specific properties
   */
  private bufferToFile(buffer: Buffer, filename: string, contentType: string): any {
    // Convert Buffer to ArrayBuffer for proper serialization
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    
    // Create a proper Blob-like object that OpenAI SDK accepts
    const blob = new Blob([buffer], { type: contentType });
    
    // Add name property for filename (required by OpenAI)
    Object.defineProperty(blob, 'name', {
      value: filename,
      writable: false,
      enumerable: true,
    });
    
    return blob;
  }
}
