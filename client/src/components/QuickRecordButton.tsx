import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Loader2, CheckCircle2, FileText, Upload, Sparkles, Shield, AlertTriangle, Wifi, WifiOff, CloudUpload, Battery, BatteryLow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import ConsentModal from "@/components/ConsentModal";
import TextNotesModal from "@/components/TextNotesModal";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { logAuditEvent } from "@/lib/auditLogger";
import { useChunkedRecording } from "@/hooks/useChunkedRecording";

// Recording session state management for crash recovery detection
const RECORDING_SESSION_KEY = 'legalnote_recording_session';

interface RecordingSession {
  startedAt: string;
  duration: number;
  lastUpdateAt: string;
}

interface CaseResponse {
  id: string;
  title: string;
  clientName: string;
  matterReference?: string;
  status: string;
  priority: string;
  sourceType: string;
}

interface AudioResponse {
  id: string;
  caseId: string;
  filePath: string | null;
  expiresAt: string;
}

// Detect supported audio MIME type for cross-browser compatibility
const getSupportedMimeType = (): { mimeType: string; extension: string } => {
  // Guard: Check if MediaRecorder exists in this browser
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
  
  // Fallback to webm (most widely supported)
  return { mimeType: 'audio/webm', extension: '.webm' };
};

export default function QuickRecordButton() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [stopConfirmationPending, setStopConfirmationPending] = useState(false);
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showTextNotesModal, setShowTextNotesModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'saving' | 'uploading' | 'processing' | 'complete'>('saving');
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [showInterruptedWarning, setShowInterruptedWarning] = useState(false);
  const [interruptedDuration, setInterruptedDuration] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [showLowBatteryWarning, setShowLowBatteryWarning] = useState(false);
  const [useChunkedUpload, setUseChunkedUpload] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioFormatRef = useRef(getSupportedMimeType());

  const chunkedRecording = useChunkedRecording({
    onChunkUploaded: (chunkNumber, totalChunks) => {
      console.log(`Chunk ${chunkNumber} uploaded (total: ${totalChunks})`);
    },
    onNetworkStatusChange: (status) => {
      if (!status.online) {
        toast({
          title: "Connection lost",
          description: "Chunks will upload when connection is restored.",
          variant: "destructive",
          duration: 5000,
        });
      }
    },
    onError: (error) => {
      console.error('Chunked recording error:', error);
    },
  });

  const isRecording = useChunkedUpload ? chunkedRecording.isRecording : isRecordingLocal;
  const setIsRecording = useChunkedUpload 
    ? () => {} 
    : setIsRecordingLocal;

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {
        setBatteryLevel(null);
      });
    }
  }, []);

  useEffect(() => {
    if (batteryLevel !== null && batteryLevel < 20 && !isRecording) {
      setShowLowBatteryWarning(true);
    }
  }, [batteryLevel, isRecording]);

  // Beforeunload handler to warn users before closing during recording
  const beforeUnloadHandler = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Modern browsers require returnValue to be set
    e.returnValue = 'You have an active recording. If you leave, your recording will be lost.';
    return e.returnValue;
  }, []);

  // Start tracking recording session in localStorage
  const startRecordingSession = useCallback(() => {
    const session: RecordingSession = {
      startedAt: new Date().toISOString(),
      duration: 0,
      lastUpdateAt: new Date().toISOString(),
    };
    localStorage.setItem(RECORDING_SESSION_KEY, JSON.stringify(session));
  }, []);

  // Update recording session duration periodically
  const updateRecordingSession = useCallback((duration: number) => {
    try {
      const sessionStr = localStorage.getItem(RECORDING_SESSION_KEY);
      if (sessionStr) {
        const session: RecordingSession = JSON.parse(sessionStr);
        session.duration = duration;
        session.lastUpdateAt = new Date().toISOString();
        localStorage.setItem(RECORDING_SESSION_KEY, JSON.stringify(session));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Clear recording session (on successful save or intentional cancel)
  const clearRecordingSession = useCallback(() => {
    localStorage.removeItem(RECORDING_SESSION_KEY);
  }, []);

  // Check for interrupted recording on mount
  useEffect(() => {
    try {
      const sessionStr = localStorage.getItem(RECORDING_SESSION_KEY);
      if (sessionStr) {
        const session: RecordingSession = JSON.parse(sessionStr);
        // Check if session is stale (more than 5 minutes old since last update)
        const lastUpdate = new Date(session.lastUpdateAt);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastUpdate < fiveMinutesAgo && session.duration > 0) {
          // Stale session found - show warning
          setInterruptedDuration(session.duration);
          setShowInterruptedWarning(true);
          // Clear the stale session
          clearRecordingSession();
        } else if (session.duration === 0) {
          // Session with no duration - likely just started and crashed, clear it
          clearRecordingSession();
        }
      }
    } catch (e) {
      // Ignore localStorage errors
      localStorage.removeItem(RECORDING_SESSION_KEY);
    }
  }, [clearRecordingSession]);

  // Add/remove beforeunload handler based on recording state
  useEffect(() => {
    if (isRecording) {
      window.addEventListener('beforeunload', beforeUnloadHandler);
      startRecordingSession();
    } else {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    }
    
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [isRecording, beforeUnloadHandler, startRecordingSession]);

  const createCaseMutation = useMutation<CaseResponse, Error, any>({
    mutationFn: async (caseData: any) => {
      return await apiRequest<CaseResponse>("POST", "/api/cases", caseData);
    },
    onSuccess: (data) => {
      // Invalidate all queries that start with /api/cases (including those with query params)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        }
      });
      toast({
        title: "Case created successfully",
        description: "Your case has been saved and is ready for processing.",
        duration: 6000,
        action: (
          <ToastAction 
            altText="View case" 
            onClick={() => setLocation(`/case/${data.id}`)}
            data-testid="button-toast-view-case"
          >
            View Case
          </ToastAction>
        ),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating case",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      startActualRecording();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);
  
  const startActualRecording = async () => {
    try {
      if (useChunkedUpload) {
        const success = await chunkedRecording.startRecording();
        if (!success) {
          throw new Error('Failed to start chunked recording');
        }
        setShowConsentModal(true);
        setRecordingDuration(0);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const { mimeType } = audioFormatRef.current;
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          audioBlobRef.current = audioBlob;
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setShowConsentModal(true);
        setIsRecordingLocal(true);
        setRecordingDuration(0);
      }

      // Dispatch event for session auto-extension during recording
      window.dispatchEvent(new CustomEvent('recording-started'));

      await logAuditEvent({
        eventType: "recording_started",
        metadata: { 
          source: "quick_record_button",
          chunkedUpload: useChunkedUpload,
        },
        severity: "info",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording not available",
        description: "Microphone access failed. Using text notes instead.",
        duration: 6000,
      });
      setShowTextNotesModal(true);
    }
  };

  useEffect(() => {
    if (!isRecording) return;

    if (useChunkedUpload) {
      setRecordingDuration(chunkedRecording.duration);
    }

    const interval = setInterval(() => {
      if (useChunkedUpload) {
        setRecordingDuration(chunkedRecording.duration);
        if (chunkedRecording.duration % 5 === 0) {
          updateRecordingSession(chunkedRecording.duration);
        }
      } else {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration % 5 === 0) {
            updateRecordingSession(newDuration);
          }
          return newDuration;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, updateRecordingSession, useChunkedUpload, chunkedRecording.duration]);

  // Auto-reset stop confirmation after 5 seconds
  useEffect(() => {
    if (!stopConfirmationPending) return;

    const resetTimer = setTimeout(() => {
      setStopConfirmationPending(false);
    }, 5000);

    return () => clearTimeout(resetTimer);
  }, [stopConfirmationPending]);

  const initiateRecording = () => {
    setCountdown(3); // 3-second countdown
  };

  const cancelCountdown = () => {
    setCountdown(null);
  };

  const handleConsentGiven = async () => {
    setConsentGiven(true);
    
    // Close ConsentModal BEFORE any audit logging
    setShowConsentModal(false);
    
    // Log consent given event (client-side audit)
    await logAuditEvent({
      eventType: "consent_given",
      metadata: { 
        source: "quick_record_button",
        consentModality: "verbal_recorded",
      },
      severity: "warning",
    });
  };

  const handleConsentDeclined = async () => {
    if (useChunkedUpload) {
      chunkedRecording.cancelRecording();
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingLocal(false);
    }
    
    // Dispatch event for session timeout component
    window.dispatchEvent(new CustomEvent('recording-stopped'));
    
    setConsentGiven(false);
    setShowConsentModal(false);
    setRecordingDuration(0);
    audioBlobRef.current = null;
    clearRecordingSession();
    setShowTextNotesModal(true);

    await logAuditEvent({
      eventType: "consent_declined",
      metadata: { 
        source: "quick_record_button",
        fallback: "text_notes",
      },
      severity: "warning",
    });
  };
  
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleStopClick = async () => {
    if (!stopConfirmationPending) {
      setStopConfirmationPending(true);
    } else {
      if (useChunkedUpload) {
        const audioBlob = await chunkedRecording.stopRecording();
        audioBlobRef.current = audioBlob;
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecordingLocal(false);
      }
      
      // Dispatch event for session timeout component
      window.dispatchEvent(new CustomEvent('recording-stopped'));
      
      setStopConfirmationPending(false);
      setShowMetadataModal(true);
    }
  };

  const saveCase = async () => {
    
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }
    
    // Show processing overlay immediately
    setIsProcessing(true);
    setProcessingStep('saving');
    
    let caseResult: CaseResponse | null = null;
    let consentLogFailed = false;
    let uploadFailed = false;
    
    try {
      // Step 1: Create case
      caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
        title: caseTitle,
        clientName: clientName,
        matterReference: matterRef || undefined,
        sourceType: "audio",
        status: "pending",
        priority: "normal",
      });
      
      // Step 2: Create audio record placeholder
      const audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
        caseId: caseResult.id,
      });
      
      setProcessingStep('uploading');
      
      if (useChunkedUpload && chunkedRecording.chunkSessionId) {
        try {
          const result = await chunkedRecording.finalizeAndUpload(audioResult.id);
          console.log(`Chunked upload finalized: ${result.totalChunks} chunks, ${result.totalBytes} bytes`);
        } catch (uploadError: any) {
          console.error('Chunked upload finalization failed:', uploadError);
          uploadFailed = true;
          throw uploadError;
        }
      } else if (audioBlobRef.current) {
        try {
          const formData = new FormData();
          const { extension } = audioFormatRef.current;
          formData.append('audioFile', audioBlobRef.current, `recording${extension}`);
          formData.append('duration', recordingDuration.toString());
          
          const response = await fetch(`/api/audio/${audioResult.id}/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
          }
        } catch (uploadError: any) {
          console.error('Audio upload failed:', uploadError);
          uploadFailed = true;
          throw uploadError;
        }
      }
      
      // Step 4: Save consent log to backend (GDPR compliance)
      if (consentGiven !== null) {
        try {
          const consentPayload = {
            caseId: caseResult.id,
            audioRecordingId: audioResult.id,
            consentGiven: consentGiven,
            consentModality: "verbal_recorded" as const,
            disclaimerScriptVersion: "v1.0",
          };
          await apiRequest("POST", "/api/consent", consentPayload);
        } catch (consentError: any) {
          console.error('Consent log failed:', consentError);
          consentLogFailed = true;
          // Don't throw - allow processing to continue but mark as failed
        }
      }
      
      // Step 5: Trigger AI processing (transcription + document generation)
      // Critical: Only trigger if consent was successfully logged (GDPR requirement)
      if (!consentLogFailed) {
        // Update processing step
        setProcessingStep('processing');
        
        // Trigger processing asynchronously (don't wait for completion)
        apiRequest("POST", `/api/cases/${caseResult.id}/process`, {})
          .then(() => {
            queryClient.invalidateQueries({ 
              predicate: (query) => {
                const key = query.queryKey[0] as string;
                return key?.startsWith("/api/cases");
              }
            });
          })
          .catch((error: any) => {
            console.error('AI processing failed:', error);
            const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
            toast({
              title: "AI Processing Issue",
              description: `Documents may not have been generated: ${errorMessage}. You can retry from the case detail page.`,
              variant: "destructive",
              duration: 10000,
            });
          });
      }
      
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        }
      });
      
      // Show single, clear status toast based on outcome
      if (caseResult) {
        const caseId = caseResult.id;
        
        if (consentLogFailed) {
          // Critical failure: consent logging is required for GDPR compliance
          setIsProcessing(false);
          toast({
            title: "Action required",
            description: "Case created but consent log failed. GDPR compliance requires you to save consent.",
            variant: "destructive",
            duration: 15000,
            action: (
              <ToastAction 
                altText="View case" 
                onClick={() => setLocation(`/case/${caseId}`)}
                data-testid="button-toast-view-case-consent-failed"
              >
                View Case
              </ToastAction>
            ),
          });
          // Don't close modal - keep it open so user can see the issue
          return;
        } else {
          // Show complete step briefly before closing
          setProcessingStep('complete');
          
          // Wait a moment to show completion, then close and show toast
          await new Promise(resolve => setTimeout(resolve, 1200));
          
          // Success
          toast({
            title: "Case created successfully",
            description: "Meeting-to-Matter™ AI Engine is preparing your documents.",
            duration: 6000,
            action: (
              <ToastAction 
                altText="View case" 
                onClick={() => setLocation(`/case/${caseId}`)}
                data-testid="button-toast-view-case"
              >
                View Case
              </ToastAction>
            ),
          });
        }
      }
      
      // Only close modal and clear state if everything succeeded
      if (!consentLogFailed) {
        // Clear recording session from localStorage (successful save)
        clearRecordingSession();
        
        setShowMetadataModal(false);
        setIsProcessing(false);
        setProcessingStep('saving');
        setRecordingDuration(0);
        setCaseTitle("");
        setClientName("");
        setMatterRef("");
        audioBlobRef.current = null;
        setConsentGiven(null);
      }
    } catch (error: any) {
      // Reset processing state on error
      setIsProcessing(false);
      setProcessingStep('saving');
      
      // If case was created but later steps failed, inform user about partial success
      if (caseResult && !uploadFailed) {
        const caseId = caseResult.id;
        const errorMessage = error?.message || error?.toString() || "a step failed";
        toast({
          title: "Partial success",
          description: `Case created but ${errorMessage}. You can still view your case.`,
          variant: "destructive",
          duration: 10000,
          action: (
            <ToastAction 
              altText="View case" 
              onClick={() => setLocation(`/case/${caseId}`)}
              data-testid="button-toast-view-case-partial"
            >
              View Case
            </ToastAction>
          ),
        });
      } else if (caseResult && uploadFailed) {
        // Upload failed - keep modal open so user can retry
        const caseId = caseResult.id;
        const errorMessage = error?.message || error?.toString() || "Upload failed";
        toast({
          title: "Upload failed",
          description: `${errorMessage}. Case was created. You can re-upload or view the case.`,
          variant: "destructive",
          duration: 15000,
          action: (
            <ToastAction 
              altText="View case" 
              onClick={() => setLocation(`/case/${caseId}`)}
              data-testid="button-toast-view-case-upload-failed"
            >
              View Case
            </ToastAction>
          ),
        });
        // Keep modal open and retain recording
        return;
      } else {
        const errorMessage = error?.message || error?.toString() || "Something went wrong";
        toast({
          title: "Error creating case",
          description: errorMessage,
          variant: "destructive",
          duration: 8000,
        });
      }
    }
  };

  const saveTextNotes = (data: { caseTitle: string; clientName: string; matterRef: string; notes: string }) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }
    
    createCaseMutation.mutate({
      title: data.caseTitle,
      clientName: data.clientName,
      matterReference: data.matterRef || undefined,
      sourceType: "text",
      textNotes: data.notes,
      status: "pending",
      priority: "normal",
    });
    
    setShowTextNotesModal(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (countdown !== null) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-2 bg-destructive/20 rounded-full px-2 sm:px-3 py-1 animate-pulse">
          <span className="text-xs sm:text-sm font-semibold text-red-400 dark:text-red-300 whitespace-nowrap" data-testid="text-countdown">
            <span className="hidden sm:inline">Recording in </span>{countdown}...
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelCountdown}
          className="text-primary-foreground h-7 px-2"
          data-testid="button-cancel-countdown"
        >
          <span className="hidden sm:inline">Cancel</span>
          <span className="sm:hidden">✕</span>
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <>
        <div className="flex items-center gap-1 sm:gap-3 bg-card/50 rounded-lg px-2 sm:px-3 py-1">
          <Badge className="bg-destructive animate-pulse hidden sm:flex" data-testid="badge-quick-recording">
            Recording
          </Badge>
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse sm:hidden" />
          <p className="text-xs sm:text-sm font-mono font-semibold text-primary-foreground" data-testid="text-quick-duration">
            {formatDuration(recordingDuration)}
          </p>
          
          {useChunkedUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden sm:flex items-center gap-1">
                  {chunkedRecording.isUploading ? (
                    <CloudUpload className="w-3 h-3 text-blue-400 animate-pulse" />
                  ) : chunkedRecording.networkStatus.online ? (
                    <Wifi className="w-3 h-3 text-green-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-amber-400" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {chunkedRecording.chunksUploaded}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm max-w-[220px]">
                  {chunkedRecording.networkStatus.online 
                    ? `${chunkedRecording.chunksUploaded} chunks saved to cloud. Your recording is protected every 10 seconds.`
                    : "Offline - chunks will upload when connected."}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden sm:flex items-center gap-1 text-green-400">
                <Shield className="w-3 h-3" />
                <span className="text-xs">Protected</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm max-w-[250px] space-y-1">
                <p className="font-medium">Recording Safeguards Active:</p>
                <ul className="text-xs space-y-0.5">
                  <li>• Tab close warning enabled</li>
                  {useChunkedUpload && <li>• Chunks saved every 10 seconds</li>}
                  {useChunkedUpload && chunkedRecording.networkStatus.online && <li>• Network connection stable</li>}
                  <li>• Consent segment preserved</li>
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopClick}
            className={`gap-1 min-h-[44px] px-3 ${
              stopConfirmationPending 
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse' 
                : 'text-primary-foreground'
            }`}
            data-testid="button-stop-quick-record"
          >
            <Square className="w-4 h-4" />
            <span className="text-xs sm:text-sm whitespace-nowrap">
              {stopConfirmationPending ? 'Confirm Stop?' : 'Stop'}
            </span>
          </Button>
        </div>
        
        <ConsentModal
          open={showConsentModal}
          onConsentGiven={handleConsentGiven}
          onConsentDeclined={handleConsentDeclined}
        />
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={initiateRecording}
            className="w-9 h-9 rounded-full bg-destructive hover:bg-destructive/90"
            data-testid="button-quick-record"
          >
            <Mic className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm max-w-[200px]">
            <strong>Quick Record:</strong> Start recording instantly, add case details after
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showMetadataModal} onOpenChange={(open) => !isProcessing && setShowMetadataModal(open)}>
        <DialogContent data-testid="dialog-metadata" className="sm:max-w-md">
          {isProcessing ? (
            <div className="py-8" data-testid="processing-overlay">
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  {processingStep === 'complete' ? (
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
                      <Loader2 className="w-10 h-10 text-accent animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold" data-testid="text-processing-title">
                    {processingStep === 'complete' 
                      ? 'All Done!' 
                      : 'Meeting-to-Matter™ AI Engine'}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-processing-description">
                    {processingStep === 'complete'
                      ? 'Your case is ready. Redirecting...'
                      : 'Please wait while we save your case and prepare your documents.'}
                  </p>
                </div>
                
                <div className="w-full max-w-xs space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      processingStep === 'saving' 
                        ? 'bg-accent/20' 
                        : 'bg-green-500/20'
                    }`}>
                      {processingStep === 'saving' ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${processingStep === 'saving' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Saving case details
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      processingStep === 'uploading' 
                        ? 'bg-accent/20' 
                        : processingStep === 'saving' 
                          ? 'bg-muted' 
                          : 'bg-green-500/20'
                    }`}>
                      {processingStep === 'uploading' ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      ) : processingStep === 'saving' ? (
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${processingStep === 'uploading' ? 'text-foreground' : processingStep === 'saving' ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                        Uploading audio recording
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      processingStep === 'processing' 
                        ? 'bg-accent/20' 
                        : processingStep === 'complete' 
                          ? 'bg-green-500/20' 
                          : 'bg-muted'
                    }`}>
                      {processingStep === 'processing' ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      ) : processingStep === 'complete' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${processingStep === 'processing' ? 'text-foreground' : processingStep === 'complete' ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                        Activating AI Engine
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add Case Details</DialogTitle>
                <DialogDescription>
                  Recording complete. Add case information while we process the transcription.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-case-title">
                    Case Title <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="quick-case-title"
                    placeholder="e.g., Estate Planning Consultation"
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value)}
                    data-testid="input-quick-case-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-client-name">
                    Client Name <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="quick-client-name"
                    placeholder="e.g., Mrs. Catherine Williams"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    data-testid="input-quick-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-matter-ref">Matter Reference</Label>
                  <Input
                    id="quick-matter-ref"
                    placeholder="e.g., MAT-2025-001"
                    value={matterRef}
                    onChange={(e) => setMatterRef(e.target.value)}
                    data-testid="input-quick-matter-ref"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowMetadataModal(false)}
                  data-testid="button-cancel-metadata"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCase}
                  disabled={!caseTitle || !clientName}
                  className="bg-accent hover:bg-accent"
                  data-testid="button-save-case"
                >
                  Save & Process
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TextNotesModal
        open={showTextNotesModal}
        onClose={() => setShowTextNotesModal(false)}
        onSave={saveTextNotes}
      />

      {/* Low Battery Warning Dialog */}
      <Dialog open={showLowBatteryWarning} onOpenChange={setShowLowBatteryWarning}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-low-battery-warning">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BatteryLow className="w-5 h-5 text-amber-500" />
              Low Battery Warning
            </DialogTitle>
            <DialogDescription>
              Your device battery is low ({batteryLevel}%). We recommend charging before starting a recording.
            </DialogDescription>
          </DialogHeader>
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <BatteryLow className="w-4 h-4 text-amber-500" />
            <AlertDescription>
              If your device shuts down during recording, some audio data may be lost.
              With chunked uploads enabled, you'll only lose the last 10 seconds maximum.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLowBatteryWarning(false)}
              data-testid="button-battery-understood"
            >
              I'll Charge First
            </Button>
            <Button
              onClick={() => {
                setShowLowBatteryWarning(false);
                initiateRecording();
              }}
              className="bg-accent hover:bg-accent"
              data-testid="button-record-anyway"
            >
              Record Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interrupted Recording Warning Dialog */}
      <Dialog open={showInterruptedWarning} onOpenChange={setShowInterruptedWarning}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-interrupted-warning">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Recording Interrupted
            </DialogTitle>
            <DialogDescription>
              It looks like a previous recording session was interrupted unexpectedly.
            </DialogDescription>
          </DialogHeader>
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <AlertDescription>
              A recording of approximately <strong>{formatDuration(interruptedDuration)}</strong> was lost. 
              This can happen if your browser closed, battery died, or the page was refreshed.
            </AlertDescription>
          </Alert>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong>Tips to prevent data loss:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Keep your device charged during recordings</li>
              <li>Avoid refreshing or closing the browser tab</li>
              <li>For long meetings, consider taking backup notes</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowInterruptedWarning(false)}
              className="bg-accent hover:bg-accent"
              data-testid="button-acknowledge-interrupted"
            >
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
