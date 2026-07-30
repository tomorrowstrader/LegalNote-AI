import { useState, useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { indexedDBBackup } from "@/lib/indexedDBBackup";
import { useBeforeUnloadWarning } from "@/hooks/useBeforeUnloadWarning";

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
 * Quick Record chunked upload + local-first backup.
 *
 * Protection layers:
 * 1. IndexedDB — every chunk is written locally before (or instead of) upload
 * 2. EU cloud object storage — 10s chunk uploads with retry
 * 3. Postgres session metadata — incomplete sessions are discoverable for recovery
 *
 * While online, max loss on hard kill is roughly one chunk interval (~10s) that
 * has not yet fired dataavailable. Offline chunks persist in IndexedDB until sync.
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
  const [chunkSessionId, setChunkSessionId] = useState<string | null>(null);

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
  const networkOnlineRef = useRef(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const uploadChunkRef = useRef<(chunkNumber: number, chunkBlob: Blob) => Promise<boolean>>();
  const retryPendingChunksRef = useRef<() => Promise<void>>();

  useBeforeUnloadWarning({
    enabled: isRecording,
    sessionId: chunkSessionId,
  });

  const updateLocalSession = useCallback((duration: number, sessionId?: string, chunksUploaded?: number) => {
    try {
      const session: RecordingSession = {
        startedAt: new Date().toISOString(),
        duration,
        lastUpdateAt: new Date().toISOString(),
        chunkSessionId: sessionId,
        chunksUploaded,
      };
      localStorage.setItem(RECORDING_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(RECORDING_SESSION_KEY);
  }, []);

  const persistChunkLocally = useCallback(async (sessionId: string, chunkNumber: number, chunkBlob: Blob) => {
    try {
      await indexedDBBackup.storeChunk(sessionId, chunkNumber, chunkBlob);
    } catch (e) {
      console.warn('[IndexedDB] Failed to backup chunk locally:', e);
    }
  }, []);

  const uploadChunk = useCallback(async (chunkNumber: number, chunkBlob: Blob): Promise<boolean> => {
    if (!chunkSessionRef.current) return false;

    const sessionId = chunkSessionRef.current.sessionId;

    // Local-first: durable on device before network attempt
    await persistChunkLocally(sessionId, chunkNumber, chunkBlob);

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
  }, [onChunkUploaded, persistChunkLocally]);

  const retryPendingChunks = useCallback(async () => {
    if (pendingChunksRef.current.size === 0) return;

    const pendingEntries = Array.from(pendingChunksRef.current.entries()).sort(
      ([a], [b]) => a - b,
    );
    for (const [chunkNum, blob] of pendingEntries) {
      const success = await uploadChunk(chunkNum, blob);
      if (!success) break;
    }
  }, [uploadChunk]);

  uploadChunkRef.current = uploadChunk;
  retryPendingChunksRef.current = retryPendingChunks;

  const hydratePendingFromIndexedDB = useCallback(async (sessionId: string) => {
    try {
      const pending = await indexedDBBackup.getPendingChunks(sessionId);
      for (const chunk of pending) {
        if (!pendingChunksRef.current.has(chunk.chunkNumber)) {
          pendingChunksRef.current.set(chunk.chunkNumber, chunk.data);
        }
      }
      setPendingChunksCount(pendingChunksRef.current.size);
    } catch (e) {
      console.warn('[IndexedDB] Failed to hydrate pending chunks:', e);
    }
  }, []);

  const syncPendingAfterReconnect = useCallback(async () => {
    const sessionId = chunkSessionRef.current?.sessionId;
    if (sessionId) {
      await hydratePendingFromIndexedDB(sessionId);
    }
    await retryPendingChunksRef.current?.();
  }, [hydratePendingFromIndexedDB]);

  useEffect(() => {
    const handleOnline = () => {
      networkOnlineRef.current = true;
      const status = { online: true };
      setNetworkStatus(status);
      onNetworkStatusChange?.(status);
      void syncPendingAfterReconnect();
    };

    const handleOffline = () => {
      networkOnlineRef.current = false;
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
  }, [onNetworkStatusChange, syncPendingAfterReconnect]);

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
      setChunkSessionId(response.sessionId);
      
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
      setPendingChunksCount(0);

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          const currentChunkNumber = chunkNumberRef.current++;

          if (networkOnlineRef.current) {
            // uploadChunk persists to IndexedDB first, then POSTs
            setIsUploading(true);
            await uploadChunkRef.current?.(currentChunkNumber, event.data);
            setIsUploading(false);
          } else {
            // Offline: durable local only — never leave chunks in memory alone
            await persistChunkLocally(sessionId, currentChunkNumber, event.data);
            pendingChunksRef.current.set(currentChunkNumber, event.data);
            setPendingChunksCount(pendingChunksRef.current.size);
          }
        }
      };

      mediaRecorder.start(CHUNK_INTERVAL_MS);
      setIsRecording(true);
      setDuration(0);
      setChunksUploaded(0);
      setIsSilent(false);
      lastAudioActivityRef.current = Date.now();

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
  }, [createChunkSession, persistChunkLocally, updateLocalSession, onError]);

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
        
        if (pendingChunksRef.current.size > 0 && networkOnlineRef.current) {
          await retryPendingChunksRef.current?.();
        }

        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [cleanupAudioAnalysis]);

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

    const sessionId = chunkSessionRef.current?.sessionId;
    if (sessionId) {
      fetch(`/api/audio/chunk-session/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
      indexedDBBackup.clearSession(sessionId).catch(() => {});
    }

    chunkSessionRef.current = null;
    setChunkSessionId(null);
    audioChunksRef.current = [];
    pendingChunksRef.current.clear();
    setPendingChunksCount(0);
    
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

    if (pendingChunksRef.current.size > 0 && networkOnlineRef.current) {
      await retryPendingChunksRef.current?.();
    }

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
      setChunkSessionId(null);
      
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
    chunkSessionId,
    isUploading,
    lastSyncTime,
    pendingChunksCount,
    batteryLevel,
    isSilent,
  };
}
