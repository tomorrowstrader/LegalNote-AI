import { useState, useEffect, useRef } from "react";
import { toTitleCase } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import ConsentModal from "@/components/ConsentModal";
import MeetingToMatterProcessingOverlay, { type ProcessingStep } from "@/components/MeetingToMatterProcessingOverlay";
import TextNotesModal from "@/components/TextNotesModal";
import CaseTemplatesModal, { CaseTemplate } from "@/components/CaseTemplatesModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Mic, Square, AlertTriangle, LayoutTemplate, CheckCircle2, Shield, UserPlus, X, FolderPlus, FolderOpen } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAuditEvent } from "@/lib/auditLogger";
import type { Case, Client } from "@shared/schema";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";
import { PRACTICE_AREAS, PRACTICE_AREA_LABELS, type PracticeArea } from "@shared/schema";

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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [noteMode, setNoteMode] = useState<"new_matter" | "add_session">("new_matter");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [recordingType, setRecordingType] = useState<RecordingType>("full_meeting");
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const caseSearchRef = useRef<HTMLDivElement>(null);
  const [practiceArea, setPracticeArea] = useState<PracticeArea | "">("");
  const [conflictCheckCompleted, setConflictCheckCompleted] = useState(false);
  const [conflictCheckNote, setConflictCheckNote] = useState("");
  const [costsEstimate, setCostsEstimate] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("saving");

  const { data: clientSearchResults = [] } = useQuery<Client[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(clientSearchQuery)}`],
    enabled: clientSearchQuery.trim().length >= 2 && !selectedClient,
  });

  const { data: existingCases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const filteredCases = existingCases
    .filter((c) => c.status !== "withdrawn")
    .filter((c) => {
      if (!caseSearchQuery.trim()) return true;
      const q = caseSearchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.clientName && c.clientName.toLowerCase().includes(q)) ||
        (c.matterReference && c.matterReference.toLowerCase().includes(q))
      );
    });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
      if (caseSearchRef.current && !caseSearchRef.current.contains(e.target as Node)) {
        setShowCaseDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientName(client.name);
    setShowClientDropdown(false);
    setClientSearchQuery("");
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientName("");
    setClientSearchQuery("");
  };

  const handleClientInputChange = (value: string) => {
    setClientSearchQuery(value);
    setClientName(value);
    setSelectedClient(null);
    setShowClientDropdown(value.trim().length >= 2);
  };

  const createClientMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest<Client>("POST", "/api/clients", { name });
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      handleClientSelect(client);
      toast({
        title: "Client created",
        description: `${client.name} has been added to your client registry.`,
        duration: 4000,
      });
    },
  });
  
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
    if (noteMode === "new_matter") {
      if (!caseTitle.trim() || !selectedClient) {
        toast({
          title: "Missing information",
          description: !caseTitle.trim() ? "Please enter a case title" : "Please select or create a client",
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
    } else {
      if (!selectedCaseId) {
        toast({
          title: "Missing information",
          description: "Please select an existing matter",
          variant: "destructive",
        });
        return;
      }
    }
    setCountdown(3);
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

  const handleOpenMatter = async () => {
    if (!selectedClient) {
      toast({
        title: "Client required",
        description: "Please select or create a client",
        variant: "destructive",
      });
      return;
    }
    if (!caseTitle.trim()) {
      toast({
        title: "Case title required",
        description: "Please enter a case title",
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

    try {
      const caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
        title: caseTitle,
        clientName: selectedClient.name,
        clientId: selectedClient.id,
        matterReference: matterRef || undefined,
        sourceType: "text",
        status: "pending",
        priority: "normal",
        riskLevel: selectedClient.amlRiskLevel || undefined,
        templateId: activeTemplate?.id || undefined,
        practiceArea: practiceArea || undefined,
        conflictCheckCompleted,
        conflictCheckNote: conflictCheckNote || undefined,
        costsEstimate: costsEstimate || undefined,
      });

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        },
      });

      toast({
        title: "Matter opened",
        description: "The matter has been created. You can now join with LegalNote or add recordings later.",
        duration: 5000,
      });

      setLocation(`/case/${caseResult.id}`);
    } catch (error: any) {
      toast({
        title: "Error creating matter",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const saveCase = async () => {
    console.log('Saving case:', { noteMode, recordingType });
    
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }

    if (noteMode === "new_matter" && !selectedClient && recordingType !== "internal_meeting") {
      toast({
        title: "Client required",
        description: "Please select or create a client before saving",
        variant: "destructive",
      });
      return;
    }

    if (noteMode === "add_session" && !selectedCaseId) {
      toast({
        title: "Matter required",
        description: "Please select an existing matter to add a session",
        variant: "destructive",
      });
      return;
    }

    if (noteMode === "new_matter" && !practiceArea && recordingType !== "internal_meeting") {
      toast({
        title: "Practice area required",
        description: "Please select a practice area for this matter",
        variant: "destructive",
      });
      return;
    }

    if (noteMode === "new_matter" && recordingType !== "internal_meeting" && !conflictCheckCompleted && !conflictCheckNote.trim()) {
      toast({
        title: "Conflict check required",
        description: "Either confirm the conflict check or provide a reason for deferral",
        variant: "destructive",
      });
      return;
    }
    
    let caseResult: CaseResponse | null = null;
    let consentLogFailed = false;

    setIsProcessing(true);
    setProcessingStep("saving");
    
    try {
      let targetCaseId: string;

      if (noteMode === "add_session" && selectedCaseId) {
        targetCaseId = selectedCaseId;
        const selectedCase = existingCases.find(c => c.id === selectedCaseId);
        caseResult = selectedCase ? {
          id: selectedCase.id,
          title: selectedCase.title,
          clientName: selectedCase.clientName || "",
          matterReference: selectedCase.matterReference || undefined,
          status: selectedCase.status,
          priority: selectedCase.priority || "normal",
          sourceType: selectedCase.sourceType,
        } : null;
      } else {
        caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
          title: caseTitle,
          clientName: selectedClient!.name,
          clientId: selectedClient!.id,
          matterReference: matterRef || undefined,
          sourceType: "audio",
          status: "pending",
          priority: "normal",
          riskLevel: selectedClient!.amlRiskLevel || undefined,
          templateId: activeTemplate?.id || undefined,
          practiceArea: practiceArea || undefined,
          conflictCheckCompleted,
          conflictCheckNote: conflictCheckNote || undefined,
          costsEstimate: costsEstimate || undefined,
        });
        targetCaseId = caseResult.id;
      }

      const sessionResult = await apiRequest<{ id: string }>("POST", `/api/cases/${targetCaseId}/sessions`, {
        recordingType,
        sessionTitle: sessionLabel.trim() || undefined,
      });
      
      const audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
        caseId: targetCaseId,
        meetingSessionId: sessionResult.id,
      });
      
      setProcessingStep("uploading");

      if (audioBlobRef.current) {
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
      }
      
      if (consentGiven !== null) {
        try {
          const disclaimerWordingText = "I am recording this meeting for legal record purposes. This recording will be used to create attendance notes and transcripts. The audio will be retained for up to 7 days or until processing completes, whichever comes first. Do you consent to this recording?";

          const consentPayload = {
            caseId: targetCaseId,
            audioRecordingId: audioResult.id,
            consentGiven: consentGiven,
            consentModality: "verbal_recorded" as const,
            disclaimerScriptVersion: "v1.0",
            disclaimerWordingText,
            lawfulBasis: "consent" as const,
            recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
          };
          console.log('Saving consent log to backend...', consentPayload);
          await apiRequest("POST", "/api/consent", consentPayload);
          console.log('Consent log saved successfully');
        } catch (consentError: any) {
          console.error('Consent log failed:', consentError);
          console.error('Consent error details:', consentError?.message || consentError);
          consentLogFailed = true;
          setIsProcessing(false);
          
          toast({
            title: "GDPR Compliance Error",
            description: "Failed to save consent record. This case cannot be processed without proper consent logging.",
            variant: "destructive",
            duration: 10000,
          });
          
          return;
        }
      }

      if (!consentLogFailed) {
        setProcessingStep("processing");

        const processBody = noteMode === "add_session"
          ? { sessionId: sessionResult.id }
          : {};

        apiRequest("POST", `/api/cases/${targetCaseId}/process`, processBody)
          .then(() => {
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey[0] as string;
                return key?.startsWith("/api/cases");
              },
            });
          })
          .catch((processError: unknown) => {
            console.error('Failed to auto-trigger processing:', processError);
            toast({
              title: "Recording saved — tap Process to generate documents",
              description: "The recording was saved but processing could not start automatically.",
              duration: 8000,
            });
          });
      }
      
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        }
      });
      
      const savedCaseId = targetCaseId;
      
      toast({
        title: noteMode === "add_session" ? "Session added successfully" : "Case created successfully",
        description: "Meeting-to-Matter™ Engine is preparing your documents.",
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
      
      if (savedCaseId && !consentLogFailed) {
        setProcessingStep("complete");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setLocation(`/case/${savedCaseId}`);
        setIsProcessing(false);
        setProcessingStep("saving");
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingStep("saving");
      toast({
        title: "Error creating case",
        description: error.message || "Something went wrong",
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const saveTextNotes = async (data: { caseTitle: string; clientName: string; matterRef: string; notes: string }) => {
    console.log('Saving text-based case:', { contentLength: data.notes?.length ?? 0 });
    
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a case",
        variant: "destructive",
      });
      return;
    }

    let clientForCase = selectedClient;
    if (noteMode === "new_matter") {
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
    }

    if (noteMode === "add_session" && !selectedCaseId) {
      toast({
        title: "Matter required",
        description: "Please select an existing matter to add a session",
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
    
    const createTextCase = async () => {
      let targetCaseId: string;

      if (noteMode === "add_session" && selectedCaseId) {
        targetCaseId = selectedCaseId;
      } else {
        const caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
          title: data.caseTitle,
          clientName: clientForCase.name,
          clientId: clientForCase.id,
          matterReference: data.matterRef || undefined,
          sourceType: "text",
          status: "pending",
          priority: "normal",
          riskLevel: clientForCase.amlRiskLevel || undefined,
          notes: data.notes,
          templateId: activeTemplate?.id || undefined,
          practiceArea: practiceArea || undefined,
          conflictCheckCompleted,
          conflictCheckNote: conflictCheckNote || undefined,
          costsEstimate: costsEstimate || undefined,
        });
        targetCaseId = caseResult.id;
      }

      await apiRequest("POST", `/api/cases/${targetCaseId}/sessions`, {
        recordingType,
        sessionTitle: sessionLabel.trim() || undefined,
      });

      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/cases");
        }
      });

      toast({
        title: noteMode === "add_session" ? "Session added successfully" : "Case created successfully",
        description: noteMode === "add_session" ? "A new session has been added." : "Your text-based case has been saved.",
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

      setShowTextNotesModal(false);
      setLocation(`/case/${targetCaseId}`);
    };

    createTextCase().catch((error: any) => {
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
                Record client meeting with consent capture and automatic transcription powered by Meeting-to-Matter™
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
                      Pre-Meeting Checklist: Reviewed
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
              <CardTitle>Recording Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={noteMode}
                onValueChange={(v) => setNoteMode(v as "new_matter" | "add_session")}
                className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                disabled={isRecording || countdown !== null}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new_matter" id="mode-new" data-testid="radio-new-matter" />
                  <Label htmlFor="mode-new" className="flex items-center gap-1.5 cursor-pointer">
                    <FolderPlus className="w-4 h-4" />
                    New Matter
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="add_session" id="mode-add" data-testid="radio-add-session" />
                  <Label htmlFor="mode-add" className="flex items-center gap-1.5 cursor-pointer">
                    <FolderOpen className="w-4 h-4" />
                    Add Session to Existing Matter
                  </Label>
                </div>
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="recording-type">Type of Recording</Label>
                <Select
                  value={recordingType}
                  onValueChange={(v) => setRecordingType(v as RecordingType)}
                  disabled={isRecording || countdown !== null}
                >
                  <SelectTrigger id="recording-type" data-testid="select-recording-type">
                    <SelectValue placeholder="Select recording type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECORDING_TYPE_LABELS) as [RecordingType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value} data-testid={`option-recording-type-${value}`}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{noteMode === "add_session" ? "Select Existing Matter" : "Case Details"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {noteMode === "add_session" ? (
                <div className="space-y-2">
                  <Label htmlFor="existing-case">Existing Matter <span className="text-accent">*</span></Label>
                  <div ref={caseSearchRef} className="relative">
                    {selectedCaseId ? (
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                        <span className="text-sm font-medium flex-1 truncate" data-testid="text-selected-case">
                          {(() => {
                            const c = existingCases.find(c => c.id === selectedCaseId);
                            return c ? `${c.title} · ${c.clientName}${c.matterReference ? ` (${c.matterReference})` : ""}` : selectedCaseId;
                          })()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedCaseId(""); setCaseSearchQuery(""); }}
                          disabled={isRecording || countdown !== null}
                          data-testid="button-clear-case"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="existing-case"
                        placeholder="Search existing matters by title, client or reference..."
                        value={caseSearchQuery}
                        onChange={(e) => { setCaseSearchQuery(e.target.value); setShowCaseDropdown(true); }}
                        onFocus={() => setShowCaseDropdown(true)}
                        disabled={isRecording || countdown !== null}
                        data-testid="input-case-search"
                      />
                    )}
                    {showCaseDropdown && !selectedCaseId && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto" data-testid="dropdown-case-search">
                        {filteredCases.length > 0 ? (
                          filteredCases.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2"
                              onClick={() => { setSelectedCaseId(c.id); setShowCaseDropdown(false); setCaseSearchQuery(""); }}
                              data-testid={`option-case-${c.id}`}
                            >
                              <span className="truncate">{c.title} · {c.clientName}{c.matterReference ? ` (${c.matterReference})` : ""}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">{toTitleCase(c.status)}</Badge>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No matching matters</div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedCaseId && (
                    <p className="text-xs text-muted-foreground">
                      A new session will be added to this matter with the selected recording type.
                    </p>
                  )}
                </div>
              ) : null}

              {/* Session label — shown for both modes */}
              <div className="space-y-2">
                <Label htmlFor="session-label">Session Label <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="session-label"
                  placeholder="e.g. Bail hearing, Manchester Crown Court"
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  disabled={isRecording || countdown !== null}
                  data-testid="input-session-label"
                />
              </div>

              {noteMode === "new_matter" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="case-title">
                      Case Title <span className="text-accent">*</span>
                    </Label>
                    <Input
                      id="case-title"
                      placeholder={recordingType === "internal_meeting" ? "e.g., Firm strategy meeting, Team update" : "e.g., Estate Planning Consultation"}
                      value={caseTitle}
                      onChange={(e) => setCaseTitle(e.target.value)}
                      disabled={isRecording || countdown !== null}
                      data-testid="input-case-title"
                    />
                    {recordingType === "internal_meeting" && (
                      <p className="text-xs text-muted-foreground">
                        Internal meeting — no client, billing, or AML prompts will be generated.
                      </p>
                    )}
                  </div>
                  {recordingType !== "internal_meeting" && (<div className="space-y-2">
                    <Label htmlFor="client-name">
                      Client Name <span className="text-accent">*</span>
                    </Label>
                    <div ref={clientSearchRef} className="relative">
                      {selectedClient ? (
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                          <span className="text-sm font-medium flex-1 truncate" data-testid="text-selected-client">
                            {selectedClient.name}
                          </span>
                          {selectedClient.amlRiskLevel && (
                            <Badge variant={selectedClient.amlRiskLevel === "high" ? "destructive" : selectedClient.amlRiskLevel === "medium" ? "secondary" : "outline"} className="text-xs shrink-0">
                              <Shield className="w-3 h-3 mr-1" />
                              {selectedClient.amlRiskLevel.toUpperCase()}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearClient}
                            disabled={isRecording || countdown !== null}
                            data-testid="button-clear-client"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Input
                          id="client-name"
                          placeholder="Search existing clients or type a new name..."
                          value={clientName}
                          onChange={(e) => handleClientInputChange(e.target.value)}
                          onFocus={() => { if (clientSearchQuery.trim().length >= 2) setShowClientDropdown(true); }}
                          disabled={isRecording || countdown !== null}
                          data-testid="input-client-name"
                        />
                      )}
                      {showClientDropdown && !selectedClient && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto" data-testid="dropdown-client-search">
                          {clientSearchResults.length > 0 ? (
                            clientSearchResults.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2"
                                onClick={() => handleClientSelect(c)}
                                data-testid={`option-client-${c.id}`}
                              >
                                <span className="truncate">{c.name}</span>
                                {c.amlRiskLevel && (
                                  <Badge variant={c.amlRiskLevel === "high" ? "destructive" : c.amlRiskLevel === "medium" ? "secondary" : "outline"} className="text-xs shrink-0">
                                    {c.amlRiskLevel.toUpperCase()}
                                  </Badge>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No matching clients</div>
                          )}
                          {clientName.trim().length >= 2 && (
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2 border-t"
                              onClick={() => createClientMutation.mutate(clientName.trim())}
                              disabled={createClientMutation.isPending}
                              data-testid="button-create-client-inline"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>{createClientMutation.isPending ? "Creating..." : `Create "${clientName.trim()}" as new client`}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedClient?.amlRiskLevel && (
                      <Alert className="mt-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" data-testid="alert-client-risk-continuity">
                        <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                          This client is assessed as <span className="font-semibold">{selectedClient.amlRiskLevel.toUpperCase()} risk</span>. This risk level will be applied to the new matter.{" "}
                          <a
                            href={`/clients/${selectedClient.id}`}
                            className="underline font-medium text-amber-700 dark:text-amber-300"
                            data-testid="link-review-prior-aml"
                          >
                            View client profile
                          </a>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>)}
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
                  {recordingType !== "internal_meeting" && (<><div className="space-y-2">
                    <Label htmlFor="practice-area">Practice Area <span className="text-red-500">*</span></Label>
                    <Select
                      value={practiceArea}
                      onValueChange={(val) => setPracticeArea(val as PracticeArea)}
                      disabled={isRecording || countdown !== null}
                    >
                      <SelectTrigger id="practice-area" data-testid="select-practice-area">
                        <SelectValue placeholder="Select practice area..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PRACTICE_AREAS.map((pa) => (
                          <SelectItem key={pa} value={pa} data-testid={`option-practice-area-${pa}`}>
                            {PRACTICE_AREA_LABELS[pa]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {practiceArea && (practiceArea === "residential_conveyancing" || practiceArea === "commercial_property") && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        This practice area is classified as HIGH AML risk by default.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costs-estimate">Costs Estimate (Optional)</Label>
                    <Input
                      id="costs-estimate"
                      placeholder="e.g., £1,500 – £3,000 plus VAT and disbursements"
                      value={costsEstimate}
                      onChange={(e) => setCostsEstimate(e.target.value)}
                      disabled={isRecording || countdown !== null}
                      data-testid="input-costs-estimate"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in the client care letter.
                    </p>
                  </div></>)}
                </>
              ) : null}
            </CardContent>
          </Card>

          {noteMode === "new_matter" && recordingType !== "internal_meeting" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Conflict of Interest Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="conflict-check"
                  checked={conflictCheckCompleted}
                  onCheckedChange={(checked) => {
                    setConflictCheckCompleted(checked === true);
                    if (checked) setConflictCheckNote("");
                  }}
                  disabled={isRecording || countdown !== null}
                  data-testid="checkbox-conflict-check"
                />
                <div className="space-y-1">
                  <Label htmlFor="conflict-check" className="text-sm font-medium cursor-pointer">
                    I confirm that a conflict of interest check has been completed for this matter
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    SRA compliance requires a conflict check before accepting new instructions. This confirmation is recorded in the audit trail.
                  </p>
                </div>
              </div>
              {!conflictCheckCompleted && (
                <div className="space-y-2 pl-7">
                  <Label htmlFor="conflict-note" className="text-xs text-amber-600 dark:text-amber-400">
                    If deferring the conflict check, provide a reason:
                  </Label>
                  <Textarea
                    id="conflict-note"
                    placeholder="e.g., Conflict check to be completed by compliance team before first meeting"
                    value={conflictCheckNote}
                    onChange={(e) => setConflictCheckNote(e.target.value)}
                    disabled={isRecording || countdown !== null}
                    className="text-sm"
                    data-testid="input-conflict-note"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          )}

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
                <div className="space-y-3">
                  <Button
                    onClick={initiateRecording}
                    className="w-full gap-2"
                    size="lg"
                    data-testid="button-start-recording"
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording with Consent Capture
                  </Button>
                  {noteMode === "new_matter" && (
                    <Button
                      variant="outline"
                      onClick={handleOpenMatter}
                      className="w-full gap-2"
                      size="lg"
                      data-testid="button-open-matter"
                    >
                      <FolderOpen className="w-5 h-5" />
                      Open Matter without Recording
                    </Button>
                  )}
                </div>
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

      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          data-testid="dialog-new-note-processing"
        >
          <MeetingToMatterProcessingOverlay processingStep={processingStep} />
        </DialogContent>
      </Dialog>

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
              I've Reviewed This. Proceed
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
