import { openaiClient, MODELS, calculateTranscriptionCost } from '../config/openai';
import { ObjectStorageService } from '../objectStorage';
import { Readable } from 'stream';
import { File } from '@google-cloud/storage';

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
   */
  async transcribeAudio(audioPath: string, audioDuration: number): Promise<TranscriptionResult> {
    try {
      console.log(`Starting transcription for audio: ${audioPath}`);

      // Get audio file from storage
      const file = await this.objectStorageService.getObjectEntityFile(audioPath);
      
      // Download audio file to buffer
      const [buffer] = await file.download();
      
      // Get file metadata for content type
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || 'audio/webm';
      
      // Convert buffer to File-like object for OpenAI
      const audioFile = this.bufferToFile(buffer, 'audio.webm', contentType);
      
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
