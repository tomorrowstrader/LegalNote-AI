import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Phone, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAuditEvent } from "@/lib/auditLogger";
import { useLocation } from "wouter";

interface LogCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
}

export default function LogCallModal({ open, onOpenChange, caseId, caseTitle, clientName, matterReference }: LogCallModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      await logAuditEvent({
        eventType: "recording_started",
        metadata: { source: "log_call", caseId },
        severity: "info",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Microphone not available",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopAndSave = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    if (!user?.id) return;

    setIsSaving(true);

    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      const originalOnStop = recorder.onstop;
      recorder.onstop = (e) => {
        if (originalOnStop && typeof originalOnStop === 'function') {
          (originalOnStop as (this: MediaRecorder, ev: Event) => void).call(recorder, e);
        }
        resolve();
      };
      recorder.stop();
    });

    setIsRecording(false);

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    try {
      setProcessingStep("Creating telephone attendance case...");
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const dictationCase = await apiRequest<{ id: string }>("POST", "/api/cases", {
        title: `Telephone Attendance — ${clientName} — ${dateStr}`,
        clientName,
        matterReference: matterReference || "",
        sourceType: "dictation",
        parentCaseId: caseId,
        priority: "normal",
      });

      setProcessingStep("Creating audio record...");
      const audioResult = await apiRequest<{ id: string }>("POST", "/api/audio", {
        caseId: dictationCase.id,
      });

      setProcessingStep("Uploading dictation...");
      const formData = new FormData();
      formData.append('audioFile', audioBlob, 'call-dictation.webm');
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

      setProcessingStep("Starting AI processing...");
      await apiRequest("POST", `/api/cases/${dictationCase.id}/process`);

      await logAuditEvent({
        eventType: "case_created",
        metadata: { source: "phone_call_dictation", dictationCaseId: dictationCase.id, parentCaseId: caseId, duration: recordingDuration },
        severity: "info",
      });

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases") || key?.startsWith("/api/audio");
        }
      });

      toast({
        title: "Telephone attendance note processing",
        description: "Your dictation is being transcribed and processed into an attendance note.",
      });

      onOpenChange(false);
      setLocation(`/case/${dictationCase.id}`);
    } catch (error: any) {
      toast({
        title: "Failed to save dictation",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setProcessingStep(null);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-log-call">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Log a Phone Call
          </DialogTitle>
          <DialogDescription>
            Dictate your telephone attendance note for {clientName} — {caseTitle}.
            No client consent is required as you are recording your own recollection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {matterReference && (
            <div className="text-xs text-muted-foreground">
              Matter ref: {matterReference}
            </div>
          )}

          <div className="p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Speak your summary of the call now, while details are fresh. Include who you
              spoke to, what was discussed, any advice given, and agreed next steps.
            </p>
          </div>

          {processingStep ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{processingStep}</span>
            </div>
          ) : isRecording ? (
            <div className="flex flex-col items-center gap-4 p-6 bg-destructive/10 rounded-md border border-destructive/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium">Dictating</span>
              </div>
              <Badge variant="outline" className="text-lg" data-testid="badge-call-duration">
                {formatDuration(recordingDuration)}
              </Badge>
              <Button
                onClick={stopAndSave}
                variant="destructive"
                className="gap-2"
                disabled={isSaving}
                data-testid="button-stop-call-recording"
              >
                <Square className="w-4 h-4" />
                {isSaving ? "Saving..." : "Stop & Save"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={startRecording}
              className="w-full gap-2"
              size="lg"
              data-testid="button-start-call-recording"
            >
              <Mic className="w-5 h-5" />
              Start Dictation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
