import { useState, useEffect, useRef } from "react";
import { Mic, Square, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import ConsentModal from "@/components/ConsentModal";
import TextNotesModal from "@/components/TextNotesModal";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { logAuditEvent } from "@/lib/auditLogger";

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

export default function QuickRecordButton() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showTextNotesModal, setShowTextNotesModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

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
        duration: 6000, // 6 seconds for success messages
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
        duration: 8000, // 8 seconds for error messages
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setShowConsentModal(true);
      setIsRecording(true);
      setRecordingDuration(0);

      // Log recording started event
      await logAuditEvent({
        eventType: "recording_started",
        metadata: { source: "quick_record_button" },
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

    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    console.log('showStopConfirmation changed to:', showStopConfirmation);
  }, [showStopConfirmation]);

  useEffect(() => {
    console.log('showConsentModal changed to:', showConsentModal);
  }, [showConsentModal]);

  const initiateRecording = () => {
    setCountdown(3); // 3-second countdown
  };

  const cancelCountdown = () => {
    setCountdown(null);
  };

  const handleConsentGiven = async () => {
    console.log('Client consent given - recording continues');
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
    console.log('Client consent declined - stopping recording');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setConsentGiven(false);
    setShowConsentModal(false);
    setIsRecording(false);
    setRecordingDuration(0);
    audioBlobRef.current = null;
    setShowTextNotesModal(true);

    // Log consent declined event
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

  const handleStopClick = () => {
    console.log('Stop button clicked - opening confirmation dialog');
    setShowStopConfirmation(true);
  };

  const confirmStopRecording = () => {
    console.log('Confirm stop recording - user confirmed');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setShowStopConfirmation(false);
    setShowMetadataModal(true);
  };

  const cancelStopRecording = () => {
    console.log('Cancel stop recording - user wants to continue recording');
    setShowStopConfirmation(false);
  };

  const saveCase = async () => {
    console.log('Saving case:', { caseTitle, clientName, matterRef });
    
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }
    
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
      
      // Step 3: Upload audio file
      if (audioBlobRef.current) {
        try {
          console.log('Uploading audio file via multipart...');
          
          const formData = new FormData();
          formData.append('audioFile', audioBlobRef.current, 'recording.webm');
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
          
          console.log('Audio upload completed successfully');
        } catch (uploadError: any) {
          console.error('Audio upload failed:', uploadError);
          uploadFailed = true;
          throw uploadError; // Re-throw to prevent further processing
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
          console.log('Saving consent log to backend...', consentPayload);
          await apiRequest("POST", "/api/consent", consentPayload);
          console.log('Consent log saved successfully');
        } catch (consentError: any) {
          console.error('Consent log failed:', consentError);
          console.error('Consent error details:', consentError?.message || consentError);
          consentLogFailed = true;
          // Don't throw - allow processing to continue but mark as failed
        }
      }
      
      // Step 5: Trigger AI processing (transcription + document generation)
      // Critical: Only trigger if consent was successfully logged (GDPR requirement)
      if (consentLogFailed) {
        console.log('Skipping AI processing: consent log failed (GDPR requirement)');
        // AI processing will not be triggered - user must retry from case detail page
      } else {
        console.log('Triggering AI processing...');
        
        // Trigger processing asynchronously (don't wait for completion)
        apiRequest("POST", `/api/cases/${caseResult.id}/process`, {})
          .then(() => {
            console.log('AI processing completed successfully');
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
          // Success
          toast({
            title: "Case created successfully",
            description: "Your case has been saved. AI processing is underway.",
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
        setShowMetadataModal(false);
        setRecordingDuration(0);
        setCaseTitle("");
        setClientName("");
        setMatterRef("");
        audioBlobRef.current = null;
        setConsentGiven(null);
      }
    } catch (error: any) {
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
    console.log('Saving text-based case:', data);
    
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
          <span className="text-xs sm:text-sm font-semibold text-destructive whitespace-nowrap" data-testid="text-countdown">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopClick}
            className="gap-1 text-primary-foreground h-7 px-2"
            data-testid="button-stop-quick-record"
          >
            <Square className="w-3 h-3" />
            <span className="hidden sm:inline">Stop</span>
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

      <Dialog open={showMetadataModal} onOpenChange={setShowMetadataModal}>
        <DialogContent data-testid="dialog-metadata">
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
        </DialogContent>
      </Dialog>

      <TextNotesModal
        open={showTextNotesModal}
        onClose={() => setShowTextNotesModal(false)}
        onSave={saveTextNotes}
      />

      <AlertDialog open={showStopConfirmation} onOpenChange={(open) => {
        console.log('AlertDialog onOpenChange:', open, 'showStopConfirmation:', showStopConfirmation);
        setShowStopConfirmation(open);
      }}>
        <AlertDialogContent data-testid="dialog-stop-confirmation-quick" className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Stop Recording?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the recording? This will end the audio capture and you'll be prompted to add case details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelStopRecording} data-testid="button-cancel-stop-quick">
              Continue Recording
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopRecording} data-testid="button-confirm-stop-quick">
              Stop Recording
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
