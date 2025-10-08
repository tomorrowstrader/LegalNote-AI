import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ConsentModal from "@/components/ConsentModal";
import TextNotesModal from "@/components/TextNotesModal";
import { ArrowLeft, Mic, Square } from "lucide-react";
import { useLocation } from "wouter";
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

export default function NewNote() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [showTextNotesModal, setShowTextNotesModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const uppyRef = useRef<Uppy | null>(null);

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

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (uppyRef.current) {
        (uppyRef.current as any).close();
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

  const stopRecording = () => {
    console.log('Recording stopped');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    saveCase();
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
        if (uppyRef.current) {
          try {
            (uppyRef.current as any).close();
          } catch (e) {
            console.error('Error closing previous Uppy instance:', e);
          }
        }
        
        uppyRef.current = new Uppy({
          restrictions: {
            maxNumberOfFiles: 1,
            allowedFileTypes: ['audio/*'],
          },
        });
        
        uppyRef.current.use(AwsS3, {
          shouldUseMultipart: false,
          getUploadParameters: async () => {
            const response = await fetch('/api/object-storage/presigned-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                fileName: `recording-${Date.now()}.webm`,
                contentType: 'audio/webm',
              }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to get presigned URL');
            }
            
            const data = await response.json();
            return {
              method: 'PUT' as const,
              url: data.url,
            };
          },
        });
        
        uppyRef.current.addFile({
          name: `recording-${Date.now()}.webm`,
          type: 'audio/webm',
          data: audioBlobRef.current,
        });
        
        const result = await uppyRef.current.upload();
        
        if (result && result.successful && result.successful[0]) {
          const audioURL = result.successful[0].uploadURL;
          await apiRequest("PUT", `/api/audio/${audioResult.id}`, {
            audioURL,
            duration: recordingDuration,
          });
        }
        
        (uppyRef.current as any).close();
        uppyRef.current = null;
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
      
      // Navigate to the case detail page
      setLocation(`/case/${caseResult.id}`);
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
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Create New Note</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record client meeting with consent capture and automatic transcription
            </p>
          </div>

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
                    onClick={stopRecording}
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
    </div>
  );
}
