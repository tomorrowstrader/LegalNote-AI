import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConsentModal from "@/components/ConsentModal";
import { Mic, Square, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";

interface NewSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
}

export default function NewSessionModal({ open, onOpenChange, caseId, caseTitle }: NewSessionModalProps) {
  const { toast } = useToast();
  const [recordingType, setRecordingType] = useState<RecordingType>("full_meeting");
  const [sessionLabel, setSessionLabel] = useState("");
  const [step, setStep] = useState<"setup" | "countdown" | "recording" | "saving">("setup");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("setup");
      setCountdown(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setSessionLabel("");
      setConsentGiven(null);
      audioBlobRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      startActualRecording();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startActualRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = audioBlob;
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setShowConsentModal(true);
      setIsRecording(true);
      setRecordingDuration(0);
      setStep("recording");
      await logAuditEvent({
        eventType: "recording_started",
        metadata: { source: "case_detail_new_session_modal", caseId },
        severity: "info",
      });
    } catch (error) {
      toast({
        title: "Recording not available",
        description: "Microphone access failed.",
        duration: 6000,
      });
      onOpenChange(false);
    }
  };

  const handleConsentGiven = async () => {
    setConsentGiven(true);
    setShowConsentModal(false);
    await logAuditEvent({
      eventType: "consent_given",
      metadata: { source: "case_detail_new_session_modal", consentModality: "verbal_recorded" },
      severity: "warning",
    });
  };

  const handleConsentDeclined = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setConsentGiven(false);
    setShowConsentModal(false);
    setIsRecording(false);
    setRecordingDuration(0);
    audioBlobRef.current = null;
    await logAuditEvent({
      eventType: "consent_declined",
      metadata: { source: "case_detail_new_session_modal" },
      severity: "warning",
    });
    onOpenChange(false);
    toast({
      title: "Recording cancelled",
      description: "Client declined consent — session not recorded.",
      duration: 5000,
    });
  };

  const stopAndSave = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setStep("saving");

    try {
      const sessionResult = await apiRequest<{ id: string }>("POST", `/api/cases/${caseId}/sessions`, {
        recordingType,
        sessionTitle: sessionLabel.trim() || undefined,
      });

      const audioResult = await apiRequest<{ id: string }>("POST", "/api/audio", {
        caseId,
        meetingSessionId: sessionResult.id,
      });

      if (audioBlobRef.current) {
        const formData = new FormData();
        formData.append("audioFile", audioBlobRef.current, "recording.webm");
        formData.append("duration", recordingDuration.toString());
        const response = await fetch(`/api/audio/${audioResult.id}/upload`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }
      }

      if (consentGiven !== null) {
        await apiRequest("POST", "/api/consent", {
          caseId,
          audioRecordingId: audioResult.id,
          consentGiven,
          consentModality: "verbal_recorded",
          disclaimerScriptVersion: "v1.0",
        });
      }

      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/sessions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });

      toast({
        title: "Session saved",
        description: "The new session has been added to this matter.",
        duration: 5000,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving session",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 8000,
      });
      setStep("recording");
      setIsRecording(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => {
        if (!isRecording && step !== "saving") onOpenChange(o);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record New Session</DialogTitle>
            <p className="text-sm text-muted-foreground">{caseTitle}</p>
          </DialogHeader>

          {step === "setup" && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="modal-recording-type">Type of Recording</Label>
                <Select value={recordingType} onValueChange={(v) => setRecordingType(v as RecordingType)}>
                  <SelectTrigger id="modal-recording-type" data-testid="select-modal-recording-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECORDING_TYPE_LABELS) as [RecordingType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-session-label">Session Label <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="modal-session-label"
                  placeholder="e.g. Bail hearing, Manchester Crown Court"
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  data-testid="input-modal-session-label"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setStep("countdown");
                  setCountdown(3);
                }}
                data-testid="button-modal-start-recording"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </Button>
            </div>
          )}

          {step === "countdown" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-7xl font-bold text-primary">{countdown}</div>
              <p className="text-muted-foreground text-sm">Recording starts in...</p>
              <Button variant="outline" onClick={() => { setCountdown(null); setStep("setup"); }} data-testid="button-modal-cancel-countdown">
                Cancel
              </Button>
            </div>
          )}

          {step === "recording" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording in Progress</span>
              </div>
              <Badge variant="outline" className="text-lg">
                {formatDuration(recordingDuration)}
              </Badge>
              {sessionLabel && (
                <p className="text-sm text-muted-foreground">{sessionLabel}</p>
              )}
              <Button onClick={stopAndSave} variant="destructive" className="gap-2" data-testid="button-modal-stop-recording">
                <Square className="w-4 h-4" />
                Stop and Save
              </Button>
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Saving session...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConsentModal
        open={showConsentModal}
        onConsentGiven={handleConsentGiven}
        onConsentDeclined={handleConsentDeclined}
      />
    </>
  );
}
