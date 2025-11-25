import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";

interface ChunkMetadata {
  sessionId: string;
  userId: string;
  caseId?: string;
  chunkNumber: number;
  totalChunks?: number;
  createdAt: Date;
  mimeType: string;
}

interface RecordingSession {
  id: string;
  userId: string;
  caseId?: string;
  chunks: Map<number, Buffer>;
  mimeType: string;
  createdAt: Date;
  lastActivityAt: Date;
  finalized: boolean;
  consentSegmentPreserved: boolean;
  consentConfirmedAt?: Date;
  consentConfirmedChunk?: number;
  consentElapsedSeconds?: number;
}

const activeSessions = new Map<string, RecordingSession>();

const CHUNK_INTERVAL_SECONDS = 10;
const FALLBACK_CONSENT_CHUNKS = 2;
const SESSION_EXPIRY_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export class ChunkedUploadService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.startCleanupTask();
  }

  private startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of activeSessions.entries()) {
        if (now - session.lastActivityAt.getTime() > SESSION_EXPIRY_MS && !session.finalized) {
          console.log(`[ChunkedUpload] Cleaning up expired session: ${sessionId}`);
          activeSessions.delete(sessionId);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  createSession(userId: string, mimeType: string, caseId?: string): string {
    const sessionId = randomUUID();
    
    const session: RecordingSession = {
      id: sessionId,
      userId,
      caseId,
      chunks: new Map(),
      mimeType,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      finalized: false,
      consentSegmentPreserved: false,
    };

    activeSessions.set(sessionId, session);
    console.log(`[ChunkedUpload] Created session ${sessionId} for user ${userId}`);
    
    return sessionId;
  }

  async uploadChunk(
    sessionId: string, 
    userId: string, 
    chunkNumber: number, 
    chunkData: Buffer
  ): Promise<{ received: number; bytesStored: number }> {
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error("Recording session not found or expired");
    }

    if (session.userId !== userId) {
      throw new Error("Unauthorized: Session belongs to different user");
    }

    if (session.finalized) {
      throw new Error("Session already finalized");
    }

    session.chunks.set(chunkNumber, chunkData);
    session.lastActivityAt = new Date();

    console.log(`[ChunkedUpload] Received chunk ${chunkNumber} for session ${sessionId} (${chunkData.length} bytes)`);

    return {
      received: session.chunks.size,
      bytesStored: chunkData.length,
    };
  }

  markConsentConfirmed(sessionId: string, userId: string): { 
    success: boolean; 
    consentChunk: number;
    elapsedSeconds: number;
  } {
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error("Recording session not found or expired");
    }

    if (session.userId !== userId) {
      throw new Error("Unauthorized: Session belongs to different user");
    }

    const now = new Date();
    const elapsedMs = now.getTime() - session.createdAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const consentChunk = Math.ceil(elapsedSeconds / CHUNK_INTERVAL_SECONDS);

    session.consentConfirmedAt = now;
    session.consentConfirmedChunk = consentChunk;
    session.consentElapsedSeconds = elapsedSeconds;

    console.log(`[ChunkedUpload] Consent confirmed for session ${sessionId} at chunk ${consentChunk} (${elapsedSeconds}s elapsed)`);

    return {
      success: true,
      consentChunk,
      elapsedSeconds,
    };
  }

  async finalizeSession(
    sessionId: string, 
    userId: string,
    audioRecordingId: string
  ): Promise<{ 
    success: boolean; 
    totalChunks: number; 
    totalBytes: number; 
    filePath: string;
    consentSegmentPath?: string;
    consentDurationSeconds?: number;
  }> {
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error("Recording session not found or expired");
    }

    if (session.userId !== userId) {
      throw new Error("Unauthorized: Session belongs to different user");
    }

    if (session.finalized) {
      throw new Error("Session already finalized");
    }

    if (session.chunks.size === 0) {
      throw new Error("No chunks received for session");
    }

    const sortedChunkNumbers = Array.from(session.chunks.keys()).sort((a, b) => a - b);
    const chunks: Buffer[] = [];
    
    for (const chunkNum of sortedChunkNumbers) {
      const chunk = session.chunks.get(chunkNum);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    const combinedAudio = Buffer.concat(chunks);
    const totalBytes = combinedAudio.length;
    const totalChunks = chunks.length;

    console.log(`[ChunkedUpload] Finalizing session ${sessionId}: ${totalChunks} chunks, ${totalBytes} bytes`);

    const objectInfo = this.objectStorage.createPrivateObjectId();
    
    const extension = session.mimeType.includes('webm') ? '.webm' : 
                     session.mimeType.includes('mp4') ? '.mp4' :
                     session.mimeType.includes('ogg') ? '.ogg' : '.webm';
    
    const fileKey = `${objectInfo.key}${extension}`;
    
    await this.objectStorage.uploadFile(fileKey, combinedAudio, session.mimeType);

    const dbPath = `${objectInfo.dbPath}${extension}`;

    let consentSegmentPath: string | undefined;
    let consentDurationSeconds: number | undefined;
    
    const consentChunkCount = session.consentConfirmedChunk ?? FALLBACK_CONSENT_CHUNKS;
    
    if (totalChunks >= 1 && consentChunkCount > 0) {
      try {
        const chunksToPreserve = Math.min(consentChunkCount + 1, totalChunks);
        const consentChunks: Buffer[] = [];
        
        for (let i = 0; i < chunksToPreserve; i++) {
          const chunk = session.chunks.get(sortedChunkNumbers[i]);
          if (chunk) {
            consentChunks.push(chunk);
          }
        }
        
        if (consentChunks.length > 0) {
          const consentAudio = Buffer.concat(consentChunks);
          const consentObjectInfo = this.objectStorage.createPrivateObjectId();
          const consentFileKey = `consent/${consentObjectInfo.key}_consent${extension}`;
          
          await this.objectStorage.uploadFile(consentFileKey, consentAudio, session.mimeType);
          consentSegmentPath = `consent/${consentObjectInfo.dbPath}_consent${extension}`;
          consentDurationSeconds = session.consentElapsedSeconds ?? chunksToPreserve * CHUNK_INTERVAL_SECONDS;
          session.consentSegmentPreserved = true;
          
          const source = session.consentElapsedSeconds ? 'timestamp-based' : 'fallback';
          console.log(`[ChunkedUpload] Preserved consent segment (${source}): ${consentSegmentPath} (${chunksToPreserve} chunks, ${consentDurationSeconds}s actual duration)`);
        }
      } catch (error) {
        console.error(`[ChunkedUpload] Failed to preserve consent segment:`, error);
      }
    }

    session.finalized = true;

    setTimeout(() => {
      activeSessions.delete(sessionId);
      console.log(`[ChunkedUpload] Cleaned up finalized session ${sessionId}`);
    }, 60000);

    return {
      success: true,
      totalChunks,
      totalBytes,
      filePath: dbPath,
      consentSegmentPath,
      consentDurationSeconds,
    };
  }

  getSessionStatus(sessionId: string, userId: string): {
    exists: boolean;
    chunksReceived: number;
    lastActivity: Date | null;
    finalized: boolean;
  } {
    const session = activeSessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        exists: false,
        chunksReceived: 0,
        lastActivity: null,
        finalized: false,
      };
    }

    return {
      exists: true,
      chunksReceived: session.chunks.size,
      lastActivity: session.lastActivityAt,
      finalized: session.finalized,
    };
  }

  recoverSession(sessionId: string, userId: string): {
    canRecover: boolean;
    chunksReceived: number;
    lastChunkNumber: number;
  } | null {
    const session = activeSessions.get(sessionId);
    
    if (!session || session.userId !== userId || session.finalized) {
      return null;
    }

    const chunkNumbers = Array.from(session.chunks.keys());
    const lastChunkNumber = chunkNumbers.length > 0 ? Math.max(...chunkNumbers) : -1;

    return {
      canRecover: true,
      chunksReceived: session.chunks.size,
      lastChunkNumber,
    };
  }

  cancelSession(sessionId: string, userId: string): boolean {
    const session = activeSessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return false;
    }

    activeSessions.delete(sessionId);
    console.log(`[ChunkedUpload] Cancelled session ${sessionId}`);
    return true;
  }
}

export const chunkedUploadService = new ChunkedUploadService();
