import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";
import { applyObjectLegalHoldForNewRecording } from "./litigationHoldObjectLockService";
import { preserveConsentSegmentFromBuffer } from "./consentSegmentService";
import { db } from "../db";
import { recordingSessions } from "@shared/schema";
import { eq, and, lt, or } from "drizzle-orm";

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

  /**
   * Load chunk buffers from object storage for a session.
   * Used when the in-memory Map was lost (process restart, multi-instance, idle cleanup).
   */
  private async loadChunksFromDurable(sessionId: string): Promise<Map<number, Buffer>> {
    const chunks = new Map<number, Buffer>();
    const storedChunks = await this.objectStorage.listChunks(sessionId);

    for (const chunkInfo of storedChunks) {
      try {
        const chunkData = await this.objectStorage.getFile(chunkInfo.key);
        if (chunkData) {
          chunks.set(chunkInfo.index, chunkData);
        }
      } catch (error) {
        console.warn(
          `[ChunkedUpload] Could not retrieve chunk ${chunkInfo.index} for session ${sessionId}:`,
          error
        );
      }
    }

    return chunks;
  }

  /**
   * Resolve a live session from memory, or rehydrate from DB + durable chunk storage.
   * Chunks are already persisted on every uploadChunk, so restart/redeploy must not
   * fail finalize with "session not found".
   */
  private async ensureActiveSession(sessionId: string, userId: string): Promise<RecordingSession> {
    const existing = activeSessions.get(sessionId);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("Unauthorized: Session belongs to different user");
      }
      return existing;
    }

    const rows = await db
      .select()
      .from(recordingSessions)
      .where(
        and(
          eq(recordingSessions.id, sessionId),
          eq(recordingSessions.userId, userId)
        )
      );

    if (rows.length === 0) {
      throw new Error("Recording session not found or expired");
    }

    const meta = rows[0];
    if (
      meta.status === "completed" ||
      meta.status === "cancelled" ||
      meta.status === "recovered"
    ) {
      throw new Error("Session already finalized");
    }

    const chunks = await this.loadChunksFromDurable(sessionId);
    const session: RecordingSession = {
      id: sessionId,
      userId: meta.userId,
      caseId: meta.caseId || undefined,
      chunks,
      mimeType: meta.mimeType,
      createdAt: meta.startedAt,
      lastActivityAt: new Date(),
      finalized: false,
      consentSegmentPreserved: false,
      consentConfirmedChunk: meta.consentChunkNumber ?? undefined,
      consentElapsedSeconds: meta.consentElapsedSeconds ?? undefined,
      consentConfirmedAt:
        meta.consentChunkNumber != null || meta.consentElapsedSeconds != null
          ? meta.lastActivityAt
          : undefined,
    };

    activeSessions.set(sessionId, session);
    console.log(
      `[ChunkedUpload] Rehydrated session ${sessionId} from durable storage (${chunks.size} chunks, status=${meta.status})`
    );
    return session;
  }

  async createSession(userId: string, mimeType: string, caseId?: string): Promise<string> {
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
    
    // Save to database for cross-device recovery
    try {
      await db.insert(recordingSessions).values({
        id: sessionId,
        userId,
        caseId: caseId || null,
        status: "active",
        mimeType,
        chunksReceived: 0,
        totalBytes: 0,
      });
      console.log(`[ChunkedUpload] Created session ${sessionId} for user ${userId} (saved to DB)`);
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to save session to DB:`, error);
      // Continue anyway - in-memory session still works
    }
    
    return sessionId;
  }

  async uploadChunk(
    sessionId: string, 
    userId: string, 
    chunkNumber: number, 
    chunkData: Buffer
  ): Promise<{ received: number; bytesStored: number }> {
    const session = await this.ensureActiveSession(sessionId, userId);

    if (session.finalized) {
      throw new Error("Session already finalized");
    }

    session.chunks.set(chunkNumber, chunkData);
    session.lastActivityAt = new Date();

    const chunksReceived = session.chunks.size;
    const totalBytes = Array.from(session.chunks.values()).reduce((sum, chunk) => sum + chunk.length, 0);

    // Persist chunk to durable storage for recovery (in case server restarts)
    try {
      const extension = session.mimeType.includes('webm') ? '.webm' : 
                       session.mimeType.includes('mp4') ? '.mp4' :
                       session.mimeType.includes('ogg') ? '.ogg' : '.webm';
      const chunkKey = `chunks/${sessionId}/chunk_${chunkNumber.toString().padStart(6, '0')}${extension}`;
      await this.objectStorage.uploadFile(chunkKey, chunkData, session.mimeType);
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to persist chunk to storage:`, error);
      // Continue anyway - in-memory chunk still works for normal flow
    }

    // Update database with progress (for cross-device recovery)
    try {
      await db.update(recordingSessions)
        .set({
          chunksReceived,
          totalBytes,
          lastActivityAt: new Date(),
        })
        .where(eq(recordingSessions.id, sessionId));
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to update session in DB:`, error);
    }

    console.log(`[ChunkedUpload] Received chunk ${chunkNumber} for session ${sessionId} (${chunkData.length} bytes, persisted)`);

    return {
      received: chunksReceived,
      bytesStored: chunkData.length,
    };
  }

  async markConsentConfirmed(sessionId: string, userId: string): Promise<{ 
    success: boolean; 
    consentChunk: number;
    elapsedSeconds: number;
  }> {
    const session = await this.ensureActiveSession(sessionId, userId);

    const now = new Date();
    const elapsedMs = now.getTime() - session.createdAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const consentChunk = Math.ceil(elapsedSeconds / CHUNK_INTERVAL_SECONDS);

    session.consentConfirmedAt = now;
    session.consentConfirmedChunk = consentChunk;
    session.consentElapsedSeconds = elapsedSeconds;
    session.lastActivityAt = now;

    // Update database with consent info
    try {
      await db.update(recordingSessions)
        .set({
          consentChunkNumber: consentChunk,
          consentElapsedSeconds: elapsedSeconds,
          lastActivityAt: now,
        })
        .where(eq(recordingSessions.id, sessionId));
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to update consent in DB:`, error);
    }

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
    const session = await this.ensureActiveSession(sessionId, userId);

    if (session.finalized) {
      throw new Error("Session already finalized");
    }

    // If memory was empty after rehydrate, try durable storage once more
    if (session.chunks.size === 0) {
      const durableChunks = await this.loadChunksFromDurable(sessionId);
      for (const [index, buffer] of durableChunks.entries()) {
        session.chunks.set(index, buffer);
      }
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
          consentDurationSeconds = session.consentElapsedSeconds ?? chunksToPreserve * CHUNK_INTERVAL_SECONDS;
          const preserved = await preserveConsentSegmentFromBuffer({
            audioBuffer: consentAudio,
            mimeType: session.mimeType,
            consentDurationSeconds,
          });
          consentSegmentPath = preserved.consentSegmentPath;
          consentDurationSeconds = preserved.consentDurationSeconds;
          session.consentSegmentPreserved = true;
          
          const source = session.consentElapsedSeconds ? 'timestamp-based' : 'fallback';
          console.log(`[ChunkedUpload] Preserved consent segment (${source}): ${consentSegmentPath} (${chunksToPreserve} chunks, ${consentDurationSeconds}s actual duration)`);
        }
      } catch (error) {
        console.error(`[ChunkedUpload] Failed to preserve consent segment:`, error);
      }
    }

    session.finalized = true;

    // Mark session as completed in database
    try {
      await db.update(recordingSessions)
        .set({
          status: "completed",
          completedAt: new Date(),
          chunksReceived: totalChunks,
          totalBytes,
        })
        .where(eq(recordingSessions.id, sessionId));
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to mark session completed in DB:`, error);
    }

    // Best-effort cleanup of durable chunk files after successful assemble
    this.objectStorage.deleteChunks(sessionId, extension, totalChunks).catch((e) => {
      console.warn(`[ChunkedUpload] Failed to clean up durable chunks for ${sessionId}:`, e);
    });

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

  async cancelSession(sessionId: string, userId: string): Promise<boolean> {
    const session = activeSessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return false;
    }

    activeSessions.delete(sessionId);
    
    // Mark session as cancelled in database
    try {
      await db.update(recordingSessions)
        .set({ status: "cancelled" })
        .where(eq(recordingSessions.id, sessionId));
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to mark session cancelled in DB:`, error);
    }
    
    console.log(`[ChunkedUpload] Cancelled session ${sessionId}`);
    return true;
  }

  // Get incomplete sessions for a user (for recovery across devices/browsers)
  async getIncompleteSessions(userId: string): Promise<{
    id: string;
    caseId: string | null;
    status: string;
    chunksReceived: number;
    totalBytes: number;
    startedAt: Date;
    lastActivityAt: Date;
    durationSeconds: number;
  }[]> {
    try {
      const sessions = await db.select()
        .from(recordingSessions)
        .where(
          and(
            eq(recordingSessions.userId, userId),
            or(
              eq(recordingSessions.status, "active"),
              eq(recordingSessions.status, "interrupted")
            )
          )
        );

      return sessions.map(session => ({
        id: session.id,
        caseId: session.caseId,
        status: session.status,
        chunksReceived: session.chunksReceived,
        totalBytes: session.totalBytes,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        durationSeconds: session.chunksReceived * 10, // Each chunk is ~10 seconds
      }));
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to get incomplete sessions:`, error);
      return [];
    }
  }

  // Mark stale sessions as interrupted (for cleanup task)
  async markStaleSessions(): Promise<number> {
    const staleThreshold = new Date(Date.now() - SESSION_EXPIRY_MS);
    
    try {
      const result = await db.update(recordingSessions)
        .set({ 
          status: "interrupted",
          interruptedAt: new Date(),
        })
        .where(
          and(
            eq(recordingSessions.status, "active"),
            lt(recordingSessions.lastActivityAt, staleThreshold)
          )
        );
      
      return 0; // Drizzle doesn't return count by default
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to mark stale sessions:`, error);
      return 0;
    }
  }

  // Link a session to a case (when case is created after recording)
  async linkSessionToCase(sessionId: string, caseId: string, userId: string): Promise<boolean> {
    try {
      await db.update(recordingSessions)
        .set({ caseId })
        .where(
          and(
            eq(recordingSessions.id, sessionId),
            eq(recordingSessions.userId, userId)
          )
        );
      return true;
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to link session to case:`, error);
      return false;
    }
  }

  // Recover an interrupted session - assemble chunks and create a case
  async recoverSession(sessionId: string, userId: string): Promise<{
    success: boolean;
    caseId?: string;
    audioRecordingId?: string;
    durationSeconds?: number;
    hasConsent?: boolean;
    message: string;
  }> {
    try {
      // Get session metadata from database
      const sessions = await db.select()
        .from(recordingSessions)
        .where(
          and(
            eq(recordingSessions.id, sessionId),
            eq(recordingSessions.userId, userId)
          )
        );

      if (sessions.length === 0) {
        return { success: false, message: "Session not found" };
      }

      const sessionMeta = sessions[0];

      // Check if session is recoverable
      if (sessionMeta.status === "completed") {
        return { success: false, message: "Session already completed" };
      }

      if (sessionMeta.status === "cancelled") {
        return { success: false, message: "Session was cancelled" };
      }

      // Try to get chunks from in-memory session first
      let activeSession = activeSessions.get(sessionId);
      let chunks: Buffer[] = [];
      
      if (activeSession && activeSession.chunks.size > 0) {
        // We have chunks in memory - use them
        const sortedChunkNumbers = Array.from(activeSession.chunks.keys()).sort((a, b) => a - b);
        for (const chunkNum of sortedChunkNumbers) {
          const chunk = activeSession.chunks.get(chunkNum);
          if (chunk) {
            chunks.push(chunk);
          }
        }
        console.log(`[ChunkedUpload] Found ${chunks.length} chunks in memory for session ${sessionId}`);
      }
      
      // If no in-memory chunks, try to recover from durable storage
      if (chunks.length === 0) {
        console.log(`[ChunkedUpload] No in-memory chunks, attempting recovery from durable storage for session ${sessionId}`);
        
        try {
          // List actual chunks from storage (authoritative source)
          const storedChunks = await this.objectStorage.listChunks(sessionId);
          
          if (storedChunks.length === 0) {
            console.log(`[ChunkedUpload] No chunks found in durable storage for session ${sessionId}`);
          } else {
            // Verify contiguous chunk indices (0, 1, 2, ..., N-1)
            const maxIndex = storedChunks[storedChunks.length - 1].index;
            const missingIndices: number[] = [];
            
            for (let i = 0; i <= maxIndex; i++) {
              if (!storedChunks.some(c => c.index === i)) {
                missingIndices.push(i);
              }
            }
            
            if (missingIndices.length > 0) {
              console.warn(`[ChunkedUpload] Missing chunk indices for session ${sessionId}: ${missingIndices.join(', ')}`);
              return {
                success: false,
                message: `Missing audio chunks (${missingIndices.length} gaps detected). Some audio data may still be uploading. Please try again in a moment.`,
              };
            }
            
            // Retrieve chunks in order
            for (const chunkInfo of storedChunks) {
              try {
                const chunkData = await this.objectStorage.getFile(chunkInfo.key);
                if (chunkData) {
                  chunks.push(chunkData);
                }
              } catch (e) {
                console.warn(`[ChunkedUpload] Could not retrieve chunk ${chunkInfo.index} from storage:`, e);
                return {
                  success: false,
                  message: `Failed to retrieve chunk ${chunkInfo.index}. Please try again.`,
                };
              }
            }
            console.log(`[ChunkedUpload] Retrieved ${chunks.length} chunks from durable storage for session ${sessionId}`);
          }
        } catch (error) {
          console.error(`[ChunkedUpload] Failed to retrieve chunks from storage:`, error);
        }
      }

      if (chunks.length === 0) {
        // DON'T mark as recovered - keep session active so user can retry after chunks arrive
        // Update lastActivityAt to prevent premature cleanup
        await db.update(recordingSessions)
          .set({
            lastActivityAt: new Date(),
          })
          .where(eq(recordingSessions.id, sessionId));

        return { 
          success: false, 
          message: "No audio chunks found yet. Please wait a moment for data to sync and try again." 
        };
      }

      const combinedAudio = Buffer.concat(chunks);
      const totalBytes = combinedAudio.length;
      const durationSeconds = chunks.length * CHUNK_INTERVAL_SECONDS;
      const hasConsent = sessionMeta.consentChunkNumber !== null || sessionMeta.consentElapsedSeconds != null;

      console.log(`[ChunkedUpload] Recovering session ${sessionId}: ${chunks.length} chunks, ${totalBytes} bytes, ~${durationSeconds}s`);

      // Upload recovered audio into the private object path (7-day product retention),
      // not the short-lived recovered/ lifecycle prefix.
      const objectInfo = this.objectStorage.createPrivateObjectId();
      const extension = sessionMeta.mimeType.includes('webm') ? '.webm' : 
                       sessionMeta.mimeType.includes('mp4') ? '.mp4' :
                       sessionMeta.mimeType.includes('ogg') ? '.ogg' : '.webm';
      
      const fileKey = `${objectInfo.key}${extension}`;
      await this.objectStorage.uploadFile(fileKey, combinedAudio, sessionMeta.mimeType);
      const dbPath = `${objectInfo.dbPath}${extension}`;

      let consentSegmentPath: string | undefined;
      let consentDurationSeconds: number | undefined;
      if (hasConsent && chunks.length > 0) {
        try {
          const consentChunkCount = sessionMeta.consentChunkNumber ?? FALLBACK_CONSENT_CHUNKS;
          const chunksToPreserve = Math.min(consentChunkCount + 1, chunks.length);
          const consentAudio = Buffer.concat(chunks.slice(0, chunksToPreserve));
          const preserved = await preserveConsentSegmentFromBuffer({
            audioBuffer: consentAudio,
            mimeType: sessionMeta.mimeType,
            consentDurationSeconds:
              sessionMeta.consentElapsedSeconds ?? chunksToPreserve * CHUNK_INTERVAL_SECONDS,
          });
          consentSegmentPath = preserved.consentSegmentPath;
          consentDurationSeconds = preserved.consentDurationSeconds;
          console.log(`[ChunkedUpload] Recovered consent segment preserved: ${consentSegmentPath}`);
        } catch (error) {
          console.error(`[ChunkedUpload] Failed to preserve recovered consent segment:`, error);
        }
      }

      // Create a draft case for this recovered recording
      const caseData = await storage.createCase({
        title: `Recovered Recording - ${new Date().toLocaleDateString('en-GB')}`,
        clientName: "Unknown Client",
        matterReference: `REC-${sessionId.slice(0, 8).toUpperCase()}`,
        status: "pending",
        priority: "normal",
        sourceType: "audio",
      }, userId);

      // Create audio recording record
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 day retention

      const audioRecord = await storage.createAudioRecording({
        caseId: caseData.id,
        filePath: dbPath,
        mimeType: sessionMeta.mimeType,
        duration: durationSeconds,
        expiresAt: expiryDate,
      });

      if (consentSegmentPath) {
        await storage.updateAudioRecording(audioRecord.id, {
          consentSegmentPath,
          consentDurationSeconds,
        });
      }

      await applyObjectLegalHoldForNewRecording({
        caseId: caseData.id,
        audioRecordingId: audioRecord.id,
        filePath: dbPath,
        consentSegmentPath,
        userId,
      });

      // Mark session as recovered
      await db.update(recordingSessions)
        .set({
          status: "recovered",
          recoveredAt: new Date(),
          caseId: caseData.id,
          chunksReceived: chunks.length,
          totalBytes,
        })
        .where(eq(recordingSessions.id, sessionId));

      // Clean up in-memory session and durable chunks
      activeSessions.delete(sessionId);
      
      // Clean up chunk files from durable storage (async, non-blocking)
      this.objectStorage.deleteChunks(sessionId, extension, chunks.length).catch(e => {
        console.warn(`[ChunkedUpload] Failed to clean up chunks for session ${sessionId}:`, e);
      });

      console.log(`[ChunkedUpload] Session ${sessionId} recovered successfully. Case: ${caseData.id}`);

      return {
        success: true,
        caseId: caseData.id,
        audioRecordingId: audioRecord.id,
        durationSeconds,
        hasConsent,
        message: hasConsent 
          ? "Recording recovered successfully with consent segment preserved"
          : "Recording recovered but consent confirmation was not captured. Please verify consent before sharing.",
      };
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to recover session ${sessionId}:`, error);
      const raw = error instanceof Error ? error.message : "Failed to recover recording";
      // Never surface raw SQL / driver dumps to the client
      const message =
        /insert into|values \(|returning "/i.test(raw)
          ? "Could not create the recovered case. Please try again."
          : raw.slice(0, 200);
      return { 
        success: false, 
        message,
      };
    }
  }

  // Upload a recovery chunk directly to durable storage (for sessions that have expired from memory)
  async uploadRecoveryChunk(
    sessionId: string, 
    userId: string, 
    chunkNumber: number, 
    chunkData: Buffer
  ): Promise<{ success: boolean; bytesStored: number }> {
    // Verify session exists in database and belongs to user
    const sessions = await db.select()
      .from(recordingSessions)
      .where(
        and(
          eq(recordingSessions.id, sessionId),
          eq(recordingSessions.userId, userId)
        )
      );

    if (sessions.length === 0) {
      throw new Error("Recording session not found");
    }

    const sessionMeta = sessions[0];

    if (sessionMeta.status === "completed" || sessionMeta.status === "cancelled") {
      throw new Error("Session already finalized");
    }

    // Upload directly to durable storage
    const extension = sessionMeta.mimeType.includes('webm') ? '.webm' : 
                     sessionMeta.mimeType.includes('mp4') ? '.mp4' :
                     sessionMeta.mimeType.includes('ogg') ? '.ogg' : '.webm';
    const chunkKey = `chunks/${sessionId}/chunk_${chunkNumber.toString().padStart(6, '0')}${extension}`;
    
    await this.objectStorage.uploadFile(chunkKey, chunkData, sessionMeta.mimeType);

    // Update database with new chunk count if this chunk is new
    const newChunkCount = Math.max(sessionMeta.chunksReceived, chunkNumber + 1);
    const newTotalBytes = sessionMeta.totalBytes + chunkData.length;

    await db.update(recordingSessions)
      .set({
        chunksReceived: newChunkCount,
        totalBytes: newTotalBytes,
        lastActivityAt: new Date(),
      })
      .where(eq(recordingSessions.id, sessionId));

    console.log(`[ChunkedUpload] Recovery chunk ${chunkNumber} uploaded for session ${sessionId} (${chunkData.length} bytes)`);

    return {
      success: true,
      bytesStored: chunkData.length,
    };
  }

  // Discard an interrupted session (user chose not to recover)
  async discardSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      // Remove from memory
      activeSessions.delete(sessionId);

      // Mark as cancelled in database
      await db.update(recordingSessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(recordingSessions.id, sessionId),
            eq(recordingSessions.userId, userId)
          )
        );

      console.log(`[ChunkedUpload] Discarded session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[ChunkedUpload] Failed to discard session:`, error);
      return false;
    }
  }
}

export const chunkedUploadService = new ChunkedUploadService();
