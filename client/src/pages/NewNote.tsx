import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
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
import ConsentModal from "@/components/ConsentModal";
import TextNotesModal from "@/components/TextNotesModal";
import CaseTemplatesModal, { CaseTemplate } from "@/components/CaseTemplatesModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mic, Square, AlertTriangle, LayoutTemplate, CheckCircle2, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAuditEvent } from "@/lib/auditLogger";
import type { Case } from "@shared/schema";

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

export default function NewNote() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showTextNotesModal, setShowTextNotesModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<CaseTemplate | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<CaseTemplate | null>(null);
  const [checklistAcknowledged, setChecklistAcknowledged] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const { data: existingCases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: !!user?.complianceThread,
  });

  const clientRiskMatch = useMemo(() => {
    if (!user?.complianceThread || !clientName.trim() || clientName.trim().length < 3) return null;
    const normalised = clientName.trim().toLowerCase();
    return existingCases.find(
      (c) => c.clientName?.toLowerCase().trim() === normalised && c.id !== undefined
    ) || null;
  }, [clientName, existingCases, user?.complianceThread]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

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
        metadata: { source: "new_note_page" },
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
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const initiateRecording = () => {
    if (!caseTitle.trim() || !clientName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter case title and client name",
        variant: "destructive",
      });
      return;
    }
    setCountdown(3); // 3-second countdown
  };

  const cancelCountdown = () => {
    setCountdown(null);
  };

  const handleConsentGiven = async () => {
    console.log('Client consent given - recording continues');
    setConsentGiven(true);
    setShowConsentModal(false);
    
    // Log consent given event
    await logAuditEvent({
      eventType: "consent_given",
      metadata: { 
        source: "new_note_page",
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
        source: "new_note_page",
        fallback: "text_notes",
      },
      severity: "warning",
    });
  };

  const handleStopClick = () => {
    setShowStopConfirmation(true);
  };

  const confirmStopRecording = () => {
    console.log('Recording stopped');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setShowStopConfirmation(false);
    saveCase();
  };

  const cancelStopRecording = () => {
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
    
    try {
      // Step 1: Create case
      caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
        title: caseTitle,
        clientName: clientName,
        matterReference: matterRef || undefined,
        sourceType: "audio",
        status: "pending",
        priority: "normal",
        templateId: activeTemplate?.id || undefined,
      });
      
      // Step 2: Create audio record placeholder
      const audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
        caseId: caseResult.id,
      });
      
      // Step 3: Upload audio file
      if (audioBlobRef.current) {
        console.log('Uploading audio file via multipart...');
        
        // Create FormData for multipart upload (industry standard)
        const formData = new FormData();
        formData.append('audioFile', audioBlobRef.current, 'recording.webm');
        formData.append('duration', recordingDuration.toString());
        
        // Upload using native fetch (FormData automatically sets multipart/form-data)
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
          
          // Show critical error - don't navigate away
          toast({
            title: "GDPR Compliance Error",
            description: "Failed to save consent record. This case cannot be processed without proper consent logging.",
            variant: "destructive",
            duration: 10000,
          });
          
          // Don't navigate - let user retry or contact support
          return;
        }
      }
      
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        }
      });
      
      // Capture caseId for toast action and navigation
      const savedCaseId = caseResult?.id;
      
      toast({
        title: "Case created successfully",
        description: consentLogFailed 
          ? "Case saved but consent logging had issues. Please check before processing." 
          : "Your case has been saved and is ready for processing.",
        duration: 6000,
        action: savedCaseId ? (
          <ToastAction 
            altText="View case" 
            onClick={() => setLocation(`/case/${savedCaseId}`)}
            data-testid="button-toast-view-case"
          >
            View Case
          </ToastAction>
        ) : undefined,
      });
      
      // Navigate to the case detail page
      if (savedCaseId) {
        setLocation(`/case/${savedCaseId}`);
      }
    } catch (error: any) {
      toast({
        title: "Error creating case",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 8000,
      });
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
    
    apiRequest<CaseResponse>("POST", "/api/cases", {
      title: data.caseTitle,
      clientName: data.clientName,
      matterReference: data.matterRef || undefined,
      sourceType: "text",
      status: "pending",
      priority: "normal",
      notes: data.notes,
      templateId: activeTemplate?.id || undefined,
    })
      .then((caseResult) => {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.startsWith("/api/cases");
          }
        });
        
        toast({
          title: "Case created successfully",
          description: "Your text-based case has been saved.",
          duration: 6000,
          action: (
            <ToastAction 
              altText="View case" 
              onClick={() => setLocation(`/case/${caseResult.id}`)}
              data-testid="button-toast-view-case"
            >
              View Case
            </ToastAction>
          ),
        });
        
        setShowTextNotesModal(false);
        setLocation(`/case/${caseResult.id}`);
      })
      .catch((error: any) => {
        toast({
          title: "Error creating case",
          description: error.message || "Something went wrong",
          variant: "destructive",
          duration: 8000,
        });
      });
  };

  const handleTemplateSelect = (template: CaseTemplate) => {
    setShowTemplatesModal(false);
    if (template.preMeetingChecklist && template.preMeetingChecklist.length > 0) {
      setPendingTemplate(template);
      setChecklistAcknowledged(false);
    } else {
      applyTemplate(template);
    }
  };

  const applyTemplate = (template: CaseTemplate) => {
    setActiveTemplate(template);
    setChecklistAcknowledged(true);
    setPendingTemplate(null);
    if (!caseTitle.trim()) {
      setCaseTitle(template.name);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Create New Note</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Record client meeting with consent capture and automatic transcription powered by Meeting-to-Matter™ AI
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowTemplatesModal(true)}
              disabled={isRecording || countdown !== null}
              className="gap-2 shrink-0"
              data-testid="button-use-template"
            >
              <LayoutTemplate className="w-4 h-4" />
              Use Template
            </Button>
          </div>

          {activeTemplate && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/30">
                <LayoutTemplate className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm text-foreground font-medium">Template: {activeTemplate.name}</span>
                <Badge variant="secondary" className="text-xs">{activeTemplate.practiceArea}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs text-muted-foreground"
                  onClick={() => { setActiveTemplate(null); setChecklistAcknowledged(false); }}
                >
                  Remove
                </Button>
              </div>

              {checklistAcknowledged && activeTemplate.preMeetingChecklist && activeTemplate.preMeetingChecklist.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Pre-Meeting Checklist — Reviewed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      Cover these points during the meeting:
                    </p>
                    <ul className="space-y-2">
                      {activeTemplate.preMeetingChecklist.map((item, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-accent/60 font-medium shrink-0">{index + 1}.</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Case Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="case-title">
                  Case Title <span className="text-accent">*</span>
                </Label>
                <Input
                  id="case-title"
                  placeholder="e.g., Estate Planning Consultation"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  disabled={isRecording || countdown !== null}
                  data-testid="input-case-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">
                  Client Name <span className="text-accent">*</span>
                </Label>
                <Input
                  id="client-name"
                  placeholder="e.g., Mrs. Catherine Williams"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={isRecording || countdown !== null}
                  data-testid="input-client-name"
                />
                {clientRiskMatch && (
                  <Alert className="mt-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" data-testid="alert-client-risk-continuity">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      {clientRiskMatch.riskLevel
                        ? <>This client has an existing matter rated <span className="font-semibold">{(clientRiskMatch.riskLevel as string).toUpperCase()} risk</span>. Previous risk assessments may apply to this new matter.{" "}</>
                        : <>This client has existing matters with AML history. Review prior records before proceeding.{" "}</>
                      }
                      <a
                        href={`/case/${clientRiskMatch.id}`}
                        className="underline font-medium text-amber-700 dark:text-amber-300"
                        data-testid="link-review-prior-aml"
                      >
                        Review prior AML records
                      </a>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="matter-ref">Matter Reference (Optional)</Label>
                <Input
                  id="matter-ref"
                  placeholder="e.g., MAT-2025-001"
                  value={matterRef}
                  onChange={(e) => setMatterRef(e.target.value)}
                  disabled={isRecording || countdown !== null}
                  data-testid="input-matter-ref"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audio Recording with Consent Capture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-md space-y-3">
                <p className="text-sm text-muted-foreground">
                  The recording will begin with a 3-second countdown. You will then read the consent
                  disclaimer to your client, and they will verbally confirm their consent on the recording.
                  This ensures GDPR compliance with full audit trail.
                </p>
              </div>

              {countdown !== null && (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div className="text-7xl font-bold text-primary">
                    {countdown}
                  </div>
                  <p className="text-muted-foreground">Recording starts in...</p>
                  <Button 
                    variant="outline" 
                    onClick={cancelCountdown}
                    data-testid="button-cancel-countdown"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {isRecording && (
                <div className="flex flex-col items-center gap-4 p-6 bg-destructive/10 rounded-md border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Recording in Progress</span>
                  </div>
                  <Badge variant="outline" className="text-lg">
                    {formatDuration(recordingDuration)}
                  </Badge>
                  <Button
                    onClick={handleStopClick}
                    variant="destructive"
                    className="gap-2"
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4" />
                    Stop Recording
                  </Button>
                </div>
              )}

              {!isRecording && countdown === null && (
                <Button
                  onClick={initiateRecording}
                  className="w-full gap-2"
                  size="lg"
                  data-testid="button-start-recording"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording with Consent Capture
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConsentModal
        open={showConsentModal}
        onConsentGiven={handleConsentGiven}
        onConsentDeclined={handleConsentDeclined}
      />

      <TextNotesModal
        open={showTextNotesModal}
        onClose={() => setShowTextNotesModal(false)}
        onSave={saveTextNotes}
      />

      <CaseTemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
        onSelect={handleTemplateSelect}
      />

      <AlertDialog
        open={!!pendingTemplate}
        onOpenChange={(open) => { if (!open) setPendingTemplate(null); }}
      >
        <AlertDialogContent data-testid="dialog-pre-meeting-checklist">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              Pre-Meeting Checklist
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  Review these points before starting the recording. Ensure you cover each item during the meeting:
                </p>
                <ul className="space-y-2">
                  {pendingTemplate?.preMeetingChecklist?.map((item, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-accent font-medium shrink-0">{index + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingTemplate(null)}
              data-testid="button-checklist-cancel"
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingTemplate) applyTemplate(pendingTemplate); }}
              data-testid="button-checklist-acknowledge"
            >
              I've Reviewed This — Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showStopConfirmation} onOpenChange={setShowStopConfirmation}>
        <AlertDialogContent data-testid="dialog-stop-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Stop Recording?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the recording? This action will finalize the audio capture and save the case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelStopRecording} data-testid="button-cancel-stop">
              Continue Recording
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopRecording} data-testid="button-confirm-stop">
              Stop Recording
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
