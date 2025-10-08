import { useState, useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ConsentModal from "@/components/ConsentModal";
import TextNotesModal from "@/components/TextNotesModal";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
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
    onSuccess: () => {
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

  const initiateRecording = () => {
    setCountdown(3); // 3-second countdown
  };

  const cancelCountdown = () => {
    setCountdown(null);
  };

  const handleConsentGiven = () => {
    console.log('Client consent given - recording continues');
    setConsentGiven(true);
    setShowConsentModal(false);
    // Recording continues
  };

  const handleConsentDeclined = () => {
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
  };
  
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stopRecording = () => {
    console.log('Quick recording stopped');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setShowMetadataModal(true);
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
    
    try {
      const caseResult = await apiRequest<CaseResponse>("POST", "/api/cases", {
        title: caseTitle,
        clientName: clientName,
        matterReference: matterRef || undefined,
        sourceType: "audio",
        status: "pending",
        priority: "normal",
      });
      
      const audioResult = await apiRequest<AudioResponse>("POST", "/api/audio", {
        caseId: caseResult.id,
      });
      
      if (audioBlobRef.current) {
        const fileName = `recording-${Date.now()}.webm`;
        let uploadURL = '';
        
        // Create Uppy instance inline - no refs, no cleanup needed
        const uppy = new Uppy({
          restrictions: {
            maxNumberOfFiles: 1,
            allowedFileTypes: ['audio/*'],
          },
        });
        
        uppy.use(AwsS3, {
          shouldUseMultipart: false,
          getUploadParameters: async (file) => {
            const response = await fetch('/api/audio/upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error('Failed to get presigned URL');
            }
            
            const data = await response.json();
            // Store the upload URL (without query params for accessing the file)
            uploadURL = data.uploadURL.split('?')[0];
            
            return {
              method: 'PUT' as const,
              url: data.uploadURL,
              headers: {
                'Content-Type': file.type || 'audio/webm',
              },
            };
          },
        });
        
        uppy.addFile({
          name: fileName,
          type: 'audio/webm',
          data: audioBlobRef.current,
        });
        
        await uppy.upload();
        
        // Use the stored upload URL
        if (uploadURL) {
          await apiRequest("PUT", `/api/audio/${audioResult.id}`, {
            audioURL: uploadURL,
            duration: recordingDuration,
          });
        }
        
        // No cleanup needed - let garbage collector handle it
      }
      
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
      });
      
      setShowMetadataModal(false);
      setRecordingDuration(0);
      setCaseTitle("");
      setClientName("");
      setMatterRef("");
      audioBlobRef.current = null;
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-destructive/20 rounded-full px-3 py-1 animate-pulse">
          <span className="text-sm font-semibold text-destructive" data-testid="text-countdown">
            Recording in {countdown}...
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelCountdown}
          className="text-primary-foreground"
          data-testid="button-cancel-countdown"
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <>
        <div className="flex items-center gap-3 bg-card/50 rounded-lg px-3 py-1">
          <Badge className="bg-destructive animate-pulse" data-testid="badge-quick-recording">
            Recording
          </Badge>
          <p className="text-sm font-mono font-semibold text-primary-foreground" data-testid="text-quick-duration">
            {formatDuration(recordingDuration)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={stopRecording}
            className="gap-1 text-primary-foreground h-7"
            data-testid="button-stop-quick-record"
          >
            <Square className="w-3 h-3" />
            Stop
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
    </>
  );
}
