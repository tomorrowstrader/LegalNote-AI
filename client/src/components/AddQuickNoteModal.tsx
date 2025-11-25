import { useState, useEffect, useRef } from "react";
import { Mic, Square, FileText, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AddQuickNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
}

// Detect supported audio MIME type for cross-browser compatibility
const getSupportedMimeType = (): { mimeType: string; extension: string } => {
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
  
  return { mimeType: 'audio/webm', extension: '.webm' };
};

export default function AddQuickNoteModal({ open, onOpenChange, caseId }: AddQuickNoteModalProps) {
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showTranscriptionReview, setShowTranscriptionReview] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { toast } = useToast();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioFormatRef = useRef(getSupportedMimeType());

  const updateNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', `/api/cases/${caseId}/quick-notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'quick-notes'] });
      
      toast({
        title: "Quick Note Saved",
        description: "Your note has been added to the case successfully",
        duration: 6000,
      });
      
      // Reset and close
      setNoteText("");
      setTranscribedText("");
      setRecordingDuration(0);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save quick note",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
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
      
      mediaRecorder.onstop = async () => {
        const { mimeType } = audioFormatRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Start transcription
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      console.log('Voice note recording started');
    } catch (error: any) {
      toast({
        title: "Recording Error",
        description: error.message || "Failed to access microphone",
        variant: "destructive",
        duration: 6000,
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Voice note recording stopped');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      const formData = new FormData();
      const { extension } = audioFormatRef.current;
      formData.append('audio', audioBlob, `quicknote${extension}`);
      
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Transcription failed');
      }
      
      const data = await res.json();
      setTranscribedText(data.text || '');
      setShowTranscriptionReview(true);
    } catch (error: any) {
      toast({
        title: "Transcription Failed",
        description: error.message || "Failed to transcribe audio. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const confirmTranscription = () => {
    setNoteText(transcribedText);
    setShowTranscriptionReview(false);
    setRecordingDuration(0);
  };

  const retryTranscription = () => {
    setShowTranscriptionReview(false);
    setTranscribedText("");
    setRecordingDuration(0);
  };

  const handleSave = () => {
    if (!noteText.trim()) {
      toast({
        title: "Note Required",
        description: "Please enter a note before saving",
        variant: "destructive",
      });
      return;
    }
    
    updateNoteMutation.mutate(noteText);
  };

  const handleCancel = () => {
    // Stop recording if in progress
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    setNoteText("");
    setTranscribedText("");
    setRecordingDuration(0);
    setShowTranscriptionReview(false);
    setIsRecording(false);
    setIsTranscribing(false);
    onOpenChange(false);
  };

  // Show transcribing state
  if (isTranscribing) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-transcribing" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Transcribing Audio...</DialogTitle>
            <DialogDescription>
              Please wait while we transcribe your voice note
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <p className="text-muted-foreground">
              Meeting-to-Matter™ AI is transcribing your recording...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showTranscriptionReview) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-transcription-review" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Review Transcription</DialogTitle>
            <DialogDescription>
              Please review the transcribed text for accuracy before saving
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Important:</strong> You are responsible for the accuracy of this transcription. Please review carefully and make any necessary corrections.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="transcribed-text">Transcribed Text</Label>
            <Textarea
              id="transcribed-text"
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              rows={6}
              className="resize-none"
              data-testid="textarea-transcription"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={retryTranscription}
              data-testid="button-retry-transcription"
            >
              Re-record
            </Button>
            <Button
              onClick={confirmTranscription}
              className="bg-accent hover:bg-accent"
              data-testid="button-confirm-transcription"
            >
              Confirm & Use
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-quick-note" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add Quick Note</DialogTitle>
          <DialogDescription>
            Type a note or record a voice memo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              placeholder="Type your note here or use voice recording..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={6}
              className="resize-none"
              data-testid="textarea-note"
            />
          </div>

          <div className="flex items-center gap-2">
            {isRecording ? (
              <div className="flex items-center gap-3 flex-1 bg-card border rounded-md p-3">
                <Badge className="bg-destructive animate-pulse" data-testid="badge-voice-recording">
                  Recording
                </Badge>
                <p className="text-sm font-mono font-semibold" data-testid="text-voice-duration">
                  {formatDuration(recordingDuration)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopRecording}
                  className="gap-1 ml-auto"
                  data-testid="button-stop-voice-note"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={startRecording}
                className="gap-2"
                data-testid="button-voice-record"
              >
                <Mic className="w-4 h-4" />
                Record Voice Note
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-note"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!noteText.trim()}
            className="bg-accent hover:bg-accent"
            data-testid="button-save-note"
          >
            <FileText className="w-4 h-4 mr-2" />
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
