import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, FileText, AlertTriangle, BatteryLow } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordingControlCenter, {
  ControlCenterActionButton,
} from "@/components/RecordingControlCenter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToastAction } from "@/components/ui/toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ConsentModal from "@/components/ConsentModal";
import ClientNameAutocomplete from "@/components/ClientNameAutocomplete";
import MeetingToMatterProcessingOverlay, { type ProcessingStep } from "@/components/MeetingToMatterProcessingOverlay";
import { createProcessingStepTimer } from "@/lib/processingStepTimer";
import TextNotesModal from "@/components/TextNotesModal";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { PRACTICE_AREAS, PRACTICE_AREA_LABELS, type PracticeArea } from "@shared/schema";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { logAuditEvent } from "@/lib/auditLogger";
import { useChunkedRecording } from "@/hooks/useChunkedRecording";
import { QUICK_RECORD_SHORTCUT_EVENT } from "@/hooks/useQuickRecordShortcut";
import { appendConsentSegmentToFormData, snapshotConsentSegment } from "@/lib/consentSegmentCapture";

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
  const [location, setLocation] = useLocation();
  const caseMatch = location.match(/\/case\/([^/]+)/);
  const contextCaseId = caseMatch ? caseMatch[1] : null;
  const { data: contextCase } = useQuery<{ id: string; title: string; clientName?: string }>({
    queryKey: ["/api/cases", contextCaseId],
    enabled: !!contextCaseId,
  });
  /** Snapshot matter id when recording starts so navigation mid-record doesn't drop attachment. */
  const recordingTargetCaseIdRef = useRef<string | null>(null);
  const contextMatterTitle = contextCase?.title?.trim() || null;
  const controlCenterTitle = contextMatterTitle || "Quick Record";
  const controlCenterSubtitle = contextMatterTitle
    ? contextCase?.clientName
      ? `Recording for ${contextCase.clientName}`
      : "Recording for this matter"
    : null;

  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [stopConfirmationPending, setStopConfirmationPending] = useState(false);
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showTextNotesModal, setShowTextNotesModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('saving');
  const [caseTitle, setCaseTitle] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [practiceArea, setPracticeArea] = useState<PracticeArea | "">("");
  const [conflictCheckCompleted, setConflictCheckCompleted] = useState(false);
  const [conflictCheckNote, setConflictCheckNote] = useState("");
  const [showInterruptedWarning, setShowInterruptedWarning] = useState(false);
  const [interruptedDuration, setInterruptedDuration] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [showLowBatteryWarning, setShowLowBatteryWarning] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [useChunkedUpload, setUseChunkedUpload] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const consentBlobRef = useRef<Blob | null>(null);
  const consentDurationSecondsRef = useRef<number | null>(null);
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
        
        mediaRecorder.start(1000);
        setShowConsentModal(true);
        setIsRecordingLocal(true);
        setRecordingDuration(0);
        consentBlobRef.current = null;
        consentDurationSecondsRef.current = null;
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

  const initiateRecording = useCallback(() => {
    recordingTargetCaseIdRef.current = contextCaseId;
    setCountdown(3); // 3-second countdown
  }, [contextCaseId]);

  // Control+L is registered globally (useQuickRecordShortcut) and dispatches this event
  useEffect(() => {
    const handleShortcut = () => {
      if (isRecording || countdown !== null) return;
      initiateRecording();
    };
    window.addEventListener(QUICK_RECORD_SHORTCUT_EVENT, handleShortcut);
    return () => window.removeEventListener(QUICK_RECORD_SHORTCUT_EVENT, handleShortcut);
  }, [isRecording, countdown, initiateRecording]);

  const cancelCountdown = () => {
    recordingTargetCaseIdRef.current = null;
    setCountdown(null);
  };

  const handleConsentGiven = async () => {
    setConsentGiven(true);
    
    // Close ConsentModal BEFORE any audit logging
    setShowConsentModal(false);
    
    // Mark consent timestamp for accurate consent segment preservation
    if (useChunkedUpload) {
      const consentResult = await chunkedRecording.markConsentConfirmed();
      if (consentResult) {
        console.log(`Consent segment will preserve ${consentResult.elapsedSeconds}s of recording`);
      }
    } else {
      const consentBlob = await snapshotConsentSegment({
        mediaRecorder: mediaRecorderRef.current,
        audioChunks: audioChunksRef.current,
        mimeType: audioFormatRef.current.mimeType,
      });
      consentBlobRef.current = consentBlob;
      consentDurationSecondsRef.current = Math.max(1, recordingDuration);
    }
    
    // Consent is sealed server-side via POST /api/consent — no duplicate client audit entry.
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
      
      // Log recording stopped event for audit trail
      // Note: consentGiven reflects user's selection during recording (modal response)
      // The actual consent log persistence is tracked separately in case creation
      await logAuditEvent({
        eventType: "recording_stopped",
        metadata: { 
          source: "quick_record_button",
          durationSeconds: recordingDuration,
          consentSelectedDuringRecording: consentGiven, // User's modal selection, not backend-confirmed
          chunkedUpload: useChunkedUpload,
          stoppedAt: new Date().toISOString(),
        },
        severity: "info",
      });
      
      setStopConfirmationPending(false);
      const targetCaseId = recordingTargetCaseIdRef.current;
      if (targetCaseId) {
        // On a matter: add session immediately — no new-case metadata form
        void saveSessionToExistingCase(targetCaseId);
        return;
      }
      if (contextMatterTitle && !caseTitle.trim()) {
        setCaseTitle(contextMatterTitle);
      }
      setShowMetadataModal(true);
    }
  };

  /** Upload + process onto an existing matter (Quick Record started from /case/:id). */
  const saveSessionToExistingCase = async (caseId: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save this recording",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const advanceStep = createProcessingStepTimer(setProcessingStep);
    setProcessingStep("saving");

    let audioResult: AudioResponse | null = null;
    let consentLogFailed = false;
    let uploadFailed = false;
    let sessionResult: { id: string } | null = null;

    const saveConsentLog = async (audioRecordingId?: string) => {
      if (consentGiven === null) return;
      await apiRequest("POST", "/api/consent", {
        caseId,
        ...(audioRecordingId ? { audioRecordingId } : {}),
        consentGiven,
        consentModality: "verbal_recorded" as const,
        disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
        disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
        lawfulBasis: "consent" as const,
        recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
        source: "quick_record_button",
      });
    };

    try {
      sessionResult = await apiRequest<{ id: string }>("POST", `/api/cases/${caseId}/sessions`, {
        recordingType: "full_meeting",
        sessionTitle: "Quick Record",
      });

      try {
        audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
          caseId,
          meetingSessionId: sessionResult.id,
        });
      } catch (audioCreateError: any) {
        console.error("Audio record creation failed:", audioCreateError);
        uploadFailed = true;
      }

      if (consentGiven !== null) {
        try {
          await saveConsentLog(audioResult?.id);
        } catch (consentError: any) {
          console.error("Consent log failed:", consentError);
          consentLogFailed = true;
        }
      }

      if (!audioResult) {
        throw new Error(
          "Could not create audio record. Your consent has been saved — try Quick Record again or contact support.",
        );
      }

      await advanceStep("uploading");

      if (useChunkedUpload && chunkedRecording.chunkSessionId) {
        try {
          await chunkedRecording.finalizeAndUpload(audioResult.id);
        } catch (uploadError: any) {
          console.error("Chunked upload finalization failed:", uploadError);
          if (audioBlobRef.current) {
            try {
              const formData = new FormData();
              const { extension } = audioFormatRef.current;
              formData.append("audioFile", audioBlobRef.current, `recording${extension}`);
              formData.append("duration", recordingDuration.toString());
              appendConsentSegmentToFormData(
                formData,
                consentBlobRef.current,
                consentDurationSecondsRef.current,
              );
              const response = await fetch(`/api/audio/${audioResult.id}/upload`, {
                method: "POST",
                credentials: "include",
                body: formData,
              });
              if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || "Upload failed");
              }
            } catch (fallbackError: any) {
              uploadFailed = true;
              throw fallbackError;
            }
          } else {
            uploadFailed = true;
            throw uploadError;
          }
        }
      } else if (audioBlobRef.current) {
        try {
          const formData = new FormData();
          const { extension } = audioFormatRef.current;
          formData.append("audioFile", audioBlobRef.current, `recording${extension}`);
          formData.append("duration", recordingDuration.toString());
          appendConsentSegmentToFormData(
            formData,
            consentBlobRef.current,
            consentDurationSecondsRef.current,
          );
          const response = await fetch(`/api/audio/${audioResult.id}/upload`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Upload failed");
          }
        } catch (uploadError: any) {
          uploadFailed = true;
          throw uploadError;
        }
      }

      if (!consentLogFailed && !uploadFailed && consentGiven === true && sessionResult) {
        await advanceStep("processing");
        apiRequest("POST", `/api/cases/${caseId}/process`, { sessionId: sessionResult.id })
          .then(() => {
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey[0] as string;
                return key?.startsWith("/api/cases");
              },
            });
          })
          .catch((error: any) => {
            console.error("AI processing failed:", error);
            toast({
              title: "Processing Issue",
              description: `Documents may not have been generated: ${error?.message || "Unknown error"}. You can retry from the case detail page.`,
              variant: "destructive",
              duration: 10000,
            });
          });
      }

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        },
      });

      await logAuditEvent({
        eventType: "case_created_from_recording",
        caseId,
        metadata: {
          source: "quick_record_button",
          consentLoggingSaved: !consentLogFailed,
          consentSelectedDuringRecording: consentGiven,
          uploadSucceeded: !uploadFailed,
          durationSeconds: recordingDuration,
          chunkedUpload: useChunkedUpload,
          attachedToExistingCase: true,
        },
        severity: consentLogFailed ? "warning" : "info",
      });

      if (consentLogFailed) {
        setIsProcessing(false);
        toast({
          title: "Action required",
          description: "Session saved but consent log failed. GDPR compliance requires you to save consent.",
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
        return;
      }

      await advanceStep("complete");
      await new Promise((resolve) => setTimeout(resolve, 500));

      toast({
        title: "Session added to matter",
        description: "Meeting-to-Matter™ Engine is preparing your documents.",
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

      clearRecordingSession();
      recordingTargetCaseIdRef.current = null;
      setIsProcessing(false);
      setProcessingStep("saving");
      setRecordingDuration(0);
      audioBlobRef.current = null;
      setConsentGiven(null);

      if (!location.includes(`/case/${caseId}`)) {
        setLocation(`/case/${caseId}`);
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingStep("saving");
      toast({
        title: "Could not save session",
        description: error?.message || "Something went wrong saving this recording to the matter.",
        variant: "destructive",
        duration: 10000,
        action: (
          <ToastAction
            altText="View case"
            onClick={() => setLocation(`/case/${caseId}`)}
            data-testid="button-toast-view-case-session-failed"
          >
            View Case
          </ToastAction>
        ),
      });
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
    
    if (!practiceArea) {
      toast({
        title: "Practice area required",
        description: "Please select a practice area for this matter",
        variant: "destructive",
      });
      return;
    }

    if (!conflictCheckCompleted && !conflictCheckNote.trim()) {
      toast({
        title: "Conflict check required",
        description: "Either confirm the conflict check or provide a reason for deferral",
        variant: "destructive",
      });
      return;
    }

    // Show processing overlay immediately
    setIsProcessing(true);
    const advanceStep = createProcessingStepTimer(setProcessingStep);
    setProcessingStep('saving');
    
    let caseResult: CaseResponse | null = null;
    let audioResult: AudioResponse | null = null;
    let consentLogFailed = false;
    let uploadFailed = false;

    const saveConsentLog = async (caseId: string, audioRecordingId?: string) => {
      if (consentGiven === null) return;
      const consentPayload = {
        caseId,
        ...(audioRecordingId ? { audioRecordingId } : {}),
        consentGiven: consentGiven,
        consentModality: "verbal_recorded" as const,
        disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
        disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
        lawfulBasis: "consent" as const,
        recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
        source: "quick_record_button",
      };
      await apiRequest("POST", "/api/consent", consentPayload);
    };
    
    try {
      // Step 1: Create case
      caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
        title: caseTitle,
        clientName: selectedClient!.name,
        clientId: selectedClient!.id,
        matterReference: matterRef || undefined,
        sourceType: "audio",
        status: "pending",
        priority: "normal",
        practiceArea: practiceArea || undefined,
        conflictCheckCompleted,
        conflictCheckNote: conflictCheckNote || undefined,
      });

      // Link to derivation engine via a meeting session (full_meeting for Quick Record)
      const sessionResult = await apiRequest<{ id: string }>("POST", `/api/cases/${caseResult.id}/sessions`, {
        recordingType: "full_meeting",
        sessionTitle: "Quick Record",
      });

      // Step 2: Create audio record placeholder (may fail under rate limit — consent still saved)
      try {
        audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
          caseId: caseResult.id,
          meetingSessionId: sessionResult.id,
        });
      } catch (audioCreateError: any) {
        console.error('Audio record creation failed:', audioCreateError);
        uploadFailed = true;
      }

      // Step 3: Persist consent before upload — must survive upload failures
      if (consentGiven !== null) {
        try {
          await saveConsentLog(caseResult.id, audioResult?.id);
        } catch (consentError: any) {
          console.error('Consent log failed:', consentError);
          consentLogFailed = true;
        }
      }

      if (!audioResult) {
        throw new Error("Could not create audio record. Your consent has been saved — try Quick Record again or contact support.");
      }
      
      await advanceStep('uploading');
      
      if (useChunkedUpload && chunkedRecording.chunkSessionId) {
        try {
          const result = await chunkedRecording.finalizeAndUpload(audioResult.id);
          console.log(`Chunked upload finalized: ${result.totalChunks} chunks, ${result.totalBytes} bytes`);
        } catch (uploadError: any) {
          console.error('Chunked upload finalization failed:', uploadError);
          // Fallback: server may have lost in-memory session after restart/redeploy.
          // Client still has the full recording blob — upload it directly.
          if (audioBlobRef.current) {
            console.warn('Falling back to direct audio upload after chunk finalize failure');
            try {
              const formData = new FormData();
              const { extension } = audioFormatRef.current;
              formData.append('audioFile', audioBlobRef.current, `recording${extension}`);
              formData.append('duration', recordingDuration.toString());
              appendConsentSegmentToFormData(
                formData,
                consentBlobRef.current,
                consentDurationSecondsRef.current,
              );

              const response = await fetch(`/api/audio/${audioResult.id}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });

              if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'Upload failed');
              }
            } catch (fallbackError: any) {
              console.error('Direct audio upload fallback failed:', fallbackError);
              uploadFailed = true;
              throw fallbackError;
            }
          } else {
            uploadFailed = true;
            throw uploadError;
          }
        }
      } else if (audioBlobRef.current) {
        try {
          const formData = new FormData();
          const { extension } = audioFormatRef.current;
          formData.append('audioFile', audioBlobRef.current, `recording${extension}`);
          formData.append('duration', recordingDuration.toString());
          appendConsentSegmentToFormData(
            formData,
            consentBlobRef.current,
            consentDurationSecondsRef.current,
          );
          
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
      
      // Step 5: Trigger AI processing only when consent is logged and upload succeeded
      if (!consentLogFailed && !uploadFailed && consentGiven === true) {
        // Update processing step
        await advanceStep('processing');
        
        // Trigger processing asynchronously (don't wait for completion)
        apiRequest("POST", `/api/cases/${caseResult.id}/process`, { sessionId: sessionResult.id })
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
              title: "Processing Issue",
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
      
      // Log case creation with consent save outcome for audit completeness
      // This links the recording_stopped event to the final case outcome
      await logAuditEvent({
        eventType: "case_created_from_recording",
        caseId: caseResult.id,
        metadata: {
          source: "quick_record_button",
          consentLoggingSaved: !consentLogFailed,
          consentSelectedDuringRecording: consentGiven,
          uploadSucceeded: !uploadFailed,
          durationSeconds: recordingDuration,
          chunkedUpload: useChunkedUpload,
        },
        severity: consentLogFailed ? "warning" : "info",
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
          await advanceStep('complete');
          
          // Wait a moment to show completion, then close and show toast
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Success
          toast({
            title: "Case created successfully",
            description: "Meeting-to-Matter™ Engine is preparing your documents.",
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
        setMatterRef("");
        setSelectedClient(null);
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

  const handleCancelClick = () => {
    // Always show confirmation since canceling will discard the recording
    setShowCancelConfirmation(true);
  };

  const confirmCancel = () => {
    setShowCancelConfirmation(false);
    setShowMetadataModal(false);
    setRecordingDuration(0);
    setCaseTitle("");
    setMatterRef("");
    setSelectedClient(null);
  };

  const saveTextNotes = async (data: { caseTitle: string; clientName: string; matterRef: string; notes: string }) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }
    
    let clientForCase = selectedClient;
    if (!clientForCase && data.clientName.trim()) {
      try {
        clientForCase = await apiRequest<Client>("POST", "/api/clients", { name: data.clientName.trim() });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      } catch (err: any) {
        toast({
          title: "Failed to create client",
          description: err.message || "Could not create client record",
          variant: "destructive",
        });
        return;
      }
    }

    if (!clientForCase) {
      toast({
        title: "Client required",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }

    createCaseMutation.mutate({
      title: data.caseTitle,
      clientName: clientForCase.name,
      clientId: clientForCase.id,
      matterReference: data.matterRef || undefined,
      sourceType: "text",
      textNotes: data.notes,
      status: "pending",
      priority: "normal",
      practiceArea: practiceArea || undefined,
      conflictCheckCompleted,
      conflictCheckNote: conflictCheckNote || undefined,
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
      <>
        {/* Keep nav mic slot empty while countdown runs — controls live in the corner */}
        <span className="sr-only" data-testid="text-countdown">
          Recording in {countdown}
        </span>
        <RecordingControlCenter
          tone="countdown"
          statusLabel="Starting"
          title={controlCenterTitle}
          subtitle={controlCenterSubtitle || "Starting shortly"}
          countdown={countdown}
          safeguards={{ protected: true }}
          collapsible={false}
          actions={
            <ControlCenterActionButton
              variant="outline"
              onClick={cancelCountdown}
              data-testid="button-cancel-countdown"
            >
              Cancel
            </ControlCenterActionButton>
          }
        />
      </>
    );
  }

  if (isRecording) {
    return (
      <>
        <span className="sr-only" data-testid="badge-quick-recording">
          Recording {formatDuration(recordingDuration)}
        </span>
        <span className="sr-only" data-testid="text-quick-duration">
          {formatDuration(recordingDuration)}
        </span>
        <RecordingControlCenter
          tone={stopConfirmationPending ? "warning" : "recording"}
          statusLabel="Recording"
          title={controlCenterTitle}
          subtitle={controlCenterSubtitle}
          elapsedSeconds={recordingDuration}
          forceExpanded={stopConfirmationPending}
          safeguards={{
            protected: true,
            showChunkStatus: useChunkedUpload,
            online: chunkedRecording.networkStatus.online,
            isUploading: chunkedRecording.isUploading,
            chunksUploaded: chunkedRecording.chunksUploaded,
            pendingChunks: chunkedRecording.pendingChunksCount,
            lastSyncTime: chunkedRecording.lastSyncTime,
          }}
          alerts={{
            isSilent: chunkedRecording.isSilent,
            batteryLevel: chunkedRecording.batteryLevel,
          }}
          actions={
            <ControlCenterActionButton
              variant={stopConfirmationPending ? "confirm" : "destructive"}
              onClick={handleStopClick}
              data-testid="button-stop-quick-record"
            >
              <Square className="h-3.5 w-3.5" />
              {stopConfirmationPending ? "Confirm stop" : "Stop recording"}
            </ControlCenterActionButton>
          }
        />

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
          <p className="text-sm max-w-[220px]">
            <strong>Record now:</strong> Starts immediately. On a matter, adds a session; otherwise creates a new matter after you stop.
            <span className="block mt-1 text-muted-foreground font-mono text-xs">Ctrl+L</span>
          </p>
        </TooltipContent>
      </Tooltip>

      {isProcessing && (
        <RecordingControlCenter
          tone="processing"
          statusLabel={
            processingStep === "complete"
              ? "Ready"
              : processingStep === "processing"
                ? "Producing notes"
                : processingStep === "uploading"
                  ? "Uploading"
                  : "Saving"
          }
          title={caseTitle.trim() || controlCenterTitle}
          subtitle="Meeting-to-Matter in progress"
          collapsible={false}
          data-testid="recording-control-center-processing"
        />
      )}

      <Dialog open={showMetadataModal} onOpenChange={(open) => !isProcessing && setShowMetadataModal(open)}>
        <DialogContent data-testid="dialog-metadata" className="sm:max-w-md overflow-visible">
          {isProcessing ? (
            <MeetingToMatterProcessingOverlay processingStep={processingStep} />
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
                  <ClientNameAutocomplete
                    id="quick-client-name"
                    selectedClient={selectedClient}
                    onSelect={setSelectedClient}
                    onClear={() => setSelectedClient(null)}
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
                <div className="space-y-2">
                  <Label htmlFor="quick-practice-area">Practice Area <span className="text-destructive">*</span></Label>
                  <Select
                    value={practiceArea}
                    onValueChange={(val) => setPracticeArea(val as PracticeArea)}
                  >
                    <SelectTrigger id="quick-practice-area" data-testid="select-quick-practice-area">
                      <SelectValue placeholder="Select practice area..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_AREAS.map((pa) => (
                        <SelectItem key={pa} value={pa} data-testid={`option-quick-practice-area-${pa}`}>
                          {PRACTICE_AREA_LABELS[pa]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="quick-conflict-check"
                    checked={conflictCheckCompleted}
                    onCheckedChange={(checked) => {
                      setConflictCheckCompleted(checked === true);
                      if (checked) setConflictCheckNote("");
                    }}
                    data-testid="checkbox-quick-conflict-check"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="quick-conflict-check" className="text-sm font-medium cursor-pointer">
                      Conflict of interest check completed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      SRA compliance requirement
                    </p>
                  </div>
                </div>
                {!conflictCheckCompleted && (
                  <div className="space-y-1">
                    <Label htmlFor="quick-conflict-note" className="text-xs text-amber-600 dark:text-amber-400">
                      Reason for deferring conflict check:
                    </Label>
                    <Input
                      id="quick-conflict-note"
                      placeholder="e.g., To be completed by compliance team"
                      value={conflictCheckNote}
                      onChange={(e) => setConflictCheckNote(e.target.value)}
                      data-testid="input-quick-conflict-note"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelClick}
                  data-testid="button-cancel-metadata"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCase}
                  disabled={!caseTitle || !selectedClient || !practiceArea}
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

      <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Discard Recording?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Complete the case details to save, or discard to permanently delete this recording.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-editing">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-discard"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
