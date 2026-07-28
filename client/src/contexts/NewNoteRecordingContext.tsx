import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { Square } from "lucide-react";
import ConsentModal from "@/components/ConsentModal";
import RecordingControlCenter, {
  ControlCenterActionButton,
} from "@/components/RecordingControlCenter";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { logAuditEvent } from "@/lib/auditLogger";
import { appendConsentSegmentToFormData, snapshotConsentSegment } from "@/lib/consentSegmentCapture";
import { createProcessingStepTimer } from "@/lib/processingStepTimer";
import type { ProcessingStep } from "@/components/MeetingToMatterProcessingOverlay";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";
import type { PracticeArea, RecordingType } from "@shared/schema";

export type NewNoteRecordingMeta = {
  noteMode: "new_matter" | "add_session";
  caseTitle: string;
  clientId?: string;
  clientName?: string;
  clientAmlRiskLevel?: string | null;
  matterRef?: string;
  practiceArea?: PracticeArea | "";
  conflictCheckCompleted: boolean;
  conflictCheckNote?: string;
  costsEstimate?: string;
  templateId?: string;
  selectedCaseId?: string;
  recordingType: RecordingType;
  sessionLabel?: string;
  /** Shown in the control center */
  displayTitle: string;
  displaySubtitle?: string | null;
};

type Phase = "idle" | "countdown" | "recording" | "processing";

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

interface NewNoteRecordingContextType {
  phase: Phase;
  isActive: boolean;
  isRecording: boolean;
  countdown: number | null;
  duration: number;
  meta: NewNoteRecordingMeta | null;
  startCountdown: (meta: NewNoteRecordingMeta) => void;
  cancelCountdown: () => void;
}

const NewNoteRecordingContext = createContext<NewNoteRecordingContextType | undefined>(
  undefined,
);

export function useNewNoteRecording() {
  const ctx = useContext(NewNoteRecordingContext);
  if (!ctx) {
    throw new Error("useNewNoteRecording must be used within NewNoteRecordingProvider");
  }
  return ctx;
}

/** Safe for pages that may render outside the provider (returns inactive defaults). */
export function useNewNoteRecordingOptional(): NewNoteRecordingContextType | null {
  return useContext(NewNoteRecordingContext) ?? null;
}

export function NewNoteRecordingProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [meta, setMeta] = useState<NewNoteRecordingMeta | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [stopConfirmationPending, setStopConfirmationPending] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("saving");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const consentBlobRef = useRef<Blob | null>(null);
  const consentDurationSecondsRef = useRef<number | null>(null);
  const metaRef = useRef<NewNoteRecordingMeta | null>(null);
  const durationRef = useRef(0);
  const consentGivenRef = useRef<boolean | null>(null);

  metaRef.current = meta;
  durationRef.current = duration;
  consentGivenRef.current = consentGiven;

  const isRecording = phase === "recording";
  const isActive = phase !== "idle";

  const resetSession = useCallback(() => {
    setPhase("idle");
    setCountdown(null);
    setDuration(0);
    setMeta(null);
    setShowConsentModal(false);
    setStopConfirmationPending(false);
    setConsentGiven(null);
    setProcessingStep("saving");
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    consentBlobRef.current = null;
    consentDurationSecondsRef.current = null;
  }, []);

  const startActualRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      consentBlobRef.current = null;
      consentDurationSecondsRef.current = null;
      audioBlobRef.current = null;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = audioBlob;
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000);
      setShowConsentModal(true);
      setPhase("recording");
      setDuration(0);

      await logAuditEvent({
        eventType: "recording_started",
        metadata: { source: "new_note_page" },
        severity: "info",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording not available",
        description: "Microphone access failed. Return to Capture and use text notes instead.",
        duration: 6000,
      });
      resetSession();
      setLocation("/capture");
    }
  }, [resetSession, setLocation, toast]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void startActualRecording();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, startActualRecording]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setDuration((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Warn on tab close while recording — do not stop on SPA navigation
  useEffect(() => {
    if (phase !== "recording" && phase !== "countdown") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startCountdown = useCallback((nextMeta: NewNoteRecordingMeta) => {
    if (phase !== "idle") {
      toast({
        title: "Recording already in progress",
        description: "Stop or finish the current recording first.",
        variant: "destructive",
      });
      return;
    }
    setMeta(nextMeta);
    setConsentGiven(null);
    setStopConfirmationPending(false);
    setPhase("countdown");
    setCountdown(3);
  }, [phase, toast]);

  const cancelCountdown = useCallback(() => {
    setCountdown(null);
    setPhase("idle");
    setMeta(null);
  }, []);

  const handleConsentGiven = useCallback(async () => {
    setConsentGiven(true);
    setShowConsentModal(false);

    const consentBlob = await snapshotConsentSegment({
      mediaRecorder: mediaRecorderRef.current,
      audioChunks: audioChunksRef.current,
      mimeType: mediaRecorderRef.current?.mimeType || "audio/webm",
    });
    consentBlobRef.current = consentBlob;
    consentDurationSecondsRef.current = Math.max(1, durationRef.current);
  }, []);

  const handleConsentDeclined = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setConsentGiven(false);
    setShowConsentModal(false);
    await logAuditEvent({
      eventType: "consent_declined",
      metadata: { source: "new_note_page", fallback: "text_notes" },
      severity: "warning",
    });
    resetSession();
    toast({
      title: "Consent declined",
      description: "Recording discarded. You can capture text notes from Capture instead.",
      duration: 6000,
    });
    setLocation("/capture");
  }, [resetSession, setLocation, toast]);

  const saveRecording = useCallback(async () => {
    const snapshot = metaRef.current;
    if (!snapshot) return;

    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save this recording",
        variant: "destructive",
      });
      setPhase("recording");
      return;
    }

    // Wait briefly for MediaRecorder onstop to populate the blob
    await new Promise((resolve) => setTimeout(resolve, 150));

    setPhase("processing");
    setProcessingStep("saving");
    const advanceStep = createProcessingStepTimer(setProcessingStep);

    let consentLogFailed = false;

    try {
      let targetCaseId: string;
      let caseResult: CaseResponse | null = null;

      if (snapshot.noteMode === "add_session" && snapshot.selectedCaseId) {
        targetCaseId = snapshot.selectedCaseId;
      } else {
        if (!snapshot.clientId || !snapshot.clientName) {
          throw new Error("Client is required to save this recording");
        }
        caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
          title: snapshot.caseTitle,
          clientName: snapshot.clientName,
          clientId: snapshot.clientId,
          matterReference: snapshot.matterRef || undefined,
          sourceType: "audio",
          status: "pending",
          priority: "normal",
          riskLevel: snapshot.clientAmlRiskLevel || undefined,
          templateId: snapshot.templateId || undefined,
          practiceArea: snapshot.practiceArea || undefined,
          conflictCheckCompleted: snapshot.conflictCheckCompleted,
          conflictCheckNote: snapshot.conflictCheckNote || undefined,
          costsEstimate: snapshot.costsEstimate || undefined,
        });
        targetCaseId = caseResult.id;
      }

      const sessionResult = await apiRequest<{ id: string }>(
        "POST",
        `/api/cases/${targetCaseId}/sessions`,
        {
          recordingType: snapshot.recordingType,
          sessionTitle: snapshot.sessionLabel?.trim() || undefined,
        },
      );

      const audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
        caseId: targetCaseId,
        meetingSessionId: sessionResult.id,
      });

      await advanceStep("uploading");

      if (audioBlobRef.current) {
        const formData = new FormData();
        formData.append("audioFile", audioBlobRef.current, "recording.webm");
        formData.append("duration", String(durationRef.current));
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
      }

      if (consentGivenRef.current !== null) {
        try {
          await apiRequest("POST", "/api/consent", {
            caseId: targetCaseId,
            audioRecordingId: audioResult.id,
            consentGiven: consentGivenRef.current,
            consentModality: "verbal_recorded" as const,
            disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
            disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
            lawfulBasis: "consent" as const,
            recordingPurpose:
              "Creation of attendance notes and transcripts for legal record-keeping",
            source: "new_note_page",
          });
        } catch (consentError) {
          console.error("Consent log failed:", consentError);
          consentLogFailed = true;
          toast({
            title: "GDPR Compliance Error",
            description:
              "Failed to save consent record. Open the matter to complete consent logging.",
            variant: "destructive",
            duration: 10000,
            action: (
              <ToastAction
                altText="View case"
                onClick={() => setLocation(`/case/${targetCaseId}`)}
              >
                View Case
              </ToastAction>
            ),
          });
          resetSession();
          setLocation(`/case/${targetCaseId}`);
          return;
        }
      }

      if (!consentLogFailed) {
        await advanceStep("processing");
        apiRequest("POST", `/api/cases/${targetCaseId}/process`, {
          sessionId: sessionResult.id,
        })
          .then(() => {
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey[0] as string;
                return key?.startsWith("/api/cases");
              },
            });
          })
          .catch(() => {
            toast({
              title: "Recording saved — tap Process to generate documents",
              description:
                "The recording was saved but processing could not start automatically.",
              duration: 8000,
            });
          });
      }

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        },
      });

      toast({
        title:
          snapshot.noteMode === "add_session"
            ? "Session added successfully"
            : "Case created successfully",
        description: "Meeting-to-Matter™ Engine is preparing your documents.",
        duration: 6000,
        action: (
          <ToastAction
            altText="View case"
            onClick={() => setLocation(`/case/${targetCaseId}`)}
            data-testid="button-toast-view-case"
          >
            View Case
          </ToastAction>
        ),
      });

      await advanceStep("complete");
      await new Promise((resolve) => setTimeout(resolve, 500));
      resetSession();
      setLocation(`/case/${targetCaseId}`);
    } catch (error: any) {
      console.error("Failed to save New Note recording:", error);
      toast({
        title: "Error saving recording",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 8000,
      });
      // Keep blob so user can retry stop/save — return to recording UI
      setPhase("recording");
      setStopConfirmationPending(false);
    }
  }, [resetSession, setLocation, toast, user?.id]);

  const handleStopClick = useCallback(() => {
    if (!stopConfirmationPending) {
      setStopConfirmationPending(true);
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setStopConfirmationPending(false);
    setShowConsentModal(false);
    setPhase("processing");

    void logAuditEvent({
      eventType: "recording_stopped",
      metadata: {
        source: "new_note_page",
        durationSeconds: durationRef.current,
        consentSelectedDuringRecording: consentGivenRef.current,
        stoppedAt: new Date().toISOString(),
      },
      severity: "info",
    });

    void saveRecording();
  }, [saveRecording, stopConfirmationPending]);

  const value: NewNoteRecordingContextType = {
    phase,
    isActive,
    isRecording,
    countdown,
    duration,
    meta,
    startCountdown,
    cancelCountdown,
  };

  const statusLabel =
    phase === "countdown"
      ? "Starting"
      : phase === "processing"
        ? processingStep === "complete"
          ? "Ready"
          : processingStep === "processing"
            ? "Producing notes"
            : processingStep === "uploading"
              ? "Uploading"
              : "Saving"
        : "Recording";

  return (
    <NewNoteRecordingContext.Provider value={value}>
      {children}

      {isActive && (
        <RecordingControlCenter
          tone={
            phase === "countdown"
              ? "countdown"
              : phase === "processing"
                ? "processing"
                : stopConfirmationPending
                  ? "warning"
                  : "recording"
          }
          statusLabel={statusLabel}
          title={meta?.displayTitle || "Capture"}
          subtitle={
            meta?.displaySubtitle ||
            (phase === "processing"
              ? "Meeting-to-Matter in progress"
              : "Recording continues if you change pages")
          }
          countdown={countdown}
          elapsedSeconds={phase === "recording" ? duration : undefined}
          forceExpanded={stopConfirmationPending || phase === "countdown"}
          collapsible={phase === "recording"}
          safeguards={{ protected: phase === "recording" || phase === "countdown" }}
          data-testid="new-note-recording-control-center"
          actions={
            phase === "countdown" ? (
              <ControlCenterActionButton
                variant="outline"
                onClick={cancelCountdown}
                data-testid="button-cancel-countdown"
              >
                Cancel
              </ControlCenterActionButton>
            ) : phase === "recording" ? (
              <ControlCenterActionButton
                variant={stopConfirmationPending ? "confirm" : "destructive"}
                onClick={handleStopClick}
                data-testid="button-stop-recording"
              >
                <Square className="h-3.5 w-3.5" />
                {stopConfirmationPending ? "Confirm stop" : "Stop recording"}
              </ControlCenterActionButton>
            ) : undefined
          }
        />
      )}

      <ConsentModal
        open={showConsentModal}
        onConsentGiven={handleConsentGiven}
        onConsentDeclined={handleConsentDeclined}
      />
    </NewNoteRecordingContext.Provider>
  );
}
