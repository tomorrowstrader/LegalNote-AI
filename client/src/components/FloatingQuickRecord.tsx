import { useState } from "react";
import { Mic, Square, X, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function FloatingQuickRecord() {
  const [isRecording, setIsRecording] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");

  const startRecording = () => {
    console.log('Quick recording started');
    setIsRecording(true);
    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
    
    setTimeout(() => clearInterval(interval), 60000);
  };

  const stopRecording = () => {
    console.log('Quick recording stopped');
    setIsRecording(false);
    setShowMetadataModal(true);
  };

  const saveCase = () => {
    console.log('Saving case:', { caseTitle, clientName, matterRef });
    setShowMetadataModal(false);
    setRecordingDuration(0);
    setCaseTitle("");
    setClientName("");
    setMatterRef("");
  };

  const handleCancelClick = () => {
    if (caseTitle.trim() || clientName.trim() || matterRef.trim()) {
      setShowCancelConfirmation(true);
    } else {
      setShowMetadataModal(false);
      setRecordingDuration(0);
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirmation(false);
    setShowMetadataModal(false);
    setRecordingDuration(0);
    setCaseTitle("");
    setClientName("");
    setMatterRef("");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex flex-col items-center gap-3 bg-card border border-card-border rounded-lg p-4 shadow-xl">
          <Badge className="bg-destructive animate-pulse" data-testid="badge-quick-recording">
            Recording
          </Badge>
          <p className="text-2xl font-mono font-semibold" data-testid="text-quick-duration">
            {formatDuration(recordingDuration)}
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="gap-2"
            data-testid="button-stop-quick-record"
          >
            <Square className="w-4 h-4" />
            Stop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        size="icon"
        onClick={startRecording}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent hover:bg-accent shadow-xl"
        data-testid="button-quick-record"
      >
        <Mic className="w-6 h-6" />
      </Button>

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
              onClick={handleCancelClick}
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

      <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Discard Recording?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have entered case details that will be lost if you cancel. The recording will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-editing">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-discard"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
