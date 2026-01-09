import { useState, useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { indexedDBBackup } from "@/lib/indexedDBBackup";

const CHUNK_INTERVAL_MS = 10000;
const RECORDING_SESSION_KEY = 'legalnote_recording_session';
const SILENCE_THRESHOLD_MS = 30000;

interface ChunkSession {
  sessionId: string;
  chunksUploaded: number;
  lastUploadTime: Date;
  totalBytesUploaded: number;
}

interface RecordingSession {
  startedAt: string;
  duration: number;
  lastUpdateAt: string;
  chunkSessionId?: string;
  chunksUploaded?: number;
}

interface NetworkStatus {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
}

interface UseChunkedRecordingOptions {
  onChunkUploaded?: (chunkNumber: number, totalChunks: number) => void;
  onNetworkStatusChange?: (status: NetworkStatus) => void;
  onError?: (error: Error) => void;
}

interface UseChunkedRecordingReturn {
  isRecording: boolean;
  duration: number;
  chunksUploaded: number;
  networkStatus: NetworkStatus;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  markConsentConfirmed: () => Promise<{ success: boolean; consentChunk: number; elapsedSeconds: number } | null>;
  finalizeAndUpload: (audioRecordingId: string) => Promise<{ success: boolean; totalChunks: number; totalBytes: number }>;
  mimeType: string;
  chunkSessionId: string | null;
  isUploading: boolean;
  lastSyncTime: Date | null;
  pendingChunksCount: number;
  batteryLevel: number | null;
  isSilent: boolean;
}

/**
 * DUAL RECORDING FEASIBILITY ASSESSMENT (November 2025)
 * 
 * CONCLUSION: Not implemented - Current protections are sufficient
 * 
 * CURRENT PROTECTION LAYERS (equivalent to dual recording benefits):
 * 1. Chunked uploads every 10 seconds - Max data loss is 10 seconds
 * 2. Local audioChunks array - Full recording kept in memory until finalized
 * 3. Server-side chunk reassembly - Chunks stored independently on server
 * 4. Network monitoring with automatic retry - Failed chunks queued for retry
 * 5. Session recovery via localStorage - Can detect/recover interrupted sessions
 * 6. Consent segment preservation - First 15 seconds saved separately
 * 
 * DUAL RECORDING OPTIONS EVALUATED:
 * 
 * Option A: Two MediaRecorder instances (different codecs)
 * - Pros: Format redundancy (WebM + MP4)
 * - Cons: Doubles CPU/memory usage, both fail on mic disconnect
 * - Verdict: REJECTED - Same failure modes, high overhead
 * 
 * Option B: IndexedDB backup alongside server upload
 * - Pros: True local backup, survives page reload
 * - Cons: Storage quotas, cleanup complexity, browser inconsistencies
 * - Verdict: DEFERRED - Marginal benefit vs. chunked uploads
 * 
 * Option C: Web Workers for parallel processing
 * - Pros: Non-blocking encoding
 * - Cons: Complexity, SharedArrayBuffer restrictions
 * - Verdict: REJECTED - Overkill for current use case
 * 
 * RECOMMENDATION: Current 10-second chunked upload system provides
 * equivalent protection to dual recording with simpler architecture.
 * Maximum data loss is 10 seconds (one chunk) which is acceptable
 * for legal meeting recordings. Further investment should focus on:
 * - Improving chunk upload reliability
 * - Better offline detection
 * - Session recovery UI improvements
 */

const getSupportedMimeType = (): { mimeType: string; extension: string } => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { mimeType: 'audio/webm', extension: '.webm' };
  }
  
  const types = [
    { mimeType: 'audio/webm', extension: '.webm' },
    { mimeType: 'audio/mp4', extension: '.mp4' },
    { mimeType: 'audio/ogg', extension: '.ogg' },
    { mimeType: 'audio/wav', extension: '.wav' }
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) {
      return type;
    }
  }
  
  return { mimeType: 'audio/webm', extension: '.webm' };
};

export function useChunkedRecording(options: UseChunkedRecordingOptions = {}): UseChunkedRecordingReturn {
  const { onChunkUploaded, onNetworkStatusChange, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [chunksUploaded, setChunksUploaded] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingChunksCount, setPendingChunksCount] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isSilent, setIsSilent] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkSessionRef = useRef<ChunkSession | null>(null);
  const chunkNumberRef = useRef(0);
  const audioFormatRef = useRef(getSupportedMimeType());
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChunksRef = useRef<Map<number, Blob>>(new Map());
  const lastAudioActivityRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      const status = { online: true };
      setNetworkStatus(status);
      onNetworkStatusChange?.(status);
      retryPendingChunks();
    };

    const handleOffline = () => {
      const status = { online: false };
      setNetworkStatus(status);
      onNetworkStatusChange?.(status);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const updateConnectionInfo = () => {
        setNetworkStatus(prev => ({
          ...prev,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
        }));
      };
      connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onNetworkStatusChange]);

  // Battery monitoring
  useEffect(() => {
    if (!('getBattery' in navigator)) return;
    
    let battery: any = null;
    
    const updateBatteryLevel = () => {
      if (battery) {
        setBatteryLevel(Math.round(battery.level * 100));
      }
    };
    
    (navigator as any).getBattery().then((b: any) => {
      battery = b;
      updateBatteryLevel();
      battery.addEventListener('levelchange', updateBatteryLevel);
    }).catch(() => {
      // Battery API not available
    });
    
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', updateBatteryLevel);
      }
    };
  }, []);

  const updateLocalSession = useCallback((duration: number, chunkSessionId?: string, chunksUploaded?: number) => {
    try {
      const session: RecordingSession = {
        startedAt: new Date().toISOString(),
        duration,
        lastUpdateAt: new Date().toISOString(),
        chunkSessionId,
        chunksUploaded,
      };
      localStorage.setItem(RECORDING_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(RECORDING_SESSION_KEY);
  }, []);

  const uploadChunk = useCallback(async (chunkNumber: number, chunkBlob: Blob): Promise<boolean> => {
    if (!chunkSessionRef.current) return false;

    const sessionId = chunkSessionRef.current.sessionId;

    // Store chunk locally first (IndexedDB backup)
    try {
      await indexedDBBackup.storeChunk(sessionId, chunkNumber, chunkBlob);
    } catch (e) {
      console.warn('[IndexedDB] Failed to backup chunk locally:', e);
    }

    const formData = new FormData();
    formData.append('chunk', chunkBlob, `chunk_${chunkNumber}`);
    formData.append('chunkNumber', chunkNumber.toString());

    try {
      const response = await fetch(`/api/audio/chunk-session/${sessionId}/chunk`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Chunk upload failed');
      }

      const result = await response.json();
      
      chunkSessionRef.current.chunksUploaded = result.chunksReceived;
      chunkSessionRef.current.totalBytesUploaded += result.bytesStored;
      chunkSessionRef.current.lastUploadTime = new Date();
      
      setChunksUploaded(result.chunksReceived);
      setLastSyncTime(new Date());
      pendingChunksRef.current.delete(chunkNumber);
      setPendingChunksCount(pendingChunksRef.current.size);
      onChunkUploaded?.(chunkNumber, result.chunksReceived);
      
      // Mark chunk as uploaded in IndexedDB
      try {
        await indexedDBBackup.markChunkUploaded(sessionId, chunkNumber);
      } catch (e) {
        console.warn('[IndexedDB] Failed to mark chunk uploaded:', e);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to upload chunk ${chunkNumber}:`, error);
      pendingChunksRef.current.set(chunkNumber, chunkBlob);
      setPendingChunksCount(pendingChunksRef.current.size);
      return false;
    }
  }, [onChunkUploaded]);

  const retryPendingChunks = useCallback(async () => {
    if (pendingChunksRef.current.size === 0) return;

    const pendingEntries = Array.from(pendingChunksRef.current.entries());
    for (const [chunkNum, blob] of pendingEntries) {
      const success = await uploadChunk(chunkNum, blob);
      if (!success) break;
    }
  }, [uploadChunk]);

  const createChunkSession = useCallback(async (): Promise<string | null> => {
    try {
      const response = await apiRequest<{ sessionId: string }>("POST", "/api/audio/chunk-session", {
        mimeType: audioFormatRef.current.mimeType,
      });
      
      chunkSessionRef.current = {
        sessionId: response.sessionId,
        chunksUploaded: 0,
        lastUploadTime: new Date(),
        totalBytesUploaded: 0,
      };
      
      // Create IndexedDB session for local backup
      try {
        await indexedDBBackup.createSession(response.sessionId, audioFormatRef.current.mimeType);
      } catch (e) {
        console.warn('[IndexedDB] Failed to create local session:', e);
      }
      
      return response.sessionId;
    } catch (error) {
      console.error('Failed to create chunk session:', error);
      onError?.(error as Error);
      return null;
    }
  }, [onError]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const sessionId = await createChunkSession();
      if (!sessionId) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      const { mimeType } = audioFormatRef.current;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      chunkNumberRef.current = 0;
      pendingChunksRef.current.clear();

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          const currentChunkNumber = chunkNumberRef.current++;
          
          if (networkStatus.online) {
            setIsUploading(true);
            await uploadChunk(currentChunkNumber, event.data);
            setIsUploading(false);
          } else {
            pendingChunksRef.current.set(currentChunkNumber, event.data);
          }
        }
      };

      mediaRecorder.start(CHUNK_INTERVAL_MS);
      setIsRecording(true);
      setDuration(0);
      setChunksUploaded(0);
      setIsSilent(false);
      lastAudioActivityRef.current = Date.now();

      // Set up audio analysis for silence detection
      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        silenceCheckIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          
          if (average > 5) {
            lastAudioActivityRef.current = Date.now();
            setIsSilent(false);
          } else {
            const silenceDuration = Date.now() - lastAudioActivityRef.current;
            if (silenceDuration > SILENCE_THRESHOLD_MS) {
              setIsSilent(true);
            }
          }
        }, 1000);
      } catch (e) {
        console.warn('[Audio] Failed to set up silence detection:', e);
      }

      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          updateLocalSession(newDuration, sessionId, chunkSessionRef.current?.chunksUploaded || 0);
          return newDuration;
        });
      }, 1000);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      onError?.(error as Error);
      return false;
    }
  }, [createChunkSession, networkStatus.online, uploadChunk, updateLocalSession, onError]);

  const cleanupAudioAnalysis = useCallback(() => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsSilent(false);
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      cleanupAudioAnalysis();

      mediaRecorderRef.current.onstop = async () => {
        const { mimeType } = audioFormatRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        setIsRecording(false);
        
        if (pendingChunksRef.current.size > 0 && networkStatus.online) {
          await retryPendingChunks();
        }

        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [networkStatus.online, retryPendingChunks, cleanupAudioAnalysis]);

  const cancelRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    cleanupAudioAnalysis();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (chunkSessionRef.current) {
      fetch(`/api/audio/chunk-session/${chunkSessionRef.current.sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    }

    chunkSessionRef.current = null;
    audioChunksRef.current = [];
    pendingChunksRef.current.clear();
    
    setIsRecording(false);
    setDuration(0);
    setChunksUploaded(0);
    clearLocalSession();
  }, [clearLocalSession, cleanupAudioAnalysis]);

  const markConsentConfirmed = useCallback(async (): Promise<{ success: boolean; consentChunk: number; elapsedSeconds: number } | null> => {
    if (!chunkSessionRef.current) {
      console.warn('No active chunk session for consent marking');
      return null;
    }

    try {
      const response = await apiRequest<{
        success: boolean;
        consentChunk: number;
        elapsedSeconds: number;
      }>("POST", `/api/audio/chunk-session/${chunkSessionRef.current.sessionId}/consent`, {});

      console.log(`Consent confirmed at chunk ${response.consentChunk} (~${response.elapsedSeconds}s)`);
      return response;
    } catch (error) {
      console.error('Failed to mark consent confirmation:', error);
      return null;
    }
  }, []);

  const finalizeAndUpload = useCallback(async (audioRecordingId: string): Promise<{ success: boolean; totalChunks: number; totalBytes: number }> => {
    if (!chunkSessionRef.current) {
      throw new Error('No active chunk session');
    }

    const sessionId = chunkSessionRef.current.sessionId;

    try {
      const response = await apiRequest<{
        success: boolean;
        totalChunks: number;
        totalBytes: number;
        consentSegmentPreserved: boolean;
      }>("POST", `/api/audio/chunk-session/${sessionId}/finalize`, {
        audioRecordingId,
        duration,
      });

      clearLocalSession();
      chunkSessionRef.current = null;
      
      // Mark IndexedDB session as completed and clean up
      try {
        await indexedDBBackup.markSessionCompleted(sessionId);
        await indexedDBBackup.clearSession(sessionId);
      } catch (e) {
        console.warn('[IndexedDB] Failed to clean up local session:', e);
      }

      return {
        success: response.success,
        totalChunks: response.totalChunks,
        totalBytes: response.totalBytes,
      };
    } catch (error) {
      console.error('Failed to finalize chunk session:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [duration, clearLocalSession, onError]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return {
    isRecording,
    duration,
    chunksUploaded,
    networkStatus,
    startRecording,
    stopRecording,
    cancelRecording,
    markConsentConfirmed,
    finalizeAndUpload,
    mimeType: audioFormatRef.current.mimeType,
    chunkSessionId: chunkSessionRef.current?.sessionId || null,
    isUploading,
    lastSyncTime,
    pendingChunksCount,
    batteryLevel,
    isSilent,
  };
}
