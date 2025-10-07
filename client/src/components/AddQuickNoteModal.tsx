import { useState, useEffect } from "react";
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

interface AddQuickNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
}

export default function AddQuickNoteModal({ open, onOpenChange, caseId }: AddQuickNoteModalProps) {
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showTranscriptionReview, setShowTranscriptionReview] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

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

  const startRecording = () => {
    console.log('Voice note recording started');
    setIsRecording(true);
    setRecordingDuration(0);
  };

  const stopRecording = () => {
    console.log('Voice note recording stopped');
    setIsRecording(false);
    
    // Simulate transcription (in real app, this would call OpenAI Whisper API)
    setTimeout(() => {
      const mockTranscription = "Follow up on clause 3.2 regarding property settlement terms. Client mentioned potential sale of secondary asset.";
      setTranscribedText(mockTranscription);
      setShowTranscriptionReview(true);
    }, 1000);
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
    console.log('Saving quick note for case:', caseId, { noteText, audioBlob });
    // Reset and close
    setNoteText("");
    setTranscribedText("");
    setAudioBlob(null);
    setRecordingDuration(0);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setNoteText("");
    setTranscribedText("");
    setAudioBlob(null);
    setRecordingDuration(0);
    setShowTranscriptionReview(false);
    onOpenChange(false);
  };

  if (showTranscriptionReview) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-transcription-review">
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
            <p className="text-xs text-muted-foreground">
              Original audio will be saved for your records
            </p>
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
      <DialogContent data-testid="dialog-add-quick-note">
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
